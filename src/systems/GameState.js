// global runtime store for the swiper session.
// this module survives scene shutdowns because it lives on the module,
// not on any phaser scene. refresh clears it (in-memory only).

// the inner target holds the live set and safe helper methods.
// helpers are defined on the target so the proxy allows calling them,
// while the set trap still guards raw assignments against bad data.
const target = {
  // hackedIds uses a Set so adds are o(1) and duplicates are impossible.
  hackedIds: new Set(),

  // record one profile id into the hacked list.
  // input is any id-like value. non-numeric input is ignored so the
  // store never holds corrupted entries coming from random callers.
  recordHack(profileId) {
    const numericId = Number(profileId);
    if (!Number.isFinite(numericId)) return;
    this.hackedIds.add(numericId);
  },

  // return a plain array snapshot of hacked ids.
  // returning a copy prevents outside code from mutating internals.
  getHackedIDs() {
    return Array.from(this.hackedIds);
  },

  // wipe the hacked list for debug tools or soft resets.
  // keeps the session quick to re-test without page reload.
  clearHacks() {
    this.hackedIds.clear();
  },
};

// proxy layer: validates any bulk assignment to hackedIds.
// example safe usage: GameState.hackedIds = [1, 2, 3]
// invalid input (wrong prop name or non-array value) is ignored without throwing.
// we always return true so strict-mode callers never see a TypeError; the
// proxy's job here is defensive input scrubbing, not hard access control.
export const GameState = new Proxy(target, {
  set(innerTarget, prop, value) {
    if (prop !== "hackedIds") return true; // ignore unknown writes quietly
    if (!Array.isArray(value)) return true; // ignore non-array bulk writes quietly
    value.forEach((id) => {
      const numericId = Number(id);
      if (Number.isFinite(numericId)) innerTarget.hackedIds.add(numericId);
    });
    return true;
  },
});
