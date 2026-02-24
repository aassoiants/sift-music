// Service worker: opens app tab on icon click, handles auth

// ── Tab management ─────────────────────────────────────────

chrome.action.onClicked.addListener(async () => {
  const appUrl = chrome.runtime.getURL('app.html');
  const tabs = await chrome.tabs.query({ url: appUrl });
  if (tabs.length > 0) {
    // Focus the first match; close any accidental duplicates
    chrome.tabs.update(tabs[0].id, { active: true });
    chrome.windows.update(tabs[0].windowId, { focused: true });
    for (let i = 1; i < tabs.length; i++) {
      chrome.tabs.remove(tabs[i].id);
    }
  } else {
    chrome.tabs.create({ url: appUrl });
  }
});

// ── Message handler (auth only) ────────────────────────────

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  // Auth: client_id captured by content script
  if (msg.type === 'CLIENT_ID_CAPTURED') {
    chrome.storage.local.set({ clientId: msg.clientId });
    return;
  }

  // Auth: app requests credentials
  if (msg.type === 'GET_AUTH') {
    Promise.all([
      chrome.cookies.get({ url: 'https://soundcloud.com', name: 'oauth_token' }),
      chrome.storage.local.get('clientId'),
    ]).then(([cookie, store]) => {
      sendResponse({
        oauthToken: cookie?.value || null,
        clientId: store.clientId || null,
      });
    });
    return true;
  }
});
