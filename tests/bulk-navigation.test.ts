// @vitest-environment jsdom
// Actual blank NON-Flow document; no Flow DOM, cards, or assets are constructed.
import { expect, it } from 'vitest';
import { BulkAutomation } from '../src/content/bulk-automation';
import { FlowDOMAdapter } from '../src/content/flow-adapter';
it('blocks retrying old project metadata after a project navigation', async () => {
  let url = 'https://flow.google.com/project-a';
  const bulk = new BulkAutomation(document, new FlowDOMAdapter(document), () => url);
  bulk.start(false, 2, false); // Real blank document has no collection and discovery fails.
  for (let i = 0; i < 8; i++) await Promise.resolve();
  expect(bulk.session().active).toBe(false);
  url = 'https://flow.google.com/project-b';
  expect(() => bulk.retry()).toThrow('Refresh the image collection before retrying');
  expect(document.querySelector('flow-image-tile')).toBeNull();
});
