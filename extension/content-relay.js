// Content relay script (ISOLATED world): bridges window messages to chrome.runtime
// Receives SCQ_CLIENT_ID from content.js (MAIN world) and relays to background.js

window.addEventListener('message', (event) => {
  if (event.source !== window) return;
  if (event.data?.type === 'SCQ_CLIENT_ID' && event.data.clientId) {
    // Validate client_id format (alphanumeric, 20-40 chars) to prevent injection
    const id = event.data.clientId;
    if (typeof id !== 'string' || !/^[a-zA-Z0-9]{20,40}$/.test(id)) return;
    chrome.runtime.sendMessage({
      type: 'CLIENT_ID_CAPTURED',
      clientId: id,
    });
  }
});
