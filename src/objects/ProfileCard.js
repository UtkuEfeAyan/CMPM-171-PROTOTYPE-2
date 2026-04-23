import { CARD_CONFIG } from "../constants/swipeConfig.js";

export class ProfileCard extends Phaser.GameObjects.Container {
  /**
   * build one card container with image + text panel.
   * input is scene position profile and layout object.
   * this keeps render pieces grouped for easy motion/tween.
   */
  constructor(scene, x, y, profile, layout) {
    super(scene, x, y);
    this.profile = profile; // full data object from profiles.json
    this.layout = layout; // computed card size + split values from scene
    this.centerX = x; // home x position for snap and lerp target math
    this.centerY = y; // home y position for snap and lerp target math
    this.textureKey = `profile_${profile.id}`; // texture cache key for this profile image
    this.targetDragX = 0; // live drag offset on x axis from pointer input
    this.targetDragY = 0; // live drag offset on y axis from pointer input
    this.image = this.createCardImage(scene); // top 70 percent visual
    this.textPanel = this.createTextPanel(scene); // bottom 30 percent color block
    this.description = this.createDescription(scene); // wrapped text shown in panel
    this.add(this.image);
    this.add(this.textPanel);
    this.add(this.description);
    scene.add.existing(this); // register this container in phaser display list
    this.setDepth(CARD_CONFIG.depthTop); // default as top card unless manager restyles it
  }

  /**
   * create top image block for the 70 percent area.
   * input is scene, output is image game object.
   * this isolates card art sizing from scene code.
   */
  createCardImage(scene) {
    const image = scene.add.image(0, this.getImageCenterY(), this.textureKey);
    image.setDisplaySize(this.layout.cardWidth, this.layout.imageHeight);
    return image;
  }

  /**
   * create bottom panel for text readability.
   * input is scene, output is rectangle game object.
   * this gives stable contrast regardless of profile art.
   */
  createTextPanel(scene) {
    return scene.add.rectangle(0, this.getTextCenterY(), this.layout.cardWidth, this.layout.textHeight, 0xd90910, 1);
  }

  /**
   * create wrapped text description in bottom 30 percent.
   * input is scene, output is text game object.
   * this keeps profile info anchored and readable.
   */
  createDescription(scene) {
    const description = scene.add.text(0, this.getTextCenterY(), this.profile.text || this.profile.name, {
      fontSize: "20px",
      color: "#fff",
      align: "center",
      wordWrap: { width: this.layout.cardWidth * 0.88, useAdvancedWrap: true },
    });
    description.setOrigin(0.5, 0.5);
    return description;
  }

  /**
   * compute y center for top image region.
   * input is none, output is local y offset.
   * this enforces 70/30 split from layout values.
   */
  getImageCenterY() {
    return -this.layout.cardHeight / 2 + this.layout.imageHeight / 2;
  }

  /**
   * compute y center for bottom text region.
   * input is none, output is local y offset.
   * this keeps text in the dedicated lower zone.
   */
  getTextCenterY() {
    return this.layout.cardHeight / 2 - this.layout.textHeight / 2;
  }

  /**
   * update card internals after resize/layout recalculation.
   * input is new layout object, output is in-place updates.
   * this avoids destroying and recreating cards on resize.
   */
  applyLayout(layout) {
    this.layout = layout;
    this.image.setPosition(0, this.getImageCenterY());
    this.image.setDisplaySize(this.layout.cardWidth, this.layout.imageHeight);
    this.textPanel.setPosition(0, this.getTextCenterY());
    this.textPanel.setSize(this.layout.cardWidth, this.layout.textHeight);
    this.description.setPosition(0, this.getTextCenterY());
    this.description.setWordWrapWidth(this.layout.cardWidth * 0.88, true);
  }

  /**
   * store latest drag target from pointer movement.
   * input is drag offsets from start point.
   * this decouples input frequency from render smoothing.
   */
  setDragTarget(dragX, dragY) {
    this.targetDragX = dragX;
    this.targetDragY = dragY;
  }

  /**
   * run one lerp step toward target every frame.
   * input is none, output is updated position + tilt.
   * this is the main source of premium drag feel.
   */
  stepTowardsTarget() {
    const nextX = this.centerX + this.targetDragX; // where x would be with direct mapping
    const nextY = this.centerY + this.targetDragY * CARD_CONFIG.dragFollowY; // reduce vertical chase to keep swipe feel horizontal
    this.x += (nextX - this.x) * CARD_CONFIG.dragSmoothness; // lerp x: current + delta * smoothness
    this.y += (nextY - this.y) * CARD_CONFIG.dragSmoothness; // lerp y: same pattern with damped vertical follow
    this.updateRotationAndAlpha();
  }

  /**
   * map horizontal displacement into tilt and alpha.
   * input is implicit current x relative to center.
   * this gives quick visual feedback on swipe intent.
   */
  updateRotationAndAlpha() {
    const dragDistanceX = this.x - this.centerX; // signed distance from center line
    const mappedRotation = (dragDistanceX / CARD_CONFIG.rotationDivisor) * CARD_CONFIG.maxRotation; // convert distance into tilt amount
    this.rotation = Phaser.Math.Clamp(mappedRotation, -CARD_CONFIG.maxRotation, CARD_CONFIG.maxRotation); // cap tilt so card never over-rotates
    const mappedAlpha = 1.4 - Math.abs(dragDistanceX) / CARD_CONFIG.alphaRangePx; // fade card slightly as swipe commits
    this.alpha = Phaser.Math.Clamp(mappedAlpha, CARD_CONFIG.minAlpha, 1); // keep alpha in safe visible range
  }

  /**
   * animate grab feedback scale up/down.
   * input is grabbed boolean, output is tweened scale.
   * this helps players feel card pickup and release states.
   */
  setGrabState(isGrabbed) {
    const targetScale = isGrabbed ? CARD_CONFIG.grabScale : CARD_CONFIG.releaseScale;
    this.scene.tweens.killTweensOf(this);
    this.scene.tweens.add({ targets: this, scale: targetScale, duration: 110, ease: "Sine.easeOut" });
  }

  /**
   * clear drag target for spring reset path.
   * input none, output zeroed drag target.
   * this prevents stale drag vectors after release.
   */
  resetDragTarget() {
    this.targetDragX = 0;
    this.targetDragY = 0;
  }

  /**
   * style card as active foreground card.
   * input none, output active depth/scale pose.
   * this marks the only interactable slot.
   */
  setTopCardStyle() {
    this.setScale(CARD_CONFIG.releaseScale);
    this.setDepth(CARD_CONFIG.depthTop);
    this.y = this.centerY;
    this.alpha = 1;
    this.resetDragTarget();
  }

  /**
   * style card as pending/background card.
   * input none, output behind-card pose.
   * this keeps next texture visible and ready.
   */
  setBackCardStyle() {
    this.setScale(CARD_CONFIG.backScale);
    this.setDepth(CARD_CONFIG.depthBack);
    this.y = this.centerY;
    this.alpha = 1;
  }

  /**
   * play split animation used by slash resolve path.
   * input is completion callback, output is visual cut.
   * this separates slash feedback from scene logic.
   */
  playCutToPieces(onComplete) {
    const [leftPiece, rightPiece] = this.createCardPieces();
    this.alpha = 0;
    this.animatePieces(leftPiece, rightPiece, onComplete);
  }

  /**
   * create two temporary clones for split motion.
   * input none, output two image halves.
   * this preserves original art while animating fragments.
   */
  createCardPieces() {
    const leftPiece = this.scene.add.image(this.x, this.y, this.textureKey);
    const rightPiece = this.scene.add.image(this.x, this.y, this.textureKey);
    this.preparePiece(leftPiece, 0, this.layout.cardWidth / 2);
    this.preparePiece(rightPiece, this.layout.cardWidth / 2, this.layout.cardWidth / 2);
    return [leftPiece, rightPiece];
  }

  /**
   * crop one temporary piece to left/right half.
   * input is piece plus crop values.
   * this makes each fragment show only its side.
   */
  preparePiece(piece, cropX, cropWidth) {
    piece.setDisplaySize(this.layout.cardWidth, this.layout.cardHeight);
    piece.setCrop(cropX, 0, cropWidth, this.layout.cardHeight);
    piece.setDepth(CARD_CONFIG.depthTop + 2);
  }

  /**
   * run left and right fragment tweens together.
   * input is both pieces and completion callback.
   * this keeps slash timing compact and readable.
   */
  animatePieces(leftPiece, rightPiece, onComplete) {
    this.animateLeftPiece(leftPiece);
    this.animateRightPiece(rightPiece, onComplete);
  }

  /**
   * animate left fragment out and fade.
   * input is left piece, output destroy on complete.
   * this creates directional cut motion to the left.
   */
  animateLeftPiece(leftPiece) {
    this.scene.tweens.add({
      targets: leftPiece,
      x: this.x - CARD_CONFIG.fragmentPushX,
      y: this.y + CARD_CONFIG.fragmentFallY,
      rotation: -CARD_CONFIG.fragmentRotate,
      alpha: 0,
      duration: CARD_CONFIG.fragmentTweenMs,
      onComplete: () => leftPiece.destroy(),
    });
  }

  /**
   * animate right fragment out and fade.
   * input is right piece and completion callback.
   * this completes the split and resumes game flow.
   */
  animateRightPiece(rightPiece, onComplete) {
    this.scene.tweens.add({
      targets: rightPiece,
      x: this.x + CARD_CONFIG.fragmentPushX,
      y: this.y + CARD_CONFIG.fragmentFallY,
      rotation: CARD_CONFIG.fragmentRotate,
      alpha: 0,
      duration: CARD_CONFIG.fragmentTweenMs,
      onComplete: () => this.finishPieceCut(rightPiece, onComplete),
    });
  }

  /**
   * cleanup final fragment and invoke continuation.
   * input is right piece and callback.
   * this keeps slash completion behavior centralized.
   */
  finishPieceCut(rightPiece, onComplete) {
    rightPiece.destroy();
    onComplete?.();
  }

  /**
   * queue profile texture only if missing in cache.
   * input is scene and profile data.
   * this avoids duplicate loader work and race noise.
   */
  static preload(scene, profile) {
    const textureKey = `profile_${profile.id}`;
    if (scene.textures.exists(textureKey)) return;
    scene.load.image(textureKey, profile.imagePath);
  }

  /**
   * factory helper for consistent card creation signature.
   * input is scene profile position and layout.
   * this keeps scene and manager code short.
   */
  static create(scene, profile, x, y, layout) {
    return new ProfileCard(scene, x, y, profile, layout);
  }
}
