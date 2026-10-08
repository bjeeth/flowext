import { inspectTab, isFlowUrl } from './client';
import type { AutomationCommand, AutomationReply } from './automation-types';
import type { BulkCommand, BulkReply } from './bulk-types';
export async function bulkCommand(tabId: number, action: BulkCommand['action'], retries = 2, debug = false) {
  const tab = await chrome.tabs.get(tabId);
  if (!isFlowUrl(tab.url)) throw new Error('The connected tab is no longer on https://flow.google.com/.');
  const current = await inspectTab('get', debug, tabId);
  if (current.session.bulk?.protocol !== 1) throw new Error('Refresh Flow after loading the bulk extension build.');
  const reply = await chrome.tabs.sendMessage(tabId, { type: 'FLOW_BULK', action, retries, debug }) as BulkReply;
  if (!reply?.ok) throw new Error(reply?.error ?? 'Bulk operation did not respond.');
  return reply.bulk;
}
export async function singleCommand(tabId: number, action: AutomationCommand['action'], assetKey?: string, debug = false) {
  const tab = await chrome.tabs.get(tabId);
  if (!isFlowUrl(tab.url)) throw new Error('The inspected tab is no longer on https://flow.google.com/.');
  const current = await inspectTab('get', debug, tabId);
  if (current.session.single?.protocol !== 1) throw new Error('Reload the updated extension and refresh Flow to install Phase 2.');
  const reply = await chrome.tabs.sendMessage(tabId, { type: 'FLOW_SINGLE', action, assetKey, debug }) as AutomationReply;
  if (!reply?.ok) throw new Error(reply?.error ?? 'Single-image operation did not respond.');
  return reply.single;
}
