import { expect, it } from 'vitest';
import { operationReport } from '../src/shared/operation-report';
import type { SingleSession } from '../src/shared/automation-types';

it('exports operation state without asset IDs, unrelated metadata, source URLs, or full local paths', () => {
  // Metadata only, not a Flow asset or DOM. Unknown transport fields must not leak.
  const input = { protocol: 1, assets: [], state: { stage: 'FAILED', assetKey: 'PRIVATE_ASSET_REFERENCE',
    assetLabel: 'Image 1', error: 'Download timed out.', startedAt: '2026-10-08T00:00:00Z',
    steps: [{ stage: 'WAITING_FOR_DOWNLOAD', enteredAt: '2026-10-08T00:00:01Z', extra: 'PRIVATE_EXTRA' }],
    download: { id: 9, filename: 'C:\\Users\\PRIVATE_USER\\Downloads\\output.png', state: 'in_progress', bytesReceived: 512,
      totalBytes: 1024, startTime: '2026-10-08T00:00:01Z', url: 'https://example.test/?token=PRIVATE_TOKEN' },
  } } as unknown as SingleSession;
  const report = operationReport(input, '0.2.1', '0.2.1');
  const json = JSON.stringify(report);
  expect(json).not.toContain('PRIVATE_');
  expect(report.operation?.download?.filename).toBe('output.png');
  expect(report.operation?.stage).toBe('FAILED');
  expect(report.operation?.steps).toHaveLength(1);
});
it('reports unsupported legacy content without manufacturing an operation', () => {
  const report = operationReport(undefined, '0.2.1', '0.1.1', 'Refresh Flow.');
  expect(report.operation).toBeNull(); expect(report.contentVersion).toBe('0.1.1');
  expect(report.launchError).toBe('Refresh Flow.');
});
