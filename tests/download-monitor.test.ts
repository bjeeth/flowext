import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { installDownloadMonitor } from '../src/background/download-monitor';
import type { DownloadCommand, DownloadReply } from '../src/shared/automation-types';

// Exercise worker messaging/events/storage, not a fabricated Flow page or image.
const event = <T extends (...args: never[]) => unknown>() => {
  const listeners: T[] = [];
  return { listeners, addListener: (listener: T) => listeners.push(listener) };
};
let messages: ReturnType<typeof event>;
let created: ReturnType<typeof event>;
let changed: ReturnType<typeof event>;
let determining: ReturnType<typeof event>;
let allowed: boolean;
let items: chrome.downloads.DownloadItem[];
const sender = { id: 'extension-id', frameId: 0, url: 'https://flow.google.com/project', tab: { id: 12, url: 'https://flow.google.com/project' } } as chrome.runtime.MessageSender;
const item = (): chrome.downloads.DownloadItem => ({ id: 42, url: 'blob:https://flow.google.com/download', finalUrl: '', referrer: '', filename: 'output.png',
  startTime: new Date(Date.now() + 1).toISOString(), state: 'in_progress', paused: false, canResume: false, danger: 'safe', mime: 'image/png',
  bytesReceived: 512, totalBytes: 2048, fileSize: -1, exists: true, incognito: false });
function send(action: DownloadCommand['action'], runId = 'operation', from = sender, folder?: string): Promise<DownloadReply> {
  return new Promise(resolve => {
    const listener = messages.listeners[0] as unknown as (message: DownloadCommand, sender: chrome.runtime.MessageSender, respond: (r: DownloadReply) => void) => unknown;
    listener({ type: 'FLOW_DOWNLOAD', action, runId, assetKey: 'session-reference', folder }, from, resolve);
  });
}
beforeEach(() => {
  allowed = true; items = []; const store: Record<string, unknown> = {};
  messages = event(); created = event(); changed = event(); determining = event();
  vi.stubGlobal('chrome', {
    runtime: { id: 'extension-id', onMessage: messages }, tabs: { onRemoved: event() },
    permissions: { contains: async () => allowed, onAdded: event() },
    storage: { session: {
      get: async (key: string) => structuredClone({ [key]: store[key] }),
      set: async (value: object) => Object.assign(store, structuredClone(value)),
      remove: async (key: string) => { delete store[key]; },
    } },
    downloads: { onCreated: created, onChanged: changed, onDeterminingFilename: determining, search: async (query: { id?: number }) => items.filter(i => query.id === undefined || query.id === i.id) },
  });
  installDownloadMonitor();
});
afterEach(() => vi.unstubAllGlobals());
it('rejects non-Flow, subframe, and wrong-extension messages before storage/download access', async () => {
  for (const from of [{ ...sender, url: 'https://example.test/' }, { ...sender, frameId: 1 }, { ...sender, id: 'another-extension' }]) {
    expect((await send('arm', 'operation', from)).ok).toBe(false);
  }
});
it('requires optional permission before arming', async () => { allowed = false; expect((await send('arm')).ok).toBe(false); });
it('allows only one active browser-wide operation', async () => {
  expect((await send('arm')).ok).toBe(true); expect((await send('arm', 'other')).ok).toBe(false);
});
it('recovers a missed create event and waits for browser completion', async () => {
  await send('arm'); items = [item()];
  const active = await send('get'); expect(active.ok && active.watch?.download?.state).toBe('in_progress');
  items = [{ ...items[0], state: 'complete', bytesReceived: 2048, endTime: new Date().toISOString() }];
  const complete = await send('get'); expect(complete.ok && complete.watch?.download?.state).toBe('complete');
});
it('updates persisted state from actual browser event handler inputs', async () => {
  await send('arm'); items = [item()];
  (created.listeners[0] as unknown as (item: chrome.downloads.DownloadItem) => void)(items[0]);
  const start = await send('get'); expect(start.ok && start.watch?.download?.id).toBe(42);
  items = [{ ...items[0], state: 'interrupted', error: 'NETWORK_FAILED' }];
  (changed.listeners[0] as unknown as (delta: chrome.downloads.DownloadDelta) => void)({ id: 42, state: { current: 'interrupted' } });
  const failed = await send('get'); expect(failed.ok && failed.watch?.download?.error).toBe('NETWORK_FAILED');
});
it('fails when multiple Flow downloads match the armed interval', async () => {
  await send('arm'); items = [item(), { ...item(), id: 43 }];
  const result = await send('get'); expect(result.ok && result.watch?.error).toContain('ambiguous');
});
it('does not let another tab release this operation', async () => {
  await send('arm'); const wrongTab = { ...sender, tab: { ...sender.tab!, id: 99 } };
  expect((await send('release', 'operation', wrongTab)).ok).toBe(false);
  expect((await send('get')).ok).toBe(true);
});
it('releases tracking without cancelling or erasing downloaded files', async () => {
  await send('arm'); expect((await send('release')).ok).toBe(true);
  expect((await send('get')).ok).toBe(false);
  expect((await send('arm', 'next')).ok).toBe(true);
});
async function determine(download = item()) {
  const suggest = vi.fn();
  const listener = determining.listeners[0] as unknown as (item: chrome.downloads.DownloadItem, suggest: (value?: chrome.downloads.FilenameSuggestion) => void) => boolean;
  expect(listener(download, suggest)).toBe(true);
  await vi.waitFor(() => expect(suggest).toHaveBeenCalledTimes(1));
  return suggest.mock.calls[0][0];
}
it('suggests a relative folder only for the armed Flow download, preserving format and uniquifying duplicates', async () => {
  await send('arm', 'operation', sender, 'Flow/Project');
  expect(await determine({ ...item(), filename: '/Downloads/actual.webp' })).toEqual({ filename: 'Flow/Project/actual.webp', conflictAction: 'uniquify' });
  const state = await send('get'); expect(state.ok && state.watch?.folder).toBe('Flow/Project');
});
it('does not rename unarmed, unrelated, or default-folder downloads', async () => {
  expect(await determine()).toBeUndefined();
  await send('arm', 'operation', sender, 'Flow');
  expect(await determine({ ...item(), url: 'https://example.test/image' })).toBeUndefined();
  await send('release'); await send('arm');
  expect(await determine()).toBeUndefined();
});
it('does not redirect a second ambiguous matching download', async () => {
  await send('arm', 'operation', sender, 'Flow');
  await determine(); expect(await determine({ ...item(), id: 43 })).toBeUndefined();
  const result = await send('get'); expect(result.ok && result.watch?.error).toContain('ambiguous');
});
it('handles creation before filename determination and still routes the same ID', async () => {
  await send('arm', 'operation', sender, 'Flow');
  (created.listeners[0] as unknown as (item: chrome.downloads.DownloadItem) => void)(item());
  expect(await determine()).toEqual({ filename: 'Flow/output.png', conflictAction: 'uniquify' });
});
it('refuses an invalid destination before arming', async () => {
  expect((await send('arm', 'operation', sender, '../elsewhere')).ok).toBe(false);
  expect(await determine()).toBeUndefined();
});
it('reports completed files outside the destination instead of claiming a successful folder export', async () => {
  await send('arm', 'operation', sender, 'Flow'); await determine();
  items = [{ ...item(), state: 'complete', filename: '/Downloads/output.png' }];
  const result = await send('get'); expect(result.ok && result.watch?.error).toContain('outside the chosen folder');
});
it('accepts completed files in the chosen folder with browser duplicate suffixes', async () => {
  await send('arm', 'operation', sender, 'Flow'); await determine();
  items = [{ ...item(), state: 'complete', filename: '/Downloads/Flow/output (1).png' }];
  const result = await send('get'); expect(result.ok && result.watch?.error).toBeUndefined();
  expect(result.ok && result.watch?.download?.state).toBe('complete');
});
it('settles the filename callback even if session storage fails', async () => {
  const read = vi.spyOn(chrome.storage.session, 'get').mockRejectedValueOnce(new Error('Storage unavailable'));
  const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  try { expect(await determine()).toBeUndefined(); }
  finally { read.mockRestore(); log.mockRestore(); }
});
it('reports a missing tentative filename and calls suggest once without inventing an extension', async () => {
  await send('arm', 'operation', sender, 'Flow');
  expect(await determine({ ...item(), filename: '' })).toBeUndefined();
  const result = await send('get'); expect(result.ok && result.watch?.error).toContain('usable download filename');
});
