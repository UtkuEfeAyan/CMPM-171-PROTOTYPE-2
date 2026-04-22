

import { CardStack } from "./src/systems/CardStack.js";
import { InputController } from "./src/systems/InputController.js";
import { AnimationOverlay } from "./src/systems/AnimationOverlay.js";
import { SwipeCard } from "./src/objects/SwipeCard.js";

const { Phaser } = window;

class SwipeDeckScene extends Phaser.Scene {
  constructor() {
    super({ key: "SwipeDeck" });
    this.cardStack = null;
    this.inputController = null;
    this.animationOverlay = null;
    this.card = null;
    console.log("[SwipeDeckScene] constructor");
  }

  preload() {
    this.load.json("profiles", "src/data/profiles.json");
  }

  create() {
    console.log("[SwipeDeckScene] create start");
    
    // get profiles
    const profiles = this.cache.json.get("profiles").profiles;

    // preload images
    profiles.forEach((p) => SwipeCard.preload(this, p));

    // init systems
    this.cardStack = new CardStack();
    this.inputController = new InputController(this);
    this.animationOverlay = new AnimationOverlay(this);

    // listen to card ready
    this.cardStack.on("onCardReady", (profile) => {
      console.log(`[SwipeDeckScene] card ready: ${profile.name}`);
      this.card = SwipeCard.create(
        this,
        profile,
        this.cameras.main.width / 2,
        this.cameras.main.height / 2
      );
    });

    // listen to stack empty
    this.cardStack.on("onStackEmpty", () => {
      console.log("[SwipeDeckScene] all cards done!");
    });

    // listen to drag move
    this.inputController.on("onSwipeMove", ({ dragX, dragY }) => {
      if (this.card) {
        this.card.updateFromDrag(dragX, dragY);
      }
    });

    // listen to drag end
    this.inputController.on("onSwipeEnd", ({ direction }) => {
      if (!this.card) return;

      console.log(`[SwipeDeckScene] swipe end: ${direction}`);
      this.inputController.setInputBlocked(true);

      if (direction === "slash" || direction === "hack") {
        // throw card off screen
        this.tweens.add({
          targets: this.card,
          x: direction === "slash" ? 600 : -100,
          y: this.card.y - 300,
          rotation: direction === "slash" ? 0.8 : -0.8,
          alpha: 0,
          duration: 400,
          ease: "Quad.easeIn",
        });

        // play effect
        this.animationOverlay.playEffect(direction, this.card.x, this.card.y, () => {
          console.log(`[SwipeDeckScene] effect done, destroying card`);
          this.card.destroy();
          this.cardStack.destroyCard(direction);
          this.inputController.setInputBlocked(false);
        });
      } else {
        // snap back
        console.log("[SwipeDeckScene] snapping back");
        this.tweens.add({
          targets: this.card,
          x: this.card.centerX,
          y: this.card.centerY,
          rotation: 0,
          duration: 300,
          ease: "Cubic.easeOut",
          onComplete: () => {
            this.inputController.setInputBlocked(false);
          },
        });
      }
    });

    // init card stack
    this.cardStack.init(profiles);
    console.log("[SwipeDeckScene] create done");
  }
}

const gameConfig = {
  type: Phaser.AUTO,
  parent: "game-root",
  backgroundColor: "#15100d",
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: window.innerWidth,
    height: window.innerHeight,
  },
  input: {
    activePointers: 1,
    windowEvents: true,
    touch: { capture: true },
  },
  scene: [SwipeDeckScene],
};

if (!Phaser) {
  throw new Error("Phaser failed to load. Ensure lib/phaser.js is available.");
}

window.addEventListener(
  "load",
  () => {
    window.swipePrototypeGame = new Phaser.Game(gameConfig);
  },
  { once: true }
);