# Sift: SoundCloud, Tuned to You

**Your SoundCloud likes go back years. Sift digs them up, mixes them with your feed, and lets you bookmark the moments worth remembering.**

---

## The problem

You've liked hundreds, maybe thousands of tracks on SoundCloud over the years. Sets, mixes, deep cuts. They're all still there, but SoundCloud doesn't do a great job letting you listen back through them. No shuffle across years. No way to weave old likes with your new feed. No duration filter. Your favorites from five years ago are pretty much gone.

Meanwhile, your feed keeps moving. New reposts, new releases. You can listen to one or the other, but never both in a single session that feels right.

And when you're deep in a two-hour set and hear something incredible at the 47-minute mark, there's no way to save that moment. You either remember it or you don't.

## What this solves

Sift pulls your **complete like history** and your **current feed**, then builds a queue that mixes the two together. Likes are spread across every year you've been listening, so old stuff and new stuff sit side by side.

You control:
- **The mix ratio**: how many feed tracks for every X likes (e.g., "1 feed track for every 3 likes")
- **Minimum duration**: only long-form stuff like sets and mixes, or include everything
- **Shuffle**: re-randomize while keeping the year-spread balance

A 2012 deep cut next to yesterday's repost, then something from 2018 you completely forgot about.

When you hear something worth saving, press **B** to bookmark it. Sift saves the exact timestamp, groups your moments by set, and lets you jump back with one click. Add notes so you remember why you saved it.

## Features

### Queue
- **Year-spread**: likes are round-robined across all years so old and recent stuff is evenly mixed
- **Feed/likes ratio**: how many feed tracks for every X likes
- **Duration filter**: minimum track length in minutes
- **Like, unlike, repost**: right from the queue, no need to leave Sift
- **SoundCloud links**: open any track on soundcloud.com

### Moments
- Press **B** or tap the bookmark button to save the exact timestamp while listening
- Moments tab shows everything grouped by set, with mini-timelines, search, and note editing
- Click any moment to jump straight to that point
- Blue tick marks on the progress bar show where your moments are. Hover one to see the note, click to edit it, or delete it

### Player
- HLS streaming right in the extension, no SoundCloud tab needed
- Position saved every 5 seconds and on tab close, restored when you reopen
- Left it paused for hours? It re-resolves the stream and picks up where you stopped
- Shimmer on buffering so it doesn't feel broken
- Shows up in your browser's media controls with title, artist, play/pause/next/prev

### Everything else
- **Likes data**: stats on your full like history (total hours, duration breakdown, tracks by year, top genres, top artists)
- **Persistence**: close the tab, come back later, queue is still there
- **Logged-out detection**: tells you when you're not signed in, auto-detects when you log back in
- **One tab**: clicking the icon refocuses the existing Sift tab instead of opening a new one
- **Accessible**: AA contrast, keyboard nav, aria labels, focus outlines

## Privacy

**Nothing leaves your browser.** No analytics, no tracking, no servers.

The only network requests go to SoundCloud's own API to fetch your likes and feed. Auth uses your existing SoundCloud session cookie. Sift never sees your password. No accounts, no sign-ups, no third parties.

Code is open source, give it a read.

## Download & Install

> **[Download the latest release](../../releases/latest)** - grab the `.zip` from the Releases page.

Chrome extension. Works on any Chromium-based browser: Chrome, Brave, Edge, Arc, Vivaldi, etc.

### Step-by-step

1. **Download** the `.zip` from the [Releases page](../../releases/latest) (or clone this repo)
2. **Unzip** to a folder on your computer (remember where you put it)
3. Open your browser and navigate to `chrome://extensions/`
4. Enable **Developer mode** (toggle in the top-right corner)
5. Click **Load unpacked**
6. Select the `extension/` folder inside the unzipped download
7. The extension icon should appear in your toolbar
8. Make sure you're **logged into [soundcloud.com](https://soundcloud.com)** in at least one tab
9. Click the extension icon and you're ready to go

### Usage tips

- **Generate Queue** fetches your data and builds the queue based on your ratio and duration settings
- Click any track in the queue to start playing
- **Shuffle** re-randomizes the order while preserving year-spread balance
- **Shift+Click Generate** to force-refresh data from SoundCloud (clears the cache)
- The player bar at the bottom has prev/play/next and a seekable progress bar
- Press **B** during a set to bookmark the current moment
- Switch to the **Moments** tab to see all bookmarks, add notes, or click to jump back

## Disclaimer

Not affiliated with SoundCloud. This is an independent open-source tool that talks to SoundCloud's API using your own session. SoundCloud could change their API or terms whenever they want, which might break things. Use at your own risk.

---

# For Developers

If you want to fork this, contribute, or just poke around, here's how it all fits together.

## Tech stack

- **Chrome Extension Manifest V3**: full-tab UI, service worker background, content script auth relay
- **SoundCloud API v2**: direct fetch with OAuth, no unofficial libraries
- **hls.js** (light build, ~100KB): bundled locally for HLS audio streaming, CSP-compliant
- **Vanilla JS**: no frameworks, no build step, no dependencies beyond hls.js

## Architecture

```
extension/
  manifest.json          MV3 manifest
  background.js          Service worker, auth relay (OAuth token from cookies, client_id from content script)
  content.js             MAIN world script, extracts client_id from SoundCloud's runtime config
  content-relay.js       ISOLATED world relay, bridges content.js and background.js messaging
  app.html               Full-tab UI entry point
  css/styles.css         All styles (dark theme, loading states, player bar)
  js/
    app.js               State management, event wiring, loading overlay, persistence
    api.js               SoundCloud API v2 client (likes, feed, stream URL resolution, caching)
    queue.js             Queue algorithm (filter, deduplicate, year-spread select, interleave)
    player.js            Audio player (hls.js integration, buffering detection, stale stream recovery)
    moments.js           Moment CRUD (load, save, delete, update note, stored in chrome.storage.local)
    ui.js                DOM rendering (queue list, moments table, player bar, progress bar, tooltips)
  lib/
    hls.light.min.js     Bundled hls.js light build
  images/
    icon-*.png           Extension icons
```

### Auth flow

Piggybacks on your existing SoundCloud session. Never touches passwords or login flows.

1. `content.js` runs in SoundCloud's page context (MAIN world) and reads `client_id` from SC's runtime config
2. `content-relay.js` (ISOLATED world) relays it to the service worker via `chrome.runtime.sendMessage`
3. `background.js` reads the OAuth token from SoundCloud's cookies via `chrome.cookies`
4. All API calls to `api-v2.soundcloud.com` authenticate with both

### Queue algorithm

1. Fetch all likes + all feed items from SoundCloud API (paginated, cached until explicit refresh)
2. Filter both sets by minimum duration
3. Deduplicate feed (remove any track that already appears in likes)
4. Group likes by upload year → shuffle each year's bucket → round-robin select across all years
5. Shuffle feed
6. Interleave at the configured ratio (e.g., 3 likes then 1 feed, repeat)

### Stream playback

SoundCloud's `media.transcodings` array gives you API endpoints, not actual stream URLs. The player:

1. Selects the best transcoding (priority: HLS MP3 → HLS AAC → any HLS → progressive)
2. Resolves the actual CDN manifest URL by calling the transcoding endpoint with `client_id` + OAuth
3. Passes the manifest to hls.js, which handles segment fetching and `<audio>` playback
4. On fatal network errors (typically expired CDN URLs after long idle), captures the current playback position, re-resolves a fresh stream URL, and seeks back. Same loading shimmer UI as initial track load
5. Listens for `waiting`/`playing` events on the audio element to show buffering indicators on any network stall

## Contributing

PRs welcome. No formal process, just open an issue or send a PR.

Some things that'd be nice to have:

- Volume control
- Queue reordering via drag and drop
- Export/import queue or moments as JSON
- Firefox support (WebExtension compatibility)
- Offline queue caching
- Better error handling when SC is down
- BPM/key detection for sets (Essentia.js integration designed but not yet built)
- Exporting queue and moments
- Track identification within sets

## Acknowledgements

SoundCloud's API makes it possible for anyone to build around music. Sift wouldn't exist without it.

## License

[MIT](LICENSE)
