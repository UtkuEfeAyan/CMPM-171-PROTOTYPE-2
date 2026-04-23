import { SCENE_CONFIG, SWIPE_DIRECTIONS, SWIPE_EVENTS } from "../constants/swipeConfig.js";

export class InputController extends Phaser.Events.EventEmitter {
  // set input state and bind callbacks once
  constructor(scene) {
    super();
    this.scene = scene;
    this.isEnabled = true;
    this.isDragging = false;
    this.hasCrossedDeadZone = false;
    this.dragStartX = 0;
    this.dragStartY = 0;
    this.onPointerDown = (pointer) => this.handlePointerDown(pointer); // saved refs let destroy() unbind exact callbacks
    this.onPointerMove = (pointer) => this.handlePointerMove(pointer); // same callback identity required by phaser off()
    this.onPointerUp = (pointer) => this.handlePointerUp(pointer); // keeps input lifecycle leak-free
    this.onKeyDown = (event) => this.handleKeyDown(event);
    // bind once in constructor so destroy can remove exact same handlers
    this.bindInputEvents();
  }

  // hook pointer + keyboard listeners to the scene input system
  bindInputEvents() {
    this.scene.input.on("pointerdown", this.onPointerDown);
    this.scene.input.on("pointermove", this.onPointerMove);
    this.scene.input.on("pointerup", this.onPointerUp);
    this.scene.input.keyboard?.on("keydown", this.onKeyDown);
  }

  // mark drag start anchor when pointer goes down
  handlePointerDown(pointer) {
    if (!this.isEnabled) return;
    // remember where swipe started so we can measure horizontal intent
    this.isDragging = true;
    this.hasCrossedDeadZone = false;
    this.dragStartX = pointer.x; // drag anchor x used for distance math
    this.dragStartY = pointer.y; // drag anchor y used for dead-zone check
  }

  // emit drag movement only after crossing tiny dead zone
  handlePointerMove(pointer) {
    if (!this.isDragging || !this.isEnabled) return;
    const dragX = pointer.x - this.dragStartX; // positive means dragging to right side
    const dragY = pointer.y - this.dragStartY; // signed y offset from drag start point
    if (!this.hasCrossedDeadZone && !this.isPastDragDeadZone(dragX, dragY)) return;
    if (!this.hasCrossedDeadZone) {
      this.hasCrossedDeadZone = true;
      this.emit(SWIPE_EVENTS.DRAG_START);
    }
    // while dragging, scene gets live deltas for card follow animation
    this.emit(SWIPE_EVENTS.MOVE, { dragX, dragY });
  }

  // finish drag and decide slash/hack/none based on x distance
  handlePointerUp(pointer) {
    if (!this.isDragging) return;
    // if input gets locked during drag, clear state and skip swipe emit
    if (!this.isEnabled) {
      this.isDragging = false;
      this.hasCrossedDeadZone = false;
      return;
    }
    this.isDragging = false;
    const dragX = pointer.x - this.dragStartX; // final x distance decides slash/hack/none
    if (this.hasCrossedDeadZone) {
      this.emit(SWIPE_EVENTS.DRAG_END);
    }
    this.hasCrossedDeadZone = false;
    this.emitSwipeDecision(dragX);
  }

  // prevent tiny jitter from being treated as real drag
  isPastDragDeadZone(dragX, dragY) {
    const dragDistance = Math.hypot(dragX, dragY);
    return dragDistance >= SCENE_CONFIG.dragDeadZonePx;
  }

  // compare drag with threshold and emit swipe direction
  emitSwipeDecision(dragX) {
    // right swipe => slash, left swipe => hack, short swipe => snap back
    if (dragX > SCENE_CONFIG.swipeThreshold) return this.emitSwipe(SWIPE_DIRECTIONS.SLASH);
    if (dragX < -SCENE_CONFIG.swipeThreshold) return this.emitSwipe(SWIPE_DIRECTIONS.HACK);
    return this.emitSwipe(SWIPE_DIRECTIONS.NONE);
  }

  // shared helper to emit swipe end payload
  emitSwipe(direction) {
    this.emit(SWIPE_EVENTS.END, { direction }); // unified payload shape for scene swipe resolver
  }

  // desktop parity: a hack, d slash, w/s snapback
  handleKeyDown(event) {
    if (!this.isEnabled) return;
    // wasd parity: a=hack d=slash w/s=cancel-like snap
    const key = event.key.toLowerCase();
    if (key === "a") return this.emitSwipe(SWIPE_DIRECTIONS.HACK);
    if (key === "d") return this.emitSwipe(SWIPE_DIRECTIONS.SLASH);
    if (key === "w" || key === "s") return this.emitSwipe(SWIPE_DIRECTIONS.NONE);
  }

  // globally enable/disable input while animations run
  setEnabled(isEnabled) {
    this.isEnabled = isEnabled;
  }

  // remove all bound listeners when scene is destroyed
  destroy() {
    // explicit unbind avoids leaking listeners if scene gets recreated
    this.scene.input.off("pointerdown", this.onPointerDown);
    this.scene.input.off("pointermove", this.onPointerMove);
    this.scene.input.off("pointerup", this.onPointerUp);
    this.scene.input.keyboard?.off("keydown", this.onKeyDown);
  }
}
