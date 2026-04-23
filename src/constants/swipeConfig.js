// shared direction labels used by SwipeLogic and ProfileCard.
// strings (not numbers) so debug logs stay readable.
export const SWIPE_DIRECTIONS = Object.freeze({
  SLASH: "SLASH",
  HACK: "HACK",
  NONE: "NONE",
});

// core swipe + scene timing config.
// every "magic number" that affects swipe feel lives here so tuning is easy.
export const SCENE_CONFIG = Object.freeze({
  profileJsonKey: "profiles", // key used when reading json from phaser cache
  profileJsonPath: "src/data/profiles.json", // source path for deck data
  swipeThreshold: 150, // pixels moved before a release counts as commit
  snapTweenMs: 260, // duration of the spring-back when release is short
  snapEase: "Back.easeOut", // easing that gives the springy return
  throwTweenMs: 400, // duration of the hack throw-off-screen tween
  throwRiseY: 200, // how high the hacked card drifts up while leaving
  throwHackX: -900, // target x offset for the hack exit (to the left)
  throwHackAngle: -20, // tilt in degrees while the card flies away
});

// per-card visuals: scale, lerp, tilt, alpha, and slash fragment tweening.
export const CARD_CONFIG = Object.freeze({
  depthActive: 30, // render depth for the top/active card
  depthPending: 20, // render depth for the pending/back card
  pendingScale: 0.96, // slightly smaller to signal "behind"
  releaseScale: 1, // rest scale for the active card
  grabScale: 1.04, // slight puff on pointerdown for juice
  dragLerp: 0.2, // how fast the card chases the pointer (0..1)
  rotationDivisor: 15, // larger = gentler tilt response
  alphaFadeRange: 420, // pixels of drag that map to full alpha fade
  minAlpha: 0.55, // clamp so the card never fully disappears during drag
  fragmentPushX: 160, // horizontal distance for slash halves
  fragmentFallY: 160, // vertical distance for slash halves
  fragmentRotate: 0.32, // tilt (radians) applied to each slash half
  fragmentTweenMs: 280, // slash animation duration
});

// overlay effect tuning for the slash blood + hack binary rain.
// kept in one place so tweaking feel (count, speed, duration) is one edit.
export const EFFECT_CONFIG = Object.freeze({
  depth: 80, // base depth so overlays sit above cards
  // slash blood decal + particle burst
  slashHoldMs: 280, // how long the decal stays at full alpha before fading
  slashFadeMs: 740, // decal fade duration
  slashCleanupMs: 1200, // hard destroy time so no memory leaks
  bloodScale: 1.2, // particle/blob size multiplier
  bloodCount: 180, // particles per burst
  bloodSpeedMin: 90, // min particle speed
  bloodSpeedMax: 360, // max particle speed
  bloodGravity: 760, // gravity for particles (faster falloff = juicier)
  bloodSpreadX: 320, // random x spread for splatter blobs
  bloodSpreadY: 240, // random y spread for splatter blobs
  // hack binary rain + backdrop tint
  hackGrowMs: 700, // backdrop tint grow-in time
  hackHoldMs: 300, // hold at full strength before fading
  hackFadeMs: 520, // fade out time
  hackColumnSpacing: 36, // distance between binary rain columns
  hackBinaryLength: 22, // characters per rain column
  hackRainMinMs: 1400, // fastest column fall
  hackRainMaxMs: 2300, // slowest column fall
});

// phone-frame layout: determines card size and pending card offset.
export const LAYOUT_CONFIG = Object.freeze({
  imageRatio: 0.7, // top 70% of the card is the profile image
  textRatio: 0.3, // bottom 30% is the name/description panel
  frameInsets: { top: 60, right: 48, bottom: 60, left: 48 }, // manual phone safe area
  cardMaxAspect: 0.72, // width/height cap so portrait cards stay tall
  pendingOffsetY: 14, // pending card sits this far below active
  pendingDropStartY: -500, // pending "drops in" from this y after promotion
  pendingDropTweenMs: 400, // drop-in duration
});
