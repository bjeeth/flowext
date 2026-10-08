import { readFile, stat } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { reviewEvidence } from '../src/shared/evidence-review.ts';
import { cardRejection } from '../src/shared/discovery-policy.ts';
import { FLOW } from '../src/content/selectors.ts';

// Real captured metadata only. No reconstructed/mock Flow DOM, private identifiers, or actions.
const file = process.argv[2];
try {
  if (!file) throw new Error('Usage: npm run inspect:discovery -- /path/to/real-flow-capture.json [--expect-unmounted-controls]');
  if ((await stat(file)).size > 64 * 1024 * 1024) throw new Error('Capture exceeds the 64 MiB limit.');
  const capture = JSON.parse(await readFile(file, 'utf8'));
  const review = reviewEvidence(capture);
  if (!review.valid) throw new Error('Invalid Phase 1 v2 evidence; run inspect:evidence for the schema diagnosis.');
  let regressionObserved = false;
  for (const [index, report] of Object.values(capture.snapshots).entries()) {
    const tileFor = node => {
      for (let depth = 0; node && depth < 16; depth++, node = report.nodes[node.parentNodeId]) {
        if (node.tag === FLOW.tile) return node;
      }
    };
    let accepted = 0, withMore = 0;
    for (const candidate of report.candidates) {
      const tile = tileFor(candidate.media);
      // A truncated graph is not a complete DOM count. This evaluates the captured single-image
      // candidate identity only; the browser still checks the complete live tile at runtime.
      const reject = cardRejection({ hasMediaId: !!candidate.media.attributes['data-media-id'], hasTile: !!tile,
        imageCount: candidate.association === 'single-image-container' ? 1 : 0, visible: candidate.media.state.visible });
      if (reject) continue;
      accepted++;
      const more = candidate.contextControlNodeIds.map(id => report.nodes[id]).filter(node =>
        node?.tag === 'button' && tileFor(node)?.nodeId === tile.nodeId &&
        node.attributes['aria-haspopup'] === 'menu' && node.labelMatches.some(match => match.kind === 'more'));
      if (more.length === 1) withMore++;
    }
    console.log(`Snapshot ${index + 1}: ${accepted} supported sampled image identities; ${withMore} with one captured More control.`);
    if (accepted > 0 && withMore === 0) {
      regressionObserved = true;
      assert(accepted > withMore, 'Missing More controls must not discard captured image identities.');
    }
  }
  if (process.argv.includes('--expect-unmounted-controls')) assert(regressionObserved, 'Expected real captured image cards with unmounted More controls.');
  console.log('Captured metadata checked. This does not validate live selectors, project totals, or successful downloads.');
} catch (error) {
  console.error(error instanceof SyntaxError ? 'Invalid JSON; capture contents were not printed.' : error.message);
  process.exitCode = 1;
}
