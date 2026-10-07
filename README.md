# Flow Bulk Downloader

Manifest V3 Chrome/Edge extension project for Google Flow. **This build implements Phase 1: the read-only DOM inspector. Download automation is not implemented or validated yet.** It deliberately has no download button, simulated progress, production mock assets, or download permission.

The requested workflow is a sequential `image → More → Download → 2K Upscaled → browser download complete` queue. The project started from an empty repository. No authenticated Flow browser or screenshot was available during implementation, and the cloud environment blocked a public Flow request. It would be misleading to implement guessed Flow-specific selectors or claim the requested bulk downloader works.

## Current features

- Explicit, user-initiated inspection restricted to `https://flow.google.com/*`.
- Image-element candidates, nearest plausible card containers, More-control relationships, loading flags, identifier hints, and selection attributes.
- Visible semantic More, Download, 2K Upscaled, and Original controls, plus menu/listbox structures.
- Possible scroll regions, without scrolling the page or claiming to discover all assets.
- Mutation, scroll, and image-load observation; debounced scans; at most 20 snapshots; automatic stop after ten minutes.
- React popup and side panel with copyable diagnostic JSON and persistent debug preference.
- No page writes, click automation, downloads, external requests, credential reads, or telemetry.

Candidate IDs identify DOM image nodes within one inspector session. They are **not** verified durable Flow asset IDs. Reported structural paths are evidence for inspection, not supported automation selectors. Counts may include decorative images or duplicate thumbnails. Asset identifiers can be present in JSON; review them before sharing. Reports live in the page's isolated content-script memory and are lost on reload; only the debug preference is saved to `chrome.storage.local`.

## Requirements and development

Use Node.js 24 and npm. Current cloud validation uses Node 24.19.0; dependency versions are pinned in the lockfile.

```sh
cd /workspace/flowext
npm ci
npm test
npm run build
```

For local work, use your checkout's directory instead of `/workspace/flowext`.

`npm run dev` watches and rebuilds extension files. It does not run a web server or automatically reload Chrome. Reload the extension in the browser and refresh the Flow page after rebuilding to replace an already-injected inspector. Each cloud task is already isolated; use the existing checkout without creating a Git worktree unless explicitly requested.

The build type-checks TypeScript, creates `dist/`, and verifies MV3 entry files and a standalone content-script bundle. Source maps are not distributed. `npm run test:browser` runs a local Chromium extension smoke test using `/usr/bin/chromium` (override with `CHROMIUM_PATH`). It validates real extension loading and UI rendering on a non-Flow page, not Flow download behavior.

The cloud Chromium smoke test was attempted but blocked by managed `ExtensionInstallBlocklist=["*"]`; no browser pass is claimed. Run it in a development browser that permits unpacked extensions. Do not change managed security policy to make the test pass. Direct user-browser testing is still required for popup/side-panel behavior and authenticated Flow DOM inspection.

## Load the unpacked extension

1. Build using the commands above, or extract the supplied inspector build ZIP.
2. In Chrome open `chrome://extensions`; in Edge open `edge://extensions`.
3. Enable **Developer mode**.
4. Click **Load unpacked** and select the **dist** folder containing `manifest.json` (or the extracted ZIP's root folder).
5. Pin **Flow Bulk Downloader — Inspector** in the browser toolbar.
6. Open `https://flow.google.com/` and your authenticated image project.
7. Click the toolbar icon, then **Inspect current DOM**.

Minimum Chrome/Edge version is 116 for the side panel API. If Flow redirects to another hostname, inspection refuses to run; record the final hostname so the supported scope can be reviewed. Do not broaden the extension to all websites.

## Phase 1 live inspection procedure

1. Start with one generated image visible and all menus closed. Click **Inspect current DOM**.
2. Enable debug logging if wanted, then click **Observe menu changes**. Page DevTools will show `[FLOW-BULK][DISCOVERY]`, `[FLOW-BULK][INSPECTION]`, and errors prefixed `[FLOW-BULK][ERROR]`.
3. Open the image's More menu manually. Wait at least half a second for a snapshot.
4. Open/hover **Download** as required by the actual UI. Wait for **2K Upscaled** to be visible. The inspector does not operate these controls.
5. Inspect both enabled and unavailable/processing states where present. Manually scroll the asset collection to expose more images and capture possible scroll-region changes.
6. Stop observing and click **Copy JSON**. Review identifiers, then supply the JSON to development. The inspector records only recognized workflow labels, structural metadata, and allowlisted attributes; it excludes full HTML, project URLs, media URLs, prompts, cookies, and tokens. Arbitrary identifier values are not guaranteed free of sensitive information.
7. Separately perform one manual 2K download and note whether it starts immediately or after processing, expected filename/format, approximate timing, and success/failure UI. Do not share signed download URLs or session credentials.

Keep the popup open while capturing, or use **Open inspector side panel** for a persistent view. Closing the extension UI does not stop the bounded page observer. Observation stops on page unload or after ten minutes. Reopen and scan to read the current session. **Clear capture history** stops observing and retains only a fresh snapshot.

## Architecture and selectors

```text
src/background/service-worker.ts   Debug preference initialization
src/content/content.ts            Scoped, idempotent injection and observer/message lifecycle
src/content/selectors.ts          All generic semantic diagnostic probes and bounds
src/content/flow-dom.ts            Name/visibility/structure evidence and candidate relationships
src/content/asset-detector.ts      Image candidates; session-only identities
src/content/inspector.ts           Bounded serializable report
src/shared/types.ts               Typed diagnostic schema and messages
src/shared/client.ts              Active-tab validation, injection, and messaging
src/popup/App.tsx                  Shared inspector UI
src/sidepanel/main.tsx             Persistent side panel entry
public/manifest.json               MV3 permissions and entry points
scripts/verify-build.mjs           Bundle/manifest validation
scripts/browser-smoke.mjs          Real local Chromium extension smoke test
```

No Flow-specific DOM elements have been discovered in an authenticated browser yet. Probes use `img`, semantic buttons/menu items, menus/listboxes, and names such as `More`, `Download`, and `2K Upscaled`. These are **hypotheses to collect evidence**, not declarations about Flow's DOM. They inspect only rendered light DOM; virtualized assets, shadow DOM, iframe content, icon-only controls without labels, and localized menu labels may be missed. The accessible-name helper is a diagnostic approximation, not a full accessibility-tree implementation.

Update `src/content/selectors.ts` after obtaining evidence. Verify that a candidate is a generated image rather than a decorative thumbnail, that its More control is associated with that exact asset, and that menu portals contain the expected Download and quality items. Do not scatter selectors through the automation engine or use screen coordinates. Unit-test the changed diagnostic logic, rebuild, and rerun the live capture.

## Permissions

| Permission | Why Phase 1 needs it |
| --- | --- |
| `activeTab` | Temporary access to the current tab after the user clicks the extension. No persistent host permission. |
| `scripting` | Injects the read-only, exact-host-guarded inspector after a user gesture. |
| `storage` | Saves only the debug preference locally. |
| `sidePanel` | Provides a persistent inspection UI beside Flow. |

There is no `tabs` permission, blanket host permission, `downloads`, clipboard permission, or network permission. Clipboard copy is invoked directly from a user click; JSON remains selectable if the browser denies clipboard access. A verified downloader will need `downloads` for lifecycle and completion events; adding it should accompany real implementation and validation.

## Remaining phases and required evidence

Before Phase 2, inspect actual card identifiers, menu structure and interaction semantics, selected state, lazy-loading/virtualization, quality availability, and a real browser download. A single verified image download must succeed before the multi-image queue is built.

Later work: `FlowDOMAdapter`, download-event correlation (including unrelated downloads and redirects), sequential state machine with timeouts/retries, pause at an operation boundary, cancellation preserving existing files, complete lazy-loaded discovery with stable IDs and reacquisition, naming with Chrome `uniquify`, persisted settings, individual failure details, and completion summary. ZIP export is deferred until core downloads work. None of these are present in this Phase 1 build.

## Troubleshooting

- **Open a Flow project:** ensure the active tab is exactly `https://flow.google.com/…`, then click the toolbar icon again. A redirect, reload, or tab switch may require a fresh `activeTab` grant.
- **No candidates:** images may not be rendered as `img`, not yet loaded, hidden, or in a shadow root/iframe. Capture a report and inspect the actual DOM; zero candidates does not establish an empty project.
- **No More/Download/2K:** manually open menus; icon-only, localized, or changed names need inspection. A closed menu can correctly yield zero controls.
- **Unexpected count:** candidates are not verified assets. Inspect container relationships, duplicate thumbnails, and virtualization before implementing discovery.
- **Scan stale after rebuilding:** reload the extension and Flow tab, then inspect again.
- **Copy denied:** expand **Diagnostic JSON**, select its text, and copy manually.
- **Observation ended:** restart it; observation has a deliberate ten-minute limit.

## Validation status

See `TESTING.md` for commands, actual results, and the outstanding live Flow checklist. Local unit tests use explicitly synthetic DOM fixtures to test diagnostic behavior; they are not production mock assets and do not prove compatibility with Flow. No live Flow automation or download completion is claimed.
