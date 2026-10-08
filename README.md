# Flow Bulk Downloader

Manifest V3 Chrome/Edge extension project for Google Flow. **Version 0.2.0 implements Phase 1 inspection and Phase 2 single-image automation from real authenticated DOM evidence. The single-image action still requires live browser validation; bulk processing is not implemented.** There is no simulated progress, mock Flow data, or private API use.

The requested workflow is `image → More → Download → 2K Upscaled → browser download complete`. The supplied 0.1.1 capture now establishes card ancestry, More ownership, Download and 2K menu items, and a manual 2K click. The implementation follows that evidence. Authenticated Flow is unavailable in this cloud browser, so a build or unit-test pass does not establish live download success.

## Current features

- Explicit single-image 2K action for a user-selected, loaded image currently in the viewport.
- A bounded state machine with 5-second menu waits, a 120-second browser-download wait, errors, and cancellation that preserves files.
- Optional Chrome Downloads access requested only by the single-image action; actual browser state, ID, bytes, filename, and timestamps are tracked.
- Explicit, user-initiated inspection restricted to `https://flow.google.com/*`.
- A bounded sample of up to 24 image-element candidates, nearest plausible card containers, visible/hidden More-control relationships, loading flags, identifier hints, and selection attributes.
- Visible semantic More, Download, 2K Upscaled, and Original controls, plus menu/listbox structures.
- Possible scroll regions, without scrolling the page or claiming to discover all assets.
- Mutation, scroll, and image-load observation; debounced scans; 20 rolling snapshots plus pinned baseline/menu captures and bounded manual-interaction evidence; automatic stop after ten minutes.
- React popup and side panel with copyable diagnostic JSON and persistent debug preference.
- Inspector actions remain read only. The separate single-image action invokes existing DOM buttons. No private APIs, direct download requests, credential reads, or telemetry.

The format-v2 capture includes a normalized node graph, parent/ARIA links, detailed image loading state, disabled/busy/selected signals, and scoped manual-interaction snapshots. See [Diagnostic evidence format and review](docs/DIAGNOSTICS.md).

Candidate IDs identify DOM image nodes within one inspector session. They are **not** verified durable Flow asset IDs. Reported structural paths are evidence for inspection, not supported automation selectors. Counts may include decorative images or duplicate thumbnails. Asset and ancestor identifiers can be present in JSON; review them before sharing. Reports and single-image status live in the page's isolated content-script memory and are lost on reload. Only debug preference is saved to `chrome.storage.local`; the active download watch is stored in trusted `chrome.storage.session` for service-worker restarts, then removed at operation end.

## Requirements and development

Use Node.js 24 and npm. Current cloud validation uses Node 24.19.0; dependency versions are pinned in the lockfile.

```sh
cd /workspace/flowext
npm ci --cache /workspace/.npm-cache
npm test
npm run build
```

For local work, use your checkout's directory instead of `/workspace/flowext`, and use plain `npm ci` with your normal writable npm cache.

`npm run dev` watches and rebuilds extension files. It does not run a web server or automatically reload Chrome. Reload the extension in the browser and refresh the Flow page after rebuilding to replace an already-injected inspector. Each cloud task is already isolated; use the existing checkout without creating a Git worktree unless explicitly requested.

The build type-checks TypeScript, creates `dist/`, and verifies MV3 entry files and a standalone content-script bundle. Source maps are not distributed. `npm run test:browser` runs a local Chromium extension smoke test using `/usr/bin/chromium` (override with `CHROMIUM_PATH`). It validates real extension loading and UI rendering on a non-Flow page, not Flow download behavior.

The cloud Chromium smoke test was attempted but blocked by managed `ExtensionInstallBlocklist=["*"]`; no browser pass is claimed. Run it in a development browser that permits unpacked extensions. Do not change managed security policy to make the test pass. Direct user-browser testing is still required for popup/side-panel behavior and authenticated Flow DOM inspection.

## Load the unpacked extension

1. Build using the commands above, or extract the supplied extension ZIP.
2. In Chrome open `chrome://extensions`; in Edge open `edge://extensions`.
3. Enable **Developer mode**.
4. Click **Load unpacked** and select the **dist** folder containing `manifest.json` (or `flow-bulk-downloader/dist` inside the supplied source/build ZIP).
5. Pin **Flow Bulk Downloader** in the browser toolbar.
6. Open `https://flow.google.com/` and your authenticated image project.
7. Click the toolbar icon, then **Start menu capture**.

Minimum Chrome/Edge version is 116 for the side panel API. If Flow redirects to another hostname, inspection refuses to run; record the final hostname so the supported scope can be reviewed. Do not broaden the extension to all websites.

## Phase 2 live single-image test

1. Build or extract the 0.2.0 ZIP. In `chrome://extensions` or `edge://extensions`, reload/load unpacked **dist/**, then refresh the Flow project to replace the old injected script.
2. Make the intended generated image visible, close all Flow menus, and open the extension. Prefer **Open inspector side panel** so status remains visible.
3. Click **Rescan visible images**, then choose one loaded image. Labels follow filtered DOM order, not project asset indexes; use a viewport with one image for the first test. This list is deliberately not complete project discovery.
4. Click **Download selected image as 2K**. Accept Chrome's optional Downloads permission prompt. The extension opens that image's More menu, its Download submenu, and selects 2K. You should not manually click menus during this test.
5. Observe `OPENING MENU → OPENING DOWNLOAD MENU → SELECTING 2K → WAITING FOR DOWNLOAD`. `COMPLETED` is set only from a matching Chrome download whose browser state is `complete`. The UI shows actual ID, filename, received/total bytes, and errors.
6. Open Chrome/Edge Downloads (`Ctrl+J`), verify the file, and confirm its image dimensions correspond to Flow's 2K upscale. Report whether it succeeded, how long processing took, and the displayed error if it failed. Do not share signed URLs or credentials.
7. If it fails or times out, check browser Downloads first, close remaining menus, and rescan before an intentional retry. A timeout does not prove no file was created. No automatic retry or next-image processing occurs in Phase 2.

**Download attribution limits:** Chrome's Downloads API does not expose the initiating tab ID. The monitor accepts only downloads starting in the armed 120-second interval with a Flow source URL (including a Flow blob URL) or exact Flow referrer. Multiple matching downloads fail as ambiguous. A CDN download with no Flow source/referrer remains unmatched and times out; it is not guessed from an arbitrary latest download. Avoid all other Flow downloads during this test: a lone unrelated Flow download in the same interval cannot be distinguished by this API. Attribution and filename/MIME behavior still need real-browser validation.

Cancellation stops further UI actions and tracking, and leaves already-started browser downloads intact. Reload/navigation does not resume or repeat the action; check Downloads before a new attempt. Worker restart can recover its session watch and missed download creation via browser search; closing the captured tab clears the watch. After reload, an orphaned watch can block a new attempt until its 120-second expiry. Declining/revoking Downloads access leaves the inspector usable.

## Phase 1 live inspection procedure

Version **0.1.1** fixes stale popup/side-panel exports and makes starting capture the primary action. Reload the extension and refresh Flow before this procedure; the UI detects older injected scripts. This UI change does not add download automation.

1. Start with one generated image visible and all menus closed. Click **Take DOM snapshot** if you want a baseline preview; opening the extension already attaches to the live page session.
2. Enable debug logging if wanted, then click **Start menu capture** and confirm the status says **Observing DOM changes**. Page DevTools will show `[FLOW-BULK][DISCOVERY]`, `[FLOW-BULK][INSPECTION]`, and errors prefixed `[FLOW-BULK][ERROR]`.
3. Open the image's More menu manually. Wait at least half a second for a snapshot.
4. Open/hover **Download** as required by the actual UI. Wait for **2K Upscaled** to be visible. The inspector does not operate these controls.
5. Inspect both enabled and unavailable/processing states where present. Manually scroll the asset collection to expose more images and capture possible scroll-region changes.
6. Click **Stop and copy JSON** (or **Stop observing**, then **Copy JSON**). Review identifiers, then supply the JSON to development. The inspector records only recognized workflow labels, structural metadata, and allowlisted attributes; it excludes full HTML, project URLs, media URLs, prompts, cookies, and tokens. Arbitrary identifier values are not guaranteed free of sensitive information.
7. Separately perform one manual 2K download and note whether it starts immediately or after processing, expected filename/format, approximate timing, and success/failure UI. Do not share signed download URLs or session credentials.

Keep the popup open while capturing, or use **Open inspector side panel** for a persistent view. Prefer the side panel for this procedure so its **Observing DOM changes** status remains visible. Closing the extension UI does not stop the bounded page observer. Observation stops on page unload or after ten minutes. Reopening the popup or panel attaches to the current session; both views synchronize even when their previous state was idle. Copy fetches live bound-tab state and refuses an unstarted capture. Commands remain attached to the captured tab rather than following an unrelated active tab. **Clear capture history** is unavailable while observing. After observation stops, it resets all pinned/rolling captures to a fresh baseline and requires starting capture again. The export also records observation start/stop/error metadata. Menu and manual-target contexts are collected before image sampling. Manual image context and viewport images are prioritized; viewport geometry is read only to rank diagnostic candidates, never to click coordinates. The format-v2 JSON export retains the baseline and first recognized Download/2K snapshots even when rolling history overflows, and records relevant trusted manual clicks/hover/focus without changing them. See [the evidence handoff](docs/DIAGNOSTICS.md) for bounds, format, and the offline review command.

## Architecture and selectors

```text
src/background/service-worker.ts   Debug preference and download monitor registration
src/background/download-monitor.ts Serialized browser events and session watch
src/background/download-policy.ts  Source/time correlation and sanitized records
src/content/flow-adapter.ts        Evidence-based single-image DOM operations
src/content/single-automation.ts   Bounded one-image state machine
src/popup/SingleImagePanel.tsx      Explicit one-image selection/test UI
src/shared/automation-types.ts     One-image/download message and state models
src/shared/automation-client.ts    Bound-tab single-image command transport
src/content/content.ts            Scoped, idempotent injection and observer/message lifecycle
src/content/selectors.ts          All generic semantic diagnostic probes and bounds
src/content/flow-dom.ts            Name/state/structure evidence and candidate relationships
src/content/evidence-collector.ts  Bounded parent/ARIA context graph
src/content/asset-detector.ts      Image candidates; session-only identities
src/content/inspector.ts           Bounded serializable report
src/shared/types.ts               Typed version-2 diagnostic schema and messages
src/shared/capture-history.ts     Rolling capture history and retained evidence
src/shared/capture.ts             Deduplicated export with snapshot references
src/shared/evidence-review.ts     Offline shape/reference/coverage validation
src/shared/client.ts              Active-tab validation, injection, and messaging
src/popup/App.tsx                  Shared inspector UI
src/sidepanel/main.tsx             Persistent side panel entry
public/manifest.json               MV3 permissions and entry points
scripts/verify-build.mjs           Bundle/manifest/read-only invariants
scripts/review-evidence.mjs        Review user-supplied real JSON without executing it
scripts/browser-smoke.mjs          Real local Chromium extension smoke test
```

The latest real capture establishes image custom-element ancestry, `data-media-id` hints, visible/hidden image-associated More controls, linked menus, Download descendant labels, 2K menu item, and recorded manual interactions. Phase 2 is implemented from that evidence, but a successful live single-image test is still required before bulk work. See [observed DOM findings](docs/OBSERVED-DOM.md). Probes use `img`, semantic buttons/menu items, menus/listboxes, and names such as `More`, `Download`, and `2K Upscaled`. Generic inspector probes collect evidence; the separate `FLOW` selector contract documents the actual observed Phase 2 structure. They inspect only rendered light DOM; virtualized assets, shadow DOM, iframe content, icon-only controls without labels, and localized menu labels may be missed. The accessible-name helper is a diagnostic approximation, not a full accessibility-tree implementation.

Update `src/content/selectors.ts` after obtaining evidence. Verify that a candidate is a generated image rather than a decorative thumbnail, that its More control is associated with that exact asset, and that menu portals contain the expected Download and quality items. Do not scatter selectors through the automation engine or use screen coordinates. Validate the changed diagnostic logic, rebuild, and rerun the live capture. Do not create sample/mock Flow DOM as a substitute for the real capture.

## Permissions

| Permission | Purpose |
| --- | --- |
| `activeTab` | Temporary access to the current tab after the user clicks the extension. No persistent host permission. |
| `scripting` | Injects the exact-host-guarded inspector and explicit single-image action after a user gesture. |
| `storage` | Saves debug preference locally and an active sanitized browser-download watch in trusted session storage. |
| `sidePanel` | Provides a persistent inspection UI beside Flow. |

The optional `downloads` permission is requested only when the user explicitly starts a single-image test; it reads browser download lifecycle events and matching records. Required permissions remain unchanged. There is no `tabs` permission, blanket host permission, clipboard permission, or persistent Flow host permission. Clipboard copy is invoked directly from a user click; JSON remains selectable if the browser denies clipboard access. Download API records are filtered by source and time and sanitized before storage; URLs/referrers are never exported or logged. Chrome keeps normal filenames, save prompts, and duplicate-file behavior; renaming and ZIP export are deferred.

## Remaining phases and required evidence

Phase 2 is intentionally one image per explicit click. A real-browser success must establish correct image ownership, menu transitions, processing delay, download attribution, file completion, and 2K output before implementing a queue. No one-image live success is claimed yet.

Later work: sequential queue with progress/retries/pause/resume, complete lazy-loaded discovery, stable IDs/reacquisition across rerenders, file naming, settings, completion summary, and optional ZIP. These remain unimplemented. No automatic project scrolling or full asset count is claimed.

## Troubleshooting

- **Open a Flow project:** ensure the active tab is exactly `https://flow.google.com/…`, then click the toolbar icon again. A redirect, reload, or tab switch may require a fresh `activeTab` grant.
- **No candidates:** images may not be rendered as `img`, not yet loaded, hidden, or in a shadow root/iframe. Capture a report and inspect the actual DOM; zero candidates does not establish an empty project.
- **No More/Download/2K:** manually open menus; icon-only, localized, or changed names need inspection. A closed menu can correctly yield zero controls.
- **Unexpected count:** candidates are not verified assets. Inspect container relationships, duplicate thumbnails, and virtualization before implementing discovery.
- **Older inspector / stale capture:** reload the extension and refresh Flow; then use **Start menu capture**. The panel must say **Observing DOM changes** before you open image menus. Do not clear history before copying.
- **Scan stale after rebuilding:** reload the extension and Flow tab, then inspect again.
- **Copy denied:** expand **Diagnostic JSON**, select its text, and copy manually.
- **Observation ended:** restart it; observation has a deliberate ten-minute limit.

## Validation status

See `TESTING.md` for commands, actual results, and the outstanding live Flow checklist. Local unit tests use explicitly synthetic DOM fixtures to test diagnostic behavior; they are not production mock assets and do not prove compatibility with Flow. No live Phase 2 success or authenticated browser download completion is claimed. Build/test results validate local code and API/state handling only.
