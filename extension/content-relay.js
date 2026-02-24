// Content relay script (ISOLATED world): bridges window messages to chrome.runtime
// Receives SCQ_CLIENT_ID from content.js (MAIN world) and relays to background.js

window.addEventListener('message', (event) => {
  if (event.source !== window) return;
  if (event.data?.type === 'SCQ_CLIENT_ID' && event.data.clientId) {
    chrome.runtime.sendMessage({
      type: 'CLIENT_ID_CAPTURED',
      clientId: event.data.clientId,
    });
  }
});
