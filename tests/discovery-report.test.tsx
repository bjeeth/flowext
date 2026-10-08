// @vitest-environment jsdom
// Actual empty non-Flow document and extension UI/API transport. No Flow DOM/assets/downloads.
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { discoverySnapshot } from '../src/content/asset-discovery';
import { inspectFlow } from '../src/content/inspector';
import { BulkPanel } from '../src/popup/BulkPanel';
import { bulkCommand } from '../src/shared/automation-client';
import type { BulkSession } from '../src/shared/bulk-types';

afterEach(() => { vi.unstubAllGlobals(); delete (navigator as unknown as { clipboard?: unknown }).clipboard; });

it('collects count-only discovery metadata without changing the actual blank document', () => {
  const before = document.documentElement.outerHTML;
  const snapshot = discoverySnapshot(document.body);
  expect(snapshot.pageImages).toBe(0); expect(snapshot.acceptedImages).toBe(0);
  expect(snapshot.imagesWithoutMore).toBe(0);
  expect(JSON.stringify(snapshot)).not.toMatch(/nodeId|mediaId|filename|src|token|cookie/);
  expect(document.documentElement.outerHTML).toBe(before);
});

it('does not present a zero-image discovery failure as completed discovery and copies fresh read-only diagnostics', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const snapshot = discoverySnapshot(document.body);
  const report = inspectFlow(document, document.URL);
  const bulk: BulkSession = { protocol: 1, discoverySupport: 2, stage: 'ERROR', assets: [], active: false,
    pauseRequested: false, discoveryComplete: false, settings: { retries: 2, debug: false },
    error: 'Discovery did not identify supported cards.', discovery: { initial: snapshot, latest: snapshot, scans: 1 } };
  const session = { captureProtocol: 1, bulk, latest: report, checkpoints: { initial: report }, history: [report],
    historyDropped: 0, interactionSnapshots: [], sessionId: 'empty-extension-transport' };
  const sendMessage = vi.fn(async () => ({ ok: true, session }));
  const request = vi.fn(); const writeText = vi.fn(async (_text: string) => undefined);
  vi.stubGlobal('chrome', { permissions: { request }, storage: { local: { get: async () => ({}) } },
    tabs: { get: async () => ({ id: 12, url: 'https://flow.google.com/' }), sendMessage } });
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
  const mount = document.createElement('div'); document.body.append(mount); const root = createRoot(mount);
  try {
    await act(async () => { root.render(<BulkPanel tabId={12} session={bulk} debug={false} buildVersion="0.5.2" onUpdate={() => {}} />); });
    expect(mount.textContent).toContain('Scan incomplete');
    expect(mount.querySelector('[aria-label="Images processed"]')).toBeNull();
    expect(mount.textContent).not.toContain('0 / 0 processed');
    const button = Array.from(mount.querySelectorAll('button')).find(button => button.textContent === 'Copy discovery diagnostics')!;
    await act(async () => { button.click(); });
    expect(sendMessage).toHaveBeenCalledWith(12, { type: 'FLOW_INSPECTOR', action: 'scan', debug: false });
    expect(request).not.toHaveBeenCalled();
    const json = JSON.parse(writeText.mock.calls[0][0]);
    expect(json.latestSnapshotId).toBe(report.snapshotId);
    expect(json.discovery.latest.acceptedImages).toBe(0);
    expect(json.diagnosticPurpose).toContain('not proof');
  } finally { await act(async () => { root.unmount(); }); mount.remove(); }
});

it('blocks an old injected discovery engine before dispatching start', async () => {
  const sendMessage = vi.fn(async () => ({ ok: true, session: { captureProtocol: 1, bulk: { protocol: 1, folderSupport: 1 } } }));
  vi.stubGlobal('chrome', { tabs: { get: async () => ({ id: 12, url: 'https://flow.google.com/' }), sendMessage } });
  await expect(bulkCommand(12, 'start')).rejects.toThrow('No operation was sent');
  expect(sendMessage).toHaveBeenCalledTimes(1);
  expect(sendMessage.mock.calls[0]).toEqual([12, { type: 'FLOW_INSPECTOR', action: 'get', debug: false }]);
});
