/** Generic diagnostic probes. NONE are verified Google Flow selectors. */
export const PROBES = {
  images: 'img', videos: 'video', canvases: 'canvas',
  media: 'img, video, canvas',
  controls: 'button, [role="button"], [role="menuitem"], [role="menuitemradio"], [role="option"], [role="link"], a',
  menus: '[role="menu"], [role="listbox"]',
  containers: 'article, li, [role="listitem"], [role="group"], [data-asset-id], [data-image-id]',
  identifierAttributes: ['id', 'data-testid', 'data-asset-id', 'data-image-id'],
  safeAttributes: ['aria-controls', 'aria-owns', 'aria-labelledby', 'aria-describedby', 'aria-busy', 'inert', 'hidden', 'disabled', 'loading', 'decoding', 'id', 'role', 'data-testid', 'data-asset-id', 'data-image-id', 'aria-haspopup', 'aria-expanded', 'aria-disabled', 'aria-selected', 'aria-pressed', 'data-state', 'type'],
  selectedAttributes: ['aria-selected', 'aria-pressed', 'data-state'],
  // Generic read-only probes. These are not an established Flow multi-selection contract.
  selectionControls: 'input[type="checkbox"], input[type="radio"], [role="checkbox"], [role="radio"], [role="option"], [aria-selected], [aria-checked], [aria-pressed], [data-selected]',
  selectionAttributes: ['id', 'role', 'aria-selected', 'aria-checked', 'aria-pressed', 'aria-disabled', 'aria-busy', 'data-state', 'data-selected', 'type'],
  maxSelectionCards: 200,
  maxSelectionDescendants: 80,
  maxSelectionControls: 100,
  maxSelectionNodes: 1200,
  names: {
    more: /^(?:more(?: options| actions)?|more_horiz|more_vert|⋮|…|\.\.\.)$/i,
    download: /^download(?: image)?$/i,
    '2k': /^2k\s*upscaled$/i,
    original: /^original(?: size)?$/i,
  },
  referenceAttributes: ['aria-controls', 'aria-owns', 'aria-labelledby', 'aria-describedby'],
  identifierName: /^data-(?:(?:asset|image|media|item|generation|resource|card)[-_])?(?:id|key|uuid)$/i,
  maxCandidates: 24,
  maxContextControls: 30,
  maxMenuControls: 50,
  maxMenus: 20,
  maxNodes: 1200,
  maxReferences: 8,
  maxAttributeLength: 160,
  maxPathDepth: 8,
  maxLabelChildren: 40,
  maxControls: 100,
  maxScrollRegions: 15,
  maxAncestorDepth: 7,
} as const;

/** Phase 2 contract derived solely from the supplied real 0.1.1 capture.
 * No generated Angular classes, nth-of-type paths, or captured menu IDs are hardcoded.
 */
export const FLOW = {
  image: 'flow-image-tile img[data-media-id]',
  tile: 'flow-image-tile',
  more: 'flow-image-hotbar button[aria-label="More options"][aria-haspopup="menu"]',
  menu: '[role="menu"]',
  item: 'button[role="menuitem"]',
  downloadContext: 'flow-image-context-menu-items',
  collection: 'flow-project-page [cdkvirtualscrollingelement]',
} as const;

export const TIMEOUTS = { menu: 5000, download: 120000, poll: 500 } as const;
export const DISCOVERY = { timeout: 120000, settle: 700, bottomWait: 1200, stableRounds: 4, maxSteps: 1000, maxAssets: 10000, retries: 2 } as const;
