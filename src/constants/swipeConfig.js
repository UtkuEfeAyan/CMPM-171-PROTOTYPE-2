// shared swipe labels so every system uses the same values
export const SWIPE_DIRECTIONS = {
  SLASH: "slash",
  HACK: "hack",
  NONE: "none",
};

// event names used between input, stack, and scene flow
export const SWIPE_EVENTS = {
  MOVE: "onSwipeMove",
  END: "onSwipeEnd",
  DRAG_START: "onDragStart",
  DRAG_END: "onDragEnd",
  CARD_READY: "onCardReady",
  STACK_EMPTY: "onStackEmpty",
};

// core gameplay timings and movement tuning
export const SCENE_CONFIG = {
  profileJsonKey: "profiles", // key used when reading json from phaser cache
  profileJsonPath: "src/data/profiles.json", // source path for deck data
  backgroundLoadDelayMs: 200, // small delay before non-critical image loading starts
  throwTweenMs: 400, // time for committed card throw tween
  throwRiseY: 300, // how much card moves upward during throw
  throwSlashX: 600, // x offset for right slash exit
  throwHackX: -120, // x offset for left hack exit
  throwSlashRotation: 0.8, // rotation amount during slash throw
  throwHackRotation: -0.8, // rotation amount during hack throw
  snapTweenMs: 260, // duration for spring-back when swipe not committed
  swipeThreshold: 80, // x distance needed to count as slash/hack
  dragDeadZonePx: 5, // tiny movement ignored so taps are not treated as drags
  snapEase: "Back.easeOut", // easing style for elastic-like reset
};

// visual setup for front card, back card, and cut animation
export const CARD_CONFIG = {
  depthTop: 30, // active card render order
  depthBack: 20, // pending card render order
  depthBuffer: 10, // third card render order
  backScale: 0.96, // slightly smaller pending card to show depth
  bufferScale: 0.92, // smallest card for third slot
  dragFollowY: 0.2, // y movement dampener while dragging
  rotationDivisor: 150, // bigger value = gentler tilt response
  maxRotation: 0.8, // clamp so card never spins too far
  dragSmoothness: 0.15, // lerp smoothness per frame
  grabScale: 1.04, // scale bump while card is grabbed
  releaseScale: 1, // normal resting scale
  minAlpha: 0.55, // minimum alpha while dragged far from center
  alphaRangePx: 420, // distance range used to compute alpha fade
  fragmentPushX: 140, // side push distance for split pieces
  fragmentFallY: 140, // downward fall for split pieces
  fragmentRotate: 0.32, // rotation amount for fragment motion
  fragmentTweenMs: 280, // split animation duration
};

// phone frame and card area layout values
export const LAYOUT_CONFIG = {
  imageRatio: 0.7, // top visual region percentage
  textRatio: 0.3, // bottom text region percentage
  frameInsets: {
    top: 60,
    right: 48,
    bottom: 60,
    left: 48,
  },
  frameFitScale: 1, // scale applied to computed inner frame bounds
  cardMaxAspect: 0.72, // width/height cap so card does not become too wide
  pendingOffsetY: 14, // y offset for pending card behind active
  bufferOffsetY: 28, // y offset for third buffer card
  bufferStartY: -260, // spawn y for drop-in card animation
  bufferDropTweenMs: 260, // drop-in animation duration for buffer slot
};

// effect tuning for slash blood and hack binary rain
export const EFFECT_CONFIG = {
  depth: 80, // base draw depth for overlay effects
  slashHoldMs: 280, // delay before slash decal starts fading
  slashFadeMs: 740, // fade duration for blood decal
  slashCleanupMs: 1200, // when to destroy slash temporary objects
  bloodScale: 1.2, // particle/blob size multiplier
  bloodCount: 180, // particles emitted on slash
  bloodSpeedMin: 90, // min particle burst speed
  bloodSpeedMax: 360, // max particle burst speed
  bloodGravity: 760, // gravity on blood particles
  bloodSpreadX: 320, // random spread width for splatter blobs
  bloodSpreadY: 240, // random spread height for splatter blobs
  hackGrowMs: 700, // backdrop grow/fade-in duration for hack effect
  hackHoldMs: 300, // hold time before hack fade-out starts
  hackFadeMs: 520, // fade-out duration for hack effect
  hackColumnSpacing: 36, // distance between binary rain columns
  hackBinaryLength: 22, // lines of 0/1 text per column
  hackRainMinMs: 1400, // fastest rain column fall time
  hackRainMaxMs: 2300, // slowest rain column fall time
};
