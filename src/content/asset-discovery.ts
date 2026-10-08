import { FLOW, DISCOVERY, PROBES, SELECTED_TILE } from './selectors';
import { isVisible } from './flow-dom';
import { boundedWait } from './flow-adapter';
import type { FlowAsset } from '../shared/bulk-types';
import type { DiscoverySnapshot } from '../shared/discovery-policy';
import { imageCardRejection, renderedImages } from './image-cards';
export { renderedImages } from './image-cards';

export async function delay(ms: number, signal: AbortSignal) {
  const wake = Date.now() + ms;
  await boundedWait(() => Date.now() >= wake ? true : undefined, ms + 250, signal, 'Flow did not settle within the bounded wait.');
}
export function collection(doc: Document): HTMLElement {
  const regions = Array.from(doc.querySelectorAll<HTMLElement>(FLOW.collection)).filter(isVisible);
  const withImages = regions.filter(region => region.querySelector(FLOW.image));
  const candidates = withImages.length ? withImages : regions;
  if (candidates.length !== 1) throw new Error('Could not uniquely identify the Flow project asset collection. Open a project or capture its changed DOM.');
  return candidates[0];
}
export function discoverySnapshot(root: HTMLElement): DiscoverySnapshot {
  const images = Array.from(root.querySelectorAll<HTMLImageElement>(FLOW.image));
  const rejections: DiscoverySnapshot['rejections'] = { missingId: 0, missingTile: 0, ambiguousTile: 0, hidden: 0 };
  let acceptedImages = 0, imagesWithoutMore = 0, imagesWithAmbiguousMore = 0;
  for (const image of images) {
    const reason = imageCardRejection(image);
    if (reason) { rejections[reason]++; continue; }
    acceptedImages++;
    const count = image.closest(FLOW.tile)!.querySelectorAll(FLOW.more).length;
    if (!count) imagesWithoutMore++;
    if (count > 1) imagesWithAmbiguousMore++;
  }
  return { capturedAt: new Date().toISOString(), pageImages: root.ownerDocument.querySelectorAll(PROBES.images).length,
    pageMatchingImages: root.ownerDocument.querySelectorAll(FLOW.image).length,
    collectionRegions: root.ownerDocument.querySelectorAll(FLOW.collection).length,
    collectionImages: images.length, acceptedImages, imagesWithoutMore, imagesWithAmbiguousMore, rejections,
    scrollTop: root.scrollTop, scrollHeight: root.scrollHeight, clientHeight: root.clientHeight };
}
/** Record IDs from observed image cards, never decorative/collection thumbnails or DOM indexes. */
export function scanCollection(root: HTMLElement, assets: Map<string, FlowAsset>) {
  for (const image of renderedImages(root)) {
    const id = image.getAttribute('data-media-id')!;
    const top = Math.max(0, root.scrollTop + image.getBoundingClientRect().top - root.getBoundingClientRect().top);
    const existing = assets.get(id);
    if (existing) existing.scrollTop = top;
    else assets.set(id, { id, index: assets.size + 1, label: `Image ${assets.size + 1}`, status: 'discovered', attempts: 0, scrollTop: top });
  }
}
/** Snapshot only rendered selections; never scan all images or change Flow selection. */
export function selectedAssets(doc: Document): FlowAsset[] {
  const root = collection(doc);
  const all = new Map<string, FlowAsset>();
  scanCollection(root, all);
  const selected = new Set<string>();
  for (const image of renderedImages(root)) {
    const wrapper = image.closest(SELECTED_TILE);
    if (!wrapper || !root.contains(wrapper) || !wrapper.classList.contains('selected')) continue;
    if (wrapper.querySelectorAll(FLOW.image).length !== 1) throw new Error('Ambiguous selected image card. No downloads were started.');
    const id = image.getAttribute('data-media-id')!;
    if (selected.has(id)) throw new Error('Duplicate selected image cards. No downloads were started.');
    selected.add(id);
  }
  if (!selected.size) throw new Error('No selected images are currently loaded in Flow. Select image cards in Flow first. No downloads were started.');
  return [...all.values()].filter(asset => selected.has(asset.id)).map((asset, i) => ({ ...asset, index: i + 1, label: `Selected image ${i + 1}` }));
}
export async function discoverAssets(doc: Document, signal: AbortSignal, progress: (assets: FlowAsset[]) => void, checkpoint: () => Promise<void>, diagnose: (snapshot: DiscoverySnapshot) => void = () => {}) {
  const root = collection(doc); const originalTop = root.scrollTop;
  const assets = new Map<string, FlowAsset>(); let deadline = Date.now() + DISCOVERY.timeout;
  let stable = 0;
  diagnose(discoverySnapshot(root));
  root.scrollTop = 0;
  try {
    for (let step = 0; step < DISCOVERY.maxSteps && Date.now() < deadline; step++) {
      const checkpointStart = Date.now(); await checkpoint(); deadline += Date.now() - checkpointStart; signal.throwIfAborted();
      if (!root.isConnected || collection(doc) !== root) throw new Error('Flow asset collection changed during discovery.');
      await delay(DISCOVERY.settle, signal);
      const before = assets.size; const height = root.scrollHeight;
      scanCollection(root, assets); diagnose(discoverySnapshot(root)); progress([...assets.values()].map(asset => ({ ...asset })));
      if (assets.size > DISCOVERY.maxAssets) throw new Error('Discovery asset limit reached. No partial collection was started.');
      const atEnd = root.scrollTop + root.clientHeight >= height - 3;
      if (atEnd) {
        await delay(DISCOVERY.bottomWait, signal);
        scanCollection(root, assets); diagnose(discoverySnapshot(root)); progress([...assets.values()].map(asset => ({ ...asset })));
        const unchanged = assets.size === before && root.scrollHeight === height && root.scrollTop + root.clientHeight >= root.scrollHeight - 3;
        stable = unchanged ? stable + 1 : 0;
        if (stable >= DISCOVERY.stableRounds) return [...assets.values()];
      } else stable = 0;
      const previous = root.scrollTop;
      root.scrollTop = Math.min(root.scrollHeight - root.clientHeight, previous + Math.max(1, root.clientHeight * 0.75));
      if (!atEnd && root.scrollTop === previous) throw new Error('The Flow collection did not scroll. Discovery stopped rather than claiming a complete count.');
    }
    throw new Error('Asset discovery timed out or reached its scan limit. The collection is incomplete; no downloads were started.');
  } finally { if (root.isConnected) root.scrollTop = originalTop; }
}
export async function reacquireAsset(doc: Document, asset: FlowAsset, signal: AbortSignal, checkPage: () => void = () => {}): Promise<HTMLImageElement> {
  const root = collection(doc);
  const find = () => {
    checkPage(); signal.throwIfAborted();
    if (!root.isConnected) throw new Error('Flow asset collection was replaced during reacquisition.');
    const matches = renderedImages(root).filter(image => image.getAttribute('data-media-id') === asset.id);
    if (matches.length > 1) {
      const visible = matches.filter(image => {
        const r = image.getBoundingClientRect(), region = root.getBoundingClientRect();
        return r.bottom > region.top && r.top < region.bottom;
      });
      if (visible.length === 1) return visible[0];
      throw new Error('Multiple rendered cards share this media ID. Refusing an ambiguous image action.');
    }
    return matches[0];
  };
  let image = find();
  if (!image) {
    root.scrollTop = Math.min(asset.scrollTop, Math.max(0, root.scrollHeight - root.clientHeight));
    await delay(DISCOVERY.settle, signal); image = find();
  }
  if (!image) {
    // A reorder may invalidate the saved scroll hint; bounded collection traversal reacquires by ID.
    root.scrollTop = 0; const deadline = Date.now() + DISCOVERY.timeout;
    for (let step = 0; step < DISCOVERY.maxSteps && Date.now() < deadline; step++) {
      checkPage(); await delay(DISCOVERY.settle, signal); image = find(); if (image) break;
      if (root.scrollTop + root.clientHeight >= root.scrollHeight - 3) break;
      root.scrollTop = Math.min(root.scrollHeight - root.clientHeight, root.scrollTop + Math.max(1, root.clientHeight * 0.75));
    }
  }
  if (!image) throw new Error('Image could not be reacquired by media ID. It may have been removed or its identifier changed.');
  image.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' });
  return boundedWait(() => {
    const current = find();
    return current?.complete && current.naturalWidth > 0 ? current : undefined;
  }, 15000, signal, 'Image did not finish loading after reacquisition.');
}
