import { ProfileLoader } from "../systems/ProfileLoader.js";
import { PersistenceManager } from "../systems/PersistenceManager.js";
import { BACKGROUND_CONFIG, STORAGE_CONFIG } from "../constants/swipeConfig.js";

// gallery scene for hacked profiles. owns its own logic on purpose so the
// "find why a portrait moves / clicks" answer is right here in the scene.
//
// data flow:
//   PersistenceManager.getHackedCardIDs() -> ids hacked this session
//   ProfileLoader.getValidProfiles()      -> full profile objects
//   filtered hacked profiles              -> 3-column grid of portraits
//
// scrolling: simple manual y-shift on this.gridContainer; mouse wheel +
// pointer drag both feed the same clamp.
export class StorageScene extends Phaser.Scene {
  constructor() {
    super({ key: "Storage" });
    this.backgroundImage = null;
    this.backgroundDisplayWidth = 0; // displayed bg width after fit-scaling
    this.backgroundDisplayHeight = 0; // displayed bg height after fit-scaling
    this.backBtn = null;
    this.titleText = null;
    this.gridContainer = null; // wrapper that gets shifted on scroll
    this.gridRestY = 0; // resting y for gridContainer (top of inner screen + pad)
    this.emptyText = null;
    this.hackedProfiles = []; // filtered list, in deck order
    this.totalRows = 0; // grid rows (used for scroll clamp math)
    this.scrollMinY = 0; // clamp lower bound for gridContainer.y
    this.scrollMaxY = 0; // clamp upper bound (rest position)
    this.isDraggingBackground = false;
    this.dragLastY = 0;
    this.wheelHandler = null;
    this.pointerDownHandler = null;
    this.pointerMoveHandler = null;
    this.pointerUpHandler = null;
    this.resizeHandler = null;
  }

  // preload: profiles json + the shared phone background. portrait textures
  // are loaded on-demand inside create() via ProfileLoader.loadBatch.
  preload() {
    ProfileLoader.preloadJson(this);
    if (!this.textures.exists(BACKGROUND_CONFIG.phoneTextureKey)) {
      this.load.image(BACKGROUND_CONFIG.phoneTextureKey, BACKGROUND_CONFIG.phoneImagePath);
    }
  }

  // create wires up background, header, and either the grid or the empty
  // state. textures for the hacked subset are loaded first so portraits
  // never render as broken white boxes.
  async create() {
    this.setupBackground();
    this.setupHeader();
    this.bindSceneLifecycle();

    this.hackedProfiles = this.collectHackedProfiles();

    if (this.hackedProfiles.length === 0) {
      this.showEmptyState();
      return;
    }

    await ProfileLoader.loadBatch(this, this.hackedProfiles, 0, this.hackedProfiles.length);
    this.buildGrid();
    this.bindScrollHandlers();
  }

  // blurred phone bg, identical treatment to SwipeDeckScene: fit-scaled
  // (Math.min) so the phone frame keeps its native aspect ratio and we
  // letterbox any extra camera space rather than stretching.
  setupBackground() {
    if (!this.textures.exists(BACKGROUND_CONFIG.phoneTextureKey)) return;
    const camera = this.cameras.main;
    this.backgroundImage = this.add
      .image(camera.width / 2, camera.height / 2, BACKGROUND_CONFIG.phoneTextureKey)
      .setDepth(BACKGROUND_CONFIG.depth);
    this.fitBackground();
  }

  // recompute bg scale + position for the current camera size.
  // also caches the displayed bg dims so getInnerScreenRect can place the
  // grid relative to the visible phone screen.
  fitBackground() {
    if (!this.backgroundImage) return;
    const camera = this.cameras.main;
    const source = this.backgroundImage.texture.getSourceImage();
    const baseWidth = source.width;
    const baseHeight = source.height;
    if (baseWidth <= 0 || baseHeight <= 0) return;
    const scale = Math.min(camera.width / baseWidth, camera.height / baseHeight);
    this.backgroundImage.setScale(scale);
    this.backgroundImage.setPosition(camera.width / 2, camera.height / 2);
    this.backgroundDisplayWidth = baseWidth * scale;
    this.backgroundDisplayHeight = baseHeight * scale;
  }

  // returns the visible "screen" rectangle inside the phone art, in camera
  // coords. used by buildGrid + empty-state to keep storage content inside
  // the phone bezels.
  // falls back to camera dims if the bg hasn't been fit yet.
  getInnerScreenRect() {
    const camera = this.cameras.main;
    const bgW = this.backgroundDisplayWidth > 0 ? this.backgroundDisplayWidth : camera.width;
    const bgH = this.backgroundDisplayHeight > 0 ? this.backgroundDisplayHeight : camera.height;
    const width = bgW * BACKGROUND_CONFIG.innerScreenWidthPct;
    const height = bgH * BACKGROUND_CONFIG.innerScreenHeightPct;
    const centerX = camera.width / 2;
    const centerY = camera.height / 2 + bgH * BACKGROUND_CONFIG.innerScreenCenterYOffsetPct;
    return {
      width,
      height,
      centerX,
      centerY,
      left: centerX - width / 2,
      top: centerY - height / 2,
    };
  }

  // top header: scene title + back button.
  // back button mirrors the "Collection" button on SwipeDeckScene visually.
  setupHeader() {
    this.backBtn = this.add
      .text(20, 20, "< Back", {
        fontSize: "18px",
        color: "#ffffff",
        backgroundColor: "#222a",
        padding: { x: 12, y: 8 },
      })
      .setDepth(100)
      .setInteractive({ useHandCursor: true });
    // stop self + wake the deck instead of scene.start: the deck has been
    // sleeping in memory since we launched, so wake() resumes it on the
    // exact same card with the same animation/state.
    this.backBtn.on("pointerup", () => {
      this.scene.stop();
      this.scene.wake("SwipeDeck");
    });

    const camera = this.cameras.main;
    this.titleText = this.add
      .text(camera.width / 2, 30, "Hacked Profiles", {
        fontSize: "22px",
        color: "#ffffff",
        fontStyle: "bold",
      })
      .setOrigin(0.5, 0.5)
      .setDepth(100);
  }

  // intersect deck profiles with the hacked id set.
  // returns profiles in their original deck order so the grid is stable
  // across visits (instead of "most recently hacked first" which would jitter).
  collectHackedProfiles() {
    const allProfiles = ProfileLoader.getValidProfiles(this);
    if (allProfiles.length === 0) return [];
    const hackedIds = PersistenceManager.getHackedCardIDs();
    if (hackedIds.length === 0) return [];
    const idLookup = new Set(hackedIds);
    return allProfiles.filter((profile) => idLookup.has(Number(profile.id)));
  }

  // 3-column grid built into a single container so we can move it with one
  // y-shift when scrolling. the container is anchored to the top-left of
  // the phone's INNER screen rect, so all per-cell math is local (no
  // camera-relative offsets needed).
  //
  // grid math (the part future humans need to read):
  //   column = index % columns        -> 0,1,2,0,1,2,...
  //   row    = floor(index / columns) -> 0,0,0,1,1,1,...
  //   x = (column + 0.5) * cellWidth   (centered in its cell)
  //   y = (row    + 0.5) * cellHeight  (centered in its cell)
  buildGrid() {
    const screen = this.getInnerScreenRect();
    const cellWidth = screen.width / STORAGE_CONFIG.columns;
    this.gridRestY = screen.top + STORAGE_CONFIG.gridTopPad;

    this.gridContainer = this.add.container(screen.left, this.gridRestY);
    this.gridContainer.setDepth(10);

    for (let i = 0; i < this.hackedProfiles.length; i += 1) {
      const profile = this.hackedProfiles[i];
      const column = i % STORAGE_CONFIG.columns;
      const row = Math.floor(i / STORAGE_CONFIG.columns);
      const x = (column + 0.5) * cellWidth;
      const y = (row + 0.5) * STORAGE_CONFIG.cellHeight;

      const portrait = this.createPortrait(profile, x, y);
      this.gridContainer.add(portrait);
    }

    this.totalRows = Math.ceil(this.hackedProfiles.length / STORAGE_CONFIG.columns);
    this.recomputeScrollBounds();
  }

  // build one clickable portrait for the grid.
  // texture key may not be loaded yet (loadBatch failed for that asset);
  // fall back to a colored rectangle so the cell is never empty.
  createPortrait(profile, x, y) {
    const textureKey = ProfileLoader.textureKeyFor(profile);
    let portrait;
    if (this.textures.exists(textureKey)) {
      portrait = this.add.image(x, y, textureKey);
      portrait.setDisplaySize(STORAGE_CONFIG.portraitWidth, STORAGE_CONFIG.portraitHeight);
    } else {
      portrait = this.add.rectangle(
        x,
        y,
        STORAGE_CONFIG.portraitWidth,
        STORAGE_CONFIG.portraitHeight,
        0x333333,
        1
      );
    }
    portrait.setInteractive({ useHandCursor: true });
    portrait.on("pointerup", () => this.launchProfileMinigame(profile));
    return portrait;
  }

  // empty state: centered message inside the phone's inner screen so it
  // sits where the grid would have been.
  showEmptyState() {
    const screen = this.getInnerScreenRect();
    this.emptyText = this.add
      .text(screen.centerX, screen.centerY, "No hacked profiles yet.\nSwipe left on a card to hack them.", {
        fontSize: "18px",
        color: "#ffffff",
        align: "center",
      })
      .setOrigin(0.5, 0.5)
      .setDepth(50);
  }

  // recompute scroll clamp bounds for current inner-screen viewport.
  // scrollMaxY = grid resting position (top of inner screen + pad).
  // scrollMinY = lowest the grid can scroll up to so the last row still
  // sits inside the inner screen.
  recomputeScrollBounds() {
    const screen = this.getInnerScreenRect();
    const viewportHeight = screen.height - STORAGE_CONFIG.gridTopPad;
    const gridHeight = this.totalRows * STORAGE_CONFIG.cellHeight;
    this.scrollMaxY = this.gridRestY;
    if (gridHeight <= viewportHeight) {
      this.scrollMinY = this.gridRestY;
    } else {
      this.scrollMinY = this.gridRestY - (gridHeight - viewportHeight);
    }
  }

  // wire scroll handlers. only meaningful when content overflows; otherwise
  // the clamp keeps the grid pinned and the user can't scroll past nothing.
  bindScrollHandlers() {
    // 6 profiles fill exactly 2 rows of a 3-column grid, which always fits
    // within the viewport on any reasonable window. with 6 or fewer there
    // is nothing to scroll, so we skip wiring the handlers entirely.
    if (this.hackedProfiles.length <= 6) return;

    this.wheelHandler = (pointer, gameObjects, deltaX, deltaY) => {
      this.scrollBy(-deltaY * STORAGE_CONFIG.wheelStep);
    };
    this.input.on("wheel", this.wheelHandler);

    this.pointerDownHandler = (pointer) => {
      if (pointer.event && pointer.event.target && pointer.event.target.tagName === "CANVAS") {
        // ignore drags that started on a portrait or button (they capture the event first).
      }
      this.isDraggingBackground = true;
      this.dragLastY = pointer.y;
    };
    this.pointerMoveHandler = (pointer) => {
      if (!this.isDraggingBackground) return;
      const deltaY = pointer.y - this.dragLastY;
      this.dragLastY = pointer.y;
      this.scrollBy(deltaY);
    };
    this.pointerUpHandler = () => {
      this.isDraggingBackground = false;
    };

    this.input.on("pointerdown", this.pointerDownHandler);
    this.input.on("pointermove", this.pointerMoveHandler);
    this.input.on("pointerup", this.pointerUpHandler);
  }

  // shift the grid container y, clamped so we can't scroll past the edges.
  scrollBy(deltaY) {
    if (!this.gridContainer) return;
    const next = Phaser.Math.Clamp(this.gridContainer.y + deltaY, this.scrollMinY, this.scrollMaxY);
    this.gridContainer.y = next;
  }

  // ===== MINIGAME REDIRECT HOOK - EDIT THIS METHOD =====
  // fires once when the player clicks a portrait in the storage grid.
  // `profile` is the FULL profile object from profiles.json for the
  // portrait that was clicked, shaped like:
  //   { id, name, text, imagePath }
  //
  // current behavior: log a debug line so teammates can confirm the click
  // wired through the right profile while the real minigame scenes are
  // still being built.
  //
  // to redirect to a per-profile minigame later:
  //   1. add the minigame scene class to the scene list in game.js
  //   2. dispatch on profile.id (or add a `targetSceneKey` field to
  //      profiles.json and use that directly).
  //
  // example:
  //   this.scene.start("YourMinigameKey", { profile });
  launchProfileMinigame(profile) {
    if (profile == null) return;
    console.log(`[DEBUG] Starting minigame for: ${profile.name}`);
  }

  // resize: rebuild header + grid x positions from new camera dimensions.
  // we destroy the grid container and rebuild instead of mutating cells
  // because the column width changes with camera width.
  bindSceneLifecycle() {
    this.resizeHandler = () => this.handleResize();
    this.scale.on("resize", this.resizeHandler);
    this.events.once("shutdown", () => this.cleanup());
    this.events.once("destroy", () => this.cleanup());
  }

  handleResize() {
    const camera = this.cameras.main;
    if (camera.width <= 0 || camera.height <= 0) return;
    this.fitBackground();
    if (this.titleText) this.titleText.setPosition(camera.width / 2, 30);
    if (this.emptyText) {
      const screen = this.getInnerScreenRect();
      this.emptyText.setPosition(screen.centerX, screen.centerY);
    }
    if (this.gridContainer) {
      this.gridContainer.destroy(true);
      this.gridContainer = null;
      this.buildGrid();
    }
  }

  cleanup() {
    if (this.resizeHandler) {
      this.scale.off("resize", this.resizeHandler);
      this.resizeHandler = null;
    }
    if (this.wheelHandler) this.input.off("wheel", this.wheelHandler);
    if (this.pointerDownHandler) this.input.off("pointerdown", this.pointerDownHandler);
    if (this.pointerMoveHandler) this.input.off("pointermove", this.pointerMoveHandler);
    if (this.pointerUpHandler) this.input.off("pointerup", this.pointerUpHandler);
    this.wheelHandler = null;
    this.pointerDownHandler = null;
    this.pointerMoveHandler = null;
    this.pointerUpHandler = null;
    if (this.backBtn) {
      this.backBtn.removeAllListeners();
      this.backBtn = null;
    }
    this.gridContainer = null;
    this.emptyText = null;
    this.backgroundImage = null;
    this.titleText = null;
    this.hackedProfiles = [];
  }
}
