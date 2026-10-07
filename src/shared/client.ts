import type { InspectorCommand, InspectorReply, InspectorSession } from './types';
export function isFlowUrl(url?: string): boolean {
  if (!url) return false;
  try { const u = new URL(url); return u.protocol === 'https:' && u.hostname === 'flow.google.com'; }
  catch { return false; }
}
export async function activeFlowTab(): Promise<chrome.tabs.Tab> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !isFlowUrl(tab.url)) throw new Error('Open https://flow.google.com/ and click the extension icon to grant inspection access.');
  return tab;
}
export async function inspectTab(action: InspectorCommand['action'], debug: boolean, boundTabId?: number): Promise<{ tabId: number; session: InspectorSession }> {
  const tab = boundTabId === undefined ? await activeFlowTab() : await chrome.tabs.get(boundTabId);
  if (!tab.id || !isFlowUrl(tab.url)) throw new Error('The captured tab is no longer accessible on https://flow.google.com/. Open the Flow tab and click the extension icon again.');
  const tabId = tab.id;
  const command: InspectorCommand = { type: 'FLOW_INSPECTOR', action, debug };
  let reply: InspectorReply;
  try {
    reply = await chrome.tabs.sendMessage(tabId, command) as InspectorReply;
  } catch {
    // This guarded entry installs at most once. It performs no clicks or network requests.
    await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
    reply = await chrome.tabs.sendMessage(tabId, command) as InspectorReply;
  }
  if (!reply || !reply.ok) throw new Error(reply?.error ?? 'Flow inspector did not respond. Reopen the extension on the Flow tab.');
  if (reply.session.captureProtocol !== 1) throw new Error('This Flow tab is running an older inspector. Reload the extension, refresh the Flow page, then reopen the extension.');
  return { tabId, session: reply.session };
}
/** Never export an idle cached session as though it contains the menu procedure. */
export async function liveMenuCapture(tabId: number, debug: boolean): Promise<InspectorSession> {
  const { session } = await inspectTab('get', debug, tabId);
  if (!session.observation?.startedAt) throw new Error('Menu capture has not started on this tab. Click Start menu capture, then open the image menus manually.');
  return session;
}
