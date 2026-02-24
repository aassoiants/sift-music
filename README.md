# Sift: SoundCloud, Tuned to You

**Set your music free. Jump into a world where old SoundCloud favorites surprise you alongside new discoveries from your feed. Customizable, effortless, liberating.**

---

## The problem

You've liked hundreds — maybe thousands — of tracks on SoundCloud over the years. DJ sets, mixes, deep cuts. They're all still there, but SoundCloud doesn't do a great job letting you listen back through them. No shuffle across years. No way to weave old likes with your new feed. No duration filter. Your favorites from five years ago are pretty much gone.

Meanwhile, your feed keeps moving. New reposts, new releases. You can listen to one or the other, but never both in a single session that feels right.

## What this solves

Sift fetches your **complete like history** and your **current feed**, then builds a single queue that interleaves the two — with your likes spread evenly across every year you've been listening.

You control:
- **The mix ratio** — how many feed tracks for every X likes (e.g., "1 feed track for every 3 likes")
- **Minimum duration** — filter to only long-form content like DJ sets and mixes, or include everything
- **Shuffle** — re-randomize while keeping the year-spread balance

You end up with a queue where a 2012 deep cut sits next to yesterday's repost, followed by something from 2018 you completely forgot about.

## Features

- **Year-spread randomization** — round-robin across all years so old and recent likes are evenly represented
- **Configurable feed/likes ratio** — set exactly how many feed tracks per X likes
- **Duration filtering** — minimum track length in minutes
- **Built-in audio player** — HLS streaming directly in the extension, no SoundCloud tab needed
- **Queue persistence** — close the tab, come back later, queue and position are still there
- **Auto-recovery** — left it paused for hours? It re-resolves the stream and picks up where you stopped
- **Buffering indicators** — shimmer UI on network stalls so it doesn't feel broken
- **Global Media Controls** — track title and artist show in your browser's media panel, with play/pause/next/prev
- **Likes data modal** — stats on your full like history: total hours, duration breakdown, tracks by year, top genres, top artists
- **Logged-out detection** — clear overlay with instructions when you're not signed in, auto-detects when you log in
- **Singleton tab** — clicking the extension icon refocuses the existing Sift tab instead of opening duplicates
- **Accessible** — WCAG AA contrast, keyboard navigation for tracks and progress bar, aria labels, focus-visible outlines, 11px minimum font size

## Privacy

**Nothing leaves your browser.** No analytics, no tracking, no telemetry, no external servers.

The only network requests go to SoundCloud's own API to fetch your likes and feed. Auth uses your existing SoundCloud session cookie — the extension never sees your password. There are no accounts to create, no sign-ups, no third-party services involved. No usage data or personal information is recorded or sent anywhere.

Source is open. Read it.

## Download & Install

> **[Download the latest release](../../releases/latest)** — grab the `.zip` from the Releases page.

This is a Chrome extension distributed as a download (not on the Chrome Web Store). It works on any Chromium-based browser: Chrome, Brave, Edge, Arc, Vivaldi, etc.

### Step-by-step

1. **Download** the `.zip` from the [Releases page](../../releases/latest) (or clone this repo)
2. **Unzip** to a folder on your computer — remember where you put it
3. Open your browser and navigate to `chrome://extensions/`
4. Enable **Developer mode** (toggle in the top-right corner)
5. Click **Load unpacked**
6. Select the `extension/` folder inside the unzipped download
7. The extension icon should appear in your toolbar
8. Make sure you're **logged into [soundcloud.com](https://soundcloud.com)** in at least one tab
9. Click the extension icon — you're ready to go

### Usage tips

- **Generate Queue** fetches your data and builds the queue based on your ratio and duration settings
- Click any track in the queue to start playing
- **Shuffle** re-randomizes the order while preserving year-spread balance
- **Shift+Click Generate** to force-refresh data from SoundCloud (bypasses the 30-minute cache)
- The player bar at the bottom has prev/play/next and a seekable progress bar

## Disclaimer

Not affiliated with SoundCloud. This is an independent open-source tool that talks to SoundCloud's API using your own session. SoundCloud could change their API or terms whenever they want, which might break things. Use at your own risk.

---

# For Developers

If you want to fork this, contribute, or just poke around — here's how it all fits together.

## Tech stack

- **Chrome Extension Manifest V3** — full-tab UI, service worker background, content script auth relay
- **SoundCloud API v2** — direct fetch with OAuth, no unofficial libraries
- **hls.js** (light build, ~100KB) — bundled locally for HLS audio streaming, CSP-compliant
- **Vanilla JS** — no frameworks, no build step, no dependencies beyond hls.js

## Architecture

```
extension/
  manifest.json          MV3 manifest
  background.js          Service worker — auth relay (OAuth token from cookies, client_id from content script)
  content.js             MAIN world script — extracts client_id from SoundCloud's runtime config
  content-relay.js       ISOLATED world relay — bridges content.js ↔ background.js messaging
  app.html               Full-tab UI entry point
  css/styles.css         All styles (dark theme, loading states, player bar)
  js/
    app.js               State management, event wiring, loading overlay, persistence
    api.js               SoundCloud API v2 client — likes, feed, stream URL resolution, caching
    queue.js             Queue algorithm — filter, deduplicate, year-spread select, interleave
    player.js            Audio player — hls.js integration, buffering detection, stale stream recovery
    ui.js                DOM rendering — queue list, player bar, progress bar, tooltips
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

1. Fetch all likes + all feed items from SoundCloud API (paginated, cached for 30 minutes)
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
4. On fatal network errors (typically expired CDN URLs after long idle), captures the current playback position, re-resolves a fresh stream URL, and seeks back — with the same loading shimmer UI shown during initial track load
5. Listens for `waiting`/`playing` events on the audio element to show buffering indicators on any network stall

## Contributing

PRs welcome. No formal process — just open an issue or send a PR.

Some things that'd be nice to have:

- Volume control
- Keyboard shortcuts (play/pause, next, prev)
- Queue reordering via drag and drop
- Export/import queue as JSON
- Firefox support (WebExtension compatibility)
- Offline queue caching
- Better error handling when SC is down

## License

[MIT](LICENSE)
