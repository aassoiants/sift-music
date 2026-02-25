// SoundCloud API client for Chrome Extension
// Fetches likes and feed directly from api-v2.soundcloud.com
// CORS bypassed by host_permissions in manifest.json

const PAGE_SIZE = 200;
const FEED_MAX_ITEMS = 1000;
const CACHE_KEY_LIKES = 'scq-cached-likes';
const CACHE_KEY_FEED = 'scq-cached-feed';
// Cache persists until explicit clearCache() (Shift+Click Generate)

function getAuth() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: 'GET_AUTH' }, resolve);
  });
}

async function fetchPage(url, oauthToken) {
  const res = await fetch(url, {
    headers: {
      Authorization: `OAuth ${oauthToken}`,
      Accept: 'application/json; charset=utf-8',
    },
  });
  if (res.status === 401) throw new Error('AUTH_EXPIRED');
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

async function resolveUserId(oauthToken, clientId) {
  const cached = await chrome.storage.local.get('userId');
  if (cached.userId) return cached.userId;

  const res = await fetch(
    `https://api-v2.soundcloud.com/me?client_id=${clientId}`,
    { headers: { Authorization: `OAuth ${oauthToken}` } }
  );
  if (!res.ok) throw new Error('Failed to resolve user ID');
  const me = await res.json();
  await chrome.storage.local.set({ userId: me.id });
  return me.id;
}

async function fetchAllLikes(oauthToken, clientId, onProgress) {
  const userId = await resolveUserId(oauthToken, clientId);
  let url = `https://api-v2.soundcloud.com/users/${userId}/likes?client_id=${clientId}&limit=${PAGE_SIZE}&offset=0&linked_partitioning=1`;
  let allItems = [];
  let page = 1;

  while (url) {
    if (onProgress) onProgress(`Fetching likes page ${page}...`);
    const result = await fetchPage(url, oauthToken);
    const items = result.collection || [];
    allItems = allItems.concat(items);
    url = result.next_href || null;
    page++;
  }

  return allItems
    .filter((item) => item.track)
    .map((item) => {
      const t = item.track;
      return {
        track_id: t.id,
        title: t.title,
        artist: t.user?.username || 'Unknown',
        duration_ms: t.duration,
        duration_min: Math.round((t.duration / 60000) * 10) / 10,
        permalink_url: t.permalink_url,
        created_at: t.created_at,
        display_date: t.display_date,
        genre: t.genre || null,
        likes_count: t.likes_count,
        streamable: t.streamable,
        policy: t.policy,

        media_transcodings: t.media?.transcodings || [],
        liked_at: item.created_at,
      };
    });
}

async function fetchAllFeed(oauthToken, clientId, onProgress) {
  let url = `https://api-v2.soundcloud.com/stream?client_id=${clientId}&limit=${PAGE_SIZE}&linked_partitioning=1`;
  let allItems = [];
  let page = 1;

  while (url && allItems.length < FEED_MAX_ITEMS) {
    if (onProgress) onProgress(`Fetching feed page ${page}...`);
    const result = await fetchPage(url, oauthToken);
    const items = result.collection || [];
    allItems = allItems.concat(items);
    if (allItems.length >= FEED_MAX_ITEMS || !result.next_href) break;
    url = result.next_href;
    page++;
  }

  return allItems
    .filter((item) => item.track && (item.type === 'track' || item.type === 'track-repost'))
    .map((item) => {
      const t = item.track;
      return {
        track_id: t.id,
        title: t.title,
        artist: t.user?.username || 'Unknown',
        duration_ms: t.duration,
        duration_min: Math.round((t.duration / 60000) * 10) / 10,
        permalink_url: t.permalink_url,
        created_at: t.created_at,
        display_date: t.display_date,
        genre: t.genre || null,
        likes_count: t.likes_count,
        streamable: t.streamable,
        policy: t.policy,

        media_transcodings: t.media?.transcodings || [],
        feed_type: item.type,
        feed_posted_at: item.created_at,
        reposted_by: item.type === 'track-repost' ? item.user?.username : null,
      };
    });
}

export async function fetchLikes(onProgress) {
  // Check cache (persists until explicit clearCache)
  const cached = await chrome.storage.local.get(CACHE_KEY_LIKES);
  if (cached[CACHE_KEY_LIKES]?.data) {
    return cached[CACHE_KEY_LIKES].data;
  }

  const { oauthToken, clientId } = await getAuth();
  if (!oauthToken || !clientId) throw new Error('NOT_AUTHENTICATED');

  const data = await fetchAllLikes(oauthToken, clientId, onProgress);
  await chrome.storage.local.set({
    [CACHE_KEY_LIKES]: { data, timestamp: Date.now() },
  });
  return data;
}

export async function fetchFeed(onProgress) {
  // Check cache (persists until explicit clearCache)
  const cached = await chrome.storage.local.get(CACHE_KEY_FEED);
  if (cached[CACHE_KEY_FEED]?.data) {
    return cached[CACHE_KEY_FEED].data;
  }

  const { oauthToken, clientId } = await getAuth();
  if (!oauthToken || !clientId) throw new Error('NOT_AUTHENTICATED');

  const data = await fetchAllFeed(oauthToken, clientId, onProgress);
  await chrome.storage.local.set({
    [CACHE_KEY_FEED]: { data, timestamp: Date.now() },
  });
  return data;
}

export async function clearCache() {
  await chrome.storage.local.remove([CACHE_KEY_LIKES, CACHE_KEY_FEED, 'userId']);
}

// ── Stream URL resolution ───────────────────────────────────

/**
 * Resolve a playable stream URL for a track.
 *
 * SoundCloud's media.transcodings array contains entries like:
 *   { url: "https://api-v2.soundcloud.com/media/.../stream/hls",
 *     format: { protocol: "hls", mime_type: "audio/mpeg" },
 *     quality: "sq" }
 *
 * The `url` field is NOT the actual stream — it's an API endpoint
 * that returns { url: "https://cf-hls-media.sndcdn.com/..." }
 * when called with ?client_id=...&track_authorization=...
 */
export async function getStreamUrl(track) {
  if (!track.media_transcodings || track.media_transcodings.length === 0) {
    throw new Error('No transcodings available for this track');
  }

  const { clientId } = await getAuth();
  if (!clientId) throw new Error('NOT_AUTHENTICATED');

  // Pick best transcoding: prefer HLS (for hls.js), then progressive as fallback
  const transcodings = track.media_transcodings;

  // Priority order:
  // 1. HLS with audio/mpeg (MP3 HLS — widest compatibility)
  // 2. HLS with audio/aac or audio/mp4 (AAC HLS — SC's new format)
  // 3. Any HLS
  // 4. Progressive (direct MP3 URL — no hls.js needed)
  const hlsMp3 = transcodings.find(
    (tc) => tc.format?.protocol === 'hls' && tc.format?.mime_type === 'audio/mpeg'
  );
  const hlsAac = transcodings.find(
    (tc) => tc.format?.protocol === 'hls' && /audio\/(mp4|aac)/.test(tc.format?.mime_type)
  );
  const anyHls = transcodings.find((tc) => tc.format?.protocol === 'hls');
  const progressive = transcodings.find((tc) => tc.format?.protocol === 'progressive');

  const chosen = hlsMp3 || hlsAac || anyHls || progressive;
  if (!chosen) {
    throw new Error('No compatible transcoding found');
  }

  // Fetch the actual stream URL from the transcoding endpoint
  const separator = chosen.url.includes('?') ? '&' : '?';
  const streamApiUrl = `${chosen.url}${separator}client_id=${clientId}`;

  const { oauthToken } = await getAuth();
  const res = await fetch(streamApiUrl, {
    headers: {
      Authorization: `OAuth ${oauthToken}`,
      Accept: 'application/json; charset=utf-8',
    },
  });
  if (!res.ok) throw new Error(`Stream resolve failed: ${res.status}`);
  const data = await res.json();

  return {
    url: data.url,
    protocol: chosen.format?.protocol || 'unknown',
    mimeType: chosen.format?.mime_type || 'unknown',
  };
}
