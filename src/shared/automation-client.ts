import { inspectTab, isFlowUrl } from './client';
import type { AutomationCommand, AutomationReply } from './automation-types';
import type { BulkCommand, BulkReply } from './bulk-types';
import type { DownloadScope } from './selection-types';
export async function bulkCommand(tabId: number, action: BulkCommand['action'], retries = 2, debug = false, folder = '', scope: DownloadScope = 'all') {
  const tab = await chrome.tabs.get(tabId);
  if (!isFlowUrl(tab.url)) throw new Error('The connected tab is no longer on https://flow.google.com/.');
  const current = await inspectTab('get', debug, tabId);
  if (current.session.bulk?.protocol !== 1) throw new Error('Refresh Flow after loading the bulk extension build.');
  if (['start', 'discover', 'retry'].includes(action) && current.session.bulk.discoverySupport !== 2) throw new Error('Refresh Flow to install the image discovery fix before starting or retrying. No operation was sent.');
  if (scope === 'selected' && ['start', 'discover', 'retry'].includes(action) && current.session.bulk.selectedDownloadSupport !== 1) throw new Error('Refresh Flow after loading the selected-download build. No operation was sent.');
  if (folder && current.session.bulk.folderSupport !== 1) throw new Error('Refresh Flow after loading this build to enable destination folders.');
  const reply = await chrome.tabs.sendMessage(tabId, { type: 'FLOW_BULK', action, retries, debug, folder, scope }) as BulkReply;
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
