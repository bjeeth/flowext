/** Generic diagnostic probes. NONE are verified Google Flow selectors. */
export const PROBES = {
  images: 'img', videos: 'video', canvases: 'canvas',
  media: 'img, video, canvas',
  controls: 'button, [role="button"], [role="menuitem"], [role="menuitemradio"], [role="option"], [role="link"], a',
  menus: '[role="menu"], [role="listbox"]',
  containers: 'article, li, [role="listitem"], [role="group"], [data-asset-id], [data-image-id]',
  identifierAttributes: ['id', 'data-testid', 'data-asset-id', 'data-image-id'],
  safeAttributes: ['id', 'role', 'data-testid', 'data-asset-id', 'data-image-id', 'aria-haspopup', 'aria-expanded', 'aria-disabled', 'aria-selected', 'aria-pressed', 'data-state', 'type'],
  selectedAttributes: ['aria-selected', 'aria-pressed', 'data-state'],
  names: {
    more: /^(?:more(?: options| actions)?|more_horiz|more_vert|⋮|…|\.\.\.)$/i,
    download: /^download(?: image)?$/i,
    '2k': /^2k\s+upscaled$/i,
    original: /^original(?: size)?$/i,
  },
  maxCandidates: 150,
  maxControls: 100,
  maxScrollRegions: 15,
  maxAncestorDepth: 7,
} as const;
