import { EFFECT_CONFIG } from "../../constants/swipeConfig.js";

const BLOOD_TEXTURE = {
  key: "blood_drop", // texture cache key used by particle system
  size: 22, // generated texture pixel size
  radius: 11, // circle radius inside generated texture
  color: 0xcf1010, // base blood color for particles
};

export class SlashEffect {
  // create slash visuals with splatter + particles
  constructor(scene) {
    this.scene = scene;
    this.ensureBloodTexture();
  }

  // lazily generate reusable blood texture for particles
  ensureBloodTexture() {
    // build a tiny reusable texture once, then use it for particle bursts
    if (this.scene.textures.exists(BLOOD_TEXTURE.key)) return;
    const graphics = this.scene.add.graphics();
    graphics.fillStyle(BLOOD_TEXTURE.color, 1);
    graphics.fillCircle(BLOOD_TEXTURE.radius, BLOOD_TEXTURE.radius, BLOOD_TEXTURE.radius);
    graphics.generateTexture(BLOOD_TEXTURE.key, BLOOD_TEXTURE.size, BLOOD_TEXTURE.size);
    graphics.destroy();
  }

  // public entry: play slash visuals at card position
  play(x, y, onDone) {
    // slash effect is two layers: painted splatter + particle spray
    const splatter = this.createSplatter(x, y);
    const particles = this.createParticles();
    particles.explode(EFFECT_CONFIG.bloodCount, x, y);
    this.fadeAndCleanup(splatter, particles, onDone);
  }

  // draw base splatter decal layer
  createSplatter(centerX, centerY) {
    const splatter = this.scene.add.graphics();
    splatter.setDepth(EFFECT_CONFIG.depth); // decal sits under flying particles
    splatter.fillStyle(0x8f0000, 0.78); // dark red fill for base gore shape
    this.drawBlotches(splatter, centerX, centerY);
    return splatter;
  }

  // fill many random blotches to avoid repeated pattern look
  drawBlotches(splatter, centerX, centerY) {
    // random offsets make each slash feel less repetitive
    for (let i = 0; i < 28; i += 1) {
      const offsetX = Phaser.Math.FloatBetween(-EFFECT_CONFIG.bloodSpreadX, EFFECT_CONFIG.bloodSpreadX);
      const offsetY = Phaser.Math.FloatBetween(-EFFECT_CONFIG.bloodSpreadY, EFFECT_CONFIG.bloodSpreadY);
      const radiusX = Phaser.Math.FloatBetween(18, 56) * EFFECT_CONFIG.bloodScale;
      const radiusY = Phaser.Math.FloatBetween(12, 40) * EFFECT_CONFIG.bloodScale;
      splatter.fillEllipse(centerX + offsetX, centerY + offsetY, radiusX, radiusY);
    }
  }

  // create particle emitter manager used for burst
  createParticles() {
    // particle burst gives quick motion while the decal handles body
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

  // fade effect out then cleanup and continue flow
  fadeAndCleanup(splatter, particles, onDone) {
    // always destroy temporary objects after the effect window ends
    this.scene.tweens.add({
      targets: splatter,
      alpha: 0,
      delay: EFFECT_CONFIG.slashHoldMs,
      duration: EFFECT_CONFIG.slashFadeMs,
      ease: "Cubic.easeOut",
    });
    this.scene.time.delayedCall(EFFECT_CONFIG.slashCleanupMs, () => { // hard cleanup after fade window
      splatter.destroy();
      particles.destroy();
      onDone?.();
    });
  }
}
