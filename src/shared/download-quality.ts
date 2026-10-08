export type DownloadQuality = '1k' | '2k' | '4k';
export function isDownloadQuality(value: unknown): value is DownloadQuality {
  return value === '1k' || value === '2k' || value === '4k';
}
/** Match explicit resolution labels only; The user confirmed 1K Original size, 2K Upscaled, and 4K Upscaled. */
export function matchesQuality(label: string, quality: DownloadQuality): boolean {
  const normalized = label.trim().toLowerCase().replace(/\s+/g, ' ');
  return normalized === quality || normalized === `${quality} upscaled` ||
    (quality === '1k' && /^1k (?:original|orginal) size$/.test(normalized));
}
