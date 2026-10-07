import type { EvidenceExport, InspectionReport, InspectorSession } from './types';

export function exportCapture(session: InspectorSession): EvidenceExport {
  const snapshots: Record<string, InspectionReport> = Object.create(null) as Record<string, InspectionReport>;
  const keep = (report: InspectionReport): string => { snapshots[report.snapshotId] = report; return report.snapshotId; };
  const checkpoints: EvidenceExport['checkpoints'] = { initial: keep(session.checkpoints.initial) };
  if (session.checkpoints.downloadVisible) checkpoints.downloadVisible = keep(session.checkpoints.downloadVisible);
  if (session.checkpoints.qualityVisible) checkpoints.qualityVisible = keep(session.checkpoints.qualityVisible);
  return { ...(session.observation ? { observation: session.observation } : {}), phase: 1, formatVersion: 2, sessionId: session.sessionId, snapshots,
    latestSnapshotId: keep(session.latest), historySnapshotIds: session.history.map(keep),
    interactionSnapshotIds: session.interactionSnapshots.map(keep), historyDropped: session.historyDropped, checkpoints };
}
