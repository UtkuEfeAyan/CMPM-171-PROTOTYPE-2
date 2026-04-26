/*
 * TitleScreenScene: This scene serves as an entry point to the game, displaying a phone screen
 * with a hit area to be able to transition to the SwipeDeckScene. It features the phone screen
 * image, the interactive hit area, and a "tap to open" hint label.
*/

export class TitleScreenScene extends Phaser.Scene {
    constructor() {
        super({ key: "TitleScreen" });
    }

    preload() {
        this.load.image("phoneBg", "assets/PhoneBackgroundBlurred.png");
    }

    create() {
        const { width, height } = this.scale;

        this.bg = this.add
        .image(width / 2, height / 2, "phoneBg")
        .setDepth(0);

        const scaleX = width / this.bg.width;
        const scaleY = height / this.bg.height;

        const scale = Math.min(scaleX, scaleY); 

        this.bg.setScale(scale);

        const vignette = this.add.graphics().setDepth(1);
        vignette.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0, 0, 0, 0.55);
        vignette.fillRect(0, height * 0.55, width, height * 0.45);

        const btnY = height - height * 0.1;
        const btnX = width / 2;
        const RADIUS = Math.min(width, height) * 0.065;

        this.btn = this.add
        .circle(btnX, btnY, RADIUS, 0xffffff, 0)
        .setDepth(3)
        .setInteractive({ useHandCursor: true });

        this.btn.on("pointerup", () => this._transition());

        this.hint = this.add.text(btnX, btnY - RADIUS * 1.9, "tap to open", {
          fontFamily: '"SF Pro Display", "Helvetica Neue", sans-serif',
          fontSize: Math.round(height * 0.018) + "px",
          color: "#ffffff",
          alpha: 0.6,
          letterSpacing: 3,
        })
        .setOrigin(0.5, -3.2)
        .setDepth(5)
        .setAlpha(0.55);

        this.tweens.add({
            targets: this.hint,
            alpha: { from: 0.15, to: 0.65 },
            duration: 1800,
            ease: "Sine.easeInOut",
            yoyo: true,
            repeat: -1,
        });

        this.btn.on("pointerover", () => this._onOver());
        this.btn.on("pointerout",  () => this._onOut());
        this.btn.on("pointerdown", () => this._onDown());
        this.btn.on("pointerup",   () => this._onUp());

        this._btnX = btnX;
        this._btnY = btnY;
        this._btnR = RADIUS;

        this.scale.on("resize", this._onResize, this);
    }

    _transition() {
        this.cameras.main.fadeOut(400, 0, 0, 0);
        this.cameras.main.once("camerafadeoutcomplete", () => {
            this.scene.start("SwipeDeck");
        });
    }

}
