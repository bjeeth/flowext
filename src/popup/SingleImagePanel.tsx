import { useEffect, useState } from 'react';
import { singleCommand } from '../shared/automation-client';
import { runningStage, type SingleSession } from '../shared/automation-types';

export function SingleImagePanel({ tabId, session, debug, rescan }: { tabId: number; session: SingleSession; debug: boolean; rescan: () => void }) {
  const [selected, setSelected] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const state = session.state;
  const running = runningStage(state.stage);
  useEffect(() => {
    if (selected && !session.assets.some(asset => asset.key === selected)) setSelected('');
  }, [session.assets, selected]);
  async function start() {
    setBusy(true); setError('');
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
  return <section className="single-test" aria-labelledby="single-heading">
    <span className="badge">PHASE 2 · SINGLE IMAGE</span>
    <h2 id="single-heading">Test one 2K download</h2>
    <p className="hint">{session.assets.length} rendered images in the viewport. This is a single-image validation step; bulk processing is deferred.</p>
    <label className="asset-picker">Image to test
      <select value={selected} disabled={busy || running} onChange={event => setSelected(event.target.value)}>
        <option value="">Select one image</option>
        {session.assets.map(asset => <option key={asset.key} value={asset.key} disabled={!asset.loaded}>{asset.label}{asset.loaded ? '' : ' · loading'}</option>)}
      </select>
    </label>
    <p className="hint">Labels follow the currently rendered DOM order. Confirm the intended image before starting. Close Flow menus and avoid other Flow downloads during this test.</p>
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
    <p className="hint">A timeout or cancel preserves browser downloads. Check Downloads before trying again to avoid duplicate files. Current filenames and duplicate handling remain under Chrome’s control.</p>
  </section>;
}
