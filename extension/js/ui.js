// DOM rendering

export function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function formatDate(isoString) {
  if (!isoString) return '\u2014';
  const d = new Date(isoString);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDuration(minutes) {
  if (minutes >= 60) {
    const h = Math.floor(minutes / 60);
    const m = Math.round(minutes % 60);
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }
  return `${Math.round(minutes)} min`;
}

function formatTime(ms) {
  const totalSec = Math.floor(ms / 1000);
  const hrs = Math.floor(totalSec / 3600);
  const min = Math.floor((totalSec % 3600) / 60);
  const sec = totalSec % 60;
  if (hrs > 0) {
    return `${hrs}:${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  }
  return `${min}:${sec.toString().padStart(2, '0')}`;
}

export function renderQueue(queue, currentIndex, { onTrackClick, onRemove, onSkip, onLike, onRepost }) {
  const container = document.querySelector('.queue-area');
  const header = container.querySelector('.queue-header');

  // Update stats
  const totalMinutes = queue.reduce((sum, t) => sum + t.duration_min, 0);
  const totalHours = (totalMinutes / 60).toFixed(1);
  header.querySelector('.queue-stats').textContent =
    queue.length > 0
      ? `${queue.length} tracks \u00B7 ~${totalHours} hrs total`
      : '';

  // Remove existing rows
  container.querySelectorAll('.track-row').forEach(el => el.remove());

  if (queue.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'queue-empty';
    empty.textContent = 'Click "Generate Queue" to build your queue';
    container.appendChild(empty);
    return;
  }

  // Remove empty message if present
  const emptyMsg = container.querySelector('.queue-empty');
  if (emptyMsg) emptyMsg.remove();

  // Render each track
  queue.forEach((track, i) => {
    const row = createTrackRow(track, i, i === currentIndex);
    row.addEventListener('click', (e) => {
      if (e.target.closest('.track-action-btn') || e.target.closest('.track-social-btn') || e.target.closest('.track-sc-link')) return;
      onTrackClick(i);
    });
    row.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onTrackClick(i);
      }
    });
    row.querySelector('[data-action="remove"]')?.addEventListener('click', () => onRemove(i));
    row.querySelector('[data-action="skip"]')?.addEventListener('click', () => onSkip(i));
    row.querySelector('[data-action="like"]')?.addEventListener('click', () => onLike(i));
    row.querySelector('[data-action="repost"]')?.addEventListener('click', () => onRepost(i));
    container.appendChild(row);
  });
}

function createTrackRow(track, index, isPlaying) {
  const row = document.createElement('div');
  row.className = 'track-row' + (isPlaying ? ' playing' : '');
  row.dataset.index = index;
  row.setAttribute('role', 'button');
  row.setAttribute('tabindex', '0');

  const dateStr = formatDate(track.created_at);
  const durationStr = formatDuration(track.duration_min);
  const sourceClass = track.source === 'feed' ? 'feed' : 'likes';
  const sourceLabel = track.source === 'feed' ? 'FEED' : 'LIKES';
  const genre = track.genre;
  const genreHtml = genre
    ? `<span class="track-genre">${escapeHtml(genre)}</span>`
    : `<span class="track-genre empty">\u2014</span>`;

  const likedClass = track.liked ? ' liked' : '';
  const repostedClass = track.reposted ? ' reposted' : '';
  const likeTitle = track.liked ? 'Liked' : 'Like';
  const repostTitle = track.reposted ? 'Reposted' : 'Repost';

  row.innerHTML = `
    <span class="track-num">${isPlaying ? '<span class="track-playing-icon">&#9654;</span>' : index + 1}</span>
    <a class="track-sc-link" href="${escapeHtml(track.permalink_url)}" target="_blank" rel="noopener" title="Open on SoundCloud" aria-label="Open on SoundCloud">
      <svg viewBox="0 0 16 16" width="12" height="12"><path d="M1 10V7a5 5 0 0 1 9.5-1.5A3 3 0 0 1 15 8.5V10H1z" fill="currentColor"/></svg>
    </a>
    <div class="track-info">
      <div class="track-title">${escapeHtml(track.title)}</div>
      <span class="track-artist">${escapeHtml(track.artist)}</span>
    </div>
    <div class="track-social">
      <button class="track-social-btn${likedClass}" data-action="like" title="${likeTitle}">
        <svg viewBox="0 0 16 16" width="14" height="14"><path class="icon-stroke" d="M8 14s-5.5-3.5-5.5-7A3 3 0 0 1 8 5a3 3 0 0 1 5.5 2c0 3.5-5.5 7-5.5 7z" stroke-width="1.5" stroke-linejoin="round" fill="none"/></svg>
      </button>
      <button class="track-social-btn${repostedClass}" data-action="repost" title="${repostTitle}">
        <svg viewBox="0 0 16 16" width="14" height="14"><path class="icon-fill" d="M2 10V5h8V3l4 3.5L10 10V8H4v2H2z"/></svg>
      </button>
    </div>
    <div class="track-meta">
      ${genreHtml}
      <span class="track-source ${sourceClass}">${sourceLabel}</span>
      <span class="track-date">${dateStr}</span>
      <span class="track-duration">${durationStr}</span>
    </div>
    <div class="track-actions">
      <button class="track-action-btn" data-action="skip" title="Skip">&#9197;</button>
      <button class="track-action-btn" data-action="remove" title="Remove">&times;</button>
    </div>
  `;

  return row;
}

export function updatePlayerBar(track) {
  const title = document.querySelector('.player-track-title');
  const artist = document.querySelector('.player-track-artist');
  const scLink = document.getElementById('player-sc-link');

  if (!track) {
    title.textContent = 'No track selected';
    artist.textContent = '';
    if (scLink) scLink.style.display = 'none';
    return;
  }

  title.textContent = track.title;
  if (scLink) {
    scLink.href = track.permalink_url;
    scLink.style.display = '';
  }

  const sourceTag = track.source === 'feed' ? 'FEED' : 'LIKES';
  const genre = track.genre || '';
  const date = formatDate(track.created_at);
  const parts = [escapeHtml(track.artist), `<span class="label-tag">${sourceTag}</span>`];
  if (genre) parts.push(escapeHtml(genre));
  parts.push(escapeHtml(date));
  artist.innerHTML = parts.join(' \u00B7 ');
}

export function updateProgress(currentMs, totalMs) {
  const fill = document.querySelector('.progress-fill');
  const times = document.querySelectorAll('.progress-time');

  const pct = totalMs > 0 ? (currentMs / totalMs) * 100 : 0;
  fill.style.width = pct + '%';
  document.querySelector('.progress-bar')?.setAttribute('aria-valuenow', Math.round(pct));

  if (times.length >= 2) {
    times[0].textContent = formatTime(currentMs);
    times[1].textContent = formatTime(totalMs);
  }
}

export function scrollToPlaying() {
  const playing = document.querySelector('.track-row.playing');
  if (playing) {
    playing.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

// ── Moments Table ──────────────────────────────────────────

function formatTimeSec(totalSec) {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = Math.floor(totalSec % 60);
  return h > 0
    ? `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
    : `${m}:${s.toString().padStart(2, '0')}`;
}

function formatDateShort(isoString) {
  if (!isoString) return '\u2014';
  const d = new Date(isoString);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// Persist column widths across re-renders
let savedColWidths = null;

export function renderMomentsTable(moments, { onRowClick, onNoteEdit, onDelete, currentTrackId, searchQuery }) {
  const wrap = document.getElementById('moments-table-wrap');

  // Save current column widths before destroying the table
  const oldTable = wrap.querySelector('.moments-table');
  if (oldTable) {
    const ths = oldTable.querySelectorAll('thead th');
    if (ths.length > 0) {
      savedColWidths = Array.from(ths).map(th => th.style.width || '');
    }
  }

  // Filter by search
  let filtered = moments;
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    filtered = moments.filter((m) =>
      m.trackTitle.toLowerCase().includes(q) ||
      m.trackArtist.toLowerCase().includes(q) ||
      (m.note || '').toLowerCase().includes(q)
    );
  }

  // Update filter count
  const countEl = document.getElementById('filter-count');
  if (countEl) {
    countEl.textContent = searchQuery
      ? `Showing ${filtered.length} of ${moments.length}`
      : `${moments.length} moments`;
  }

  // Empty state
  if (filtered.length === 0) {
    wrap.innerHTML = moments.length === 0
      ? `<div class="moments-empty">
          <div class="moments-empty-icon">&#128278;</div>
          No moments yet.<br>
          Play a set and press <kbd>B</kbd> to bookmark a moment.
        </div>`
      : `<div class="moments-empty">No moments match your search.</div>`;
    return;
  }

  // Group by trackId
  const groups = new Map();
  for (const m of filtered) {
    if (!groups.has(m.trackId)) {
      groups.set(m.trackId, {
        trackId: m.trackId,
        title: m.trackTitle,
        artist: m.trackArtist,
        durationSec: m.durationSec,
        moments: [],
      });
    }
    groups.get(m.trackId).moments.push(m);
  }

  // Sort moments within each group by timestamp
  for (const g of groups.values()) {
    g.moments.sort((a, b) => a.timestampSec - b.timestampSec);
  }

  // Build table
  let html = `<table class="moments-table">
    <thead><tr>
      <th class="col-set">Set<div class="th-resize" data-col="0"></div></th>
      <th class="col-account">Account<div class="th-resize" data-col="1"></div></th>
      <th class="col-at">At<div class="th-resize" data-col="2"></div></th>
      <th class="col-note">Note<div class="th-resize" data-col="3"></div></th>
      <th class="col-added sorted">Added &#9660;</th>
      <th style="width:32px"></th>
    </tr></thead>
    <tbody>`;

  for (const g of groups.values()) {
    const durStr = g.durationSec > 0 ? formatTimeSec(g.durationSec) : '';

    // Group header row
    html += `<tr class="group-row"><td colspan="6"><div class="group-inner">`;
    html += `<div class="group-left">`;
    html += `<span class="group-title">${escapeHtml(g.title)}</span>`;
    html += `<span class="group-dj">&mdash; ${escapeHtml(g.artist)}</span>`;
    html += `</div>`;
    html += `<div class="group-right">`;

    // Mini timeline
    if (g.durationSec > 0) {
      html += `<div class="group-timeline">`;
      for (const m of g.moments) {
        const pct = (m.timestampSec / g.durationSec) * 100;
        html += `<div class="gt-tick" style="left:${pct.toFixed(1)}%"></div>`;
      }
      html += `</div>`;
      html += `<span class="group-dur">${durStr}</span>`;
    }

    html += `<span class="moment-ct">${g.moments.length} moment${g.moments.length !== 1 ? 's' : ''}</span>`;
    html += `</div>`;
    html += `</div></td></tr>`;

    // Moment rows
    for (const m of g.moments) {
      const isActive = m.trackId === currentTrackId;
      html += `<tr data-moment-id="${m.id}" data-track-id="${m.trackId}" data-ts="${m.timestampSec}"${isActive ? ' class="active"' : ''}>`;
      html += `<td class="td-set">${escapeHtml(g.title)}</td>`;
      html += `<td class="td-account">${escapeHtml(g.artist)}</td>`;
      html += `<td class="td-at">${formatTimeSec(m.timestampSec)}</td>`;
      html += `<td class="td-note${m.note ? '' : ' empty'}" data-moment-id="${m.id}">${m.note ? escapeHtml(m.note) : '&mdash;'}</td>`;
      html += `<td class="td-added">${formatDateShort(m.createdAt)}</td>`;
      html += `<td class="td-actions"><button class="moment-delete-btn" data-moment-id="${m.id}" title="Delete moment">&times;</button></td>`;
      html += `</tr>`;
    }
  }

  html += `</tbody></table>`;
  wrap.innerHTML = html;

  // Wire events
  const table = wrap.querySelector('.moments-table');

  // Restore saved column widths
  if (savedColWidths) {
    const ths = table.querySelectorAll('thead th');
    savedColWidths.forEach((w, i) => {
      if (w && ths[i]) ths[i].style.width = w;
    });
  }

  // Column resize handles
  table.querySelectorAll('.th-resize').forEach((handle) => {
    handle.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const th = handle.parentElement;
      const startX = e.clientX;
      const startW = th.offsetWidth;
      handle.classList.add('dragging');

      function onMove(ev) {
        const newW = Math.max(60, startW + ev.clientX - startX);
        th.style.width = newW + 'px';
      }
      function onUp() {
        handle.classList.remove('dragging');
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      }
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });
  });

  // Row click → jump to position
  table.querySelectorAll('tbody tr:not(.group-row)').forEach((row) => {
    row.addEventListener('click', (e) => {
      if (e.target.closest('.moment-delete-btn') || e.target.closest('.td-note') || e.target.closest('.td-note-input')) return;
      const momentId = row.dataset.momentId;
      const m = filtered.find((m) => m.id === momentId);
      if (m) onRowClick(m);
    });
  });

  // Note cell click → inline edit
  table.querySelectorAll('.td-note').forEach((cell) => {
    cell.addEventListener('click', (e) => {
      if (cell.querySelector('.td-note-input')) return; // already editing
      const id = cell.dataset.momentId;
      const m = filtered.find((m) => m.id === id);
      if (!m) return;

      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'td-note-input';
      input.value = m.note || '';
      input.placeholder = 'Add a note...';
      cell.textContent = '';
      cell.classList.remove('empty');
      cell.appendChild(input);
      input.focus();

      function save() {
        const note = input.value.trim();
        onNoteEdit(id, note);
      }

      input.addEventListener('keydown', (ev) => {
        ev.stopPropagation(); // prevent B key from triggering bookmark
        if (ev.key === 'Enter') { save(); }
        if (ev.key === 'Escape') {
          // Restore original without saving
          cell.textContent = m.note || '\u2014';
          if (!m.note) cell.classList.add('empty');
        }
      });
      input.addEventListener('blur', save);
    });
  });

  // Delete button
  table.querySelectorAll('.moment-delete-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      onDelete(btn.dataset.momentId);
    });
  });
}

export function updateTabCounts(queueCount, momentsCount) {
  const qEl = document.getElementById('tab-queue-count');
  const mEl = document.getElementById('tab-moments-count');
  if (qEl) qEl.textContent = queueCount > 0 ? queueCount : '';
  if (mEl) mEl.textContent = momentsCount > 0 ? momentsCount : '';
}
