import { readFile, access } from 'node:fs/promises';
import assert from 'node:assert/strict';
const manifest = JSON.parse(await readFile('dist/manifest.json', 'utf8'));
assert.equal(manifest.manifest_version, 3);
for (const file of [manifest.action.default_popup, manifest.background.service_worker, manifest.side_panel.default_path, 'content.js']) {
  await access(`dist/${file}`);
}
const content = await readFile('dist/content.js', 'utf8');
assert(!/^import\s|\bimport\s*\{|\bexport\s*\{/m.test(content), 'Injected content script must be self-contained (no ESM imports/exports).');
assert(!manifest.permissions.includes('downloads'), 'Inspector must not request download access.');
console.log('Verified MV3 manifest, popup, side panel, service worker, and standalone content script.');
