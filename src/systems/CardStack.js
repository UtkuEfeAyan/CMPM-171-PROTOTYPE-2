// simple card queue manager
// just tracks which card we're on and emits events

export class CardStack extends Phaser.Events.EventEmitter {
  constructor() {
    super();
    this.profiles = [];
    this.currentIndex = 0;
    console.log("[CardStack] created");
  }

  // load profiles
  init(profilesData) {
    console.log(`[CardStack] init with ${profilesData.length} profiles`);
    this.profiles = profilesData;
    this.currentIndex = 0;
    this.emit("onCardReady", this.getCard());
  }

  // get current card
  getCard() {
    if (this.currentIndex >= this.profiles.length) {
      console.log("[CardStack] no more cards");
      return null;
    }
    const card = this.profiles[this.currentIndex];
    console.log(`[CardStack] getCard: ${card.id}`);
    return card;
  }

  // next card exists?
  hasNext() {
    return this.currentIndex + 1 < this.profiles.length;
  }

  // destroy and move to next
  destroyCard(reason) {
    const card = this.getCard();
    console.log(`[CardStack] destroy ${card?.id} (${reason})`);
    this.currentIndex += 1;

    if (this.hasNext()) {
      console.log(`[CardStack] next card ready`);
      this.emit("onCardReady", this.getCard());
    } else {
      console.log(`[CardStack] stack empty`);
      this.emit("onStackEmpty");
    }
  }
}
