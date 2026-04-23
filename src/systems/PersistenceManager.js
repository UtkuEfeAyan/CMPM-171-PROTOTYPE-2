/**
 * this store keeps cross-scene runtime data in one place.
 * inputs are simple ids, and output is always a safe copy.
 * it exists so future scenes can read hacked history anytime.
 */
class RuntimePersistenceStore {
  constructor() {
    this.hackedCardIDs = []; // runtime-only list of profile ids hacked this session
  }

  /**
   * add one hacked id if it is valid and new.
   * input is a profile id number, output is updated list copy.
   * this avoids duplicate rows in the future hacked list scene.
   */
  addHackedCardID(profileID) {
    if (!Number.isInteger(profileID)) return this.getHackedCardIDs(); // ignore invalid data early
    if (this.hackedCardIDs.includes(profileID)) return this.getHackedCardIDs(); // keep ids unique for clean future list scene
    this.hackedCardIDs.push(profileID); // append newest hacked card id
    return this.getHackedCardIDs();
  }

  /**
   * return hacked ids without exposing internal array reference.
   * input is none, output is cloned array.
   * this prevents accidental edits from other systems.
   */
  getHackedCardIDs() {
    return [...this.hackedCardIDs];
  }

  /**
   * clear all hacked ids for reset or debug tools.
   * input is none, output is empty list copy.
   * this helps quick playtest loops without page reload.
   */
  clearHackedCardIDs() {
    this.hackedCardIDs = [];
    return this.getHackedCardIDs();
  }
}

export const PersistenceManager = new RuntimePersistenceStore();
