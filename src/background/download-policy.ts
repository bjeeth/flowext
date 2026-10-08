import type { DownloadRecord, DownloadWatch } from '../shared/automation-types';
// Keep this bound equal to content/selectors.ts TIMEOUTS.download. Distinct entry
// modules prevent a shared ESM chunk in the classic injected content script.
export const DOWNLOAD_TIMEOUT = 120000;
export function exactFlow(url?: string): boolean {
  try { const u = new URL(url ?? ''); return u.protocol === 'https:' && u.hostname === 'flow.google.com'; }
  catch { return false; }
}
function flowSource(url: string): boolean {
  try { const u = new URL(url); return exactFlow(u.protocol === 'blob:' ? u.pathname : url); }
  catch { return false; }
}
export function matchesDownload(watch: DownloadWatch, item: chrome.downloads.DownloadItem): boolean {
  const start = Date.parse(item.startTime);
  return Number.isFinite(start) && start >= watch.armedAt && start <= watch.expiresAt &&
    (flowSource(item.url) || exactFlow(item.referrer));
}
/** Never retain source URLs, referrers, cookies, or tokens in download state. */
export function downloadRecord(item: chrome.downloads.DownloadItem): DownloadRecord {
  return { id: item.id, filename: item.filename, state: item.state, bytesReceived: item.bytesReceived,
    totalBytes: item.totalBytes, startTime: item.startTime, ...(item.endTime ? { endTime: item.endTime } : {}),
    ...(item.error ? { error: item.error } : {}) };
}
export function attachDownload(watch: DownloadWatch, item: chrome.downloads.DownloadItem): DownloadWatch {
  if (!matchesDownload(watch, item) || watch.error) return watch;
  if (watch.download && watch.download.id !== item.id) return { ...watch, error: 'Multiple Flow downloads started during this operation. Attribution is ambiguous; check browser Downloads.' };
  return { ...watch, download: downloadRecord(item) };
}
