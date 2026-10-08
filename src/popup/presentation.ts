import type { BulkStage } from '../shared/bulk-types';
import type { SingleStage } from '../shared/automation-types';
export function exportStatus(stage: BulkStage, failed: number, skipped: number, pauseRequested: boolean) {
  if (pauseRequested && (stage === 'RUNNING' || stage === 'DISCOVERING')) return { title: 'Pause requested', detail: 'The current operation will finish before pausing.', tone: 'warning' };
  switch (stage) {
    case 'IDLE': return { title: 'Ready when you are', detail: 'Start to find and download images, or scan to preview the count.', tone: 'neutral' };
    case 'DISCOVERING': return { title: 'Finding your images', detail: 'Scanning the project collection. Keep the Flow tab open.', tone: 'active' };
    case 'READY': return { title: 'Ready to download', detail: 'The collection is scanned. Choose a folder and start your export.', tone: 'neutral' };
    case 'RUNNING': return { title: 'Export in progress', detail: 'One image at a time. Keep Flow open until the export finishes.', tone: 'active' };
    case 'PAUSED': return { title: 'Export paused', detail: 'Resume to continue. Completed files are kept.', tone: 'warning' };
    case 'COMPLETED': return { title: failed || skipped ? 'Export finished with issues' : 'Export complete', detail: 'Check the results below and your saved files.', tone: failed || skipped ? 'warning' : 'success' };
    case 'CANCELLED': return { title: 'Export cancelled', detail: 'Completed files and downloads already started are kept.', tone: 'neutral' };
    case 'ERROR': return { title: 'Export stopped', detail: 'Review the error before starting or retrying.', tone: 'danger' };
  }
}
export function operationLabel(stage?: SingleStage) {
  const labels: Partial<Record<SingleStage, string>> = { OPENING_MENU: 'Opening image menu', OPENING_DOWNLOAD_MENU: 'Opening download options',
    SELECTING_QUALITY: 'Waiting for the chosen quality', SELECTING_2K: 'Waiting for the 2K option', WAITING_FOR_DOWNLOAD: 'Waiting for browser download', COMPLETED: 'File saved' };
  return stage ? labels[stage] ?? 'Processing image' : 'Preparing image';
}
export function elapsedTime(start?: string, end?: string, now = Date.now()) {
  if (!start) return undefined;
  const seconds = Math.floor(((end ? Date.parse(end) : now) - Date.parse(start)) / 1000);
  if (!Number.isFinite(seconds) || seconds < 0) return undefined;
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}
export function byteSize(value: number) {
  if (!Number.isFinite(value) || value < 0) return 'Unknown';
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}
