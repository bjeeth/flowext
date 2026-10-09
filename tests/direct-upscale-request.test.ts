import { afterEach, expect, it, vi } from 'vitest';
import { requestImage } from '../src/background/direct-download';
afterEach(() => vi.unstubAllGlobals());
const project = '22222222-2222-2222-2222-222222222222';
function setup(width: number, status = 200) {
  vi.stubGlobal('location', { origin: 'https://flow.google.com', pathname: `/project/${project}` });
  vi.stubGlobal('window', { grecaptcha: { enterprise: { execute: async () => 'test-verification' } } });
  const header = new Uint8Array(24); header.set([137, 80, 78, 71]);
  const view = new DataView(header.buffer); view.setUint32(16, width); view.setUint32(20, 1024);
  const fetch = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'test-session' }) })
    .mockResolvedValueOnce({ ok: status === 200, status, text: async () => 'PERMISSION_DENIED private-details', json: async () => ({ encodedImage: btoa(String.fromCharCode(...header)) }) });
  vi.stubGlobal('fetch', fetch); return fetch;
}
it('requests explicit 2K and returns verified PNG bytes without credentials', async () => {
  const fetch = setup(2048);
  const result = await requestImage('image', project, '2k');
  expect(result.data).toMatch(/^data:image\/png;base64,/);
  const body = JSON.parse(fetch.mock.calls[1][1].body);
  expect(body.targetResolution).toBe('UPSAMPLE_IMAGE_RESOLUTION_2K');
  expect(body.mediaId).toBe('image');
  expect(JSON.stringify(result)).not.toContain('test-session');
});
it('refuses a smaller image instead of calling it 2K', async () => {
  setup(1024); const result = await requestImage('image', project, '2k');
  expect(result.data).toBeUndefined(); expect(result.error).toContain('smaller image');
});
it('stops on access denial without returning raw server details', async () => {
  setup(2048, 403); const result = await requestImage('image', project, '4k');
  expect(result.retrySafe).toBe(false); expect(result.error).toContain('refused');
  expect(JSON.stringify(result)).not.toContain('private-details');
});
