import { useEffect, useState } from 'react';
import { bulkCommand } from '../shared/automation-client';
import { inspectTab } from '../shared/client';
import type { BulkCommand, BulkSession } from '../shared/bulk-types';
import { normalizeDownloadFolder } from '../shared/download-folder';
import type { DownloadScope } from '../shared/selection-types';
import { SelectionInspector } from './SelectionInspector';

export function BulkPanel({ tabId, session, debug, buildVersion, onUpdate }: { tabId: number; session: BulkSession; debug: boolean; buildVersion: string; onUpdate: (session: BulkSession) => void }) {
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const [retries, setRetries] = useState(session.settings.retries); const [notice, setNotice] = useState('');
  const [report, setReport] = useState('');
  const [scope, setScope] = useState<DownloadScope>(session.settings.scope ?? 'all');
  const [folder, setFolder] = useState(session.settings.folder ?? '');
  const [recentFolders, setRecentFolders] = useState<string[]>([]);
  const [preferencesReady, setPreferencesReady] = useState(false);
  const completed = session.assets.filter(asset => asset.status === 'completed').length;
  const failed = session.assets.filter(asset => asset.status === 'failed').length;
  const skipped = session.assets.filter(asset => asset.status === 'skipped').length;
  const current = session.assets.find(asset => asset.id === session.currentId);
  const total = session.assets.length; const done = completed + failed + skipped;
  useEffect(() => { if (session.active) setScope(session.settings.scope ?? 'all'); }, [session.active, session.settings.scope]);
  useEffect(() => {
    let disposed = false;
    void chrome.storage.local.get(['retries', 'downloadFolder', 'recentDownloadFolders']).then(({ retries: saved, downloadFolder, recentDownloadFolders }) => {
      if (!disposed && Number.isInteger(saved) && saved >= 0 && saved <= 2) setRetries(saved);
      if (disposed) return;
      if (session.settings.folder === undefined && typeof downloadFolder === 'string') setFolder(normalizeDownloadFolder(downloadFolder));
      if (Array.isArray(recentDownloadFolders)) setRecentFolders(recentDownloadFolders.filter((value): value is string => {
        try { return typeof value === 'string' && !!normalizeDownloadFolder(value); } catch { return false; }
      }).slice(0, 8));
    }).catch(() => { if (!disposed) setError('Could not read export preferences. Check your folder before starting.'); })
      .finally(() => { if (!disposed) setPreferencesReady(true); });
    return () => { disposed = true; };
  }, []);
  async function command(action: BulkCommand['action']) {
    setBusy(true); setError(''); setNotice('');
    try {
      if (action === 'start' && scope === 'selected') throw new Error('Selected-image downloads need verified Flow selection evidence. Capture selection DOM first.');
      if (action === 'start' || action === 'retry') {
        // Retry keeps the original export destination; a new Start uses this field.
        const destination = normalizeDownloadFolder(action === 'retry' ? session.settings.folder ?? '' : folder);
        if (!await chrome.permissions.request({ permissions: ['downloads'] })) throw new Error('Downloads access was declined. No downloads were started.');
        if (action === 'start') {
          const recent = destination ? [destination, ...recentFolders.filter(value => value !== destination)].slice(0, 8) : recentFolders;
          await chrome.storage.local.set({ downloadFolder: destination, recentDownloadFolders: recent });
          setFolder(destination); setRecentFolders(recent);
        }
        onUpdate(await bulkCommand(tabId, action, retries, debug, destination, scope));
        return;
      }
      onUpdate(await bulkCommand(tabId, action, retries, debug));
    } catch (e) { setError(e instanceof Error ? e.message : 'Bulk operation failed.'); }
    finally { setBusy(false); }
  }
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
    <div className="scope-toggle" role="group" aria-label="Images to download">
      <button aria-pressed={scope === 'all'} disabled={busy || session.active} onClick={() => setScope('all')}>All images</button>
      <button aria-pressed={scope === 'selected'} disabled={busy || session.active} onClick={() => setScope('selected')}>Selected images</button>
    </div>
    {scope === 'all' && <section className="stats" aria-label="Bulk download results">
      <div><strong>{total || (session.discoveryComplete ? 0 : '—')}</strong><span>{session.discoveryComplete ? 'Images discovered' : 'Images found so far'}</span></div>
      <div><strong>{completed}</strong><span>Completed</span></div>
      <div><strong>{failed}</strong><span>Failed</span></div>
      <div><strong>{skipped}</strong><span>Skipped</span></div>
    </section>}
    <p className="hint">All images scans the collection when you start or refresh, then performs More → Download → 2K for each image. Opening the panel leaves Flow’s current selection and scroll position alone.</p>
    {scope === 'selected' && <SelectionInspector tabId={tabId} />}
    <section className="destination" aria-label="Download destination">
      <label className="asset-picker" htmlFor="download-folder">Download folder</label>
      <div className="folder-path"><span>Downloads /</span><input id="download-folder" type="text" list="recent-download-folders" autoComplete="off" placeholder="e.g. Flow Exports/Project 1" maxLength={180}
        disabled={busy || session.active || !preferencesReady} value={folder} aria-describedby="folder-help" onChange={event => { setFolder(event.target.value); setError(''); }} /></div>
      <datalist id="recent-download-folders">{recentFolders.map(value => <option key={value} value={value} />)}</datalist>
      <p className="hint" id="folder-help">Choose a recent folder or enter a new name. Missing folders are created when the first file is saved. Leave blank to use your browser’s Downloads folder.</p>
      <button disabled={busy || session.active || !preferencesReady || !folder} onClick={() => setFolder('')}>Use Downloads folder</button>
      {session.active && <p className="hint">This export: Downloads{session.settings.folder ? ` / ${session.settings.folder}` : ''}</p>}
      {!session.active && failed > 0 && <p className="hint">Retry Failed keeps the original folder: Downloads{session.settings.folder ? ` / ${session.settings.folder}` : ''}.</p>}
    </section>
    <div className="actions">
      <button className="primary" disabled={scope === 'selected' || busy || session.active || !preferencesReady || (session.stage === 'READY' && total === 0)} onClick={() => void command('start')}>{scope === 'all' ? 'Download All as 2K' : 'Download Selected as 2K'}</button>
      {scope === 'all' && <button disabled={busy || session.active} onClick={() => void command('discover')}>Refresh image collection</button>}
      {session.active && <div className="queue-controls">
        <button disabled={busy} onClick={() => void command(session.pauseRequested || session.stage === 'PAUSED' ? 'resume' : 'pause')}>{session.pauseRequested || session.stage === 'PAUSED' ? 'Resume' : 'Pause'}</button>
        <button disabled={busy} onClick={() => void command('cancel')}>Cancel</button>
      </div>}
      {scope === 'all' && !session.active && failed > 0 && <button disabled={busy || !preferencesReady} onClick={() => void command('retry')}>Retry Failed</button>}
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
