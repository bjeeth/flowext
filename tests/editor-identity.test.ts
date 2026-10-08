// @vitest-environment jsdom
// Identity boundary tests with generic elements; no simulated Flow downloads.
import { expect, it, vi } from 'vitest';
vi.mock('../src/content/flow-dom', async original => ({ ...await original<typeof import('../src/content/flow-dom')>(), isVisible: () => true }));
import { FlowDOMAdapter } from '../src/content/flow-adapter';
it.each([
  ['https://flow-content.google/image/expected', true],
  ['https://flow-content.google/image/other', false],
  ['https://example.com/image/expected', false],
  ['http://flow-content.google/image/expected', false],
])('requires exact editor media identity: %s', (src, accepted) => {
  const adapter = new FlowDOMAdapter(document);
  const root = document.createElement('section');
  const image = document.createElement('img'); image.className = 'read-only-image'; image.src = String(src); root.append(image);
  const boundary = adapter as unknown as { editorMediaId: string; editor: () => HTMLElement };
  boundary.editorMediaId = 'expected'; vi.spyOn(boundary, 'editor').mockReturnValue(root);
  try {
    if (accepted) expect(() => adapter.assertEditorImage()).not.toThrow();
    else expect(() => adapter.assertEditorImage()).toThrow('does not match');
  } finally { vi.restoreAllMocks(); }
});
