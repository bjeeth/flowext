import { normalizeDownloadFolder, folderFilename, isDownloadInFolder } from '../shared/download-folder';
import { downloadRecord, exactFlow } from './download-policy';
import type { DownloadQuality } from '../shared/download-quality';
import type { DownloadRecord } from '../shared/automation-types';

interface Job { id: string; tabId: number; state: 'UPSCALING' | 'WAITING_FOR_DOWNLOAD' | 'COMPLETED' | 'ERROR' | 'CANCELLED'; created: number; folder?: string; downloadId?: number; download?: DownloadRecord; error?: string; retrySafe?: boolean }
const KEY = 'directImageJob';
let busy = false;
async function read(): Promise<Job | undefined> { return (await chrome.storage.session.get(KEY))[KEY]; }
async function save(job: Job) { await chrome.storage.session.set({ [KEY]: job }); }

/** Runs inside the signed-in Flow page. Credentials never leave this function. */
export async function requestImage(mediaId: string, projectId: string, quality: DownloadQuality) {
  try {
    const project = location.pathname.match(/\/(?:u\/\d+\/)?project\/([^/]+)/)?.[1];
    if (location.origin !== 'https://flow.google.com' || project !== projectId) return { error: 'Flow project changed. Return to the intended project.', retrySafe: false };
    if (quality === '1k') {
      const source = new URL(`https://flow-content.google/image/${mediaId}`);
      const response = await fetch(source.href, { credentials: 'include', signal: AbortSignal.timeout(120000) });
      if (!response.ok) return { error: 'Could not fetch the loaded original image.', retrySafe: true };
      const blob = await response.blob();
      if (!blob.type.startsWith('image/')) return { error: 'Flow returned a non-image response.', retrySafe: false };
      const data = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(blob); });
      return { data, original: true };
    }
    const auth = await fetch('/fx/api/auth/session', { credentials: 'include', signal: AbortSignal.timeout(15000) });
    if (!auth.ok) return { error: 'Flow sign-in could not be verified. Sign in and refresh Flow.', retrySafe: false };
    const session = await auth.json();
    if (typeof session.access_token !== 'string' || !session.access_token) return { error: 'Sign in to Flow and refresh the page before exporting.', retrySafe: false };
    const captcha = (window as unknown as { grecaptcha?: { enterprise?: { execute: (key: string, options: { action: string }) => Promise<string> } } }).grecaptcha?.enterprise;
    if (!captcha) return { error: 'Flow verification is not ready. Refresh Flow and try again.', retrySafe: false };
    const token = await captcha.execute('6LdsFiUsAAAAAIjVDZcuLhaHiDn5nnHVXVRQGeMV', { action: 'IMAGE_GENERATION' });
    if (!token) return { error: 'Flow verification failed. Refresh Flow and try again.', retrySafe: false };
    if (location.pathname.match(/\/(?:u\/\d+\/)?project\/([^/]+)/)?.[1] !== projectId) return { error: 'Flow project changed before upscaling.', retrySafe: false };
    const response = await fetch('https://aisandbox-pa.googleapis.com/v1/flow/upsampleImage', {
      method: 'POST', headers: { 'Content-Type': 'text/plain;charset=UTF-8', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ mediaId, targetResolution: quality === '4k' ? 'UPSAMPLE_IMAGE_RESOLUTION_4K' : 'UPSAMPLE_IMAGE_RESOLUTION_2K',
        clientContext: { projectId, tool: 'PINHOLE', sessionId: ';' + Date.now(), userPaygateTier: quality === '4k' ? 'PAYGATE_TIER_TWO' : 'PAYGATE_TIER_NOT_PAID',
          recaptchaContext: { applicationType: 'RECAPTCHA_APPLICATION_TYPE_WEB', token } } }), signal: AbortSignal.timeout(120000),
    });
    if (!response.ok) {
      // Never echo response bodies: they may contain account or credential information.
      const body = await response.text();
      const quota = /DAILY_QUOTA_REACHED|RESOURCE_EXHAUSTED/.test(body);
      return { error: quota ? 'Flow upscale quota reached. Try again later.' : response.status === 429 ? 'Flow is busy. Wait before retrying.' : response.status === 401 || response.status === 403 ? 'Flow refused the upscale. Check sign-in and quality access.' : `Flow could not upscale this image (HTTP ${response.status}).`, retrySafe: !quota && response.status >= 500, status: response.status };
    }
    const result = await response.json();
    if (typeof result.encodedImage !== 'string' || !/^[A-Za-z0-9+/=\r\n]+$/.test(result.encodedImage) || result.encodedImage.length > 60000000) return { error: 'Flow did not return a valid upscaled image.', retrySafe: false };
    // Read PNG IHDR dimensions before labeling an export as an upscale.
    const header = atob(result.encodedImage.slice(0, 44));
    const bytes = Uint8Array.from(header, char => char.charCodeAt(0));
    if (bytes.length < 24 || bytes[0] !== 137 || bytes[1] !== 80 || bytes[2] !== 78 || bytes[3] !== 71) return { error: 'Flow returned an unsupported upscale format.', retrySafe: false };
    const view = new DataView(bytes.buffer);
    const width = view.getUint32(16), height = view.getUint32(20);
    if (Math.max(width, height) < (quality === '4k' ? 4096 : 2048)) return { error: 'Flow returned a smaller image than the requested quality. No file was saved.', retrySafe: false };
    return { data: 'data:image/png;base64,' + result.encodedImage };
  } catch { return { error: 'Flow upscale request failed or timed out. Refresh Flow or retry later.', retrySafe: false }; }
}

async function perform(job: Job, mediaId: string, projectId: string, quality: DownloadQuality, folder: string, index: number) {
  try {
    const results = await chrome.scripting.executeScript({ target: { tabId: job.tabId, frameIds: [0] }, world: 'MAIN', func: requestImage, args: [mediaId, projectId, quality] });
    const result = results[0]?.result;
    const current = await read();
    if (!current || current.id !== job.id || current.state === 'CANCELLED') return;
    if (!result?.data) throw Object.assign(new Error(result?.error ?? 'Flow page did not respond.'), { retrySafe: result?.retrySafe === true });
    const tab = await chrome.tabs.get(job.tabId);
    if (!exactFlow(tab.url) || new URL(tab.url!).pathname.match(/\/(?:u\/\d+\/)?project\/([^/]+)/)?.[1] !== projectId) throw new Error('Flow project changed. No file was saved.');
    job.state = 'WAITING_FOR_DOWNLOAD'; await save(job);
    const ext = result.data.startsWith('data:image/jpeg') ? 'jpg' : result.data.startsWith('data:image/webp') ? 'webp' : 'png';
    const name = `Flow-${String(index).padStart(3, '0')}-${quality}.${ext}`;
    job.downloadId = await chrome.downloads.download({ url: result.data, filename: folder ? folderFilename(folder, name) : name, conflictAction: 'uniquify', saveAs: false });
    const after = await read();
    await save(after?.id === job.id && after.state === 'CANCELLED' ? { ...job, state: 'CANCELLED' } : job);
  } catch (error) {
    const current = await read();
    if (current?.id === job.id && current.state !== 'CANCELLED') { job.state = 'ERROR'; job.error = error instanceof Error ? error.message : 'Direct download failed.'; job.retrySafe = (error as { retrySafe?: boolean }).retrySafe === true; await save(job); }
  } finally { busy = false; }
}

export function installDirectDownloads() {
  chrome.runtime.onMessage.addListener((message, sender, respond) => {
    if (message?.type !== 'FLOW_DIRECT') return;
    if (sender.id !== chrome.runtime.id || !sender.tab?.id || sender.frameId !== 0 || !exactFlow(sender.url) || !exactFlow(sender.tab.url)) { respond({ ok: false, error: 'Direct export is restricted to the main Flow tab.' }); return; }
    const tabId = sender.tab.id;
    void (async () => {
      if (typeof message.id !== 'string' || !/^[\w-]{1,80}$/.test(message.id)) throw new Error('Invalid export identity.');
      let job = await read();
      if (message.action === 'start') {
        if (!await chrome.permissions.contains({ permissions: ['downloads'] })) throw new Error('Allow Downloads access to export images.');
        if (busy || (job && !['ERROR', 'CANCELLED', 'COMPLETED'].includes(job.state))) throw new Error('An image export is still pending. Check Downloads before retrying.');
        if (!/^[a-f0-9-]{36}$/i.test(message.mediaId) || !/^[a-f0-9-]{36}$/i.test(message.projectId) || !['1k', '2k', '4k'].includes(message.quality) || !Number.isInteger(message.index) || message.index < 1) throw new Error('Invalid image export request.');
        const actualProject = new URL(sender.tab!.url!).pathname.match(/\/(?:u\/\d+\/)?project\/([^/]+)/)?.[1];
        if (actualProject !== message.projectId) throw new Error('The export belongs to another Flow project.');
        const folder = normalizeDownloadFolder(message.folder ?? '');
        job = { id: message.id, tabId, created: Date.now(), folder, state: 'UPSCALING' }; busy = true; await save(job);
        void perform(job, message.mediaId, message.projectId, message.quality, folder, message.index);
      } else {
        if (!job || job.id !== message.id || job.tabId !== tabId) throw new Error('Export tracking was lost. Check Downloads before retrying.');
        if (message.action === 'cancel') { job.state = 'CANCELLED'; await save(job); }
        else if (message.action === 'get') {
          if (job.state !== 'CANCELLED' && job.downloadId !== undefined) {
            const [item] = await chrome.downloads.search({ id: job.downloadId });
            if (!item) { job.state = 'ERROR'; job.error = 'Browser download disappeared. Check Downloads.'; }
            else { job.download = downloadRecord(item); if (item.state === 'complete') { if (job.folder && !isDownloadInFolder(job.folder, item.filename)) { job.state = 'ERROR'; job.error = 'The file was saved outside the chosen folder. Check Downloads before continuing.'; job.retrySafe = false; } else job.state = 'COMPLETED'; } else if (item.state === 'interrupted') { job.state = 'ERROR'; job.error = 'Browser download interrupted: ' + (item.error ?? 'unknown'); job.retrySafe = true; } }
            await save(job);
          } else if (Date.now() - job.created > 150000 && !['COMPLETED', 'CANCELLED', 'ERROR'].includes(job.state)) { job.state = 'ERROR'; job.error = 'Upscale tracking timed out. Refresh Flow before retrying.'; job.retrySafe = false; await save(job); }
        } else throw new Error('Unknown export action.');
      }
      return { ok: true, job };
    })().then(respond).catch(error => respond({ ok: false, error: error instanceof Error ? error.message : 'Direct export failed.' }));
    return true;
  });
}
