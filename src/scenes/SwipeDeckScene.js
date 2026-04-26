import { ProfileCard } from "../objects/ProfileCard.js";
import { SwipeLogic } from "../systems/InputManager.js";
import { SwipeEffects } from "../systems/SwipeEffects.js";
import { ProfileLoader } from "../systems/ProfileLoader.js";
import { GameState } from "../systems/GameState.js";
import { CARD_CONFIG, LAYOUT_CONFIG, LOADER_CONFIG, SCENE_CONFIG } from "../constants/swipeConfig.js";

// orchestrator scene. every piece of real gameplay logic lives in other
// modules - this scene just wires them together and owns deck pointers.
//
// flow:
//   preload  -> ProfileLoader.preloadJson
//   create   -> read profiles, compute bounds, kick off progressive load
//   (ready)  -> build active+pending stack, create effects/logic, bind input
//   commit   -> SwipeLogic.executeCommit -> scene.promote -> next card
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
  }

  // preload: json only. images are queued later by ProfileLoader once we
  // know which ones are valid.
  preload() {
    ProfileLoader.preloadJson(this);
  }

  // create: read profiles, start progressive load, wire resize/shutdown.
  // when the initial batch finishes, startGameplay builds the stack.
  create() {
    this.profiles = ProfileLoader.getValidProfiles(this);
    if (!this.profiles.length) return;

    this.bounds = this.computeBounds();
    this.bindSceneLifecycle();
    this.beginProgressiveLoad();
  }

  // subscribe to the scene-level events we care about.
  // kept in one method so cleanup() can mirror every binding exactly.
  bindSceneLifecycle() {
    this.resizeHandler = () => this.handleResize();
    this.scale.on("resize", this.resizeHandler);
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

  // compute card size from the camera using percentages (Pillar 9).
  // responsive: works on phone portrait, desktop landscape, and vertical
  // monitor without editing a single pixel value.
  //
  // width  = camera.width  * cardWidthPct  (clamped by min/max)
  // height = min(camera.height * cardHeightPct, width * aspectTall)
  computeBounds() {
    const camera = this.cameras.main;
    const uncappedWidth = camera.width * LAYOUT_CONFIG.cardWidthPct;
    const width = Phaser.Math.Clamp(uncappedWidth, LAYOUT_CONFIG.cardMinWidth, LAYOUT_CONFIG.cardMaxWidth);
    const maxHeightByScreen = camera.height * LAYOUT_CONFIG.cardHeightPct;
    const maxHeightByAspect = width * LAYOUT_CONFIG.cardAspectTall;
    const height = Math.min(maxHeightByScreen, maxHeightByAspect);
    return {
      width,
      height,
      centerX: camera.width / 2,
      centerY: camera.height / 2,
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
  // we intentionally do NOT gate on texture readiness here: ProfileCard.buildImage
  // already falls back to a colored rectangle when the texture is missing, so
  // creating the card anyway keeps deck length stable and lets the background
  // loader swap the real texture in on its own later.
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
        promote: () => this.promote(),
        onHackCommit: (profileId) => this.onHackCommit(profileId),
        onHackComplete: (profile) => this.launchHackMinigame(profile),
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
    if (this.activeCard) this.activeCard.destroy();
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

  // hack-commit hook. writes id into global GameState and fires a
  // window CustomEvent so other scenes/UI can subscribe without importing.
  onHackCommit(profileId) {
    GameState.recordHack(profileId);
    window.dispatchEvent(
      new CustomEvent("hack-commit", {
        detail: { profileId, hackedIds: GameState.getHackedIDs() },
      })
    );
  }

  // =====================================================================
  // MINIGAME REDIRECT HOOK - EDIT THIS METHOD
  // =====================================================================
  // fires once after a successful hack swipe. by the time we get here:
  //   - the hack tween (card thrown off-screen) has finished
  //   - the binary-rain overlay has finished
  //   - the next card has already dropped into place
  //   - input is unlocked again (SwipeLogic state is back to IDLE)
  //
  // `profile` is the FULL profile object from profiles.json for the card
  // that was just hacked, shaped like:
  //   { id, name, text, imagePath }
  //
  // to redirect the player to your minigame scene:
  //   1. add your scene class to the scene list in game.js
  //   2. uncomment / write the scene.start call below
  //
  // example:
  //   this.scene.start("YourMinigameKey", { profile });
  //
  // leave this method empty to stay on the swipe deck (default behavior).
  // =====================================================================
  launchHackMinigame(profile) {
    // intentionally empty - fill in with your redirect / minigame launch.
  }

  // reflow every live card for a new viewport.
  // skips if computed bounds are degenerate (eg. zero-size window during
  // transition) so applyLayout never receives nonsense numbers.
  handleResize() {
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
  }
}
