import { SwipeCard } from "../objects/SwipeCard.js";
import { InputController } from "../systems/InputController.js";
import { AnimationOverlay } from "../systems/AnimationOverlay.js";
import { ProfileLoader } from "../systems/ProfileLoader.js";
import { SwipeFlowController } from "../systems/SwipeFlowController.js";
import { CARD_CONFIG, LAYOUT_CONFIG, SWIPE_DIRECTIONS, SWIPE_EVENTS } from "../constants/swipeConfig.js";

export class SwipeDeckScene extends Phaser.Scene {
  // setup scene-level references used across card lifecycle
  constructor() {
    super({ key: "SwipeDeck" });
    this.inputController = null;
    this.animationOverlay = null;
    this.profileLoader = null;
    this.flowController = null;
    this.profiles = [];
    this.currentIndex = 0;
    this.activeCard = null;
    this.pendingCard = null;
    this.bufferCard = null;
    this.layout = null;
    this.isCardGrabbed = false;
  }

  // preload profile json and first card texture
  preload() {
    // loader is a small helper so scene stays focused on gameplay flow
    this.profileLoader = new ProfileLoader(this);
    this.profileLoader.preloadProfiles();
  }

  // create systems, events, and initial stack
  create() {
    // fail fast if profile data is empty or invalid
    this.profiles = this.profileLoader.getProfilesFromCache();
    if (!this.profiles.length) return;
    this.setupSystems();
    this.setupEvents();
    this.layout = this.computeCardLayout();
    this.buildInitialStack();
    this.profileLoader.loadRemainingProfiles(this.profiles);
  }

  // wire up independent systems used by this scene
  setupSystems() {
    this.inputController = new InputController(this);
    this.animationOverlay = new AnimationOverlay(this);
    this.flowController = new SwipeFlowController(this, this.animationOverlay);
  }

  // subscribe to stack and input events
  setupEvents() {
    // input sends drag deltas so top card follows pointer movement
    this.inputController.on(SWIPE_EVENTS.MOVE, ({ dragX, dragY }) => this.moveActiveCard(dragX, dragY));
    this.inputController.on(SWIPE_EVENTS.DRAG_START, () => this.handleDragStart());
    this.inputController.on(SWIPE_EVENTS.DRAG_END, () => this.handleDragEnd());
    // input also sends final swipe direction when gesture ends
    this.inputController.on(SWIPE_EVENTS.END, ({ direction }) => this.handleSwipe(direction));
    this.scale.on("resize", () => this.handleResize());
  }

  // frame loop: apply smooth drag motion while card is grabbed
  update() {
    if (!this.activeCard || !this.isCardGrabbed) return;
    this.activeCard.stepTowardsTarget();
  }

  // compute card bounds from camera size and manual phone insets
  computeCardLayout() {
    const camera = this.cameras.main;
    const insets = LAYOUT_CONFIG.frameInsets;
    const innerWidth = (camera.width - insets.left - insets.right) * LAYOUT_CONFIG.frameFitScale;
    const innerHeight = (camera.height - insets.top - insets.bottom) * LAYOUT_CONFIG.frameFitScale;
    const cardHeight = innerHeight;
    const cardWidth = Math.min(innerWidth, cardHeight * LAYOUT_CONFIG.cardMaxAspect);
    return {
      centerX: camera.width / 2,
      centerY: camera.height / 2,
      cardWidth,
      cardHeight,
      imageHeight: cardHeight * LAYOUT_CONFIG.imageRatio,
      textHeight: cardHeight * LAYOUT_CONFIG.textRatio,
    };
  }

  // prepare initial active, pending, and buffer slots
  async buildInitialStack() {
    this.activeCard = await this.createSlotCard(this.currentIndex, "active");
    this.pendingCard = await this.createSlotCard(this.currentIndex + 1, "pending");
    this.bufferCard = await this.createSlotCard(this.currentIndex + 2, "buffer");
  }

  // create a card only after its texture is guaranteed ready
  async createSlotCard(profileIndex, slotType, shouldDrop = false) {
    const profile = this.profiles[profileIndex];
    if (!profile) return null;
    await this.profileLoader.ensureTextureReady(profile);
    const y = shouldDrop ? LAYOUT_CONFIG.bufferStartY : this.getSlotY(slotType);
    const card = SwipeCard.create(this, profile, this.layout.centerX, y, this.layout);
    if (slotType === "active") return this.styleActiveCard(card);
    if (slotType === "pending") return this.stylePendingCard(card);
    return this.styleBufferCard(card, shouldDrop);
  }

  // set active card visuals and interaction pose
  styleActiveCard(card) {
    card.setTopCardStyle();
    card.x = this.layout.centerX;
    card.y = this.getSlotY("active");
    return card;
  }

  // set pending card visuals behind active card
  stylePendingCard(card) {
    card.setBackCardStyle();
    card.setDepth(CARD_CONFIG.depthBack);
    card.setScale(CARD_CONFIG.backScale);
    card.x = this.layout.centerX;
    card.y = this.getSlotY("pending");
    return card;
  }

  // set buffer card visuals and optional top drop-in tween
  styleBufferCard(card, shouldDrop) {
    card.setBackCardStyle();
    card.setDepth(CARD_CONFIG.depthBuffer);
    card.setScale(CARD_CONFIG.bufferScale);
    card.x = this.layout.centerX;
    const targetY = this.getSlotY("buffer");
    if (!shouldDrop) {
      card.y = targetY;
      return card;
    }
    this.tweens.add({
      targets: card,
      y: targetY,
      duration: LAYOUT_CONFIG.bufferDropTweenMs,
      ease: "Back.easeOut",
    });
    return card;
  }

  // return y position for each stack slot
  getSlotY(slotType) {
    if (slotType === "active") return this.layout.centerY;
    if (slotType === "pending") return this.layout.centerY + LAYOUT_CONFIG.pendingOffsetY;
    return this.layout.centerY + LAYOUT_CONFIG.bufferOffsetY;
  }

  // forward drag target values into active card state
  moveActiveCard(dragX, dragY) {
    if (!this.activeCard) return;
    this.activeCard.setDragTarget(dragX, dragY);
  }

  // apply visual grabbed state at drag start
  handleDragStart() {
    if (!this.activeCard) return;
    this.isCardGrabbed = true;
    this.activeCard.setGrabState(true);
  }

  // remove visual grabbed state when pointer releases
  handleDragEnd() {
    if (!this.activeCard) return;
    this.isCardGrabbed = false;
    this.activeCard.setGrabState(false);
  }

  // resolve final swipe direction into throw/snap behavior
  handleSwipe(direction) {
    if (!this.activeCard) return;
    this.isCardGrabbed = false;
    this.activeCard.setGrabState(false);
    // block new input until tween/effect chain completes
    this.inputController.setEnabled(false);
    this.flowController.resolveSwipe(
      direction,
      this.activeCard,
      () => this.handleSnapBackComplete(),
      () => this.completeSwipe(direction)
    );
  }

  // after snapback, reset targets and re-enable input
  handleSnapBackComplete() {
    if (!this.activeCard) return;
    this.activeCard.resetDragTarget();
    this.inputController.setEnabled(true);
  }

  // route completed swipe to slash or hack path
  completeSwipe(direction) {
    if (!this.activeCard) return;
    const isCardSlashed = direction === SWIPE_DIRECTIONS.SLASH;
    if (isCardSlashed) return this.finishSlash();
    this.finishHack();
  }

  // slash path plays split animation before stack advance
  finishSlash() {
    this.activeCard.playCutToPieces(() => this.advanceStack());
  }

  // hack path triggers handoff event then advances stack
  finishHack() {
    const activeProfile = this.activeCard.profile;
    this.routeToHackPath(activeProfile);
    this.advanceStack();
  }

  // emit route event so external minigame flow can listen
  routeToHackPath(profile) {
    // this is the handoff point for the separate hack minigame scene
    const targetSceneKey = profile?.targetSceneKey || "hack-minigame";
    window.dispatchEvent(new CustomEvent("hack-route", { detail: { targetSceneKey, profile } }));
  }

  // destroy old card and ask stack for next profile
  advanceStack() {
    this.activeCard.destroy();
    this.activeCard = null;
    this.isCardGrabbed = false;
    this.currentIndex += 1;
    this.promoteCardStack();
    this.spawnBufferCard();
    this.inputController.setEnabled(true);
  }

  // promote pending->active and buffer->pending after a swipe
  promoteCardStack() {
    this.activeCard = this.pendingCard;
    this.pendingCard = this.bufferCard;
    this.bufferCard = null;
    if (this.activeCard) {
      this.styleActiveCard(this.activeCard);
    }
    if (this.pendingCard) {
      this.stylePendingCard(this.pendingCard);
    }
  }

  // create the next buffer card and drop it from top of screen
  async spawnBufferCard() {
    this.bufferCard = await this.createSlotCard(this.currentIndex + 2, "buffer", true);
  }

  // recompute bounds on resize and apply to current cards
  handleResize() {
    this.layout = this.computeCardLayout();
    if (this.activeCard) {
      this.activeCard.centerX = this.layout.centerX;
      this.activeCard.centerY = this.layout.centerY;
      this.activeCard.applyLayout(this.layout);
      this.styleActiveCard(this.activeCard);
    }
    if (this.pendingCard) {
      this.pendingCard.centerX = this.layout.centerX;
      this.pendingCard.centerY = this.layout.centerY;
      this.pendingCard.applyLayout(this.layout);
      this.stylePendingCard(this.pendingCard);
    }
    if (this.bufferCard) {
      this.bufferCard.centerX = this.layout.centerX;
      this.bufferCard.centerY = this.layout.centerY;
      this.bufferCard.applyLayout(this.layout);
      this.styleBufferCard(this.bufferCard, false);
    }
  }
}
