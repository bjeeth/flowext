import { expect, it } from 'vitest';
import { matchesQuality, isDownloadQuality } from '../src/shared/download-quality';
it('matches each explicit resolution without substituting Original or another quality', () => {
  for (const quality of ['1k', '2k', '4k'] as const) {
    expect(matchesQuality(quality.toUpperCase(), quality)).toBe(true);
    expect(matchesQuality(`${quality.toUpperCase()} Upscaled`, quality)).toBe(true);
    expect(matchesQuality('Original', quality)).toBe(false);
    expect(matchesQuality('Download all', quality)).toBe(false);
    for (const other of ['1k', '2k', '4k'] as const) if (other !== quality) expect(matchesQuality(other, quality)).toBe(false);
  }
  expect(isDownloadQuality('8k')).toBe(false);
});

it('matches the confirmed original-size label only for 1K', () => {
  for (const label of ['1K Original size', '1K orginal size', ' 1K   Original size ']) {
    expect(matchesQuality(label, '1k')).toBe(true);
    expect(matchesQuality(label, '2k')).toBe(false);
    expect(matchesQuality(label, '4k')).toBe(false);
  }
});
