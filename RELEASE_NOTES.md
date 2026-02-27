# Sift v0.2.0 — Release Notes

**Sift: SoundCloud, Tuned to You**

---

## What's new

### No-SoundCloud-tab overlay
When Sift detects there's no SoundCloud tab open, it shows an overlay explaining what's needed. The overlay goes away on its own when you open a SoundCloud tab. Won't interrupt active playback.

### Durable cache
Liked tracks and feed data now persist across sessions instead of expiring after 30 minutes. Cache only clears when you explicitly Shift+Click the Generate button. This means Sift loads instantly on return visits.

### Restored track state
When you reopen Sift, the last track you were on is still shown in the player bar. Clicking play loads and plays it automatically (audio can't persist across sessions, but the track info and queue position do).

### Playing track stays at top on regenerate
When you hit Generate Queue while a track is playing, the playing track moves to position 1 in the new queue. Playback continues uninterrupted and the queue scrolls to the top.

### Dropped `tabs` permission
Removed the `tabs` permission entirely. Duplicate-tab prevention now uses message passing between the service worker and the app page, so no broad browser access is needed. Also removes the "Read your browsing history" install warning.

### Hours in time display
Elapsed, total, and seek tooltip now show `h:mm:ss` for tracks over 60 minutes. Previously showed raw minutes (e.g., `72:05` instead of `1:12:05`).

## Bug fixes

- **Fixed stuck loading spinner**: After reloading the extension, the play button could get stuck spinning. The error handler now clears the loading state properly.
- **Fixed phantom loading on empty player**: The `waiting` event no longer triggers the spinner when no track is loaded.
- **Fixed error messages getting swallowed**: The Generate button's error text ("Log in first", "Session expired", "Error") was immediately overwritten by a `finally` block. Errors now stay visible for 3 seconds.
- **Fixed feed ratio 0 silently becoming 1**: Setting the feed ratio to 0 (likes only, no feed tracks) now works correctly. `parseInt(0) || 1` was treating 0 as falsy.
- **Fixed shuffle on restored queues**: Shuffle could lose track of the current track after restoring from storage, because deserialized objects have new references. Now matches by permalink URL instead of object identity.
- **Fixed stale audio source after HLS cleanup**: After destroying an HLS stream, the play button could silently fail because `audio.src` still held a dead blob URL. Source is now properly cleared.
- **Fixed race condition on rapid track clicks**: Quickly clicking multiple tracks no longer causes overlapping audio loads. A generation counter cancels stale loads.
- **Fixed undefined artist name**: Tracks without a `user.username` field now show "Unknown" instead of the literal text "undefined".
- **Removed non-functional drag handle**: The grip icon on each track row implied drag-to-reorder but did nothing. Removed.
- **Fixed no-SC-tab overlay wording**: No longer claims Sift "can't play" without a SoundCloud tab (it can, if the queue is already loaded).

## Security

- **Validated client_id format**: The content relay script now validates that the SoundCloud client_id matches an expected alphanumeric format before storing it, preventing injection via `postMessage`.

## Install

1. Download the `.zip` from GitHub Releases
2. Unzip to a folder
3. Go to `chrome://extensions` and enable Developer Mode
4. Click "Load unpacked" and select the `extension` folder
5. Visit soundcloud.com and log in
6. Click the Sift icon and generate your queue
