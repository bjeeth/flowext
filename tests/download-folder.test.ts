import { expect, it } from 'vitest';
import { normalizeDownloadFolder, folderFilename, isDownloadInFolder } from '../src/shared/download-folder';

it('supports the browser default, nested folders, Unicode, and Windows separators', () => {
  expect(normalizeDownloadFolder('  ')).toBe('');
  expect(normalizeDownloadFolder('  Flow Exports/Project 1  ')).toBe('Flow Exports/Project 1');
  expect(normalizeDownloadFolder('Flow\\Images')).toBe('Flow/Images');
  expect(normalizeDownloadFolder('写真')).toBe('写真');
});
it.each(['/tmp/images', 'C:\\Images', '\\\\server\\share', '../images', 'Flow/../images', 'Flow/./images', 'Flow//Images', 'Flow/', 'Flow/ bad', 'Flow/bad.', 'CON', 'Flow/LPT1.png', 'a:b', 'a*b', 'a\u0000b', 'x'.repeat(181)])('rejects unsafe or invalid folder: %s', value => {
  expect(() => normalizeDownloadFolder(value)).toThrow();
});
it('preserves the tentative basename/extension and places it inside the chosen folder', () => {
  expect(folderFilename('Flow/Project', '/home/user/Downloads/output.webp')).toBe('Flow/Project/output.webp');
  expect(folderFilename('Flow', 'C:\\Users\\Name\\Downloads\\output.png')).toBe('Flow/output.png');
  expect(() => folderFilename('Flow', '')).toThrow('usable download filename');
});
it('checks the actual final folder on Unix and Windows without accepting a similar suffix', () => {
  expect(isDownloadInFolder('Flow/Project', '/Downloads/Flow/Project/output (1).png')).toBe(true);
  expect(isDownloadInFolder('Flow', 'C:\\Downloads\\Flow\\output.png')).toBe(true);
  expect(isDownloadInFolder('Flow', 'Flow/output.png')).toBe(true);
  expect(isDownloadInFolder('Flow', '/Downloads/OtherFlow/output.png')).toBe(false);
  expect(isDownloadInFolder('Flow', '/Downloads/Flow/other/output.png')).toBe(false);
  expect(isDownloadInFolder('output.pn', 'output.png')).toBe(false);
});
