// Queue generation algorithm

export function filterByDuration(tracks, minMinutes) {
  return tracks.filter(t => t.duration_min >= minMinutes);
}

export function deduplicateByUrl(tracks) {
  const seen = new Set();
  return tracks.filter(t => {
    if (seen.has(t.permalink_url)) return false;
    seen.add(t.permalink_url);
    return true;
  });
}

export function deduplicateFeed(feedTracks, likeTracks) {
  const likeUrls = new Set(likeTracks.map(t => t.permalink_url));
  return feedTracks.filter(t => !likeUrls.has(t.permalink_url));
}

function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function selectLikesSpread(filteredLikes, count) {
  // Group by upload year
  const byYear = {};
  filteredLikes.forEach(t => {
    const year = new Date(t.created_at).getFullYear();
    (byYear[year] = byYear[year] || []).push(t);
  });

  const years = Object.keys(byYear).sort();

  // Shuffle each year's bucket
  years.forEach(y => shuffleArray(byYear[y]));

  // Round-robin pick from each year
  const selected = [];
  let yearIdx = 0;
  while (selected.length < count && years.some(y => byYear[y].length > 0)) {
    const year = years[yearIdx % years.length];
    if (byYear[year].length > 0) {
      selected.push(byYear[year].pop());
    }
    yearIdx++;
  }

  return selected;
}

export function interleave(feedTracks, likesTracks, feedRatio, likesRatio) {
  const queue = [];
  let fi = 0, li = 0;

  while (fi < feedTracks.length || li < likesTracks.length) {
    // Add likesRatio tracks from likes
    for (let i = 0; i < likesRatio && li < likesTracks.length; i++) {
      queue.push({ ...likesTracks[li++], source: 'likes' });
    }
    // Add feedRatio tracks from feed
    for (let i = 0; i < feedRatio && fi < feedTracks.length; i++) {
      queue.push({ ...feedTracks[fi++], source: 'feed' });
    }
  }

  return queue;
}

export function generateQueue(allLikes, allFeed, { minDuration, feedRatio, likesRatio }) {
  // Filter by duration
  const longLikes = filterByDuration(allLikes, minDuration);
  let longFeed = filterByDuration(allFeed, minDuration);

  // Deduplicate feed (remove tracks already in likes, remove feed dupes)
  longFeed = deduplicateFeed(deduplicateByUrl(longFeed), longLikes);

  // Select ALL qualifying likes with year spread (use all of them)
  const selectedLikes = selectLikesSpread(longLikes, longLikes.length);

  // Shuffle feed too
  shuffleArray(longFeed);

  // Interleave — ratio controls the pattern, not total count
  return interleave(longFeed, selectedLikes, feedRatio, likesRatio);
}

export function shuffleQueue(queue, currentIndex) {
  const currentTrack = currentIndex >= 0 ? queue[currentIndex] : null;
  shuffleArray(queue);
  if (currentTrack) {
    const idx = queue.findIndex(t => t.permalink_url === currentTrack.permalink_url);
    if (idx >= 0) {
      queue.splice(idx, 1);
      queue.unshift(currentTrack);
    }
    return 0; // new currentIndex
  }
  return currentIndex;
}
