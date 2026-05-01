import { CARD_CONFIG, SCENE_CONFIG, SWIPE_DIRECTIONS } from "../constants/swipeConfig.js";

// tiny enum for the swipe state machine.
// using numbers keeps comparisons fast and intent obvious at call sites.
export const States = Object.freeze({
  IDLE: 0, // nothing happening, card at rest
  DRAGGING: 1, // pointer is down and moving the active card
  ANIMATING: 2, // a commit tween (or slash/snap) is running, input locked
});

// swipe state machine + input handler, combined.
// owns nothing visual: talks to a "stack" adapter with these callbacks:
//   getActive() -> current top card (or null)                 [required]
//   promote() -> promise that resolves when the next card is active  [required]

//   onHackCommit(id) -> fire-and-forget hook for gamestate saving    [optional]
//   onHackComplete(profile) -> post-animation redirect hook fired    [optional]
//     once the hack tween finished AND the next card has dropped in.
//     this is where teammates plug in minigame scene transitions.

// Also onHackCommit -> ProfileDetailScene in SwipeDeckScene
export class SwipeLogic {
  // construct the swipe logic around a scene + stack adapter.
  // input: scene (for tweens/camera), stack adapter, optional overrides.
  // default threshold/lerp/rotation come from shared config so tuning
  // happens in one file.
  constructor(scene, stack, options = {}) {
    this.assertStackShape(stack);
    this.scene = scene;
    this.stack = stack;
    this.state = States.IDLE;
    // use caller-provided threshold if given, otherwise fall back to config default
    if (options.threshold !== undefined) {
      this.threshold = options.threshold;
    } else {
      this.threshold = SCENE_CONFIG.swipeThreshold;
    }
    // default to no effects when none provided so overlay calls can be skipped safely
    if (options.effects) {
      this.effects = options.effects;
    } else {
      this.effects = null;
    }
    this.dragStartPointerX = 0; // captured on pointerdown so move math is consistent
  }

  // developer-facing contract check for the stack adapter.
  // fails loudly with a clear message when wiring is wrong so bugs never
  // slip silently into runtime. this is defensive programming: instead of
  // a mystery "undefined is not a function" later, we get a named error
  // right at construction.
  assertStackShape(stack) {
    if (!stack || typeof stack !== "object") {
      throw new Error("[SwipeLogic] stack adapter is required");
    }
    if (typeof stack.getActive !== "function") {
      throw new Error("[SwipeLogic] stack.getActive must be a function");
    }
    if (typeof stack.promote !== "function") {
      throw new Error("[SwipeLogic] stack.promote must be a function");
    }
  }

  // pointerdown entry: transition IDLE -> DRAGGING if a card exists.
  // input: phaser pointer. ignores input while animating to prevent collisions.
  beginDrag(pointer) {
    if (this.state !== States.IDLE) return; // lock out during ANIMATING
    const card = this.stack.getActive();
    if (!card) return;
    this.state = States.DRAGGING;
    this.dragStartPointerX = pointer.x;
    card.setGrabState(true);
  }

  // pointermove handler: lerps the active card toward the pointer.
  // input: phaser pointer. only runs while DRAGGING.
  // formula: new = current + (target - current) * lerp
  // rotation and alpha are mapped from drag distance for visual feedback.
  handleMove(pointer) {
    if (this.state !== States.DRAGGING) return;
    const card = this.stack.getActive();
    if (!card) return;

    // target is the card resting position offset by current pointer drag.
    const targetX = card.centerX + (pointer.x - this.dragStartPointerX);
    card.x += (targetX - card.x) * CARD_CONFIG.dragLerp;

    // tilt in degrees as card moves left/right of its rest point.
    const dragOffsetX = card.x - card.centerX;
    card.angle = dragOffsetX / CARD_CONFIG.rotationDivisor;

    // fade card slightly as it approaches the commit threshold.
    const mappedAlpha = 1.4 - Math.abs(dragOffsetX) / CARD_CONFIG.alphaFadeRange;
    card.alpha = Phaser.Math.Clamp(mappedAlpha, CARD_CONFIG.minAlpha, 1);
  }

  // pointerup entry: decides commit vs snap-back.
  // input: none (reads the card's current offset).
  // DRAGGING -> ANIMATING during tween; IDLE again once resolved.
  async handleRelease() {
    if (this.state !== States.DRAGGING) return;
    const card = this.stack.getActive();
    if (!card) {
      this.state = States.IDLE;
      return;
    }

    card.setGrabState(false);
    this.state = States.ANIMATING; // lock input during resolution

    const dragOffsetX = card.x - card.centerX;
    if (dragOffsetX > this.threshold) return this.executeCommit(SWIPE_DIRECTIONS.SLASH);
    if (dragOffsetX < -this.threshold) return this.executeCommit(SWIPE_DIRECTIONS.HACK);
    await this.snapBack(card);
    this.state = States.IDLE;
  }

  // keyboard parity for desktop players.
  // a = hack, d = slash. only fires from IDLE so typing mid-animation is ignored.
  handleKey(event) {
    if (this.state !== States.IDLE) return;
    // bail early if the event does not carry a key (modifier-only events)
    if (!event.key) return;
    const key = event.key.toLowerCase();
    if (key !== "a" && key !== "d") return;
    this.state = States.ANIMATING;
    // pick direction based on key: d means slash (right), a means hack (left)
    let direction;
    if (key === "d") {
      direction = SWIPE_DIRECTIONS.SLASH;
    } else {
      direction = SWIPE_DIRECTIONS.HACK;
    }
    this.executeCommit(direction);
  }

  // spring-back tween for a cancelled/short swipe.
  // input: card to reset. output: promise that resolves when tween ends.
  // keeps the card at rest pose (centerX/centerY, zero angle, full alpha).
  snapBack(card) {
    return card.animate(
      { x: card.centerX, y: card.centerY, angle: 0, alpha: 1 },
      SCENE_CONFIG.snapTweenMs,
      SCENE_CONFIG.snapEase
    );
  }

  // run the commit path for the given direction.
  // input: "SLASH" or "HACK".
  // SLASH plays the cut-in-half animation (stays in place, visual death).
  // HACK records the id, throws the card off-screen left, plays binary rain,
  //      then calls onHackAnimationComplete (if wired) BEFORE promoting so
  //      the caller can launch ProfileDetailScene while SwipeDeck pauses.
  //      After promote, calls onHackComplete for redirection
  async executeCommit(direction) {
    const card = this.stack.getActive();
    if (!card) {
      this.state = States.IDLE;
      return;
    }


    // capture the profile up-front because once promote() runs the active
    // card is destroyed and card.profile is no longer reachable.
    const hackedProfile = card.profile;

    if (direction === SWIPE_DIRECTIONS.SLASH) {
      // play overlay only if effects subsystem is wired, otherwise use a no-op promise
      let slashOverlayPromise;
      if (this.effects) {
        slashOverlayPromise = this.effects.play(direction, card.x, card.y);
      } else {
        slashOverlayPromise = Promise.resolve();
      }
      // slash plays the cut-in-half card animation AND the blood overlay together.
      // Promise.all keeps both visuals synchronized without extra state tracking.
      await Promise.all([card.playSlashAnimation(), slashOverlayPromise]);
    } else {
      // notify the stack so gamestate can persist this hack, only if a hook was wired.
      // pass full profile object so SwipeDeckScene can store it for the detail scene.
      if (typeof this.stack.onHackCommit === "function") {
        this.stack.onHackCommit(card.id, hackedProfile);
      }

      // play overlay only if effects subsystem is wired, otherwise use a no-op promise
      let hackOverlayPromise;
      if (this.effects) {
        hackOverlayPromise = this.effects.play(direction);
      } else {
        hackOverlayPromise = Promise.resolve();
      }

      // throw card off-screen AND play the binary rain overlay together.
      // both must finish before we notify the scene and promote the stack.
      await Promise.all([
        card.animate(
          {
            x: card.centerX + SCENE_CONFIG.throwHackX,
            y: card.centerY - SCENE_CONFIG.throwRiseY,
            angle: SCENE_CONFIG.throwHackAngle,
            alpha: 0,
          },
          SCENE_CONFIG.throwTweenMs,
          "Quad.easeIn"
        ),
        hackOverlayPromise,
      ]);

      // binary rain has finished — notify the scene so it can launch
      // ProfileDetailScene BEFORE we promote (which resets the stack).
      // the hook is optional so removing it can't break existing callers.
      if (typeof this.stack.onHackAnimationComplete === "function") {
        await this.stack.onHackAnimationComplete(hackedProfile);
      }
    }

    await this.stack.promote();
    this.state = States.IDLE;

    // post-promote redirect hook
    if (direction === SWIPE_DIRECTIONS.HACK) {
      if (typeof this.stack.onHackComplete === "function") {
        this.stack.onHackComplete(hackedProfile);
      }
    }
  }
}