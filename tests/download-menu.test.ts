// @vitest-environment jsdom
// Adapter boundary test with generic elements; no reconstructed Flow page or downloads.
import { expect, it, vi } from 'vitest';
vi.mock('../src/content/flow-dom', async importOriginal => ({
  ...await importOriginal<typeof import('../src/content/flow-dom')>(), isVisible: () => true,
}));
import { FlowDOMAdapter } from '../src/content/flow-adapter';
it.each(['valid', 'ambiguous', 'wrong-link'] as const)('validates a newly opened menu without aria-haspopup: %s', async outcome => {
  const menu = document.createElement('section'); document.body.append(menu);
  const download = document.createElement('button');
  const qualityMenu = document.createElement('section'); qualityMenu.id = 'quality';
  if (outcome === 'wrong-link') download.setAttribute('aria-controls', 'other');
  const adapter = new FlowDOMAdapter(document);
  const boundary = adapter as unknown as {
    uniqueItem: () => HTMLElement; enabled: () => void;
    visibleMenus: () => HTMLElement[]; findItem: () => HTMLElement;
  };
  vi.spyOn(boundary, 'uniqueItem').mockReturnValue(download);
  vi.spyOn(boundary, 'enabled').mockImplementation(() => {});
  vi.spyOn(boundary, 'findItem').mockReturnValue(download);
  vi.spyOn(boundary, 'visibleMenus').mockReturnValueOnce([menu])
    .mockReturnValue(outcome === 'ambiguous' ? [menu, qualityMenu, document.createElement('section')] : [menu, qualityMenu]);
  const click = vi.spyOn(download, 'click');
  try {
    const result = adapter.openDownloadMenu(menu, new AbortController().signal, '1k');
    if (outcome === 'valid') expect(await result).toBe(qualityMenu);
    else await expect(result).rejects.toThrow(outcome === 'ambiguous' ? 'Multiple submenus' : 'ARIA relationship');
    expect(click).toHaveBeenCalledOnce();
  } finally { menu.remove(); vi.restoreAllMocks(); }
});
