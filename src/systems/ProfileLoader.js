import { SCENE_CONFIG } from "../constants/swipeConfig.js";
import { ProfileCard } from "../objects/ProfileCard.js";

export class ProfileLoader {
  // wrap profile data loading so scene stays focused on gameplay
  constructor(scene) {
    this.scene = scene;
    this.textureWaiters = new Map(); // textureKey -> callbacks waiting for that exact image
    this.scene.load.on("filecomplete", (key, type) => this.resolveTextureWaiters(key, type)); // wake waiters when phaser reports load complete
  }

  // queue json and first image for fast first interaction
  preloadProfiles() {
    // load json first, then preload first 3 cards for strict look-ahead startup
    this.scene.load.json(SCENE_CONFIG.profileJsonKey, SCENE_CONFIG.profileJsonPath);
    this.scene.load.once(`filecomplete-json-${SCENE_CONFIG.profileJsonKey}`, (_key, _type, data) => {
      const profiles = this.getValidProfiles(data?.profiles || []);
      if (!profiles.length) return;
      profiles.slice(0, 3).forEach((profile) => ProfileCard.preload(this.scene, profile)); // strict look-ahead startup: active + pending + buffer
    });
  }

  // read cached json and filter invalid entries
  getProfilesFromCache() {
    const data = this.scene.cache.json.get(SCENE_CONFIG.profileJsonKey);
    return this.getValidProfiles(data?.profiles || []);
  }

  // queue remaining profile images after first frame
  loadRemainingProfiles(profiles) {
    // queue the rest after first render so startup feels snappy
    const queue = profiles.slice(1).filter((profile) => !this.scene.textures.exists(`profile_${profile.id}`));
    queue.forEach((profile) => ProfileCard.preload(this.scene, profile));
    if (!queue.length) return;
    this.scene.time.delayedCall(SCENE_CONFIG.backgroundLoadDelayMs, () => this.startLoader());
  }

  // start phaser loader if not already running
  startLoader() {
    if (this.scene.load.isLoading()) return;
    this.scene.load.start();
  }

  // ensure profile texture is loaded before card creation
  ensureTextureReady(profile, onReady) {
    const textureKey = `profile_${profile.id}`;
    if (this.scene.textures.exists(textureKey)) {
      onReady?.(); // run callback instantly if texture already cached
      return Promise.resolve();
    }

    ProfileCard.preload(this.scene, profile);
    const waitPromise = new Promise((resolve) => {
      const waiters = this.textureWaiters.get(textureKey) || [];
      waiters.push(() => {
        onReady?.();
        resolve();
      });
      this.textureWaiters.set(textureKey, waiters); // store callback so we can resolve when filecomplete arrives
    });
    this.startLoader();
    return waitPromise;
  }

  // release pending callbacks when a queued image finishes
  resolveTextureWaiters(key, type) {
    if (type !== "image") return;
    const waiters = this.textureWaiters.get(key);
    if (!waiters?.length) return;
    waiters.forEach((run) => run());
    this.textureWaiters.delete(key);
  }

  // keep only profiles that pass minimal contract checks
  getValidProfiles(rawProfiles) {
    // sanitize profile list so bad entries do not break scene creation
    return rawProfiles.filter((profile) => this.isValidProfile(profile));
  }

  // validate required fields needed for card creation
  isValidProfile(profile) {
    // minimal fail-fast contract for a playable profile
    if (!profile?.id) return false;
    if (!profile?.name) return false;
    if (!profile?.imagePath) return false;
    return true;
  }
}
