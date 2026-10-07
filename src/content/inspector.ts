import { detectCandidates } from './asset-detector';
import { describeControl, isFlowPage, isVisible } from './flow-dom';
import { EvidenceCollector } from './evidence-collector';
import { PROBES } from './selectors';
import type { InspectionReport } from '../shared/types';

let nextSnapshot = 1;
export interface ManualInteractionInput { type: 'click' | 'pointerover' | 'focusin'; target: Element; capturedAt: string }
export function inspectFlow(doc: Document, url: string, interaction?: ManualInteractionInput, preferred?: HTMLImageElement): InspectionReport {
  const isFlow = isFlowPage(url);
  const report: InspectionReport = {
    schemaVersion: 2, snapshotId: `snapshot-${nextSnapshot++}`, capturedAt: new Date().toISOString(), page: { origin: new URL(url).origin, isFlow },
    state: 'NO_FLOW', candidates: [], controls: [], menus: [], menuContexts: [], nodes: {}, contextDepth: PROBES.maxAncestorDepth,
    manualInteraction: null, activeElementNodeId: null, scrollRegions: [],
    totals: { imageElements: 0, videoElements: 0, canvasElements: 0, imagesNotLoaded: 0 }, truncated: false, truncationReasons: [],
    limitations: [
      'Generic diagnostic probes; Flow-specific selectors and generated-asset identity have not been verified.',
      'Image elements are a bounded diagnostic sample, not a project asset count. Manual image context and viewport images are prioritized; icons/thumbnails may be included.',
      'Only currently rendered light DOM is inspected. No automatic scrolling, shadow-root, or iframe traversal.',
      'Node and candidate IDs are session-only. Structural paths may be truncated or nonunique and are not automation selectors.',
      'Ancestor context is depth-limited; a parent or referenced node may be outside the captured graph.',
      'Identifier attributes are hints only; stability across rerenders must be verified from real captures.',
      'Menus and downloads must be operated manually; browser download completion is not observed.',
      'Unrecognized names are omitted for privacy; labelMatches are hints, not verified accessible names.',
      'A manual interaction records the DOM before the normal page handler, not proof that the requested action succeeded.',
    ],
  };
  if (!isFlow) return report;
  const collector = new EvidenceCollector();
  const images = Array.from(doc.querySelectorAll<HTMLImageElement>(PROBES.images));
  report.totals = {
    imageElements: images.length, videoElements: doc.querySelectorAll(PROBES.videos).length,
    canvasElements: doc.querySelectorAll(PROBES.canvases).length,
    imagesNotLoaded: images.filter(img => !img.complete || !img.naturalWidth).length,
  };
  if (interaction) {
    const target = collector.capture(interaction.target);
    const control = interaction.target.closest(PROBES.controls);
    report.manualInteraction = { type: interaction.type, capturedAt: interaction.capturedAt,
      targetNodeId: target.nodeId, controlNodeId: control ? collector.capture(control).nodeId : null };
  }
  if (doc.activeElement && doc.activeElement !== doc.body && doc.activeElement !== doc.documentElement) {
    report.activeElementNodeId = collector.capture(doc.activeElement).nodeId;
  }
  const matched = Array.from(doc.querySelectorAll(PROBES.controls)).flatMap(el => {
    const control = describeControl(el);
    return control ? [{ el, control }] : [];
  });
  report.controls = matched.slice(0, PROBES.maxControls).map(({ control }) => control);
  for (const { el } of matched.slice(0, PROBES.maxControls)) collector.capture(el);
  const menus = Array.from(doc.querySelectorAll(PROBES.menus)).filter(isVisible);
  report.menus = menus.slice(0, PROBES.maxMenus).map(menu => collector.capture(menu));
  report.menuContexts = menus.slice(0, PROBES.maxMenus).map(menu => {
    const items = Array.from(menu.querySelectorAll(PROBES.controls));
    return { menuNodeId: collector.capture(menu).nodeId,
      controlNodeIds: items.slice(0, PROBES.maxMenuControls).map(el => collector.capture(el).nodeId),
      controlsTruncated: items.length > PROBES.maxMenuControls };
  });
  report.candidates = detectCandidates(doc, collector, preferred);
  report.sampling = { limit: PROBES.maxCandidates, strategy: 'manual-image-then-viewport',
    preferredMediaNodeId: preferred && doc.contains(preferred) ? collector.capture(preferred).nodeId : null };
  const regions = new Set<Element>();
  for (const element of Array.from(doc.querySelectorAll(PROBES.media)).slice(0, PROBES.maxCandidates)) {
    for (let p = element.parentElement; p; p = p.parentElement) {
      if (p.scrollHeight > p.clientHeight + 4 && /auto|scroll/.test(getComputedStyle(p).overflowY)) regions.add(p);
    }
  }
  const root = doc.scrollingElement;
  if (root && root.scrollHeight > root.clientHeight + 4) regions.add(root);
  report.scrollRegions = [...regions].slice(0, PROBES.maxScrollRegions).map(el => ({
    ...collector.capture(el), scrollTop: el.scrollTop, scrollHeight: el.scrollHeight, clientHeight: el.clientHeight,
  }));
  report.nodes = collector.nodes;
  if (images.filter(isVisible).length > PROBES.maxCandidates) report.truncationReasons.push('Image diagnostic sample limit reached; menu and manual-interaction context was prioritized.');
  if (matched.length > PROBES.maxControls) report.truncationReasons.push('Recognized control limit reached.');
  if (menus.length > PROBES.maxMenus || report.menuContexts.some(menu => menu.controlsTruncated)) report.truncationReasons.push('Menu or menu-control limit reached.');
  if (report.candidates.some(c => c.contextControlsTruncated)) report.truncationReasons.push('Card control limit reached.');
  if (regions.size > PROBES.maxScrollRegions) report.truncationReasons.push('Scroll-region limit reached.');
  if (collector.truncated) report.truncationReasons.push('Context node or attribute/reference limit reached.');
  report.truncated = report.truncationReasons.length > 0;
  report.state = report.candidates.length ? 'CANDIDATES_FOUND' : 'NO_CANDIDATES';
  return report;
}
