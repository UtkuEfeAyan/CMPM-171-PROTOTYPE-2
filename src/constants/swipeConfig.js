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

// per-card visual styling: colors, fonts, text positions.
// these are "paint" numbers - they affect how a card LOOKS, not how it moves.
// separated from CARD_CONFIG so designers can tweak look without touching physics.
export const CARD_STYLE = Object.freeze({
  panelColor: 0xd90910, // bottom panel fill color (crimson red)
  panelAlpha: 1, // bottom panel opacity
  nameFontSize: "22px", // profile name font size
  nameColor: "#ffffff", // profile name color
  nameFontStyle: "bold", // profile name weight
  descFontSize: "14px", // description font size
  descColor: "#ffffff", // description color
  descAlign: "center", // description alignment
  wrapRatio: 0.88, // description wrap width as % of card width
  imageYPct: -0.15, // y offset for image center (negative = above card center)
  panelYPct: 0.35, // y offset for panel center (positive = below card center)
  nameYPct: 0.3, // y offset for name text
  descYPct: 0.4, // y offset for description text
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
// card size is derived from camera dimensions * pct, clamped by min/max so
// tiny or huge screens still look reasonable.
export const LAYOUT_CONFIG = Object.freeze({
  imageRatio: 0.7, // top 70% of the card is the profile image
  textRatio: 0.3, // bottom 30% is the name/description panel
  cardWidthPct: 0.85, // card width as fraction of camera width
  cardHeightPct: 0.82, // card height as fraction of camera height
  cardAspectTall: 1.5, // preferred height / width for a portrait card
  cardMinWidth: 220, // never render cards narrower than this
  cardMaxWidth: 520, // never render cards wider than this
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


// DETAIL_LAYOUT: all spacing, sizing, and path values for the detail page.
// DETAIL_STYLE:  all colors, fonts, and text styling for the detail page.
// keeping these separate from the card/effect configs avoids merge conflicts
// when tweaking the detail view independently of the swipe deck.

export const DETAIL_LAYOUT = Object.freeze({
  // panel dimensions: the page renders inside a fixed panel, not full-screen.
  // panelWidthPct:  fraction of camera width the panel occupies.
  // panelHeightPct: fraction of camera height the panel occupies.
  // this gives the "phone screen within the game" look instead of full-bleed.
  panelWidthPct:  0.88,
  panelHeightPct: 0.88,

  topPad:        20,
  sectionGap:    10,
  headerGap:     8,
  infoRowHeight: 26,
  bottomPad:     20,

  profileImageHeight: 220,

  // credit card asset sizing
  // ccWidthRatio:   card width as a fraction of contentWidth.
  // ccAspectRatio:  card height = cardW * ccAspectRatio.
  ccWidthRatio:   0.85,
  ccAspectRatio:  0.50,

  // ssn card asset sizing
  // ssnWidthRatio:  card width as a fraction of contentWidth.
  // ssnAspectRatio: card height = cardW * ssnAspectRatio.
  ssnWidthRatio:  0.88,
  ssnAspectRatio: 0.60,

  assetGap: 10,

  buttonHeight: 48,

  wheelScrollSpeed: 0.6,

  creditCardImagePath: "assets/credit_card.png",
  ssnImagePath:        "assets/ssn_card.png",

  maxContentWidth: 480,
});

export const DETAIL_STYLE = Object.freeze({
  // background
  bgColor: 0x0a0a0a,

  // panel frame
  panelBgColor:     0x111111, // panel fill (slightly lighter than bg)
  panelBorderColor: 0x00ff88, // green border matching the hack theme
  panelBorderWidth: 2,

  // profile image
  imageFallbackColor: 0x2a2a2a, // dark gray placeholder when texture missing

  // divider line between sections
  dividerColor: 0x333333,

  // name text (largest text on the page)
  nameFontSize:  "30px",
  nameColor:     "#ffffff",

  // section headers ("GENERAL INFORMATION", "CREDIT CARD INFORMATION", etc.)
  sectionHeaderFontSize:  "13px",
  sectionHeaderColor:     "#00ff88", // green accent, matches hack theme

  // key/value info rows
  infoKeyFontSize: "13px",
  infoKeyColor:    "#888888", // muted label
  infoValFontSize: "13px",
  infoValColor:    "#ffffff", // bright value

  // action buttons
  btnFontSize:  "14px",
  btnTextColor: "#ffffff",

  // shared font family across the whole scene
  fontFamily: "Arial, sans-serif",
});