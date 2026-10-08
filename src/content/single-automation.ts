import { FlowDOMAdapter, boundedWait, timedRequest } from './flow-adapter';
import { isFlowPage } from './flow-dom';
import { TIMEOUTS } from './selectors';
import type { DownloadReply, SingleSession, SingleState, SingleStage } from '../shared/automation-types';

export class SingleImageAutomation {
  private state: SingleState = { stage: 'IDLE' };
  private assets: SingleSession['assets'] = [];
  private controller?: AbortController;
  private runId?: string;
  private debug = false;
  private active = false;
  constructor(private adapter: FlowDOMAdapter, private url: () => string) {}
  session(): SingleSession { return { protocol: 1, assets: [...this.assets], state: { ...this.state,
    ...(this.state.steps ? { steps: this.state.steps.map(step => ({ ...step })) } : {}) } }; }
  refresh(): SingleSession {
    if (!this.active) this.assets = this.adapter.detectAssets();
    return this.session();
  }
  start(assetKey: string, debug: boolean): SingleSession {
    if (this.active) throw new Error('An image is already being processed or finishing cleanup.');
    if (!isFlowPage(this.url())) throw new Error('Open a project on https://flow.google.com/.');
    const asset = this.assets.find(item => item.key === assetKey);
    if (!asset) throw new Error('Rescan visible images and select one image.');
    if (!asset.loaded) throw new Error('The selected image is still loading.');
    this.active = true; this.debug = debug; this.controller = new AbortController(); this.runId = crypto.randomUUID();
    const startedAt = new Date().toISOString();
    this.state = { stage: 'OPENING_MENU', assetKey, assetLabel: asset.label, startedAt,
      steps: [{ stage: 'OPENING_MENU', enteredAt: startedAt }] };
    const runId = this.runId; const initialUrl = this.url();
    void this.process(assetKey, runId, initialUrl, this.controller.signal);
    return this.session();
  }
  cancel(): SingleSession {
    if (this.active) this.controller?.abort(new Error('Cancelled. Any browser download already started is preserved.'));
    return this.session();
  }
  private transition(stage: SingleStage) {
    this.state = { ...this.state, stage, steps: [...(this.state.steps ?? []), { stage, enteredAt: new Date().toISOString() }] };
    if (this.debug) console.info('[FLOW-BULK][AUTOMATION]', stage, this.state.assetLabel);
    if (this.debug && stage === 'WAITING_FOR_DOWNLOAD') console.info('[FLOW-BULK][DOWNLOAD] 2K action initiated; awaiting browser event.');
  }
  private async monitor(action: 'arm' | 'get' | 'release', runId: string, assetKey?: string) {
    const reply = await timedRequest(chrome.runtime.sendMessage({ type: 'FLOW_DOWNLOAD', action, runId, assetKey }), TIMEOUTS.menu,
      'Browser download monitor did not respond within 5 seconds. Check browser Downloads before retrying.') as DownloadReply;
    if (!reply?.ok) throw new Error(reply?.error ?? 'Browser download monitor did not respond.');
    return reply.watch;
  }
  private async process(assetKey: string, runId: string, initialUrl: string, signal: AbortSignal) {
    let armed = false;
    const checkPage = () => { signal.throwIfAborted(); if (this.url() !== initialUrl || !isFlowPage(this.url())) throw new Error('Flow project changed. Operation stopped. Check browser Downloads.'); };
    try {
      const menu = await this.adapter.openAssetMenu(assetKey, signal); checkPage();
      this.transition('OPENING_DOWNLOAD_MENU');
      const submenu = await this.adapter.openDownloadMenu(menu, signal); checkPage();
      this.transition('SELECTING_2K');
      await this.monitor('arm', runId, assetKey); armed = true; checkPage();
      this.adapter.select2KDownload(submenu, signal);
      this.transition('WAITING_FOR_DOWNLOAD');
      const end = Date.now() + TIMEOUTS.download;
      while (Date.now() < end) {
        checkPage();
        const watch = await this.monitor('get', runId); checkPage();
        if (!watch) throw new Error('Download tracking session was lost.');
        if (watch.error) throw new Error(watch.error);
        if (watch.download) {
          if (this.debug && !this.state.download) console.info('[FLOW-BULK][DOWNLOAD] Download started', watch.download.id);
          this.state = { ...this.state, download: watch.download };
          if (watch.download.state === 'interrupted') throw new Error(`Browser download failed: ${watch.download.error ?? 'interrupted'}.`);
          if (watch.download.state === 'complete') {
            this.transition('COMPLETED');
            if (this.debug) console.info('[FLOW-BULK][DOWNLOAD] Download completed', watch.download.id);
            return;
          }
        }
        const wake = Date.now() + TIMEOUTS.poll;
        await boundedWait(() => Date.now() >= wake ? true : undefined, TIMEOUTS.poll + 200, signal, 'Download polling delay failed.');
      }
      throw new Error('Download timed out after 120 seconds. It may still be processing or lack a Flow origin/referrer. Check browser Downloads before retrying.');
    } catch (error) {
      this.transition(signal.aborted ? 'CANCELLED' : 'FAILED');
      this.state = { ...this.state, error: error instanceof Error ? error.message : 'Single-image operation failed.' };
      if (this.debug) console.error('[FLOW-BULK][ERROR]', this.state.error);
    } finally {
      if (armed) { try { await this.monitor('release', runId); } catch { /* Result remains visible; expiry bounds worker state. */ } }
      this.state = { ...this.state, endedAt: new Date().toISOString() };
      this.active = false;
    }
  }
}
