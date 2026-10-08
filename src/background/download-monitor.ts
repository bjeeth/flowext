import { attachDownload, downloadRecord, exactFlow } from './download-policy';
import type { DownloadCommand, DownloadReply, DownloadWatch } from '../shared/automation-types';
import { DOWNLOAD_TIMEOUT } from './download-policy';

const KEY = 'singleDownloadWatch';
// Serialize all mutations, including events that arrive while Chrome storage is awaited.
let chain: Promise<unknown> = Promise.resolve();
function serial<T>(operation: () => Promise<T>): Promise<T> {
  const next = chain.then(operation); chain = next.catch(() => undefined); return next;
}
async function read(): Promise<DownloadWatch | undefined> { return (await chrome.storage.session.get(KEY))[KEY] as DownloadWatch | undefined; }
async function save(watch: DownloadWatch) { await chrome.storage.session.set({ [KEY]: watch }); }
async function processCreated(item: chrome.downloads.DownloadItem) {
  const watch = await read();
  if (!watch || Date.now() > watch.expiresAt) return;
  const next = attachDownload(watch, item);
  if (next !== watch) await save(next);
}
async function refreshed(watch: DownloadWatch): Promise<DownloadWatch> {
  if (!watch.download) return watch;
  const [item] = await chrome.downloads.search({ id: watch.download.id });
  if (!item) return { ...watch, error: 'The browser download disappeared. Check browser Downloads.' };
  return { ...watch, download: downloadRecord(item) };
}
export function installDownloadMonitor() {
  let eventsInstalled = false;
  const installEvents = () => {
    if (eventsInstalled || !chrome.downloads) return;
    eventsInstalled = true;
    chrome.downloads.onCreated.addListener(item => { void serial(() => processCreated(item)).catch(logFailure); });
    chrome.downloads.onChanged.addListener(delta => {
      void serial(async () => {
        const watch = await read();
        if (watch?.download?.id === delta.id) await save(await refreshed(watch));
      }).catch(logFailure);
    });
  };
  installEvents();
  chrome.permissions.onAdded.addListener(() => installEvents());
  chrome.tabs.onRemoved.addListener(tabId => {
    void serial(async () => { if ((await read())?.tabId === tabId) await chrome.storage.session.remove(KEY); }).catch(logFailure);
  });
  chrome.runtime.onMessage.addListener((message: DownloadCommand, sender, respond: (reply: DownloadReply) => void) => {
    if (message?.type !== 'FLOW_DOWNLOAD') return;
    if (sender.id !== chrome.runtime.id || !sender.tab?.id || sender.frameId !== 0 || !exactFlow(sender.url) || !exactFlow(sender.tab.url)) {
      respond({ ok: false, error: 'Download tracking is restricted to the main authenticated Flow tab.' }); return;
    }
    const tabId = sender.tab.id;
    void serial(async (): Promise<DownloadReply> => {
      if (typeof message.runId !== 'string' || !/^[\w-]{1,80}$/.test(message.runId)) throw new Error('Invalid operation identity.');
      if (!await chrome.permissions.contains({ permissions: ['downloads'] })) throw new Error('Allow optional Downloads access to test one image.');
      installEvents();
      let watch = await read();
      if (message.action === 'arm') {
        if (watch && Date.now() <= watch.expiresAt && !watch.error && watch.download?.state !== 'complete' && watch.download?.state !== 'interrupted') throw new Error('Another image download is being tracked. Finish or cancel that operation first.');
        if (typeof message.assetKey !== 'string' || !message.assetKey || message.assetKey.length > 120) throw new Error('Invalid image identity.');
        watch = { runId: message.runId, assetKey: message.assetKey, tabId, armedAt: Date.now(), expiresAt: Date.now() + DOWNLOAD_TIMEOUT };
        await save(watch); return { ok: true, watch };
      }
      if (!watch || watch.runId !== message.runId || watch.tabId !== tabId) throw new Error('Download tracking session was lost. Check browser Downloads before trying again.');
      if (message.action === 'release') { await chrome.storage.session.remove(KEY); return { ok: true }; }
      if (message.action !== 'get') throw new Error('Unknown download command.');
      // Catch missed create events after a worker restart using the same source/time policy.
      const items = await chrome.downloads.search({ startedAfter: new Date(watch.armedAt).toISOString(), limit: 100, orderBy: ['-startTime'] });
      for (const item of items) watch = attachDownload(watch, item);
      if (items.length >= 100) watch = { ...watch, error: 'Too many concurrent downloads to safely identify this operation.' };
      watch = await refreshed(watch); await save(watch);
      return { ok: true, watch };
    }).then(respond).catch(error => respond({ ok: false, error: error instanceof Error ? error.message : 'Browser download tracking failed.' }));
    return true;
  });
}
function logFailure() { console.error('[FLOW-BULK][ERROR] Browser download state could not be updated.'); }
