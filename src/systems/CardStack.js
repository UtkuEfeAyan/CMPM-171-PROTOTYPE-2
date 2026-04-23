import { SWIPE_EVENTS } from "../constants/swipeConfig.js";

export class CardStack extends Phaser.Events.EventEmitter {
  // hold profile list and current position in the stack
  constructor() {
    super();
    this.profiles = [];
    this.currentIndex = 0;
  }

  // load a new deck and emit first card
  init(profiles) {
    // reset state whenever we start or restart a deck
    this.profiles = profiles;
    this.currentIndex = 0;
    this.emitCurrentCard();
  }

  // return current profile or null if out of cards
  getCurrentProfile() {
    return this.profiles[this.currentIndex] || null;
  }

  // check if current index still points at a valid card
  hasActiveCard() {
    return this.currentIndex < this.profiles.length;
  }

  // move stack forward after a card is resolved
  consumeCurrentCard() {
    // scene calls this after a slash/hack flow fully finishes
    if (!this.hasActiveCard()) return;
    this.currentIndex += 1;
    this.emitCurrentCard();
  }

  // emit either next card or stack empty event
  emitCurrentCard() {
    // single place that decides if we publish next card or empty event
    if (!this.hasActiveCard()) {
      this.emit(SWIPE_EVENTS.STACK_EMPTY);
      return;
    }
    this.emit(SWIPE_EVENTS.CARD_READY, this.getCurrentProfile());
  }
}
