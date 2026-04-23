import { SCENE_CONFIG, SWIPE_DIRECTIONS } from "../constants/swipeConfig.js";

export class SwipeFlowController {
  // coordinate throw/snap behavior and effect playback
  constructor(scene, animationOverlay) {
    this.scene = scene;
    this.animationOverlay = animationOverlay;
  }

  // decide if this release is a throw or snapback
  resolveSwipe(direction, card, onSnapBack, onComplete) {
    // "none" means no commit yet, so card should return to center
    if (direction === SWIPE_DIRECTIONS.NONE) return this.snapCardBack(card, onSnapBack);
    // committed swipe: throw card and run matching overlay effect
    this.throwCard(card, direction); // start movement tween immediately so card exits with momentum
    this.animationOverlay.playEffect(direction, card.x, card.y, onComplete); // run matching visual layer and callback when done
  }

  // animate card out of stack for slash or hack commit
  throwCard(card, direction) {
    // direction controls throw side and rotation sign
    // use center-relative offsets so slash always goes right from current card position
    const xOffset = direction === SWIPE_DIRECTIONS.SLASH ? SCENE_CONFIG.throwSlashX : SCENE_CONFIG.throwHackX; // right for slash, left for hack
    const rotation = direction === SWIPE_DIRECTIONS.SLASH ? SCENE_CONFIG.throwSlashRotation : SCENE_CONFIG.throwHackRotation; // tilt direction matches throw side
    this.scene.tweens.add({
      targets: card,
      x: card.x + xOffset,
      y: card.y - SCENE_CONFIG.throwRiseY,
      rotation,
      alpha: 0,
      duration: SCENE_CONFIG.throwTweenMs,
      ease: "Quad.easeIn",
    });
  }

  // return card to center when swipe is below threshold
  snapCardBack(card, onDone) {
    // snap keeps movement readable and gives player immediate feedback
    this.scene.tweens.add({
      targets: card,
      x: card.centerX,
      y: card.centerY,
      rotation: 0,
      duration: SCENE_CONFIG.snapTweenMs,
      ease: SCENE_CONFIG.snapEase,
      onComplete: () => onDone?.(),
    });
  }
}
