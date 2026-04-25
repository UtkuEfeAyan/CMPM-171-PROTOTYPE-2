import { SWIPE_DIRECTIONS } from "../constants/swipeConfig.js";
import { SlashOverlay } from "./effects/SlashOverlay.js";
import { HackOverlay } from "./effects/HackOverlay.js";

// thin dispatcher. holds a scene reference and picks the right overlay
// module based on swipe direction.

// why so small? single-responsibility: each overlay (SlashOverlay,
// HackOverlay) owns its own visuals. if you want to add a "Freeze" effect
// later, you add a FreezeOverlay file and a line here - nothing else
// needs to change. SwipeLogic still just calls effects.play(direction).
export class SwipeEffects {
  constructor(scene) {
    this.scene = scene;
  }

  // unified entry used by SwipeLogic.executeCommit.
  // input: direction string, x/y (slash needs position, hack ignores it).
  // output: promise resolved after the overlay finishes (including cleanup).
  play(direction, x, y) {
    if (direction === SWIPE_DIRECTIONS.HACK) return SlashOverlay.play(this.scene);
    if (direction === SWIPE_DIRECTIONS.SLASH) return HackOverlay.play(this.scene, x, y);
    return Promise.resolve();
  }
}
