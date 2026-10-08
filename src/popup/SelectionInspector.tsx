import { useEffect, useState } from 'react';
import { selectionCommand } from '../shared/selection-client';
import type { SelectionCapture, SelectionCheckpoint } from '../shared/selection-types';
import { Icon } from './Icon';

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
    <div className="selection-unavailable"><Icon name="info" /><div><strong>Selected downloads need setup</strong><p>We still need to verify how Flow marks selected images. Use All images for now.</p></div></div>
    <details className="selection-guide"><summary>Help enable selected downloads</summary>
      <p className="hint">Use the side panel and keep the same cards visible. Each capture only reads the page; it does not download anything.</p>
      <ol className="capture-steps">{([
        { checkpoint: 'baseline', title: 'Clear the selection', detail: 'Deselect all images in Flow.', button: 'Capture baseline' },
        { checkpoint: 'selected', title: 'Select two images', detail: 'Select two visible images in Flow.', button: 'Capture selected' },
        { checkpoint: 'deselected', title: 'Deselect one image', detail: 'Leave one of those images selected.', button: 'Capture deselected' },
      ] as const).map((step, index) => <li key={step.checkpoint}><span className="step-number">{index + 1}</span><div><strong>{step.title}</strong><p>{step.detail}</p>
        <button disabled={busy} onClick={() => void record(step.checkpoint)}>{step.button}</button>{capture?.snapshots.some(snapshot => snapshot.checkpoint === step.checkpoint) && <span className="captured-label"><Icon name="check" size={12} />Captured</span>}
      </div></li>)}</ol>
      <details className="optional-capture"><summary>Optional: check selections after scrolling</summary><p className="hint">Scroll away from a selected image and back, then capture it again.</p><button disabled={busy} onClick={() => void record('scrolled')}>Capture after scrolling</button></details>
      <p className="hint">{capture?.snapshots.length ?? 0} snapshots captured{capture?.dropped ? ` · ${capture.dropped} older snapshots dropped` : ''}. Capture labels do not verify the selected count.</p>
      <div className="capture-actions"><button disabled={busy || !capture?.snapshots.length} onClick={() => void copy()}><Icon name="report" size={16} />Copy selection JSON</button><button className="text-button" disabled={busy || !capture?.snapshots.length} onClick={() => void clear()}>Clear selection capture</button></div>
    </details>
    {error && <p className="error" role="alert">{error}</p>}
    {notice && <p className="notice" role="status">{notice}</p>}
    {json && <details open><summary>Selection evidence</summary><pre tabIndex={0}>{json}</pre></details>}
  </section>;
}
