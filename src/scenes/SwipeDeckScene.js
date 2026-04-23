import { ProfileCard } from "../objects/ProfileCard.js";
import { SwipeLogic } from "../systems/InputManager.js";
import { SwipeEffects } from "../systems/SwipeEffects.js";
import { GameState } from "../systems/GameState.js";
import { CARD_CONFIG, LAYOUT_CONFIG, SCENE_CONFIG } from "../constants/swipeConfig.js";

// minimal scene: loads data, builds the active/pending stack, wires input.
// all gameplay math lives in SwipeLogic; all render pieces live in ProfileCard;
// all persistence lives in GameState. this scene only orchestrates.
export class SwipeDeckScene extends Phaser.Scene {
  constructor() {
    super({ key: "SwipeDeck" });
    this.profiles = []; // full deck loaded from profiles.json
    this.currentIndex = 0; // data pointer for the active card
    this.activeCard = null; // top card (user drags this one)
    this.pendingCard = null; // next card (already on screen, behind active)
    this.bounds = null; // current card size + screen center (rebuilt on resize)
    this.logic = null; // SwipeLogic instance created after stack is ready
    this.effects = null; // SwipeEffects owns slash blood + hack binary rain overlays
    this.resizeHandler = null; // saved so we can cleanly detach on shutdown
  }

  // preload profile metadata only.
  // images are queued in create() once we know their paths.
  preload() {
    this.load.json(SCENE_CONFIG.profileJsonKey, SCENE_CONFIG.profileJsonPath);
  }

  // create runs once the json is available. we then queue image loads
  // for every profile and wait for them before building the stack.
  // this guarantees no default texture flash on any card (no-pop).
  create() {
    this.profiles = this.readProfiles();
    if (!this.profiles.length) return;

    this.bounds = this.computeBounds();
    this.queueProfileImages();
    this.load.once("complete", () => this.startGameplay());
    this.load.start();

    // resize cleanup is wired early so we never leak listeners.
    this.resizeHandler = () => this.handleResize();
    this.scale.on("resize", this.resizeHandler);
    this.events.once("shutdown", () => this.cleanup());
    this.events.once("destroy", () => this.cleanup());
  }

  // read and sanity-check profiles from cache.
  // filters out any entry missing the fields a card needs to render.
  readProfiles() {
    const data = this.cache.json.get(SCENE_CONFIG.profileJsonKey);
    const raw = data?.profiles ?? [];
    return raw.filter((p) => p?.id != null && p?.name && p?.imagePath);
  }

  // queue every profile image under a stable texture key.
  // skips entries that are already cached so repeats are cheap.
  queueProfileImages() {
    this.profiles.forEach((profile) => {
      const textureKey = `profile_${profile.id}`;
      if (this.textures.exists(textureKey)) return;
      this.load.image(textureKey, profile.imagePath);
    });
  }

  // once every texture is ready, build the stack and wire inputs.
  // order matters: stack first (so logic has something to get), then inputs.
  startGameplay() {
    this.setupStack();
    this.effects = new SwipeEffects(this); // prepare slash/hack overlay instance
    this.setupLogic();
    this.setupInput();
  }

  // compute the card box and screen center from the current camera size.
  // uses frameInsets as a manual "phone frame" so the card touches top+bottom.
  computeBounds() {
    const camera = this.cameras.main;
    const insets = LAYOUT_CONFIG.frameInsets;
    const innerWidth = camera.width - insets.left - insets.right;
    const innerHeight = camera.height - insets.top - insets.bottom;
    const height = innerHeight;
    const width = Math.min(innerWidth, height * LAYOUT_CONFIG.cardMaxAspect);
    return {
      width,
      height,
      centerX: camera.width / 2,
      centerY: camera.height / 2,
    };
  }

  // build the initial two-card stack: active on top, pending behind.
  // having pending pre-created is the no-pop guarantee: when the active
  // card leaves, pending is already visible and textured.
  setupStack() {
    this.currentIndex = 0;
    this.activeCard = this.createCard(0);
    this.pendingCard = this.createCard(1);
    this.styleActive(this.activeCard);
    this.stylePending(this.pendingCard);
  }

  // create one card for the given profile index, or null if index is past deck.
  // centered inside bounds; final depth/scale are assigned by style* helpers.
  createCard(profileIndex) {
    if (profileIndex >= this.profiles.length) return null;
    const profile = this.profiles[profileIndex];
    return new ProfileCard(this, this.bounds.centerX, this.bounds.centerY, profile, this.bounds);
  }

  // mark a card as the active/front card.
  // only the active card is draggable and readable by SwipeLogic.
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

  // mark a card as the pending/back card.
  // smaller scale + lower depth so the active card clearly sits on top.
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

  // build the SwipeLogic state machine and hand it the stack adapter.
  // the adapter exposes only the three hooks logic needs: get, promote, commit.
  setupLogic() {
    this.logic = new SwipeLogic(
      this,
      {
        getActive: () => this.activeCard,
        promote: () => this.promote(),
        onHackCommit: (profileId) => this.onHackCommit(profileId),
      },
      {
        threshold: SCENE_CONFIG.swipeThreshold,
        effects: this.effects, // logic plays overlays through this handle
      }
    );
  }

  // wire pointer + keyboard events to SwipeLogic methods.
  // scene listens once; all state lives inside logic.
  setupInput() {
    this.input.on("pointerdown", (pointer) => this.logic.beginDrag(pointer));
    this.input.on("pointermove", (pointer) => this.logic.handleMove(pointer));
    this.input.on("pointerup", () => this.logic.handleRelease());
    this.input.keyboard?.on("keydown", (event) => this.logic.handleKey(event));
  }

  // core no-pop promotion sequence.
  // 1. destroy old active (it has already animated off or cut apart)
  // 2. promote pending -> active (it's already textured and on screen)
  // 3. create a fresh pending if profiles remain
  // 4. drop the new pending from above for visual continuity
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

  // drop the new pending card from above the screen to its rest slot.
  // input: card to tween. output: promise that resolves when drop finishes.
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

  /**
   * hook for hack commit: writes the id to the global GameState.
   * input: profileId that was just hacked.
   * also fires a window CustomEvent so future scenes/ui can react
   * without importing GameState directly.
   */
  onHackCommit(profileId) {
    GameState.recordHack(profileId);
    window.dispatchEvent(
      new CustomEvent("hack-commit", {
        detail: { profileId, hackedIds: GameState.getHackedIDs() },
      })
    );
  }

  // recompute bounds on window resize and reflow every card.
  // cards remain the same instances; their inner visuals (image size,
  // panel size, text wrap width) are rebuilt via ProfileCard.applyLayout so
  // nothing stretches or misaligns after the window changes size.
  handleResize() {
    this.bounds = this.computeBounds();
    if (this.activeCard) {
      this.activeCard.applyLayout(this.bounds);
      this.styleActive(this.activeCard);
    }
    if (this.pendingCard) {
      this.pendingCard.applyLayout(this.bounds);
      this.stylePending(this.pendingCard);
    }
  }

  // detach anything we subscribed to on the scale manager.
  // phaser owns input/keyboard listeners per-scene and clears them itself.
  cleanup() {
    if (this.resizeHandler) {
      this.scale.off("resize", this.resizeHandler);
      this.resizeHandler = null;
    }
  }
}
