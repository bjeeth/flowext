# Findings from the supplied real Phase 1 capture

The supplied format-v2 JSON passes the offline shape/reference review. It contains baseline/scan evidence with no recorded manual interactions, no role-based menus, no Download control, and no 2K Upscaled control. It is insufficient to implement Phase 2. The original capture does not contain observer-start metadata, so it does not establish whether observation was started or why menu changes were not captured.

The raw capture is kept outside the checkout and is not committed. Findings below omit private identifier values.

## Observed structures

- Image elements include a `data-media-id` attribute.
- Image ancestors include `flow-image-tile`, `flow-tile-container`, and `flow-grid-tile-container` custom elements.
- Image card contexts include `button` elements labeled `More options`, with `aria-haspopup="menu"`, `aria-expanded="false"`, and recognized `more_vert` icon text.
- Those image-associated More controls have `state.visible=false` in the supplied snapshots. Disabled signals were false. Hidden is different from disabled.
- A visible `More options` control also exists under a `flow-more-options-menu` component in the header. A global More-button query would therefore be ambiguous and could target the wrong menu.
- `data-media-id` values are identifier hints; two baseline/scan snapshots do not prove stability across card rerenders, selection changes, or virtualization.

These are facts from the supplied diagnostic structure, not a complete selector/action contract. No observed structure establishes how Download is opened, how the 2K item is represented, or when a browser download completes.

## Inspector correction

The old coverage report counted only visible More controls, missing the hidden More controls already present in card context evidence. The review now separates associated, visible-associated, and hidden-associated More evidence.

The original broad image sample exhausted the context budget in one scan. The inspector now prioritizes manual targets, focused controls, and menu context before image candidates, and samples at most 24 images with the user's manual image context and viewport images first. It does not scroll, select a card, click a button, or claim full discovery.

Exported optional observation metadata records active/start/stop/error state; old format-v2 captures still validate. The UI warns when manual interactions or a visible 2K snapshot are missing. Explicit sampling-limit messages are distinguished from other context truncation warnings.

## Required recapture

Reload the updated extension and refresh Flow. Follow README's live procedure, preferably with the side panel open so its status remains visible. Click **Observe menu changes** and confirm **Observing DOM changes** before hovering the image and opening its More → Download menu. Leave 2K Upscaled visible for at least half a second. Stop observing, copy the JSON, and review identifiers before supplying it.

Include the separate manual download note from README step 7. If menu evidence remains missing, inspect the new observer/error metadata and improve capture further; do not infer absent menu selectors from this baseline.
