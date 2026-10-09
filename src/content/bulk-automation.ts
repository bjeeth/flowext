import { directDownload } from './direct-download';
import { sameProject } from '../shared/project-location';
import { isDownloadQuality, type DownloadQuality } from '../shared/download-quality';
import { FlowDOMAdapter, FlowControlsUnavailable } from './flow-adapter';
import { discoverAssets, reacquireAsset, delay, selectedAssets } from './asset-discovery';
import { DownloadFailure, downloadImage } from './image-download';
import { DISCOVERY } from './selectors';
import { isFlowPage } from './flow-dom';
import type { BulkSession, FlowAsset } from '../shared/bulk-types';
import { sequentialQueue } from './sequential-queue';
import type { DownloadScope } from '../shared/selection-types';

class ProjectChanged extends Error {}

export class BulkAutomation {
  private value: BulkSession = { protocol: 1, folderSupport: 1, selectionCaptureSupport: 1, selectedDownloadSupport: 1, qualitySupport: 1, directDownloadSupport: 1, discoverySupport: 2, stage: 'IDLE', assets: [], pauseRequested: false, active: false, discoveryComplete: false, settings: { retries: 2, debug: false, scope: 'all' } };
  private abort?: AbortController;
  private initialUrl = '';
  constructor(private doc: Document, private adapter: FlowDOMAdapter, private url: () => string) {}
  session(): BulkSession { return structuredClone(this.value); }
  start(download: boolean, retries: number, debug: boolean, folder = '', scope: DownloadScope = 'all', quality: DownloadQuality = '2k'): BulkSession {
    if (!isDownloadQuality(quality)) throw new Error('Choose 1K, 2K, or 4K.');
    if (scope !== 'all' && scope !== 'selected') throw new Error('Choose All images or Selected images.');
    if (this.value.active) {
      if (!download && sameProject(this.initialUrl, this.url()) && !this.value.discoveryComplete && ['DISCOVERING', 'PAUSED'].includes(this.value.stage)) return this.session();
      throw new Error('A bulk operation is already active.');
    }
    if (!isFlowPage(this.url())) throw new Error('Open a project on https://flow.google.com/.');
    if (!Number.isInteger(retries) || retries < 0 || retries > 2) throw new Error('Retry count must be 0, 1, or 2.');
    // The worker validates the actual destination before arming any browser download.
    if (typeof folder !== 'string' || folder.length > 180) throw new Error('Invalid download folder.');
    const preparedSelection = download && scope === 'selected' && this.value.settings.scope === 'selected' && this.value.stage === 'READY' && this.value.discoveryComplete && sameProject(this.initialUrl, this.url());
    const selected = scope === 'selected' ? (preparedSelection ? this.value.assets.map(asset => ({ ...asset })) : selectedAssets(this.doc)) : undefined;
    const reuse = scope === 'all' && this.value.settings.scope !== 'selected' && download && this.value.stage === 'READY' && this.value.discoveryComplete && sameProject(this.initialUrl, this.url());
    const assets = selected ?? (reuse ? this.value.assets.map(asset => ({ ...asset, status: 'queued' as const, attempts: 0, error: undefined, download: undefined })) : []);
    this.abort = new AbortController(); this.initialUrl = this.url();
    this.value = { protocol: 1, folderSupport: 1, selectionCaptureSupport: 1, selectedDownloadSupport: 1, qualitySupport: 1, directDownloadSupport: 1, discoverySupport: 2, stage: selected ? (download ? 'RUNNING' : 'READY') : reuse ? 'RUNNING' : 'DISCOVERING', assets, active: !selected || download, pauseRequested: false, discoveryComplete: reuse || !!selected,
      startedAt: new Date().toISOString(), settings: { retries, debug, scope, quality, ...(download ? { folder } : {}) } };
    if (selected && !download) { this.finish(); return this.session(); }
    if (selected) for (const asset of assets) asset.status = 'queued';
    if (reuse || selected) void this.process(this.abort.signal).catch(error => this.fail(error, this.abort!.signal)).finally(() => this.finish());
    else void this.run(download, this.abort.signal);
    return this.session();
  }
  pause() { if (this.value.active) this.value.pauseRequested = true; return this.session(); }
  resume() { if (this.value.active) this.value.pauseRequested = false; return this.session(); }
  cancel() { this.abort?.abort(new Error('Bulk operation cancelled. Existing browser downloads and files are preserved.')); return this.session(); }
  retry(): BulkSession {
    if (this.value.active) throw new Error('Finish or cancel the current queue first.');
    if (!sameProject(this.initialUrl, this.url()) || !isFlowPage(this.url())) throw new Error('Flow project changed. Refresh the image collection before retrying.');
    if (!this.value.discoveryComplete) throw new Error('Complete asset discovery before retrying.');
    const failed = this.value.assets.filter(asset => asset.status === 'failed');
    if (!failed.length) throw new Error('There are no failed images to retry.');
    this.abort = new AbortController(); this.initialUrl = this.url();
    for (const asset of failed) { asset.status = 'queued'; asset.attempts = 0; asset.error = undefined; asset.download = undefined; }
    this.value.active = true; this.value.pauseRequested = false; this.value.stage = 'RUNNING'; this.value.error = undefined; this.value.endedAt = undefined;
    void this.process(this.abort.signal).catch(error => this.fail(error, this.abort!.signal)).finally(() => this.finish());
    return this.session();
  }
  private checkPage() {
    if (!sameProject(this.initialUrl, this.url()) || !isFlowPage(this.url())) throw new ProjectChanged('Flow project changed. Bulk operation stopped.');
  }
  private async checkpoint(signal: AbortSignal) {
    signal.throwIfAborted(); this.checkPage();
    const previous = this.value.stage;
    while (this.value.pauseRequested) {
      this.value.stage = 'PAUSED'; await delay(100, signal); this.checkPage();
    }
    if (this.value.stage === 'PAUSED') this.value.stage = previous === 'PAUSED' ? 'RUNNING' : previous;
  }
  private async run(download: boolean, signal: AbortSignal) {
    try {
      this.value.assets = await discoverAssets(this.doc, signal, assets => { this.value.assets = assets; }, () => this.checkpoint(signal), snapshot => {
        if (!this.value.discovery) this.value.discovery = { initial: snapshot, latest: snapshot, scans: 1 };
        else { this.value.discovery.latest = snapshot; this.value.discovery.scans++; }
        if (this.value.settings.debug) console.info('[FLOW-BULK][DISCOVERY]', snapshot);
      });
      this.checkPage();
      if (!this.value.assets.length) throw new Error('No supported generated image cards were found. Copy discovery diagnostics to check image IDs, card ancestry, visibility, and the collection selector. No downloads were started.');
      this.value.discoveryComplete = true;
      if (!download) { this.value.stage = 'READY'; return; }
      for (const asset of this.value.assets) asset.status = 'queued';
      await this.process(signal);
    } catch (error) { this.fail(error, signal); }
    finally { this.finish(); }
  }
  private async process(signal: AbortSignal) {
    this.value.stage = 'RUNNING';
    const pending = this.value.assets.filter(asset => !['completed', 'failed', 'skipped'].includes(asset.status));
    await sequentialQueue(pending, this.value.settings.retries, signal, () => this.checkpoint(signal),
      (asset, attempt) => this.processAsset(asset, attempt, signal),
      (asset, error) => { asset.status = 'failed'; asset.error = error instanceof Error ? error.message : 'Image operation failed.'; },
      error => !(error instanceof ProjectChanged) && !(error instanceof FlowControlsUnavailable) && !(error instanceof DownloadFailure && !error.retrySafe) && sameProject(this.initialUrl, this.url()),
      () => delay(DISCOVERY.settle, signal));
    this.value.stage = 'COMPLETED'; this.value.currentId = undefined; this.value.currentStage = undefined;
  }
  private async processAsset(asset: FlowAsset, attempt: number, signal: AbortSignal) {
    this.value.stage = 'RUNNING'; this.value.currentId = asset.id;
    asset.attempts = attempt; asset.status = 'processing'; asset.error = undefined; asset.download = undefined;
    this.value.currentStage = undefined;
    try {
      asset.download = await directDownload(asset.id, asset.index, this.url(), signal, (stage, download) => {
        this.value.currentStage = stage;
        if (stage === 'WAITING_FOR_DOWNLOAD') asset.status = 'downloading';
        if (download) asset.download = download;
        if (this.value.settings.debug) console.info('[FLOW-BULK][AUTOMATION]', asset.label, stage);
      }, () => this.checkPage(), this.value.settings.folder, this.value.settings.quality);
      asset.status = 'completed'; return;
    } catch (error) {
      if (signal.aborted) throw error;
      this.checkPage(); asset.error = error instanceof Error ? error.message : 'Image operation failed.';
      if (error instanceof DownloadFailure && !error.retrySafe) {
        asset.status = 'failed'; throw new DownloadFailure(`${asset.label}: ${asset.error} Export stopped. Check Downloads before retrying.`, false);
      }
      throw error;
    }
  }
  private fail(error: unknown, signal: AbortSignal) {
    this.value.stage = signal.aborted ? 'CANCELLED' : 'ERROR';
    this.value.error = error instanceof Error ? error.message : 'Bulk operation failed.';
    const current = this.value.assets.find(asset => asset.id === this.value.currentId);
    if (current && ['processing', 'downloading'].includes(current.status)) { current.status = signal.aborted ? 'skipped' : 'failed'; current.error = this.value.error; }
    if (signal.aborted) for (const asset of this.value.assets) if (['queued', 'discovered'].includes(asset.status)) asset.status = 'skipped';
  }
  private finish() { this.value.active = false; this.value.pauseRequested = false; this.value.endedAt = new Date().toISOString(); }
}
