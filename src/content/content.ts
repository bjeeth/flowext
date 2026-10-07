import { inspectFlow, type ManualInteractionInput } from './inspector';
import { controlKind, isFlowPage } from './flow-dom';
import { CaptureHistory } from '../shared/capture-history';
import { PROBES } from './selectors';
import type { InspectorCommand, InspectorReply, InspectorSession } from '../shared/types';

const global = globalThis as typeof globalThis & { __flowBulkInspectorInstalled?: boolean };
if (isFlowPage(location.href) && !global.__flowBulkInspectorInstalled) {
  global.__flowBulkInspectorInstalled = true;
  let observer: MutationObserver | undefined;
  let debounce: ReturnType<typeof setTimeout> | undefined;
  let expiry: ReturnType<typeof setTimeout> | undefined;
  let observing = false;
  let debug = false;
  let lastHovered: Element | null = null;
  let preferredImage: HTMLImageElement | undefined;
  let observationStartedAt: string | null = null;
  let observationStoppedAt: string | null = null;
  let observationError: string | null = null;
  let latest = inspectFlow(document, location.href);
  let capture = new CaptureHistory(latest);

  const scan = (interaction?: ManualInteractionInput) => {
    latest = inspectFlow(document, location.href, interaction, preferredImage);
    observationError = null;
    if (capture.add(latest) && debug) {
      console.info('[FLOW-BULK][DISCOVERY]', latest.candidates.length, 'image candidates', latest);
      for (const kind of ['more', 'download', '2k'] as const) {
        const controls = latest.controls.filter(control => control.kind === kind);
        if (controls.length) console.info('[FLOW-BULK][INSPECTION]', kind, controls);
      }
    }
  };
  const safeScan = (interaction?: ManualInteractionInput) => {
    try { scan(interaction); }
    catch { observationError = 'Read-only observation scan failed. Use Inspect current DOM to retry.'; console.error('[FLOW-BULK][ERROR]', observationError); }
  };
  const schedule = () => {
    // Leading bounded delay ensures continuous mutations cannot starve a snapshot.
    if (debounce) return;
    debounce = setTimeout(() => { debounce = undefined; safeScan(); }, 250);
  };
  const onInteraction = (event: Event) => {
    // Observe genuine manual interaction without synthesizing, canceling, or intercepting it.
    if (!event.isTrusted || !(event.target instanceof Element)) return;
    const target = event.target;
    const control = target.closest(PROBES.controls);
    const scope = control ?? target;
    // A manually clicked nonsemantic element is evidence too; do not guess a button role.
    if (event.type !== 'click' && !control && !controlKind(target) && !target.closest(PROBES.menus)) return;
    let relevant = !!controlKind(scope) || !!scope.closest(PROBES.menus);
    for (let p = scope.parentElement, depth = 0; p && depth < PROBES.maxAncestorDepth && !relevant; p = p.parentElement, depth++) {
      if (p === document.body || p === document.documentElement) break;
      const count = p.querySelectorAll(PROBES.images).length;
      if (count === 1) relevant = true;
      if (count > 1) break;
    }
    if (!relevant) return;
    // Preserve context of the image the user manually interacted with; no asset is selected by code.
    if (target instanceof HTMLImageElement) preferredImage = target;
    else for (let p: Element | null = scope, depth = 0; p && depth < PROBES.maxAncestorDepth; p = p.parentElement, depth++) {
      if (p === document.body || p === document.documentElement) break;
      const images = p.querySelectorAll<HTMLImageElement>(PROBES.images);
      if (images.length === 1) { preferredImage = images[0]; break; }
      if (images.length > 1) break;
    }
    if (event.type === 'pointerover') {
      if (lastHovered === scope) return;
      lastHovered = scope;
    }
    safeScan({ type: event.type as ManualInteractionInput['type'], target, capturedAt: new Date().toISOString() });
    schedule();
  };
  const stop = () => {
    observer?.disconnect(); observer = undefined;
    clearTimeout(debounce); debounce = undefined; clearTimeout(expiry);
    if (observing) observationStoppedAt = new Date().toISOString();
    observing = false; lastHovered = null;
    window.removeEventListener('scroll', schedule, true);
    document.removeEventListener('load', schedule, true);
    for (const type of ['click', 'pointerover', 'focusin']) document.removeEventListener(type, onInteraction, true);
  };
  const session = (): InspectorSession => ({ observing, debug, latest,
    observation: { active: observing, startedAt: observationStartedAt, stoppedAt: observationStoppedAt, lastError: observationError },
    sessionId: capture.sessionId,
    history: [...capture.history], historyDropped: capture.historyDropped, checkpoints: capture.checkpoints,
    interactionSnapshots: [...capture.interactionSnapshots] });

  chrome.runtime.onMessage.addListener((message: InspectorCommand, sender, sendResponse: (r: InspectorReply) => void) => {
    if (sender.id !== chrome.runtime.id || message?.type !== 'FLOW_INSPECTOR') return;
    try {
      if (typeof message.debug === 'boolean') debug = message.debug;
      switch (message.action) {
        case 'get': break;
        case 'scan': scan(); break;
        case 'observe':
          stop(); scan(); observing = true; observationStartedAt = new Date().toISOString(); observationStoppedAt = null;
          observer = new MutationObserver(schedule);
          observer.observe(document.documentElement, {
            subtree: true, childList: true, characterData: true, attributes: true,
            // Read-only observation of attribute changes, including actual identifier/state changes.
          });
          window.addEventListener('scroll', schedule, { capture: true, passive: true });
          document.addEventListener('load', schedule, true);
          for (const type of ['click', 'pointerover', 'focusin']) document.addEventListener(type, onInteraction, { capture: true, passive: true });
          expiry = setTimeout(stop, 10 * 60 * 1000);
          if (debug) console.info('[FLOW-BULK][INSPECTION] Read-only observation started; auto-stop in 10 minutes.', latest);
          break;
        case 'stop': stop(); scan(); break;
        case 'clear': stop(); preferredImage = undefined; observationStartedAt = null; observationStoppedAt = null; observationError = null; latest = inspectFlow(document, location.href); capture = new CaptureHistory(latest); break;
        default: sendResponse({ ok: false, error: 'Unknown inspector command.' }); return;
      }
      sendResponse({ ok: true, session: session() });
    } catch (error) {
      if (message.action === 'observe') { stop(); observationError = 'Observation could not start. Inspect the current DOM and try again.'; }
      console.error('[FLOW-BULK][ERROR]', 'Inspector scan failed');
      sendResponse({ ok: false, error: error instanceof Error ? error.message : 'Inspector scan failed.' });
    }
  });
  window.addEventListener('pagehide', stop, { once: true });
}
