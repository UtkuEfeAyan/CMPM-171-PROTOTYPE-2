import { EFFECT_CONFIG, SWIPE_DIRECTIONS } from "../constants/swipeConfig.js";

// shared blood texture used by the slash particle emitter.
// generated once per scene so every burst reuses the same pixels.
const BLOOD_TEXTURE = {
  key: "blood_drop",
  size: 22,
  radius: 11,
  color: 0xcf1010,
};

// overlay effects for committed swipes.
// one module owns both slash blood and hack binary rain so wiring is simple:
// SwipeLogic just calls effects.play(direction, card) and awaits the promise.
export class SwipeEffects {
  /**
   * input: scene. output: an instance ready to play overlays.
   * also generates the reusable blood particle texture if missing.
   */
  constructor(scene) {
    this.scene = scene;
    this.ensureBloodTexture();
  }

  /**
   * unified entry used by SwipeLogic.
   * input: direction string, x/y (slash needs position, hack ignores it).
   * output: promise that resolves after the visual finishes.
   */
  play(direction, x, y) {
    if (direction === SWIPE_DIRECTIONS.SLASH) return this.playSlash(x, y);
    if (direction === SWIPE_DIRECTIONS.HACK) return this.playHack();
    return Promise.resolve();
  }

  // ---------------------------------------------------------------------------
  // slash: painted blood decal + quick particle burst
  // ---------------------------------------------------------------------------

  /**
   * play blood splatter at the given card position.
   * input: x/y in world space. output: promise resolved after cleanup.
   */
  playSlash(x, y) {
    const splatter = this.createSplatter(x, y);
    const particles = this.createBloodParticles();
    particles.explode(EFFECT_CONFIG.bloodCount, x, y);
    return this.fadeAndCleanupSlash(splatter, particles);
  }

  /**
   * lazily create the small circle texture used by the particle emitter.
   * input: none. safe to call multiple times (skips if already created).
   */
  ensureBloodTexture() {
    if (this.scene.textures.exists(BLOOD_TEXTURE.key)) return;
    const graphics = this.scene.add.graphics();
    graphics.fillStyle(BLOOD_TEXTURE.color, 1);
    graphics.fillCircle(BLOOD_TEXTURE.radius, BLOOD_TEXTURE.radius, BLOOD_TEXTURE.radius);
    graphics.generateTexture(BLOOD_TEXTURE.key, BLOOD_TEXTURE.size, BLOOD_TEXTURE.size);
    graphics.destroy();
  }

  /**
   * draw the base blood decal (many random ellipses) as a single graphics object.
   * input: centerX/centerY of the splatter center.
   * output: graphics object (caller is responsible for destroying it).
   */
  createSplatter(centerX, centerY) {
    const splatter = this.scene.add.graphics();
    splatter.setDepth(EFFECT_CONFIG.depth);
    splatter.fillStyle(0x8f0000, 0.78);
    this.drawSplatterBlobs(splatter, centerX, centerY);
    return splatter;
  }

  /**
   * fill the splatter graphics with random ellipses.
   * randomness keeps each slash visually different.
   */
  drawSplatterBlobs(splatter, centerX, centerY) {
    for (let i = 0; i < 28; i += 1) {
      const offsetX = Phaser.Math.FloatBetween(-EFFECT_CONFIG.bloodSpreadX, EFFECT_CONFIG.bloodSpreadX);
      const offsetY = Phaser.Math.FloatBetween(-EFFECT_CONFIG.bloodSpreadY, EFFECT_CONFIG.bloodSpreadY);
      const radiusX = Phaser.Math.FloatBetween(18, 56) * EFFECT_CONFIG.bloodScale;
      const radiusY = Phaser.Math.FloatBetween(12, 40) * EFFECT_CONFIG.bloodScale;
      splatter.fillEllipse(centerX + offsetX, centerY + offsetY, radiusX, radiusY);
    }
  }

  /**
   * create a non-emitting particle manager for blood bursts.
   * we call explode(count, x, y) to fire the burst at the impact point.
   */
  createBloodParticles() {
    return this.scene.add.particles(0, 0, BLOOD_TEXTURE.key, {
      speed: { min: EFFECT_CONFIG.bloodSpeedMin, max: EFFECT_CONFIG.bloodSpeedMax },
      angle: { min: 200, max: 340 },
      lifespan: 950,
      gravityY: EFFECT_CONFIG.bloodGravity,
      alpha: { start: 1, end: 0 },
      scale: { start: EFFECT_CONFIG.bloodScale, end: 0.2 },
      emitting: false,
      depth: EFFECT_CONFIG.depth + 1,
    });
  }

  /**
   * fade out decal, destroy temp objects, resolve promise.
   * input: splatter graphics + particle manager.
   */
  fadeAndCleanupSlash(splatter, particles) {
    this.scene.tweens.add({
      targets: splatter,
      alpha: 0,
      delay: EFFECT_CONFIG.slashHoldMs,
      duration: EFFECT_CONFIG.slashFadeMs,
      ease: "Cubic.easeOut",
    });
    return new Promise((resolve) => {
      this.scene.time.delayedCall(EFFECT_CONFIG.slashCleanupMs, () => {
        splatter.destroy();
        particles.destroy();
        resolve();
      });
    });
  }

  // ---------------------------------------------------------------------------
  // hack: green screen tint + falling binary columns
  // ---------------------------------------------------------------------------

  /**
   * play the matrix-style binary rain hack effect across the whole camera.
   * input: none. output: promise resolved after everything fades and destroys.
   */
  playHack() {
    const backdrop = this.createHackBackdrop();
    const columns = this.createHackColumns();
    return this.animateHackSequence(backdrop, columns);
  }

  /**
   * full-screen dark green rectangle used as the scene tint.
   */
  createHackBackdrop() {
    const camera = this.scene.cameras.main;
    return this.scene.add
      .rectangle(camera.width / 2, camera.height / 2, camera.width, camera.height, 0x022d12, 0.16)
      .setDepth(EFFECT_CONFIG.depth);
  }

  /**
   * build one text column of falling 0/1 per hackColumnSpacing across the screen.
   * output: array of text game objects (caller destroys them in cleanup).
   */
  createHackColumns() {
    const columns = [];
    const camera = this.scene.cameras.main;
    for (let x = 0; x <= camera.width; x += EFFECT_CONFIG.hackColumnSpacing) {
      columns.push(this.createHackColumn(x, camera.height + 280));
    }
    return columns;
  }

  /**
   * one column: starts above the screen, tweens down to targetY.
   * input: x position and y target.
   */
  createHackColumn(x, targetY) {
    const column = this.scene.add.text(x, -420, this.makeBinaryText(), {
      color: "#9dff62",
      fontSize: "30px",
      fontFamily: "Courier New, monospace",
    });
    column.setDepth(EFFECT_CONFIG.depth + 1).setAlpha(0.92);
    column.setStroke("#4eff1f", 1);
    column.setShadow(0, 0, "#2cff00", 10, true, true);
    this.scene.tweens.add({
      targets: column,
      y: targetY,
      duration: Phaser.Math.Between(EFFECT_CONFIG.hackRainMinMs, EFFECT_CONFIG.hackRainMaxMs),
      ease: "Sine.easeInOut",
    });
    return column;
  }

  /**
   * build a vertical string of random 0s and 1s.
   * length controlled by EFFECT_CONFIG.hackBinaryLength.
   */
  makeBinaryText() {
    const digits = [];
    for (let i = 0; i < EFFECT_CONFIG.hackBinaryLength; i += 1) {
      digits.push(Math.random() > 0.5 ? "1" : "0");
    }
    return digits.join("\n");
  }

  /**
   * grow backdrop in, hold, then fade everything out and destroy.
   * input: backdrop + columns. output: promise that resolves after cleanup.
   */
  animateHackSequence(backdrop, columns) {
    return new Promise((resolve) => {
      this.scene.tweens.add({
        targets: backdrop,
        alpha: 0.4,
        duration: EFFECT_CONFIG.hackGrowMs,
        ease: "Sine.easeOut",
        onComplete: () => this.fadeHackOut(backdrop, columns, resolve),
      });
    });
  }

  /**
   * final fade + destroy step. runs after the grow-in completes.
   */
  fadeHackOut(backdrop, columns, resolve) {
    this.scene.tweens.add({
      targets: [backdrop, ...columns],
      alpha: 0,
      delay: EFFECT_CONFIG.hackHoldMs,
      duration: EFFECT_CONFIG.hackFadeMs,
      ease: "Cubic.easeOut",
      onComplete: () => {
        backdrop.destroy();
        columns.forEach((column) => column.destroy());
        resolve();
      },
    });
  }
}
