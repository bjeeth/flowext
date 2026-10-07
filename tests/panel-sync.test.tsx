// @vitest-environment jsdom
// Render the real extension UI. Only Chrome API transport is stubbed;
// no Flow page/card/menu DOM or fake assets are created.
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import App from '../src/popup/App';
import { inspectFlow } from '../src/content/inspector';
import type { InspectorSession } from '../src/shared/types';

it('syncs an idle panel with capture started elsewhere and copies fresh bound-tab metadata', async () => {
  vi.useFakeTimers();
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const report = inspectFlow(document, document.URL);
  let backend: InspectorSession = { captureProtocol: 1, buildVersion: '0.1.1', observing: false, debug: false,
    sessionId: 'extension-transport-test', latest: report, history: [report], historyDropped: 0, interactionSnapshots: [],
    checkpoints: { initial: report }, observation: { active: false, startedAt: null, stoppedAt: null, lastError: null } };
  const sendMessage = vi.fn(async () => ({ ok: true, session: backend }));
  vi.stubGlobal('chrome', {
    windows: { getCurrent: async () => ({ id: 1 }) },
    storage: { local: { get: async () => ({ debug: false }) } },
    tabs: { query: async () => [{ id: 12, url: 'https://flow.google.com/' }], get: async () => ({ id: 12, url: 'https://flow.google.com/' }), sendMessage },
  });
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
  const mount = document.createElement('div'); document.body.append(mount);
  const root = createRoot(mount);
  const button = (name: string) => Array.from(mount.querySelectorAll('button')).find(b => b.textContent === name)!;
  try {
    await act(async () => { root.render(<App sidepanel />); });
    expect(button('Start menu capture')).toBeDefined();
    expect(button('Copy JSON').disabled).toBe(true);
    // Capture starts from the other extension surface while this panel last saw idle state.
    backend = { ...backend, observing: true, observation: { active: true, startedAt: '2026-10-07T00:00:00.000Z', stoppedAt: null, lastError: null } };
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expect(button('Stop and copy JSON')).toBeDefined();
    expect(button('Copy JSON').disabled).toBe(false);
    expect(button('Clear capture history').disabled).toBe(true);
    // Before the next poll, backend changes again. Copy must read this current session.
    backend = { ...backend, observing: false, observation: { ...backend.observation!, active: false, stoppedAt: '2026-10-07T00:00:01.000Z' } };
    await act(async () => { button('Copy JSON').click(); });
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(JSON.parse(writeText.mock.calls[0][0]).observation.stoppedAt).toBe('2026-10-07T00:00:01.000Z');
    expect(sendMessage).toHaveBeenLastCalledWith(12, { type: 'FLOW_INSPECTOR', action: 'get', debug: false });
  } finally {
    await act(async () => { root.unmount(); }); mount.remove();
    delete (navigator as unknown as { clipboard?: unknown }).clipboard;
    vi.unstubAllGlobals(); vi.useRealTimers();
  }
});
