import { PROBES } from './selectors';
import type { ControlEvidence, ElementEvidence, WorkflowControl } from '../shared/types';

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

/** Diagnostic approximation; not a complete W3C accessible-name implementation. */
export function accessibleName(el: Element): string {
  const labelledBy = el.getAttribute('aria-labelledby');
  const labelled = labelledBy?.split(/\s+/).map(id => el.ownerDocument.getElementById(id)?.textContent ?? '').join(' ').trim();
  return (el.getAttribute('aria-label') || labelled || el.getAttribute('title') || el.textContent || '').replace(/\s+/g, ' ').trim();
}

export function controlKind(el: Element): WorkflowControl | undefined {
  const name = accessibleName(el);
  return (Object.keys(PROBES.names) as WorkflowControl[]).find(kind => PROBES.names[kind].test(name));
}

export function attributes(el: Element, names: readonly string[]): Record<string, string> {
  return Object.fromEntries(names.flatMap(name => {
    const value = el.getAttribute(name);
    return value === null ? [] : [[name, value.slice(0, 160)]];
  }));
}

/** Structural path avoids URLs, prompts, image alt text, and arbitrary class names. */
export function structuralPath(el: Element): string {
  const parts: string[] = [];
  for (let p: Element | null = el; p && parts.length < 8; p = p.parentElement) {
    const tag = p.tagName.toLowerCase();
    const siblings = p.parentElement ? Array.from(p.parentElement.children).filter(e => e.tagName === p!.tagName) : [];
    parts.unshift(`${tag}:nth-of-type(${siblings.length ? siblings.indexOf(p) + 1 : 1})`);
  }
  return parts.join(' > ');
}

export function describe(el: Element): ElementEvidence {
  return {
    path: structuralPath(el), tag: el.tagName.toLowerCase(), role: el.getAttribute('role'),
    // Only names of recognized workflow controls are captured.
    name: controlKind(el) ? accessibleName(el) : null,
    attributes: attributes(el, PROBES.safeAttributes),
  };
}

export function describeControl(el: Element): ControlEvidence | undefined {
  const kind = controlKind(el);
  if (!kind || !isVisible(el)) return undefined;
  return { ...describe(el), kind, disabled: el.hasAttribute('disabled') || el.getAttribute('aria-disabled') === 'true' };
}

export function findCandidateContainer(image: Element): Element {
  let p = image.parentElement;
  for (let depth = 0; p && depth < PROBES.maxAncestorDepth; depth++, p = p.parentElement) {
    if (p === image.ownerDocument.body || p === image.ownerDocument.documentElement) break;
    const images = p.querySelectorAll(PROBES.images);
    const controls = Array.from(p.querySelectorAll(PROBES.controls));
    if (images.length === 1 && controls.some(el => controlKind(el) === 'more')) return p;
    if (p.matches(PROBES.containers) && images.length === 1) return p;
    if (images.length > 1) break;
  }
  return image.parentElement ?? image;
}
