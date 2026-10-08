import type { DownloadQuality } from './download-quality';
import type { DownloadRecord, SingleStage } from './automation-types';
export type AssetStatus = 'discovered' | 'queued' | 'processing' | 'downloading' | 'completed' | 'failed' | 'skipped';
export interface FlowAsset {
  id: string; index: number; label: string; status: AssetStatus; attempts: number;
  scrollTop: number; error?: string; download?: DownloadRecord;
}
export type BulkStage = 'IDLE' | 'DISCOVERING' | 'READY' | 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'CANCELLED' | 'ERROR';
export interface BulkSession {
  folderSupport?: 1;
  selectionCaptureSupport?: 1;
  discoverySupport?: 2;
  selectedDownloadSupport?: 1;
  qualitySupport?: 1;
  protocol: 1; stage: BulkStage; assets: FlowAsset[]; currentId?: string; currentStage?: SingleStage;
  pauseRequested: boolean; active: boolean; discoveryComplete: boolean;
  startedAt?: string; endedAt?: string; error?: string;
  discovery?: import('./discovery-policy').DiscoveryDiagnostics;
  settings: { retries: number; debug: boolean; folder?: string; quality?: DownloadQuality; scope?: import('./selection-types').DownloadScope };
}
export interface BulkCommand {
  type: 'FLOW_BULK'; action: 'get' | 'start' | 'discover' | 'pause' | 'resume' | 'cancel' | 'retry';
  debug?: boolean; retries?: number; folder?: string; quality?: DownloadQuality; scope?: import('./selection-types').DownloadScope;
}
export type BulkReply = { ok: true; bulk: BulkSession } | { ok: false; error: string };
