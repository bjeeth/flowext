export type SingleStage = 'IDLE' | 'OPENING_MENU' | 'OPENING_DOWNLOAD_MENU' | 'SELECTING_2K' | 'SELECTING_QUALITY' | 'UPSCALING' | 'WAITING_FOR_DOWNLOAD' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
export const runningStage = (stage: SingleStage) => !['IDLE', 'COMPLETED', 'FAILED', 'CANCELLED'].includes(stage);
export interface SingleAsset { key: string; label: string; loaded: boolean }
export interface DownloadRecord {
  id: number; filename: string; state: 'in_progress' | 'interrupted' | 'complete';
  bytesReceived: number; totalBytes: number; startTime: string; endTime?: string; error?: string;
}
export interface SingleState {
  stage: SingleStage; assetKey?: string; assetLabel?: string; startedAt?: string; endedAt?: string;
  error?: string; download?: DownloadRecord;
  steps?: Array<{ stage: SingleStage; enteredAt: string }>;
}
export interface SingleSession { protocol: 1; assets: SingleAsset[]; state: SingleState }
export interface AutomationCommand { type: 'FLOW_SINGLE'; action: 'start' | 'cancel'; assetKey?: string; debug?: boolean }
export type AutomationReply = { ok: true; single: SingleSession } | { ok: false; error: string };
export interface DownloadCommand { type: 'FLOW_DOWNLOAD'; action: 'arm' | 'get' | 'release'; runId: string; assetKey?: string; folder?: string }
export interface DownloadWatch {
  runId: string; assetKey: string; tabId: number; armedAt: number; expiresAt: number;
  download?: DownloadRecord; error?: string;
  folder?: string;
}
export type DownloadReply = { ok: true; watch?: DownloadWatch } | { ok: false; error: string };
