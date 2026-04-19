# Chrome Web Store Listing - Sift

## Name

Sift: SoundCloud, Tuned to You

## Short description (132 char max)

Mix your SoundCloud likes and feed into one queue. Bookmark moments in sets. Built-in player, all local.

(104 characters)

## Detailed description

(Source of truth: README.md user-facing portion. Keep these aligned. CWS does not render markdown, so this is plain text with blank-line section breaks.)

Your SoundCloud likes go back years. Sift digs them up, mixes them with your feed, and lets you bookmark the moments worth remembering.


THE PROBLEM

You've liked hundreds, maybe thousands of tracks on SoundCloud over the years. Sets, mixes, deep cuts. They're all still there, but SoundCloud doesn't do a great job letting you listen back through them. No shuffle across years. No way to weave old likes with your new feed. No duration filter. Your favorites from five years ago are pretty much gone.

Meanwhile, your feed keeps moving. New reposts, new releases. You can listen to one or the other, but never both in a single session that feels right.

And when you're deep in a two-hour set and hear something incredible at the 47-minute mark, there's no way to save that moment. You either remember it or you don't.


WHAT SIFT DOES

Sift pulls your complete like history and your current feed, then builds a queue that mixes the two together. Likes are spread across every year you've been listening, so old stuff and new stuff sit side by side.

You control:
- The mix ratio: how many feed tracks for every X likes (e.g., "1 feed track for every 3 likes")
- Minimum duration: only long-form stuff like sets and mixes, or include everything
- Shuffle: re-randomize while keeping the year-spread balance

A 2012 deep cut next to yesterday's repost, then something from 2018 you completely forgot about.

When you hear something worth saving, press B to bookmark it. Sift saves the exact timestamp, groups your moments by set, and lets you jump back with one click. Add notes so you remember why you saved it.


FEATURES

Queue:
- Year-spread: likes are round-robined across all years so old and recent stuff is evenly mixed
- Feed/likes ratio: how many feed tracks for every X likes
- Duration filter: minimum track length in minutes
- Like, unlike, repost: right from the queue, no need to leave Sift
- SoundCloud links: open any track on soundcloud.com

Moments:
- Press B or tap the bookmark button to save the exact timestamp while listening
- Moments tab shows everything grouped by set, with mini-timelines, search, and note editing
- Click any moment to jump straight to that point
- Blue tick marks on the progress bar show where your moments are. Hover one to see the note, click to edit it, or delete it

Player:
- HLS streaming right in the extension. Your SoundCloud tab can stay in the background.
- Position saved every 5 seconds and on tab close. Reopen, hit play, no wait.
- Left it paused for hours? It re-resolves the stream and picks up where you stopped
- Shimmer on buffering so it doesn't feel broken
- Shows up in your browser's media controls with title, artist, play/pause/next/prev

Everything else:
- Likes data: stats on your full like history (total hours, duration breakdown, tracks by year, top genres, top artists)
- Persistence: close the tab, come back later, queue is still there
- Auto-detection: tells you if you're signed out or if no soundcloud.com tab is open. Re-checks when state changes.
- One tab: clicking the icon refocuses the existing Sift tab instead of opening a new one
- Accessible: AA contrast, keyboard nav, aria labels, focus outlines


PRIVACY

Nothing leaves your browser. No analytics, no tracking, no servers.

The only network requests go to SoundCloud's own API to fetch your likes and feed. Auth uses your existing SoundCloud session cookie. Sift never sees your password. No accounts, no sign-ups, no third parties.

Source: https://github.com/aassoiants/sift-music


Works on Chrome, Brave, Edge, Arc, Vivaldi, and any Chromium-based browser.

Requires a SoundCloud account with liked tracks. Log into soundcloud.com in any tab, then open Sift and hit Generate.

Not affiliated with SoundCloud. Independent open-source tool that talks to SoundCloud's API using your own session.

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

