import { PROBES } from './selectors';
import { describe } from './flow-dom';
import type { ElementEvidence } from '../shared/types';

/** Normalized, bounded context graph; id references never trigger actions. */
export class EvidenceCollector {
  readonly nodes: Record<string, ElementEvidence> = Object.create(null) as Record<string, ElementEvidence>;
  truncated = false;
  private readonly recorded = new WeakMap<Element, ElementEvidence>();
  private count = 0;
  private record(el: Element): ElementEvidence {
    const cached = this.recorded.get(el);
    if (cached) return cached;
    const evidence = describe(el);
    this.recorded.set(el, evidence);
    if (this.count < PROBES.maxNodes) { this.nodes[evidence.nodeId] = evidence; this.count++; }
    else this.truncated = true;
    if (evidence.attributesTruncated || evidence.referencesTruncated) this.truncated = true;
    return evidence;
  }
  capture(el: Element): ElementEvidence {
    const evidence = this.record(el);
    // Ancestor context exposes card markers and selections missed by a nearest-container guess.
    for (let p = el.parentElement, depth = 0; p && depth < PROBES.maxAncestorDepth; p = p.parentElement, depth++) this.record(p);
    // Record resolved menu/label/description targets, even if rendered as portals elsewhere.
    for (const attribute of PROBES.referenceAttributes) {
      const ids = el.getAttribute(attribute)?.trim().split(/\s+/).filter(Boolean) ?? [];
      for (const id of ids.slice(0, PROBES.maxReferences)) {
        const target = el.ownerDocument.getElementById(id);
        if (target) {
          this.record(target);
          for (let p = target.parentElement, depth = 0; p && depth < PROBES.maxAncestorDepth; p = p.parentElement, depth++) this.record(p);
        }
      }
    }
    return evidence;
  }
}
