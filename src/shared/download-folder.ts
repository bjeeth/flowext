/** Chrome filename suggestions are relative to the browser's configured Downloads directory. */
export function normalizeDownloadFolder(value: unknown): string {
  if (typeof value !== 'string') throw new Error('Enter a folder name inside Downloads.');
  const folder = value.trim().replace(/\\/g, '/');
  if (!folder) return '';
  if (folder.length > 180 || folder.startsWith('/') || /[<>:"|?*\u0000-\u001f\u007f]/.test(folder)) {
    throw new Error('Use a relative folder name inside Downloads, without special characters or an absolute path.');
  }
  for (const part of folder.split('/')) {
    if (!part || part === '.' || part === '..' || part !== part.trim() || part.endsWith('.') || part.length > 100 || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part)) {
      throw new Error('Folder names cannot contain empty segments, . or .., reserved device names, or trailing spaces/dots.');
    }
  }
  return folder;
}

/** Preserve Flow's tentative basename and extension; never move outside Downloads. */
export function folderFilename(folder: string, original: string): string {
  const destination = normalizeDownloadFolder(folder);
  const basename = original.split(/[\\/]/).pop();
  if (!destination || !basename || basename === '.' || basename === '..' || /[<>:"|?*\u0000-\u001f\u007f]/.test(basename)) {
    throw new Error('The browser did not provide a usable download filename for the chosen folder.');
  }
  return `${destination}/${basename}`;
}

export function isDownloadInFolder(folder: string, filename: string): boolean {
  const path = filename.replace(/\\/g, '/');
  const slash = path.lastIndexOf('/');
  if (slash < 0) return false;
  const directory = path.slice(0, slash);
  return directory === folder || directory.endsWith(`/${folder}`);
}
