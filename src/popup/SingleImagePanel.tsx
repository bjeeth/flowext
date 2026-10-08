import { useEffect, useState } from 'react';
import { singleCommand } from '../shared/automation-client';
import { runningStage, type SingleSession } from '../shared/automation-types';
import { inspectTab } from '../shared/client';
import { operationReport } from '../shared/operation-report';

export function SingleImagePanel({ tabId, session, debug, rescan, buildVersion, contentVersion }: { tabId: number; session: SingleSession; debug: boolean; rescan: () => void; buildVersion: string; contentVersion?: string }) {
  const [selected, setSelected] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [reportText, setReportText] = useState('');
  const state = session.state;
  const running = runningStage(state.stage);
  useEffect(() => {
    if (selected && !session.assets.some(asset => asset.key === selected)) setSelected('');
  }, [session.assets, selected]);
  async function start() {
    setBusy(true); setError(''); setNotice('');
    try {
      // Native optional-permission prompt is initiated directly by this explicit user click.
      const allowed = await chrome.permissions.request({ permissions: ['downloads'] });
      if (!allowed) throw new Error('Downloads access was declined. The inspector remains available.');
      await singleCommand(tabId, 'start', selected, debug);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not start single-image test.'); }
    finally { setBusy(false); }
  }
  async function cancel() {
    setBusy(true); setError('');
    try { await singleCommand(tabId, 'cancel'); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not cancel.'); }
    finally { setBusy(false); }
  }
  async function copyResult() {
    setBusy(true); setNotice('');
    try {
      const current = await inspectTab('get', debug, tabId);
      const json = JSON.stringify(operationReport(current.session.single, buildVersion, current.session.buildVersion, error || undefined), null, 2);
      setReportText(json);
      try { await navigator.clipboard.writeText(json); setNotice('Operation result copied. It contains no project URL or asset identifiers.'); }
      catch { setNotice('Select and copy the operation result below.'); }
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not read the current operation.'); }
    finally { setBusy(false); }
  }
  return <section className="single-test" aria-labelledby="single-heading">
    <span className="badge">2K UPSCALED</span>
    <h2 id="single-heading">Download from your Flow project</h2>
    <section className="stats" aria-label="Download results">
      <div><strong>{session.assets.length}</strong><span>Images in viewport</span></div>
      <div><strong>{session.assets.filter(asset => asset.loaded).length}</strong><span>Ready</span></div>
      <div><strong>{state.stage === 'COMPLETED' ? 1 : 0}</strong><span>Completed this operation</span></div>
      <div><strong>{state.stage === 'FAILED' ? 1 : 0}</strong><span>Failed this operation</span></div>
    </section>
    {session.assets.length === 0 && <p className="notice">No supported image cards are currently in view. Open an image project, wait for it to load, and scroll the intended image into view.</p>}
    <p className="hint">This build downloads one image automatically. A successful real 2K download is required before bulk processing is implemented.</p>
    <label className="asset-picker">Image to test
      <select value={selected} disabled={busy || running} onChange={event => setSelected(event.target.value)}>
        <option value="">Select one image</option>
        {session.assets.map(asset => <option key={asset.key} value={asset.key} disabled={!asset.loaded}>{asset.label}{asset.loaded ? '' : ' · loading'}</option>)}
      </select>
    </label>
    <p className="hint">The extension clicks More → Download → 2K and waits for browser completion. You do not need to click inside Flow. Close existing menus and avoid other Flow downloads.</p>
    <div className="actions">
      <button className="primary" disabled={busy || running || !selected || (state.stage !== 'IDLE' && !state.endedAt)} onClick={() => void start()}>Download selected image as 2K</button>
      <button disabled={busy || running} onClick={rescan}>Rescan visible images</button>
      {running && <button disabled={busy} onClick={() => void cancel()}>Cancel operation</button>}
    </div>
    <div className="status" role="status">{state.assetLabel ? `${state.assetLabel} · ` : ''}{state.stage.replaceAll('_', ' ')}</div>
    {state.download && <dl className="download-details">
      <dt>Browser download</dt><dd>#{state.download.id} · {state.download.state}</dd>
      <dt>Received</dt><dd>{state.download.bytesReceived.toLocaleString()} / {state.download.totalBytes > 0 ? state.download.totalBytes.toLocaleString() : 'unknown'} bytes</dd>
      <dt>Filename</dt><dd>{state.download.filename || 'Waiting for browser filename'}</dd>
    </dl>}
    {(state.error || error) && <p className="error" role="alert">{error || state.error}</p>}
    {state.stage === 'COMPLETED' && <p className="notice">Chrome reports this download complete. Verify the file and its 2K dimensions before proceeding to bulk development.</p>}
    <button className="wide" disabled={busy || (!state.startedAt && !error)} onClick={() => void copyResult()}>Copy operation result</button>
    {notice && <p className="notice" role="status">{notice}</p>}
    {reportText && <details open><summary>Operation result · content {contentVersion ?? 'unknown'}</summary><pre tabIndex={0}>{reportText}</pre></details>}
    <p className="hint">A timeout or cancel preserves browser downloads. Check Downloads before trying again to avoid duplicate files. Current filenames and duplicate handling remain under Chrome’s control.</p>
  </section>;
}
