# Sift v0.5.0 - Release Notes

**Sift: SoundCloud, Tuned to You**

---

## Improvements

- **Instant playback on reopen.** When you open Sift, the current track's stream is silently primed in the background. Click play and audio starts immediately, no more "play, buffer, continue."
- **Cleaner loading state on track changes.** The play button spinner now stays on until audio actually plays, instead of flickering off the moment the manifest parses.
- **Update banner.** When a Sift update is downloaded by Chrome, the open Sift tab now shows a banner: "Sift updated to v{X}. Reload to apply." Click Reload to switch to the new version cleanly without losing in-progress edits.

## Data safety for moments

A multi-layer set of guards so future updates and features never silently lose your moments. None of these change how moments work day-to-day; they kick in when something goes wrong.

- **Validated reads.** If `scq-moments` storage ever returns something that isn't an array (corruption, transient IO error), Sift no longer silently overwrites it with an empty list. Writes are locked, a sticky red banner explains, and reload restores normal behavior.
- **Write-ahead backup.** Every save snapshots the previous moments to a backup key first. If primary storage goes bad, Sift restores from the backup automatically.
- **Pre-update snapshot.** When Chrome installs a new Sift version, the service worker snapshots all moments to a permanent versioned key (`scq-moments-pre-v{X}`) before the new code touches anything. Even a worst-case migration bug is recoverable.
- **Multi-tab sync.** If you have two Sift tabs open, edits in one now refresh the other automatically. Previously, the second tab could overwrite the first.
- **Serialized writes.** Rapid bookmarking, deleting, or note-editing no longer races. Every write completes in order.
- **Schema versioning.** Every moment is tagged with a schema version field, enabling safe migrations as the data shape evolves.
- **Surfaced failures.** Storage write failures now show a sticky red toast instead of silent console errors.
- **Schema fixture tests.** The test suite includes fixture moments at every historical schema version. New code must read them all without dropping a single field.

## Under the hood

- New `silent` parameter on the player's `loadTrack` for fire-and-forget preloads.
- Removed the eager `MANIFEST_PARSED` loading-UI hide, so the existing `playing`/`waiting` event handlers drive the spinner consistently.
- `chrome.runtime.onInstalled` and `chrome.runtime.onUpdateAvailable` listeners in the service worker handle update lifecycle.
- `chrome.storage.onChanged` listener keeps moment state synchronized across tabs.
- Extension version stamp written to storage on every init, enabling future migration logic to know what version it's upgrading from.
- New release packaging structure under `store/` (`listing/`, `releases/v{X}/`, `archive/`) plus a `utilities/build-release.mjs` build script and `store/upload-checklist.md` for repeatable Chrome Web Store uploads.

## Install

1. Download the `.zip` from GitHub Releases
2. Unzip to a folder
3. Go to `chrome://extensions` and enable Developer Mode
4. Click "Load unpacked" and select the `extension` folder
5. Visit soundcloud.com and log in
6. Click the Sift icon and generate your queue
