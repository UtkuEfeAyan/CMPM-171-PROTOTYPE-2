/*
 * ProfileDetailScene: shown after a HACK commit on any profile card.
 *
 * Layout (top → bottom, scrollable within a bounded panel):
 *   [Profile image]
 *   [Name]
 *   [General info block]
 *   [Credit card asset + card details]
 *   [SSN asset + SSN details]
 *   [Kill button]  [Start Dating button]  ← pinned to panel bottom, not scrollable
 *
 * Panel design:
 *   The page renders inside a fixed rectangular panel centered on screen
 *   (DETAIL_LAYOUT.panelWidthPct × panelHeightPct of the camera).
 *   Content outside the panel is hidden behind the solid background.
 *   This gives the "phone within the screen" look instead of full-bleed.
 *
 * Scroll mechanics:
 *   - All scrollable content lives in scrollContainer whose .y is offset.
 *   - A Phaser Graphics mask clips the container to the panel bounds so
 *     content never bleeds outside the panel edges.
 *   - FIX: scroll only activates when the pointer is INSIDE the panel AND
 *     isPointerDown is true. _suppressScroll is set by buttons so a button
 *     tap never accidentally scrolls.
 *   - scrollMin (0) and scrollMax (negative) clamp container.y.
 *
 * Button animations (preserved exactly from provided reference):
 *   - Kill:         red flash + "TARGET ELIMINATED" scale-in/out tween.
 *   - Start Dating: heart particle burst + "MATCH!" scale-in/out tween.
 *
 * Entry contract:
 *   scene.start("ProfileDetail", { profile }) from SwipeDeckScene.
 *
 * Exit paths:
 *   "Kill"         → createKillEffect → GameState.recordKill →
 *                    scene.stop("ProfileDetail") + scene.resume("SwipeDeck")
 *   "Start Dating" → createDatingEffect → GameState.recordMatch →
 *                    stub (DatingScene not yet built)
 */

import { DETAIL_STYLE, DETAIL_LAYOUT } from "../constants/swipeConfig.js";
import { GameState } from "../systems/GameState.js";

export class ProfileDetailScene extends Phaser.Scene {
  constructor() {
    super({ key: "ProfileDetail" });

    this.currentProfile = null;   // full profile object injected via init()
    this.scrollContainer = null;  // container holding all scrollable content
    this.scrollY = 0;             // current container y offset (0 = top)
    this.scrollMin = 0;           // upper clamp (always 0 – top of content)
    this.scrollMax = 0;           // lower clamp (negative – content taller than panel)

    // isPointerDown: true only while the pointer is held inside the panel.
    // _suppressScroll: set true by button pointerdown so that tap never scrolls.
    this.isPointerDown = false;
    this.dragStartY = 0;          // pointer y on pointerdown
    this.scrollStartY = 0;        // scrollY snapshot on pointerdown
    this._suppressScroll = false;

    // panel geometry – computed in create(), used by input and mask.
    this.panelX = 0;   // left edge of panel
    this.panelY = 0;   // top edge of panel
    this.panelW = 0;   // panel width
    this.panelH = 0;   // panel height

    // listener refs for clean shutdown
    this._ptrDownHandler = null;
    this._ptrMoveHandler = null;
    this._ptrUpHandler   = null;
    this._wheelHandler   = null;
    this._resizeHandler  = null;

    // double-fire guard for action buttons
    this._buttonLocked = false;
  }

  // ─── lifecycle ──────────────────────────────────────────────────────────────

  init(data) {
    if (data && data.profile) {
      this.currentProfile = data.profile;
      return;
    }
    // fallback: try GameState's last-hacked profile
    this.currentProfile = GameState.getLastHackedProfile?.() ?? null;
    if (!this.currentProfile) {
      console.error("[ProfileDetailScene] no profile received – returning to SwipeDeck");
      this.scene.start("SwipeDeck");
    }
  }

  preload() {
    // FIX: paths now point to assets/credit_card.png and assets/ssn_card.png.
    // texture key names are unchanged so addCreditCardGraphic / addSSNGraphic
    // pick up the real images without any further changes.
    if (!this.textures.exists("creditCardAsset")) {
      this.load.image("creditCardAsset", "assets/credit_card.png");
    }
    if (!this.textures.exists("ssnAsset")) {
      this.load.image("ssnAsset", "assets/ssn_card.png");
    }
  }

  create() {
    if (!this.currentProfile) return;

    // reset per-session state 
    this.scrollY = 0;
    this.isPointerDown = false;
    this._suppressScroll = false;
    this._buttonLocked = false;

    
    this.input.topOnly = false;

    const cam = this.cameras.main;

    // panel is a centered rectangle, NOT full-screen.
    // all content and the scroll mask are derived from these four values.
    this.panelW = Math.floor(cam.width  * DETAIL_LAYOUT.panelWidthPct);
    this.panelH = Math.floor(cam.height * DETAIL_LAYOUT.panelHeightPct);
    this.panelX = Math.floor((cam.width  - this.panelW) / 2);
    this.panelY = Math.floor((cam.height - this.panelH) / 2);

    this.createBackground(cam);
    this.createPanel();
    this.createScrollContent();
    this.applyScrollMask();
    this.createButtons();   // pinned inside panel bottom – not in scroll container
    this.bindInput();
    this.bindLifecycle();
  }

  shutdown() {
    this.detachListeners();
  }

  // solid near-black fill only – no gradient overlay object.
  // the gradient added visual noise without adding readability.
  createBackground(cam) {
    this.add
      .rectangle(cam.width / 2, cam.height / 2, cam.width, cam.height, DETAIL_STYLE.bgColor, 1)
      .setOrigin(0.5)
      .setDepth(0);
  }

  // Frame of Panel

  // draw the bounded panel: dark fill + green border.
  // everything scrollable will be masked to this rectangle.
  createPanel() {
    // panel background fill
    this.add
      .rectangle(
        this.panelX + this.panelW / 2,
        this.panelY + this.panelH / 2,
        this.panelW,
        this.panelH,
        DETAIL_STYLE.panelBgColor,
        1
      )
      .setOrigin(0.5)
      .setDepth(1);

    // panel border (green accent)
    const border = this.add.graphics().setDepth(2);
    border.lineStyle(DETAIL_STYLE.panelBorderWidth, DETAIL_STYLE.panelBorderColor, 1);
    border.strokeRect(this.panelX, this.panelY, this.panelW, this.panelH);
  }


  // all scrollable objects live inside scrollContainer.
  // positions are relative to the panel's left edge (panelX) so the content
  // centers correctly regardless of the panel's screen position.
  createScrollContent() {
    // content x-center = panel center
    const cx = this.panelX + this.panelW / 2;
    // content width capped so text doesn't span the full panel on wide screens
    const contentWidth = Math.min(this.panelW - 24, DETAIL_LAYOUT.maxContentWidth);

    this.scrollContainer = this.add.container(0, 0).setDepth(3);

    let y = this.panelY + DETAIL_LAYOUT.topPad;

    y = this.addProfileImage(cx, y, contentWidth);
    y += DETAIL_LAYOUT.sectionGap;

    // Name
    y = this.addNameText(cx, y);
    y += DETAIL_LAYOUT.sectionGap;

    // Divider
    y = this.addDivider(cx, y, contentWidth);
    y += DETAIL_LAYOUT.sectionGap;

    // General Info tab
    y = this.addSectionHeader(cx, y, "GENERAL INFORMATION");
    y += DETAIL_LAYOUT.headerGap;
    y = this.addGeneralInfo(cx, y, contentWidth);
    y += DETAIL_LAYOUT.sectionGap;

    // Divider
    y = this.addDivider(cx, y, contentWidth);
    y += DETAIL_LAYOUT.sectionGap;

    // Credit Card
    y = this.addSectionHeader(cx, y, "CREDIT CARD INFORMATION");
    y += DETAIL_LAYOUT.headerGap;
    y = this.addCreditCardBlock(cx, y, contentWidth);
    y += DETAIL_LAYOUT.sectionGap;

    // Divider
    y = this.addDivider(cx, y, contentWidth);
    y += DETAIL_LAYOUT.sectionGap;

    // SSN
    y = this.addSectionHeader(cx, y, "SOCIAL SECURITY NUMBER");
    y += DETAIL_LAYOUT.headerGap;
    y = this.addSSNBlock(cx, y, contentWidth);

    // bottom padding clears the pinned button bar
    y += DETAIL_LAYOUT.buttonHeight + DETAIL_LAYOUT.bottomPad + 40;

    // scrollMax: how far up the container can travel so the last item is visible.
    // subtract button bar height so content doesn't scroll under buttons.
    const visiblePanelH = this.panelH - DETAIL_LAYOUT.buttonHeight - 16;
    const contentH = y - this.panelY;
    this.scrollMax = Math.min(0, visiblePanelH - contentH);
  }

  // Section Builder

  // profile image with green accent border.
  // returns new cursorY (bottom of image).
  addProfileImage(cx, y, contentWidth) {
    const profile = this.currentProfile;
    const textureKey = `profile_${profile.id}`;
    const imgW = contentWidth * 0.85;
    const imgH = DETAIL_LAYOUT.profileImageHeight;
    const imgCY = y + imgH / 2;

    // green accent border
    const border = this.add.rectangle(cx, imgCY, imgW + 6, imgH + 6, 0x000000, 0);
    border.setStrokeStyle(2, 0x00ff88, 1).setOrigin(0.5);
    this.scrollContainer.add(border);

    if (this.textures.exists(textureKey)) {
      const img = this.add.image(cx, imgCY, textureKey).setDisplaySize(imgW, imgH).setOrigin(0.5);
      this.scrollContainer.add(img);
    } else {
      // dark gray placeholder when texture is missing
      const ph = this.add.rectangle(cx, imgCY, imgW, imgH, DETAIL_STYLE.imageFallbackColor, 1).setOrigin(0.5);
      this.scrollContainer.add(ph);
    }

    return y + imgH;
  }

  // name in large bold white text.
  // returns new cursorY.
  addNameText(cx, y) {
    const text = this.add.text(cx, y, this.currentProfile.name || "Unknown", {
      fontSize:   DETAIL_STYLE.nameFontSize,
      color:      DETAIL_STYLE.nameColor,
      fontStyle:  "bold",
      fontFamily: DETAIL_STYLE.fontFamily,
    }).setOrigin(0.5, 0);
    this.scrollContainer.add(text);
    return y + text.height;
  }

  // thin 1px horizontal divider.
  // returns new cursorY.
  addDivider(cx, y, contentWidth) {
    const line = this.add
      .rectangle(cx, y, contentWidth * 0.9, 1, DETAIL_STYLE.dividerColor, 0.5)
      .setOrigin(0.5, 0);
    this.scrollContainer.add(line);
    return y + 1;
  }

  // uppercase section label in green.
  // returns new cursorY.
  addSectionHeader(cx, y, label) {
    const text = this.add.text(cx, y, label, {
      fontSize:      DETAIL_STYLE.sectionHeaderFontSize,
      color:         DETAIL_STYLE.sectionHeaderColor,
      fontStyle:     "bold",
      fontFamily:    DETAIL_STYLE.fontFamily,
      letterSpacing: 2,
    }).setOrigin(0.5, 0);
    this.scrollContainer.add(text);
    return y + text.height;
  }

  // bio text + structured key/value rows.
  // returns new cursorY.
  addGeneralInfo(cx, y, contentWidth) {
    const profile = this.currentProfile;

    // bio / description
    const bioText = this.add.text(cx, y, profile.text || "No additional information available.", {
      fontSize:   "13px",
      color:      "#aaaaaa",
      align:      "center",
      wordWrap:   { width: contentWidth * 0.88, useAdvancedWrap: true },
      lineSpacing: 3,
      fontFamily: DETAIL_STYLE.fontFamily,
    }).setOrigin(0.5, 0);
    this.scrollContainer.add(bioText);
    y += bioText.height + DETAIL_LAYOUT.headerGap;

    // structured info rows from profile.info (graceful if missing)
    const info = profile.info || {};
    const rows = [
      ["Age",        info.age        || "—"],
      ["Occupation", info.occupation || "—"],
      ["Location",   info.location   || "—"],
      ["Height",     info.height     || "—"],
      ["Status",     info.status     || "—"],
    ];
    return this.addInfoRows(cx, y, contentWidth, rows);
  }

  // credit card graphic + detail rows.
  // returns new cursorY.
  addCreditCardBlock(cx, y, contentWidth) {
    y = this.addCreditCardGraphic(cx, y, contentWidth);
    y += DETAIL_LAYOUT.assetGap;

    const cc = this.currentProfile.creditCard || {};
    const rows = [
      ["Card Number", cc.number  || "•••• •••• •••• ••••"],
      ["Cardholder",  cc.holder  || this.currentProfile.name || "—"],
      ["Expiry",      cc.expiry  || "••/••"],
      ["CVV",         cc.cvv     || "•••"],
      ["Bank",        cc.bank    || "—"],
      ["Type",        cc.type    || "—"],
    ];
    return this.addInfoRows(cx, y, contentWidth, rows);
  }

  // ssn graphic + detail rows + confidential warning.
  // returns new cursorY.
  addSSNBlock(cx, y, contentWidth) {
    y = this.addSSNGraphic(cx, y, contentWidth);
    y += DETAIL_LAYOUT.assetGap;

    const ssn = this.currentProfile.ssn || {};
    const rows = [
      ["SSN",    ssn.number || "•••-••-••••"],
      ["Issued", ssn.issued || "—"],
      ["State",  ssn.state  || "—"],
    ];
    y = this.addInfoRows(cx, y, contentWidth, rows);

    // confidential warning tag (preserved from original)
    const warning = this.add.text(cx, y + 4, "CONFIDENTIAL — HANDLE WITH CARE", {
      fontSize:   "10px",
      color:      "#ff4444",
      fontStyle:  "bold",
      fontFamily: DETAIL_STYLE.fontFamily,
    }).setOrigin(0.5, 0);
    this.scrollContainer.add(warning);
    return y + warning.height + 8;
  }

  // Asset Graphics

  // credit card
  // dimensions controlled by DETAIL_LAYOUT.assetWidthRatio & assetAspectRatio.
  // returns new cursorY (bottom of card graphic).
  // width  = contentWidth * DETAIL_LAYOUT.ccWidthRatio
  // height = cardW        * DETAIL_LAYOUT.ccAspectRatio
  addCreditCardGraphic(cx, y, contentWidth) {
    const cardW = contentWidth * DETAIL_LAYOUT.ccWidthRatio;
    const cardH = cardW * DETAIL_LAYOUT.ccAspectRatio;

    const img = this.add.image(cx, y + cardH / 2, "creditCardAsset")
      .setDisplaySize(cardW, cardH)
      .setOrigin(0.5);
    this.scrollContainer.add(img);

    return y + cardH;
  }

  // ssn card asset.
  // width  = contentWidth * DETAIL_LAYOUT.ssnWidthRatio
  // height = cardW        * DETAIL_LAYOUT.ssnAspectRatio
  addSSNGraphic(cx, y, contentWidth) {
    const cardW = contentWidth * DETAIL_LAYOUT.ssnWidthRatio;
    const cardH = cardW * DETAIL_LAYOUT.ssnAspectRatio;

    const img = this.add.image(cx, y + cardH / 2, "ssnAsset")
      .setDisplaySize(cardW, cardH)
      .setOrigin(0.5);
    this.scrollContainer.add(img);

    return y + cardH;
  }

  // left-aligned key, right-aligned value per row.
  // returns new cursorY.
  addInfoRows(cx, y, contentWidth, rows) {
    const leftX  = cx - contentWidth * 0.44;
    const rightX = cx + contentWidth * 0.44;

    rows.forEach(([key, val]) => {
      const keyText = this.add.text(leftX, y, key, {
        fontSize:   DETAIL_STYLE.infoKeyFontSize,
        color:      DETAIL_STYLE.infoKeyColor,
        fontStyle:  "bold",
        fontFamily: DETAIL_STYLE.fontFamily,
      }).setOrigin(0, 0);

      const valText = this.add.text(rightX, y, String(val), {
        fontSize:   DETAIL_STYLE.infoValFontSize,
        color:      DETAIL_STYLE.infoValColor,
        fontFamily: DETAIL_STYLE.fontFamily,
        align:      "right",
        wordWrap:   { width: contentWidth * 0.46, useAdvancedWrap: true },
      }).setOrigin(1, 0);

      this.scrollContainer.add([keyText, valText]);
      y += Math.max(keyText.height, valText.height) + DETAIL_LAYOUT.infoRowHeight * 0.25;
    });

    return y;
  }


  // clip scrollContainer to the panel rectangle so content never bleeds outside.
  // Phaser geometry masks work on world coordinates, so we use the panel's
  // absolute screen position (panelX, panelY) not local container coordinates.
  applyScrollMask() {
    const maskGraphics = this.make.graphics({ add: false });
    maskGraphics.fillStyle(0xffffff, 1);
    // leave the button bar height unmasked at the bottom so buttons stay visible.
    const maskH = this.panelH - DETAIL_LAYOUT.buttonHeight - 12;
    maskGraphics.fillRect(this.panelX, this.panelY, this.panelW, maskH);
    const mask = maskGraphics.createGeometryMask();
    this.scrollContainer.setMask(mask);
  }


  // buttons are placed directly in the scene (not in scrollContainer) so they
  // sit at a fixed position at the bottom of the panel regardless of scroll.
  createButtons() {
    const btnY   = this.panelY + this.panelH - DETAIL_LAYOUT.buttonHeight / 2 - 8;
    const btnW   = this.panelW * 0.38;
    const btnH   = DETAIL_LAYOUT.buttonHeight;
    const cx     = this.panelX + this.panelW / 2;

    // Kill (red)
    this.createButton(cx - btnW / 2 - 8, btnY, btnW, btnH,
      "TERMINATE", 0xcc0000, 0xff3333, () => this.handleKill());

    // Start Dating (green)
    this.createButton(cx + btnW / 2 + 8, btnY, btnW, btnH,
      "START DATING", 0x007744, 0x00ff88, () => this.handleStartDating());
  }

  // build one button: bg rect + label text, both at depth 10/11 so they sit
  // above the scroll container (depth 3) and its mask.
  // callback fires on pointerdown + 100ms delay, not pointerup, so the
  // hit area shift from setScale(0.95) can never swallow the event.
  createButton(x, y, w, h, label, baseColor, hoverColor, callback) {
    const bg = this.add.rectangle(x, y, w, h, baseColor)
      .setOrigin(0.5)
      .setDepth(10)
      .setInteractive({ useHandCursor: true });
    bg.setStrokeStyle(1.5, 0xffffff, 0.6);

    const txt = this.add.text(x, y, label, {
      fontSize:   DETAIL_STYLE.btnFontSize,
      color:      DETAIL_STYLE.btnTextColor,
      fontStyle:  "bold",
      fontFamily: DETAIL_STYLE.fontFamily,
    }).setOrigin(0.5).setDepth(11);

    bg.on("pointerover", () => { bg.setFillStyle(hoverColor); txt.setScale(1.05); });
    bg.on("pointerout",  () => { bg.setFillStyle(baseColor);  txt.setScale(1); });

    bg.on("pointerdown", () => {
      if (this._buttonLocked) return;
      this._buttonLocked = true;
      // suppress the scene-level scroll handler for this touch
      this._suppressScroll = true;

      this.tweens.add({
        targets: [bg, txt], scaleX: 0.95, scaleY: 0.95,
        duration: 80, ease: "Power1", yoyo: true,
      });
      this.time.delayedCall(100, () => callback());
    });
  }


  handleKill() {
    if (this.currentProfile) GameState.recordKill(this.currentProfile.id);
    window.dispatchEvent(
      new CustomEvent("profile-killed", { detail: { profileId: this.currentProfile?.id } })
    );
    // Chain scene transition to animation completion instead of fixed delay
    this.createKillEffect().then(() => {
      this.scene.stop("ProfileDetail");
      //this.scene.resume("SwipeDeck");
    });
  }

  // red flash + "TARGET ELIMINATED"
  createKillEffect() {
    return new Promise((resolve) => {
      const { width, height } = this.cameras.main;

      const flash = this.add.rectangle(width / 2, height / 2, width, height, 0xff0000, 0.6)
        .setOrigin(0.5).setDepth(1000);

      const eliminatedText = this.add.text(width / 2, height / 2, "TARGET ELIMINATED", {
        fontSize: "48px", color: "#ff0000", fontStyle: "bold",
        stroke: "#000000", strokeThickness: 6,
      }).setOrigin(0.5).setDepth(1001).setScale(0);

      this.tweens.add({ targets: flash, alpha: 0, duration: 600, ease: "Power2" });

      this.tweens.add({
        targets: eliminatedText, scale: 1, duration: 300, ease: "Back.out",
        onComplete: () => {
          this.tweens.add({
            targets: eliminatedText, alpha: 0, scale: 1.5, duration: 400, ease: "Power2",
            onComplete: resolve, 
          });
        },
      });
    });
  }

  handleStartDating() {
    if (this.currentProfile) GameState.recordMatch(this.currentProfile.id);
    window.dispatchEvent(
      new CustomEvent("profile-dating", { detail: { profileId: this.currentProfile?.id } })
    );
    // Chain scene transition to animation completion instead of fixed delay
    this.createDatingEffect().then(() => {
      this.scene.stop("ProfileDetail");
      //this.scene.resume("SwipeDeck");
    });
  }

  // heart burst + "MATCH!" 
  createDatingEffect() {
    // Return promise for chaining to scene transition
    return new Promise((resolve) => {
      const { width, height } = this.cameras.main;

      for (let i = 0; i < 20; i++) {
        const heart = this.add.text(
          width / 2 + Phaser.Math.Between(-100, 100),
          height / 2 + Phaser.Math.Between(-100, 100),
          "♥", { fontSize: `${Phaser.Math.Between(20, 40)}px`, color: "#ff69b4" }
        ).setOrigin(0.5).setDepth(1000);

        this.tweens.add({
          targets: heart, y: heart.y - 150, alpha: 0, scale: 0,
          duration: Phaser.Math.Between(800, 1500), ease: "Power2",
          onComplete: () => heart.destroy(),
        });
      }

      const matchText = this.add.text(width / 2, height / 2, "MATCH!", {
        fontSize: "56px", color: "#ff69b4", fontStyle: "bold",
        stroke: "#ffffff", strokeThickness: 4,
      }).setOrigin(0.5).setDepth(1001).setScale(0);

      this.tweens.add({
        targets: matchText, scale: 1, duration: 400, ease: "Back.out",
        onComplete: () => {
          this.tweens.add({
            targets: matchText, y: matchText.y - 50, alpha: 0,
            duration: 600, delay: 400, ease: "Power2",
            onComplete: resolve,  // FIXED: Resolve when animation finishes
          });
        },
      });
    });
  }


  bindInput() {
    const DRAG_THRESHOLD = 8; // px a pointer must move before scroll activates

    // only begin tracking scroll when the pointer lands INSIDE the panel.
    // pointers outside the panel (on the surrounding background) are ignored.
    this._ptrDownHandler = (ptr) => {
      // ignore if the pointer is outside the panel bounds
      if (!this._isInsidePanel(ptr.x, ptr.y)) return;
      // ignore if a button just fired (it sets _suppressScroll on its pointerdown)
      if (this._suppressScroll) { this._suppressScroll = false; return; }

      this.isPointerDown  = true;
      this.dragStartY     = ptr.y;
      this.scrollStartY   = this.scrollY;
    };

    // only scroll when isPointerDown is true (set only after a valid
    // in-panel pointerdown). this prevents the container drifting when the
    // mouse simply moves over the scene without clicking.
    this._ptrMoveHandler = (ptr) => {
      if (!this.isPointerDown) return;
      const delta = ptr.y - this.dragStartY;
      if (Math.abs(delta) < DRAG_THRESHOLD) return; // dead zone
      this.scrollY = Phaser.Math.Clamp(
        this.scrollStartY + delta,
        this.scrollMax,
        this.scrollMin
      );
      this.scrollContainer.y = this.scrollY;
    };

    this._ptrUpHandler = () => {
      this.isPointerDown  = false;
      this._suppressScroll = false;
    };

    this.input.on("pointerdown",      this._ptrDownHandler);
    this.input.on("pointermove",      this._ptrMoveHandler);
    this.input.on("pointerup",        this._ptrUpHandler);
    this.input.on("pointerupoutside", this._ptrUpHandler);

    // mouse wheel – only scrolls when cursor is inside the panel
    this._wheelHandler = (ptr, _objs, _dx, deltaY) => {
      if (!this._isInsidePanel(ptr.x, ptr.y)) return;
      this.scrollY = Phaser.Math.Clamp(
        this.scrollY - deltaY * DETAIL_LAYOUT.wheelScrollSpeed,
        this.scrollMax,
        this.scrollMin
      );
      this.scrollContainer.y = this.scrollY;
    };
    this.input.on("wheel", this._wheelHandler);
  }

  // returns true if (x, y) is within the panel rectangle.
  _isInsidePanel(x, y) {
    return (
      x >= this.panelX &&
      x <= this.panelX + this.panelW &&
      y >= this.panelY &&
      y <= this.panelY + this.panelH
    );
  }


  bindLifecycle() {
    this._resizeHandler = () => {
      // recompute panel geometry and re-clamp scroll on viewport change
      const cam = this.cameras.main;
      this.panelW = Math.floor(cam.width  * DETAIL_LAYOUT.panelWidthPct);
      this.panelH = Math.floor(cam.height * DETAIL_LAYOUT.panelHeightPct);
      this.panelX = Math.floor((cam.width  - this.panelW) / 2);
      this.panelY = Math.floor((cam.height - this.panelH) / 2);

      const visiblePanelH = this.panelH - DETAIL_LAYOUT.buttonHeight - 16;
      const bounds = this.scrollContainer.getBounds();
      this.scrollMax = Math.min(0, visiblePanelH - bounds.height);
      this.scrollY   = Phaser.Math.Clamp(this.scrollY, this.scrollMax, this.scrollMin);
      this.scrollContainer.y = this.scrollY;
    };
    this.scale.on("resize", this._resizeHandler);

    this.events.once("shutdown", () => this.detachListeners());
    this.events.once("destroy",  () => this.detachListeners());
  }

  detachListeners() {
    if (this._ptrDownHandler) this.input.off("pointerdown",      this._ptrDownHandler);
    if (this._ptrMoveHandler) this.input.off("pointermove",      this._ptrMoveHandler);
    if (this._ptrUpHandler)   this.input.off("pointerup",        this._ptrUpHandler);
    if (this._ptrUpHandler)   this.input.off("pointerupoutside", this._ptrUpHandler);
    if (this._wheelHandler)   this.input.off("wheel",            this._wheelHandler);
    if (this._resizeHandler)  this.scale.off("resize",           this._resizeHandler);
    this._ptrDownHandler = null;
    this._ptrMoveHandler = null;
    this._ptrUpHandler   = null;
    this._wheelHandler   = null;
    this._resizeHandler  = null;
  }
}