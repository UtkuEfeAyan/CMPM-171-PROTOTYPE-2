import { SCENE_CONFIG } from "../constants/swipeConfig.js";
import { SwipeCard } from "../objects/SwipeCard.js";

export class ProfileLoader {
  // wrap profile data loading so scene stays focused on gameplay
  constructor(scene) {
    this.scene = scene;
  }

  // queue json and first image for fast first interaction
  preloadProfiles() {
    // load json first, then preload only first card for fast first interaction
    this.scene.load.json(SCENE_CONFIG.profileJsonKey, SCENE_CONFIG.profileJsonPath);
    this.scene.load.once(`filecomplete-json-${SCENE_CONFIG.profileJsonKey}`, (_key, _type, data) => {
      const profiles = this.getValidProfiles(data?.profiles || []);
      if (!profiles.length) return;
      SwipeCard.preload(this.scene, profiles[0]);
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
    queue.forEach((profile) => SwipeCard.preload(this.scene, profile));
    if (!queue.length) return;
    this.scene.time.delayedCall(SCENE_CONFIG.backgroundLoadDelayMs, () => this.startLoader());
  }

  // start phaser loader if not already running
  startLoader() {
    if (this.scene.load.isLoading()) return;
    this.scene.load.start();
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
