import { chromium } from 'playwright-core';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import assert from 'node:assert/strict';

const profile = await mkdtemp(join(tmpdir(), 'flow-inspector-browser-'));
const extension = resolve('dist');
let context;
try {
  context = await chromium.launchPersistentContext(profile, {
    executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
    headless: true,
    ignoreDefaultArgs: ['--disable-extensions'],
    args: [
      `--disable-extensions-except=${extension}`, `--load-extension=${extension}`,
      // Local isolated test browser only; Chromium still verifies HTTPS normally.
      ...(process.env.CHROMIUM_NO_SANDBOX === '1' ? ['--no-sandbox'] : []),
    ],
  });
  context.setDefaultTimeout(10_000);
  const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker', { timeout: 15_000 }).catch(() => {
    throw new Error('Extension worker did not load. Check managed extension policies and unpacked-extension support. Cloud Chromium has ExtensionInstallBlocklist=["*"]; this test cannot run there. Do not modify managed policy to make it pass.');
  });
  const extensionId = new URL(worker.url()).host;
  const errors = [];
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`chrome-extension://${extensionId}/popup.html`);
  await page.getByRole('heading', { name: 'Flow Bulk Downloader', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Reconnect to Flow' }).click();
  await page.getByRole('alert').filter({ hasText: 'Open https://flow.google.com/' }).waitFor();
  await page.getByRole('checkbox', { name: 'Debug console logging' }).check();
  await page.waitForFunction(async () => (await chrome.storage.local.get('debug')).debug === true);
  await page.reload();
  await page.getByRole('checkbox', { name: 'Debug console logging' }).waitFor();
  assert(await page.getByRole('checkbox', { name: 'Debug console logging' }).isChecked(), 'Debug preference did not persist');
  await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);
  await page.getByRole('heading', { name: 'Flow Bulk Downloader', exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Open download side panel' }).count(), 0);
  assert.equal(await page.getByRole('button', { name: /download all/i }).count(), 0, 'Bulk controls require a connected, exact-host Flow content script');
  assert.deepEqual(errors, []);
  console.log('Chromium smoke passed: MV3 worker loaded, popup and side panel rendered, unrelated-page inspection refused, debug preference persisted, no JS errors.');
  console.log('No authenticated Flow page or download automation was tested.');
} finally {
  await context?.close();
  await rm(profile, { recursive: true, force: true });
}
