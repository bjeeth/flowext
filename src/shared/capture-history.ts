import type { InspectionReport, InspectorSession } from './types';

/** Retain real snapshots only; pinned menu evidence survives rolling-history eviction. */
export class CaptureHistory {
  readonly sessionId = crypto.randomUUID();
  history: InspectionReport[];
  historyDropped = 0;
  checkpoints: InspectorSession['checkpoints'];
  interactionSnapshots: InspectionReport[] = [];
  private signature: string;
  constructor(initial: InspectionReport) {
    this.history = [initial]; this.checkpoints = { initial };
    this.signature = this.fingerprint(initial);
    this.pin(initial);
  }
  private fingerprint(report: InspectionReport): string { return JSON.stringify({ ...report, capturedAt: '', snapshotId: '' }); }
  private pin(report: InspectionReport) {
    if (report.controls.some(c => c.kind === 'download') && !this.checkpoints.downloadVisible) this.checkpoints.downloadVisible = report;
    if (report.controls.some(c => c.kind === '2k') && !this.checkpoints.qualityVisible) this.checkpoints.qualityVisible = report;
  }
  add(report: InspectionReport): boolean {
    this.pin(report);
    if (report.manualInteraction) {
      this.interactionSnapshots.push(report);
      if (this.interactionSnapshots.length > 12) this.interactionSnapshots.shift();
    }
    const signature = this.fingerprint(report);
    if (signature === this.signature) return false;
    this.history.push(report);
    if (this.history.length > 20) { this.history.shift(); this.historyDropped++; }
    this.signature = signature;
    return true;
  }
}
