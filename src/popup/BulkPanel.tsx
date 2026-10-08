import { useEffect, useRef, useState } from 'react';
import { bulkCommand } from '../shared/automation-client';
import { inspectTab } from '../shared/client';
import type { BulkCommand, BulkSession } from '../shared/bulk-types';

export function BulkPanel({ tabId, session, debug, buildVersion, onUpdate }: { tabId: number; session: BulkSession; debug: boolean; buildVersion: string; onUpdate: (session: BulkSession) => void }) {
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const [retries, setRetries] = useState(session.settings.retries); const [notice, setNotice] = useState('');
  const [report, setReport] = useState(''); const autoStarted = useRef(false);
  const completed = session.assets.filter(asset => asset.status === 'completed').length;
  const failed = session.assets.filter(asset => asset.status === 'failed').length;
  const skipped = session.assets.filter(asset => asset.status === 'skipped').length;
  const current = session.assets.find(asset => asset.id === session.currentId);
  const total = session.assets.length; const done = completed + failed + skipped;
  useEffect(() => {
    let disposed = false;
    void chrome.storage.local.get('retries').then(({ retries: saved }) => {
      if (!disposed && Number.isInteger(saved) && saved >= 0 && saved <= 2) setRetries(saved);
    }).catch(() => setError('Could not read retry preference.'));
    return () => { disposed = true; };
  }, []);
  async function command(action: BulkCommand['action']) {
    setBusy(true); setError(''); setNotice('');
    try {
      if (action === 'start' || action === 'retry') {
        if (!await chrome.permissions.request({ permissions: ['downloads'] })) throw new Error('Downloads access was declined. No downloads were started.');
      }
      onUpdate(await bulkCommand(tabId, action, retries, debug));
    } catch (e) { setError(e instanceof Error ? e.message : 'Bulk operation failed.'); }
    finally { setBusy(false); }
  }
  useEffect(() => {
    // Automatically discover on connection; the persistent content script owns the work.
    if (!autoStarted.current && session.stage === 'IDLE' && !session.active) {
      autoStarted.current = true; void command('discover');
    }
  }, [session.stage, session.active]);
  async function copyReport() {
    setBusy(true); setError('');
    try {
      const current = await inspectTab('get', debug, tabId); const value = current.session.bulk;
      if (!value) throw new Error('Refresh Flow to reconnect the bulk downloader.');
      const text = JSON.stringify({ formatVersion: 1, phase: 'bulk', buildVersion, contentVersion: current.session.buildVersion,
        stage: value.stage, discoveryComplete: value.discoveryComplete, total: value.assets.length, startedAt: value.startedAt,
        endedAt: value.endedAt, error: value.error, currentStage: value.currentStage,
        assets: value.assets.map(asset => ({ index: asset.index, status: asset.status, attempts: asset.attempts, error: asset.error,
          download: asset.download ? { ...asset.download, filename: asset.download.filename.split(/[\\/]/).pop() } : undefined })) }, null, 2);
      setReport(text);
      try { await navigator.clipboard.writeText(text); setNotice('Bulk result copied. Media IDs and URLs are omitted.'); }
      catch { setNotice('Select and copy the result below.'); }
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not read the bulk result.'); }
    finally { setBusy(false); }
  }
  return <section className="bulk-panel">
    <span className="badge">2K UPSCALED · SEQUENTIAL</span>
    <h2>Download your Flow project</h2>
    <section className="stats" aria-label="Bulk download results">
      <div><strong>{total || (session.discoveryComplete ? 0 : '—')}</strong><span>{session.discoveryComplete ? 'Images discovered' : 'Images found so far'}</span></div>
      <div><strong>{completed}</strong><span>Completed</span></div>
      <div><strong>{failed}</strong><span>Failed</span></div>
      <div><strong>{skipped}</strong><span>Skipped</span></div>
    </section>
    <p className="hint">The extension discovers the scrolling collection, then automatically performs More → Download → 2K for each image. Keep this project open and avoid other Flow downloads during the queue.</p>
    <div className="actions">
      <button className="primary" disabled={busy || session.active || (session.stage === 'READY' && total === 0)} onClick={() => void command('start')}>Download All as 2K</button>
      <button disabled={busy || session.active} onClick={() => void command('discover')}>Refresh image collection</button>
      {session.active && <div className="queue-controls">
        <button disabled={busy} onClick={() => void command(session.pauseRequested || session.stage === 'PAUSED' ? 'resume' : 'pause')}>{session.pauseRequested || session.stage === 'PAUSED' ? 'Resume' : 'Pause'}</button>
        <button disabled={busy} onClick={() => void command('cancel')}>Cancel</button>
      </div>}
      {!session.active && failed > 0 && <button disabled={busy} onClick={() => void command('retry')}>Retry Failed</button>}
    </div>
    <div className="status" role="status">{session.stage.replaceAll('_', ' ')}{session.pauseRequested && session.stage !== 'PAUSED' ? ' · pause after current operation' : ''}</div>
    {session.discoveryComplete && <><p className="progress-caption">{done} / {total} processed</p><progress max={Math.max(1, total)} value={done} aria-label="Images processed" /></>}
    {current && <p className="hint">Current: {current.label} · {(session.currentStage ?? current.status).replaceAll('_', ' ')} · attempt {current.attempts}</p>}
    {current?.download && <p className="hint">Download #{current.download.id}: {current.download.bytesReceived.toLocaleString()} / {current.download.totalBytes > 0 ? current.download.totalBytes.toLocaleString() : 'unknown'} bytes · {current.download.state}</p>}
    {session.stage === 'COMPLETED' && <p className="notice">Export finished: {completed} completed, {failed} failed, {skipped} skipped. Completion uses browser download state.</p>}
    {(session.error || error) && <p className="error" role="alert">{error || session.error}</p>}
    {failed > 0 && <details><summary>Failed images · {failed}</summary>{session.assets.filter(asset => asset.status === 'failed').map(asset => <p className="error" key={asset.id}>{asset.label}: {asset.error} · {asset.attempts} attempts</p>)}</details>}
    <label className="asset-picker retries">Retries per image<select disabled={busy || session.active} value={retries} onChange={event => { const value = Number(event.target.value); setRetries(value); void chrome.storage.local.set({ retries: value }).catch(() => setError('Could not save retry preference.')); }}>{[0, 1, 2].map(value => <option key={value} value={value}>{value}</option>)}</select></label>
    <button className="wide" disabled={busy || session.stage === 'IDLE'} onClick={() => void copyReport()}>Copy bulk result</button>
    {notice && <p className="notice" role="status">{notice}</p>}
    {report && <details open><summary>Bulk result</summary><pre tabIndex={0}>{report}</pre></details>}
    <p className="hint">Cancel preserves existing files. Discovery ends after repeated stable scans at the collection bottom; an incomplete scan reports an error instead of claiming all images.</p>
  </section>;
}
