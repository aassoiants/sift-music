# Chrome Web Store Listing — Sift

## Name
Sift: SoundCloud, Tuned to You

## Short description (132 char max)
Build personalized queues that mix your SoundCloud likes across every year with your feed. Built-in player, no accounts, all local.

(129 characters)

## Detailed description

You've liked hundreds — maybe thousands — of tracks on SoundCloud over the years. DJ sets, mixes, deep cuts. They're all still there, but there's no good way to listen back through them. No shuffle across years. No way to mix old likes with your current feed.

Sift fixes that.

It fetches your full like history and your feed, then builds a single queue that weaves the two together — with your likes spread evenly across every year you've been listening. A 2012 deep cut next to yesterday's repost, followed by something from 2018 you forgot about.

You control the mix:
- How many feed tracks for every X likes
- Minimum duration (filter to long-form DJ sets or include everything)
- Shuffle while keeping the year-spread balance

Built-in player with HLS streaming — no SoundCloud tab needed. Queue and playback position persist across sessions. Shows up in your browser's media controls with title, artist, and play/pause/next/prev.

Likes Data modal shows stats on your full history: total hours, duration breakdown, tracks by year, top genres, top artists.

Everything runs locally in your browser. No servers, no accounts, no tracking, no analytics. Auth uses your existing SoundCloud session cookie — Sift never sees your password.

Open source: https://github.com/aassoiants/sift-music

Works on Chrome, Brave, Edge, Arc, Vivaldi, and any Chromium-based browser.

Requires a SoundCloud account with liked tracks. Log into soundcloud.com in any tab, then open Sift and hit Generate.

## Category
Entertainment

## Single purpose statement
Builds a personalized SoundCloud listening queue by mixing liked tracks across all years with feed discoveries.

## Permission justifications

### cookies
Required to read the user's existing SoundCloud OAuth token for API authentication. No cookies are created or modified.

### storage
Stores the user's queue, playback position, cached track data, and settings (ratio, duration filter) locally in the browser.

### tabs
Used to detect whether a Sift tab is already open. Prevents opening duplicate tabs when the user clicks the extension icon — focuses the existing tab instead.

### Host: soundcloud.com
Content scripts run on soundcloud.com to extract the client_id from SoundCloud's runtime configuration, which is required for API authentication.

### Host: api-v2.soundcloud.com
Fetches the user's liked tracks, feed items, and resolves audio stream URLs from SoundCloud's API.

### Host: *.sndcdn.com
Loads HLS audio streams from SoundCloud's CDN for in-extension playback.
