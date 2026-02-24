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
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, '0')}`;
}

export function renderQueue(queue, currentIndex, { onTrackClick, onRemove, onSkip }) {
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
      if (e.target.closest('.track-action-btn') || e.target.closest('.drag-handle')) return;
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

  row.innerHTML = `
    <span class="track-num">${isPlaying ? '<span class="track-playing-icon">&#9654;</span>' : index + 1}</span>
    <span class="drag-handle">&#8942;&#8942;</span>
    <div class="track-info">
      <div class="track-title">${escapeHtml(track.title)}</div>
      <span class="track-artist">${escapeHtml(track.artist)}</span>
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

  if (!track) {
    title.textContent = 'No track selected';
    artist.textContent = '';
    return;
  }

  title.textContent = track.title;

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
