import { SwipeCard } from "../objects/SwipeCard.js";
import { CardStack } from "../systems/CardStack.js";
import { InputController } from "../systems/InputController.js";
import { AnimationOverlay } from "../systems/AnimationOverlay.js";
import { ProfileLoader } from "../systems/ProfileLoader.js";
import { SwipeFlowController } from "../systems/SwipeFlowController.js";
import { SWIPE_DIRECTIONS, SWIPE_EVENTS } from "../constants/swipeConfig.js";

export class SwipeDeckScene extends Phaser.Scene {
  // setup scene-level references used across card lifecycle
  constructor() {
    super({ key: "SwipeDeck" });
    this.cardStack = null;
    this.inputController = null;
    this.animationOverlay = null;
    this.profileLoader = null;
    this.flowController = null;
    this.activeCard = null;
    this.peekCard = null;
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
    const profiles = this.profileLoader.getProfilesFromCache();
    if (!profiles.length) return;
    this.setupSystems();
    this.setupEvents();
    this.cardStack.init(profiles);
    this.profileLoader.loadRemainingProfiles(profiles);
  }

  // wire up independent systems used by this scene
  setupSystems() {
    this.cardStack = new CardStack();
    this.inputController = new InputController(this);
    this.animationOverlay = new AnimationOverlay(this);
    this.flowController = new SwipeFlowController(this, this.animationOverlay);
  }

  // subscribe to stack and input events
  setupEvents() {
    // card stack drives when a new top card should appear
    this.cardStack.on(SWIPE_EVENTS.CARD_READY, (profile) => this.renderCards(profile));
    // input sends drag deltas so top card follows pointer movement
    this.inputController.on(SWIPE_EVENTS.MOVE, ({ dragX, dragY }) => this.moveActiveCard(dragX, dragY));
    this.inputController.on(SWIPE_EVENTS.DRAG_START, () => this.handleDragStart());
    this.inputController.on(SWIPE_EVENTS.DRAG_END, () => this.handleDragEnd());
    // input also sends final swipe direction when gesture ends
    this.inputController.on(SWIPE_EVENTS.END, ({ direction }) => this.handleSwipe(direction));
  }

  // frame loop: apply smooth drag motion while card is grabbed
  update() {
    if (!this.activeCard || !this.isCardGrabbed) return;
    this.activeCard.stepTowardsTarget();
  }

  // render top card and one preview card behind it
  renderCards(profile) {
    if (!profile) return;
    // keep at most 2 cards alive: one active and one preview
    this.removePeekCard();
    this.promotePeekCard();
    if (!this.activeCard) this.activeCard = this.createCard(profile);
    const nextProfile = this.cardStack.profiles[this.cardStack.currentIndex + 1];
    this.peekCard = nextProfile ? this.createBackCard(nextProfile) : null;
  }

  // create the active card that can be dragged and swiped
  createCard(profile) {
    const card = SwipeCard.create(this, profile, this.cameras.main.width / 2, this.cameras.main.height / 2);
    card.setTopCardStyle();
    return card;
  }

  // create the next card preview behind the active card
  createBackCard(profile) {
    const card = SwipeCard.create(this, profile, this.cameras.main.width / 2, this.cameras.main.height / 2);
    card.setBackCardStyle();
    return card;
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
    // remove old top card, then ask stack to publish the next profile
    this.activeCard.destroy();
    this.activeCard = null;
    this.isCardGrabbed = false;
    this.cardStack.consumeCurrentCard();
    this.inputController.setEnabled(true);
  }

  // promote preview card into active top slot
  promotePeekCard() {
    if (!this.peekCard) return;
    this.activeCard = this.peekCard;
    this.peekCard = null;
    this.activeCard.setTopCardStyle();
  }

  // remove stale preview card before creating a new one
  removePeekCard() {
    if (!this.peekCard) return;
    if (this.peekCard === this.activeCard) return;
    this.peekCard.destroy();
    this.peekCard = null;
  }
}
