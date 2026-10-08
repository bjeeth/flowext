import { controlKind, describe, isVisible, nodeId } from './flow-dom';
import { FLOW, TIMEOUTS } from './selectors';
import type { SingleAsset } from '../shared/automation-types';

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
    const images = Array.from(this.doc.querySelectorAll<HTMLImageElement>(FLOW.image)).filter(image => {
      const r = image.getBoundingClientRect();
      return isVisible(image) && r.bottom > 0 && r.right > 0 && r.top < (view?.innerHeight ?? 0) && r.left < (view?.innerWidth ?? 0);
    });
    const result: SingleAsset[] = [];
    this.choices.clear();
    for (const image of images) {
      const tile = image.closest(FLOW.tile);
      const mediaId = image.getAttribute('data-media-id');
      if (!tile || tile.querySelectorAll(FLOW.image).length !== 1 || !mediaId || tile.querySelectorAll(FLOW.more).length !== 1) continue;
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
    const tile = image.closest(FLOW.tile)!;
    const buttons = Array.from(tile.querySelectorAll<HTMLElement>(FLOW.more));
    if (buttons.length !== 1 || controlKind(buttons[0]) !== 'more') throw new Error('Could not uniquely identify this image’s More menu. Flow UI changed.');
    const more = buttons[0];
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
  async openDownloadMenu(menu: HTMLElement, signal: AbortSignal): Promise<HTMLElement> {
    const download = this.uniqueItem(menu, 'download');
    if (download.getAttribute('aria-haspopup') !== 'menu') throw new Error('Download is no longer a submenu control. Flow UI changed.');
    const before = new Set(this.visibleMenus());
    this.enabled(download); signal.throwIfAborted(); download.click();
    return boundedWait(() => {
      if (!menu.isConnected || !isVisible(menu)) throw new Error('Image menu disappeared before Download opened.');
      const added = this.visibleMenus().filter(item => !before.has(item));
      if (added.length > 1) throw new Error('Multiple submenus opened. Refusing an ambiguous 2K action.');
      if (added.length !== 1) return;
      const linkedId = download.getAttribute('aria-controls');
      if (linkedId && added[0].id !== linkedId) throw new Error('Download submenu does not match its ARIA relationship.');
      return this.findItem(added[0], '2k') ? added[0] : undefined;
    }, TIMEOUTS.menu, signal, 'Download submenu or 2K Upscaled option did not appear within 5 seconds.');
  }
  select2KDownload(menu: HTMLElement, signal: AbortSignal) {
    const item = this.uniqueItem(menu, '2k');
    this.enabled(item); signal.throwIfAborted(); item.click();
  }
  async waitFor2KReady(menu: HTMLElement, signal: AbortSignal) {
    await boundedWait(() => {
      if (!menu.isConnected || !isVisible(menu)) throw new Error('The quality menu disappeared before 2K became available.');
      const item = this.findItem(menu, '2k'); if (!item) return;
      const state = describe(item).state;
      return !state.disabled && !state.busy ? true : undefined;
    }, TIMEOUTS.download, signal, '2K Upscaled remained disabled or processing for 120 seconds.');
  }
  private visibleMenus(): HTMLElement[] { return Array.from(this.doc.querySelectorAll<HTMLElement>(FLOW.menu)).filter(isVisible); }
  private uniqueItem(menu: HTMLElement, kind: 'download' | '2k'): HTMLElement {
    const item = this.findItem(menu, kind);
    if (!item) throw new Error(kind === '2k' ? '2K Upscaled option not found.' : 'Download menu item not found.');
    return item;
  }
  private findItem(menu: HTMLElement, kind: 'download' | '2k'): HTMLElement | undefined {
    const items = Array.from(menu.querySelectorAll<HTMLElement>(FLOW.item)).filter(item => item.closest(FLOW.menu) === menu && controlKind(item) === kind && isVisible(item));
    if (items.length > 1) throw new Error(kind === '2k' ? '2K Upscaled option is ambiguous.' : 'Download menu item is ambiguous.');
    return items[0];
  }
  private enabled(button: HTMLElement, requireVisible = true) {
    const state = describe(button).state;
    if (!button.isConnected || (requireVisible && (!button.getClientRects().length || !state.visible))) throw new Error('Flow control is no longer rendered.');
    if (state.disabled || state.busy) throw new Error('Flow control is disabled or processing. Wait before trying again.');
  }
}
