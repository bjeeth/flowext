# Findings from the supplied real Flow captures

The two latest uploads are byte-for-byte identical: one 12,222,591-byte format-v2 export from inspector 0.1.1, capture protocol 1. Its SHA-256 is `b4fcfd9c8fd18fa01ab804e4e41aeaac45ce4de5abbe7c7d45d16d7b6d62ca9e`. It contains 22 retained snapshots, a completed roughly 30-second observation session, no observer errors, 22 dropped rolling snapshots, and recorded hover/focus/click evidence. Raw captures remain outside Git; private asset values are omitted here.

Unlike the earlier idle captures, this establishes the actual menu structure needed to implement a Phase 2 test. A real automated download has not yet been tested.

## Evidence and selector contract

| Operation | Actual evidence | Phase 2 behavior |
| --- | --- | --- |
| Identify rendered image | `img[data-media-id]` under `flow-image-tile`; ancestors also include `flow-tile-container` and `flow-grid-tile-container` | List only visible viewport images with exactly one image and one matching More button per tile. |
| More control | `flow-image-hotbar` → `flow-hotbar-container` → `button`, `aria-label="More options"`, `aria-haspopup="menu"` | Resolve within the selected image tile, never from a global More query. |
| Image menu ownership | Expanded More has `aria-controls` resolving to the visible `div[role="menu"]`; menu IDs are generated | Read the live ARIA relationship, never hardcode the captured ID. |
| Image menu contents | `flow-image-context-menu-items` → `flow-media-context-menu-items` → `flow-menu-item` → `button[role="menuitem"]` | Verify image context within the linked menu. |
| Download | Menu-item button with `aria-haspopup="menu"`; leaf spans contain icon text `download` and label `Download`; full diagnostic name was null | Match the unambiguous known descendant labels inside that owned menu. |
| Quality submenu | A second visible `div[role="menu"]` appears after Download hover/click; no Download ARIA-controls link was captured | Require exactly one newly visible menu while the owned parent remains visible. Check a live ARIA link if one appears. |
| 2K choice | `flow-menu-item` → `button[role="menuitem"]`, name `2K Upscaled`, enabled/not busy | Click the unique visible enabled 2K item in that submenu. |
| Manual action | Retained snapshots include Download click and 2K hover/focus/click; menus then disappear | Implement normal existing DOM button clicks and validate their result in the real browser. |

The relevant quality checkpoint is `snapshot-30`; Download click appears in `snapshot-32`; the 2K click appears in `snapshot-42`; menus are absent by `snapshot-44`. The same image/More DOM identities and media identifier persist across baseline, quality, and final retained scans. This proves short-session consistency only, not durability across reload, rerender, or virtualization.

The hotbar More control is hidden in baseline/final snapshots but visible with its menu open. Phase 2 invokes that existing rendered enabled button without changing CSS or simulating coordinates/hover. Whether Flow accepts an untrusted programmatic button click must be checked in the user browser. If it does not, obtain further real interaction evidence rather than inventing pointer sequences.

The inspector's original control-name matcher and offline coverage missed Download despite its presence in the graph, because icon-plus-label text was not an exact whole name. Both now accept a single unambiguous known kind from captured descendant labels. All Download/2K evidence coverage flags are observed after this correction. Older captures still review normally.

## Limits and required live validation

- Sampling is truncated at 24 candidates; it does not imply missing menu nodes or a complete asset count.
- No selected/active-image contract, full collection scroll container, virtualized discovery strategy, or durable identifier was established.
- The supplied capture records an enabled 2K item; unavailable/processing variants still need real capture.
- Screenshot labels on separate lines supplement the visual reference, but are not the source of DOM selectors.
- Menu portal ownership beyond the More ARIA link remains based on the observed single-submenu transition. Multiple new menus fail closed; no global 2K fallback is used.
- DOM menu disappearance is not download completion. Phase 2 waits for actual Chrome download metadata and requires a live success for acceptance.
- Chrome Downloads API has no initiating tab ID. Source/referrer plus start-time attribution is conservative but cannot distinguish a lone unrelated Flow download in the same interval. Avoid other Flow downloads; validate the actual record/file in the browser.

Follow the current README bulk workflow. Verify the first actual file, 2K dimensions, processing timing, and any error. Version 0.3.0 bulk implementation is described below; live success remains unverified.

## Version 0.3.0 collection evidence and bulk implementation

The latest supplied 0.2.1 format-v2 capture has four snapshots with an active observer, no manual menu interaction, and changing image-element totals (133, 62, 148, 148). It is not download-success evidence. Earlier real 0.1.1 menu evidence remains the menu contract source.

The scroll report identifies a div with cdkvirtualscrollingelement, 29,989px scroll height and 906px viewport height under flow-project-page. The centralized collection selector is flow-project-page [cdkvirtualscrollingelement], checked for unique live ancestry. It is not a guessed body/window scroller. The capture also shows flow-collection-tile thumbnails without media IDs; these are excluded by the observed image-tile/media-ID contract.

At the user's request, 0.3.0 implements automatic collection discovery and bulk processing. The missing prior single-image browser success is not represented as a pass. The queue executes real DOM actions and requires browser completion between images. Authenticated discovery/download acceptance remains pending. Stable-bottom discovery is a heuristic, IDs must be reacquired, and folders are not recursively opened; see README limitations.
