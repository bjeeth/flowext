import type { SingleSession } from './automation-types';
/** Minimal handoff: no DOM graph, URLs, asset identifiers, or full local path. */
export function operationReport(session: SingleSession | undefined, buildVersion: string, contentVersion?: string, launchError?: string) {
  const state = session?.state;
  const download = state?.download;
  return {
    formatVersion: 1, phase: 2, buildVersion, contentVersion: contentVersion ?? null,
    capturedAt: new Date().toISOString(), pageOrigin: 'https://flow.google.com',
    availableViewportImages: session?.assets.length ?? null,
    operation: state ? {
      stage: state.stage, assetLabel: state.assetLabel ?? null,
      startedAt: state.startedAt ?? null, endedAt: state.endedAt ?? null,
      error: state.error ?? null, steps: state.steps?.map(step => ({ stage: step.stage, enteredAt: step.enteredAt })) ?? [],
      download: download ? { id: download.id, filename: download.filename.split(/[\\/]/).pop() ?? '',
        state: download.state, bytesReceived: download.bytesReceived, totalBytes: download.totalBytes,
        startTime: download.startTime, endTime: download.endTime ?? null, error: download.error ?? null } : null,
    } : null,
    launchError: launchError ?? null,
    liveFileVerification: 'Requires user verification of correct image and 2K file dimensions.',
  };
}
