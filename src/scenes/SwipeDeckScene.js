import { ProfileCard } from "../objects/ProfileCard.js";
import { SwipeLogic } from "../systems/InputManager.js";
import { SwipeEffects } from "../systems/SwipeEffects.js";
import { ProfileLoader } from "../systems/ProfileLoader.js";
import { PersistenceManager } from "../systems/PersistenceManager.js";
import { GameState } from "../systems/GameState.js";
import { BACKGROUND_CONFIG, CARD_CONFIG, LAYOUT_CONFIG, LOADER_CONFIG, SCENE_CONFIG } from "../constants/swipeConfig.js";
import { StalkingScene } from "./StalkingScene.js";
// orchestrator scene. every piece of real gameplay logic lives in other
// modules - this scene just wires them together and owns deck pointers.
//
// flow:
//   preload  -> ProfileLoader.preloadJson
//   create   -> paint background, read profiles, compute bounds, kick off progressive load
//   (ready)  -> build active+pending stack, create effects/logic, bind input
//   commit   -> SwipeLogic.executeCommit -> scene.promote -> next card
//   hack     -> onHackCommit stores id, onHackAnimationComplete pauses scene
//               and launches ProfileDetailScene; SwipeDeckScene resumes on exit.
//   resize   -> ProfileCard.applyLayout on every live card
//   shutdown -> cleanup() detaches every listener we created
export class SwipeDeckScene extends Phaser.Scene {
  constructor() {
    super({ key: "SwipeDeck" });
    this.profiles = []; // full deck loaded from profiles.json
    this.currentIndex = 0; // data pointer for the active card
    this.activeCard = null; // top card (user drags this one)
    this.pendingCard = null; // next card (already on screen, behind active)
    this.bounds = null; // current card size + screen center (rebuilt on resize)
    this.logic = null; // SwipeLogic instance created after stack is ready
    this.effects = null; // SwipeEffects dispatcher for overlay visuals
    this.isGameplayStarted = false; // guard so startGameplay only runs once
    this.resizeHandler = null; // saved so we can cleanly detach on shutdown
    this.pointerDownHandler = null; // same story for pointer/keyboard handlers
    this.pointerMoveHandler = null;
    this.pointerUpHandler = null;
    this.keyDownHandler = null;
    this.backgroundImage = null; // phone bg behind cards (fit, never stretched)
    this.backgroundDisplayWidth = 0; // displayed bg width after fit-scaling
    this.backgroundDisplayHeight = 0; // displayed bg height after fit-scaling
    this.collectionBtn = null; // top-left button that opens the StorageScene
  }

  // preload: profiles json + the shared phone background. profile images are
  // queued later by ProfileLoader once we know which ones are valid.
  preload() {
    ProfileLoader.preloadJson(this);
    if (!this.textures.exists(BACKGROUND_CONFIG.phoneTextureKey)) {
      this.load.image(BACKGROUND_CONFIG.phoneTextureKey, BACKGROUND_CONFIG.phoneImagePath);
    }
  }

  // create: paint background, read profiles, start progressive load, wire
  // resize/shutdown. when the initial batch finishes, startGameplay builds
  // the stack and the collection button is wired up.
  create() {
    this.setupBackground();
    this.setupCollectionButton();

    this.profiles = ProfileLoader.getValidProfiles(this);
    if (!this.profiles.length) return;

    this.bounds = this.computeBounds();
    this.bindSceneLifecycle();
    this.beginProgressiveLoad();
    this.stalkKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E);
    this.input.keyboard.on("keydown-E", () => {
      this.scene.start("stalkingScene");
    });
  }

  // phone background, sits behind every gameplay element.
  // never stretched - we fit-scale it (Math.min) so the phone frame keeps
  // its native aspect ratio and we letterbox any extra camera space.
  setupBackground() {
    if (!this.textures.exists(BACKGROUND_CONFIG.phoneTextureKey)) return;
    const camera = this.cameras.main;
    this.backgroundImage = this.add
      .image(camera.width / 2, camera.height / 2, BACKGROUND_CONFIG.phoneTextureKey)
      .setDepth(BACKGROUND_CONFIG.depth);
    this.fitBackground();
  }

  // recompute bg scale + position for the current camera size.
  // also caches the displayed bg dimensions so computeBounds can size the
  // card relative to the visible phone frame (not the raw camera).
  fitBackground() {
    if (!this.backgroundImage) return;
    const camera = this.cameras.main;
    const source = this.backgroundImage.texture.getSourceImage();
    const baseWidth = source.width;
    const baseHeight = source.height;
    if (baseWidth <= 0 || baseHeight <= 0) return;
    const scale = Math.min(camera.width / baseWidth, camera.height / baseHeight);
    this.backgroundImage.setScale(scale);
    this.backgroundImage.setPosition(camera.width / 2, camera.height / 2);
    this.backgroundDisplayWidth = baseWidth * scale;
    this.backgroundDisplayHeight = baseHeight * scale;
  }

  // top-left "Collection" button that opens the StorageScene.
  // sits outside the phone frame so it can't overlap a swipe.
  setupCollectionButton() {
    this.collectionBtn = this.add
      .text(20, 20, "Collection", {
        fontSize: "18px",
        color: "#ffffff",
        backgroundColor: "#222a",
        padding: { x: 12, y: 8 },
      })
      .setDepth(100)
      .setInteractive({ useHandCursor: true });
    // sleep+launch instead of start: keeps this deck frozen in memory so
    // currentIndex / animation state / inputs all survive the round-trip
    // through the storage screen.
    this.collectionBtn.on("pointerup", () => {
      this.scene.sleep("SwipeDeck");
      this.scene.launch("Storage");
    });
  }

  // subscribe to the scene-level events we care about.
  // kept in one method so cleanup() can mirror every binding exactly.
  // wake refreshes layout in case the window was resized while we were
  // sleeping behind the storage scene.
  bindSceneLifecycle() {
    this.resizeHandler = () => this.handleResize();
    this.scale.on("resize", this.resizeHandler);
    this.events.on("wake", () => this.handleResize());
    this.events.once("shutdown", () => this.cleanup());
    this.events.once("destroy", () => this.cleanup());
  }

  // start the two-stage progressive load (Pillar 8).
  // stage 1: foreground batch of the first initialBatchSize profiles.
  // stage 2: idle-time background load of the rest.
  //
  // stage 1 must complete before startGameplay so the stack never renders
  // with a missing texture. stage 2 is fire-and-forget.
  async beginProgressiveLoad() {
    await ProfileLoader.loadBatch(this, this.profiles, 0, LOADER_CONFIG.initialBatchSize);
    ProfileLoader.loadInBackground(this, this.profiles, LOADER_CONFIG.initialBatchSize);
    this.startGameplay();
  }

  // build the stack and wire input. guarded by isGameplayStarted so a
  // second load-complete (from stage 2) can never rebuild the stack.
  startGameplay() {
    if (this.isGameplayStarted) return;
    this.isGameplayStarted = true;
    this.setupStack();
    this.effects = new SwipeEffects(this);
    this.setupLogic();
    this.setupInput();
  }

  // compute card size relative to the displayed phone background.
  // when the bg has been fit-scaled we size the card off of THAT (not the
  // raw camera), so the card always lives inside the phone frame's screen
  // area regardless of window size. fallback to camera dims if no bg yet.
  //
  // width  = baseWidth  * cardWidthPct  (clamped by min/max)
  // height = min(baseHeight * cardHeightPct, width * aspectTall)
  // centerY is shifted so the card sits centered on the phone SCREEN, not
  // the bg art's geometric center (the home button strip pulls it down).
  computeBounds() {
    const camera = this.cameras.main;
    const baseWidth = this.backgroundDisplayWidth > 0 ? this.backgroundDisplayWidth : camera.width;
    const baseHeight = this.backgroundDisplayHeight > 0 ? this.backgroundDisplayHeight : camera.height;
    const uncappedWidth = baseWidth * LAYOUT_CONFIG.cardWidthPct;
    const width = Phaser.Math.Clamp(uncappedWidth, LAYOUT_CONFIG.cardMinWidth, LAYOUT_CONFIG.cardMaxWidth);
    const maxHeightByScreen = baseHeight * LAYOUT_CONFIG.cardHeightPct;
    const maxHeightByAspect = width * LAYOUT_CONFIG.cardAspectTall;
    const height = Math.min(maxHeightByScreen, maxHeightByAspect);
    const centerYOffset = baseHeight * BACKGROUND_CONFIG.innerScreenCenterYOffsetPct;
    return {
      width,
      height,
      centerX: camera.width / 2,
      centerY: camera.height / 2 + centerYOffset,
    };
  }

  // build the initial active + pending stack.
  // both cards are made up front, so the first swipe has a pre-loaded
  // pending card waiting behind (Pillar "Double-Buffered Stack").
  setupStack() {
    this.currentIndex = 0;
    this.activeCard = this.createCard(0);
    this.pendingCard = this.createCard(1);
    this.styleActive(this.activeCard);
    this.stylePending(this.pendingCard);
  }

  // create one ProfileCard, or null only if the index is past the end of the deck.
  createCard(profileIndex) {
    if (profileIndex >= this.profiles.length) return null;
    const profile = this.profiles[profileIndex];
    return new ProfileCard(this, this.bounds.centerX, this.bounds.centerY, profile, this.bounds);
  }

  // mark a card as the foreground/active card.
  styleActive(card) {
    if (!card) return;
    card.setDepth(CARD_CONFIG.depthActive);
    card.setScale(CARD_CONFIG.releaseScale);
    card.setPosition(this.bounds.centerX, this.bounds.centerY);
    card.centerX = this.bounds.centerX;
    card.centerY = this.bounds.centerY;
    card.alpha = 1;
    card.angle = 0;
  }

  // mark a card as the background/pending card.
  stylePending(card) {
    if (!card) return;
    card.setDepth(CARD_CONFIG.depthPending);
    card.setScale(CARD_CONFIG.pendingScale);
    card.setPosition(this.bounds.centerX, this.bounds.centerY + LAYOUT_CONFIG.pendingOffsetY);
    card.centerX = this.bounds.centerX;
    card.centerY = this.bounds.centerY;
    card.alpha = 1;
    card.angle = 0;
  }

  // build the SwipeLogic state machine with a small stack adapter.
  // the adapter only exposes what logic needs (nothing more).
  setupLogic() {
    this.logic = new SwipeLogic(
      this,
      {
        getActive: () => this.activeCard,
        promote: async () => {
          await this.promote();
          // after promotion, if both slots are now empty the deck is done
          if (!this.activeCard && !this.pendingCard) {
            this.onDeckExhausted();
          }
        },
        // onHackCommit: store id in both PersistenceManager (for StorageScene)
        // and GameState (for ProfileDetailScene fallback).
        onHackCommit: (profileId, profile) => this.onHackCommit(profileId, profile),
        // onHackAnimationComplete: fires after binary rain, before promote().
        // pauses SwipeDeck and launches ProfileDetailScene as an overlay.
        onHackAnimationComplete: (profile) => this.onHackAnimationComplete(profile),
      },
      {
        threshold: SCENE_CONFIG.swipeThreshold,
        effects: this.effects,
      }
    );
  }

  // bind pointer + keyboard inputs; store refs so cleanup can detach them.
  setupInput() {
    this.pointerDownHandler = (pointer) => this.logic.beginDrag(pointer);
    this.pointerMoveHandler = (pointer) => this.logic.handleMove(pointer);
    this.pointerUpHandler = () => this.logic.handleRelease();
    this.keyDownHandler = (event) => this.logic.handleKey(event);
    this.input.on("pointerdown", this.pointerDownHandler);
    this.input.on("pointermove", this.pointerMoveHandler);
    this.input.on("pointerup", this.pointerUpHandler);
    // only bind keyboard if phaser keyboard input is available (disabled in some configs)
    if (this.input.keyboard) {
      this.input.keyboard.on("keydown", this.keyDownHandler);
    }
  }

  // promotion sequence (no-pop guarantee):
  //   1. destroy old active (already animated off or cut)
  //   2. pending becomes active (already on screen + textured)
  //   3. create a fresh pending from the deck (if any remain)
  //   4. drop the new pending in from the top for visual continuity
  async promote() {
    if (this.activeCard) {
      this.activeCard.destroy();
      this.activeCard = null;
    }

    this.activeCard = this.pendingCard;
    this.currentIndex += 1;
    this.styleActive(this.activeCard);

    this.pendingCard = this.createCard(this.currentIndex + 1);
    if (!this.pendingCard) return;
    this.stylePending(this.pendingCard);
    await this.dropInPending(this.pendingCard);
  }

  // drop the new pending card from above its rest slot.
  dropInPending(card) {
    card.y = LAYOUT_CONFIG.pendingDropStartY;
    return new Promise((resolve) => {
      this.tweens.add({
        targets: card,
        y: this.bounds.centerY + LAYOUT_CONFIG.pendingOffsetY,
        duration: LAYOUT_CONFIG.pendingDropTweenMs,
        ease: "Back.easeOut",
        onComplete: resolve,
      });
    });
  }

  // hack-commit hook. writes id into PersistenceManager (for StorageScene)
  // and full profile into GameState (for ProfileDetailScene fallback).
  // fires a window CustomEvent for any external subscribers.
  onHackCommit(profileId, profile) {
    PersistenceManager.recordHack(profileId);
    GameState.recordHack(profileId);
    GameState.setLastHackedProfile(profile);
    window.dispatchEvent(
      new CustomEvent("hack-commit", {
        detail: { profileId, hackedIds: PersistenceManager.getHackedCardIDs() },
      })
    );
  }

  // called by SwipeLogic after both the throw animation AND the binary rain
  // have finished resolving. pauses SwipeDeck and launches ProfileDetailScene
  // on top as an overlay. resolve immediately so promote() runs while paused
  // (stack resets invisibly; user only sees SwipeDeck again after resuming).
  onHackAnimationComplete(profile) {
    this.scene.pause("SwipeDeck");
    this.scene.launch("ProfileDetail", { profile });
    return Promise.resolve();
  }

  // called when both activeCard and pendingCard are null after promotion.
  // the entire deck has been swiped — hand off to the gear puzzle minigame.
  onDeckExhausted() {
    this.scene.start("GearPuzzleScene");
  }

  // reflow every live card + background for a new viewport.
  // order matters: fit the bg FIRST so backgroundDisplayWidth/Height are
  // fresh, then computeBounds reads them when sizing the card.
  handleResize() {
    this.fitBackground();
    const next = this.computeBounds();
    if (next.width <= 0 || next.height <= 0) return;
    this.bounds = next;
    if (this.activeCard) {
      this.activeCard.applyLayout(this.bounds);
      this.styleActive(this.activeCard);
    }
    if (this.pendingCard) {
      this.pendingCard.applyLayout(this.bounds);
      this.stylePending(this.pendingCard);
    }
  }

  // detach every listener we subscribed to and null-out refs.
  // mirrors every on() call in bindSceneLifecycle + setupInput.
  cleanup() {
    if (this.resizeHandler) {
      this.scale.off("resize", this.resizeHandler);
      this.resizeHandler = null;
    }
    if (this.pointerDownHandler) this.input.off("pointerdown", this.pointerDownHandler);
    if (this.pointerMoveHandler) this.input.off("pointermove", this.pointerMoveHandler);
    if (this.pointerUpHandler) this.input.off("pointerup", this.pointerUpHandler);
    // only detach keyboard listener if both the handler and phaser keyboard input exist
    if (this.keyDownHandler && this.input.keyboard) {
      this.input.keyboard.off("keydown", this.keyDownHandler);
    }
    this.pointerDownHandler = null;
    this.pointerMoveHandler = null;
    this.pointerUpHandler = null;
    this.keyDownHandler = null;
    if (this.collectionBtn) {
      this.collectionBtn.removeAllListeners();
      this.collectionBtn = null;
    }
    this.backgroundImage = null;
  }
}