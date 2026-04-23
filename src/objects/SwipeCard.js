import { CARD_CONFIG } from "../constants/swipeConfig.js";

export class SwipeCard extends Phaser.GameObjects.Container {
  // build one swipe card container with image + title
  constructor(scene, x, y, profile, layout) {
    super(scene, x, y);
    this.profile = profile;
    this.layout = layout;
    this.centerX = x;
    this.centerY = y;
    this.textureKey = `profile_${profile.id}`;
    this.targetDragX = 0;
    this.targetDragY = 0;
    this.panel = this.createTextPanel(scene);
    this.image = this.createCardImage(scene);
    this.title = this.createCardTitle(scene);
    // keep image and title in one container so drag/tween affects both
    this.add(this.panel);
    this.add(this.image);
    this.add(this.title);

    scene.add.existing(this);
    this.setDepth(CARD_CONFIG.depthTop);
  }

  // create the profile image node for this card
  createCardImage(scene) {
    const image = scene.add.image(0, 0, this.textureKey);
    image.setDisplaySize(this.layout.cardWidth, this.layout.imageHeight);
    image.setPosition(0, this.getImageCenterY());
    return image;
  }

  // create the bottom text background panel
  createTextPanel(scene) {
    return scene.add.rectangle(0, this.getTextCenterY(), this.layout.cardWidth, this.layout.textHeight, 0xd90910, 1);
  }

  // create the profile title text under the image
  createCardTitle(scene) {
    const title = scene.add.text(0, this.getTextCenterY(), this.profile.text || this.profile.name, {
      fontSize: "20px",
      color: "#fff",
      align: "center",
      wordWrap: { width: this.layout.cardWidth * 0.88, useAdvancedWrap: true },
    });
    title.setOrigin(0.5, 0.5);
    return title;
  }

  // image should fill top 70 percent
  getImageCenterY() {
    return -this.layout.cardHeight / 2 + this.layout.imageHeight / 2;
  }

  // text should fill bottom 30 percent
  getTextCenterY() {
    return this.layout.cardHeight / 2 - this.layout.textHeight / 2;
  }

  // resize card regions when viewport or frame bounds change
  applyLayout(layout) {
    this.layout = layout;
    this.image.setDisplaySize(this.layout.cardWidth, this.layout.imageHeight);
    this.image.setPosition(0, this.getImageCenterY());
    this.panel.setSize(this.layout.cardWidth, this.layout.textHeight);
    this.panel.setPosition(0, this.getTextCenterY());
    this.title.setPosition(0, this.getTextCenterY());
    this.title.setWordWrapWidth(this.layout.cardWidth * 0.88, true);
  }

  // store the latest drag target from input
  setDragTarget(dragX, dragY) {
    this.targetDragX = dragX;
    this.targetDragY = dragY;
  }

  // move a small step toward target each frame for smooth feel
  stepTowardsTarget() {
    const nextX = this.centerX + this.targetDragX;
    const nextY = this.centerY + this.targetDragY * CARD_CONFIG.dragFollowY;
    this.x += (nextX - this.x) * CARD_CONFIG.dragSmoothness;
    this.y += (nextY - this.y) * CARD_CONFIG.dragSmoothness;
    this.updateRotationAndAlpha();
  }

  // map horizontal offset into rotation and transparency feedback
  updateRotationAndAlpha() {
    const dragDistanceX = this.x - this.centerX;
    const mappedRotation = (dragDistanceX / CARD_CONFIG.rotationDivisor) * CARD_CONFIG.maxRotation;
    this.rotation = Phaser.Math.Clamp(mappedRotation, -CARD_CONFIG.maxRotation, CARD_CONFIG.maxRotation);
    const mappedAlpha = 1.4 - Math.abs(dragDistanceX) / CARD_CONFIG.alphaRangePx;
    this.alpha = Phaser.Math.Clamp(mappedAlpha, CARD_CONFIG.minAlpha, 1);
  }

  // small scale bump when card is grabbed or released
  setGrabState(isGrabbed) {
    const targetScale = isGrabbed ? CARD_CONFIG.grabScale : CARD_CONFIG.releaseScale;
    this.scene.tweens.killTweensOf(this);
    this.scene.tweens.add({
      targets: this,
      scale: targetScale,
      duration: 110,
      ease: "Sine.easeOut",
    });
  }

  // clear drag target so card recenters cleanly
  resetDragTarget() {
    this.targetDragX = 0;
    this.targetDragY = 0;
  }

  // apply style for the preview card behind the top card
  setBackCardStyle() {
    this.setScale(CARD_CONFIG.backScale);
    this.setDepth(CARD_CONFIG.depthBack);
    this.y = this.centerY;
    this.alpha = 1;
  }

  // apply style for the active top card
  setTopCardStyle() {
    this.setScale(CARD_CONFIG.releaseScale);
    this.setDepth(CARD_CONFIG.depthTop);
    this.y = this.centerY;
    this.alpha = 1;
    this.resetDragTarget();
  }

  // trigger split animation after slash is confirmed
  playCutToPieces(onComplete) {
    // hide the original card, then animate two cropped halves out
    const [leftPiece, rightPiece] = this.createCardPieces();
    this.alpha = 0;
    this.animatePieces(leftPiece, rightPiece, onComplete);
  }

  // clone two image pieces so we can animate left/right halves
  createCardPieces() {
    const leftPiece = this.scene.add.image(this.x, this.y, this.textureKey);
    const rightPiece = this.scene.add.image(this.x, this.y, this.textureKey);
    this.preparePiece(leftPiece, 0, this.layout.cardWidth / 2);
    this.preparePiece(rightPiece, this.layout.cardWidth / 2, this.layout.cardWidth / 2);
    return [leftPiece, rightPiece];
  }

  // crop one piece to a half of the original card
  preparePiece(piece, cropX, cropWidth) {
    // crop each cloned image so one becomes left half and one right half
    piece.setDisplaySize(this.layout.cardWidth, this.layout.cardHeight);
    piece.setCrop(cropX, 0, cropWidth, this.layout.cardHeight);
    piece.setDepth(CARD_CONFIG.depthTop + 2);
  }

  // run both piece tweens together
  animatePieces(leftPiece, rightPiece, onComplete) {
    this.animateLeftPiece(leftPiece);
    this.animateRightPiece(rightPiece, onComplete);
  }

  // send left half down-left with fade
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

  // send right half down-right with fade
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

  // cleanup final split piece and continue flow
  finishPieceCut(rightPiece, onComplete) {
    rightPiece.destroy();
    onComplete?.();
  }

  // queue card texture if this profile is not loaded yet
  static preload(scene, profile) {
    // only queue texture if missing so we avoid duplicate loader work
    const textureKey = `profile_${profile.id}`;
    if (!scene.textures.exists(textureKey)) {
      scene.load.image(textureKey, profile.imagePath);
    }
  }

  // helper factory so scene code stays tidy
  static create(scene, profile, x, y, layout) {
    return new SwipeCard(scene, x, y, profile, layout);
  }
}
