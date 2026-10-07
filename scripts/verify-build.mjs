import { readFile, access } from 'node:fs/promises';
import assert from 'node:assert/strict';
const manifest = JSON.parse(await readFile('dist/manifest.json', 'utf8'));
assert.equal(manifest.manifest_version, 3);
assert.deepEqual([...manifest.permissions].sort(), ['activeTab', 'scripting', 'sidePanel', 'storage'].sort(), 'Phase 1 permission set must remain unchanged.');
assert.equal(manifest.host_permissions, undefined, 'Do not add persistent host permissions.');
assert.equal(manifest.optional_host_permissions, undefined, 'Do not broaden host access.');
for (const file of [manifest.action.default_popup, manifest.background.service_worker, manifest.side_panel.default_path, 'content.js']) {
  await access(`dist/${file}`);
}
const content = await readFile('dist/content.js', 'utf8');
assert(!/^import\s|\bimport\s*\{|\bexport\s*\{/m.test(content), 'Injected content script must be self-contained (no ESM imports/exports).');
assert(!manifest.permissions.includes('downloads'), 'Inspector must not request download access.');
assert(!/\.(?:click|dispatchEvent)\s*\(/.test(content), 'Phase 1 content script must not synthesize interaction.');
assert(!/\bchrome\.downloads\b/.test(content), 'Phase 1 must not use browser download APIs.');
console.log('Verified MV3 manifest, popup, side panel, service worker, and standalone content script.');
