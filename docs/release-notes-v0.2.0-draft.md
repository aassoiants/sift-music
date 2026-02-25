# Release Notes — v0.2.0 (DRAFT)

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

## Bug fixes

- **Fixed stuck loading spinner**: After reloading the extension, the play button could get stuck spinning. The error handler now clears the loading state properly.
- **Fixed phantom loading on empty player**: The `waiting` event no longer triggers the spinner when no track is loaded.
