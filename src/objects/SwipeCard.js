// swipecard is a single draggable card that displays a profile image + text
// it handles rotation, position updates during drag, and throw animations

export class SwipeCard extends Phaser.GameObjects.Container {
  constructor(scene, x, y, profile) {
    super(scene, x, y);

    // profile data
    this.profile = profile;
    this.centerX = x;  // where the card naturally sits
    this.centerY = y;

    // drag tracking
    this.startX = 0;
    this.startY = 0;
    this.isDragging = false;

    // physics
    this.maxRotation = 45; // degrees

    // build the card visuals
    this.buildCard();
  }

  // create the image and text layers
  buildCard() {
    // validate profile data first
    if (!this.profile || !this.profile.imagePath) {
      console.error("profile data missing imagePath");
      return;
    }

    // image container (the background)
    const imageKey = this.profile.id; // use profile id as the image key
    this.imageSprite = this.scene.add.image(0, 0, imageKey);
    this.imageSprite.setDisplaySize(320, 480); // card size
    this.add(this.imageSprite);

    // text label at the bottom
    this.textLabel = this.scene.add.text(
      0,
      200,
      this.profile.name,
      {
        fontSize: "24px",
        color: "#ffffff",
        align: "center",
        wordWrap: { width: 300 },
      }
    );
    this.textLabel.setOrigin(0.5);
    this.textLabel.setShadow(2, 2, "#000000", 0.5);
    this.add(this.textLabel);

    // add to scene
    this.scene.add.existing(this);
    this.setDepth(20);
  }

  // move the card during a drag
  updateFromDrag(swipeData) {
    // swipeData has dragX, dragY, dragPercent (0 to 1)
    const { dragX, dragY, dragPercent } = swipeData;

    // update position
    this.x = this.centerX + dragX;
    this.y = this.centerY + dragY * 0.3; // less vertical movement

    // rotate based on horizontal drag (tinder-style)
    // dragX goes from -150 to +150, rotation goes from -45 to +45
    const rotationDegrees = (dragX / 150) * this.maxRotation;
    this.rotation = Phaser.Math.DegToRad(rotationDegrees);

    // fade opacity as you drag further (visual feedback)
    this.alpha = 1 - dragPercent * 0.2; // fade to 80% opacity at max drag
  }

  // snap back to center with animation
  snapBack() {
    // tween back to center
    this.scene.tweens.add({
      targets: this,
      x: this.centerX,
      y: this.centerY,
      rotation: 0,
      alpha: 1,
      duration: 300,
      ease: "Cubic.easeOut",
    });
  }

  // throw the card off screen (slash or hack direction)
  throw(direction) {
    const isSlash = direction === "slash";
    const targetX = isSlash ? this.scene.cameras.main.width + 200 : -200;
    const targetY = this.centerY - 300; // throw upward

    // tween to off-screen
    this.scene.tweens.add({
      targets: this,
      x: targetX,
      y: targetY,
      rotation: isSlash ? 0.8 : -0.8, // spin as it goes
      alpha: 0,
      duration: 400,
      ease: "Quad.easeIn",
      onComplete: () => {
        this.destroy();
      },
    });
  }

  // mark that we're dragging (called by scene's onSwipeStart)
  startDrag(pointerX, pointerY) {
    this.isDragging = true;
    this.startX = pointerX;
    this.startY = pointerY;
  }

  // stop dragging (called by scene's onSwipeEnd)
  stopDrag() {
    this.isDragging = false;
  }

  // static factory method to load and create a card
  static preload(scene, profile) {
    // load the image with profile id as key
    if (!scene.textures.exists(profile.id)) {
      scene.load.image(profile.id, profile.imagePath);
    }
  }

  // static factory to create a new card
  static create(scene, profile, x, y, depth) {
    // validate
    if (!profile || !profile.id || !profile.imagePath) {
      console.error("SwipeCard.create() requires valid profile with id and imagePath");
      return null;
    }

    const card = new SwipeCard(scene, x, y, profile);
    card.setDepth(depth);
    return card;
  }
}
