import { EFFECT_CONFIG } from "../../constants/swipeConfig.js";

export class HackEffect {
  // create full-screen hack effect with matrix-like rain
  constructor(scene) {
    this.scene = scene;
  }

  // public entry: compose and animate all hack layers
  play(onDone) {
    // hack look is intentionally simple: tint backdrop + falling binary columns
    const backdrop = this.createBackdrop();
    const binaryColumns = this.createBinaryColumns();
    this.animateBackdrop(backdrop, binaryColumns, onDone);
  }

  // build dark green screen tint behind falling digits
  createBackdrop() {
    const camera = this.scene.cameras.main;
    // full-screen rectangle centered on camera for quick hack tint layer
    return this.scene.add
      .rectangle(camera.width / 2, camera.height / 2, camera.width, camera.height, 0x022d12, 0.16)
      .setDepth(EFFECT_CONFIG.depth);
  }

  // create one text column across the camera width spacing
  createBinaryColumns() {
    const columns = [];
    const camera = this.scene.cameras.main;
    // build vertical columns from left to right across the whole camera
    for (let x = 0; x <= camera.width; x += EFFECT_CONFIG.hackColumnSpacing) {
      columns.push(this.createColumn(x, camera.height + 280));
    }
    return columns;
  }

  // create and animate a single binary rain column
  createColumn(x, targetY) {
    // each column gets random binary text and a downward tween
    const column = this.scene.add.text(x, -420, this.makeBinaryText(), {
      color: "#9dff62",
      fontSize: "30px",
      fontFamily: "Courier New, monospace",
    });
    column.setDepth(EFFECT_CONFIG.depth + 1).setAlpha(0.92); // keep text above backdrop
    column.setStroke("#4eff1f", 1); // subtle edge glow on characters
    column.setShadow(0, 0, "#2cff00", 10, true, true); // fake neon bloom for hack look
    this.scene.tweens.add({
      targets: column,
      y: targetY,
      duration: Phaser.Math.Between(EFFECT_CONFIG.hackRainMinMs, EFFECT_CONFIG.hackRainMaxMs),
      ease: "Sine.easeInOut",
    });
    return column;
  }

  // randomize 0/1 string so columns feel alive
  makeBinaryText() {
    // generate one text block like:
    // 1
    // 0
    // 1
    const digits = [];
    for (let i = 0; i < EFFECT_CONFIG.hackBinaryLength; i += 1) {
      digits.push(Math.random() > 0.5 ? "1" : "0");
    }
    return digits.join("\n");
  }

  // fade backdrop in before starting cleanup phase
  animateBackdrop(backdrop, binaryColumns, onDone) {
    this.scene.tweens.add({
      targets: backdrop,
      alpha: 0.4, // darken scene as hack effect ramps in
      duration: EFFECT_CONFIG.hackGrowMs,
      ease: "Sine.easeOut",
      onComplete: () => this.fadeOut(backdrop, binaryColumns, onDone),
    });
  }

  // fade everything out and destroy temporary objects
  fadeOut(backdrop, binaryColumns, onDone) {
    // fade and cleanup all temporary objects to avoid memory bloat
    this.scene.tweens.add({
      targets: [backdrop, ...binaryColumns],
      alpha: 0,
      delay: EFFECT_CONFIG.hackHoldMs,
      duration: EFFECT_CONFIG.hackFadeMs,
      ease: "Cubic.easeOut",
      onComplete: () => {
        backdrop.destroy();
        binaryColumns.forEach((column) => column.destroy());
        onDone?.();
      },
    });
  }
}
