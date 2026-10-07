import type { EvidenceExport, InspectionReport } from './types';

export interface EvidenceReview {
  valid: boolean;
  errors: string[];
  warnings: string[];
  snapshots: number;
  coverage: Record<string, boolean>;
}
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const string = (v: unknown): v is string => typeof v === 'string';
const strings = (v: unknown): v is string[] => Array.isArray(v) && v.every(string);
const bool = (v: unknown): v is boolean => typeof v === 'boolean';
const count = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0;
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0;
const fields = (v: unknown, names: string[], test: (field: unknown) => boolean) => object(v) && names.every(k => test(v[k]));
const owns = (o: object, k: PropertyKey) => Object.prototype.hasOwnProperty.call(o, k);

/** Validate untrusted pasted/file JSON. Never evaluate selectors, HTML, or commands. */
export function reviewEvidence(input: unknown): EvidenceReview {
  const result: EvidenceReview = { valid: false, errors: [], warnings: [], snapshots: 0, coverage: {
    imageCandidates: false, moreAssociatedWithCandidate: false, downloadInMenu: false, qualityInMenu: false,
    explicitMenuLinks: false, identifierHints: false, loadingStates: false, disabledStates: false, manualInteractions: false,
  } };
  const fail = (path: string, reason: string) => { if (result.errors.length < 30) result.errors.push(`${path}: ${reason}`); };
  const warn = (text: string) => { if (!result.warnings.includes(text)) result.warnings.push(text); };
  if (!object(input) || input.phase !== 1 || input.formatVersion !== 2) {
    fail('capture', 'Expected Phase 1 formatVersion 2. Old captures are not upgraded or filled with guessed evidence; recapture with the rebuilt inspector.');
    return result;
  }
  if (!string(input.sessionId) || !input.sessionId) fail('sessionId', 'Missing page-session identity.');
  if (!count(input.historyDropped)) fail('historyDropped', 'Expected a nonnegative integer.');
  else if (input.historyDropped) warn('Rolling history dropped older snapshots; check the pinned baseline/menu snapshots and retained manual interactions.');
  if (!object(input.snapshots) || Object.keys(input.snapshots).length > 40 || !Object.keys(input.snapshots).length) {
    fail('snapshots', 'Expected 1–40 actual captured snapshots.'); return result;
  }
  const snapshots = input.snapshots;
  result.snapshots = Object.keys(snapshots).length;
  const checkRef = (ref: unknown, path: string) => {
    if (!string(ref) || !owns(snapshots, ref)) fail(path, 'Snapshot reference does not resolve.');
  };
  checkRef(input.latestSnapshotId, 'latestSnapshotId');
  for (const key of ['historySnapshotIds', 'interactionSnapshotIds'] as const) {
    if (!strings(input[key]) || input[key].length > (key === 'historySnapshotIds' ? 20 : 12)) fail(key, 'Expected a bounded snapshot reference array.');
    else input[key].forEach((id, index) => checkRef(id, `${key}[${index}]`));
  }
  if (!object(input.checkpoints)) fail('checkpoints', 'Missing retained baseline.');
  else {
    checkRef(input.checkpoints.initial, 'checkpoints.initial');
    for (const key of ['downloadVisible', 'qualityVisible']) if (owns(input.checkpoints, key)) checkRef(input.checkpoints[key], `checkpoints.${key}`);
  }

  function checkNode(node: unknown, path: string): boolean {
    if (!object(node)) { fail(path, 'Expected node evidence.'); return false; }
    for (const key of ['nodeId', 'path', 'tag']) if (!string(node[key]) || !node[key]) fail(`${path}.${key}`, 'Missing structural evidence.');
    for (const key of ['parentNodeId', 'role', 'name']) if (node[key] !== null && !string(node[key])) fail(`${path}.${key}`, 'Expected string or null.');
    for (const key of ['pathTruncated', 'attributesTruncated', 'referencesTruncated']) if (!bool(node[key])) fail(`${path}.${key}`, 'Expected explicit truncation flag.');
    if (!strings(node.attributeNames) || node.attributeNames.length > 60) fail(`${path}.attributeNames`, 'Expected bounded attribute names, not values.');
    if (!object(node.attributes) || !Object.values(node.attributes).every(string)) fail(`${path}.attributes`, 'Expected metadata string map.');
    if (!Array.isArray(node.labelMatches) || node.labelMatches.length > 44 || node.labelMatches.some(m => !object(m) || !string(m.label) || !['more', 'download', '2k', 'original'].includes(String(m.kind)) || !['aria-label', 'aria-labelledby', 'title', 'text', 'descendant-text'].includes(String(m.source)))) fail(`${path}.labelMatches`, 'Invalid workflow label hints.');
    if (!fields(node.state, ['visible', 'disabled', 'nativeDisabled', 'ariaDisabled', 'inert', 'busy'], bool)) fail(`${path}.state`, 'Missing visibility/loading/disabled signals.');
    if (!Array.isArray(node.references) || node.references.length > 32 || node.references.some(r => !object(r) || !string(r.attribute) || !string(r.targetId) || !bool(r.resolved) || (r.targetNodeId !== null && !string(r.targetNodeId)) || (r.resolved ? r.targetNodeId === null : r.targetNodeId !== null))) fail(`${path}.references`, 'Invalid ARIA relationship evidence.');
    return true;
  }
  for (const [snapshotIndex, [id, value]] of Object.entries(snapshots).entries()) {
    const path = `snapshots[${snapshotIndex}]`;
    if (!object(value) || value.schemaVersion !== 2 || value.snapshotId !== id) { fail(path, 'Expected a schemaVersion 2 snapshot with matching ID.'); continue; }
    if (!string(value.capturedAt) || !Number.isFinite(Date.parse(value.capturedAt))) fail(`${path}.capturedAt`, 'Missing valid capture time.');
    if (!object(value.page) || value.page.origin !== 'https://flow.google.com' || value.page.isFlow !== true) fail(`${path}.page`, 'Capture must come from exactly HTTPS flow.google.com.');
    if (!['NO_CANDIDATES', 'CANDIDATES_FOUND'].includes(String(value.state))) fail(`${path}.state`, 'Invalid Flow inspection state.');
    if (!bool(value.truncated) || !strings(value.truncationReasons) || !strings(value.limitations) || !count(value.contextDepth)) fail(path, 'Missing capture bounds/limitations.');
    if (value.truncated) warn('One or more snapshots were truncated; do not infer absent controls or identities from them.');
    if (!object(value.nodes) || Object.keys(value.nodes).length > 1200) { fail(`${path}.nodes`, 'Missing or oversized context graph.'); continue; }
    const nodes = value.nodes;
    for (const [nodeIndex, [nodeKey, node]] of Object.entries(nodes).entries()) {
      checkNode(node, `${path}.nodes[${nodeIndex}]`);
      if (object(node) && node.nodeId !== nodeKey) fail(`${path}.nodes[${nodeIndex}]`, 'Node ID does not match the graph key.');
    }
    const checkNodeRef = (nodeId: unknown, where: string) => {
      if (!string(nodeId) || !owns(nodes, nodeId)) {
        if (value.truncated) warn('A truncated snapshot has missing graph nodes.');
        else fail(where, 'Referenced captured node is missing.');
      }
    };
    if (!Array.isArray(value.candidates) || value.candidates.length > 150) fail(`${path}.candidates`, 'Missing or oversized candidate array.');
    else for (const [index, candidate] of value.candidates.entries()) {
      const cp = `${path}.candidates[${index}]`;
      if (!object(candidate)) { fail(cp, 'Expected candidate evidence.'); continue; }
      if (!string(candidate.candidateId) || candidate.confidence !== 'candidate-only' || !['single-image-container', 'ambiguous'].includes(String(candidate.association)) || !bool(candidate.loaded) || !bool(candidate.contextControlsTruncated)) fail(cp, 'Missing candidate identity/association/state.');
      checkNode(candidate.media, `${cp}.media`); checkNode(candidate.container, `${cp}.container`);
      for (const key of ['media', 'container']) if (object(candidate[key])) checkNodeRef(candidate[key].nodeId, `${cp}.${key}.nodeId`);
      if (!strings(candidate.contextControlNodeIds) || candidate.contextControlNodeIds.length > 30) fail(`${cp}.contextControlNodeIds`, 'Missing or oversized card/control relationships.');
      else candidate.contextControlNodeIds.forEach(n => checkNodeRef(n, `${cp}.contextControlNodeIds`));
      if (!object(candidate.identifierHints) || !Object.values(candidate.identifierHints).every(string) || !object(candidate.selectedSignals) || !Object.values(candidate.selectedSignals).every(string)) fail(cp, 'Missing identifier/selection metadata.');
      if (!object(candidate.imageState) || !bool(candidate.imageState.complete) || !fields(candidate.imageState, ['naturalWidth', 'naturalHeight', 'renderedWidth', 'renderedHeight'], finite) || !string(candidate.imageState.loading) || !string(candidate.imageState.decoding)) fail(`${cp}.imageState`, 'Missing image loading/dimension signals.');
      if (!Array.isArray(candidate.moreControls) || candidate.moreControls.length > 30) fail(`${cp}.moreControls`, 'Missing or oversized More/control relationships.');
      else for (const control of candidate.moreControls) {
        checkNode(control, `${cp}.moreControls`);
        if (!object(control) || control.kind !== 'more' || !bool(control.disabled)) fail(`${cp}.moreControls`, 'Invalid More control.');
        else checkNodeRef(control.nodeId, `${cp}.moreControls.nodeId`);
      }
    }
    if (!Array.isArray(value.controls) || value.controls.length > 100) fail(`${path}.controls`, 'Missing or oversized controls array.');
    else for (const control of value.controls) {
      checkNode(control, `${path}.controls`);
      if (!object(control) || !['more', 'download', '2k', 'original'].includes(String(control.kind)) || !bool(control.disabled)) fail(`${path}.controls`, 'Invalid workflow control.');
      else checkNodeRef(control.nodeId, `${path}.controls.nodeId`);
    }
    if (!Array.isArray(value.menus) || value.menus.length > 20) fail(`${path}.menus`, 'Missing or oversized menu structure.');
    else for (const menu of value.menus) { checkNode(menu, `${path}.menus`); if (object(menu)) checkNodeRef(menu.nodeId, `${path}.menus.nodeId`); }
    if (!Array.isArray(value.menuContexts) || value.menuContexts.length > 20) fail(`${path}.menuContexts`, 'Missing or oversized menu/control membership.');
    else for (const menu of value.menuContexts) {
      if (!object(menu) || !strings(menu.controlNodeIds) || menu.controlNodeIds.length > 50 || !bool(menu.controlsTruncated)) { fail(`${path}.menuContexts`, 'Invalid menu context.'); continue; }
      checkNodeRef(menu.menuNodeId, `${path}.menuContexts.menuNodeId`);
      menu.controlNodeIds.forEach(n => checkNodeRef(n, `${path}.menuContexts.controlNodeIds`));
    }
    if (value.manualInteraction !== null) {
      const action = value.manualInteraction;
      if (!object(action) || !['click', 'pointerover', 'focusin'].includes(String(action.type)) || !string(action.capturedAt) || !Number.isFinite(Date.parse(action.capturedAt))) fail(`${path}.manualInteraction`, 'Invalid manual interaction.');
      else { checkNodeRef(action.targetNodeId, `${path}.manualInteraction.targetNodeId`); if (action.controlNodeId !== null) checkNodeRef(action.controlNodeId, `${path}.manualInteraction.controlNodeId`); }
    }
    if (value.activeElementNodeId !== null) checkNodeRef(value.activeElementNodeId, `${path}.activeElementNodeId`);
    if (!fields(value.totals, ['imageElements', 'videoElements', 'canvasElements', 'imagesNotLoaded'], count)) fail(`${path}.totals`, 'Invalid media totals.');
    if (!Array.isArray(value.scrollRegions) || value.scrollRegions.length > 15) fail(`${path}.scrollRegions`, 'Missing or oversized scroll-region array.');
    else for (const region of value.scrollRegions) {
      checkNode(region, `${path}.scrollRegions`);
      if (!object(region) || ['scrollTop', 'scrollHeight', 'clientHeight'].some(k => typeof region[k] !== 'number' || !Number.isFinite(region[k]))) fail(`${path}.scrollRegions`, 'Invalid scroll metrics.');
    }
  }
  if (result.errors.length) return result;
  // Shape validation succeeded. Coverage describes recorded evidence, never correctness on Flow.
  const capture = input as unknown as EvidenceExport;
  const reports = Object.values(capture.snapshots);
  for (const report of reports) {
    const c = result.coverage;
    c.imageCandidates ||= report.candidates.length > 0;
    c.moreAssociatedWithCandidate ||= report.candidates.some(a => a.association === 'single-image-container' && a.moreControls.length > 0);
    const menuControls = new Set(report.menuContexts.flatMap(m => m.controlNodeIds));
    c.downloadInMenu ||= report.controls.some(n => n.kind === 'download' && menuControls.has(n.nodeId));
    c.qualityInMenu ||= report.controls.some(n => n.kind === '2k' && menuControls.has(n.nodeId));
    c.explicitMenuLinks ||= Object.values(report.nodes).some(n => n.references.some(r => ['aria-controls', 'aria-owns'].includes(r.attribute) && r.resolved && r.targetNodeId !== null && report.menus.some(m => m.nodeId === r.targetNodeId)));
    c.identifierHints ||= report.candidates.some(a => Object.keys(a.identifierHints).length > 0 || ancestorIdentifierHint(a.media.nodeId, report));
    c.loadingStates ||= report.candidates.length > 0;
    c.disabledStates ||= report.controls.length > 0;
    c.manualInteractions ||= report.manualInteraction !== null;
  }
  for (const [key, present] of Object.entries(result.coverage)) if (!present) warn(`Evidence not observed: ${key}. Inspect again rather than inventing a selector or relationship.`);
  warn('Generated-image identity, identifier stability, portal ownership, and action semantics require human review of the real capture. Labels and single-image container heuristics do not prove them.');
  warn('Phase 1 does not observe browser download completion. Keep the manual download timing/result note separate; Phase 2 must use actual download lifecycle events.');
  result.valid = true;
  return result;
}
function ancestorIdentifierHint(id: string, report: InspectionReport): boolean {
  for (let depth = 0; id && depth <= report.contextDepth; depth++) {
    const node = report.nodes[id]; if (!node) break;
    if (Object.keys(node.attributes).some(k => k === 'id' || /^data-.*(?:id|key|uuid)$/.test(k))) return true;
    id = node.parentNodeId ?? '';
  }
  return false;
}
