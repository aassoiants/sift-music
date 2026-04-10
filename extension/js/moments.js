// Moments - bookmark timestamps in sets (persisted independently of queue)

const MOMENTS_KEY = 'scq-moments';

let moments = [];

export async function loadMoments() {
  const result = await chrome.storage.local.get(MOMENTS_KEY);
  moments = result[MOMENTS_KEY] || [];
  return moments;
}

function persist() {
  chrome.storage.local.set({ [MOMENTS_KEY]: moments }).catch((err) => {
    console.error('[Sift] Failed to save moments:', err);
  });
}

export function saveMoment(moment) {
  moments.push(moment);
  persist();
}

export function getMomentsForTrack(trackId) {
  return moments.filter((m) => m.trackId === trackId);
}

export function getAllMoments() {
  return moments;
}

export function deleteMoment(id) {
  moments = moments.filter((m) => m.id !== id);
  persist();
}

export function updateMomentNote(id, note) {
  const m = moments.find((m) => m.id === id);
  if (m) {
    m.note = note;
    persist();
  }
}
