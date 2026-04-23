import { SWIPE_DIRECTIONS } from "../constants/swipeConfig.js";
import { SlashEffect } from "./effects/SlashEffect.js";
import { HackEffect } from "./effects/HackEffect.js";

export class AnimationOverlay {
  // hold concrete effect implementations and route calls
  constructor(scene) {
    this.scene = scene;
    // keep heavy effect code out of the scene by delegating here
    this.slashEffect = new SlashEffect(scene);
    this.hackEffect = new HackEffect(scene);
  }

  // dispatch effect call based on swipe direction
  playEffect(direction, x, y, onDone) {
    // slash uses card position, hack is full-screen and ignores x/y
    if (direction === SWIPE_DIRECTIONS.SLASH) return this.slashEffect.play(x, y, onDone); // local impact effect where card exits
    return this.hackEffect.play(onDone); // screen-wide binary overlay for hack branch
  }
}
