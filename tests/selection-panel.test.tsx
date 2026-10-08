// @vitest-environment jsdom
// Render real extension controls with empty transport metadata; no fake Flow DOM/assets.
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { BulkPanel } from '../src/popup/BulkPanel';
import type { BulkSession } from '../src/shared/bulk-types';

it('exposes mutually exclusive scope toggles, prevents selected-to-all fallback, and performs only read-only capture', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const bulk: BulkSession = { protocol: 1, folderSupport: 1, selectionCaptureSupport: 1, stage: 'IDLE', assets: [], active: false,
    discoveryComplete: false, pauseRequested: false, settings: { retries: 2, debug: false } };
  const request = vi.fn();
  const sendMessage = vi.fn(async (_id: number, message: { type: string }) => message.type === 'FLOW_INSPECTOR'
    ? { ok: true, session: { captureProtocol: 1, bulk } }
    : { ok: true, capture: { protocol: 1, buildVersion: '0.5.0', snapshots: [], dropped: 0 } });
  vi.stubGlobal('chrome', { permissions: { request }, storage: { local: { get: async () => ({}) } },
    tabs: { get: async () => ({ id: 12, url: 'https://flow.google.com/project' }), sendMessage } });
  const mount = document.createElement('div'); document.body.append(mount); const root = createRoot(mount);
  const button = (name: string) => Array.from(mount.querySelectorAll('button')).find(b => b.textContent === name)!;
  try {
    await act(async () => { root.render(<BulkPanel tabId={12} session={bulk} debug={false} buildVersion="0.5.0" onUpdate={() => {}} />); });
    // Opening controls must not scroll/discover and disturb an existing Flow selection.
    expect(sendMessage).not.toHaveBeenCalled();
    expect(button('All images').getAttribute('aria-pressed')).toBe('true');
    await act(async () => { button('Selected images').click(); });
    expect(button('Selected images').getAttribute('aria-pressed')).toBe('true');
    expect(button('All images').getAttribute('aria-pressed')).toBe('false');
    expect(button('Download Selected as 2K').disabled).toBe(true);
    expect(button('Refresh image collection')).toBeUndefined();
    await act(async () => { button('Download Selected as 2K').click(); button('Capture selected').click(); });
    expect(sendMessage).toHaveBeenLastCalledWith(12, { type: 'FLOW_SELECTION', action: 'capture', checkpoint: 'selected' });
    expect(request).not.toHaveBeenCalled();
    expect(sendMessage.mock.calls.some(([, message]) => message.type === 'FLOW_BULK')).toBe(false);
    await act(async () => { button('All images').click(); });
    expect(button('All images').getAttribute('aria-pressed')).toBe('true');
    expect(button('Download All as 2K').disabled).toBe(false);
  } finally { await act(async () => { root.unmount(); }); mount.remove(); vi.unstubAllGlobals(); }
});
