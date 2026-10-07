// @vitest-environment jsdom
// Uses the untouched test document on its actual NON-Flow origin. No Flow DOM fixtures.
import { describe, expect, it } from 'vitest';
import { inspectFlow } from '../src/content/inspector';
import { CaptureHistory } from '../src/shared/capture-history';
import { exportCapture } from '../src/shared/capture';
import { reviewEvidence } from '../src/shared/evidence-review';

describe('diagnostic capture bookkeeping', () => {
  it('deduplicates an unchanged actual document despite capture timestamp/ID changes', () => {
    const first = inspectFlow(document, document.URL);
    const capture = new CaptureHistory(first);
    expect(capture.add(inspectFlow(document, document.URL))).toBe(false);
    expect(capture.history).toHaveLength(1);
  });
  it('preserves baseline and exported reference integrity after rolling eviction', () => {
    const first = inspectFlow(document, document.URL);
    const capture = new CaptureHistory(first);
    let latest = first;
    // Change only diagnostic metadata, without creating assets, controls, or mock Flow DOM.
    for (let i = 1; i <= 25; i++) {
      latest = { ...inspectFlow(document, document.URL), limitations: [`Bookkeeping variation ${i}`] };
      capture.add(latest);
    }
    expect(capture.history).toHaveLength(20);
    expect(capture.historyDropped).toBe(6);
    const exported = exportCapture({ observing: false, debug: false, sessionId: capture.sessionId, latest,
      history: capture.history, historyDropped: capture.historyDropped, checkpoints: capture.checkpoints,
      interactionSnapshots: capture.interactionSnapshots });
    expect(exported.snapshots[exported.checkpoints.initial]).toEqual(first);
    for (const id of [...exported.historySnapshotIds, exported.latestSnapshotId]) expect(exported.snapshots[id]).toBeDefined();
    expect(new Set(Object.keys(exported.snapshots)).size).toBe(Object.keys(exported.snapshots).length);
    const review = reviewEvidence(exported);
    expect(review.valid).toBe(false);
    expect(review.errors.some(error => error.includes('exactly HTTPS flow.google.com'))).toBe(true);
  });
});
