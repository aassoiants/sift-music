// Main app — state management and event wiring (Chrome Extension version)

import { fetchLikes, fetchFeed, clearCache } from './api.js';
import { generateQueue, shuffleQueue } from './queue.js';
import { renderQueue, updatePlayerBar, updateProgress, scrollToPlaying, escapeHtml } from './ui.js';
import { initPlayer, loadTrack, toggle, seekTo } from './player.js';

const STORAGE_KEY = 'scq-state';

const state = {
  allLikes: [],
  allFeed: [],
  queue: [],
  currentIndex: -1,
  isPlaying: false,
};

// ── Persistence (chrome.storage.local) ─────────────────────

function saveState() {
  const data = {
    queue: state.queue,
    currentIndex: state.currentIndex,
    settings: getSettings(),
  };
  chrome.storage.local.set({ [STORAGE_KEY]: data });
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
        if (queueArea) queueArea.classList.remove('dimmed');
        if (likesDataBtn) likesDataBtn.style.display = '';
        if (controlsBar) controlsBar.style.display = '';
        if (playerBar) playerBar.style.display = '';
      } else {
        if (loggedOutOverlay) loggedOutOverlay.style.display = 'flex';
        if (queueArea) queueArea.classList.remove('dimmed');
        if (likesDataBtn) likesDataBtn.style.display = 'none';
        if (controlsBar) controlsBar.style.display = 'none';
        if (playerBar) playerBar.style.display = 'none';
        // Reset player bar — no track info when logged out
        updatePlayerBar(null);
        updateProgress(0, 0);
      }
      resolve(auth);
    });
  });
}

// ── Settings ────────────────────────────────────────────────

function getSettings() {
  const feedRatio = parseInt(document.getElementById('feed-ratio').textContent) || 1;
  const likesRatio = parseInt(document.getElementById('likes-ratio').textContent) || 3;
  const minDuration = parseInt(document.getElementById('min-duration').value) || 30;
  return { feedRatio, likesRatio, minDuration };
}

// ── Rendering ───────────────────────────────────────────────

function render() {
  renderQueue(state.queue, state.currentIndex, {
    onTrackClick: playAtIndex,
    onRemove: removeTrack,
    onSkip: skipToAfter,
  });
}

// ── Playback ────────────────────────────────────────────────

function playAtIndex(index) {
  if (index < 0 || index >= state.queue.length) return;
  state.currentIndex = index;
  const track = state.queue[index];
  loadTrack(track); // async — resolves stream URL then plays
  updatePlayerBar(track);
  updateMediaSession(track);
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
      loadTrack(track); // async — resolves stream URL then plays
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

    if (playingTrack) {
      const newIdx = state.queue.findIndex((t) => t.permalink_url === playingTrack.permalink_url);
      if (newIdx >= 0) {
        state.currentIndex = newIdx;
      } else {
        state.currentIndex = -1;
      }
    } else {
      state.currentIndex = -1;
      updatePlayerBar(null);
      updateProgress(0, 0);
    }
    render();
    saveState();
  } catch (err) {
    if (err.message === 'NOT_AUTHENTICATED') {
      btn.textContent = 'Log into soundcloud.com first';
    } else if (err.message === 'AUTH_EXPIRED') {
      btn.textContent = 'Session expired — visit soundcloud.com';
      checkAuth();
    } else {
      console.error('Generate failed:', err);
      btn.textContent = 'Error — try again';
    }
    setTimeout(() => { btn.textContent = 'Generate Queue'; }, 3000);
  } finally {
    hideLoading();
    btn.disabled = false;
    btn.textContent = 'Generate Queue';
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

  // Horizontal bar chart — tracks by year released
  html += `<div class="lm-sec-title">Tracks by year released</div>
  <div class="lm-hbar-chart">
    ${s.yearData.map((y) => `<div class="lm-hbar-row">
      <span class="lm-hbar-year">${y.year}</span>
      <div class="lm-hbar-track"><div class="lm-hbar-fill" style="width:${y.barWidth}%"></div></div>
      <span class="lm-hbar-count">${y.count} (${fmtPct(y.pct)})</span>
    </div>`).join('')}
  </div>`;

  // Bottom — genres + artists
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

  if (state.allLikes.length === 0) {
    body.innerHTML = '<div class="likes-modal-empty">Generate a queue first to load your likes data.</div>';
  } else {
    const stats = computeLikesStats(state.allLikes);
    renderLikesModal(stats);
    // Store stats for copy button
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

// ── Init ────────────────────────────────────────────────────

async function init() {
  // Player
  initPlayer({
    onFinish: playNext,
    onProgress: (currentMs, totalMs) => {
      updateProgress(currentMs, totalMs);
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
  document.getElementById('btn-play').addEventListener('click', () => toggle());
  document.getElementById('btn-next').addEventListener('click', playNext);

  // Media Session (Global Media Controls in Chrome toolbar)
  if ('mediaSession' in navigator) {
    navigator.mediaSession.setActionHandler('play', () => toggle());
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

  progressBar.addEventListener('mousemove', (e) => {
    const rect = progressBar.getBoundingClientRect();
    const fraction = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    // Get current total duration from the progress-total time display
    const totalText = document.querySelector('.progress-total')?.textContent || '0:00';
    const parts = totalText.split(':').map(Number);
    let totalSec = 0;
    if (parts.length === 3) totalSec = parts[0] * 3600 + parts[1] * 60 + parts[2];
    else if (parts.length === 2) totalSec = parts[0] * 60 + parts[1];

    if (totalSec > 0) {
      const hoverSec = Math.floor(fraction * totalSec);
      const min = Math.floor(hoverSec / 60);
      const sec = hoverSec % 60;
      tooltip.textContent = `${min}:${sec.toString().padStart(2, '0')}`;
    } else {
      tooltip.textContent = '0:00';
    }

    // Position tooltip at cursor X
    const leftPx = e.clientX - rect.left;
    tooltip.style.left = leftPx + 'px';
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

  // Re-check auth when user tabs back (auto-detect login)
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) checkAuth();
  });

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

    if (saved.settings) {
      document.getElementById('feed-ratio').textContent = saved.settings.feedRatio;
      document.getElementById('likes-ratio').textContent = saved.settings.likesRatio;
      document.getElementById('min-duration').value = saved.settings.minDuration;
    }

    if (isAuthed && state.currentIndex >= 0 && state.currentIndex < state.queue.length) {
      updatePlayerBar(state.queue[state.currentIndex]);
    }

    render();
  } else if (isAuthed) {
    handleGenerate();
  }
}

document.addEventListener('DOMContentLoaded', () => init());
