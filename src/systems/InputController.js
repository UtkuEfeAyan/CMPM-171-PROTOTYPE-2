// inputcontroller handles mouse/touch input and turns it into swipe gestures
// tracks pointer movement and figures out if you're trying to slash or hack

export class InputController extends Phaser.Events.EventEmitter {
  constructor(scene) {
    super();
    this.scene = scene;
    this.isInputBlocked = false; // set to true when animations are playing

    // track where the pointer started and where it is now
    this.isDragging = false;
    this.dragStartX = 0;
    this.dragStartY = 0;
    this.dragStartTime = 0;

    // how far you need to drag to count as a swipe (in pixels)
    this.SWIPE_THRESHOLD = 80;
    this.SWIPE_MAX = 150;

    this.setupPointerInput();
    this.setupKeyboardInput();
  }

  // listen for mouse/touch events
  setupPointerInput() {
    this.scene.input.on("pointerdown", this.onPointerDown, this);
    this.scene.input.on("pointermove", this.onPointerMove, this);
    this.scene.input.on("pointerup", this.onPointerUp, this);
  }

  // listen for keyboard input (a for hack, d for slash)
  setupKeyboardInput() {
    this.scene.input.keyboard.on("keydown", (event) => {
      const key = event.key.toUpperCase();

      if (key === "A" && !this.isInputBlocked) {
        this.triggerKeyboardSwipe("hack");
      }

      if (key === "D" && !this.isInputBlocked) {
        this.triggerKeyboardSwipe("slash");
      }
    });
  }

  // pointer just went down, start tracking
  onPointerDown(pointer) {
    if (this.isInputBlocked) return;

    this.isDragging = true;
    this.dragStartX = pointer.x;
    this.dragStartY = pointer.y;
    this.dragStartTime = this.scene.time.now;

    this.emit("onSwipeStart", { x: pointer.x, y: pointer.y });
  }

  // pointer is moving, update the card position
  onPointerMove(pointer) {
    if (!this.isDragging || this.isInputBlocked) return;

    const dragX = pointer.x - this.dragStartX;
    const dragY = pointer.y - this.dragStartY;
    const distance = Math.sqrt(dragX * dragX + dragY * dragY);

    // how far along the swipe are we (0 to 1)
    const dragPercent = Math.min(distance / this.SWIPE_MAX, 1.0);

    this.emit("onSwipeMove", {
      dragX,
      dragY,
      distance,
      dragPercent,
    });
  }

  // pointer went up, figure out if it was a swipe
  onPointerUp(pointer) {
    if (!this.isDragging) return;

    this.isDragging = false;

    const dragX = pointer.x - this.dragStartX;
    const dragY = pointer.y - this.dragStartY;
    const distance = Math.sqrt(dragX * dragX + dragY * dragY);

    // figure out how fast you were dragging
    const dragTime = (this.scene.time.now - this.dragStartTime) / 1000;
    const velocity = dragTime > 0 ? distance / dragTime : 0;

    const swipeData = this.detectSwipe(dragX, velocity);
    this.emit("onSwipeEnd", swipeData);
  }

  // decide if this drag was a slash, hack, or just a snap back
  detectSwipe(dragX, velocity) {
    // right swipe = slash
    if (dragX > this.SWIPE_THRESHOLD) {
      return { direction: "slash", velocity, dragX };
    }

    // left swipe = hack
    if (dragX < -this.SWIPE_THRESHOLD) {
      return { direction: "hack", velocity, dragX };
    }

    // didn't drag far enough, snap back
    return { direction: "none", velocity, dragX };
  }

  // keyboard shortcut to trigger a swipe (for testing)
  triggerKeyboardSwipe(direction) {
    this.emit("onSwipeEnd", {
      direction,
      velocity: 500,
      dragX: direction === "slash" ? 150 : -150,
      isKeyboardTriggered: true,
    });
  }

  // block input during animations
  setInputBlocked(blocked) {
    this.isInputBlocked = blocked;
  }

  // check if input is blocked
  isBlocked() {
    return this.isInputBlocked;
  }

  // clean up when done
  destroy() {
    this.scene.input.off("pointerdown", this.onPointerDown, this);
    this.scene.input.off("pointermove", this.onPointerMove, this);
    this.scene.input.off("pointerup", this.onPointerUp, this);
    this.removeAllListeners();
  }
}
