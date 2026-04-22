// animationoverlay creates visual effects when cards are destroyed
// slash = blood splatters, hack = green scan lines

export class AnimationOverlay {
  constructor(scene) {
    this.scene = scene;
  }

  // play blood splatter effect for slash
  playSlashEffect(x, y, onComplete) {
    // create a graphics object to draw on
    const graphics = this.scene.add.graphics();
    graphics.setDepth(50); // on top of everything

    // draw random blood splatters
    const splatCount = 12;
    for (let i = 0; i < splatCount; i++) {
      // random position around the center
      const offsetX = (Math.random() - 0.5) * 200;
      const offsetY = (Math.random() - 0.5) * 200;

      // random size
      const size = Math.random() * 20 + 5;

      // blood red color
      graphics.fillStyle(0x8b0000, 1);
      graphics.fillCircle(x + offsetX, y + offsetY, size);

      // add a darker outline
      graphics.lineStyle(1, 0x5a0000);
      graphics.strokeCircle(x + offsetX, y + offsetY, size);
    }

    // fade out the effect
    this.scene.tweens.add({
      targets: graphics,
      alpha: 0,
      duration: 600,
      ease: "Cubic.easeOut",
      onComplete: () => {
        graphics.destroy();
        if (onComplete) onComplete();
      },
    });
  }


  // play scan line flicker effect for hack
  playHackEffect(x, y, onComplete) {
    // create graphics for scan lines
    const graphics = this.scene.add.graphics();
    graphics.setDepth(50);

    // draw horizontal lines across the screen
    graphics.lineStyle(2, 0x00ff00, 0.4); // green, semi-transparent

    const screenWidth = this.scene.cameras.main.width;
    const lineSpacing = 8;

    for (let yPos = 0; yPos < this.scene.cameras.main.height; yPos += lineSpacing) {
      graphics.lineBetween(0, yPos, screenWidth, yPos);
    }

    // flicker effect - opacity goes on/off
    let flickerCount = 0;
    const flickerInterval = this.scene.time.addTimer({
      delay: 75,
      callback: () => {
        // toggle opacity
        graphics.alpha = graphics.alpha === 0 ? 0.4 : 0;
        flickerCount++;

        // stop after 4 flickers
        if (flickerCount >= 8) {
          flickerInterval.remove();
          graphics.destroy();
          if (onComplete) onComplete();
        }
      },
      repeat: 7,
    });
  }

  // clean up (if needed)
  destroy() {
    // graphics are auto-destroyed after effects
  }
}
