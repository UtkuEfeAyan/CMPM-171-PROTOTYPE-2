// super simple card - just image + text, position updates

export class SwipeCard extends Phaser.GameObjects.Container {
  constructor(scene, x, y, profile) {
    super(scene, x, y);
    this.profile = profile;
    this.centerX = x;
    this.centerY = y;
    
    console.log(`[SwipeCard] created: ${profile.id}`);

    // image
    const img = scene.add.image(0, 0, profile.id);
    img.setDisplaySize(320, 480);
    this.add(img);

    // text
    const txt = scene.add.text(0, 200, profile.name, {
      fontSize: "24px",
      color: "#fff",
      align: "center",
    });
    txt.setOrigin(0.5);
    this.add(txt);

    scene.add.existing(this);
    this.setDepth(20);
  }

  // update position during drag
  updateFromDrag(dragX, dragY) {
    this.x = this.centerX + dragX;
    this.y = this.centerY + dragY * 0.2;
    this.rotation = (dragX / 150) * 0.8;
  }

  static preload(scene, profile) {
    if (!scene.textures.exists(profile.id)) {
      scene.load.image(profile.id, profile.imagePath);
    }
  }

  static create(scene, profile, x, y) {
    return new SwipeCard(scene, x, y, profile);
  }
}
