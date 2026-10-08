// @vitest-environment jsdom
// Actual blank non-Flow document. No Flow cards, DOM, or assets are fabricated.
import { expect, it } from 'vitest';
import { BulkAutomation } from '../src/content/bulk-automation';
import { FlowDOMAdapter } from '../src/content/flow-adapter';
import { inspectSelection, selectionNode } from '../src/content/selection-inspector';
import { bulkCommand } from '../src/shared/automation-client';

it.each([true, false])('rejects selected scope before discovery or any downloads rather than falling back to all: download=%s', download => {
  const bulk = new BulkAutomation(document, new FlowDOMAdapter(document), () => 'https://flow.google.com/project');
  expect(() => bulk.start(download, 2, false, '', 'selected')).toThrow('identify the Flow project asset collection');
  expect(bulk.session().stage).toBe('IDLE'); expect(bulk.session().active).toBe(false);
  expect(bulk.session().assets).toEqual([]); expect(document.body.children).toHaveLength(0);
});
it('refuses selected commands on an unrelated tab', async () => {
  const previous = globalThis.chrome;
  globalThis.chrome = { tabs: { get: async () => ({ url: 'https://example.com/' }) } } as unknown as typeof chrome;
  try { await expect(bulkCommand(12, 'start', 2, false, '', 'selected')).rejects.toThrow('no longer on'); }
  finally { globalThis.chrome = previous; }
});
it('refuses selection inspection on the actual unrelated page and fails clearly without a real collection', () => {
  expect(() => inspectSelection(document, document.URL, 'baseline')).toThrow('restricted');
  expect(() => inspectSelection(document, 'https://flow.google.com/', 'baseline')).toThrow('identify the Flow project asset collection');
});
it('reads only bounded structural metadata from the actual empty document without mutating it', () => {
  const before = document.body.outerHTML;
  const metadata = selectionNode(document.body);
  expect(metadata.tag).toBe('body'); expect(metadata.attributes).toEqual({}); expect(metadata.checked).toBeUndefined();
  expect(document.body.outerHTML).toBe(before); expect(metadata).not.toHaveProperty('textContent');
});
