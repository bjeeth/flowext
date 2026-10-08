import { matchesQuality, type DownloadQuality } from '../shared/download-quality';
import { accessibleName, controlKind, describe, isVisible, nodeId } from './flow-dom';
import { FLOW, TIMEOUTS } from './selectors';
import type { SingleAsset } from '../shared/automation-types';
import { renderedImages } from './image-cards';

/** A page-wide absence of image controls is a prerequisite failure, not a failed download. */
export class FlowControlsUnavailable extends Error {}

export async function boundedWait<T>(find: () => T | undefined, timeout: number, signal: AbortSignal, error: string): Promise<T> {
  const end = Date.now() + timeout;
  while (true) {
    signal.throwIfAborted();
    const value = find(); if (value !== undefined) return value;
    if (Date.now() >= end) throw new Error(error);
    await new Promise<void>((resolve, reject) => {
      const abort = () => { clearTimeout(timer); reject(signal.reason); };
      const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve(); }, 100);
      signal.addEventListener('abort', abort, { once: true });
    });
  }
}
export function timedRequest<T>(request: Promise<T>, timeout: number, error: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(error)), timeout);
    request.then(value => { clearTimeout(timer); resolve(value); }, reason => { clearTimeout(timer); reject(reason); });
  });
}
/** The only DOM-writing adapter. Selector contract is in selectors.ts, backed by real capture. */
export class FlowDOMAdapter {
  private choices = new Map<string, { image: HTMLImageElement; mediaId: string }>();
  constructor(private doc: Document) {}
  detectAssets(): SingleAsset[] {
    const view = this.doc.defaultView;
    const images = renderedImages(this.doc.documentElement).filter(image => {
      const r = image.getBoundingClientRect();
      return isVisible(image) && r.bottom > 0 && r.right > 0 && r.top < (view?.innerHeight ?? 0) && r.left < (view?.innerWidth ?? 0);
    });
    const result: SingleAsset[] = [];
    this.choices.clear();
    for (const image of images) {
      const tile = image.closest(FLOW.tile);
      const mediaId = image.getAttribute('data-media-id');
      if (!tile || !mediaId) continue;
      const key = nodeId(image);
      this.choices.set(key, { image, mediaId });
      result.push({ key, label: `Image ${result.length + 1}`, loaded: image.complete && image.naturalWidth > 0 });
    }
    return result;
  }
  bindImage(image: HTMLImageElement): string {
    const mediaId = image.getAttribute('data-media-id');
    if (!mediaId || !this.doc.contains(image)) throw new Error('Asset could not be identified.');
    const key = nodeId(image); this.choices.clear(); this.choices.set(key, { image, mediaId }); return key;
  }
  async closeMenus(signal: AbortSignal) {
    const expanded = Array.from(this.doc.querySelectorAll<HTMLElement>(FLOW.more)).filter(button => button.getAttribute('aria-expanded') === 'true');
    if (!this.visibleMenus().length) return;
    if (expanded.length !== 1) throw new Error('Cannot safely close an unrelated or ambiguous Flow menu.');
    this.enabled(expanded[0], false); signal.throwIfAborted(); expanded[0].click();
    await boundedWait(() => this.visibleMenus().length === 0 ? true : undefined, TIMEOUTS.menu, signal, 'Flow menus did not close.');
  }
  private image(key: string): HTMLImageElement {
    const entry = this.choices.get(key);
    if (!entry || !this.doc.contains(entry.image) || entry.image.getAttribute('data-media-id') !== entry.mediaId || !isVisible(entry.image)) throw new Error('Image changed or left the rendered page. Rescan visible images before trying again.');
    return entry.image;
  }
  async openAssetMenu(key: string, signal: AbortSignal): Promise<HTMLElement> {
    if (this.visibleMenus().length) throw new Error('Close the existing Flow menus before testing one image.');
    const image = this.image(key);
    if (!image.complete || image.naturalWidth === 0) throw new Error('Image is still loading. Wait and rescan.');
    let more: HTMLElement;
    try {
      more = await boundedWait(() => {
        const current = this.image(key);
        const buttons = Array.from(current.closest(FLOW.tile)!.querySelectorAll<HTMLElement>(FLOW.more));
        if (buttons.length > 1) throw new Error('Multiple More controls belong to this image. Refusing an ambiguous action.');
        if (buttons.length === 1 && controlKind(buttons[0]) === 'more') return buttons[0];
      }, TIMEOUTS.menu, signal, 'This image’s More options control is not rendered. Flow UI changed or image actions are unavailable in the current mode.');
    } catch (error) {
      signal.throwIfAborted();
      const scope = image.closest(FLOW.collection) ?? this.doc;
      if (!scope.querySelector(FLOW.more)) throw new FlowControlsUnavailable('Images were found, but Flow is not rendering any image More options controls in this collection. Return to the normal image grid and leave selection mode if active, then retry. Copy discovery diagnostics if the controls remain absent. No download was started for this image.');
      throw error;
    }
    // The captured hotbar is hidden until hover. Invoke its existing enabled DOM button;
    // do not change page styles, simulate coordinates, or synthesize hover sequences.
    this.enabled(more, false); signal.throwIfAborted(); more.click();
    return boundedWait(() => {
      this.image(key);
      const id = more.getAttribute('aria-controls');
      const menu = id ? this.doc.getElementById(id) : null;
      if (more.getAttribute('aria-expanded') !== 'true' || !menu?.matches(FLOW.menu) || !isVisible(menu)) return;
      if (!menu.querySelector(FLOW.downloadContext)) return;
      return menu;
    }, TIMEOUTS.menu, signal, 'Image menu did not open or expose its aria-controls relationship.');
  }
  private editorMediaId?: string;
  private editor(): HTMLElement {
    const pages = Array.from(this.doc.querySelectorAll<HTMLElement>('flow-editor-page')).filter(isVisible);
    if (pages.length !== 1) throw new Error('Could not uniquely identify the image editor.');
    return pages[0];
  }
  assertEditorImage() {
    const images = Array.from(this.editor().querySelectorAll<HTMLImageElement>('img.read-only-image')).filter(isVisible);
    if (images.length !== 1) throw new Error('Could not uniquely identify the editor image.');
    const url = new URL(images[0].src);
    if (url.protocol !== 'https:' || url.hostname !== 'flow-content.google' || url.pathname !== `/image/${this.editorMediaId}`) throw new Error('Editor image does not match the queued media ID. No quality action was clicked.');
  }
  async openEditorDownload(key: string, signal: AbortSignal, quality: DownloadQuality): Promise<HTMLElement> {
    if (this.doc.querySelector('flow-editor-page')) throw new Error('Return to the project grid before starting an export.');
    const image = this.image(key);
    if (this.doc.querySelector('flow-tile-container.selected')) throw new Error('Clear selection in Flow after capturing the selected image list, then start the export.');
    this.editorMediaId = image.getAttribute('data-media-id')!;
    signal.throwIfAborted(); image.click();
    await boundedWait(() => {
      const pages = Array.from(this.doc.querySelectorAll<HTMLElement>('flow-editor-page')).filter(isVisible);
      if (pages.length !== 1) return;
      const images = Array.from(pages[0].querySelectorAll<HTMLImageElement>('img.read-only-image')).filter(isVisible);
      if (images.length !== 1 || !images[0].complete || !images[0].naturalWidth) return;
      this.assertEditorImage(); return true;
    }, 15000, signal, 'The queued image did not open in the editor.');
    const buttons = Array.from(this.editor().querySelectorAll<HTMLElement>('flow-editor-header button[aria-label="Download media"]')).filter(isVisible);
    if (buttons.length !== 1) throw new Error('Editor Download media button is missing or ambiguous.');
    const before = new Set(this.visibleMenus());
    this.enabled(buttons[0]); this.assertEditorImage(); signal.throwIfAborted(); buttons[0].click();
    return boundedWait(() => {
      this.assertEditorImage();
      const added = this.visibleMenus().filter(menu => !before.has(menu));
      if (added.length > 1) throw new Error('Multiple editor quality menus opened.');
      return added.length === 1 && this.findItem(added[0], quality) ? added[0] : undefined;
    }, TIMEOUTS.menu, signal, `Editor ${quality.toUpperCase()} option did not appear.`);
  }
  async returnToGrid(signal: AbortSignal) {
    if (!this.editorMediaId) return;
    const page = this.editor();
    const buttons = Array.from(page.querySelectorAll<HTMLElement>('flow-navigation-header button[aria-label="Back button to go to previous page"]')).filter(isVisible);
    if (buttons.length !== 1) throw new Error('Editor Back button is missing or ambiguous. Return to the grid before retrying.');
    this.enabled(buttons[0]); signal.throwIfAborted(); buttons[0].click();
    await boundedWait(() => !Array.from(this.doc.querySelectorAll('flow-editor-page')).some(isVisible) && this.doc.querySelector(FLOW.collection) ? true : undefined,
      TIMEOUTS.menu, signal, 'Flow did not return to the project grid.');
    this.editorMediaId = undefined;
  }
  async openDownloadMenu(menu: HTMLElement, signal: AbortSignal, quality: DownloadQuality = '2k'): Promise<HTMLElement> {
    const download = this.uniqueItem(menu, 'download');
    // Flow can omit aria-haspopup; validate the newly opened quality menu instead.
    const before = new Set(this.visibleMenus());
    this.enabled(download); signal.throwIfAborted(); download.click();
    return boundedWait(() => {
      if (!menu.isConnected || !isVisible(menu)) throw new Error('Image menu disappeared before Download opened.');
      const added = this.visibleMenus().filter(item => !before.has(item));
      if (added.length > 1) throw new Error('Multiple submenus opened. Refusing an ambiguous quality action.');
      if (added.length !== 1) return;
      const linkedId = download.getAttribute('aria-controls');
      if (linkedId && added[0].id !== linkedId) throw new Error('Download submenu does not match its ARIA relationship.');
      return this.findItem(added[0], quality) ? added[0] : undefined;
    }, TIMEOUTS.menu, signal, `Download submenu or ${quality.toUpperCase()} option did not appear within 5 seconds.`);
  }
  select2KDownload(menu: HTMLElement, signal: AbortSignal) { this.selectQualityDownload(menu, signal, '2k'); }
  selectQualityDownload(menu: HTMLElement, signal: AbortSignal, quality: DownloadQuality) {
    const item = this.uniqueItem(menu, quality);
    this.enabled(item); signal.throwIfAborted(); item.click();
  }
  async waitFor2KReady(menu: HTMLElement, signal: AbortSignal) { return this.waitForQualityReady(menu, signal, '2k'); }
  async waitForQualityReady(menu: HTMLElement, signal: AbortSignal, quality: DownloadQuality) {
    await boundedWait(() => {
      if (!menu.isConnected || !isVisible(menu)) throw new Error(`The quality menu disappeared before ${quality.toUpperCase()} became available.`);
      const item = this.findItem(menu, quality); if (!item) return;
      const state = describe(item).state;
      return !state.disabled && !state.busy ? true : undefined;
    }, TIMEOUTS.download, signal, `${quality.toUpperCase()} remained disabled or processing for 120 seconds.`);
  }
  private visibleMenus(): HTMLElement[] { return Array.from(this.doc.querySelectorAll<HTMLElement>(FLOW.menu)).filter(isVisible); }
  private uniqueItem(menu: HTMLElement, kind: 'download' | DownloadQuality): HTMLElement {
    const item = this.findItem(menu, kind);
    if (!item) throw new Error(kind !== 'download' ? `${kind.toUpperCase()} option not found.` : 'Download menu item not found.');
    return item;
  }
  private findItem(menu: HTMLElement, kind: 'download' | DownloadQuality): HTMLElement | undefined {
    const items = Array.from(menu.querySelectorAll<HTMLElement>(FLOW.item)).filter(item => item.closest(FLOW.menu) === menu && (kind === 'download' ? controlKind(item) === kind : (matchesQuality(accessibleName(item), kind) || Array.from(item.querySelectorAll('span')).some(span => matchesQuality(span.textContent ?? '', kind)))) && isVisible(item));
    if (items.length > 1) throw new Error(kind !== 'download' ? `${kind.toUpperCase()} option is ambiguous.` : 'Download menu item is ambiguous.');
    return items[0];
  }
  private enabled(button: HTMLElement, requireVisible = true) {
    const state = describe(button).state;
    if (!button.isConnected || (requireVisible && (!button.getClientRects().length || !state.visible))) throw new Error('Flow control is no longer rendered.');
    if (state.disabled || state.busy) throw new Error('Flow control is disabled or processing. Wait before trying again.');
  }
}
