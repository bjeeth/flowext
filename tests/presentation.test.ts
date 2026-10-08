import { expect, it } from 'vitest';
import { byteSize, elapsedTime, exportStatus } from '../src/popup/presentation';
it('distinguishes completion with failed/skipped items and a requested pause from successful completion', () => {
  expect(exportStatus('COMPLETED', 0, 0, false).tone).toBe('success');
  expect(exportStatus('COMPLETED', 2, 0, false).tone).toBe('warning');
  expect(exportStatus('COMPLETED', 0, 2, false).tone).toBe('warning');
  expect(exportStatus('RUNNING', 0, 0, true).title).toBe('Pause requested');
  expect(exportStatus('ERROR', 0, 0, false).tone).toBe('danger');
  expect(exportStatus('ERROR', 0, 0, true).tone).toBe('danger');
});
it('derives elapsed time from actual timestamps, freezes at completion, and omits invalid times', () => {
  const start = '2026-10-08T00:00:00.000Z';
  expect(elapsedTime(start, undefined, Date.parse(start) + 125000)).toBe('2m 5s');
  expect(elapsedTime(start, '2026-10-08T00:18:42.000Z', Date.parse(start) + 99999999)).toBe('18m 42s');
  expect(elapsedTime('invalid')).toBeUndefined();
  expect(elapsedTime(start, '2026-10-07T23:59:59.000Z')).toBeUndefined();
});
it('formats measured byte values without representing invalid data as an actual size', () => {
  expect(byteSize(0)).toBe('0 B'); expect(byteSize(2048)).toBe('2.0 KB');
  expect(byteSize(1572864)).toBe('1.5 MB'); expect(byteSize(-1)).toBe('Unknown'); expect(byteSize(NaN)).toBe('Unknown');
});
