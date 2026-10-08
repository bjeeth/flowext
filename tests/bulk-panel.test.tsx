// @vitest-environment jsdom
// Real extension component with transport metadata only; no Flow DOM/assets or downloads.
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { BulkPanel } from '../src/popup/BulkPanel';
import type { BulkSession } from '../src/shared/bulk-types';
afterEach(() => vi.unstubAllGlobals());
it.each([true, false])('one start button requests optional access and dispatches bulk start only when allowed: %s', async allowed => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  // Empty error metadata represents a failed discovery transport, not fake Flow assets.
  const state: BulkSession = { protocol: 1, stage: 'ERROR', assets: [], active: false, pauseRequested: false,
    discoveryComplete: false, settings: { retries: 2, debug: false } };
  const request = vi.fn(async () => allowed);
  const sendMessage = vi.fn(async (_id: number, message: { type: string }) => message.type === 'FLOW_INSPECTOR'
    ? { ok: true, session: { captureProtocol: 1, bulk: state } }
    : { ok: true, bulk: { ...state, stage: 'DISCOVERING', active: true } });
  vi.stubGlobal('chrome', { permissions: { request }, storage: { local: { get: async () => ({}) } },
    tabs: { get: async () => ({ id: 12, url: 'https://flow.google.com/' }), sendMessage } });
  const mount = document.createElement('div'); document.body.append(mount); const root = createRoot(mount);
  const update = vi.fn();
  try {
    await act(async () => { root.render(<BulkPanel tabId={12} session={state} debug={false} buildVersion="0.3.0" onUpdate={update} />); });
    expect(mount.querySelector('select')?.textContent).toBe('012'); // Retry setting only; no image picker.
    const button = Array.from(mount.querySelectorAll('button')).find(button => button.textContent === 'Download All as 2K')!;
    await act(async () => { button.click(); });
    expect(request).toHaveBeenCalledWith({ permissions: ['downloads'] });
    if (allowed) {
      expect(sendMessage).toHaveBeenLastCalledWith(12, { type: 'FLOW_BULK', action: 'start', retries: 2, debug: false });
      expect(update.mock.calls[0][0].stage).toBe('DISCOVERING');
    } else {
      expect(sendMessage).not.toHaveBeenCalled(); expect(mount.textContent).toContain('Downloads access was declined');
    }
  } finally { await act(async () => { root.unmount(); }); mount.remove(); }
});
