// @vitest-environment jsdom
// Real extension component with transport metadata only; no Flow DOM/assets or downloads.
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { BulkPanel } from '../src/popup/BulkPanel';
import type { BulkSession } from '../src/shared/bulk-types';
afterEach(() => vi.unstubAllGlobals());
it.each([
  { allowed: true, choice: 'recent' }, { allowed: false, choice: 'recent' },
  { allowed: true, choice: 'new' }, { allowed: true, choice: 'invalid' }, { allowed: true, choice: 'default' },
])('folder choice $choice requests access and starts only when valid and allowed: $allowed', async ({ allowed, choice }) => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  // Empty error metadata represents a failed discovery transport, not fake Flow assets.
  const state: BulkSession = { protocol: 1, folderSupport: 1, discoverySupport: 2, stage: 'ERROR', assets: [], active: false, pauseRequested: false,
    discoveryComplete: false, settings: { retries: 2, debug: false } };
  const request = vi.fn(async () => allowed);
  const sendMessage = vi.fn(async (_id: number, message: { type: string }) => message.type === 'FLOW_INSPECTOR'
    ? { ok: true, session: { captureProtocol: 1, bulk: state } }
    : { ok: true, bulk: { ...state, stage: 'DISCOVERING', active: true } });
  const save = vi.fn(async () => undefined);
  vi.stubGlobal('chrome', { permissions: { request }, storage: { local: { get: async () => ({ downloadFolder: 'Flow/Project', recentDownloadFolders: ['Flow/Project'] }), set: save } },
    tabs: { get: async () => ({ id: 12, url: 'https://flow.google.com/' }), sendMessage } });
  const mount = document.createElement('div'); document.body.append(mount); const root = createRoot(mount);
  const update = vi.fn();
  try {
    await act(async () => { root.render(<BulkPanel tabId={12} session={state} debug={false} buildVersion="0.4.0" onUpdate={update} />); });
    expect(mount.querySelector('select')?.textContent).toBe('012'); // Retry setting only; no image picker.
    expect(mount.querySelector<HTMLInputElement>('#download-folder')?.value).toBe('Flow/Project');
    expect(mount.querySelector('datalist option')?.getAttribute('value')).toBe('Flow/Project');
    if (choice === 'new' || choice === 'invalid') {
      await act(async () => {
        const input = mount.querySelector<HTMLInputElement>('#download-folder')!;
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, choice === 'new' ? 'New Export/Subfolder' : '../outside');
        input.dispatchEvent(new Event('input', { bubbles: true }));
      });
    }
    if (choice === 'default') {
      await act(async () => { Array.from(mount.querySelectorAll('button')).find(b => b.textContent === 'Use Downloads folder')!.click(); });
    }
    const button = Array.from(mount.querySelectorAll('button')).find(button => button.textContent === 'Download All as 2K')!;
    await act(async () => { button.click(); });
    if (choice === 'invalid') {
      expect(request).not.toHaveBeenCalled(); expect(sendMessage).not.toHaveBeenCalled();
      expect(mount.textContent).toContain('Folder names cannot contain'); return;
    }
    expect(request).toHaveBeenCalledWith({ permissions: ['downloads'] });
    if (allowed) {
      const folder = choice === 'new' ? 'New Export/Subfolder' : choice === 'default' ? '' : 'Flow/Project';
      expect(save).toHaveBeenCalledWith({ downloadFolder: folder, recentDownloadFolders: choice === 'new' ? [folder, 'Flow/Project'] : ['Flow/Project'] });
      expect(sendMessage).toHaveBeenLastCalledWith(12, { type: 'FLOW_BULK', action: 'start', retries: 2, debug: false, folder, scope: 'all' });
      expect(update.mock.calls[0][0].stage).toBe('DISCOVERING');
    } else {
      expect(sendMessage).not.toHaveBeenCalled(); expect(mount.textContent).toContain('Downloads access was declined');
    }
  } finally { await act(async () => { root.unmount(); }); mount.remove(); }
});
