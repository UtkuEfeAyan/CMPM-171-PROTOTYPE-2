import { CARD_CONFIG, LAYOUT_CONFIG } from "../constants/swipeConfig.js";

// one card in the swiper deck.
// renders a 70/30 split (image on top, text on bottom) inside a phaser container
// so every transform (drag, tilt, fade, split) affects the whole card as a unit.
export class ProfileCard extends Phaser.GameObjects.Container {
  /**
   * build one card positioned at (x, y) using profile data and a bounds box.
   * input: scene reference, home position, profile object, layout bounds.
   * this constructor creates all visuals in one pass (initLayout) so the
   * scene stays minimal and only calls new ProfileCard(...) per card.
   */
  constructor(scene, x, y, profile, bounds) {
    super(scene, x, y);
    this.id = profile.id; // expose id so logic layer can record hacks by id
    this.profile = profile; // full profile data (name, text, targetSceneKey)
    this.bounds = bounds; // { width, height } card size from scene layout
    this.centerX = x; // rest x used by spring-back tween
    this.centerY = y; // rest y used by spring-back tween
    this.initLayout();
    scene.add.existing(this);
  }

  /**
   * create the 70/30 split visuals in a single method.
   * input: nothing (reads this.bounds and this.profile).
   * this keeps layout math in one place so resizes and tweaks are easy.
   */
  initLayout() {
    const { width, height } = this.bounds;
    const textureKey = `profile_${this.id}`;

    // top 70%: profile photo, anchored at the upper-center of the card.
    // y offset = -height*0.15 puts its center in the top 70% area.
    this.image = this.scene.add
      .image(0, -height * 0.15, textureKey)
      .setDisplaySize(width, height * LAYOUT_CONFIG.imageRatio);

    // bottom 30%: red text panel used as a solid contrast backdrop.
    // centered at height*0.35 (midpoint of the bottom third).
    this.textPanel = this.scene.add.rectangle(
      0,
      height * 0.35,
      width,
      height * LAYOUT_CONFIG.textRatio,
      0xd90910,
      1
    );

    // name line shown first in the panel.
    this.nameText = this.scene.add
      .text(0, height * 0.3, this.profile.name || "", {
        fontSize: "22px",
        color: "#ffffff",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    // description line wrapped to fit inside the panel width.
    this.descText = this.scene.add
      .text(0, height * 0.4, this.profile.text || "", {
        fontSize: "14px",
        color: "#ffffff",
        align: "center",
        wordWrap: { width: width * 0.88, useAdvancedWrap: true },
      })
      .setOrigin(0.5);

    this.add([this.image, this.textPanel, this.nameText, this.descText]);
  }

  /**
   * reflow all child visuals to match a new bounds box.
   * input: { width, height } matching the scene's new card size.
   * output: image/panel/text get repositioned and resized in-place.
   * this is called by the scene on window resize so the deck keeps
   * the right proportions without destroying and rebuilding cards.
   */
  applyLayout(newBounds) {
    this.bounds = newBounds;
    const { width, height } = newBounds;

    // top image: same 70% ratio + same y-anchor math as initLayout.
    this.image.setPosition(0, -height * 0.15);
    this.image.setDisplaySize(width, height * LAYOUT_CONFIG.imageRatio);

    // bottom panel: rebuild size so the rect matches the new card width/height.
    this.textPanel.setPosition(0, height * 0.35);
    this.textPanel.setSize(width, height * LAYOUT_CONFIG.textRatio);

    // name + description: keep their positions inside the panel and
    // update the description wrap width so long text reflows cleanly.
    this.nameText.setPosition(0, height * 0.3);
    this.descText.setPosition(0, height * 0.4);
    this.descText.setWordWrapWidth(width * 0.88, true);
  }

  /**
   * unified tween helper that returns a promise.
   * input: tween props, duration, ease. output: resolves when tween finishes.
   * this is the ONLY animation entry point for the scene/logic layer,
   * so every swipe/snap/throw uses the same predictable shape.
   */
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

  /**
   * quick grab feedback: scales the card slightly up/down.
   * input: boolean. output: tweened scale change.
   * separated from animate() because it is a tiny juice effect, not a commit.
   */
  setGrabState(isGrabbed) {
    this.scene.tweens.killTweensOf(this);
    const targetScale = isGrabbed ? CARD_CONFIG.grabScale : CARD_CONFIG.releaseScale;
    this.scene.tweens.add({
      targets: this,
      scale: targetScale,
      duration: 110,
      ease: "Sine.easeOut",
    });
  }

  /**
   * slash animation: cuts the card texture into two halves that fly apart.
   * input: none. output: promise that resolves when both halves finish.
   * this is the slash "commit" visual, so logic can await it before promoting.
   */
  playSlashAnimation() {
    return new Promise((resolve) => {
      const [leftHalf, rightHalf] = this.createSlashHalves();
      this.alpha = 0; // hide original card so halves are the only visible art

      // left half flies left + down with negative rotation.
      this.scene.tweens.add({
        targets: leftHalf,
        x: this.x - CARD_CONFIG.fragmentPushX,
        y: this.y + CARD_CONFIG.fragmentFallY,
        rotation: -CARD_CONFIG.fragmentRotate,
        alpha: 0,
        duration: CARD_CONFIG.fragmentTweenMs,
        onComplete: () => leftHalf.destroy(),
      });

      // right half flies right + down with positive rotation.
      // resolves the promise on the last tween so logic continues in order.
      this.scene.tweens.add({
        targets: rightHalf,
        x: this.x + CARD_CONFIG.fragmentPushX,
        y: this.y + CARD_CONFIG.fragmentFallY,
        rotation: CARD_CONFIG.fragmentRotate,
        alpha: 0,
        duration: CARD_CONFIG.fragmentTweenMs,
        onComplete: () => {
          rightHalf.destroy();
          resolve();
        },
      });
    });
  }

  /**
   * helper: create two cropped image copies representing the card halves.
   * input: none. output: [leftHalf, rightHalf] image game objects.
   * separated so playSlashAnimation stays short and focused on tweens.
   */
  createSlashHalves() {
    const { width, height } = this.bounds;
    const textureKey = `profile_${this.id}`;
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
}
