import { delay } from './asset-discovery';
import { DownloadFailure } from './image-download';
import { timedRequest } from './flow-adapter';
import type { DownloadQuality } from '../shared/download-quality';
import type { DownloadRecord, SingleStage } from '../shared/automation-types';
export async function directDownload(mediaId: string, index: number, url: string, signal: AbortSignal, update: (stage: SingleStage, download?: DownloadRecord) => void, check: () => void, folder = '', quality: DownloadQuality = '2k') {
  const projectId = new URL(url).pathname.match(/\/(?:u\/\d+\/)?project\/([^/]+)/)?.[1];
  if (!projectId) throw new DownloadFailure('Open a Flow project before exporting.', false);
  const id = crypto.randomUUID();
  const send = async (action: string) => {
    const reply = await timedRequest(chrome.runtime.sendMessage({ type: 'FLOW_DIRECT', action, id, mediaId, projectId, folder, quality, index }), 10000, 'Export worker did not respond. Check Downloads before retrying.');
    if (!reply?.ok) throw new DownloadFailure(reply?.error ?? 'Direct export failed.', false);
    return reply.job;
  };
  try {
    check(); update('UPSCALING'); await send('start');
    const deadline = Date.now() + 300000;
    while (Date.now() < deadline) {
      signal.throwIfAborted(); check();
      const job = await send('get');
      if (job.state === 'ERROR') throw new DownloadFailure(job.error, job.retrySafe === true);
      if (job.state === 'CANCELLED') throw new DownloadFailure('Export cancelled.', false);
      update(job.state === 'UPSCALING' ? 'UPSCALING' : 'WAITING_FOR_DOWNLOAD', job.download);
      if (job.state === 'COMPLETED' && job.download?.state === 'complete') return job.download as DownloadRecord;
      await delay(700, signal);
    }
    throw new DownloadFailure('Download timed out. Check Downloads before retrying.', false);
  } finally { if (signal.aborted) await send('cancel').catch(() => {}); }
}
