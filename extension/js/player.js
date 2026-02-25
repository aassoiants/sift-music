// SoundCloud audio player — hls.js + <audio> directly in the app tab
// No offscreen document, no messaging — just direct playback

import { getStreamUrl } from './api.js';

let audio = null;
let hls = null;
let onFinishCallback = null;
let onProgressCallback = null;
let onPlayStateCallback = null;
let onLoadingCallback = null;
let currentTrack = null;       // track object for stream re-resolution
let recoveryAttempts = 0;      // prevent infinite recovery loops
const MAX_RECOVERY_ATTEMPTS = 2;

export function initPlayer({ onFinish, onProgress, onPlayState, onLoading }) {
  onFinishCallback = onFinish;
  onProgressCallback = onProgress;
  onPlayStateCallback = onPlayState;
  onLoadingCallback = onLoading;

  // Create a persistent <audio> element
  audio = document.createElement('audio');
  audio.id = 'scq-audio-player';
  document.body.appendChild(audio);

  // Bind native audio events directly — no messaging needed
  audio.addEventListener('timeupdate', () => {
    if (audio.duration && !isNaN(audio.duration) && onProgressCallback) {
      onProgressCallback(audio.currentTime * 1000, audio.duration * 1000);
    }
  });

  audio.addEventListener('play', () => {
    if (onPlayStateCallback) onPlayStateCallback(true);
  });

  audio.addEventListener('pause', () => {
    if (onPlayStateCallback) onPlayStateCallback(false);
  });

  // Buffering: show shimmer when audio stalls mid-playback (wifi drop, slow network, etc.)
  audio.addEventListener('waiting', () => {
    if (audio.src && onLoadingCallback) onLoadingCallback(true);
  });

  audio.addEventListener('playing', () => {
    if (onLoadingCallback) onLoadingCallback(false);
  });

  audio.addEventListener('ended', () => {
    console.log('[SCQ player] Track ended');
    if (onPlayStateCallback) onPlayStateCallback(false);
    if (onFinishCallback) onFinishCallback();
  });

  audio.addEventListener('error', (e) => {
    console.error('[SCQ player] Audio error:', audio.error?.message || e);
    if (onLoadingCallback) onLoadingCallback(false);
    if (onPlayStateCallback) onPlayStateCallback(false);
  });
}

export async function loadTrack(track, autoPlay = true) {
  console.log('[SCQ player] loadTrack:', track.title);
  currentTrack = track;
  recoveryAttempts = 0;
  if (onLoadingCallback) onLoadingCallback(true);

  await _loadStream(track, autoPlay);
}

/**
 * Internal: resolve stream URL and wire up hls.js / progressive playback.
 * Called by loadTrack() on first load, and by _recoverStream() on stale-URL retry.
 * @param {number|null} resumeAt — seconds to seek to after manifest loads (recovery only)
 */
async function _loadStream(track, autoPlay = true, resumeAt = null) {
  try {
    const stream = await getStreamUrl(track);
    console.log('[SCQ player] Stream resolved:', stream.protocol, stream.url.substring(0, 80));

    // Clean up previous HLS instance
    if (hls) {
      hls.destroy();
      hls = null;
    }

    if (stream.protocol === 'hls' && window.Hls && Hls.isSupported()) {
      // HLS stream — use hls.js
      hls = new Hls({
        debug: false,
        enableWorker: true,
        maxBufferLength: 30,
        maxMaxBufferLength: 60,
      });

      hls.on(Hls.Events.ERROR, (event, data) => {
        console.error('[SCQ player] HLS error:', data.type, data.details);
        if (data.fatal) {
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
            // Likely expired CDN URL — attempt stream re-resolution
            _recoverStream();
          } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
            hls.recoverMediaError();
          } else {
            console.error('[SCQ player] Fatal HLS error, skipping track');
            if (onLoadingCallback) onLoadingCallback(false);
            if (onFinishCallback) onFinishCallback();
          }
        }
      });

      hls.loadSource(stream.url);
      hls.attachMedia(audio);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        console.log('[SCQ player] HLS manifest parsed');
        if (onLoadingCallback) onLoadingCallback(false);

        // Restore position if recovering from stale URL
        if (resumeAt != null && resumeAt > 0) {
          audio.currentTime = resumeAt;
          console.log('[SCQ player] Resumed at', Math.round(resumeAt), 's');
        }

        if (autoPlay) {
          audio.play().catch((e) => {
            console.error('[SCQ player] Autoplay blocked:', e.message);
          });
        }
      });

    } else if (stream.protocol === 'progressive') {
      // Progressive MP3 — direct URL
      if (onLoadingCallback) onLoadingCallback(false);
      audio.src = stream.url;

      if (resumeAt != null && resumeAt > 0) {
        audio.addEventListener('loadedmetadata', () => {
          audio.currentTime = resumeAt;
        }, { once: true });
      }

      if (autoPlay) {
        audio.play().catch((e) => {
          console.error('[SCQ player] Autoplay blocked:', e.message);
        });
      }
    } else {
      console.error('[SCQ player] No supported playback method');
      if (onLoadingCallback) onLoadingCallback(false);
      if (onFinishCallback) onFinishCallback();
    }
  } catch (err) {
    console.error('[SCQ player] Failed to resolve stream URL:', err.message);
    if (onLoadingCallback) onLoadingCallback(false);
    if (onFinishCallback) onFinishCallback();
  }
}

/**
 * Recover from a stale/expired HLS stream URL.
 * Shows loading UI, re-resolves stream, and resumes at the same position.
 */
async function _recoverStream() {
  recoveryAttempts++;

  if (recoveryAttempts > MAX_RECOVERY_ATTEMPTS || !currentTrack) {
    console.error('[SCQ player] Stream recovery failed after', recoveryAttempts, 'attempts, skipping');
    if (onLoadingCallback) onLoadingCallback(false);
    if (onFinishCallback) onFinishCallback();
    return;
  }

  const resumeAt = audio?.currentTime || 0;
  console.log('[SCQ player] Recovering stale stream (attempt', recoveryAttempts + '/' + MAX_RECOVERY_ATTEMPTS + '), resuming at', Math.round(resumeAt), 's');

  // Show the same loading UI as initial track load
  if (onLoadingCallback) onLoadingCallback(true);

  await _loadStream(currentTrack, true, resumeAt);
}

export function play() {
  if (audio) audio.play().catch(() => {});
}

export function pause() {
  if (audio) audio.pause();
}

export function toggle() {
  if (!audio) return;
  if (audio.paused) audio.play().catch(() => {});
  else audio.pause();
}

export function seekTo(fraction) {
  if (audio && audio.duration && !isNaN(audio.duration)) {
    audio.currentTime = audio.duration * fraction;
  }
}

export function hasAudioSource() {
  return audio && !!audio.src;
}
