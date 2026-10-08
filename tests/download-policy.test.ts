// Browser download metadata only. No Flow DOM, mock assets, or production downloads.
import { describe, expect, it } from 'vitest';
import { attachDownload, downloadRecord, exactFlow, matchesDownload, DOWNLOAD_TIMEOUT } from '../src/background/download-policy';
import { TIMEOUTS } from '../src/content/selectors';
import type { DownloadWatch } from '../src/shared/automation-types';

const armedAt = Date.parse('2026-10-08T00:00:00.000Z');
const watch: DownloadWatch = { runId: 'operation', assetKey: 'session-reference', tabId: 1, armedAt, expiresAt: armedAt + 120000 };
function browserItem(overrides: Partial<chrome.downloads.DownloadItem> = {}): chrome.downloads.DownloadItem {
  return { id: 7, url: 'blob:https://flow.google.com/browser-owned-id', finalUrl: 'blob:https://flow.google.com/browser-owned-id',
    referrer: '', filename: 'output.png', startTime: new Date(armedAt + 100).toISOString(), state: 'in_progress', paused: false,
    canResume: false, danger: 'safe', mime: 'image/png', bytesReceived: 0, totalBytes: 2048, fileSize: -1,
    exists: true, incognito: false, ...overrides };
}
describe('download attribution policy', () => {
  it('keeps the classic content and module worker timeout bounds consistent', () => expect(DOWNLOAD_TIMEOUT).toBe(TIMEOUTS.download));
  it.each(['http://flow.google.com/', 'https://flow.google.com.evil.test/', 'https://labs.google/', 'not a URL'])('refuses outside exact scope: %s', url => expect(exactFlow(url)).toBe(false));
  it('accepts Flow blob creation during the armed interval', () => expect(matchesDownload(watch, browserItem())).toBe(true));
  it('accepts redirected CDN downloads only with an exact Flow referrer', () => {
    expect(matchesDownload(watch, browserItem({ url: 'https://cdn.example/file', referrer: 'https://flow.google.com/project' }))).toBe(true);
    expect(matchesDownload(watch, browserItem({ url: 'https://cdn.example/file', referrer: '' }))).toBe(false);
  });
  it.each([-1, 120001])('rejects starts outside the operation interval: %d', offset => {
    expect(matchesDownload(watch, browserItem({ startTime: new Date(armedAt + offset).toISOString() }))).toBe(false);
  });
  it('fails ambiguous matching downloads instead of attributing the first silently', () => {
    const first = attachDownload(watch, browserItem());
    const second = attachDownload(first, browserItem({ id: 8 }));
    expect(second.error).toContain('ambiguous');
    expect(attachDownload(second, browserItem({ state: 'complete' })).error).toContain('ambiguous');
  });
  it('retains interrupted state and error and strips source URLs', () => {
    const item = browserItem({ state: 'interrupted', error: 'NETWORK_FAILED', referrer: 'https://flow.google.com/private', url: 'https://cdn.example/?token=private' });
    const record = downloadRecord(item);
    expect(record.state).toBe('interrupted'); expect(record.error).toBe('NETWORK_FAILED');
    expect(JSON.stringify(record)).not.toContain('private');
    expect(record).not.toHaveProperty('url'); expect(record).not.toHaveProperty('referrer');
  });
  it('only records complete when the browser record says complete', () => {
    expect(attachDownload(watch, browserItem()).download?.state).toBe('in_progress');
    expect(attachDownload(watch, browserItem({ state: 'complete', endTime: new Date(armedAt + 1000).toISOString() })).download?.state).toBe('complete');
  });
});
