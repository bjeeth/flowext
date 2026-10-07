// Known workflow label strings only. No fabricated Flow DOM or assets.
import { expect, it } from 'vitest';
import { kindForName } from '../src/content/flow-dom';

it('recognizes split/concatenated 2K labels while excluding 4K and upgrade text', () => {
  expect(kindForName('2K Upscaled')).toBe('2k');
  expect(kindForName('2KUpscaled')).toBe('2k');
  expect(kindForName('2K\nUpscaled')).toBe('2k');
  expect(kindForName('4K Upscaled')).toBeUndefined();
  expect(kindForName('2K Upscaled Upgrade')).toBeUndefined();
});
