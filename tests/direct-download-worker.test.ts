import { expect, it, vi } from 'vitest';
import { installDirectDownloads } from '../src/background/direct-download';
it('owns jobs by tab, waits for browser completion, and does not duplicate a pending request', async () => {
  let listener: Function; const store: Record<string, unknown> = {};
  const downloads = vi.fn(async () => 42);
  const mediaId = '11111111-1111-1111-1111-111111111111', projectId = '22222222-2222-2222-2222-222222222222';
  const url = `https://flow.google.com/project/${projectId}`;
  let state = 'in_progress';
  vi.stubGlobal('chrome', {
    runtime: { id: 'extension', onMessage: { addListener: (fn: Function) => { listener = fn; } } },
    storage: { session: { get: async (key: string) => ({ [key]: structuredClone(store[key]) }), set: async (v: object) => Object.assign(store, structuredClone(v)) } },
    permissions: { contains: async () => true },
    scripting: { executeScript: async () => [{ result: { data: 'data:image/png;base64,test' } }] },
    tabs: { get: async () => ({ url }) },
    downloads: { download: downloads, search: async () => [{ id: 42, filename: '/Downloads/Flow-001-2k.png', state, bytesReceived: 100, totalBytes: 100, startTime: new Date().toISOString() }] },
  });
  installDirectDownloads();
  const send = (action: string, tab = 1, id = 'job') => new Promise<any>(resolve => listener!({ type: 'FLOW_DIRECT', action, id, mediaId, projectId, quality: '2k', index: 1 }, { id: 'extension', frameId: 0, url, tab: { id: tab, url } }, resolve));
  try {
    expect((await send('start')).ok).toBe(true);
    for (let i = 0; i < 20; i++) await Promise.resolve();
    expect(downloads).toHaveBeenCalledOnce();
    expect((await send('get')).job.state).toBe('WAITING_FOR_DOWNLOAD');
    expect((await send('start', 1, 'other')).ok).toBe(false);
    expect((await send('get', 2)).ok).toBe(false);
    state = 'complete';
    expect((await send('get')).job.state).toBe('COMPLETED');
    expect(downloads).toHaveBeenCalledOnce();
  } finally { vi.unstubAllGlobals(); }
});
it('rejects non-Flow senders before running page scripts', async () => {
  let listener: Function; const execute = vi.fn();
  vi.stubGlobal('chrome', { runtime: { id: 'extension', onMessage: { addListener: (fn: Function) => listener = fn } }, scripting: { executeScript: execute } });
  try {
    installDirectDownloads();
    const reply = await new Promise<any>(resolve => listener!({ type: 'FLOW_DIRECT' }, { id: 'extension', frameId: 0, url: 'https://example.com', tab: { id: 1, url: 'https://example.com' } }, resolve));
    expect(reply.ok).toBe(false); expect(execute).not.toHaveBeenCalled();
  } finally { vi.unstubAllGlobals(); }
});
