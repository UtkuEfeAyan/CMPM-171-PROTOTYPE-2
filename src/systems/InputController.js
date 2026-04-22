// super simple input - just track drag and detect swipe direction

export class InputController extends Phaser.Events.EventEmitter {
  constructor(scene) {
    super();
    this.scene = scene;
    this.isInputBlocked = false;
    this.isDragging = false;
    this.dragStartX = 0;
    this.dragStartY = 0;
    this.THRESHOLD = 80; // pixels to swipe
    
    console.log("[InputController] created");
    
    this.scene.input.on("pointerdown", (p) => this.onDown(p), this);
    this.scene.input.on("pointermove", (p) => this.onMove(p), this);
    this.scene.input.on("pointerup", (p) => this.onUp(p), this);

    // keyboard for testing
    this.scene.input.keyboard.on("keydown", (e) => {
      if (e.key === "a" || e.key === "A") {
        console.log("[InputController] key A pressed");
        this.emit("onSwipeEnd", { direction: "hack" });
      }
      if (e.key === "d" || e.key === "D") {
        console.log("[InputController] key D pressed");
        this.emit("onSwipeEnd", { direction: "slash" });
      }
    });
  }

  onDown(pointer) {
    if (this.isInputBlocked) return;
    console.log("[InputController] drag start");
    this.isDragging = true;
    this.dragStartX = pointer.x;
    this.dragStartY = pointer.y;
  }

  onMove(pointer) {
    if (!this.isDragging || this.isInputBlocked) return;
    const dragX = pointer.x - this.dragStartX;
    const dragY = pointer.y - this.dragStartY;
    this.emit("onSwipeMove", { dragX, dragY });
  }

  onUp(pointer) {
    if (!this.isDragging) return;
    this.isDragging = false;
    
    const dragX = pointer.x - this.dragStartX;
    console.log(`[InputController] drag end: dragX=${dragX}`);

    if (dragX > this.THRESHOLD) {
      console.log("[InputController] detected SLASH");
      this.emit("onSwipeEnd", { direction: "slash" });
    } else if (dragX < -this.THRESHOLD) {
      console.log("[InputController] detected HACK");
      this.emit("onSwipeEnd", { direction: "hack" });
    } else {
      console.log("[InputController] drag too short, snap back");
      this.emit("onSwipeEnd", { direction: "none" });
    }
  }

  setInputBlocked(blocked) {
    console.log(`[InputController] input blocked: ${blocked}`);
    this.isInputBlocked = blocked;
  }

  destroy() {
    this.scene.input.off("pointerdown");
    this.scene.input.off("pointermove");
    this.scene.input.off("pointerup");
  }
}
