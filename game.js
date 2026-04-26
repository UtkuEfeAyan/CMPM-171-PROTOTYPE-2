import { TitleScreenScene } from "./src/scenes/TitleScreen.js";
import { SwipeDeckScene } from "./src/scenes/SwipeDeckScene.js";

const { Phaser } = window;

// global game boot settings live here so scene files stay focused on gameplay
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
  scene: [TitleScreenScene, SwipeDeckScene],
};

if (!Phaser) {
  throw new Error("Phaser failed to load. Ensure lib/phaser.js is available.");
}

// create game only after document load so mount node always exists
window.addEventListener(
  "load",
  () => {
    window.swipePrototypeGame = new Phaser.Game(gameConfig);
  },
  { once: true }
);