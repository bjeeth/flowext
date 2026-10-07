import { rankInspectionTargets } from './sampling';
import { PROBES } from './selectors';
import { attributes, describeControl, findCandidateContainer, identifierAttributes, isVisible } from './flow-dom';
import { EvidenceCollector } from './evidence-collector';
import type { AssetCandidate, ControlEvidence } from '../shared/types';

export function detectCandidates(doc: Document, collector = new EvidenceCollector(), preferred?: HTMLImageElement): AssetCandidate[] {
  const viewportWidth = doc.defaultView?.innerWidth ?? 0;
  const viewportHeight = doc.defaultView?.innerHeight ?? 0;
  const ranked = rankInspectionTargets(Array.from(doc.querySelectorAll<HTMLImageElement>(PROBES.images)).map((image, order) => {
    const rect = image.getBoundingClientRect();
    return { value: image, order, preferred: image === preferred,
      inViewport: rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.right > 0 && rect.top < viewportHeight && rect.left < viewportWidth };
  }));
  return ranked.filter(isVisible).slice(0, PROBES.maxCandidates).map(image => {
      const container = findCandidateContainer(image);
      const single = container.querySelectorAll(PROBES.images).length === 1;
      const contextControls = single ? Array.from(container.querySelectorAll(PROBES.controls)) : [];
      const media = collector.capture(image);
      const contextControlNodeIds = contextControls.slice(0, PROBES.maxContextControls).map(el => collector.capture(el).nodeId);
      const moreControls = contextControls.slice(0, PROBES.maxContextControls).map(describeControl)
        .filter((control): control is ControlEvidence => control !== undefined && control.kind === 'more');
      const rect = image.getBoundingClientRect();
      return {
        candidateId: `candidate:${media.nodeId}`, confidence: 'candidate-only', association: single ? 'single-image-container' : 'ambiguous',
        media, container: collector.capture(container), moreControls, contextControlNodeIds,
        contextControlsTruncated: contextControls.length > PROBES.maxContextControls,
        loaded: image.complete && image.naturalWidth > 0,
        imageState: { complete: image.complete, naturalWidth: image.naturalWidth, naturalHeight: image.naturalHeight,
          renderedWidth: rect.width, renderedHeight: rect.height, loading: image.loading ?? "", decoding: image.decoding ?? "" },
        identifierHints: attributes(container, identifierAttributes(container)),
        selectedSignals: attributes(container, PROBES.selectedAttributes),
      };
    });
}
