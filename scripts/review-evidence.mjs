import { readFile, stat } from 'node:fs/promises';
import { reviewEvidence } from '../src/shared/evidence-review.ts';

const file = process.argv[2];
if (!file) {
  console.error('Usage: npm run inspect:evidence -- /path/to/real-flow-capture.json');
  process.exitCode = 1;
} else {
  try {
    if ((await stat(file)).size > 64 * 1024 * 1024) throw new Error('Capture exceeds the 64 MiB input limit. Capture a smaller visible section.');
    const result = reviewEvidence(JSON.parse(await readFile(file, 'utf8')));
    console.log(`Capture format: ${result.valid ? 'valid Phase 1 v2' : 'invalid/incomplete'}; snapshots: ${result.snapshots}`);
    for (const error of result.errors) console.error(error);
    if (result.valid) for (const [key, present] of Object.entries(result.coverage)) console.log(`${key}: ${present ? 'observed' : 'not observed'}`);
    for (const warning of result.warnings) console.log(warning);
    process.exitCode = result.valid ? 0 : 1;
  } catch (error) {
    // Do not dump source JSON, identifiers, or credential-like values from parser errors.
    console.error(error instanceof SyntaxError ? 'Input is not valid JSON. No capture contents were printed.' : error instanceof Error ? error.message : 'Could not review capture.');
    process.exitCode = 1;
  }
}
