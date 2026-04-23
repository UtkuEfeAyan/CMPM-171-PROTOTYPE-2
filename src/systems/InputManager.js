import { CARD_CONFIG, SCENE_CONFIG, SWIPE_DIRECTIONS } from "../constants/swipeConfig.js";

// tiny enum for the swipe state machine.
// using numbers keeps comparisons fast and intent obvious at call sites.
export const States = Object.freeze({
  IDLE: 0, // nothing happening, card at rest
  DRAGGING: 1, // pointer is down and moving the active card
  ANIMATING: 2, // a commit tween (or slash/snap) is running, input locked
});

// swipe state machine + input handler, combined.
// owns nothing visual: talks to a "stack" adapter with three callbacks:
//   getActive() -> current top card (or null)
//   promote() -> promise that resolves when the next card is active
//   onHackCommit(id) -> fire and forget hook for gamestate saving
export class SwipeLogic {
  /**
   * construct the swipe logic around a scene + stack adapter.
   * input: scene (for tweens/camera), stack adapter, optional overrides.
   * default threshold/lerp/rotation come from shared config so tuning
   * happens in one file.
   */
  constructor(scene, stack, options = {}) {
    this.scene = scene;
    this.stack = stack;
    this.state = States.IDLE;
    this.threshold = options.threshold ?? SCENE_CONFIG.swipeThreshold;
    this.effects = options.effects ?? null; // optional SwipeEffects instance for overlays
    this.dragStartPointerX = 0; // captured on pointerdown so move math is consistent
  }

  /**
   * pointerdown entry: transition IDLE -> DRAGGING if a card exists.
   * input: phaser pointer. ignores input while animating to prevent collisions.
   */
  beginDrag(pointer) {
    if (this.state !== States.IDLE) return; // lock out during ANIMATING
    const card = this.stack.getActive();
    if (!card) return;
    this.state = States.DRAGGING;
    this.dragStartPointerX = pointer.x;
    card.setGrabState(true);
  }

  /**
   * pointermove handler: lerps the active card toward the pointer.
   * input: phaser pointer. only runs while DRAGGING.
   * formula: new = current + (target - current) * lerp
   * rotation and alpha are mapped from drag distance for visual feedback.
   */
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

  /**
   * pointerup entry: decides commit vs snap-back.
   * input: none (reads the card's current offset).
   * DRAGGING -> ANIMATING during tween; IDLE again once resolved.
   */
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

  /**
   * keyboard parity for desktop players.
   * a = hack, d = slash. only fires from IDLE so typing mid-animation is ignored.
   */
  handleKey(event) {
    if (this.state !== States.IDLE) return;
    const key = event.key?.toLowerCase();
    if (key !== "a" && key !== "d") return;
    this.state = States.ANIMATING;
    const direction = key === "d" ? SWIPE_DIRECTIONS.SLASH : SWIPE_DIRECTIONS.HACK;
    this.executeCommit(direction);
  }

  /**
   * spring-back tween for a cancelled/short swipe.
   * input: card to reset. output: promise that resolves when tween ends.
   * keeps the card at rest pose (centerX/centerY, zero angle, full alpha).
   */
  snapBack(card) {
    return card.animate(
      { x: card.centerX, y: card.centerY, angle: 0, alpha: 1 },
      SCENE_CONFIG.snapTweenMs,
      SCENE_CONFIG.snapEase
    );
  }

  /**
   * run the commit path for the given direction.
   * input: "SLASH" or "HACK".
   * SLASH plays the cut-in-half animation (stays in place, visual death).
   * HACK records the id and throws the card off-screen left.
   * both end with stack.promote() and returning state to IDLE.
   */
  async executeCommit(direction) {
    const card = this.stack.getActive();
    if (!card) {
      this.state = States.IDLE;
      return;
    }

    if (direction === SWIPE_DIRECTIONS.SLASH) {
      // slash plays the cut-in-half card animation AND the blood overlay together.
      // Promise.all keeps both visuals synchronized without extra state tracking.
      await Promise.all([
        card.playSlashAnimation(),
        this.effects ? this.effects.play(direction, card.x, card.y) : Promise.resolve(),
      ]);
    } else {
      this.stack.onHackCommit?.(card.id);
      // hack: throw card off-screen AND play the binary rain overlay together.
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
        this.effects ? this.effects.play(direction) : Promise.resolve(),
      ]);
    }

    await this.stack.promote();
    this.state = States.IDLE;
  }
}
