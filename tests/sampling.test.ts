// Pure ordering metadata; no Flow DOM or mock assets.
import { expect, it } from 'vitest';
import { rankInspectionTargets } from '../src/content/sampling';

it('keeps a manual target before viewport targets and otherwise preserves document order', () => {
  const inputs = [
    { value: 1, preferred: false, inViewport: false, order: 0 },
    { value: 2, preferred: false, inViewport: true, order: 1 },
    { value: 3, preferred: true, inViewport: false, order: 2 },
    { value: 4, preferred: false, inViewport: true, order: 3 },
  ];
  expect(rankInspectionTargets(inputs)).toEqual([3, 2, 4, 1]);
  expect(inputs.map(input => input.value)).toEqual([1, 2, 3, 4]);
});
