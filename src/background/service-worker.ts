// No download permission or download handling until live Flow evidence is verified.
chrome.runtime.onInstalled.addListener(() => {
  void chrome.storage.local.get('debug').then(({ debug }) => {
    if (typeof debug !== 'boolean') return chrome.storage.local.set({ debug: false });
  }).catch(() => console.error('[FLOW-BULK][ERROR] Could not initialize debug setting.'));
});
