import { CARD_CONFIG, CARD_STYLE, LAYOUT_CONFIG } from "../constants/swipeConfig.js";

// monotonic counter for fallback ids when a profile is missing or has no id.
// using a module-level counter instead of Date.now() guarantees uniqueness even
// when multiple broken cards are created inside the same millisecond (loops,
// batch operations, etc). this prevents texture cache key collisions like two
// different cards both mapping to "profile_missing_1713456789".
let fallbackIdCounter = 0;
function nextFallbackId() {
  fallbackIdCounter += 1;
  return `missing_${fallbackIdCounter}`;
}

// one profile card in the swiper deck.
// the card is just the profile PNG (name + description are baked into the
// art now), so this container only holds a single image child.
//
// defensive: the constructor validates profile + bounds shape. bad data
// produces a warning and a safe-default card (never throws, never crashes
// the deck).
export class ProfileCard extends Phaser.GameObjects.Container {
  // build one card at (x, y) from a profile object and a bounds box.
  // input: scene, home x, home y, profile object, { width, height } bounds.
  // guard: rejects obviously-broken inputs by substituting safe defaults.
  constructor(scene, x, y, profile, bounds) {
    super(scene, x, y);
    const safeProfile = this.validateProfile(profile);
    const safeBounds = this.validateBounds(bounds);
    this.id = safeProfile.id;
    this.profile = safeProfile;
    this.bounds = safeBounds;
    this.centerX = x;
    this.centerY = y;
    this.initLayout();
    scene.add.existing(this);
  }

  // validate incoming profile data.
  // output: a profile object guaranteed to have id + name + imagePath.
  // missing fields trigger a warn and get replaced with empty strings /
  // stable ids so render code never sees undefined.
  validateProfile(profile) {
    if (!profile || typeof profile !== "object") {
      console.warn("[ProfileCard] missing profile object, using placeholder");
      return { id: nextFallbackId(), name: "", text: "", imagePath: "" };
    }
    const safe = { ...profile };
    if (safe.id == null) {
      console.warn("[ProfileCard] profile missing id, assigning fallback");
      safe.id = nextFallbackId();
    }
    if (!safe.name) safe.name = "";
    if (!safe.text) safe.text = "";
    return safe;
  }

  // validate incoming bounds.
  // output: { width, height } with sane positive numbers.
  // zero or negative sizes get replaced with a minimum readable default.
  validateBounds(bounds) {
    const hasValidShape = bounds && typeof bounds === "object";
    // use caller width if bounds object is valid and positive, otherwise fall back to config minimum
    let width;
    if (hasValidShape && bounds.width > 0) {
      width = bounds.width;
    } else {
      width = LAYOUT_CONFIG.cardMinWidth;
    }
    // use caller height if bounds object is valid and positive, otherwise derive from min width and aspect
    let height;
    if (hasValidShape && bounds.height > 0) {
      height = bounds.height;
    } else {
      height = LAYOUT_CONFIG.cardMinWidth * LAYOUT_CONFIG.cardAspectTall;
    }
    if (!hasValidShape) console.warn("[ProfileCard] missing bounds, using config minimums");
    return { width, height };
  }

  // build the single image visual sized to the full bounds.
  // image fills width/height; if the texture is missing we drop in a colored
  // rectangle so the card is never invisible.
  initLayout() {
    const { width, height } = this.bounds;
    this.image = this.buildImage(width, height);
    this.add([this.image]);
  }

  // build the card image (full bounds, centered at 0,0 inside the container).
  // scaled slightly larger than bounds so any baked-in white border bleeds
  // off the card edges and becomes invisible.
  // if the texture is missing we fall back to a colored rectangle so the
  // card is never a broken white box.
  buildImage(width, height) {
    const textureKey = this.textureKey();
    if (this.scene.textures.exists(textureKey)) {
      const image = this.scene.add.image(0, 0, textureKey);
      image.setDisplaySize(width * 1.08, height * 1.001);
      return image;
    }
    return this.scene.add.rectangle(0, 0, width, height, CARD_STYLE.fallbackPanelColor, 1);
  }

  // reflow the image for a new bounds box.
  // called on window resize so the same card instance re-paints itself
  // without being destroyed.
  applyLayout(newBounds) {
    const safeBounds = this.validateBounds(newBounds);
    this.bounds = safeBounds;
    const { width, height } = safeBounds;

    if (this.image.setDisplaySize) {
      this.image.setPosition(0, 0);
      this.image.setDisplaySize(width * 1.08, height * 1.08); // bleeds border off edges
    } else {
      this.image.setPosition(0, 0);
      this.image.setSize(width, height);
    }
  }

  // unified tween helper.
  // this is the ONLY animation entry point used by SwipeLogic, so every
  // swipe/snap/throw tween has the same predictable shape.
  animate(targetProps, duration = 300, ease = "Power2") {
    return new Promise((resolve) => {
      this.scene.tweens.add({
        targets: this,
        ...targetProps,
        duration,
        ease,
        onComplete: resolve,
      });
    });
  }

  // quick scale-up/down on grab/release for juice.
  // kills any existing scale tween so repeated grabs don't pile up.
  setGrabState(isGrabbed) {
    this.scene.tweens.killTweensOf(this);
    let targetScale;
    if (isGrabbed) {
      targetScale = CARD_CONFIG.grabScale;
    } else {
      targetScale = CARD_CONFIG.releaseScale;
    }
    this.scene.tweens.add({
      targets: this,
      scale: targetScale,
      duration: CARD_STYLE.grabTweenMs,
      ease: CARD_STYLE.grabEase,
    });
  }

  // slash commit visual: cut the card into two halves that fly apart.
  // returns a promise so SwipeLogic can await the visual before promoting.
  //
  // safety: if the texture is missing, the halves are built as colored
  // rectangles so the slash still plays.
  playSlashAnimation() {
    return new Promise((resolve) => {
      const [leftHalf, rightHalf] = this.createSlashHalves();
      this.alpha = 0;
      this.tweenSlashHalf(leftHalf, -1);
      this.tweenSlashHalf(rightHalf, 1, resolve);
    });
  }

  // build one tween for a slash half.
  // side is -1 (left) or 1 (right).
  // if resolve is given, it fires on complete so the outer promise ends.
  tweenSlashHalf(half, side, resolve) {
    this.scene.tweens.add({
      targets: half,
      x: this.x + side * CARD_CONFIG.fragmentPushX,
      y: this.y + CARD_CONFIG.fragmentFallY,
      rotation: side * CARD_CONFIG.fragmentRotate,
      alpha: 0,
      duration: CARD_CONFIG.fragmentTweenMs,
      onComplete: () => {
        half.destroy();
        if (resolve) resolve();
      },
    });
  }

  // create two cropped copies of the card texture for the slash.
  // input: none. output: [leftHalf, rightHalf] Phaser game objects.
  //
  // fallback: if the texture is missing, returns two colored rectangles
  // half-width each so the slash animation still runs safely.
  createSlashHalves() {
    const { width, height } = this.bounds;
    const textureKey = this.textureKey();
    if (!this.scene.textures.exists(textureKey)) {
      return this.createFallbackHalves(width, height);
    }
    const halfWidth = width / 2;
    const leftHalf = this.scene.add.image(this.x, this.y, textureKey);
    leftHalf.setDisplaySize(width, height);
    leftHalf.setCrop(0, 0, halfWidth, height);
    leftHalf.setDepth(this.depth + 2);
    const rightHalf = this.scene.add.image(this.x, this.y, textureKey);
    rightHalf.setDisplaySize(width, height);
    rightHalf.setCrop(halfWidth, 0, halfWidth, height);
    rightHalf.setDepth(this.depth + 2);
    return [leftHalf, rightHalf];
  }

  // fallback halves used when the texture is missing.
  // same size + depth as the real halves so motion looks identical.
  createFallbackHalves(width, height) {
    const halfWidth = width / 2;
    const leftHalf = this.scene.add.rectangle(this.x - halfWidth / 2, this.y, halfWidth, height, CARD_STYLE.fallbackPanelColor, 1);
    const rightHalf = this.scene.add.rectangle(this.x + halfWidth / 2, this.y, halfWidth, height, CARD_STYLE.fallbackPanelColor, 1);
    leftHalf.setDepth(this.depth + 2);
    rightHalf.setDepth(this.depth + 2);
    return [leftHalf, rightHalf];
  }

  // stable cache key for this card's texture.
  // duplicated with ProfileLoader.textureKeyFor on purpose - we never want
  // a circular import between objects/ and systems/.
  textureKey() {
    return `profile_${this.id}`;
  }
}