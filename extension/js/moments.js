// Moments - bookmark timestamps in sets (persisted independently of queue)
//
// Durability rules (see docs/decisions/002-moments-durability.md):
// - Validate shape on read; treat null/wrong-type as corruption (don't wipe)
// - Write-ahead backup to scq-moments-prev before every persist
// - Surface persist failures via the onError callback
// - Serialize all writes via writeChain to prevent races
// - Schema-version every moment with _v
// - Optimistic in-memory update for UI; storage write is queued

const MOMENTS_KEY = 'scq-moments';
const MOMENTS_BACKUP_KEY = 'scq-moments-prev';
const SCHEMA_VERSION = 1;

let moments = [];
let storageHealthy = true;
let onErrorCallback = null;
let onExternalChangeCallback = null;
let writeChain = Promise.resolve();

export function initMoments({ onError, onExternalChange } = {}) {
  onErrorCallback = onError || null;
  onExternalChangeCallback = onExternalChange || null;

  // Multi-tab sync: when another Sift tab writes scq-moments, refresh our copy.
  // Listener also fires for our own writes; setting moments to the same value is
  // idempotent and the re-render is cheap.
  // See docs/decisions/003-extension-update-safety.md mitigation #5.
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (!changes[MOMENTS_KEY]) return;
    const newValue = changes[MOMENTS_KEY].newValue;
    if (isValidMomentArray(newValue)) {
      moments = newValue;
      if (onExternalChangeCallback) onExternalChangeCallback();
    }
  });
}

// Returns the current write chain so callers can await pending persists
// (e.g., before triggering a tab reload to apply an extension update).
export function flushPendingWrites() {
  return writeChain;
}

function reportError(msg) {
  console.error('[Sift moments]', msg);
  if (onErrorCallback) onErrorCallback(msg);
}

function isValidMomentArray(value) {
  return Array.isArray(value);
}

function ensureSchema(moment) {
  if (moment._v === undefined) moment._v = SCHEMA_VERSION;
  return moment;
}

export async function loadMoments() {
  let result;
  try {
    result = await chrome.storage.local.get([MOMENTS_KEY, MOMENTS_BACKUP_KEY]);
  } catch (err) {
    storageHealthy = false;
    moments = [];
    reportError(`Could not read moments storage: ${err.message}. No saves until reload.`);
    return moments;
  }

  const main = result[MOMENTS_KEY];
  const backup = result[MOMENTS_BACKUP_KEY];

  // First run: nothing to load
  if (main === undefined && backup === undefined) {
    moments = [];
    return moments;
  }

  // Normal: main is a valid array
  if (isValidMomentArray(main)) {
    moments = main;
    return moments;
  }

  // Main is corrupt or missing, backup is valid: restore from backup, lock writes
  if (isValidMomentArray(backup)) {
    moments = backup;
    storageHealthy = false;
    reportError(`Moments storage was unreadable. Restored ${backup.length} moments from backup. No new saves until you reload Sift.`);
    return moments;
  }

  // Both corrupt: don't trust anything, refuse to write
  storageHealthy = false;
  moments = [];
  reportError(`Moments storage is corrupted in both primary and backup. No saves until reload. Your data may still be recoverable in chrome.storage.local.`);
  return moments;
}

async function persistToStorage(nextMoments) {
  // Snapshot what's currently in main BEFORE overwriting it
  const current = await chrome.storage.local.get(MOMENTS_KEY);
  if (isValidMomentArray(current[MOMENTS_KEY])) {
    await chrome.storage.local.set({ [MOMENTS_BACKUP_KEY]: current[MOMENTS_KEY] });
  }
  await chrome.storage.local.set({ [MOMENTS_KEY]: nextMoments });
}

function enqueueWrite(updater) {
  if (!storageHealthy) {
    reportError('Refusing to write moments: storage is in a bad state. Reload Sift.');
    return Promise.resolve(false);
  }

  const next = updater(moments);
  if (next === null) return Promise.resolve(false);

  moments = next; // optimistic in-memory update keeps UI responsive
  writeChain = writeChain
    .then(() => persistToStorage(next))
    .then(() => true)
    .catch((err) => {
      reportError(`Failed to save moments: ${err.message}. Try the action again or reload Sift.`);
      return false;
    });
  return writeChain;
}

export function saveMoment(moment) {
  ensureSchema(moment);
  return enqueueWrite((current) => [...current, moment]);
}

export function deleteMoment(id) {
  return enqueueWrite((current) => {
    const next = current.filter((m) => m.id !== id);
    return next.length === current.length ? null : next;
  });
}

export function updateMomentNote(id, note) {
  return enqueueWrite((current) => {
    const idx = current.findIndex((m) => m.id === id);
    if (idx === -1) return null;
    const next = [...current];
    next[idx] = ensureSchema({ ...next[idx], note });
    return next;
  });
}

export function getMomentsForTrack(trackId) {
  return moments.filter((m) => m.trackId === trackId);
}

export function getAllMoments() {
  return moments;
}
