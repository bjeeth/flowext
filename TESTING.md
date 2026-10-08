# Validation and live acceptance checklist

Current 0.5.1 results: dependency installation, TypeScript/production build, and 102 local tests passed. The actual built UI also passed Chromium layout checks with empty API transport metadata at 320/400px popup and 540px side-panel widths. Real captures establish the card/menu and project scroll contracts. No authenticated single-image, bulk, selected-image, or folder-creation success is claimed. Selected downloads remain blocked without actual multi-selection evidence. Managed Chromium ExtensionInstallBlocklist=["*"] still blocks optional extension-install smoke testing; policy is unchanged.

## Local checks

Run `npm ci`, `npm test`, `npm run build`, and `npm run test:browser` from the project root. Build output checks verify MV3 entries and that `content.js` has no module imports/exports, since it is injected as a classic isolated content script.

Automated tests cover exact HTTPS host scoping; exclusion of unrelated pages; candidate/control relationships; visible/hidden menu controls; disabled quality options; referenced labels; candidate bounds; hidden images; and exclusion of media URLs/prompt text. New tests cover invalid/legacy JSON, missing snapshot references, inert untrusted input, oversized captures, no identifier echo in errors, metadata-only capture deduplication, and baseline retention. No new fake/mock Flow DOM or assets were added; new capture tests use the untouched test document on its actual non-Flow origin. The supplied real authenticated Flow capture passed the offline validator. The latest 0.1.1 capture establishes associated visible/hidden More, linked menus, Download descendant labels, 2K item, and manual interactions. Phase 2 is implemented but live success is unverified. A new pure metadata ordering test checks diagnostic sampling priority without constructing Flow DOM or assets. Browser smoke uses actual Chromium and the actual built extension. Its test page is `about:blank`, so its result concerns extension loading and refusal to inspect unrelated pages only.

## Phase 1 live Flow — supplied evidence, remaining checks

- [x] Inspector loaded in the user browser sufficiently to produce the supplied real capture.
- [x] Capture image container ancestry and media identifier hints.
- [ ] Confirm candidates exclude unrelated icons and associate the correct More button.
- [x] Capture More, Download, and 2K menu structure and review parent/ARIA links; submenu link limitations are documented.
- [x] Supply format-v2 JSON; run `npm run inspect:evidence -- /path/to/capture.json` and review missing evidence.
- [ ] Confirm baseline/menu checkpoints and manual-interaction snapshots survive rolling history eviction.
- [ ] Capture selected/active state and enabled/disabled quality options.
- [ ] Capture manual scrolling and lazy-loading behavior; identify collection container.
- [ ] Identify rerender/virtualization effects and durable asset IDs.
- [ ] Record one manual 2K operation's processing timing and browser download behavior.
- [ ] Confirm observation stops, survives popup closure, and resets on page reload.
- [ ] Test redirected domains/localization; document any unsupported scope.

## Phase 2 and later download MVP acceptance — live tests pending

Single-image and bulk code are implemented; all live checks below remain unrun. Validate one real image before running larger exports.

- [ ] One image: correct asset → More → Download → 2K; browser confirms completion.
- [ ] 5, 10, and 50+ images: exact success/failure counts and one active operation at a time.
- [ ] Delayed upscaling, slow network, and UI delays: bounded waits with useful status.
- [ ] Failed/interrupted browser download and timeout: capped retries; other assets continue.
- [ ] Missing/disabled 2K and changed UI: clear per-asset error; no unintended clicks.
- [ ] Pause waits for current operation; resume advances correctly.
- [ ] Cancel prevents further actions and preserves existing files.
- [ ] Reload/navigation/service-worker restart: recover safely without duplicate operations.
- [ ] Lazy loading, virtualization, duplicate thumbnails, and card reorder: stable deduplication/reacquisition.
- [ ] Other simultaneous browser downloads are never attributed to Flow assets incorrectly.
- [ ] Filename format, actual file extension, and duplicate names preserve existing files.
- [ ] Retry only failed items; per-asset errors and counts agree with actual downloads.
- [ ] Chrome and Edge loaded-unpacked tests pass; keyboard navigation and focus are usable.

## Version 0.1.1 session-sync validation

New regression tests use Chrome API transport stubs and render the real extension UI, without creating Flow page/card/menu DOM or assets. They verify live bound-tab export instead of cached idle metadata; prevention of unstarted exports; stop commands staying on the captured tab after active-tab changes; refusal after navigation outside Flow; old-script detection; idle-panel synchronization with capture started elsewhere; clear disabled during observation; and fresh backend metadata at copy time. Known-label string tests cover split/concatenated 2K text while rejecting 4K/upgrade variants. TypeScript and the production build pass. These tests do not prove actual authenticated Flow menu or download behavior.

## Version 0.2.0 validation

The 51 tests include new browser-metadata and Chrome-transport checks for exact source/referrer/time correlation, exclusion of unrelated/old downloads, ambiguous concurrent Flow downloads, sanitized records, browser in-progress/complete/interrupted states, single-operation locking, permission denial, message sender/tab/frame validation, cross-tab release refusal, event-backed updates, recovery of a missed create event, and cancellation/timeouts of bounded waits. New tests create no Flow DOM or mock Flow assets. Chrome metadata/transport stubs are unit tests only; no production download is simulated.

`npm ci --cache /workspace/.npm-cache --no-audit --no-fund`, `npm test`, and `npm run build` passed. A first dependency install using the default home cache failed because that path was unavailable; the existing writable cache corrected setup without weakening integrity verification or changing dependencies. The build verifies optional-only Downloads access, unchanged exact-host security, required MV3 files, and a self-contained classic content script. An initial build caught an ESM shared chunk in the injected entry; the runtime dependency was removed and the verified build passes.

The managed Chromium extension blocklist is still present. The optional smoke test's stale button label was corrected, but no browser success is claimed. The user must run README's Phase 2 test in normal Chrome/Edge; confirm actual file, 2K dimensions, ID, completion, upscaling latency, and Downloads attribution. Do not infer successful automation from the captured manual click or local unit suite.

## Version 0.2.1 UI and handoff validation

The default surface now shows download controls; inspector controls render only after expanding Developer tools. The real extension UI transport test verifies a legacy page script produces an explicit refresh warning and no silent developer-tool fallback, and a current automation session displays its real download button outside the inspector. No mock Flow DOM/assets are added. Operation-report tests verify that asset references, unexpected fields, source URLs, and local username paths are omitted while actual stage/error/download state remains present. The operation engine records real state-transition times, not simulated progress. A 54-test pass and production build pass are required for this release.

Historical 0.2.1 feedback: only the inspector appeared and no download button was visible; no automated single-image success was reported. The current 0.3.0 implements bulk at the user’s subsequent explicit request. The cloud still has no authenticated user-browser connector and managed extension policy prevents live acceptance. Follow the current bulk procedure and verify actual files/dimensions.

## Version 0.3.0 bulk validation

Generic numbered-job tests (no mock Flow DOM/assets) verify concurrency one, awaiting each job, capped retries with failure continuation, pause/resume without replay, cancellation preserving completed work, and stopping on uncertain attribution. Extension UI tests with empty transport metadata verify the bulk button requests optional access and dispatches FLOW_BULK/start; denial starts nothing. The upgraded panel test verifies no image chooser and primary bulk controls outside Developer tools. Production code simulates no assets, downloads, or progress.

Follow README's live bulk procedure. Verify 1, 5, 10, and 50+ images; actual scroll-container discovery; exclusion of logos/folder thumbnails; deduplication; lazy/virtualized reacquisition; automatic menus/2K; completion before the next image; real counts/files/dimensions; interrupted failure/retry/continue; uncertain attribution/timeout stopping; pause/resume/cancel; page reload/navigation; popup closure/reopen; worker restart; slow loading; disabled/missing 2K; changed DOM. All authenticated checks remain unrun.

The latest 0.2.1 inspector capture is loading/scroll evidence, not an operation result. This release implements the explicitly requested bulk workflow while keeping implementation/local validation distinct from actual browser success.

## Version 0.4.0 folder validation

New tests cover relative/nested/Unicode folders; Windows separators; absolute-path, traversal, reserved-name, and invalid-character rejection; preserving the actual tentative basename/extension; default/recent/new-folder UI choices; validation before requesting permission; persistence; older content-script refusal; asynchronous filename-event callback completion; unchanged unrelated/default downloads; event-order handling; ambiguous download rejection; duplicate uniquification; storage failure; missing tentative filenames; and final-folder mismatch errors. Tests use pure paths, Chrome API metadata/events, and the real extension UI, with no fabricated Flow DOM or production downloads.

Live Chrome/Edge checks remain pending:

- [ ] Load 0.4.0, refresh Flow, and confirm Download folder appears before the start button.
- [ ] New nested folder: save one actual 2K image; confirm the browser creates folders beneath its configured Downloads location and preserves the format.
- [ ] Existing folder: save another export to the same name; verify duplicates get browser suffixes without overwriting files.
- [ ] Recent choice persists after closing/reopening the extension; blank/Use Downloads folder uses the configured default.
- [ ] Folder stays fixed during pause/resume and Retry Failed; a new export can choose a different destination.
- [ ] Another non-Flow download retains its normal target; avoid concurrent Flow downloads because attribution has no initiating tab ID.
- [ ] Override the destination in a browser save prompt; a file completing elsewhere produces an error instead of a successful folder export.
- [ ] Folder behavior survives worker restart; actual files, paths, counts, and 2K dimensions match the UI.

## Version 0.5.0 scope controls and selection inspection

New tests use the actual empty non-Flow document and actual extension UI with empty transport metadata. They verify mutually exclusive pressed-state toggles, no automatic discovery on panel open, disabled selected downloads, no Downloads permission request or bulk start from selected mode, read-only checkpoint transport, returning to All images, refusal of selected scope in the engine before any discovery/actions, refusal outside exact Flow, and clear failure without a real collection. No mock Flow DOM/assets or guessed selection selectors are added. These checks do not prove real Flow multi-selection semantics.

- [ ] Follow README's baseline → two selected → one deselected → optional scrolled procedure and share real selection JSON.
- [ ] Establish the actual selected-state signal, its owning card, stable media mapping, deselection behavior, and whether virtualized selections remain discoverable.
- [ ] After implementing from evidence, verify Selected exports precisely the selected IDs, All exports the full supported collection, and neither changes the other mode's scope.
- [ ] Verify no-selection behavior, offscreen selected images, selection changes during discovery, fixed queue membership, folder routing, pause/resume/cancel, retries, and actual browser-completed files.

## Version 0.5.1 UI validation

The refreshed actual UI was rendered in Chromium over localhost with empty Chrome API transport metadata, without loading the extension or constructing any Flow DOM/assets/downloads. Popup widths of 320/400px and a 540px side panel passed horizontal-overflow checks, primary-action keyboard focus, mutually exclusive scopes, selected-mode refusal, the expandable selection guide, the correct no-Flow link/state, and zero page JavaScript errors. Screenshots were visually reviewed; idle actions no longer overlap settings. This is layout validation, not an authenticated Flow or managed extension-install pass.

Existing transport tests still verify permission handling, folder persistence/invalid destinations, bound-tab synchronization, selection capture, and all/selected isolation. New presentation tests ensure failed/skipped exports do not appear fully successful, a pending pause cannot hide an error, elapsed time uses actual timestamps and freezes on completion, and invalid byte/time data is not presented as a real measurement.

Live acceptance remains pending: actual download progress/completion/error summaries, pause/resume/cancel, the native Open Downloads folder action, popup/side-panel behavior inside Chrome/Edge, keyboard navigation at browser zoom, and real selected-image evidence. The optional extension smoke test now opens Developer tools before toggling the persisted Debug logging switch.
