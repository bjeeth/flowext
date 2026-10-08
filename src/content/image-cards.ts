import { FLOW } from './selectors';
import { isVisible } from './flow-dom';
import { cardRejection } from '../shared/discovery-policy';

export function imageCardRejection(image: HTMLImageElement) {
  const tile = image.closest(FLOW.tile);
  return cardRejection({ hasMediaId: !!image.getAttribute('data-media-id'), hasTile: !!tile,
    imageCount: tile?.querySelectorAll(FLOW.image).length ?? 0, visible: isVisible(image) });
}
/** Discovery and reacquisition must not depend on a conditionally mounted action menu. */
export function renderedImages(root: HTMLElement): HTMLImageElement[] {
  return Array.from(root.querySelectorAll<HTMLImageElement>(FLOW.image)).filter(image => !imageCardRejection(image));
}
