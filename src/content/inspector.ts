import { detectCandidates } from './asset-detector';
import { describe, describeControl, isFlowPage, isVisible } from './flow-dom';
import { PROBES } from './selectors';
import type { InspectionReport } from '../shared/types';

export function inspectFlow(doc: Document, url: string): InspectionReport {
  const isFlow = isFlowPage(url);
  const report: InspectionReport = {
    schemaVersion: 1, capturedAt: new Date().toISOString(), page: { origin: new URL(url).origin, isFlow },
    state: 'NO_FLOW', candidates: [], controls: [], menus: [], scrollRegions: [],
    totals: { imageElements: 0, videoElements: 0, canvasElements: 0, imagesNotLoaded: 0 }, truncated: false,
    limitations: [
      'Generic diagnostic probes; Flow-specific selectors and asset identity have not been verified.',
      'Image elements are candidates, not a confirmed project asset count. Icons and thumbnails may be included.',
      'Only currently rendered light DOM is inspected. No automatic scrolling, shadow-root, or iframe traversal.',
      'Structural paths and candidate IDs may change during rerenders and are not automation selectors.',
      'Menus must be opened manually. No clicks, downloads, or download completion validation occur.',
      'Accessible names are approximated; unrecognized or localized controls may be omitted.',
    ],
  };
  if (!isFlow) return report;
  report.candidates = detectCandidates(doc);
  const images = Array.from(doc.querySelectorAll<HTMLImageElement>(PROBES.images));
  report.totals = {
    imageElements: images.length, videoElements: doc.querySelectorAll(PROBES.videos).length,
    canvasElements: doc.querySelectorAll(PROBES.canvases).length,
    imagesNotLoaded: images.filter(img => !img.complete || !img.naturalWidth).length,
  };
  const controls = Array.from(doc.querySelectorAll(PROBES.controls)).map(describeControl).filter(c => c !== undefined);
  report.controls = controls.slice(0, PROBES.maxControls);
  report.menus = Array.from(doc.querySelectorAll(PROBES.menus)).filter(isVisible).slice(0, 20).map(describe);
  // A bounded structural scan suggests relevant scroll containers without moving them.
  const regions = new Set<Element>();
  const media = Array.from(doc.querySelectorAll(PROBES.media)).slice(0, PROBES.maxCandidates);
  for (const element of media) {
    for (let p = element.parentElement; p; p = p.parentElement) {
      if (p.scrollHeight > p.clientHeight + 4 && /auto|scroll/.test(getComputedStyle(p).overflowY)) regions.add(p);
    }
  }
  const root = doc.scrollingElement;
  if (root && root.scrollHeight > root.clientHeight + 4) regions.add(root);
  report.scrollRegions = [...regions].slice(0, PROBES.maxScrollRegions).map(el => ({
    ...describe(el), scrollTop: el.scrollTop, scrollHeight: el.scrollHeight, clientHeight: el.clientHeight,
  }));
  report.truncated = images.filter(isVisible).length > PROBES.maxCandidates || controls.length > PROBES.maxControls || regions.size > PROBES.maxScrollRegions;
  report.state = report.candidates.length ? 'CANDIDATES_FOUND' : 'NO_CANDIDATES';
  return report;
}
