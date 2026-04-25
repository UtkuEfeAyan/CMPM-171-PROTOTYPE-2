// src/systems/InputManager.js

import { CARD_CONFIG, SCENE_CONFIG, SWIPE_DIRECTIONS } from "../constants/swipeConfig.js";

// tiny enum for the swipe state machine.
// using numbers keeps comparisons fast and intent obvious at call sites.
export const States = Object.freeze({
  IDLE: 0,      // nothing happening, card at rest
  DRAGGING: 1,  // pointer is down and moving the active card
  ANIMATING: 2, // a commit tween (or slash/snap) is running, input locked
});

// swipe state machine + input handler, combined.
// owns nothing visual: talks to a "stack" adapter with three callbacks:
//   getActive() -> current top card (or null)
//   promote() -> promise that resolves when the next card is active
//   onHackCommit(id) -> fire and forget hook for gamestate saving
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
  // slip silently into runtime.
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
    if (this.state !== States.IDLE) return;
    const card = this.stack.getActive();
    if (!card) return;
    this.state = States.DRAGGING;
    this.dragStartPointerX = pointer.x;
    card.setGrabState(true);
  }

  // pointermove handler: lerps the active card toward the pointer.
  handleMove(pointer) {
    if (this.state !== States.DRAGGING) return;
    const card = this.stack.getActive();
    if (!card) return;

    const targetX = card.centerX + (pointer.x - this.dragStartPointerX);
    card.x += (targetX - card.x) * CARD_CONFIG.dragLerp;

    const dragOffsetX = card.x - card.centerX;
    card.angle = dragOffsetX / CARD_CONFIG.rotationDivisor;

    const mappedAlpha = 1.4 - Math.abs(dragOffsetX) / CARD_CONFIG.alphaFadeRange;
    card.alpha = Phaser.Math.Clamp(mappedAlpha, CARD_CONFIG.minAlpha, 1);
  }

  // pointerup entry: decides commit vs snap-back.
  async handleRelease() {
    if (this.state !== States.DRAGGING) return;
    const card = this.stack.getActive();
    if (!card) {
      this.state = States.IDLE;
      return;
    }

    card.setGrabState(false);
    this.state = States.ANIMATING;

    const dragOffsetX = card.x - card.centerX;
    if (dragOffsetX > this.threshold) return this.executeCommit(SWIPE_DIRECTIONS.HACK);
    if (dragOffsetX < -this.threshold) return this.executeCommit(SWIPE_DIRECTIONS.SLASH);
    await this.snapBack(card);
    this.state = States.IDLE;
  }

  // keyboard parity for desktop players.
  //   d = dragging right = HACK
  //   a = dragging left  = SLASH
  handleKey(event) {
    if (this.state !== States.IDLE) return;
    if (!event.key) return;
    const key = event.key.toLowerCase();
    if (key !== "a" && key !== "d") return;
    this.state = States.ANIMATING;
    let direction;
    if (key === "d") {
      direction = SWIPE_DIRECTIONS.HACK;
    } else {
      direction = SWIPE_DIRECTIONS.SLASH;
    }
    this.executeCommit(direction);
  }

  // spring-back tween for a cancelled/short swipe.
  snapBack(card) {
    return card.animate(
      { x: card.centerX, y: card.centerY, angle: 0, alpha: 1 },
      SCENE_CONFIG.snapTweenMs,
      SCENE_CONFIG.snapEase
    );
  }

  // run the commit path for the given direction.
  // HACK  → throws card off-screen RIGHT, opens ProfileDetail.
  // SLASH → cuts card in half with blood overlay (swipe left = reject).
  async executeCommit(direction) {
    const card = this.stack.getActive();
    if (!card) {
      this.state = States.IDLE;
      return;
    }

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

      await this.stack.promote();
      this.state = States.IDLE;

    } else {
      // HACK: notify gamestate, throw card off-screen RIGHT, then navigate.
      if (typeof this.stack.onHackCommit === "function") {
        this.stack.onHackCommit(card.id);
      }
      // play overlay only if effects subsystem is wired, otherwise use a no-op promise
      let hackOverlayPromise;
      if (this.effects) {
        hackOverlayPromise = this.effects.play(direction);
      } else {
        hackOverlayPromise = Promise.resolve();
      }
      // throw card OFF-SCREEN TO THE RIGHT (positive x) since the player swiped right.
      // throwHackX in config is negative (left exit); we negate it here for the right exit.
      await Promise.all([
        card.animate(
          {
            x: card.centerX + Math.abs(SCENE_CONFIG.throwHackX), // exit right
            y: card.centerY - SCENE_CONFIG.throwRiseY,
            angle: -SCENE_CONFIG.throwHackAngle,                 // tilt mirrors too
            alpha: 0,
          },
          SCENE_CONFIG.throwTweenMs,
          "Quad.easeIn"
        ),
        hackOverlayPromise,
      ]);

      // fire navigation hook so SwipeDeckScene opens ProfileDetail.
      // promote() is NOT called here — SwipeDeckScene.onSceneResume() does it
      // after the user exits ProfileDetail, keeping deck state consistent.
      if (typeof this.stack.onHackNavigate === "function") {
        this.stack.onHackNavigate(card.id);
        // state stays ANIMATING; SwipeDeckScene re-idles it on resume.
      } else {
        // fallback: no navigation wired, just advance the deck normally.
        await this.stack.promote();
        this.state = States.IDLE;
      }
    }
  }
}