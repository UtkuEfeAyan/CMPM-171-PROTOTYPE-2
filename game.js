

import { CardStack } from "./src/systems/CardStack.js";
import { InputController } from "./src/systems/InputController.js";
import { AnimationOverlay } from "./src/systems/AnimationOverlay.js";
import { SwipeCard } from "./src/objects/SwipeCard.js";

const { Phaser } = window;

if (!Phaser) {
  throw new Error("Phaser failed to load. Ensure lib/phaser.js is available.");
}

// main scene that runs the card stack and handles swipes
class SwipeDeckScene extends Phaser.Scene {
  constructor() {
    super({ key: "SwipeDeck" });
    this.cardStack = null;
    this.inputController = null;
    this.animationOverlay = null;
    this.currentCard = null;
    this.peekCard = null;
    this.profilesData = null;
  }

  // load profile data and images
  preload() {
    this.load.json("profiles", "src/data/profiles.json");
  }

  // set up the card stack and input
  create() {
    // get profile data
    this.profilesData = this.cache.json.get("profiles").profiles;

    // preload all card images
    this.profilesData.forEach((profile) => {
      SwipeCard.preload(this, profile);
    });

    // initialize the card stack
    this.cardStack = new CardStack();
    this.cardStack.init(this.profilesData);

    // initialize input controller
    this.inputController = new InputController(this);

    // initialize animation overlay
    this.animationOverlay = new AnimationOverlay(this);

    // listen to input events
    this.inputController.on("onSwipeMove", this.handleSwipeMove, this);
    this.inputController.on("onSwipeEnd", this.handleSwipeEnd, this);

    // listen to card events
    this.cardStack.on("onCardReady", this.handleCardReady, this);
    this.cardStack.on("onCardDestroyed", this.handleCardDestroyed, this);
    this.cardStack.on("onStackEmpty", this.handleStackEmpty, this);

    console.log("SwipeDeckScene ready");
  }

  // center of screen where cards sit
  getCardCenterX() {
    return this.cameras.main.width / 2;
  }

  getCardCenterY() {
    return this.cameras.main.height / 2;
  }

  // card is ready to be displayed
  handleCardReady(profile) {
    console.log(`showing card: ${profile.name}`);

    // create top card
    this.currentCard = SwipeCard.create(
      this,
      profile,
      this.getCardCenterX(),
      this.getCardCenterY(),
      20
    );

    if (this.currentCard) {
      this.cardStack.registerCardInstance(profile.id, this.currentCard);
    }

    // create peek card (next in queue) if it exists
    const nextProfile = this.cardStack.getPeekCard();
    if (nextProfile && !this.peekCard) {
      this.peekCard = SwipeCard.create(
        this,
        nextProfile,
        this.getCardCenterX(),
        this.getCardCenterY() + 20, // slightly offset
        10
      );
      if (this.peekCard) {
        this.cardStack.registerCardInstance(nextProfile.id, this.peekCard);
      }
    }
  }

  // while dragging the card
  handleSwipeMove(swipeData) {
    if (!this.currentCard) return;

    // update current card position and rotation
    this.currentCard.updateFromDrag(swipeData);
  }

  // released the swipe - determine what happened
  handleSwipeEnd(swipeData) {
    if (!this.currentCard) return;

    const { direction } = swipeData;
    const cardCenter = {
      x: this.currentCard.x,
      y: this.currentCard.y,
    };

    if (direction === "slash") {
      console.log("slash!");
      this.inputController.setInputBlocked(true);

      // throw card and play effect at the same time
      this.currentCard.throw("slash");
      this.animationOverlay.playSlashEffect(cardCenter.x, cardCenter.y, () => {
        // after effect completes, destroy the card
        this.cardStack.destroyCard("slash");
        this.inputController.setInputBlocked(false);
      });
    } else if (direction === "hack") {
      console.log("hack!");
      this.inputController.setInputBlocked(true);

      // throw card and play effect at the same time
      this.currentCard.throw("hack");
      this.animationOverlay.playHackEffect(cardCenter.x, cardCenter.y, () => {
        // after effect completes, destroy the card
        this.cardStack.destroyCard("hack");
        this.inputController.setInputBlocked(false);
      });
    } else {
      console.log("snap back");
      this.currentCard.snapBack();
    }
  }

  // card was removed from stack
  handleCardDestroyed(profile, reason) {
    console.log(`destroyed: ${profile.id} (${reason})`);

    // move peek to current
    if (this.peekCard) {
      this.currentCard = this.peekCard;
      this.peekCard = null;
    } else {
      this.currentCard = null;
    }
  }

  // no more cards
  handleStackEmpty() {
    console.log("game over - all cards swiped!");
    // TODO: show game over screen
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
    touch: {
      capture: true,
    },
  },
  scene: [SwipeDeckScene],
};

window.addEventListener(
  "load",
  () => {
    window.swipePrototypeGame = new Phaser.Game(gameConfig);
  },
  { once: true }
);