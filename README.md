# Flow Bulk Downloader — v0.6.0

Export selected or all generated image cards from an open, signed-in Flow project. Choose the original image, 2K, or 4K in Export settings, then start. Selected exports snapshot currently rendered selected cards at Start; offscreen selections may be omitted. Preview selected images optionally freezes a list for later use. There is no need to clear selection or open each image. All images uses the bounded collection scan.

The export worker requests 2K/4K using Flow’s internal authenticated upscale endpoint and normal page reCAPTCHA execution, then saves the returned PNG through Chrome’s downloads API. Account credentials and verification tokens stay within the Flow page execution and are never persisted or exported. This endpoint is undocumented and may change. Sign-in, account access, verification, and quota restrictions still apply. The original option fetches the observed Flow image URL; no quality fallback is performed. Upscaled PNG dimensions are checked before saving.

Downloads use exact browser download IDs; only browser completion counts as success. Keep the Flow tab open. You may close the panel; inactive-tab throttling and authenticated API compatibility still require live testing. Pause finishes the current image before stopping; Cancel prevents future saves where possible and preserves already-started browser downloads. Refreshing Flow discards its in-memory queue. No lower resolution is silently substituted. Authentication/quota failures stop the queue with a message. Safe server failures use capped retries. Check Downloads after tracking timeouts before retrying.

## Install

Build, load `dist/` as an unpacked extension in Chrome/Edge, then refresh Flow. Confirm v0.6.0 appears. Downloads permission is optional and requested when starting an export. No persistent host permissions were added.

## Development

Use Node.js 24 and the existing checkout. Each cloud task is isolated; do not create worktrees unless explicitly requested.

```sh
cd /workspace/flowext
npm ci --cache /workspace/.npm-cache --no-fund
npm test
npm run build
```

`npm run dev` watches build output. There is no web server. Optional browser smoke checks require Chromium permitting unpacked extensions; managed cloud policy blocks those checks. Unit/build checks do not establish successful authenticated 2K/4K upscaling. Test a single 2K image before larger exports, verify actual saved dimensions, then validate selected and all-image exports, interrupted downloads, cancellation and quota errors.

Diagnostics are available under Developer tools. Copy bulk result exports counts, chosen quality, statuses and sanitized download metadata. Selection diagnostics are read-only and separate from the export list. Do not share credentials or signed URLs.
