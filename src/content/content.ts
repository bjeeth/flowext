import { inspectFlow } from './inspector';
import { isFlowPage } from './flow-dom';
import type { InspectorCommand, InspectorReply, InspectorSession } from '../shared/types';

// Explicit injection only after an extension gesture; guarded against duplicate listeners.
const global = globalThis as typeof globalThis & { __flowBulkInspectorInstalled?: boolean };
if (isFlowPage(location.href) && !global.__flowBulkInspectorInstalled) {
  global.__flowBulkInspectorInstalled = true;
  let observer: MutationObserver | undefined;
  let debounce: ReturnType<typeof setTimeout> | undefined;
  let expiry: ReturnType<typeof setTimeout> | undefined;
  let observing = false;
  let debug = false;
  let latest = inspectFlow(document, location.href);
  const history = [latest];
  let signature = JSON.stringify({ ...latest, capturedAt: '' });

  const scan = () => {
    latest = inspectFlow(document, location.href);
    const nextSignature = JSON.stringify({ ...latest, capturedAt: '' });
    if (nextSignature !== signature) {
      history.push(latest);
      if (history.length > 20) history.shift();
      signature = nextSignature;
      if (debug) {
        console.info('[FLOW-BULK][DISCOVERY]', latest.candidates.length, 'image candidates', latest);
        for (const kind of ['more', 'download', '2k'] as const) {
          const controls = latest.controls.filter(control => control.kind === kind);
          if (controls.length) console.info('[FLOW-BULK][INSPECTION]', kind, controls);
        }
      }
    }
  };
  const stop = () => {
    observer?.disconnect(); observer = undefined;
    clearTimeout(debounce); clearTimeout(expiry);
    observing = false;
    window.removeEventListener('scroll', schedule, true);
    document.removeEventListener('load', schedule, true);
  };
  const schedule = () => {
    clearTimeout(debounce);
    debounce = setTimeout(scan, 250);
  };
  const session = (): InspectorSession => ({ observing, debug, latest, history: [...history] });

  chrome.runtime.onMessage.addListener((message: InspectorCommand, sender, sendResponse: (r: InspectorReply) => void) => {
    if (sender.id !== chrome.runtime.id || message?.type !== 'FLOW_INSPECTOR') return;
    try {
      if (typeof message.debug === 'boolean') debug = message.debug;
      switch (message.action) {
        case 'get': break;
        case 'scan': scan(); break;
        case 'observe':
          stop(); scan(); observing = true;
          observer = new MutationObserver(schedule);
          observer.observe(document.documentElement, {
            subtree: true, childList: true, characterData: true, attributes: true,
            attributeFilter: ['aria-label', 'aria-labelledby', 'aria-selected', 'aria-pressed', 'aria-expanded', 'aria-disabled', 'hidden', 'style', 'class', 'role', 'disabled', 'src', 'data-state'],
          });
          window.addEventListener('scroll', schedule, true);
          document.addEventListener('load', schedule, true);
          expiry = setTimeout(stop, 10 * 60 * 1000);
          if (debug) console.info('[FLOW-BULK][INSPECTION] Read-only observation started; auto-stop in 10 minutes.', latest);
          break;
        case 'stop': stop(); scan(); break;
        case 'clear': stop(); scan(); history.splice(0, history.length, latest); break;
        default: sendResponse({ ok: false, error: 'Unknown inspector command.' }); return;
      }
      sendResponse({ ok: true, session: session() });
    } catch (error) {
      console.error('[FLOW-BULK][ERROR]', 'Inspector scan failed');
      sendResponse({ ok: false, error: error instanceof Error ? error.message : 'Inspector scan failed.' });
    }
  });
  window.addEventListener('pagehide', stop, { once: true });
}
