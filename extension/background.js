// Service worker: opens app tab on icon click, handles auth, manages update lifecycle

// ── Update lifecycle ───────────────────────────────────────
//
// onInstalled fires with reason='update' AFTER the new version is installed but
// BEFORE the new code starts touching user data. We snapshot moments to a
// permanent versioned key so that even if the new version's code corrupts
// scq-moments, the pre-update state is recoverable from chrome.storage.local.
//
// onUpdateAvailable fires when Chrome has downloaded a new version but BEFORE
// it applies the update. We let the SW restart naturally (Chrome decides) and
// notify any open Sift tab so the user can reload at their own pace.
// See docs/decisions/003-extension-update-safety.md.

chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason !== 'update') return;
  const newVersion = chrome.runtime.getManifest().version;
  const previousVersion = details.previousVersion;
  console.log(`[Sift] Update detected: v${previousVersion} -> v${newVersion}`);

  try {
    const result = await chrome.storage.local.get('scq-moments');
    const moments = result['scq-moments'];
    if (!Array.isArray(moments) || moments.length === 0) return;

    const snapshotKey = `scq-moments-pre-v${newVersion}`;
    const existing = await chrome.storage.local.get(snapshotKey);
    if (existing[snapshotKey] !== undefined) {
      // Snapshot already exists for this version (rare: re-install of same version)
      console.log(`[Sift] Snapshot ${snapshotKey} already present, not overwriting`);
      return;
    }
    await chrome.storage.local.set({ [snapshotKey]: moments });
    console.log(`[Sift] Snapshotted ${moments.length} moments to ${snapshotKey}`);
  } catch (err) {
    console.error('[Sift] Pre-update snapshot failed:', err);
  }
});

chrome.runtime.onUpdateAvailable.addListener((details) => {
  // Don't auto-reload. Tell the open Sift tab so the user can reload deliberately.
  chrome.runtime.sendMessage({
    type: 'UPDATE_AVAILABLE',
    version: details.version,
  }).catch(() => {
    // App tab not open: Chrome will apply the update on next browser restart anyway
  });
});

// ── Tab management ─────────────────────────────────────────

chrome.action.onClicked.addListener(async () => {
  const appUrl = chrome.runtime.getURL('app.html');
  try {
    // Ask the app tab if it's open (ping-pong - no tabs permission needed)
    const response = await chrome.runtime.sendMessage({ type: 'PING' });
    if (response?.tabId) {
      chrome.tabs.update(response.tabId, { active: true });
      chrome.windows.update(response.windowId, { focused: true });
      return;
    }
  } catch (e) {
    // No listener = app not open - fall through to create
  }
  chrome.tabs.create({ url: appUrl });
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

  // SC tab detection: check if any soundcloud.com tab exists
  if (msg.type === 'CHECK_SC_TAB') {
    chrome.tabs.query({ url: 'https://soundcloud.com/*' }, (tabs) => {
      sendResponse({ hasSCTab: tabs.length > 0 });
    });
    return true;
  }

  // SC write proxy: route like/repost API calls through the user's SC tab
  // (MAIN world) so the request rides real soundcloud.com origin + cookies.
  // Without this, DataDome flags extension-origin writes and 403s them.
  if (msg.type === 'SC_WRITE_REQUEST') {
    (async () => {
      try {
        const allTabs = await chrome.tabs.query({ url: 'https://soundcloud.com/*' });
        if (allTabs.length === 0) {
          sendResponse({ ok: false, error: 'NO_SC_TAB' });
          return;
        }
        // Chrome's Memory Saver may discard tabs; injection fails on those
        // with a misleading "host permission" error. Filter to live tabs only.
        const liveTabs = allTabs.filter((t) => !t.discarded && t.status !== 'unloaded');
        if (liveTabs.length === 0) {
          console.log(`[Sift] All ${allTabs.length} SC tab(s) are discarded`);
          sendResponse({ ok: false, error: 'SC_TAB_DISCARDED' });
          return;
        }
        let lastError = null;
        for (const tab of liveTabs) {
          try {
            const results = await chrome.scripting.executeScript({
              target: { tabId: tab.id },
              world: 'MAIN',
              func: scWriteFetch,
              args: [msg.method, msg.url, msg.oauthToken],
            });
            const result = results?.[0]?.result;
            if (!result) {
              lastError = 'INJECTION_FAILED';
              continue;
            }
            // DataDome challenge: 403 with a captcha-delivery URL in body
            if (
              result.status === 403 &&
              result.body &&
              typeof result.body === 'object' &&
              typeof result.body.url === 'string' &&
              result.body.url.startsWith('https://geo.captcha-delivery.com/')
            ) {
              console.log('[Sift] DataDome challenge detected on write');
              sendResponse({ ok: false, status: 403, error: 'DATADOME_CHALLENGE' });
              return;
            }
            console.log(`[Sift] SC write ${msg.method} status=${result.status}`);
            sendResponse(result);
            return;
          } catch (err) {
            lastError = err.message || String(err);
            console.warn(`[Sift] inject failed: ${lastError}`);
          }
        }
        sendResponse({ ok: false, error: lastError || 'ALL_TABS_FAILED' });
      } catch (err) {
        console.error('[Sift] SC_WRITE_REQUEST failed:', err.message);
        sendResponse({ ok: false, error: err.message || 'unknown' });
      }
    })();
    return true;
  }
});

// Injected into the SC tab's MAIN world by chrome.scripting.executeScript.
// Must be self-contained (no closure over extension code). Args are JSON.
async function scWriteFetch(method, url, oauthToken) {
  try {
    const res = await fetch(url, {
      method,
      headers: {
        'Authorization': 'OAuth ' + oauthToken,
        'Accept': 'application/json',
      },
    });
    let body = null;
    const text = await res.text();
    if (text) {
      try { body = JSON.parse(text); } catch { body = text; }
    }
    return { ok: res.ok, status: res.status, body };
  } catch (err) {
    return { ok: false, status: 0, error: (err && err.message) ? err.message : String(err) };
  }
}

// ── SC tab status broadcasting ──────────────────────────────

async function broadcastSCTabStatus() {
  const scTabs = await chrome.tabs.query({ url: 'https://soundcloud.com/*' });
  chrome.runtime.sendMessage({ type: 'SC_TAB_STATUS', hasSCTab: scTabs.length > 0 }).catch(() => {
    // App tab may not be open - ignore
  });
}

chrome.tabs.onCreated.addListener(() => broadcastSCTabStatus());
chrome.tabs.onRemoved.addListener(() => setTimeout(broadcastSCTabStatus, 100));
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.url) broadcastSCTabStatus();
});
