// Main app - state management and event wiring (Chrome Extension version)

import { fetchLikes, fetchFeed, clearCache, likeTrack, unlikeTrack, repostTrack, unrepostTrack, fetchRepostIds } from './api.js';
import { generateQueue, shuffleQueue } from './queue.js';
import { renderQueue, updatePlayerBar, updateProgress, scrollToPlaying, escapeHtml, renderMomentsTable, updateTabCounts } from './ui.js';
import { initPlayer, loadTrack, toggle, seekTo, seekToTime, hasAudioSource } from './player.js';
import { loadMoments, saveMoment, getMomentsForTrack, getAllMoments, updateMomentNote, deleteMoment } from './moments.js';

const STORAGE_KEY = 'scq-state';

const state = {
  allLikes: [],
  allFeed: [],
  queue: [],
  currentIndex: -1,
  isPlaying: false,
};

// ── Playback position (for bookmark capture + resume) ─────
let currentMs = 0;
let totalMs = 0;
let momentsTicksVisible = true;
let positionSaveTimer = null;

// ── Persistence (chrome.storage.local) ─────────────────────

function saveState() {
  const data = {
    queue: state.queue,
    currentIndex: state.currentIndex,
    settings: getSettings(),
    positionMs: currentMs,
  };
  chrome.storage.local.set({ [STORAGE_KEY]: data }).catch((err) => {
    console.error('[Sift] Failed to save state:', err);
  });
}

function savePositionDebounced() {
  if (positionSaveTimer) return;
  positionSaveTimer = setTimeout(() => {
    positionSaveTimer = null;
    saveState();
  }, 5000);
}

async function loadSavedState() {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  return result[STORAGE_KEY] || null;
}

// ── Auth ────────────────────────────────────────────────────

async function checkAuth() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: 'GET_AUTH' }, (auth) => {
      const loggedOutOverlay = document.getElementById('logged-out-overlay');
      const queueArea = document.querySelector('.queue-area');
      const isAuthed = auth?.oauthToken && auth?.clientId;

      const likesDataBtn = document.getElementById('menu-likes-data');
      const controlsBar = document.querySelector('.controls-bar');
      const playerBar = document.querySelector('.player-bar');
      if (isAuthed) {
        if (loggedOutOverlay) loggedOutOverlay.style.display = 'none';
        if (likesDataBtn) likesDataBtn.style.display = '';
        if (controlsBar) controlsBar.style.display = '';
        if (playerBar) playerBar.style.display = '';
        updateQueueScroll();
        checkSCTab();
      } else {
        if (loggedOutOverlay) loggedOutOverlay.style.display = 'flex';
        if (likesDataBtn) likesDataBtn.style.display = 'none';
        if (controlsBar) controlsBar.style.display = 'none';
        // Hide no-SC-tab overlay - logged-out takes priority
        const noSCOverlay = document.getElementById('no-sc-tab-overlay');
        if (noSCOverlay) noSCOverlay.style.display = 'none';
        // Keep player bar visible if audio is playing so user can pause/stop
        const audioActive = hasAudioSource();
        if (playerBar) playerBar.style.display = audioActive ? '' : 'none';
        if (!audioActive) {
          updatePlayerBar(null);
          updateProgress(0, 0);
        }
        updateQueueScroll();
      }
      resolve(auth);
    });
  });
}

// ── Queue Scroll Lock ────────────────────────────────────────

function updateQueueScroll() {
  const queueArea = document.querySelector('.queue-area');
  const loggedOut = document.getElementById('logged-out-overlay');
  const noSCTab = document.getElementById('no-sc-tab-overlay');
  const anyOverlay =
    (loggedOut?.style.display !== 'none') ||
    (noSCTab?.style.display !== 'none');
  if (queueArea) queueArea.style.overflowY = anyOverlay ? 'hidden' : '';
}

// ── SC Tab Detection ─────────────────────────────────────────

function showOrHideNoSCTabOverlay(hasSCTab) {
  const overlay = document.getElementById('no-sc-tab-overlay');
  const loggedOutOverlay = document.getElementById('logged-out-overlay');
  const loggedOutShowing = loggedOutOverlay?.style.display !== 'none';

  // Only show when authenticated AND no SC tab AND logged-out overlay is NOT showing
  if (!hasSCTab && !loggedOutShowing) {
    overlay.style.display = 'flex';
  } else {
    overlay.style.display = 'none';
  }
  updateQueueScroll();
}

async function checkSCTab() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: 'CHECK_SC_TAB' }, (response) => {
      showOrHideNoSCTabOverlay(response?.hasSCTab);
      resolve(response?.hasSCTab);
    });
  });
}

// Listen for messages from background
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'SC_TAB_STATUS') {
    showOrHideNoSCTabOverlay(msg.hasSCTab);
  }
  // Ping-pong: background asks if app tab is open, we reply with our tab ID
  if (msg.type === 'PING') {
    chrome.tabs.getCurrent((tab) => {
      sendResponse({ tabId: tab?.id, windowId: tab?.windowId });
    });
    return true;
  }
});

// ── Settings ────────────────────────────────────────────────

function getSettings() {
  const feedRatio = parseInt(document.getElementById('feed-ratio').textContent);
  const likesRatio = parseInt(document.getElementById('likes-ratio').textContent);
  const minDuration = parseInt(document.getElementById('min-duration').value);
  return {
    feedRatio: isNaN(feedRatio) ? 1 : feedRatio,
    likesRatio: isNaN(likesRatio) ? 3 : likesRatio,
    minDuration: isNaN(minDuration) ? 30 : minDuration,
  };
}

// ── Rendering ───────────────────────────────────────────────

function render() {
  renderQueue(state.queue, state.currentIndex, {
    onTrackClick: playAtIndex,
    onRemove: removeTrack,
    onSkip: skipToAfter,
    onLike: handleLike,
    onRepost: handleRepost,
  });
}

// ── Playback ────────────────────────────────────────────────

function playAtIndex(index, resumeMs = 0) {
  if (index < 0 || index >= state.queue.length) return;
  state.currentIndex = index;
  state.resumePositionMs = 0;
  const track = state.queue[index];
  loadTrack(track, true, resumeMs / 1000);
  updatePlayerBar(track);
  updateMediaSession(track);
  renderMomentTicks(track.track_id);
  render();
  scrollToPlaying();
  saveState();
}

function updateMediaSession(track) {
  if (!('mediaSession' in navigator)) return;
  navigator.mediaSession.metadata = new MediaMetadata({
    title: track.title,
    artist: track.artist,
  });
}

function playNext() {
  if (state.currentIndex < state.queue.length - 1) {
    playAtIndex(state.currentIndex + 1);
  }
}

function playPrev() {
  if (state.currentIndex > 0) {
    playAtIndex(state.currentIndex - 1);
  }
}

function removeTrack(index) {
  state.queue.splice(index, 1);
  if (index < state.currentIndex) {
    state.currentIndex--;
  } else if (index === state.currentIndex) {
    if (state.currentIndex >= state.queue.length) {
      state.currentIndex = state.queue.length - 1;
    }
    if (state.currentIndex >= 0) {
      const track = state.queue[state.currentIndex];
      loadTrack(track); // async - resolves stream URL then plays
      updatePlayerBar(track);
    } else {
      updatePlayerBar(null);
    }
  }
  render();
  saveState();
}

function skipToAfter(index) {
  if (index + 1 < state.queue.length) {
    playAtIndex(index + 1);
  }
}

// ── Like / Repost ───────────────────────────────────────────

function showConfirmUnlike(track) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'confirm-overlay';
    overlay.innerHTML = `
      <div class="confirm-card">
        <div class="confirm-title">Unlike this track?</div>
        <div class="confirm-text">
          <span class="confirm-track-name">${escapeHtml(track.title)}</span> by ${escapeHtml(track.artist)}<br>
          will be unliked on SoundCloud and removed from your queue.
        </div>
        <div class="confirm-actions">
          <button class="confirm-btn confirm-btn-cancel" data-choice="cancel">Cancel</button>
          <button class="confirm-btn confirm-btn-danger" data-choice="confirm">Unlike &amp; Remove</button>
        </div>
      </div>
    `;

    function cleanup(result) {
      overlay.remove();
      document.removeEventListener('keydown', onKey);
      resolve(result);
    }

    function onKey(e) {
      if (e.key === 'Escape') cleanup(false);
    }

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) cleanup(false);
      const choice = e.target.closest('[data-choice]')?.dataset.choice;
      if (choice === 'confirm') cleanup(true);
      if (choice === 'cancel') cleanup(false);
    });

    document.addEventListener('keydown', onKey);
    document.body.appendChild(overlay);
  });
}

function flashError(index, action) {
  const row = document.querySelector(`.track-row[data-index="${index}"]`);
  if (!row) return;
  const btn = row.querySelector(`[data-action="${action}"]`);
  if (!btn) return;
  btn.classList.add('error');
  setTimeout(() => btn.classList.remove('error'), 1000);
}

async function handleLike(index) {
  const track = state.queue[index];
  if (!track) return;
  if (track.liked) {
    // Always confirm before unliking
    const confirmed = await showConfirmUnlike(track);
    if (!confirmed) return;
    try {
      await unlikeTrack(track.track_id);
    } catch (err) {
      if (err.message === 'AUTH_EXPIRED' || err.message === 'NOT_AUTHENTICATED') { checkAuth(); return; }
      console.error('[Sift] Unlike failed:', err);
      flashError(index, 'like');
      return;
    }
    if (track.originalSource === 'likes') {
      // Originally from LIKES → remove from queue entirely
      removeTrack(index);
      return;
    }
    // Originally from FEED → toggle off, revert badge
    track.liked = false;
    track.source = 'feed';
  } else {
    // Liking
    try {
      await likeTrack(track.track_id);
    } catch (err) {
      if (err.message === 'AUTH_EXPIRED' || err.message === 'NOT_AUTHENTICATED') { checkAuth(); return; }
      console.error('[Sift] Like failed:', err);
      flashError(index, 'like');
      return;
    }
    track.liked = true;
    if (track.source === 'feed') {
      track.source = 'likes';
    }
  }
  render();
  saveState();
}

async function handleRepost(index) {
  const track = state.queue[index];
  if (!track) return;

  if (track.reposted) {
    try {
      await unrepostTrack(track.track_id);
    } catch (err) {
      if (err.message === 'AUTH_EXPIRED' || err.message === 'NOT_AUTHENTICATED') { checkAuth(); return; }
      console.error('[Sift] Unrepost failed:', err);
      flashError(index, 'repost');
      return;
    }
    track.reposted = false;
  } else {
    try {
      await repostTrack(track.track_id);
    } catch (err) {
      if (err.message === 'AUTH_EXPIRED' || err.message === 'NOT_AUTHENTICATED') { checkAuth(); return; }
      console.error('[Sift] Repost failed:', err);
      flashError(index, 'repost');
      return;
    }
    track.reposted = true;
  }
  render();
  saveState();
}

// ── Loading Overlay ─────────────────────────────────────────

function showLoading() {
  const overlay = document.getElementById('loading-overlay');
  overlay.style.display = 'flex';
}

function updateLoading(tagline, progress = '') {
  const taglineEl = document.getElementById('loading-tagline');
  const progressEl = document.getElementById('loading-progress');

  // Fade transition when tagline changes
  if (taglineEl.textContent !== tagline) {
    taglineEl.classList.add('fade');
    setTimeout(() => {
      taglineEl.textContent = tagline;
      taglineEl.classList.remove('fade');
    }, 150);
  }

  progressEl.textContent = progress;
}

function hideLoading() {
  document.getElementById('loading-overlay').style.display = 'none';
  // Reset for next show
  document.getElementById('loading-tagline').textContent = '';
  document.getElementById('loading-progress').textContent = '';
}

// ── Queue Generation ────────────────────────────────────────

async function handleGenerate(forceRefresh = false) {
  const btn = document.getElementById('btn-generate');
  btn.disabled = true;

  try {
    // Check auth first
    const auth = await checkAuth();
    if (!auth?.oauthToken || !auth?.clientId) {
      btn.textContent = 'Log into soundcloud.com first';
      setTimeout(() => { btn.textContent = 'Generate Queue'; }, 3000);
      return;
    }

    // Force refresh: clear both in-memory and storage caches
    if (forceRefresh) {
      state.allLikes = [];
      state.allFeed = [];
      await clearCache();
    }

    // Show loading overlay for first-time fetches
    const needsFetch = state.allLikes.length === 0 || state.allFeed.length === 0;
    if (needsFetch) {
      showLoading();
    } else {
      btn.textContent = 'Generating...';
    }

    // Fetch data (cached after first load)
    if (state.allLikes.length === 0) {
      updateLoading('Liberating your music history');
      state.allLikes = await fetchLikes((msg) => {
        updateLoading('Liberating your music history', msg);
      });
    }
    if (state.allFeed.length === 0) {
      updateLoading('Empowering music discovery of your choice');
      state.allFeed = await fetchFeed((msg) => {
        updateLoading('Empowering music discovery of your choice', msg);
      });
    }

    if (needsFetch) {
      updateLoading('Mixing years and sources');
    }

    // Remember what's currently playing
    const playingTrack = state.currentIndex >= 0 ? state.queue[state.currentIndex] : null;

    const settings = getSettings();
    state.queue = generateQueue(state.allLikes, state.allFeed, settings);

    // Fetch repost state and set initial liked/reposted
    const repostIds = await fetchRepostIds();
    const repostSet = new Set(repostIds);
    for (const track of state.queue) {
      track.liked = track.source === 'likes';
      track.reposted = repostSet.has(track.track_id);
      track.originalSource = track.originalSource || track.source;
    }

    if (playingTrack) {
      const newIdx = state.queue.findIndex((t) => t.permalink_url === playingTrack.permalink_url);
      if (newIdx >= 0) {
        // Move playing track to top of new queue
        state.queue.splice(newIdx, 1);
        state.queue.unshift(playingTrack);
        state.currentIndex = 0;
      } else {
        state.currentIndex = -1;
      }
    } else {
      state.currentIndex = -1;
      updatePlayerBar(null);
      updateProgress(0, 0);
    }
    render();
    scrollToPlaying();
    saveState();
    refreshTabCounts();
    btn.textContent = 'Generate Queue';
  } catch (err) {
    if (err.message === 'NOT_AUTHENTICATED') {
      btn.textContent = 'Log into soundcloud.com first';
    } else if (err.message === 'AUTH_EXPIRED') {
      btn.textContent = 'Session expired - visit soundcloud.com';
      checkAuth();
    } else {
      console.error('Generate failed:', err);
      btn.textContent = 'Error - try again';
    }
    setTimeout(() => { btn.textContent = 'Generate Queue'; }, 3000);
  } finally {
    hideLoading();
    btn.disabled = false;
  }
}

function handleShuffle() {
  if (state.queue.length === 0) return;
  state.currentIndex = shuffleQueue(state.queue, state.currentIndex);
  render();
  saveState();
}

// ── Likes Data Modal ────────────────────────────────────────

function computeLikesStats(likes) {
  const total = likes.length;
  const totalMs = likes.reduce((sum, t) => sum + (t.duration_ms || 0), 0);
  const totalHours = Math.round(totalMs / 3600000);
  const avgMin = total > 0 ? Math.round(totalMs / total / 60000) : 0;

  // Longest track
  let longest = likes[0] || {};
  for (const t of likes) {
    if ((t.duration_ms || 0) > (longest.duration_ms || 0)) longest = t;
  }
  const longestMs = longest.duration_ms || 0;
  const longestH = Math.floor(longestMs / 3600000);
  const longestM = Math.floor((longestMs % 3600000) / 60000);
  const longestLabel = longestH > 0 ? `${longestH}h ${longestM}m` : `${longestM}m`;
  const longestTitle = `${longest.artist || 'Unknown'} - ${longest.title || 'Unknown'}`;

  // Duration buckets
  const buckets = [
    { label: 'Under 5m', max: 5 * 60000, count: 0, bg: '#222' },
    { label: '5\u201330m', max: 30 * 60000, count: 0, bg: '#332200' },
    { label: '30m\u20131h', max: 60 * 60000, count: 0, bg: '#663300' },
    { label: 'Over 1h', max: Infinity, count: 0, bg: '#ff6600' },
  ];
  for (const t of likes) {
    const ms = t.duration_ms || 0;
    if (ms < 5 * 60000) buckets[0].count++;
    else if (ms < 30 * 60000) buckets[1].count++;
    else if (ms < 60 * 60000) buckets[2].count++;
    else buckets[3].count++;
  }
  for (const b of buckets) {
    b.pct = total > 0 ? Math.round((b.count / total) * 100) : 0;
    b.widthPct = total > 0 ? ((b.count / total) * 100).toFixed(1) : '0';
  }

  // Year distribution (by created_at = upload/release date)
  const yearCounts = {};
  for (const t of likes) {
    const year = new Date(t.created_at).getFullYear();
    yearCounts[year] = (yearCounts[year] || 0) + 1;
  }
  const years = Object.keys(yearCounts).map(Number).sort((a, b) => a - b);
  const maxYearCount = Math.max(...years.map((y) => yearCounts[y]), 1);
  const yearData = years.map((y) => ({
    year: y,
    count: yearCounts[y],
    pct: total > 0 ? Math.round((yearCounts[y] / total) * 100) : 0,
    barWidth: ((yearCounts[y] / maxYearCount) * 100).toFixed(1),
  }));

  // Top 5 genres
  const genreCounts = {};
  for (const t of likes) {
    const g = (t.genre || '').trim();
    if (g) genreCounts[g] = (genreCounts[g] || 0) + 1;
  }
  const topGenres = Object.entries(genreCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => ({ name, count }));

  // Top 5 artists
  const artistCounts = {};
  for (const t of likes) {
    const a = (t.artist || '').trim();
    if (a) artistCounts[a] = (artistCounts[a] || 0) + 1;
  }
  const topArtists = Object.entries(artistCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => ({ name, count }));

  return {
    total, totalHours, avgMin,
    longestLabel, longestTitle,
    buckets, yearData,
    topGenres, topArtists,
  };
}

function fmtPct(pct) {
  return pct < 1 ? '<1%' : `${pct}%`;
}

function renderLikesModal(stats) {
  const s = stats;
  const body = document.getElementById('likes-modal-body');

  // Stat cards
  let html = `<div class="lm-stats">
    <div class="lm-stat"><div class="lm-stat-value">${s.total.toLocaleString()}</div><div class="lm-stat-label">Tracks</div></div>
    <div class="lm-stat"><div class="lm-stat-value">${s.totalHours.toLocaleString()}</div><div class="lm-stat-label">Hours</div></div>
    <div class="lm-stat"><div class="lm-stat-value">${s.avgMin}m</div><div class="lm-stat-label">Avg Duration</div></div>
    <div class="lm-stat"><div class="lm-stat-value">${s.longestLabel}</div><div class="lm-stat-label">Longest Track</div></div>
  </div>`;

  // Duration breakdown
  html += `<div class="lm-dur-section">
    <div class="lm-sec-title">Track lengths</div>
    <div class="lm-dur-bar">
      ${s.buckets.map((b, i) => `<div class="lm-dur-seg lm-dur-seg-${i + 1}" style="width:${b.widthPct}%" title="${b.label}: ${b.count} (${fmtPct(b.pct)})"></div>`).join('')}
    </div>
    <div class="lm-dur-legend">
      ${s.buckets.map((b) => `<span class="lm-dur-legend-item"><span class="lm-dur-legend-dot" style="background:${b.bg}"></span>${b.label} \u2014 ${b.count} (${fmtPct(b.pct)})</span>`).join('')}
    </div>
  </div>`;

  // Horizontal bar chart - tracks by year released
  html += `<div class="lm-sec-title">Tracks by year released</div>
  <div class="lm-hbar-chart">
    ${s.yearData.map((y) => `<div class="lm-hbar-row">
      <span class="lm-hbar-year">${y.year}</span>
      <div class="lm-hbar-track"><div class="lm-hbar-fill" style="width:${y.barWidth}%"></div></div>
      <span class="lm-hbar-count">${y.count} (${fmtPct(y.pct)})</span>
    </div>`).join('')}
  </div>`;

  // Bottom - genres + artists
  html += `<div class="lm-bottom">
    <div>
      <div class="lm-sec-title">Top Genres</div>
      <ul class="lm-ranked-list">
        ${s.topGenres.map((g, i) => `<li><span class="rank">${i + 1}.</span><span class="name">${escapeHtml(g.name)}</span><span class="count">${g.count}</span></li>`).join('')}
      </ul>
    </div>
    <div>
      <div class="lm-sec-title">Top Artists</div>
      <ul class="lm-ranked-list">
        ${s.topArtists.map((a, i) => `<li><span class="rank">${i + 1}.</span><span class="name">${escapeHtml(a.name)}</span><span class="count">${a.count}</span></li>`).join('')}
      </ul>
    </div>
  </div>`;

  body.innerHTML = html;
}

function buildCopyText(stats) {
  const s = stats;
  const sep = '\u2500'.repeat(20);
  let text = `Your SoundCloud Likes\n${sep}\n`;
  text += `${s.total.toLocaleString()} tracks  \u00b7  ${s.totalHours.toLocaleString()} hours  \u00b7  ${s.avgMin} min avg\n`;
  text += `Longest: ${s.longestTitle} \u2014 ${s.longestLabel}\n\n`;

  // Track lengths
  text += `Track lengths\n`;
  text += s.buckets.map((b) => `${b.label}: ${b.count} (${fmtPct(b.pct)})`).join('  \u00b7  ');
  text += '\n\n';

  // Year chart (text bars)
  text += `Tracks by year released\n`;
  const maxCount = Math.max(...s.yearData.map((y) => y.count), 1);
  const maxBarLen = 20;
  for (const y of s.yearData) {
    const barLen = Math.max(1, Math.round((y.count / maxCount) * maxBarLen));
    const bar = '\u2588'.repeat(barLen);
    const pad = ' '.repeat(maxBarLen - barLen + 4);
    const countStr = String(y.count).padStart(3);
    text += `${y.year}  ${bar}${pad}${countStr} (${fmtPct(y.pct).padStart(3)})\n`;
  }

  // Genres + artists
  text += `\nTop genres\n`;
  for (let i = 0; i < s.topGenres.length; i++) {
    const g = s.topGenres[i];
    text += `${i + 1}. ${g.name.padEnd(28)}${String(g.count).padStart(4)}\n`;
  }
  text += `\nTop artists\n`;
  for (let i = 0; i < s.topArtists.length; i++) {
    const a = s.topArtists[i];
    text += `${i + 1}. ${a.name.padEnd(28)}${String(a.count).padStart(4)}\n`;
  }

  return text.trimEnd();
}

function openLikesModal() {
  const overlay = document.getElementById('likes-modal');
  const body = document.getElementById('likes-modal-body');

  const likesData = state.allLikes.length > 0
    ? state.allLikes
    : state.queue.filter((t) => t.source === 'likes');

  if (likesData.length === 0) {
    body.innerHTML = '<div class="likes-modal-empty">Generate a queue first to load your likes data.</div>';
  } else {
    const stats = computeLikesStats(likesData);
    renderLikesModal(stats);
    overlay._stats = stats;
  }

  overlay.style.display = 'flex';
}

function closeLikesModal() {
  document.getElementById('likes-modal').style.display = 'none';
}

function copyLikesData() {
  const overlay = document.getElementById('likes-modal');
  if (!overlay._stats) return;
  const text = buildCopyText(overlay._stats);
  navigator.clipboard.writeText(text).then(() => {
    const btn = document.getElementById('likes-modal-copy');
    btn.classList.add('copied');
    setTimeout(() => btn.classList.remove('copied'), 2000);
  });
}

// ── Tab Navigation ─────────────────────────────────────────

let activeTab = 'queue';

function switchTab(tab) {
  activeTab = tab;
  const queueArea = document.querySelector('.queue-area');
  const controlsBar = document.querySelector('.controls-bar');
  const momentsArea = document.getElementById('moments-area');

  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });

  if (tab === 'queue') {
    queueArea.style.display = '';
    controlsBar.style.display = '';
    momentsArea.style.display = 'none';
  } else {
    queueArea.style.display = 'none';
    controlsBar.style.display = 'none';
    momentsArea.style.display = '';
    refreshMomentsView();
  }
}

function refreshMomentsView() {
  const moments = getAllMoments();
  const track = state.currentIndex >= 0 ? state.queue[state.currentIndex] : null;
  const searchInput = document.getElementById('moments-search');
  renderMomentsTable(moments, {
    onRowClick: handleMomentRowClick,
    onNoteEdit: handleNoteEdit,
    onDelete: handleMomentDelete,
    currentTrackId: track?.track_id || null,
    searchQuery: searchInput?.value || '',
  });
}

function refreshTabCounts() {
  const moments = getAllMoments();
  updateTabCounts(state.queue.length, moments.length);
}

function handleMomentRowClick(moment) {
  // Find the track in the current queue
  const trackIndex = state.queue.findIndex((t) => t.track_id === moment.trackId);
  if (trackIndex < 0) {
    showBookmarkToastMessage('Set not in current queue');
    return;
  }
  playAtIndex(trackIndex, moment.timestampSec * 1000);
}

function handleNoteEdit(id, note) {
  updateMomentNote(id, note);
  refreshMomentsView();
}

function handleMomentDelete(id) {
  deleteMoment(id);
  refreshMomentsView();
  refreshTabCounts();
  // Also refresh ticks if currently playing
  if (state.currentIndex >= 0) {
    renderMomentTicks(state.queue[state.currentIndex].track_id);
  }
}

function showBookmarkToastMessage(message) {
  const container = document.getElementById('toast-container');
  container.innerHTML = '';
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `
    <span class="toast-text">${escapeHtml(message)}</span>
    <button class="toast-dismiss" aria-label="Dismiss">&times;</button>
  `;
  container.appendChild(toast);
  const timer = setTimeout(() => dismissToast(toast), 3000);
  toast.querySelector('.toast-dismiss').addEventListener('click', () => {
    clearTimeout(timer);
    dismissToast(toast);
  });
}

// ── Moments ────────────────────────────────────────────────

function formatTime(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  return h > 0
    ? `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
    : `${m}:${s.toString().padStart(2, '0')}`;
}

function handleBookmark() {
  if (state.currentIndex < 0 || state.currentIndex >= state.queue.length) return;
  const track = state.queue[state.currentIndex];
  const timestampSec = Math.floor(currentMs / 1000);
  const durationSec = Math.floor(totalMs / 1000);

  const moment = {
    id: crypto.randomUUID(),
    trackId: track.track_id,
    trackTitle: track.title,
    trackArtist: track.artist,
    trackPermalink: track.permalink_url,
    timestampSec,
    durationSec,
    note: '',
    createdAt: new Date().toISOString(),
  };

  saveMoment(moment);
  renderMomentTicks(track.track_id);
  pulseBookmarkBtn();
  showBookmarkToast(moment);
  refreshTabCounts();
  if (activeTab === 'moments') refreshMomentsView();
}

function pulseBookmarkBtn() {
  // Visual feedback moved to toast only (bookmark button removed from player bar)
}

function renderMomentTicks(trackId) {
  const bar = document.querySelector('.progress-bar');
  // Remove existing ticks
  bar.querySelectorAll('.progress-moment').forEach((el) => el.remove());

  const moments = getMomentsForTrack(trackId);
  if (moments.length === 0) {
    updateMomentsToggle(0);
    return;
  }

  // Get duration from the track's total
  const track = state.queue[state.currentIndex];
  const durSec = moments[0]?.durationSec || Math.floor(totalMs / 1000);
  if (durSec <= 0) return;

  moments.forEach((m, i) => {
    const pct = (m.timestampSec / durSec) * 100;
    const tick = document.createElement('div');
    tick.className = 'progress-moment';
    if (i === moments.length - 1) tick.classList.add('latest');
    tick.style.left = `${pct}%`;
    if (!momentsTicksVisible) tick.style.display = 'none';
    bar.appendChild(tick);
  });

  updateMomentsToggle(moments.length);
}

function updateMomentsToggle(count) {
  const toggle = document.getElementById('moments-toggle');
  const countEl = document.getElementById('moments-count');
  if (count > 0) {
    toggle.classList.add('visible');
    toggle.classList.toggle('active', momentsTicksVisible);
    countEl.textContent = count;
  } else {
    toggle.classList.remove('visible');
  }
}

function showBookmarkToast(moment) {
  const container = document.getElementById('toast-container');
  // Remove any existing toast
  container.innerHTML = '';

  const toast = document.createElement('div');
  toast.className = 'toast';
  const ts = formatTime(moment.timestampSec);

  toast.innerHTML = `
    <span class="toast-icon">&#10003;</span>
    <span class="toast-text">Moment saved at <strong>${ts}</strong></span>
    <button class="toast-action" data-moment-id="${moment.id}">+ Add note</button>
    <button class="toast-dismiss" aria-label="Dismiss">&times;</button>
  `;

  container.appendChild(toast);

  // Auto-dismiss after 4s
  let dismissTimer = setTimeout(() => dismissToast(toast), 4000);

  // Dismiss button
  toast.querySelector('.toast-dismiss').addEventListener('click', () => {
    clearTimeout(dismissTimer);
    dismissToast(toast);
  });

  // "+ Add note" → expand to inline input
  toast.querySelector('.toast-action').addEventListener('click', (e) => {
    clearTimeout(dismissTimer);
    const btn = e.currentTarget;
    const id = btn.dataset.momentId;
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'toast-note-input';
    input.placeholder = 'Type a note...';
    btn.replaceWith(input);
    input.focus();

    function saveNote() {
      const note = input.value.trim();
      if (note) {
        updateMomentNote(id, note);
        if (activeTab === 'moments') refreshMomentsView();
      }
      dismissToast(toast);
    }

    input.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter') saveNote();
      if (ev.key === 'Escape') dismissToast(toast);
    });
    input.addEventListener('blur', saveNote);
  });
}

function dismissToast(toast) {
  toast.classList.add('dismissing');
  setTimeout(() => toast.remove(), 200);
}

// ── Init ────────────────────────────────────────────────────

async function init() {
  // Player
  initPlayer({
    onFinish: playNext,
    onProgress: (ms, total) => {
      currentMs = ms;
      totalMs = total;
      updateProgress(ms, total);
      savePositionDebounced();
    },
    onPlayState: (playing) => {
      const playBtn = document.getElementById('btn-play');
      const playIcon = document.querySelector('#btn-play .btn-icon-play');
      const pauseIcon = document.querySelector('#btn-play .btn-icon-pause');
      if (playIcon) playIcon.style.display = playing ? 'none' : 'block';
      if (pauseIcon) pauseIcon.style.display = playing ? 'block' : 'none';
      if (playBtn) playBtn.setAttribute('aria-label', playing ? 'Pause' : 'Play');
    },
    onLoading: (isLoading) => {
      const playBtn = document.getElementById('btn-play');
      const progressBar = document.querySelector('.progress-bar');
      const totalTime = document.querySelector('.progress-total');

      if (isLoading) {
        playBtn.classList.add('loading');
        progressBar.classList.add('shimmer');
        totalTime.classList.add('resolving');
        totalTime.textContent = '--:--';
      } else {
        playBtn.classList.remove('loading');
        progressBar.classList.remove('shimmer');
        totalTime.classList.remove('resolving');
      }
    },
  });

  // Tab switching
  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // Group toggle (moments view)
  document.getElementById('group-toggle').addEventListener('click', (e) => {
    e.currentTarget.classList.toggle('active');
    document.getElementById('moments-area').classList.toggle('ungrouped');
  });

  // Moments search
  document.getElementById('moments-search').addEventListener('input', () => {
    if (activeTab === 'moments') refreshMomentsView();
  });

  // Stepper buttons
  document.querySelectorAll('.stepper-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const stepper = btn.closest('.stepper');
      const valueEl = stepper.querySelector('.stepper-value');
      const dir = parseInt(btn.dataset.dir);
      const min = stepper.dataset.target === 'feed-ratio' ? 0 : 1;
      const current = parseInt(valueEl.textContent) || 1;
      valueEl.textContent = Math.max(min, Math.min(10, current + dir));
    });
  });

  // Controls
  document.getElementById('btn-generate').addEventListener('click', (e) => handleGenerate(e.shiftKey));
  document.getElementById('btn-shuffle').addEventListener('click', handleShuffle);

  // Player bar buttons
  document.getElementById('btn-prev').addEventListener('click', playPrev);
  document.getElementById('btn-play').addEventListener('click', () => {
    // If no audio loaded but we have a current track, load it first
    if (!hasAudioSource() && state.currentIndex >= 0) {
      playAtIndex(state.currentIndex, state.resumePositionMs || 0);
      state.resumePositionMs = 0;
    } else {
      toggle();
    }
  });
  document.getElementById('btn-next').addEventListener('click', playNext);

  // Moments toggle: show/hide ticks on progress bar
  document.getElementById('moments-toggle').addEventListener('click', () => {
    momentsTicksVisible = !momentsTicksVisible;
    const ticks = document.querySelectorAll('.progress-moment');
    ticks.forEach(t => t.style.display = momentsTicksVisible ? '' : 'none');
    document.getElementById('moments-toggle').classList.toggle('active', momentsTicksVisible);
  });

  // Media Session (Global Media Controls in Chrome toolbar)
  if ('mediaSession' in navigator) {
    navigator.mediaSession.setActionHandler('play', () => {
      if (!hasAudioSource() && state.currentIndex >= 0) {
        playAtIndex(state.currentIndex, state.resumePositionMs || 0);
        state.resumePositionMs = 0;
      } else {
        toggle();
      }
    });
    navigator.mediaSession.setActionHandler('pause', () => toggle());
    navigator.mediaSession.setActionHandler('previoustrack', playPrev);
    navigator.mediaSession.setActionHandler('nexttrack', playNext);
  }

  // Progress bar seek
  const progressBar = document.querySelector('.progress-bar');
  progressBar.setAttribute('tabindex', '0');
  progressBar.addEventListener('click', (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const fraction = (e.clientX - rect.left) / rect.width;
    seekTo(Math.max(0, Math.min(1, fraction)));
  });
  progressBar.addEventListener('keydown', (e) => {
    const step = e.shiftKey ? 0.1 : 0.02;
    if (e.key === 'ArrowRight') { e.preventDefault(); seekTo(Math.min(1, parseFloat(progressBar.getAttribute('aria-valuenow') || 0) / 100 + step)); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); seekTo(Math.max(0, parseFloat(progressBar.getAttribute('aria-valuenow') || 0) / 100 - step)); }
  });

  // Progress bar hover tooltip
  const tooltip = document.getElementById('progress-tooltip');

  const SNAP_THRESHOLD = 0.02; // 2% of bar width to snap to a moment
  let tooltipLocked = false; // true when mouse is on the tooltip itself

  function getTotalSec() {
    const totalText = document.querySelector('.progress-total')?.textContent || '0:00';
    const parts = totalText.split(':').map(Number);
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    return 0;
  }

  progressBar.addEventListener('mousemove', (e) => {
    // Don't update tooltip while the user is interacting with it
    if (tooltipLocked) return;

    const rect = progressBar.getBoundingClientRect();
    const fraction = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const totalSec = getTotalSec();

    if (totalSec > 0) {
      const hoverSec = Math.floor(fraction * totalSec);

      // Check if near a moment tick
      let snapped = null;
      if (state.currentIndex >= 0) {
        const track = state.queue[state.currentIndex];
        const moments = getMomentsForTrack(track.track_id);
        for (const m of moments) {
          const mFrac = m.timestampSec / totalSec;
          if (Math.abs(fraction - mFrac) < SNAP_THRESHOLD) {
            snapped = m;
            break;
          }
        }
      }

      if (snapped) {
        const ts = formatTime(snapped.timestampSec);
        const noteHtml = snapped.note
          ? `<span class="tooltip-note" data-moment-id="${snapped.id}" data-note="${escapeHtml(snapped.note)}">${escapeHtml(snapped.note)}</span>`
          : `<span class="tooltip-note" data-moment-id="${snapped.id}" data-note=""><em>moment</em></span>`;
        tooltip.innerHTML = `<strong>${ts}</strong> &middot; ${noteHtml} <button class="tooltip-delete" data-moment-id="${snapped.id}" title="Delete moment">&times;</button>`;
        tooltip.classList.add('snapped');
        // Lock tooltip to the moment's position on the bar, not the cursor
        const snapPx = (snapped.timestampSec / totalSec) * rect.width;
        tooltip.style.left = snapPx + 'px';
        return; // don't reposition to cursor below
      } else {
        const hrs = Math.floor(hoverSec / 3600);
        const min = Math.floor((hoverSec % 3600) / 60);
        const sec = hoverSec % 60;
        tooltip.textContent = hrs > 0
          ? `${hrs}:${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`
          : `${min}:${sec.toString().padStart(2, '0')}`;
        tooltip.classList.remove('snapped');
      }
    } else {
      tooltip.textContent = '0:00';
      tooltip.classList.remove('snapped');
    }

    // Position tooltip at cursor X (non-snapped only)
    const rect2 = progressBar.getBoundingClientRect();
    tooltip.style.left = (e.clientX - rect2.left) + 'px';
  });

  // Keep tooltip visible and stable while mouse is on it
  tooltip.addEventListener('mouseenter', () => { tooltipLocked = true; });
  tooltip.addEventListener('mouseleave', () => {
    tooltipLocked = false;
    tooltip.classList.remove('snapped');
    tooltip.textContent = '';
  });

  // Tooltip clicks: always stop propagation so clicks never seek
  tooltip.addEventListener('click', (e) => {
    e.stopPropagation();

    // Delete button
    const deleteBtn = e.target.closest('.tooltip-delete');
    if (deleteBtn) {
      const id = deleteBtn.dataset.momentId;
      deleteMoment(id);
      if (state.currentIndex >= 0) {
        renderMomentTicks(state.queue[state.currentIndex].track_id);
      }
      refreshTabCounts();
      if (activeTab === 'moments') refreshMomentsView();
      tooltipLocked = false;
      tooltip.classList.remove('snapped');
      tooltip.textContent = '';
      return;
    }

    // Note editing: click the note text to edit inline
    const noteSpan = e.target.closest('.tooltip-note');
    if (noteSpan && !tooltip.querySelector('.tooltip-note-input')) {
      const momentId = noteSpan.dataset.momentId;
      const currentNote = noteSpan.dataset.note || '';
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'tooltip-note-input';
      input.value = currentNote;
      input.placeholder = 'Add a note...';
      noteSpan.textContent = '';
      noteSpan.appendChild(input);
      input.focus();

      function saveNote() {
        const note = input.value.trim();
        updateMomentNote(momentId, note);
        if (activeTab === 'moments') refreshMomentsView();
        // Re-render the tooltip with updated note
        const moments = getMomentsForTrack(state.queue[state.currentIndex]?.track_id);
        const m = moments.find(m => m.id === momentId);
        if (m) {
          const ts = formatTime(m.timestampSec);
          const noteHtml = note
            ? `<span class="tooltip-note" data-moment-id="${m.id}" data-note="${escapeHtml(note)}">${escapeHtml(note)}</span>`
            : `<span class="tooltip-note" data-moment-id="${m.id}" data-note=""><em>moment</em></span>`;
          tooltip.innerHTML = `<strong>${ts}</strong> &middot; ${noteHtml} <button class="tooltip-delete" data-moment-id="${m.id}" title="Delete moment">&times;</button>`;
        }
      }

      input.addEventListener('keydown', (ev) => {
        ev.stopPropagation(); // prevent B from bookmarking
        if (ev.key === 'Enter') saveNote();
        if (ev.key === 'Escape') saveNote(); // save whatever is there
      });
      input.addEventListener('blur', saveNote);
    }
  });

  // Hamburger menu
  const hamburgerBtn = document.getElementById('hamburger-btn');
  const menuDropdown = document.getElementById('menu-dropdown');

  function closeMenu() {
    menuDropdown.classList.remove('open');
    hamburgerBtn.classList.remove('active');
    hamburgerBtn.setAttribute('aria-expanded', 'false');
  }

  hamburgerBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = menuDropdown.classList.toggle('open');
    hamburgerBtn.classList.toggle('active');
    hamburgerBtn.setAttribute('aria-expanded', String(isOpen));
  });

  document.addEventListener('click', (e) => {
    if (!menuDropdown.contains(e.target) && !hamburgerBtn.contains(e.target)) {
      closeMenu();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeMenu();
      closeLikesModal();
    }
    // B key bookmarks a moment
    if (e.key === 'b' || e.key === 'B') {
      const tag = e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      e.preventDefault();
      handleBookmark();
    }
    // / key focuses moments search (when on moments tab)
    if (e.key === '/' && activeTab === 'moments') {
      const tag = e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      e.preventDefault();
      document.getElementById('moments-search')?.focus();
    }
  });

  // View likes data modal
  document.getElementById('menu-likes-data').addEventListener('click', () => {
    closeMenu();
    openLikesModal();
  });

  // Modal close button
  document.getElementById('likes-modal-close').addEventListener('click', closeLikesModal);

  // Modal copy button
  document.getElementById('likes-modal-copy').addEventListener('click', copyLikesData);

  // Modal backdrop click to close
  document.getElementById('likes-modal').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeLikesModal();
  });

  // Save position immediately when leaving the page
  window.addEventListener('beforeunload', () => {
    if (positionSaveTimer) clearTimeout(positionSaveTimer);
    saveState();
  });

  // Re-check auth when user tabs back (auto-detect login)
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) checkAuth();
  });

  // Load moments from storage (independent of queue)
  await loadMoments();

  // Check auth
  const auth = await checkAuth();
  const isAuthed = auth?.oauthToken && auth?.clientId;

  // Restore saved state or auto-generate
  // If saved queue has tracks without media_transcodings (from old format), discard it
  const saved = await loadSavedState();
  const savedValid = saved?.queue?.length > 0 && saved.queue[0].media_transcodings;
  if (savedValid) {
    state.queue = saved.queue;
    state.currentIndex = saved.currentIndex ?? -1;

    // Backfill liked/reposted/originalSource for queues saved before these fields existed
    const needsBackfill = state.queue.some((t) => t.liked === undefined);
    if (needsBackfill) {
      const repostIds = isAuthed ? await fetchRepostIds() : [];
      const repostSet = new Set(repostIds);
      for (const track of state.queue) {
        if (track.liked === undefined) track.liked = track.source === 'likes';
        if (track.reposted === undefined) track.reposted = repostSet.has(track.track_id);
        if (!track.originalSource) track.originalSource = track.source;
      }
      // Persist the backfilled fields
      saveState();
    }

    if (saved.settings) {
      document.getElementById('feed-ratio').textContent = saved.settings.feedRatio;
      document.getElementById('likes-ratio').textContent = saved.settings.likesRatio;
      document.getElementById('min-duration').value = saved.settings.minDuration;
    }

    if (isAuthed && state.currentIndex >= 0 && state.currentIndex < state.queue.length) {
      updatePlayerBar(state.queue[state.currentIndex]);
      renderMomentTicks(state.queue[state.currentIndex].track_id);
      // Show saved position in progress bar
      if (saved.positionMs > 0) {
        currentMs = saved.positionMs;
        const track = state.queue[state.currentIndex];
        const durMs = track.duration_ms || 0;
        if (durMs > 0) updateProgress(saved.positionMs, durMs);
      }
    }

    // Store saved position for resume on first play
    state.resumePositionMs = saved.positionMs || 0;

    render();
    refreshTabCounts();
  } else if (isAuthed) {
    handleGenerate();
  } else {
    refreshTabCounts();
  }
}

document.addEventListener('DOMContentLoaded', () => init());
