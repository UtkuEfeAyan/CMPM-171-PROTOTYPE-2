export class StalkingScene extends Phaser.Scene {
    constructor() {
        super("stalkingScene");
    }

    preload() {}

    create() {
        this.width = this.scale.width;
        this.height = this.scale.height;

        this.gameStarted = false;
        this.hasWon = false;
        this.hasLost = false;

        this.setupMap();
        this.setupCharacters();
        this.setupObjects();
        this.setupLookBack();
        this.startCountdown();
    }

    update(time, delta) {
        if (!this.gameStarted) return;
        if (this.hasWon || this.hasLost) return;

        this.updateTarget(delta);
        this.updatePlayer(delta);
        this.updateObjects(delta);
        this.updateWarningPosition();

        if (this.isTargetLookingBack && !this.isPlayerInShadow()) {
            this.lose("Enemy saw you!");
        }

        this.checkTargetEscaped();
        this.checkWinCondition();
    }

    setupMap() {
        this.add.rectangle(
            this.width / 2,
            this.height / 2,
            this.width * 0.7,
            this.height,
            0x222222
        );

        this.leftBound = this.width * 0.15;
        this.rightBound = this.width * 0.85;
    }

    setupCharacters() {
        this.target = this.add.rectangle(
            this.width / 2,
            this.height / 4,
            40,
            40,
            0xff4444
        );

        this.player = this.add.rectangle(
            this.width / 2,
            this.height - 80,
            35,
            35,
            0x44aaff
        );

        this.keys = this.input.keyboard.addKeys({
            up: Phaser.Input.Keyboard.KeyCodes.W,
            down: Phaser.Input.Keyboard.KeyCodes.S,
            left: Phaser.Input.Keyboard.KeyCodes.A,
            right: Phaser.Input.Keyboard.KeyCodes.D
        });

        this.playerSpeed = 180;
        this.targetSpeed = 60;
    }

    setupObjects() {
        this.objects = [];
        this.objectScrollSpeed = 90;

        this.time.addEvent({
            delay: 1200,
            loop: true,
            callback: () => {
                if (this.gameStarted && !this.hasLost && !this.hasWon) {
                    this.spawnObject();
                }
            }
        });
    }

    spawnObject() {
        const x = Phaser.Math.Between(this.leftBound + 40, this.rightBound - 40);
        const y = -40;

        const shadow = this.add.rectangle(
            x,
            y + 28,
            70,
            100,
            0x000000,
            0.4
        );

        const object = this.add.rectangle(
            x,
            y,
            70,
            35,
            0x888888
        );

        this.objects.push({ object, shadow });
    }

    updateObjects(delta) {
        if (this.isTargetLookingBack) return;

        const dt = delta / 1000;

        for (let i = this.objects.length - 1; i >= 0; i--) {
            const item = this.objects[i];

            item.object.y += this.objectScrollSpeed * dt;
            item.shadow.y += this.objectScrollSpeed * dt;

            if (item.object.y > this.height + 100) {
                item.object.destroy();
                item.shadow.destroy();
                this.objects.splice(i, 1);
            }
        }
    }

    setupLookBack() {
        this.isTargetLookingBack = false;

        this.exclamation = this.add.text(
            this.target.x,
            this.target.y - 55,
            "!",
            {
                fontSize: "48px",
                color: "#ffff00"
            }
        );

        this.exclamation.setOrigin(0.5);
        this.exclamation.setDepth(100);
        this.exclamation.setVisible(false);

        this.time.delayedCall(5000, () => {
            this.scheduleLookBack();
        });
    }

    scheduleLookBack() {
        const delay = Phaser.Math.Between(3000, 6000);

        this.time.delayedCall(delay, () => {
            if (!this.scene.isActive()) return;
            if (this.hasLost || this.hasWon) return;

            this.showLookBackWarning();
        });
    }

    showLookBackWarning() {
        this.exclamation.setVisible(true);

        this.time.delayedCall(1000, () => {
            if (this.hasLost || this.hasWon) return;

            this.exclamation.setVisible(false);
            this.targetLookBack();
        });
    }

    targetLookBack() {
        this.isTargetLookingBack = true;
        this.target.setFillStyle(0x000000);

        if (!this.isPlayerInShadow()) {
            this.lose("Enemy saw you!");
            return;
        }

        this.time.delayedCall(2900, () => {
            if (this.hasLost || this.hasWon) return;

            this.isTargetLookingBack = false;
            this.target.setFillStyle(0xff4444);
            this.scheduleLookBack();
        });
    }

    updateWarningPosition() {
        this.exclamation.x = this.target.x;
        this.exclamation.y = this.target.y - 55;
    }

    updateTarget(delta) {

    }

    updatePlayer(delta) {
        const dt = delta / 1000;

        if (this.keys.up.isDown) {
            this.player.y -= this.playerSpeed * dt;
        }

        if (this.keys.down.isDown) {
            this.player.y += this.playerSpeed * dt;
        }

        if (this.keys.left.isDown) {
            this.player.x -= this.playerSpeed * dt;
        }

        if (this.keys.right.isDown) {
            this.player.x += this.playerSpeed * dt;
        }

        this.player.x = Phaser.Math.Clamp(this.player.x, this.leftBound, this.rightBound);
        this.player.y = Phaser.Math.Clamp(this.player.y, 80, this.height - 80);
    }

    isPlayerInShadow() {
        for (const item of this.objects) {
            const shadowBounds = item.shadow.getBounds();
            const playerBounds = this.player.getBounds();

            if (Phaser.Geom.Intersects.RectangleToRectangle(playerBounds, shadowBounds)) {
                return true;
            }
        }

        return false;
    }

    checkTargetEscaped() {
        if (this.target.y < 0) {
            this.lose("Target escaped!");
        }
    }

    checkWinCondition() {
        if (this.hasWon) return;

        if (this.time.now - this.survivalStartTime >= 15000) {
            this.hasWon = true;
            this.gameStarted = false;

            this.add.text(
                this.width / 2,
                this.height / 2,
                "You successfully followed the target to their house!",
                {
                    fontSize: "32px",
                    color: "#ffffff",
                    align: "center",
                    wordWrap: { width: this.width * 0.8 }
                }
            ).setOrigin(0.5).setDepth(200);
        }
    }

    startCountdown() {
        let count = 3;

        this.countdownText = this.add.text(
            this.width / 2,
            this.height / 2,
            count,
            {
                fontSize: "80px",
                color: "#ffffff"
            }
        ).setOrigin(0.5).setDepth(100);

        this.time.addEvent({
            delay: 1000,
            repeat: 3,
            callback: () => {
                count--;

                if (count > 0) {
                    this.countdownText.setText(count);
                } else if (count === 0) {
                    this.countdownText.setText("Stalk!");
                } else {
                    this.countdownText.destroy();
                    this.gameStarted = true;
                    this.survivalStartTime = this.time.now;
                }
            }
        });
    }

    lose(reason) {
        if (this.hasLost) return;

        this.hasLost = true;
        this.gameStarted = false;
        this.isTargetLookingBack = false;

        this.add.text(
            this.width / 2,
            this.height / 2 - 60,
            "You were caught!",
            {
                fontSize: "48px",
                color: "#ff4444"
            }
        ).setOrigin(0.5).setDepth(200);

        this.add.text(
            this.width / 2,
            this.height / 2,
            reason,
            {
                fontSize: "28px",
                color: "#ffffff"
            }
        ).setOrigin(0.5).setDepth(200);

        const restartButton = this.add.text(
            this.width / 2,
            this.height / 2 + 70,
            "Restart",
            {
                fontSize: "36px",
                color: "#ffffff",
                backgroundColor: "#333333",
                padding: {
                    x: 20,
                    y: 10
                }
            }
        ).setOrigin(0.5).setDepth(200);

        restartButton.setInteractive({ useHandCursor: true });

        restartButton.on("pointerdown", () => {
            this.scene.restart();
        });
    }
}