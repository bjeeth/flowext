/** Keep account and project identity while allowing editor state within that project. */
export function projectLocation(value: string): string | undefined {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.hostname !== 'flow.google.com') return;
    const project = url.pathname.match(/^\/(?:u\/\d+\/)?project\/[^/]+(?:\/|$)/);
    if (!project) return url.origin + url.pathname + url.search; // Unknown routes remain strict.
    return url.origin + project[0].replace(/\/$/, '');
  } catch { return; }
}
export function sameProject(initial: string, current: string): boolean {
  const expected = projectLocation(initial);
  return expected !== undefined && expected === projectLocation(current);
}
