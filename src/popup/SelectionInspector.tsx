import { useEffect, useState } from 'react';
import { selectionCommand } from '../shared/selection-client';
import type { SelectionCapture, SelectionCheckpoint } from '../shared/selection-types';

export function SelectionInspector({ tabId }: { tabId: number }) {
  const [capture, setCapture] = useState<SelectionCapture>();
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const [notice, setNotice] = useState(''); const [json, setJson] = useState('');
  useEffect(() => {
    let disposed = false;
    void selectionCommand(tabId, 'get').then(value => { if (!disposed) setCapture(value); })
      .catch(e => { if (!disposed) setError(e instanceof Error ? e.message : 'Could not read selection capture.'); });
    return () => { disposed = true; };
  }, [tabId]);
  async function record(checkpoint: SelectionCheckpoint) {
    setBusy(true); setError(''); setNotice(''); setJson('');
    try { setCapture(await selectionCommand(tabId, 'capture', checkpoint)); }
    catch (e) { setError(e instanceof Error ? e.message : 'Selection capture failed.'); }
    finally { setBusy(false); }
  }
  async function copy() {
    setBusy(true); setError(''); setNotice('');
    try {
      const current = await selectionCommand(tabId, 'get'); setCapture(current);
      if (!current.snapshots.length) throw new Error('Capture the selection checkpoints first.');
      const text = JSON.stringify({ phase: 'selection-inspection', ...current }, null, 2); setJson(text);
      try { await navigator.clipboard.writeText(text); setNotice('Selection evidence copied. Review identifiers and classes before sharing.'); }
      catch { setNotice('Select and copy the selection JSON below.'); }
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not copy selection evidence.'); }
    finally { setBusy(false); }
  }
  async function clear() {
    setBusy(true); setError(''); setNotice('');
    try { setCapture(await selectionCommand(tabId, 'clear')); setJson(''); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not clear selection capture.'); }
    finally { setBusy(false); }
  }
  return <section className="selection-inspector" aria-label="Flow multi-selection inspection">
    <p className="notice">Selected-image downloading needs Flow’s real selection DOM. It is unavailable in this build; All images remains available.</p>
    <p className="hint">Keep the same cards visible. Deselect all in Flow and capture baseline; select two images and capture selected; deselect one and capture deselected. These controls only read the page.</p>
    <div className="selection-checkpoints">
      <button disabled={busy} onClick={() => void record('baseline')}>Capture baseline</button>
      <button disabled={busy} onClick={() => void record('selected')}>Capture selected</button>
      <button disabled={busy} onClick={() => void record('deselected')}>Capture deselected</button>
      <button disabled={busy} onClick={() => void record('scrolled')}>Capture after scrolling</button>
    </div>
    <p className="hint">{capture?.snapshots.length ?? 0} snapshots captured{capture?.dropped ? ` · ${capture.dropped} older snapshots dropped` : ''}. Rendered cards only; this is not a selected-image count.</p>
    <button className="wide" disabled={busy || !capture?.snapshots.length} onClick={() => void copy()}>Copy selection JSON</button>
    <button className="wide" disabled={busy || !capture?.snapshots.length} onClick={() => void clear()}>Clear selection capture</button>
    {error && <p className="error" role="alert">{error}</p>}
    {notice && <p className="notice" role="status">{notice}</p>}
    {json && <details open><summary>Selection evidence</summary><pre tabIndex={0}>{json}</pre></details>}
  </section>;
}
