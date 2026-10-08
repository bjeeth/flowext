# Validation and live acceptance checklist

Current 0.3.0 results: dependency installation, TypeScript/production build, and 61/61 local tests passed. Real captures establish the card/menu and project scroll contracts. No authenticated single-image or bulk success is claimed. Managed Chromium ExtensionInstallBlocklist=["*"] still blocks optional smoke testing; policy is unchanged.

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

The single-image action is implemented; all live checks below remain unrun. Bulk-related checks require future implementation after one real image succeeds.

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
