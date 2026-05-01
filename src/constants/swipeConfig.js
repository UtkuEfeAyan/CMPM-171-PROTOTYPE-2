// single-source-of-truth config.
// every magic number, color, ratio, and easing string the game uses
// should live in one of the frozen blocks below. if you need to tune
// the feel, change ONE value here and the whole system follows.

// shared direction labels used by SwipeLogic, ProfileCard, and SwipeEffects.
// strings (not numbers) so debug logs stay readable.
export const SWIPE_DIRECTIONS = Object.freeze({
  SLASH: "SLASH",
  HACK: "HACK",
  NONE: "NONE",
});

// core swipe + scene timing config.
// swipeThreshold is the only value that affects "when" a commit fires.
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

// per-card motion tuning: scale, lerp, tilt, alpha, and slash fragment tweening.
// these are "physics" numbers - they affect how a card MOVES, not how it looks.
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

// per-card visual styling. with text baked into the PNG, this is now just
// the grab tween + fallback color used when a texture hasn't loaded yet.
export const CARD_STYLE = Object.freeze({
  grabTweenMs: 110, // grab/release scale tween duration
  grabEase: "Sine.easeOut", // easing for the grab puff
  fallbackPanelColor: 0x333333, // neutral gray used if texture is missing
});

// overlay effect timing for the slash blood + hack binary rain.
// colors and counts live in EFFECT_STYLE below so tuning feel vs look is separate.
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

// colors and text styling for the overlay effects.
// separated from EFFECT_CONFIG so art direction changes are one-file edits.
export const EFFECT_STYLE = Object.freeze({
  bloodParticleColor: 0xcf1010, // color of the small round particle sprites
  bloodParticleSize: 22, // generated texture pixel size
  bloodParticleRadius: 11, // circle radius inside generated texture
  bloodParticleLifespanMs: 950, // how long each particle lives
  bloodDecalColor: 0x8f0000, // dark red painted blood decal
  bloodDecalAlpha: 0.78, // painted decal opacity
  bloodBlobCount: 28, // number of random ellipses per splatter
  bloodBlobMinR: 18, // min ellipse radius (multiplied by bloodScale)
  bloodBlobMaxR: 56, // max ellipse radius (multiplied by bloodScale)
  hackTintColor: 0x022d12, // dark green backdrop tint
  hackTintAlphaStart: 0.16, // tint opacity before grow
  hackTintAlphaPeak: 0.4, // tint opacity at peak during hack
  hackTextColor: "#9dff62", // falling digits color
  hackTextStrokeColor: "#4eff1f", // digit outline color
  hackTextShadowColor: "#2cff00", // digit glow shadow color
  hackTextShadowBlur: 10, // glow blur radius
  hackTextFontSize: "30px", // digit font size
  hackTextFontFamily: "Courier New, monospace", // digit font family
  hackSpawnYOffset: -420, // y where each column spawns (above screen)
  hackExtraFallY: 280, // extra fall distance past camera bottom
  hackColumnAlpha: 0.92, // column text opacity
  hackColumnStrokeWidth: 1, // outline thickness on digits
});

// phone-frame layout: percentage-based so every screen fits the same feel.
// card size is derived from the DISPLAYED phone background (after fit-scaling),
// not the raw camera. percentages match BACKGROUND_CONFIG.innerScreen* so the
// card fully fills the phone's inner screen rectangle.
export const LAYOUT_CONFIG = Object.freeze({
  cardWidthPct: 1.001, // card width as fraction of bg display width (matches inner screen)
  cardHeightPct: 1.001, // card height as fraction of bg display height (matches inner screen)
  cardAspectTall: 2.4, // loose enough that aspect never clamps fill height
  cardMinWidth: 160, // never render cards narrower than this
  cardMaxWidth: 700, // never render cards wider than this (clamps only on huge monitors)
  pendingOffsetY: 14, // pending card sits this far below active
  pendingDropStartY: -500, // pending "drops in" from this y after promotion
  pendingDropTweenMs: 400, // drop-in duration
});

// progressive asset loader tuning.
// small numbers because we only have a handful of profiles; scaling up
// is as simple as increasing initialBatchSize.
export const LOADER_CONFIG = Object.freeze({
  initialBatchSize: 3, // how many profile images to load before first render
  backgroundDelayMs: 200, // delay before idle-time background loading begins
});

// shared phone-frame background asset (used by SwipeDeckScene + StorageScene).
// the innerScreen* ratios describe the visible "screen" rectangle INSIDE the
// phone art (the dark green window between the bezels). values are fractions
// of the displayed bg size after fit-scaling. tweak these if you ship a new
// bg PNG with a different inner-screen window.
export const BACKGROUND_CONFIG = Object.freeze({
  phoneTextureKey: "phoneBg", // phaser cache key for the blurred phone background
  phoneImagePath: "assets/PhoneBackgroundBlurred.png",
  depth: -10, // sit behind every gameplay element
  innerScreenWidthPct: 0.74, // inner phone screen width as fraction of bg display width
  innerScreenHeightPct: 0.74, // inner phone screen height as fraction of bg display height
  innerScreenCenterYOffsetPct: 0.001, // bg center sits slightly below screen center (home button strip)
});

// storage scene grid + scroll tuning.
// 3-column grid lives inside the phone's inner screen rectangle.
// scrolling kicks in when the rows overflow the inner screen height.
export const STORAGE_CONFIG = Object.freeze({
  columns: 3, // grid column count (column = index % columns)
  cellHeight: 130, // vertical spacing per row (cell = portrait + gap)
  portraitWidth: 80, // displayed portrait width
  portraitHeight: 110, // displayed portrait height
  gridTopPad: 12, // breathing room from the top edge of the inner screen
  headerHeight: 70, // reserved space at the top for back button + title
  wheelStep: 0.6, // pixels of grid shift per wheel-delta unit
});

// title screen background asset config.
export const TITLE_BG_CONFIG = Object.freeze({
  textureKey: "titleBg",
  imagePath: "assets/TitleScreenBlurred.png",
});

// profile detail scene layout proportions and spacing.
export const DETAIL_LAYOUT = Object.freeze({
  panelWidthPct: 0.78,
  panelHeightPct: 0.88,
  maxContentWidth: 560,
  topPad: 24,
  bottomPad: 18,
  sectionGap: 14,
  headerGap: 8,
  infoRowHeight: 22,
  assetGap: 12,
  profileImageHeight: 230,
  buttonHeight: 54,
  ccWidthRatio: 0.9,
  ccAspectRatio: 1.58,
  ssnWidthRatio: 0.78,
  ssnAspectRatio: 1.6,
  wheelScrollSpeed: 0.45,
});

// profile detail scene typography and colors.
export const DETAIL_STYLE = Object.freeze({
  fontFamily: '"SF Pro Text", "Helvetica Neue", Arial, sans-serif',
  bgColor: 0x0b0f17,
  panelBgColor: 0x101725,
  panelBorderColor: 0x3f5b82,
  panelBorderWidth: 2,
  dividerColor: 0x7a8ea9,
  imageFallbackColor: 0x28364d,
  nameFontSize: "32px",
  nameColor: "#f4f8ff",
  sectionHeaderFontSize: "20px",
  sectionHeaderColor: "#9bc5ff",
  infoKeyFontSize: "18px",
  infoKeyColor: "#8fa4c2",
  infoValFontSize: "18px",
  infoValColor: "#f2f6ff",
  btnFontSize: "20px",
});
