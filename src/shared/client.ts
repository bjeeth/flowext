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
export async function inspectTab(action: InspectorCommand['action'], debug: boolean): Promise<{ tabId: number; session: InspectorSession }> {
  const tab = await activeFlowTab();
  const tabId = tab.id!;
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
  return { tabId, session: reply.session };
}
