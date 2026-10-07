// No Flow DOM or mock assets are constructed here. These are input-validation tests.
import { describe, expect, it } from 'vitest';
import { reviewEvidence } from '../src/shared/evidence-review';

describe('untrusted diagnostic input', () => {
  it.each([null, [], 'not JSON evidence', {}, { phase: 1, history: [] }])('rejects missing/legacy schema without inventing evidence: %j', input => {
    const result = reviewEvidence(input);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(Object.values(result.coverage).every(value => !value)).toBe(true);
  });
  it('rejects missing snapshot references rather than reconstructing them', () => {
    const result = reviewEvidence({ phase: 1, formatVersion: 2, sessionId: 'validation-only', historyDropped: 0,
      snapshots: { missing: null }, latestSnapshotId: 'not-present', historySnapshotIds: [], interactionSnapshotIds: [], checkpoints: { initial: 'not-present' } });
    expect(result.valid).toBe(false);
    expect(result.errors.some(error => error.includes('reference does not resolve'))).toBe(true);
  });
  it('treats selectors and HTML in input as inert invalid data', () => {
    const input = { phase: 1, formatVersion: 2, sessionId: 'validation-only', historyDropped: 0,
      snapshots: {}, script: '<script>throw new Error("execute")</script>', selector: 'button' };
    expect(reviewEvidence(input).valid).toBe(false);
  });
  it('rejects oversized snapshot sets', () => {
    const snapshots = Object.fromEntries(Array.from({ length: 41 }, (_, i) => [String(i), null]));
    expect(reviewEvidence({ phase: 1, formatVersion: 2, snapshots }).valid).toBe(false);
  });
  it('does not echo arbitrary diagnostic values through errors', () => {
    const secret = 'DO_NOT_PRINT_PRIVATE_CAPTURE';
    const result = reviewEvidence({ phase: 1, formatVersion: 2, snapshots: { [secret]: {} } });
    expect(JSON.stringify(result)).not.toContain(secret);
  });
});
