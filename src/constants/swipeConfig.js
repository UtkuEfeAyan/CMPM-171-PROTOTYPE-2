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
  profileJsonKey: "profiles",
  profileJsonPath: "src/data/profiles.json",
  backgroundLoadDelayMs: 200,
  throwTweenMs: 400,
  throwRiseY: 300,
  throwSlashX: 600,
  throwHackX: -120,
  throwSlashRotation: 0.8,
  throwHackRotation: -0.8,
  snapTweenMs: 260,
  swipeThreshold: 80,
  dragDeadZonePx: 5,
  snapEase: "Back.easeOut",
};

// visual setup for front card, back card, and cut animation
export const CARD_CONFIG = {
  depthTop: 30,
  depthBack: 20,
  depthBuffer: 10,
  backScale: 0.96,
  bufferScale: 0.92,
  dragFollowY: 0.2,
  rotationDivisor: 150,
  maxRotation: 0.8,
  dragSmoothness: 0.18,
  grabScale: 1.04,
  releaseScale: 1,
  minAlpha: 0.55,
  alphaRangePx: 420,
  fragmentPushX: 140,
  fragmentFallY: 140,
  fragmentRotate: 0.32,
  fragmentTweenMs: 280,
};

// phone frame and card area layout values
export const LAYOUT_CONFIG = {
  imageRatio: 0.7,
  textRatio: 0.3,
  frameInsets: {
    top: 60,
    right: 48,
    bottom: 60,
    left: 48,
  },
  frameFitScale: 1,
  cardMaxAspect: 0.72,
  pendingOffsetY: 14,
  bufferOffsetY: 28,
  bufferStartY: -260,
  bufferDropTweenMs: 260,
};

// effect tuning for slash blood and hack binary rain
export const EFFECT_CONFIG = {
  depth: 80,
  slashHoldMs: 280,
  slashFadeMs: 740,
  slashCleanupMs: 1200,
  bloodScale: 1.2,
  bloodCount: 180,
  bloodSpeedMin: 90,
  bloodSpeedMax: 360,
  bloodGravity: 760,
  bloodSpreadX: 320,
  bloodSpreadY: 240,
  hackGrowMs: 700,
  hackHoldMs: 300,
  hackFadeMs: 520,
  hackColumnSpacing: 36,
  hackBinaryLength: 22,
  hackRainMinMs: 1400,
  hackRainMaxMs: 2300,
};
