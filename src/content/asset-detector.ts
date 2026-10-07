import { PROBES } from './selectors';
import { attributes, describe, describeControl, findCandidateContainer, isVisible } from './flow-dom';
import type { AssetCandidate, ControlEvidence } from '../shared/types';

// IDs identify DOM nodes during this inspector session; they are NOT durable asset IDs.
const candidateIds = new WeakMap<Element, string>();
let nextCandidate = 1;
export function detectCandidates(doc: Document): AssetCandidate[] {
  return Array.from(doc.querySelectorAll<HTMLImageElement>(PROBES.images))
    .filter(isVisible).slice(0, PROBES.maxCandidates).map(image => {
      const container = findCandidateContainer(image);
      let candidateId = candidateIds.get(image);
      if (!candidateId) { candidateId = `candidate-${nextCandidate++}`; candidateIds.set(image, candidateId); }
      const moreControls = container.querySelectorAll(PROBES.images).length === 1
        ? Array.from(container.querySelectorAll(PROBES.controls))
          .map(describeControl).filter((control): control is ControlEvidence => control !== undefined && control.kind === 'more')
        : [];
      return {
        candidateId, confidence: 'candidate-only', media: describe(image), container: describe(container),
        moreControls, loaded: image.complete && image.naturalWidth > 0,
        identifierHints: attributes(container, PROBES.identifierAttributes),
        selectedSignals: attributes(container, PROBES.selectedAttributes),
      };
    });
}
