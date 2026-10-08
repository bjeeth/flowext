import { readFile, access } from 'node:fs/promises';
import assert from 'node:assert/strict';
const manifest = JSON.parse(await readFile('dist/manifest.json', 'utf8'));
assert.equal(manifest.manifest_version, 3);
assert.deepEqual([...manifest.permissions].sort(), ['activeTab', 'scripting', 'sidePanel', 'storage'].sort(), 'Phase 1 permission set must remain unchanged.');
assert.deepEqual(manifest.optional_permissions, ['downloads'], 'Download access must be optional and scoped to Phase 2.');
assert.equal(manifest.host_permissions, undefined, 'Do not add persistent host permissions.');
assert.equal(manifest.optional_host_permissions, undefined, 'Do not broaden host access.');
for (const file of [manifest.action.default_popup, manifest.background.service_worker, manifest.side_panel.default_path, 'content.js']) {
  await access(`dist/${file}`);
}
const content = await readFile('dist/content.js', 'utf8');
assert(!/^import\s|\bimport\s*\{|\bexport\s*\{/m.test(content), 'Injected content script must be self-contained (no ESM imports/exports).');
assert(!manifest.permissions.includes('downloads'), 'Inspector must not request download access.');
assert(!/\.dispatchEvent\s*\(/.test(content), 'No fabricated pointer/hover/keyboard events.');
assert(!/\bchrome\.downloads\b/.test(content), 'Download APIs belong only in the background worker.');
console.log('Verified MV3 manifest, popup, side panel, service worker, and standalone content script.');
