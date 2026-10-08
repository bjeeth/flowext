import { PROBES } from './selectors';
import type { ControlEvidence, ElementEvidence, LabelMatch, WorkflowControl } from '../shared/types';

const nodeIds = new WeakMap<Element, string>();
let nextNode = 1;
/** Session-only identity; never described as a durable Flow asset identifier. */
export function nodeId(el: Element): string {
  let id = nodeIds.get(el);
  if (!id) { id = `node-${nextNode++}`; nodeIds.set(el, id); }
  return id;
}

export function isFlowPage(url: string): boolean {
  try { const u = new URL(url); return u.protocol === 'https:' && u.hostname === 'flow.google.com'; }
  catch { return false; }
}

export function isVisible(el: Element): boolean {
  for (let p: Element | null = el; p; p = p.parentElement) {
    if (p.hasAttribute('hidden') || p.getAttribute('aria-hidden') === 'true') return false;
    const style = getComputedStyle(p);
    if (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse' || style.opacity === '0') return false;
  }
  return el.getClientRects().length > 0;
}

function labelledText(el: Element): string {
  return el.getAttribute('aria-labelledby')?.split(/\s+/).slice(0, PROBES.maxReferences)
    .map(id => el.ownerDocument.getElementById(id)?.textContent ?? '').join(' ').trim() ?? '';
}
const normalize = (text: string) => text.replace(/\s+/g, ' ').trim();
/** Diagnostic approximation; not a complete W3C accessible-name implementation. */
export function accessibleName(el: Element): string {
  return normalize(el.getAttribute('aria-label') || labelledText(el) || el.getAttribute('title') || el.textContent || '');
}
export function kindForName(name: string): WorkflowControl | undefined {
  return (Object.keys(PROBES.names) as WorkflowControl[]).find(kind => PROBES.names[kind].test(name));
}
export function controlKind(el: Element): WorkflowControl | undefined {
  const named = kindForName(accessibleName(el));
  if (named) return named;
  // Real 0.1.1 capture: Download's button contains an icon plus separate text spans.
  const kinds = new Set(labelMatches(el).map(match => match.kind));
  return kinds.size === 1 ? [...kinds][0] : undefined;
}

/** Capture only allowlisted workflow labels; arbitrary titles/prompts remain omitted. */
export function labelMatches(el: Element): LabelMatch[] {
  const sources: Array<[LabelMatch['source'], string]> = [
    ['aria-label', el.getAttribute('aria-label') ?? ''], ['aria-labelledby', labelledText(el)],
    ['title', el.getAttribute('title') ?? ''], ['text', el.textContent ?? ''],
  ];
  // Capture separate icon/text label spans without interpreting them as a verified control name.
  if (el.matches(PROBES.controls)) {
    for (const child of Array.from(el.querySelectorAll('*')).slice(0, PROBES.maxLabelChildren)) {
      if (!child.children.length && child.closest(PROBES.controls) === el) sources.push(['descendant-text', child.textContent ?? '']);
    }
  }
  return sources.flatMap(([source, raw]) => {
    const label = normalize(raw); const kind = kindForName(label);
    return kind ? [{ source, kind, label }] : [];
  });
}

export function attributes(el: Element, names: readonly string[]): Record<string, string> {
  return Object.fromEntries(names.flatMap(name => {
    const value = el.getAttribute(name);
    return value === null ? [] : [[name, value.slice(0, PROBES.maxAttributeLength)]];
  }));
}
export function identifierAttributes(el: Element): string[] {
  return [...new Set([...PROBES.identifierAttributes, ...el.getAttributeNames().filter(name => PROBES.identifierName.test(name))])];
}

/** Bounded structural evidence; paths are not advertised as unique selectors. */
export function structuralPath(el: Element): string {
  const parts: string[] = [];
  for (let p: Element | null = el; p && parts.length < PROBES.maxPathDepth; p = p.parentElement) {
    const tag = p.tagName.toLowerCase();
    const siblings = p.parentElement ? Array.from(p.parentElement.children).filter(e => e.tagName === p!.tagName) : [];
    parts.unshift(`${tag}:nth-of-type(${siblings.length ? siblings.indexOf(p) + 1 : 1})`);
  }
  return parts.join(' > ');
}

export function describe(el: Element): ElementEvidence {
  const classes = Array.from(el.classList);
  const ancestors: Element[] = [];
  for (let p: Element | null = el; p; p = p.parentElement) ancestors.push(p);
  const nativeDisabled = el.matches(':disabled');
  const ariaDisabled = ancestors.some(p => p.getAttribute('aria-disabled') === 'true');
  const inert = ancestors.some(p => p.hasAttribute('inert'));
  const names = [...new Set([...PROBES.safeAttributes, ...identifierAttributes(el)])];
  const mayLabel = el.matches(PROBES.controls) || el.matches(PROBES.menus) || !el.children.length;
  const name = mayLabel ? accessibleName(el) : '';
  const references: ElementEvidence['references'] = [];
  let referencesTruncated = false;
  for (const attribute of PROBES.referenceAttributes) {
    const ids = el.getAttribute(attribute)?.trim().split(/\s+/).filter(Boolean) ?? [];
    if (ids.length > PROBES.maxReferences || ids.some(id => id.length > PROBES.maxAttributeLength)) referencesTruncated = true;
    for (const id of ids.slice(0, PROBES.maxReferences)) {
      const target = el.ownerDocument.getElementById(id);
      references.push({ attribute, targetId: id.slice(0, PROBES.maxAttributeLength), targetNodeId: target ? nodeId(target) : null, resolved: !!target });
    }
  }
  return {
    nodeId: nodeId(el), parentNodeId: el.parentElement ? nodeId(el.parentElement) : null,
    path: structuralPath(el), pathTruncated: ancestors.length > PROBES.maxPathDepth,
    tag: el.tagName.toLowerCase(), role: el.getAttribute('role'),
    name: kindForName(name) ? name : null, labelMatches: mayLabel ? labelMatches(el) : [],
    attributes: attributes(el, names), attributeNames: el.getAttributeNames().filter(name => name !== 'value' && !/^on/i.test(name)).slice(0, 60),
    attributesTruncated: el.getAttributeNames().length > 60 || names.some(name => (el.getAttribute(name)?.length ?? 0) > PROBES.maxAttributeLength),
    classes: classes.slice(0, 24).map(value => value.slice(0, 80)),
    classesTruncated: classes.length > 24 || classes.some(value => value.length > 80),
    referencesTruncated, references,
    state: { visible: isVisible(el), disabled: nativeDisabled || ariaDisabled || inert, nativeDisabled, ariaDisabled, inert, busy: ancestors.some(p => p.getAttribute('aria-busy') === 'true') },
  };
}

export function describeControl(el: Element): ControlEvidence | undefined {
  const kind = controlKind(el);
  if (!kind || !isVisible(el)) return undefined;
  const evidence = describe(el);
  return { ...evidence, kind, disabled: evidence.state.disabled };
}

export function findCandidateContainer(image: Element): Element {
  let p = image.parentElement;
  for (let depth = 0; p && depth < PROBES.maxAncestorDepth; depth++, p = p.parentElement) {
    if (p === image.ownerDocument.body || p === image.ownerDocument.documentElement) break;
    const images = p.querySelectorAll(PROBES.images);
    const controls = Array.from(p.querySelectorAll(PROBES.controls));
    if (images.length === 1 && controls.some(el => controlKind(el) === 'more' || el.hasAttribute('aria-haspopup'))) return p;
    if (p.matches(PROBES.containers) && images.length === 1) return p;
    if (images.length > 1) break;
  }
  return image.parentElement ?? image;
}
