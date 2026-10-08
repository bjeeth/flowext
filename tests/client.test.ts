// @vitest-environment jsdom
// Chrome transport is stubbed; the actual test document remains on its NON-Flow origin.
// No Flow DOM, fake assets, menu structure, or downloads are created.
import { afterEach, expect, it, vi } from 'vitest';
import { inspectFlow } from '../src/content/inspector';
import { liveMenuCapture, inspectTab } from '../src/shared/client';
import type { InspectorSession } from '../src/shared/types';

function session(startedAt: string | null): InspectorSession {
  const report = inspectFlow(document, document.URL);
  return { captureProtocol: 1, buildVersion: '0.1.1', observation: { active: !!startedAt, startedAt, stoppedAt: null, lastError: null },
    observing: !!startedAt, debug: false, sessionId: 'transport-test', latest: report, history: [report], historyDropped: 0,
    interactionSnapshots: [], checkpoints: { initial: report } };
}
function transport(live: InspectorSession, url = 'https://flow.google.com/') {
  const tabs = {
    get: vi.fn().mockResolvedValue({ id: 12, url }),
    query: vi.fn().mockResolvedValue([{ id: 99, url: 'https://flow.google.com/' }]),
    sendMessage: vi.fn().mockResolvedValue({ ok: true, session: live }),
  };
  const scripting = { executeScript: vi.fn() };
  vi.stubGlobal('chrome', { tabs, scripting });
  return { tabs, scripting };
}
afterEach(() => vi.unstubAllGlobals());

it('copies live observation state from the bound tab rather than an earlier idle UI snapshot', async () => {
  const cached = session(null);
  const live = session('2026-10-07T00:00:00.000Z');
  const { tabs } = transport(live);
  const capture = await liveMenuCapture(12, false);
  expect(cached.observation?.startedAt).toBeNull();
  expect(capture).toBe(live);
  expect(tabs.query).not.toHaveBeenCalled();
  expect(tabs.sendMessage).toHaveBeenCalledWith(12, { type: 'FLOW_INSPECTOR', action: 'get', debug: false });
});
it('refuses to copy menu evidence when live observation has not started', async () => {
  transport(session(null));
  await expect(liveMenuCapture(12, false)).rejects.toThrow('Start menu capture');
});
it('keeps stop attached to the captured tab after the active tab changes', async () => {
  const { tabs } = transport(session('2026-10-07T00:00:00.000Z'));
  await inspectTab('stop', false, 12);
  expect(tabs.query).not.toHaveBeenCalled();
  expect(tabs.sendMessage).toHaveBeenCalledWith(12, { type: 'FLOW_INSPECTOR', action: 'stop', debug: false });
});
it('rejects a bound tab that navigated outside the exact Flow host without injection or messaging', async () => {
  const { tabs, scripting } = transport(session(null), 'https://flow.google.com.evil.test/');
  await expect(inspectTab('get', false, 12)).rejects.toThrow('no longer accessible');
  expect(tabs.sendMessage).not.toHaveBeenCalled();
  expect(scripting.executeScript).not.toHaveBeenCalled();
});
it('requires refresh when an older content script replies after an extension update', async () => {
  const old = session(null); delete old.captureProtocol;
  transport(old);
  await expect(inspectTab('get', false, 12)).rejects.toThrow('older inspector');
});
it('explains page refresh when an invalidated content script blocks reinjection', async () => {
  const { tabs, scripting } = transport(session(null));
  tabs.sendMessage.mockRejectedValue(new Error('Receiving end does not exist.'));
  await expect(inspectTab('get', false, 12)).rejects.toThrow('Refresh Flow after reloading the extension');
  expect(scripting.executeScript).toHaveBeenCalledTimes(1);
  expect(tabs.sendMessage).toHaveBeenCalledTimes(2);
});
