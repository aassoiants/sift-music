# Sift v0.4.0 - Release Notes

**Sift: SoundCloud, Tuned to You**

---

## New features

- **Moments**: Press **B** to bookmark a moment while listening. Saves the exact timestamp so you can find it later.
- **Moments tab**: All your moments grouped by set, with mini-timelines, search, and note editing. Click any moment to jump to that point. Resizable columns.
- **Progress bar ticks**: Blue marks show your moments on the progress bar. Hover a tick to see the note, click the note to edit it inline, or delete the moment right there.
- **Moments toggle**: The moments button on the player bar toggles tick visibility on/off.
- **Resume playback**: Position saved every 5s and on tab close, restored when you reopen Sift.
- **SoundCloud link in player bar**: SC icon next to the track title opens it on soundcloud.com. Also on each track row in the queue.
- **Repost controls**: Repost and un-repost tracks right from the queue.
- **Likes data modal**: Now works after a shuffle too (falls back to queue data if full likes aren't cached).

## Improvements

- Moments table has Set, Account, At, and Note columns with draggable resize handles. Widths persist across edits.
- Clicking a note cell in the moments table opens inline editing without jumping to that position.
- Tab counts on Queue and Moments tabs.
- Pagination URLs validated against expected API origin before fetching.
- `postMessage` target origin tightened from `'*'` to `location.origin`.
- Removed unused exports, internalized private helper functions.
- Version header added to bundled hls.js.
- Stream URLs no longer logged to console.

## Install

1. Download the `.zip` from GitHub Releases
2. Unzip to a folder
3. Go to `chrome://extensions` and enable Developer Mode
4. Click "Load unpacked" and select the `extension` folder
5. Visit soundcloud.com and log in
6. Click the Sift icon and generate your queue
