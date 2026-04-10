# Chrome Web Store Listing - Sift

## Name

Sift: SoundCloud, Tuned to You

## Short description (132 char max)

Mix your SoundCloud likes and feed into one queue. Bookmark moments in sets. Built-in player, all local.

(104 characters)

## Detailed description

You've liked hundreds, maybe thousands of tracks on SoundCloud over the years. Sets, mixes, deep cuts. They're all still there, but there's no good way to listen back through them. No shuffle across years. No way to mix old likes with your current feed.

Sift fixes that.

It pulls your full like history and your feed, then builds a queue that mixes the two together. Likes are spread across every year you've been listening. A 2012 deep cut next to yesterday's repost, then something from 2018 you forgot about.

You control the mix:

* How many feed tracks for every X likes
* Minimum duration (filter to long-form sets or include everything)
* Shuffle while keeping the year-spread balance

Press B while listening to bookmark a moment in any set. Your moments are grouped by set with mini-timelines, search, and notes. Click any moment to jump right back. You can also hover the blue ticks on the progress bar to see, edit, or delete moments without leaving the player.

Built-in player with HLS streaming. No SoundCloud tab needed. Queue and position persist across sessions, and playback resumes where you left off. Shows up in your browser's media controls with title, artist, play/pause/next/prev.

Likes data shows stats on your full history: total hours, duration breakdown, tracks by year, top genres, top artists.

Everything stays in your browser. No servers, no accounts, no tracking. Auth uses your existing SoundCloud session cookie. Sift never sees your password.

Open source: https://github.com/aassoiants/sift-music

Works on Chrome, Brave, Edge, Arc, Vivaldi, and any Chromium-based browser.

Requires a SoundCloud account with liked tracks. Log into soundcloud.com in any tab, then open Sift and hit Generate.

## Category

Entertainment

## Single purpose statement

Mixes your SoundCloud likes across all years with feed tracks into one queue, and lets you bookmark moments in sets.

## Permission justifications

### cookies

Required to read the user's existing SoundCloud OAuth token for API authentication. No cookies are created or modified.

### storage

Stores the user's queue, playback position, cached track data, and settings (ratio, duration filter) locally in the browser.

### Host: soundcloud.com

Content scripts run on soundcloud.com to extract the client\_id from SoundCloud's runtime configuration, which is required for API authentication. Also used to detect whether a SoundCloud tab is open, which is required for audio playback.

### Host: api-v2.soundcloud.com

Fetches the user's liked tracks, feed items, and resolves audio stream URLs from SoundCloud's API.

### Host: \*.sndcdn.com

Loads HLS audio streams from SoundCloud's CDN for in-extension playback.

