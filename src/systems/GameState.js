// global runtime store for the swiper session.
// this module survives scene shutdowns because it lives on the module,
// not on any phaser scene. refresh clears it (in-memory only).
// the inner target holds the live set and safe helper methods.
// helpers are defined on the target so the proxy allows calling them,
// while the set trap still guards raw assignments against bad data.
const target = {
  // hackedIds uses a Set so adds are o(1) and duplicates are impossible.
  hackedIds: new Set(),
  
  // track killed and matched profiles separately
  killedIds: new Set(),
  matchedIds: new Set(),
  
  // cache the last hacked profile object for detail scene lookup
  lastHackedProfile: null,

  // record one profile id into the hacked list.
  recordHack(profileId) {
    const numericId = Number(profileId);
    if (!Number.isFinite(numericId)) return;
    this.hackedIds.add(numericId);
  },

  // record a killed/eliminated profile
  recordKill(profileId) {
    const numericId = Number(profileId);
    if (!Number.isFinite(numericId)) return;
    this.killedIds.add(numericId);
    this.hackedIds.delete(numericId); // can't be both hacked and killed
  },

  // record a successful match/dating start
  recordMatch(profileId) {
    const numericId = Number(profileId);
    if (!Number.isFinite(numericId)) return;
    this.matchedIds.add(numericId);
    this.hackedIds.delete(numericId); // can't be both hacked and matched
  },

  // store the full profile object for detail view retrieval
  setLastHackedProfile(profile) {
    if (!profile || !profile.id) return;
    this.lastHackedProfile = { ...profile }; // shallow copy to prevent external mutation
  },

  // retrieve the cached profile (read-only copy)
  getLastHackedProfile() {
    return this.lastHackedProfile ? { ...this.lastHackedProfile } : null;
  },

  // return a plain array snapshot of hacked ids.
  getHackedIDs() {
    return Array.from(this.hackedIds);
  },

  // NEW: getters for killed/matched
  getKilledIDs() {
    return Array.from(this.killedIds);
  },
  getMatchedIDs() {
    return Array.from(this.matchedIds);
  },

  // wipe the hacked list for debug tools or soft resets.
  clearHacks() {
    this.hackedIds.clear();
    this.lastHackedProfile = null;
  },

  // clear helpers
  clearKills() {
    this.killedIds.clear();
  },
  clearMatches() {
    this.matchedIds.clear();
  },
  clearAll() {
    this.hackedIds.clear();
    this.killedIds.clear();
    this.matchedIds.clear();
    this.lastHackedProfile = null;
  },
};

// proxy layer: validates any bulk assignment to hackedIds.
export const GameState = new Proxy(target, {
  set(innerTarget, prop, value) {
    // Allow writes to any of the tracked properties
    if (prop !== "hackedIds" && prop !== "killedIds" && prop !== "matchedIds" && prop !== "lastHackedProfile") return true;
    if (prop === "hackedIds" || prop === "killedIds" || prop === "matchedIds") {
      if (!Array.isArray(value)) return true;
      value.forEach((id) => {
        const numericId = Number(id);
        if (Number.isFinite(numericId)) innerTarget[prop].add(numericId);
      });
    } else {
      innerTarget.lastHackedProfile = value;
    }
    return true;
  },
});