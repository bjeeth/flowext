import { collection } from './asset-discovery';
import { attributes, isFlowPage, isVisible, nodeId } from './flow-dom';
import { FLOW, PROBES } from './selectors';
import type { SelectionCheckpoint, SelectionNode, SelectionSnapshot } from '../shared/selection-types';

/** Evidence only. No selected/not-selected interpretation and no DOM writes or clicks. */
export function selectionNode(element: Element): SelectionNode {
  const classes = Array.from(element.classList);
  const input = element instanceof HTMLInputElement && ['checkbox', 'radio'].includes(element.type) ? element : undefined;
  return {
    nodeId: nodeId(element), parentNodeId: element.parentElement ? nodeId(element.parentElement) : null,
    tag: element.tagName.toLowerCase(), role: element.getAttribute('role'),
    attributes: attributes(element, PROBES.selectionAttributes),
    attributeNames: element.getAttributeNames().filter(name => name !== 'value' && !/^on/i.test(name)).slice(0, 60).map(value => value.slice(0, 80)),
    classes: classes.slice(0, 24).map(value => value.slice(0, 80)),
    classesTruncated: classes.length > 24 || classes.some(value => value.length > 80),
    visible: isVisible(element), disabled: element.matches(':disabled') || element.getAttribute('aria-disabled') === 'true',
    ...(input ? { checked: input.checked, indeterminate: input.indeterminate } : {}),
  };
}

export function inspectSelection(doc: Document, url: string, checkpoint: SelectionCheckpoint): SelectionSnapshot {
  if (!isFlowPage(url)) throw new Error('Selection capture is restricted to https://flow.google.com/.');
  const root = collection(doc);
  const inViewport = (image: HTMLImageElement) => {
    const rect = image.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.right > 0 &&
      rect.top < (doc.defaultView?.innerHeight ?? 0) && rect.left < (doc.defaultView?.innerWidth ?? 0);
  };
  const images = Array.from(root.querySelectorAll<HTMLImageElement>(FLOW.image)).sort((a, b) => Number(inViewport(b)) - Number(inViewport(a)));
  const nodes: Record<string, SelectionNode> = Object.create(null) as Record<string, SelectionNode>;
  let truncated = images.length > PROBES.maxSelectionCards; let nodeCount = 0;
  const record = (element: Element) => {
    if (nodes[nodeId(element)]) return nodes[nodeId(element)];
    const evidence = selectionNode(element);
    if (nodeCount < PROBES.maxSelectionNodes) { nodes[evidence.nodeId] = evidence; nodeCount++; }
    else truncated = true;
    if (evidence.classesTruncated || element.getAttributeNames().length > 60 || element.getAttributeNames().some(name => name.length > 80)) truncated = true;
    return evidence;
  };
  const controls = Array.from(root.querySelectorAll(PROBES.selectionControls));
  if (controls.length > PROBES.maxSelectionControls) truncated = true;
  const controlEvidence = controls.slice(0, PROBES.maxSelectionControls).map(record);
  const cards = images.slice(0, PROBES.maxSelectionCards).flatMap(image => {
    const tile = image.closest(FLOW.tile);
    if (!tile || tile.querySelectorAll(FLOW.image).length !== 1) { truncated = true; return []; }
    const ancestors: string[] = [];
    for (let element: Element | null = image, depth = 0; element && depth < 12; element = element.parentElement, depth++) {
      ancestors.push(record(element).nodeId); if (element === root) break;
    }
    if (ancestors.at(-1) !== nodeId(root)) truncated = true;
    // Include single-image wrapper siblings (e.g. a checkbox next to the image tile).
    let context = tile;
    for (let parent = tile.parentElement; parent && parent !== root && parent.querySelectorAll(FLOW.image).length === 1; parent = parent.parentElement) context = parent;
    const descendants = Array.from(context.querySelectorAll('*'));
    const descendantsTruncated = descendants.length > PROBES.maxSelectionDescendants;
    // Semantic state controls take priority over decorative descendants in the bounded sample.
    const controls = descendants.filter(element => element.matches(PROBES.selectionControls));
    const other = descendants.filter(element => !element.matches(PROBES.selectionControls));
    const descendantNodeIds = [...controls, ...other].slice(0, PROBES.maxSelectionDescendants).map(element => record(element).nodeId);
    if (descendantsTruncated) truncated = true;
    return [{ mediaId: image.getAttribute('data-media-id')!.slice(0, 160), mediaNodeId: record(image).nodeId,
      tileNodeId: record(tile).nodeId, ancestorNodeIds: ancestors, descendantNodeIds, descendantsTruncated }];
  });
  return { capturedAt: new Date().toISOString(), checkpoint, origin: new URL(url).origin, collection: record(root),
    cards, controls: controlEvidence, nodes,
    renderedImageCount: images.length, truncated,
    limitations: [
      'Read-only evidence; checkpoint labels describe the requested manual procedure, not verified selection counts.',
      'Rendered image cards only. No automatic scrolling; offscreen or virtualized selections can be absent.',
      'Generic state/checkbox/class probes are diagnostic evidence, not verified Flow selection selectors.',
      'Media IDs and CSS classes can be private; review before sharing. Text, URLs, form values, cookies and tokens are omitted.',
      'Viewport cards are prioritized. Card/descendant/control/node/class limits and ancestor depth are bounded; truncation is reported.',
    ] };
}
