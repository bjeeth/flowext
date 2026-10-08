# Flow Bulk Downloader

Manifest V3 Chrome/Edge extension that discovers generated images in the current Google Flow project collection and processes them sequentially through **More → Download → 2K Upscaled → browser download complete**. Version **0.5.0** adds **All images / Selected images** scope toggles and targeted multi-selection inspection. **Selected-image downloading is blocked pending real selection DOM evidence.**

Bulk automation is implemented and builds locally. **Authenticated Flow download/discovery behavior has not yet been verified end-to-end.** Local tests and DOM captures do not establish production readiness.

## Features

- Collection discovery on All-images Start or Refresh, scrolling lazy/virtualized content and deduplicating `data-media-id`. Opening the panel does not scroll or disturb a pre-existing selection.
- Separate accessible All images / Selected images toggles. Selected mode currently offers read-only selection capture; its download button is explicitly unavailable.
- One image at a time; reacquire the current card and wait for actual Chrome download completion before advancing.
- Real discovered/completed/failed/skipped counts, current stage, bytes, download ID, and completion summary.
- Pause at a safe boundary, resume, cancel preserving files, capped retries, and Retry Failed.
- Popup/side panel; automation continues inside Flow after closing extension UI.
- Stored debug/retry preferences and optional Downloads access requested by Start/Retry.
- Choose a recent download subfolder or enter a new one; nested folders are created on the first saved file. Flow filenames and extensions are preserved, and duplicates are uniquified.
- Developer DOM inspector retained behind collapsed Developer tools.
- No coordinate clicks, private APIs, credential reads, uploads, fake assets/downloads/progress, or upgrade bypasses.

## Install and use in Chrome/Edge

1. Build from source or extract the **0.5.0 ZIP**.
2. Open `chrome://extensions` or `edge://extensions`, enable **Developer mode**, and choose **Load unpacked**.
3. Select **dist/** containing `manifest.json` (`flow-bulk-downloader/dist` inside the ZIP). When updating, reload the extension and **refresh the Flow page** to replace the old injected script.
4. Open an authenticated image project on exactly `https://flow.google.com/`, click the toolbar icon, and confirm the header says **v0.5.0**.
5. Prefer **Open download side panel** and choose **All images**. To preview the image count, click **Refresh image collection** and wait for READY. Start also discovers the collection automatically if it has not been scanned. Discovery restores the original scroll position.
6. In **Download folder**, choose a recent folder or enter a name such as `Flow Exports/Project 1`. Leave blank for the browser's configured Downloads folder. Click **Download All as 2K** once and accept the native optional Downloads permission prompt on first use. The extension automatically performs every image's menu sequence.
7. Keep this project tab open and avoid interacting with its menus/scroll area or starting other Flow downloads. Closing the panel does not stop the queue.
8. Verify files and 2K dimensions in Downloads (`Ctrl+J`). **Copy bulk result** exports actual counts, item attempts/errors, and sanitized download metadata.

No image chooser or repeated manual menu clicking is required. If initial discovery failed, Start runs discovery and processing together. A READY list is reused for Start; Refresh image collection rescans without downloading. Starting a new export after completion rediscovers the collection and intentionally downloads again. Retry Failed preserves completed images; after a stopped queue, it also processes remaining queued images.

Minimum Chrome/Edge version: 116. Redirects to other hostnames are refused. Browser save-location prompts and multiple-download approval are normal browser behavior and are not bypassed; disable “ask where to save each file” in browser settings for unattended saves.

## Selected images — real evidence needed

The existing captures contain no `aria-selected`, `aria-checked`, `aria-pressed`, or selected-state candidate signals. They were recorded for menus and scrolling, without a multi-selection procedure. No Flow multi-selection selector has been invented. **Selected images is a separate mode, but Download Selected as 2K remains disabled.** The engine also rejects selected-scope starts before discovery/downloads; it never falls back to exporting all images.

To provide the missing evidence, load 0.5.0 and refresh Flow. Use the side panel so the same cards remain visible:

1. Choose **Selected images** in the extension. Finish/cancel any running queue first.
2. Deselect all images **in Flow**, then click **Capture baseline**.
3. Select two visible generated images **in Flow**, then click **Capture selected**.
4. Deselect one of those images **in Flow**, then click **Capture deselected**.
5. Optionally scroll so a selected card unmounts/remounts, then click **Capture after scrolling** to establish virtualization behavior.
6. Click **Copy selection JSON**, review it, and share it for implementation. If clipboard access fails, select the displayed JSON manually.

Each action reads actual image/card/wrapper relationships, CSS classes, generic ARIA state, and native checkbox `checked`/`indeterminate` properties. It does not select images, scroll, open menus, or download. The capture prioritizes viewport cards, is bounded/truncation-aware, retains up to eight snapshots in the page session across panel closure, and resets after project navigation/reload. Classes and media identifiers may be private; image URLs, prompts, form values, cookies, and tokens are not read into the capture. This is a separate `selection-inspection` format; the Phase 1 `inspect:evidence` validator does not consume it.

Real selected/unselected/deselected states and scrolling behavior are required to establish which DOM signals belong to an image and whether offscreen selections can be enumerated reliably. Selected-image processing will use a fixed selected-ID list with the existing sequential engine after that contract is verified. No selected-count or successful selected export is simulated.

## Destination folders

The folder field names a **relative subfolder of your browser's configured Downloads directory**. Use the input's recent-folder suggestions or type an existing/new name. `Flow Exports/Project 1` saves into `Downloads/Flow Exports/Project 1/`. The browser creates missing folders when saving the first file; choosing a name alone does not create an empty folder. The latest choice and up to eight recent names are remembered locally. Use Downloads folder clears the field for the next Start.

Chrome's Downloads API cannot browse arbitrary disk directories or create empty folders before a download. To use another drive or directory, change the browser's default download location in `chrome://settings/downloads` or `edge://settings/downloads`; subfolders then sit under that location. The extension requests no filesystem or additional host permissions.

The worker's `onDeterminingFilename` listener suggests the selected folder only for the armed, source/time-matched Flow download. It preserves the tentative filename/extension and uses `conflictAction: "uniquify"`. Absolute paths, traversal, invalid Windows characters, and reserved device names are rejected. Destination is fixed for the running queue and Retry Failed; edit it before starting a new export. The final browser filename must be inside the chosen folder or the queue stops with a clear error. Browser save prompts or competing filename extensions can override the suggestion. Avoid simultaneous Flow downloads because the Downloads API has no initiating tab identifier.

## Development and build

Use Node.js 24 (validated: 24.19.0) and pinned npm dependencies.

```sh
cd /workspace/flowext
npm ci --cache /workspace/.npm-cache --no-fund
npm test
npm run build
```

Locally, use your checkout directory and plain `npm ci` with a writable cache. Each cloud task is isolated; use the existing checkout without creating a worktree unless explicitly requested. No app server or Flow credentials are needed to build.

`npm run dev` watches build output; reload the extension and Flow page manually. Build includes TypeScript and verifies MV3 entries, self-contained classic `content.js`, unchanged required permissions, optional-only Downloads access, and no persistent host permissions. Source maps are not distributed.

`npm run test:browser` is an optional non-Flow Chromium extension smoke test (`CHROMIUM_PATH` overrides `/usr/bin/chromium`). Cloud managed `ExtensionInstallBlocklist=["*"]` blocks it. Leave managed policy unchanged; no cloud browser success is claimed.

## Discovery

Real captures establish `flow-image-tile img[data-media-id]` and a project scroll element under `flow-project-page` with `cdkvirtualscrollingelement`. Folder/collection thumbnails use `flow-collection-tile` and are excluded.

Discovery starts at the top, scans supported rendered cards, advances by overlapping viewport-sized scroll steps, and waits for lazy mounting. IDs are deduplicated. Completion requires four unchanged bottom scans with unchanged scroll height and ID count. Limits: 120 seconds, 1,000 steps, and 10,000 assets. Limit/scroll failures report incomplete discovery and do not start a partial list as though complete. Original scroll position is restored; pause time does not consume the deadline.

Queue items retain IDs, not long-lived DOM elements. Before each image, reacquisition uses its media ID and scroll-position hint, falling back to a bounded traversal if virtualized/reordered. Only the current operation retains an image element. Ambiguous duplicate visible cards fail safely.

Discovery is an observed-end heuristic, not a server-authoritative total. Loading slower than the stable-bottom window can require a rescan. The supported current collection is scanned; folders are not recursively opened, and filter-hidden assets, unsupported videos/canvases, shadow DOM, iframes, and localized labels are not supported. Newly added assets after discovery require Refresh image collection or a new export. Identifier permanence still requires live validation.

## Automation, queue controls, and errors

The adapter closes existing image menus through the live expanded More button, opens the selected card's More menu, follows its actual `aria-controls` link, finds Download within the owned image context, and requires one newly visible quality submenu. Descendant labels handle the captured icon/text Download button. 2K is clicked only when visible, enabled, and not busy. Menu waits are bounded at 5 seconds; disabled/busy 2K can wait 120 seconds. Browser download waits are 120 seconds; only `state === "complete"` marks completion.

Safe failures retry up to the selected count (default 2 additional attempts), then fail that item and continue. Interrupted downloads can be retried. **Unresolved post-click timeouts, lost tracking, or ambiguous attribution stop the queue with a clear error**: advancing could assign a late download to another image or duplicate a file. Check Downloads before intentional Retry Failed. No success is guessed.

Pause finishes the current image operation and prevents the next image/retry; discovery pauses between steps. Resume continues the queue position. Cancel aborts future work, marks unprocessed items skipped, and preserves files and already-started browser downloads. Reload/navigation/tab closure stop automation; actions are not automatically replayed. Chrome retains save prompts and normal file basenames. Custom basename templates, Original-quality export, and ZIP generation are deferred.

## Download attribution

Chrome Downloads API supplies no initiating tab ID. The worker correlates the armed start-time window with an exact Flow source/referrer, including Flow blob URLs, and permits one active watch across extension tabs. Multiple matching downloads fail as ambiguous. CDN downloads lacking a Flow source/referrer remain unmatched and time out; unrelated latest files are never guessed. A lone unrelated Flow download in the same interval cannot be distinguished, so avoid other Flow downloads during processing.

The worker stores sanitized ID, filename, state, bytes, and times in trusted session storage. Source URLs/referrers are checked transiently, never stored/exported/logged. Worker restart can recover its watch and missed creation via browser search. After page reload an orphaned watch can block a new operation until its 120-second expiry. Queue/history remain in isolated page memory and are lost on reload.

## Architecture

```text
src/content/asset-discovery.ts      Bounded collection scan, ID deduplication, reacquisition
src/content/bulk-automation.ts      Bulk lifecycle, current item, pause/cancel and real status
src/content/sequential-queue.ts     Generic concurrency-one executor with capped retries
src/content/image-download.ts       One-image UI sequence and browser completion wait
src/content/flow-adapter.ts         Flow DOM operations and menu ownership
src/content/selectors.ts            Centralized observed selectors and bounds
src/background/download-monitor.ts Serialized browser events and trusted session watch
src/background/download-policy.ts  Source/time attribution and sanitized records
src/popup/BulkPanel.tsx              Primary bulk controls, progress/settings/results
src/shared/bulk-types.ts             Asset/queue/message contracts
src/shared/automation-client.ts      Bound-tab exact-host transport
src/shared/download-folder.ts        Relative path validation and destination checks
src/content/content.ts              Guarded injection and message lifecycle
src/content/inspector.ts             Read-only developer diagnostics
src/content/selection-inspector.ts   Bounded read-only multi-selection evidence
src/popup/SelectionInspector.tsx     Manual checkpoints and selection JSON export
src/shared/selection-types.ts        Selection evidence and download-scope contracts
src/shared/selection-client.ts       Bound-tab read-only selection transport
public/manifest.json                 MV3 entries and minimal permissions
scripts/verify-build.mjs             Manifest/bundle/security invariants
```

The old single-image engine remains internal development code; the product UI uses the bulk engine. See [diagnostic format](docs/DIAGNOSTICS.md) and [observed DOM findings](docs/OBSERVED-DOM.md).

## Permissions and privacy

| Permission | Purpose |
| --- | --- |
| `activeTab` | Temporary access from the toolbar click; exact HTTPS flow.google.com injection only. |
| `scripting` | Injects page automation/inspector after the user action. |
| `storage` | Debug/retry/folder preferences, recent folder names, and trusted active download-watch state. |
| `sidePanel` | Persistent controls beside the project. |
| Optional `downloads` | Requested on Start/Retry; real lifecycle events, matching record search, and folder filename suggestions. |

No `tabs` permission, persistent/blanket host access, clipboard permission, private API credential access, or external uploads. No cookies/tokens are read or authentication/access/upgrade controls bypassed. Bulk results omit media IDs, URLs, and full local paths; developer DOM captures may contain identifier values. Review them before sharing and never commit real captures.

## Developer inspector and selector maintenance

Finish/cancel bulk processing, expand Developer tools, click Start menu capture, and manually expose a representative More → Download → 2K sequence, leaving menus visible at least half a second. Stop and copy JSON. This diagnostic procedure is needed only for changed/missing UI behavior; the observer stops after ten minutes.

```sh
npm run inspect:evidence -- /path/to/real-flow-capture.json
```

The offline validator reads untrusted JSON without executing selectors/HTML or echoing identifiers. Valid format does not establish actual download success. Do not share signed URLs, tokens, prompts, or image data.

Update `FLOW`, `PROBES`, and bounds in `src/content/selectors.ts` only from real evidence. Keep raw selectors out of queue code. Build/test and rerun an actual Flow project; do not invent Angular classes, coordinates, APIs, or fake Flow DOM.

## Troubleshooting

- **Old inspector/chooser or missing scope controls:** load 0.5.0 dist, reload extension, refresh Flow, and confirm the header version. Older bulk scripts must also be refreshed.
- **Selected download unavailable:** provide the multi-selection capture above. The earlier menu/scroll JSON does not establish selection semantics.
- **File outside chosen folder:** check browser save-location prompts and other extensions that rename downloads. The queue stops instead of claiming that folder export succeeded. Check the actual file before retrying.
- **Collection not found/ambiguous:** open an image project on exact Flow and capture scroll ancestry; do not guess a body/window scroller.
- **Discovery limit/timeout:** list is incomplete; inspect mounting/lazy loading and refresh. No partial list is claimed complete.
- **Menu/quality failure:** Copy bulk result shows image index, actual stage, attempts, and reason; capture the changed DOM if needed.
- **Attribution uncertainty:** check Downloads/processing state before Retry Failed; avoid simultaneous Flow downloads.
- **Pause requested:** current operation finishes or reaches its timeout before PAUSED; Resume preserves completed work.
- **Reload/navigation:** automation stopped; check saved files before intentionally starting again.
- **Clipboard denied:** select the Bulk result JSON and copy manually.

## Validation status

TypeScript, production build, dependency installation, and **99 local tests** pass. Tests verify queue/API/extension-UI transport behavior, scope isolation/refusal, read-only selection transport, folder validation/routing, and final-path checks, not live Flow selection semantics, virtualization, actual 2K files, folder creation on disk, or unattended saves. Authenticated Chrome/Edge acceptance for 1, 5, 10, and 50+ images remains required. See [TESTING.md](TESTING.md). No production-readiness claim is made.
