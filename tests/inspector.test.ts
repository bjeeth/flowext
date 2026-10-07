// @vitest-environment jsdom
// Synthetic DOM fixtures test diagnostic logic only; they do not validate Flow's UI.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { inspectFlow } from '../src/content/inspector';
import { accessibleName, isFlowPage } from '../src/content/flow-dom';
import { detectCandidates } from '../src/content/asset-detector';

beforeEach(() => {
  document.body.innerHTML = '';
  // jsdom has no layout engine. Simulate layout for visibility-only unit checks.
  vi.spyOn(Element.prototype, 'getClientRects').mockReturnValue([{ width: 30, height: 30 }] as unknown as DOMRectList);
});
afterEach(() => vi.restoreAllMocks());

describe('Flow scope', () => {
  it('accepts only HTTPS on the exact requested host', () => {
    expect(isFlowPage('https://flow.google.com/project/example')).toBe(true);
    for (const url of ['http://flow.google.com/', 'https://flow.google.com.evil.test/', 'https://labs.google/fx/tools/flow', 'not-a-url']) expect(isFlowPage(url)).toBe(false);
  });
  it('does not inspect unrelated pages', () => {
    document.body.innerHTML = '<button>Download</button><img src="https://example.test/private.png">';
    const report = inspectFlow(document, 'https://example.test/private?token=sensitive');
    expect(report.state).toBe('NO_FLOW');
    expect(report.controls).toEqual([]);
    expect(report.page).toEqual({ origin: 'https://example.test', isFlow: false });
  });
});

describe('read-only diagnostic evidence', () => {
  it('associates single-image containers with semantic More controls', () => {
    document.body.innerHTML = '<article data-asset-id="fixture-a" aria-selected="true"><img><button aria-label="More options"></button></article>';
    const [asset] = detectCandidates(document);
    expect(asset.confidence).toBe('candidate-only');
    expect(asset.container.tag).toBe('article');
    expect(asset.identifierHints['data-asset-id']).toBe('fixture-a');
    expect(asset.selectedSignals['aria-selected']).toBe('true');
    expect(asset.moreControls[0].kind).toBe('more');
    expect(detectCandidates(document)[0].candidateId).toBe(asset.candidateId);
  });
  it('captures visible menu state and disabled 2K separately', () => {
    document.body.innerHTML = '<div role="menu"><button role="menuitem">Download</button><button role="menuitem" aria-disabled="true">2K Upscaled</button><button>Original</button></div><div hidden><button>Download</button></div>';
    const report = inspectFlow(document, 'https://flow.google.com/');
    expect(report.menus).toHaveLength(1);
    expect(report.controls.map(c => c.kind)).toEqual(['download', '2k', 'original']);
    expect(report.controls[1].disabled).toBe(true);
    expect(report.state).toBe('NO_CANDIDATES');
  });
  it('supports referenced labels and normalized whitespace', () => {
    document.body.innerHTML = '<span id="label">  2K \n Upscaled  </span><button aria-labelledby="label"></button>';
    expect(accessibleName(document.querySelector('button')!)).toBe('2K Upscaled');
  });
  it('does not click or capture prompts, media URLs, or arbitrary labels', () => {
    document.body.innerHTML = '<article><img alt="private prompt" src="https://example.test/image?token=private"><button>Download</button><button aria-label="Delete private prompt"></button><p>private prompt</p></article>';
    const onClick = vi.fn();
    document.querySelector('button')!.addEventListener('click', onClick);
    const json = JSON.stringify(inspectFlow(document, 'https://flow.google.com/project?token=secret'));
    expect(onClick).not.toHaveBeenCalled();
    for (const text of ['private prompt', 'example.test', 'token=', 'secret']) expect(json).not.toContain(text);
  });
  it('does not associate shared collection controls with individual images', () => {
    document.body.innerHTML = '<section><img><img><button aria-label="More"></button></section>';
    const candidates = detectCandidates(document);
    // A fallback parent may be the collection, but must not be treated as a card with More actions.
    expect(candidates).toHaveLength(2);
    expect(candidates.every(c => c.confidence === 'candidate-only')).toBe(true);
    expect(candidates.every(c => c.moreControls.length === 0)).toBe(true);
  });
  it('reports bounded captures explicitly', () => {
    document.body.innerHTML = '<img>'.repeat(151);
    const report = inspectFlow(document, 'https://flow.google.com/');
    expect(report.candidates).toHaveLength(150);
    expect(report.totals.imageElements).toBe(151);
    expect(report.truncated).toBe(true);
  });
  it('excludes image nodes in hidden containers', () => {
    document.body.innerHTML = '<div style="display:none"><img></div><img>';
    expect(detectCandidates(document)).toHaveLength(1);
  });
});
