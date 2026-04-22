// cardstack manages the queue of profile cards
// keeps track of which card is active and emits events when cards are destroyed

export class CardStack extends Phaser.Events.EventEmitter {
  constructor() {
    super();
    this.profiles = [];          // array of all profile data from json
    this.currentIndex = 0;       // which card we're on right now
    this.cardInstances = new Map(); // references to the actual card objects
  }

  // load profile data into the stack
  init(profilesData) {
    if (!profilesData || profilesData.length === 0) {
      throw new Error("need some profiles to start");
    }
    
    this.profiles = profilesData;
    this.currentIndex = 0;
    this.cardInstances.clear();

    console.log(`loaded ${this.profiles.length} profiles`);
    this.emit("onCardReady", this.getTopCard());
  }

  // get the current card (the one you can swipe right now)
  getTopCard() {
    if (this.currentIndex >= this.profiles.length) {
      return null;
    }
    return this.profiles[this.currentIndex];
  }

  // peek at the next card coming up (don't remove it)
  getPeekCard() {
    const nextIndex = this.currentIndex + 1;
    if (nextIndex >= this.profiles.length) {
      return null;
    }
    return this.profiles[nextIndex];
  }

  // remove the current card and move to the next one
  destroyCard(reason = "slash") {
    const card = this.getTopCard();
    
    if (!card) {
      console.warn("tried to destroy card but there isnt one");
      return;
    }

    // clean up the visual card object if it exists
    if (this.cardInstances.has(card.id)) {
      const obj = this.cardInstances.get(card.id);
      if (obj && !obj.isDestroyed) {
        obj.destroy();
      }
      this.cardInstances.delete(card.id);
    }

    console.log(`removed card ${card.id} (${reason})`);
    this.emit("onCardDestroyed", card, reason);

    // move to next card
    this.currentIndex += 1;

    // tell scene what happened
    if (this.hasCards()) {
      this.emit("onCardReady", this.getTopCard());
    } else {
      console.log("no more cards!");
      this.emit("onStackEmpty");
    }
  }

  // keep track of the actual card object in the scene
  registerCardInstance(profileId, cardObject) {
    this.cardInstances.set(profileId, cardObject);
  }

  // forget about a card object
  unregisterCardInstance(profileId) {
    this.cardInstances.delete(profileId);
  }

  // check if there are more cards
  hasCards() {
    return this.currentIndex < this.profiles.length;
  }

  // how many cards are left (including current)
  getRemainingCount() {
    return Math.max(0, this.profiles.length - this.currentIndex);
  }

  // reset everything for a restart
  reset() {
    this.cardInstances.forEach((card) => {
      if (card && !card.isDestroyed) {
        card.destroy();
      }
    });
    this.cardInstances.clear();
    this.currentIndex = 0;
    console.log("card stack reset");
  }
}
