import type { DownloadQuality } from '../shared/download-quality';
import { useEffect, useState } from 'react';
import { bulkCommand } from '../shared/automation-client';
import { inspectTab } from '../shared/client';
import { exportCapture } from '../shared/capture';
import type { BulkCommand, BulkSession } from '../shared/bulk-types';
import { normalizeDownloadFolder } from '../shared/download-folder';
import type { DownloadScope } from '../shared/selection-types';
import { SelectionInspector } from './SelectionInspector';
import { Icon } from './Icon';
import { byteSize, elapsedTime, exportStatus, operationLabel } from './presentation';

export function BulkPanel({ tabId, session, debug, buildVersion, onUpdate }: { tabId: number; session: BulkSession; debug: boolean; buildVersion: string; onUpdate: (session: BulkSession) => void }) {
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const [retries, setRetries] = useState(session.settings.retries); const [notice, setNotice] = useState('');
  const [report, setReport] = useState('');
  const [scope, setScope] = useState<DownloadScope>(session.settings.scope ?? 'all');
  const [quality, setQuality] = useState<DownloadQuality>(session.settings.quality ?? '2k');
  const displayedQuality = session.active ? session.settings.quality ?? '2k' : quality;
  const [folder, setFolder] = useState(session.settings.folder ?? '');
  const [recentFolders, setRecentFolders] = useState<string[]>([]);
  const [preferencesReady, setPreferencesReady] = useState(false);
  const [pendingAction, setPendingAction] = useState<BulkCommand['action']>();
  const completed = session.assets.filter(asset => asset.status === 'completed').length;
  const failed = session.assets.filter(asset => asset.status === 'failed').length;
  const skipped = session.assets.filter(asset => asset.status === 'skipped').length;
  const current = session.assets.find(asset => asset.id === session.currentId);
  const total = session.assets.length; const done = completed + failed + skipped;
  const status = exportStatus(session.stage, failed, skipped, session.pauseRequested);
  const elapsed = elapsedTime(session.startedAt, session.endedAt);
  const hasProgress = session.discoveryComplete && total > 0 && !['IDLE', 'READY', 'DISCOVERING'].includes(session.stage);
  let folderError = '';
  try { normalizeDownloadFolder(folder); } catch (e) { folderError = e instanceof Error ? e.message : 'Invalid folder name.'; }
  useEffect(() => { if (session.active) setScope(session.settings.scope ?? 'all'); }, [session.active, session.settings.scope]);
  useEffect(() => {
    let disposed = false;
    void chrome.storage.local.get(['retries', 'downloadFolder', 'recentDownloadFolders', 'downloadQuality']).then(({ retries: saved, downloadFolder, recentDownloadFolders, downloadQuality }) => {
      if (!disposed && Number.isInteger(saved) && saved >= 0 && saved <= 2) setRetries(saved);
      if (disposed) return;
      if (!session.settings.quality && (downloadQuality === '1k' || downloadQuality === '2k' || downloadQuality === '4k')) setQuality(downloadQuality);
      if (session.settings.folder === undefined && typeof downloadFolder === 'string') setFolder(normalizeDownloadFolder(downloadFolder));
      if (Array.isArray(recentDownloadFolders)) setRecentFolders(recentDownloadFolders.filter((value): value is string => {
        try { return typeof value === 'string' && !!normalizeDownloadFolder(value); } catch { return false; }
      }).slice(0, 8));
    }).catch(() => { if (!disposed) setError('Could not read export preferences. Check your folder before starting.'); })
      .finally(() => { if (!disposed) setPreferencesReady(true); });
    return () => { disposed = true; };
  }, []);
  async function command(action: BulkCommand['action']) {
    setBusy(true); setPendingAction(action); setError(''); setNotice('');
    try {
      if (action === 'start' || action === 'retry') {
        // Retry keeps the original export destination; a new Start uses this field.
        const destination = normalizeDownloadFolder(action === 'retry' ? session.settings.folder ?? '' : folder);
        if (!await chrome.permissions.request({ permissions: ['downloads'] })) throw new Error('Downloads access was declined. No downloads were started.');
        if (action === 'start') {
          const recent = destination ? [destination, ...recentFolders.filter(value => value !== destination)].slice(0, 8) : recentFolders;
          await chrome.storage.local.set({ downloadFolder: destination, recentDownloadFolders: recent, downloadQuality: quality });
          setFolder(destination); setRecentFolders(recent);
        }
        onUpdate(await bulkCommand(tabId, action, retries, debug, destination, scope, action === 'retry' ? session.settings.quality ?? '2k' : quality));
        return;
      }
      onUpdate(await bulkCommand(tabId, action, retries, debug));
    } catch (e) { setError(e instanceof Error ? e.message : 'Bulk operation failed.'); }
    finally { setBusy(false); setPendingAction(undefined); }
  }
  async function openDownloads() {
    setError('');
    try {
      if (!await chrome.permissions.contains({ permissions: ['downloads'] })) throw new Error('Downloads access is needed to open the Downloads folder.');
      chrome.downloads.showDefaultFolder();
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not open the Downloads folder.'); }
  }
  async function copyReport() {
    setBusy(true); setError('');
    try {
      const current = await inspectTab('get', debug, tabId); const value = current.session.bulk;
      if (!value) throw new Error('Refresh Flow to reconnect the bulk downloader.');
      const text = JSON.stringify({ formatVersion: 1, phase: 'bulk', buildVersion, contentVersion: current.session.buildVersion,
        stage: value.stage, discoveryComplete: value.discoveryComplete, total: value.assets.length, startedAt: value.startedAt,
        endedAt: value.endedAt, quality: value.settings.quality ?? '2k', scope: value.settings.scope, error: value.error, currentStage: value.currentStage, discovery: value.discovery,
        assets: value.assets.map(asset => ({ index: asset.index, status: asset.status, attempts: asset.attempts, error: asset.error,
          download: asset.download ? { ...asset.download, filename: asset.download.filename.split(/[\\/]/).pop() } : undefined })) }, null, 2);
      setReport(text);
      try { await navigator.clipboard.writeText(text); setNotice('Bulk result copied. Media IDs and URLs are omitted.'); }
      catch { setNotice('Select and copy the result below.'); }
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not read the bulk result.'); }
    finally { setBusy(false); }
  }
  async function copyDiscoveryDiagnostics() {
    setBusy(true); setError(''); setNotice('');
    try {
      const { session: current } = await inspectTab('scan', debug, tabId);
      if (current.bulk?.active) throw new Error('Finish or cancel the export before capturing diagnostics.');
      const text = JSON.stringify({ ...exportCapture(current), discovery: current.bulk?.discovery,
        diagnosticPurpose: 'Image identity and missing action controls; not proof of a successful download.' }, null, 2);
      setReport(text);
      try { await navigator.clipboard.writeText(text); setNotice('Discovery diagnostics copied. Review private media identifiers and classes before sharing.'); }
      catch { setNotice('Select and copy the discovery diagnostics below. They may contain private media identifiers and classes.'); }
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not capture discovery diagnostics.'); }
    finally { setBusy(false); }
  }
  const activity = (session.settings.scope ?? 'all') === scope && session.stage !== 'IDLE' ? <section className={`activity-card tone-${status.tone}`} aria-label="Export progress">
      <div className="activity-heading"><div className="activity-title" role="status"><span className="status-dot" /><strong>{status.title}</strong></div>{elapsed && <span className="elapsed">{elapsed}</span>}</div>
      <p className="hint">{status.detail}</p>
      {session.stage === 'DISCOVERING' && <progress aria-label="Discovering images" />}
      {hasProgress && <><div className="progress-caption"><span>{done.toLocaleString()} / {total.toLocaleString()} processed</span><strong>{total ? Math.round(done / total * 100) : 0}%</strong></div><progress max={Math.max(1, total)} value={done} aria-label="Images processed" />
        <div className="result-stats" aria-label="Bulk download results"><div><strong>{completed}</strong><span>Completed</span></div><div><strong>{failed}</strong><span>Failed</span></div><div><strong>{skipped}</strong><span>Skipped</span></div></div>
      </>}
      {session.active && current && <div className="current-image"><Icon name="download" size={16} /><div><strong>{current.label}</strong><span>{operationLabel(session.currentStage)}{current.attempts > 1 ? ` · attempt ${current.attempts}` : ''}</span></div></div>}
      {session.active && current?.download && <p className="hint transfer-size">{byteSize(current.download.bytesReceived)} / {current.download.totalBytes > 0 ? byteSize(current.download.totalBytes) : 'size pending'} · {current.download.state === 'complete' ? 'Saved' : current.download.state === 'interrupted' ? 'Interrupted' : 'Downloading'}</p>}
      {session.stage === 'COMPLETED' && <button className="text-button" onClick={() => void openDownloads()}><Icon name="folder" size={16} />Open Downloads folder</button>}
    </section> : null;
  return <section className="bulk-panel" aria-label="Image export">
    <div className="section-heading"><div><span className="eyebrow">YOUR FLOW PROJECT</span><h2>Export images</h2></div><span className="quality-tag">{displayedQuality.toUpperCase()}</span></div>
    <div className="scope-toggle" role="group" aria-label="Images to download">
      <button aria-pressed={scope === 'all'} disabled={busy || session.active} onClick={() => setScope('all')}><Icon name="grid" size={16} />All images</button>
      <button aria-pressed={scope === 'selected'} disabled={busy || session.active} onClick={() => setScope('selected')}><Icon name="check" size={16} />Selected images</button>
    </div>
    {scope === 'all' && <section className="collection-card" aria-label="Image collection">
      <div className="collection-count"><span className="surface-icon"><Icon name="grid" /></span><div><strong>{session.discoveryComplete ? `${total.toLocaleString()} images` : total ? `${total.toLocaleString()} found` : session.stage === 'IDLE' ? 'Not scanned yet' : 'Scan incomplete'}</strong><span>{session.discoveryComplete ? 'In this project collection' : session.active ? 'Scanning the collection' : 'Start an export or preview the count'}</span></div></div>
      <button className="icon-button" aria-label="Refresh image collection" title="Scan images without downloading" disabled={busy || session.active} onClick={() => void command('discover')}><Icon name="refresh" /></button>
    </section>}
    {scope === 'selected' && <><p className="hint">Select images in Flow first. Downloads include selected cards currently loaded in the page; offscreen selections may be omitted. The list is fixed when you start.</p><SelectionInspector tabId={tabId} /></>}
    {(session.active || hasProgress) && activity}
    {session.active ? <div className="active-destination"><Icon name="folder" size={16} /><span>Saving to Downloads{session.settings.folder ? ` / ${session.settings.folder}` : ''}</span></div> : <section className="destination" aria-label="Download destination">
      <div className="field-heading"><label htmlFor="download-folder">Download folder</label><span className="field-note">Optional</span></div>
      <div className={`folder-path${folderError ? ' invalid' : ''}`}><Icon name="folder" /><span>Downloads /</span><input id="download-folder" type="text" list="recent-download-folders" autoComplete="off" placeholder="Folder name" maxLength={180}
        disabled={busy || session.active || !preferencesReady} value={folder} aria-invalid={!!folderError} aria-describedby={folderError ? 'folder-help folder-error' : 'folder-help'} onChange={event => { setFolder(event.target.value); setError(''); }} /></div>
      <datalist id="recent-download-folders">{recentFolders.map(value => <option key={value} value={value} />)}</datalist>
      <p className="hint" id="folder-help">Choose a recent name or create a folder with the first saved image. Leave blank for your browser’s Downloads folder.</p>
      {folderError && <p className="field-error" id="folder-error" role="alert">{folderError}</p>}
      {folder && <button className="text-button" disabled={busy || session.active || !preferencesReady} onClick={() => setFolder('')}>Use Downloads folder</button>}
      {scope === 'all' && !session.active && failed > 0 && <p className="hint">Retries keep the original folder: Downloads{session.settings.folder ? ` / ${session.settings.folder}` : ''}.</p>}
    </section>}
    {!session.active && <details className="export-settings"><summary><Icon name="settings" size={16} /><span>Export settings</span><small>{quality.toUpperCase()} · Sequential · {retries} retries</small></summary>
      <div className="settings-body"><div className="settings-row"><label htmlFor="download-quality">Quality</label><select id="download-quality" value={quality} disabled={busy} onChange={event => setQuality(event.target.value as DownloadQuality)}>{(['1k', '2k', '4k'] as const).map(value => <option key={value} value={value}>{value.toUpperCase()}</option>)}</select></div><div className="settings-row"><span>Processing</span><strong>One image at a time</strong></div>
        <label className="settings-row" htmlFor="retry-count"><span>Retries per image</span><select id="retry-count" disabled={busy || session.active} value={retries} onChange={event => { const value = Number(event.target.value); setRetries(value); void chrome.storage.local.set({ retries: value }).catch(() => setError('Could not save retry preference.')); }}>{[0, 1, 2].map(value => <option key={value} value={value}>{value}</option>)}</select></label>
      </div>
    </details>}
    {!session.active && !hasProgress && activity}
    {(error || ((session.settings.scope ?? 'all') === scope && session.error)) && <p className="error" role="alert">{error || session.error}</p>}
    {scope === 'all' && session.stage === 'ERROR' && !session.active && <div className="discovery-help">
      {session.discovery && <p className="hint">Latest scan: {session.discovery.latest.collectionImages} matching image elements, {session.discovery.latest.acceptedImages} supported cards, {session.discovery.latest.imagesWithoutMore} without More controls. These are rendered counts, not the full project total.</p>}
      <button className="wide" disabled={busy} onClick={() => void copyDiscoveryDiagnostics()}><Icon name="report" size={16} />Copy discovery diagnostics</button>
    </div>}
    {(session.settings.scope ?? 'all') === scope && failed > 0 && <details className="failed-list"><summary>Failed images · {failed}</summary>{session.assets.filter(asset => asset.status === 'failed').map(asset => <div className="failed-item" key={asset.id}><strong>{asset.label}</strong><p>{asset.error}</p><small>{asset.attempts} attempts</small></div>)}</details>}
    <div className="export-actions" data-active={session.active}>
      {session.active ? <div className="queue-controls">
        <button className="primary" disabled={busy} onClick={() => void command(session.pauseRequested || session.stage === 'PAUSED' ? 'resume' : 'pause')}><Icon name={session.pauseRequested || session.stage === 'PAUSED' ? 'play' : 'pause'} />{session.pauseRequested || session.stage === 'PAUSED' ? 'Resume' : 'Pause'}</button>
        <button disabled={busy} onClick={() => void command('cancel')}><Icon name="close" />Cancel</button>
      </div> : <>
        <button className="primary start-export" disabled={(scope === 'selected' && session.selectedDownloadSupport !== 1) || busy || !preferencesReady || !!folderError || (session.stage === 'READY' && total === 0)} onClick={() => void command('start')}><Icon name="download" />{pendingAction === 'start' ? 'Starting export…' : scope === 'selected' ? `Download Selected as ${quality.toUpperCase()}` : session.stage === 'COMPLETED' ? 'Start new export' : `Download All as ${quality.toUpperCase()}`}</button>
        {(session.settings.scope ?? 'all') === scope && failed > 0 && <button className="wide" disabled={busy || !preferencesReady} onClick={() => void command('retry')}><Icon name="refresh" size={16} />Retry Failed</button>}
      </>}
      <p className="action-hint">{scope === 'selected' ? (session.selectedDownloadSupport === 1 ? 'Download selected cards currently loaded in Flow.' : 'Reload the updated extension and refresh Flow to enable selected downloads.') : session.active ? 'Closing this panel keeps the export running.' : session.stage === 'COMPLETED' ? 'A new export downloads the collection again.' : 'Find images and save one at a time at the chosen quality.'}</p>
    </div>
    {(session.settings.scope ?? 'all') === scope && session.stage !== 'IDLE' && <button className="text-button result-copy" disabled={busy} onClick={() => void copyReport()}><Icon name="report" size={16} />Copy bulk result</button>}
    {notice && <p className="notice" role="status">{notice}</p>}
    {report && <details open><summary>Bulk result</summary><pre tabIndex={0}>{report}</pre></details>}
  </section>;
}
