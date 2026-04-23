import { InputController } from "../systems/InputController.js";
import { AnimationOverlay } from "../systems/AnimationOverlay.js";
import { ProfileLoader } from "../systems/ProfileLoader.js";
import { SwipeFlowController } from "../systems/SwipeFlowController.js";
import { CardStackManager } from "../systems/CardStackManager.js";
import { PersistenceManager } from "../systems/PersistenceManager.js";
import { LAYOUT_CONFIG, SWIPE_DIRECTIONS, SWIPE_EVENTS } from "../constants/swipeConfig.js";

export class SwipeDeckScene extends Phaser.Scene {
  // setup scene-level references used across card lifecycle
  constructor() {
    super({ key: "SwipeDeck" });
    this.inputController = null;
    this.animationOverlay = null;
    this.profileLoader = null;
    this.flowController = null;
    this.stackManager = null;
    this.profiles = [];
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
    this.layout = this.computeCardLayout(); // snapshot layout for current viewport size
    this.setupStackManager(); // inject scene services into stack lifecycle manager
    this.initializeStack(); // async create active + pending + buffer cards
    this.profileLoader.loadRemainingProfiles(this.profiles);
  }

  // wire up independent systems used by this scene
  setupSystems() {
    this.inputController = new InputController(this);
    this.animationOverlay = new AnimationOverlay(this);
    this.flowController = new SwipeFlowController(this, this.animationOverlay);
  }

  /**
   * create stack manager with shared dependencies and layout getter.
   * inputs are scene services and current profile list.
   * this keeps slot lifecycle logic outside scene methods.
   */
  setupStackManager() {
    this.stackManager = new CardStackManager(this, this.profileLoader, this.profiles, () => this.layout);
  }

  /**
   * initialize active/pending/buffer slots asynchronously.
   * input is none and output is prepared look-ahead stack.
   * this guarantees first frame has ready card textures.
   */
  async initializeStack() {
    await this.stackManager.initialize();
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
    if (!this.isCardGrabbed) return;
    this.stackManager.stepActiveCard();
  }

  // compute card bounds from camera size and manual phone insets
  computeCardLayout() {
    const camera = this.cameras.main;
    const insets = LAYOUT_CONFIG.frameInsets; // manual phone-frame content padding
    const innerWidth = (camera.width - insets.left - insets.right) * LAYOUT_CONFIG.frameFitScale; // usable width inside frame
    const innerHeight = (camera.height - insets.top - insets.bottom) * LAYOUT_CONFIG.frameFitScale; // usable height inside frame
    const cardHeight = innerHeight; // card touches top and bottom of usable frame area
    const cardWidth = Math.min(innerWidth, cardHeight * LAYOUT_CONFIG.cardMaxAspect); // width clamped by frame width and aspect target
    return {
      centerX: camera.width / 2,
      centerY: camera.height / 2,
      cardWidth,
      cardHeight,
      imageHeight: cardHeight * LAYOUT_CONFIG.imageRatio,
      textHeight: cardHeight * LAYOUT_CONFIG.textRatio,
    };
  }

  // forward drag target values into active card state
  moveActiveCard(dragX, dragY) {
    this.stackManager.setActiveDragTarget(dragX, dragY);
  }

  // apply visual grabbed state at drag start
  handleDragStart() {
    if (!this.stackManager.getActiveCard()) return;
    this.isCardGrabbed = true;
    this.stackManager.setActiveGrabbed(true);
  }

  // remove visual grabbed state when pointer releases
  handleDragEnd() {
    if (!this.stackManager.getActiveCard()) return;
    this.isCardGrabbed = false;
    this.stackManager.setActiveGrabbed(false);
  }

  // resolve final swipe direction into throw/snap behavior
  handleSwipe(direction) {
    const activeCard = this.stackManager.getActiveCard();
    if (!activeCard) return;
    this.isCardGrabbed = false;
    this.stackManager.setActiveGrabbed(false);
    // block new input until tween/effect chain completes
    this.inputController.setEnabled(false);
    this.flowController.resolveSwipe( // pass current top card to throw/snap resolver
      direction,
      activeCard,
      () => this.handleSnapBackComplete(),
      () => this.completeSwipe(direction)
    );
  }

  // after snapback, reset targets and re-enable input
  handleSnapBackComplete() {
    const activeCard = this.stackManager.getActiveCard();
    if (!activeCard) return;
    activeCard.resetDragTarget();
    this.inputController.setEnabled(true);
  }

  // route completed swipe to slash or hack path
  completeSwipe(direction) {
    if (!this.stackManager.getActiveCard()) return;
    const isCardSlashed = direction === SWIPE_DIRECTIONS.SLASH;
    if (isCardSlashed) return this.finishSlash();
    this.finishHack();
  }

  // slash path plays split animation before stack advance
  finishSlash() {
    const activeCard = this.stackManager.getActiveCard();
    if (!activeCard) return;
    activeCard.playCutToPieces(() => this.advanceStack());
  }

  // hack path triggers handoff event then advances stack
  finishHack() {
    const activeProfile = this.stackManager.getActiveProfile();
    if (!activeProfile) return;
    this.onHackCommit(activeProfile); // write hacked id before leaving current card
    this.routeToHackPath(activeProfile); // existing hook for minigame scene routing
    this.advanceStack();
  }

  /**
   * save hacked profile id into global runtime store.
   * input is committed hacked profile object.
   * this provides data for future hacked list scene.
   */
  onHackCommit(profile) {
    PersistenceManager.addHackedCardID(profile.id);
    window.dispatchEvent(new CustomEvent("hack-commit", { detail: { profile, hackedCardIDs: PersistenceManager.getHackedCardIDs() } }));
  }

  // emit route event so external minigame flow can listen
  routeToHackPath(profile) {
    // this is the handoff point for the separate hack minigame scene
    const targetSceneKey = profile?.targetSceneKey || "hack-minigame";
    window.dispatchEvent(new CustomEvent("hack-route", { detail: { targetSceneKey, profile } }));
  }

  // destroy old card and ask stack for next profile
  advanceStack() {
    this.isCardGrabbed = false;
    this.stackManager.commitResolvedCard().finally(() => this.inputController.setEnabled(true)); // unlock input after promotion and buffer spawn
  }

  // recompute bounds on resize and apply to current cards
  handleResize() {
    this.layout = this.computeCardLayout();
    this.stackManager?.applyLayout();
  }
}
