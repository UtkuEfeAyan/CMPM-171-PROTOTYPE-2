import { CARD_CONFIG, LAYOUT_CONFIG } from "../constants/swipeConfig.js";
import { ProfileCard } from "../objects/ProfileCard.js";

export class CardStackManager {
  /**
   * own active/pending/buffer slots and card promotion flow.
   * input is scene loader profiles and layout provider callback.
   * this centralizes stack state so scene stays thin and readable.
   */
  constructor(scene, profileLoader, profiles, getLayout) {
    this.scene = scene;
    this.profileLoader = profileLoader;
    this.profiles = profiles;
    this.getLayout = getLayout;
    this.currentIndex = 0;
    this.activeCard = null;
    this.pendingCard = null;
    this.bufferCard = null;
  }

  /**
   * build initial active, pending, and buffer cards.
   * input none, output populated slot references.
   * this guarantees first interactions have no texture popping.
   */
  async initialize() {
    this.activeCard = await this.createSlotCard(this.currentIndex, "active"); // current card user can drag now
    this.pendingCard = await this.createSlotCard(this.currentIndex + 1, "pending"); // next card already visible under active
    this.bufferCard = await this.createSlotCard(this.currentIndex + 2, "buffer"); // third card prepared for smooth drop-in
  }

  /**
   * create one slot card only after texture is ready.
   * input is profile index slot type and optional drop flag.
   * this ensures no default texture flashes during promotion.
   */
  async createSlotCard(profileIndex, slotType, shouldDrop = false) {
    const profile = this.profiles[profileIndex];
    if (!profile) return null;
    await this.profileLoader.ensureTextureReady(profile); // never create slot card until texture is confirmed ready
    const layout = this.getLayout();
    const startY = shouldDrop ? LAYOUT_CONFIG.bufferStartY : this.getSlotY(slotType, layout);
    const card = ProfileCard.create(this.scene, profile, layout.centerX, startY, layout);
    if (slotType === "active") return this.styleActiveCard(card, layout);
    if (slotType === "pending") return this.stylePendingCard(card, layout);
    return this.styleBufferCard(card, layout, shouldDrop);
  }

  /**
   * return active card reference for input and effect systems.
   * input none, output active card or null.
   * this gives scene a single read point for top card logic.
   */
  getActiveCard() {
    return this.activeCard;
  }

  /**
   * return active profile data for hack/slash commit hooks.
   * input none, output profile object or null.
   * this avoids scene coupling to internal slot references.
   */
  getActiveProfile() {
    return this.activeCard?.profile || null;
  }

  /**
   * forward drag target updates to active card only.
   * input is drag offsets from pointer.
   * this keeps movement routing inside stack manager boundary.
   */
  setActiveDragTarget(dragX, dragY) {
    if (!this.activeCard) return;
    this.activeCard.setDragTarget(dragX, dragY);
  }

  /**
   * apply grabbed visual state to active card only.
   * input is grabbed boolean.
   * this lets scene toggle feedback without slot knowledge.
   */
  setActiveGrabbed(isGrabbed) {
    if (!this.activeCard) return;
    this.activeCard.setGrabState(isGrabbed);
  }

  /**
   * run one frame of smooth movement for active card.
   * input none, output updated active card pose.
   * this keeps lerp math isolated from scene update loop.
   */
  stepActiveCard() {
    if (!this.activeCard) return;
    this.activeCard.stepTowardsTarget();
  }

  /**
   * consume active card and advance stack one slot.
   * input none, output refreshed active/pending/buffer slots.
   * this is the core no-pop promotion behavior.
   */
  async commitResolvedCard() {
    if (this.activeCard) this.activeCard.destroy(); // remove resolved top card from display and memory
    this.activeCard = null;
    this.currentIndex += 1; // advance data pointer to next profile in deck
    this.promoteSlots(); // pending becomes active, buffer becomes pending
    await this.spawnNextBuffer(); // fill empty buffer slot with next profile
  }

  /**
   * promote pending to active and buffer to pending.
   * input none, output restyled promoted cards.
   * this keeps next card instantly visible and interactive.
   */
  promoteSlots() {
    const layout = this.getLayout();
    this.activeCard = this.pendingCard; // instant promotion with no texture pop
    this.pendingCard = this.bufferCard; // keep one visible card behind active
    this.bufferCard = null;
    if (this.activeCard) this.styleActiveCard(this.activeCard, layout);
    if (this.pendingCard) this.stylePendingCard(this.pendingCard, layout);
  }

  /**
   * create next buffer card and drop it from top.
   * input none, output updated buffer slot.
   * this maintains three-card look-ahead at all times.
   */
  async spawnNextBuffer() {
    this.bufferCard = await this.createSlotCard(this.currentIndex + 2, "buffer", true); // drop new buffer from top for visual continuity
  }

  /**
   * refresh layout and transforms for all live slot cards.
   * input none, output cards resized/repositioned to viewport.
   * this keeps phone bounds behavior consistent on resize.
   */
  applyLayout() {
    const layout = this.getLayout();
    this.applyCardLayout(this.activeCard, layout, "active");
    this.applyCardLayout(this.pendingCard, layout, "pending");
    this.applyCardLayout(this.bufferCard, layout, "buffer");
  }

  /**
   * apply new layout to one slot card safely.
   * input is card, layout, and slot type.
   * this avoids repeated null checks in applyLayout.
   */
  applyCardLayout(card, layout, slotType) {
    if (!card) return;
    card.centerX = layout.centerX;
    card.centerY = layout.centerY;
    card.applyLayout(layout);
    if (slotType === "active") this.styleActiveCard(card, layout);
    if (slotType === "pending") this.stylePendingCard(card, layout);
    if (slotType === "buffer") this.styleBufferCard(card, layout, false);
  }

  /**
   * put card in active slot pose and depth.
   * input is card and current layout.
   * this marks the top interactive card in stack.
   */
  styleActiveCard(card, layout) {
    card.setTopCardStyle();
    card.x = layout.centerX;
    card.y = this.getSlotY("active", layout);
    return card;
  }

  /**
   * put card in pending slot pose behind active.
   * input is card and current layout.
   * this keeps next card already visible and ready.
   */
  stylePendingCard(card, layout) {
    card.setBackCardStyle();
    card.setDepth(CARD_CONFIG.depthBack);
    card.setScale(CARD_CONFIG.backScale);
    card.x = layout.centerX;
    card.y = this.getSlotY("pending", layout);
    return card;
  }

  /**
   * put card in buffer slot and optionally tween drop-in.
   * input is card layout and shouldDrop flag.
   * this creates the card-c drop effect after promotion.
   */
  styleBufferCard(card, layout, shouldDrop) {
    card.setBackCardStyle();
    card.setDepth(CARD_CONFIG.depthBuffer);
    card.setScale(CARD_CONFIG.bufferScale);
    card.x = layout.centerX;
    const targetY = this.getSlotY("buffer", layout); // resting y position for third slot
    if (!shouldDrop) {
      card.y = targetY;
      return card;
    }
    this.scene.tweens.add({
      targets: card,
      y: targetY,
      duration: LAYOUT_CONFIG.bufferDropTweenMs,
      ease: "Back.easeOut",
    });
    return card;
  }

  /**
   * return y value for slot type based on layout center.
   * input is slot label and layout.
   * this keeps stack spacing fully config-driven.
   */
  getSlotY(slotType, layout) {
    if (slotType === "active") return layout.centerY;
    if (slotType === "pending") return layout.centerY + LAYOUT_CONFIG.pendingOffsetY;
    return layout.centerY + LAYOUT_CONFIG.bufferOffsetY;
  }
}
