import { useEffect, useRef, useState } from 'react';
import { exportCapture } from '../shared/capture';
import { inspectTab, liveMenuCapture } from '../shared/client';
import type { InspectorCommand, InspectorSession } from '../shared/types';
import './styles.css';
import { BulkPanel } from './BulkPanel';
import { Icon } from './Icon';

export default function App({ sidepanel = false }: { sidepanel?: boolean }) {
  const [session, setSession] = useState<InspectorSession>();
  const [debug, setDebug] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [showJson, setShowJson] = useState(false);
  const [tabId, setTabId] = useState<number>();
  const [settingsReady, setSettingsReady] = useState(false);
  const [windowId, setWindowId] = useState<number>();
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const buildVersion = chrome.runtime.getManifest().version;
  const mounted = useRef(true);
  const commandVersion = useRef(0);
  const hasBulk = session?.bulk?.protocol === 1 && session.bulk.folderSupport === 1 && session.bulk.selectionCaptureSupport === 1 && session.bulk.discoverySupport === 2;
  useEffect(() => {
    mounted.current = true;
    void chrome.windows.getCurrent().then(window => { if (mounted.current) setWindowId(window.id); })
      .catch(() => { if (mounted.current) setError('Could not identify the browser window.'); });
    void (async () => {
      try {
        const result = await chrome.storage.local.get('debug');
        const preference = result.debug === true;
        if (!mounted.current) return;
        setDebug(preference);
        // Reopening either surface attaches to the actual page session, without starting it.
        const current = await inspectTab('get', preference);
        if (mounted.current) { setSession(current.session); setTabId(current.tabId); }
      } catch (e) {
        if (mounted.current) {
          const message = e instanceof Error ? e.message : 'Could not connect to Flow.';
          if (!message.startsWith('Open https://flow.google.com/')) setError(message);
        }
      }
      finally { if (mounted.current) setSettingsReady(true); }
    })();
    return () => { mounted.current = false; };
  }, []);
  useEffect(() => {
    if (tabId === undefined) return;
    let inFlight = false;
    let disposed = false;
    const timer = window.setInterval(() => {
      if (inFlight) return;
      inFlight = true;
      const version = commandVersion.current;
      // Poll even when this surface last saw an idle session: the other surface may start capture.
      const lightweight = hasBulk && !inspectorOpen;
      void chrome.tabs.sendMessage(tabId, { type: lightweight ? 'FLOW_BULK' : 'FLOW_INSPECTOR', action: 'get' }).then(reply => {
        if (disposed || !mounted.current || version !== commandVersion.current) return;
        if (reply?.ok && lightweight) setSession(previous => previous ? { ...previous, bulk: reply.bulk } : previous);
        else if (reply?.ok) setSession(reply.session);
        else setError(reply?.error ?? 'Flow inspector did not respond. Reopen it on the Flow tab.');
      }).catch(() => {
        if (!disposed && mounted.current && version === commandVersion.current) { setSession(undefined); setTabId(undefined); setError('Flow tab reloaded or closed. Reopen the extension on the Flow tab.'); }
      }).finally(() => { inFlight = false; });
    }, 1000);
    return () => { disposed = true; window.clearInterval(timer); };
  }, [tabId, inspectorOpen, hasBulk]);

  async function run(action: InspectorCommand['action']) {
    commandVersion.current++;
    setBusy(true); setError(''); setNotice('');
    try {
      const result = await inspectTab(action, debug, tabId);
      setSession(result.session); setTabId(result.tabId);
    } catch (e) { setError(e instanceof Error ? e.message : 'Inspection failed.'); }
    finally { setBusy(false); }
  }
  async function writeCapture(current: InspectorSession) {
    await navigator.clipboard.writeText(JSON.stringify(exportCapture(current), null, 2));
    setNotice('Live capture JSON copied. Review asset identifiers before sharing.');
  }
  async function copyReport() {
    if (tabId === undefined) return;
    commandVersion.current++;
    setBusy(true); setError(''); setNotice('');
    try {
      // Fetch fresh page state so popup/side-panel caches cannot export an earlier idle session.
      const current = await liveMenuCapture(tabId, debug);
      setSession(current);
      await writeCapture(current);
    } catch (e) { setError(e instanceof Error ? e.message : 'Copy failed. Select and copy the current JSON shown below.'); }
    finally { setBusy(false); }
  }
  async function stopAndCopy() {
    if (tabId === undefined) return;
    commandVersion.current++;
    setBusy(true); setError(''); setNotice('');
    try {
      const { session: current } = await inspectTab('stop', debug, tabId);
      setSession(current);
      if (!current.observation?.startedAt) throw new Error('Menu capture has not started on this tab. Click Start menu capture first.');
      await writeCapture(current);
    } catch (e) { setError(e instanceof Error ? e.message : 'Copy failed. Select and copy the current JSON shown below.'); }
    finally { setBusy(false); }
  }
  async function openPanel() {
    // Call open directly within the user gesture; do not await a tab query first.
    if (windowId === undefined) return;
    try { await chrome.sidePanel.open({ windowId }); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not open side panel.'); }
  }
  async function toggleDebug(value: boolean) {
    setDebug(value);
    try { await chrome.storage.local.set({ debug: value }); }
    catch { setError('Could not save debug setting.'); }
  }
  const report = session?.latest;
  return <main data-surface={sidepanel ? 'sidepanel' : 'popup'}>
    <header className="app-header"><div className="brand-mark"><Icon name="download" size={22} /></div><div className="brand-title"><h1>Flow Bulk Downloader</h1><p>Image exports <span className="version">v{buildVersion}</span></p></div>
      {!sidepanel && <button className="icon-button panel-launch" aria-label="Open download side panel" title="Open download side panel" disabled={windowId === undefined} onClick={() => void openPanel()}><Icon name="panel" /></button>}
    </header>
    <div className="app-content">
    <div className={`connection-status ${hasBulk ? 'connected' : ''}`} role="status"><span className="status-dot" />{!settingsReady ? 'Connecting to Flow…' : hasBulk ? 'Flow connected' : session ? 'Refresh Flow to activate bulk automation' : 'Open a Flow project to begin.'}</div>
    {session && !hasBulk && <p className="error" role="alert">This tab still has page script {session.buildVersion ?? 'unknown'} injected. Refresh the Flow page and reopen the extension to activate v{buildVersion}. The updated download controls require the new page script.</p>}
    {error && <p className="error" role="alert">{error}</p>}
    {hasBulk && session?.bulk && tabId !== undefined && <BulkPanel tabId={tabId} session={session.bulk} debug={debug} buildVersion={buildVersion} onUpdate={bulk => setSession(previous => previous ? { ...previous, bulk } : previous)} />}
    {!hasBulk && <section className="empty-state"><span className="empty-icon"><Icon name={session ? 'refresh' : 'grid'} size={28} /></span><h2>{!settingsReady ? 'Connecting to your project' : session ? 'Refresh your Flow tab' : 'Open your Flow project'}</h2><p>{!settingsReady ? 'Checking the current tab for a Flow project.' : session ? 'Refresh the project after an extension update, then reconnect.' : 'Open a project with generated images, then click the extension from that tab.'}</p>
      {settingsReady && <div className="actions">{!session && <a className="button primary" href="https://flow.google.com/" target="_blank" rel="noreferrer">Open Google Flow</a>}<button disabled={busy} onClick={() => void run('get')}><Icon name="refresh" size={16} />Reconnect to Flow</button></div>}
    </section>}
    <details className="developer-tools" onToggle={event => setInspectorOpen(event.currentTarget.open)}><summary>Developer tools · DOM inspector{session?.observing ? ' · recording' : ''}</summary>
    {inspectorOpen && <>
    <label className="setting"><span>Debug console logging<small id="debug-help">Write detailed diagnostics to the console</small></span><input type="checkbox" role="switch" aria-label="Debug console logging" aria-describedby="debug-help" checked={debug} disabled={!settingsReady} onChange={event => void toggleDebug(event.target.checked)} /></label>
    <section className="intro"><span className="badge">READ ONLY</span><h2>Inspect your Flow project</h2><p>Capture image and menu structure when diagnosing Flow UI changes.</p></section>
    <div className="status" role="status">{session?.observing ? 'Observing DOM changes · stops after 10 minutes' : report ? 'Snapshot captured' : 'Open a Flow project to begin.'}</div>
    <section className="stats" aria-label="Inspection results">
      <div><strong>{report?.candidates.length ?? '—'}</strong><span>Sampled image candidates</span></div>
      <div><strong>{report?.controls.filter(c => c.kind === 'more').length ?? '—'}</strong><span>Visible More controls</span></div>
      <div><strong>{report?.controls.filter(c => c.kind === 'download').length ?? '—'}</strong><span>Download</span></div>
      <div><strong>{report?.controls.filter(c => c.kind === '2k').length ?? '—'}</strong><span>2K Upscaled</span></div>
    </section>
    <p className="hint">Candidates are a sample of up to 24 images, with manual image context and viewport images prioritized. They are not a project count. Open menus manually while observing. Closed menus may be absent from the DOM.</p>
    <p className="hint">More counts can include the page header. Use the image's own menu. Hidden card controls remain in the diagnostic context even when absent from the visible count.</p>
    <div className="actions">
      <button className="primary" disabled={busy || !settingsReady || session?.bulk?.active} onClick={() => void (session?.observing ? stopAndCopy() : run('observe'))}>{session?.observing ? 'Stop and copy JSON' : 'Start menu capture'}</button>
      <button disabled={busy || !settingsReady || session?.bulk?.active} onClick={() => void run('scan')}>Take DOM snapshot</button>
      {session?.observing && <button disabled={busy} onClick={() => void run('stop')}>Stop observing</button>}
    </div>
    <p className="hint">Debug changes apply on the next inspection action.</p>
    {session?.observation?.lastError && <p className="error" role="alert">{session.observation.lastError}</p>}
    {notice && <p className="notice" role="status">{notice}</p>}
    {session && <>
      {session.interactionSnapshots.length === 0 && <p className="notice">No manual interactions recorded yet. Click Start menu capture, confirm the status says Observing, then open the image menus manually.</p>}
      {!session.checkpoints.qualityVisible && <p className="hint">No visible 2K Upscaled snapshot captured yet. Open More → Download and leave the quality menu visible for at least half a second.</p>}
      <div className="report-heading"><h2>DOM evidence <small>{session.history.length} snapshots</small></h2><button disabled={busy || !session.observation?.startedAt} onClick={() => void copyReport()}>Copy JSON</button></div>
      {report?.truncated && <p className={report.truncationReasons.every(reason => reason.startsWith('Image diagnostic sample')) ? 'hint' : 'error'}>
        {report.truncationReasons.join(' ')} This is a diagnostic sample, not full asset discovery.
      </p>}
      <details onToggle={event => setShowJson(event.currentTarget.open)}><summary>Diagnostic JSON · format v2 · current session</summary>{showJson && <pre tabIndex={0}>{JSON.stringify(exportCapture(session), null, 2)}</pre>}</details>
      <p className="hint">Baseline and first Download/2K snapshots are retained. {session.historyDropped > 0 ? `${session.historyDropped} older rolling snapshots were dropped. ` : ''}Node IDs apply only to this page session; identifiers still need stability verification.</p>
      <p className="hint">Copy JSON reads the live captured tab. Clear history resets the capture and requires starting it again.</p>
      <button className="wide" disabled={busy || session.observing} onClick={() => void run('clear')}>Clear capture history</button>
    </>}
    </>}
    </details>
    <footer><Icon name="info" size={13} /><span>{hasBulk ? 'Keep your Flow tab open. Closing this panel won’t stop an export.' : 'Automates Flow’s normal download controls. Sign in through Google Flow.'}</span></footer>
    </div>
  </main>;
}
