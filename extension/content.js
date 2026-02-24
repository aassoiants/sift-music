// Content script (MAIN world): runs on soundcloud.com to capture client_id
// This runs in the page's JS context so it can intercept fetch/XHR.
// It posts messages to the window; content-relay.js (ISOLATED world) picks them up.

(function () {
  // Intercept fetch
  const originalFetch = window.fetch;
  window.fetch = function (...args) {
    try {
      const url = typeof args[0] === 'string' ? args[0] : args[0]?.url;
      if (url && url.includes('api-v2.soundcloud.com')) {
        const parsed = new URL(url);
        const clientId = parsed.searchParams.get('client_id');
        if (clientId) {
          window.postMessage({ type: 'SCQ_CLIENT_ID', clientId }, '*');
        }
      }
    } catch (e) { /* ignore parse errors */ }
    return originalFetch.apply(this, args);
  };

  // Intercept XMLHttpRequest
  const originalOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    try {
      if (url && url.includes('api-v2.soundcloud.com')) {
        const parsed = new URL(url, location.origin);
        const clientId = parsed.searchParams.get('client_id');
        if (clientId) {
          window.postMessage({ type: 'SCQ_CLIENT_ID', clientId }, '*');
        }
      }
    } catch (e) { /* ignore */ }
    return originalOpen.call(this, method, url, ...rest);
  };
})();
