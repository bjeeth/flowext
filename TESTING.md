# Validation and live acceptance checklist

Recorded cloud results: TypeScript and production build passed; 9/9 diagnostic unit tests passed; `npm audit` reported zero vulnerabilities. Chromium smoke was attempted but blocked by a managed `ExtensionInstallBlocklist=["*"]` policy; browser loading, real popup/side-panel interactions, and authenticated Flow behavior have not been validated. The policy was left unchanged.

## Local checks

Run `npm ci`, `npm test`, `npm run build`, and `npm run test:browser` from the project root. Build output checks verify MV3 entries and that `content.js` has no module imports/exports, since it is injected as a classic isolated content script.

Automated tests cover exact HTTPS host scoping; exclusion of unrelated pages; candidate/control relationships; visible/hidden menu controls; disabled quality options; referenced labels; candidate bounds; hidden images; and exclusion of media URLs/prompt text. Browser smoke uses actual Chromium and the actual built extension. Its test page is `about:blank`, so its result concerns extension loading and refusal to inspect unrelated pages only.

## Phase 1 live Flow — not yet run

- [ ] Extension loads in the user's Chrome/Edge.
- [ ] Capture a generated image's container and actual identifier attributes.
- [ ] Confirm candidates exclude unrelated icons and associate the correct More button.
- [ ] Capture More, Download, and 2K menus with correct roles/names/relationships.
- [ ] Capture selected/active state and enabled/disabled quality options.
- [ ] Capture manual scrolling and lazy-loading behavior; identify collection container.
- [ ] Identify rerender/virtualization effects and durable asset IDs.
- [ ] Record one manual 2K operation's processing timing and browser download behavior.
- [ ] Confirm observation stops, survives popup closure, and resets on page reload.
- [ ] Test redirected domains/localization; document any unsupported scope.

## Download MVP acceptance — implementation blocked on Phase 1 evidence

All checks below are unrun and must remain so until actual automation exists.

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
