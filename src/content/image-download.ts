import type { DownloadQuality } from '../shared/download-quality';
import { FlowDOMAdapter, timedRequest } from './flow-adapter';
import { delay } from './asset-discovery';
import { TIMEOUTS } from './selectors';
import type { DownloadRecord, DownloadReply, SingleStage } from '../shared/automation-types';

export class DownloadFailure extends Error {
  constructor(message: string, public retrySafe = true) { super(message); }
}
/** Reused one-image operation; queue waits for this promise before advancing. */
export async function downloadImage(adapter: FlowDOMAdapter, key: string, assetKey: string, signal: AbortSignal,
  update: (stage: SingleStage, download?: DownloadRecord) => void, checkPage: () => void, folder = '', quality: DownloadQuality = '2k'): Promise<DownloadRecord> {
  const runId = crypto.randomUUID(); let armed = false; let selected = false; let resolved = false;
  const monitor = async (action: 'arm' | 'get' | 'release') => {
    const reply = await timedRequest(chrome.runtime.sendMessage({ type: 'FLOW_DOWNLOAD', action, runId, assetKey, folder }), TIMEOUTS.menu,
      'Browser download monitor did not respond within 5 seconds.') as DownloadReply;
    if (!reply?.ok) throw new Error(reply?.error ?? 'Browser download monitor did not respond.');
    return reply.watch;
  };
  try {
    checkPage(); await adapter.closeMenus(signal);
    update('OPENING_MENU'); const submenu = await adapter.openEditorDownload(key, signal, quality); checkPage();
    update('SELECTING_QUALITY'); await adapter.waitForQualityReady(submenu, signal, quality); checkPage();
    await monitor('arm'); armed = true; checkPage(); adapter.assertEditorImage();
    adapter.selectQualityDownload(submenu, signal, quality); selected = true;
    update('WAITING_FOR_DOWNLOAD'); const deadline = Date.now() + TIMEOUTS.download;
    while (Date.now() < deadline) {
      signal.throwIfAborted(); checkPage();
      const watch = await monitor('get'); checkPage();
      if (!watch) throw new Error('Browser download session was lost.');
      if (watch.error) throw new Error(watch.error);
      if (watch.download) {
        update('WAITING_FOR_DOWNLOAD', watch.download);
        if (watch.download.state === 'interrupted') { resolved = true; throw new DownloadFailure(`Browser download failed: ${watch.download.error ?? 'interrupted'}.`); }
        if (watch.download.state === 'complete') { resolved = true; update('COMPLETED', watch.download); return watch.download; }
      }
      await delay(TIMEOUTS.poll, signal);
    }
    throw new DownloadFailure('Download timed out after 120 seconds. Check browser Downloads; the file may still be processing.', false);
  } catch (error) {
    if (signal.aborted) throw signal.reason;
    if (error instanceof DownloadFailure) throw error;
    throw new DownloadFailure(error instanceof Error ? error.message : 'Image download failed.', !selected || resolved);
  } finally {
    if (!signal.aborted) { try { await adapter.closeMenus(signal); } catch { /* Next operation verifies that menus can be closed before any new click. */ } }
    if (armed) { try { await monitor('release'); } catch { /* A surviving watch expires; the queue stops if tracking is uncertain. */ } }
    if (!signal.aborted) {
      try { await adapter.returnToGrid(signal); }
      catch (error) { throw new DownloadFailure(error instanceof Error ? error.message : 'Could not return to the project grid.', false); }
    }
  }
}
