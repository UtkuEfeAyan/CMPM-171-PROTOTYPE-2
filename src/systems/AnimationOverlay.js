// simple effects - draw and fade

export class AnimationOverlay {
  constructor(scene) {
    this.scene = scene;
    console.log("[AnimationOverlay] created");
  }

  // one method for both effects
  playEffect(type, x, y, onDone) {
    console.log(`[AnimationOverlay] playing ${type} effect`);
    
    const graphics = this.scene.add.graphics();
    graphics.setDepth(50);

    if (type === "slash") {
      // draw blood circles
      for (let i = 0; i < 10; i++) {
        const ox = (Math.random() - 0.5) * 200;
        const oy = (Math.random() - 0.5) * 200;
        const size = Math.random() * 15 + 5;
        graphics.fillStyle(0x8b0000, 1);
        graphics.fillCircle(x + ox, y + oy, size);
      }
    } else if (type === "hack") {
      // draw green lines
      graphics.lineStyle(2, 0x00ff00, 0.3);
      for (let yy = 0; yy < this.scene.cameras.main.height; yy += 10) {
        graphics.lineBetween(0, yy, this.scene.cameras.main.width, yy);
      }
    }

    // fade out
    this.scene.tweens.add({
      targets: graphics,
      alpha: 0,
      duration: 600,
      ease: "Cubic.easeOut",
      onComplete: () => {
        console.log(`[AnimationOverlay] ${type} effect done`);
        graphics.destroy();
        if (onDone) onDone();
      },
    });
  }
}
