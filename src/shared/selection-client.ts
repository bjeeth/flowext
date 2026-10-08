import { inspectTab } from './client';
import type { SelectionCommand, SelectionReply } from './selection-types';
export async function selectionCommand(tabId: number, action: SelectionCommand['action'], checkpoint?: SelectionCommand['checkpoint']) {
  await inspectTab('get', false, tabId); // Bound-tab exact-host check and guarded injection.
  const reply = await chrome.tabs.sendMessage(tabId, { type: 'FLOW_SELECTION', action, checkpoint }) as SelectionReply;
  if (!reply?.ok) throw new Error(reply?.error ?? 'Refresh Flow after loading this build to capture its selection state.');
  return reply.capture;
}
