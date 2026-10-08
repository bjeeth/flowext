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
let allowed: boolean;
let items: chrome.downloads.DownloadItem[];
const sender = { id: 'extension-id', frameId: 0, url: 'https://flow.google.com/project', tab: { id: 12, url: 'https://flow.google.com/project' } } as chrome.runtime.MessageSender;
const item = (): chrome.downloads.DownloadItem => ({ id: 42, url: 'blob:https://flow.google.com/download', finalUrl: '', referrer: '', filename: 'output.png',
  startTime: new Date(Date.now() + 1).toISOString(), state: 'in_progress', paused: false, canResume: false, danger: 'safe', mime: 'image/png',
  bytesReceived: 512, totalBytes: 2048, fileSize: -1, exists: true, incognito: false });
function send(action: DownloadCommand['action'], runId = 'operation', from = sender): Promise<DownloadReply> {
  return new Promise(resolve => {
    const listener = messages.listeners[0] as unknown as (message: DownloadCommand, sender: chrome.runtime.MessageSender, respond: (r: DownloadReply) => void) => unknown;
    listener({ type: 'FLOW_DOWNLOAD', action, runId, assetKey: 'session-reference' }, from, resolve);
  });
}
beforeEach(() => {
  allowed = true; items = []; const store: Record<string, unknown> = {};
  messages = event(); created = event(); changed = event();
  vi.stubGlobal('chrome', {
    runtime: { id: 'extension-id', onMessage: messages }, tabs: { onRemoved: event() },
    permissions: { contains: async () => allowed, onAdded: event() },
    storage: { session: {
      get: async (key: string) => structuredClone({ [key]: store[key] }),
      set: async (value: object) => Object.assign(store, structuredClone(value)),
      remove: async (key: string) => { delete store[key]; },
    } },
    downloads: { onCreated: created, onChanged: changed, search: async (query: { id?: number }) => items.filter(i => query.id === undefined || query.id === i.id) },
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
