# Sift v0.1.0 — Release Notes

**Sift: SoundCloud, Tuned to You**

First release. Sift is a Chrome Extension (MV3) that builds personalized queues from your SoundCloud likes and feed. No servers, no accounts, no tracking — just your music.

---

## Queue Builder

- Mixes tracks from your likes and your feed into a single queue
- Configurable ratio: "X feed tracks for every Y likes tracks"
- Minimum duration filter (default 30 min) — built for DJ sets and long mixes
- Year-spread algorithm pulls from your full listening history so you're not stuck in one era
- Shuffle button to randomize the queue
- Shift+Click "Generate Queue" to force-refresh data from SoundCloud

## Player

- Built-in HLS audio player — no SoundCloud widget, no iframes
- Play/pause, previous, next, seek via progress bar
- Progress tooltip on hover showing time position
- Loading shimmer animation while a track buffers
- Stale stream recovery: auto-retries when CDN URLs expire mid-playback
- Chrome Global Media Controls integration (title + artist in the toolbar media panel, play/pause/next/prev)

## Data & Auth

- Auto-extracts `oauth_token` from SoundCloud cookies
- Captures `client_id` via content script on soundcloud.com
- Works for any logged-in SoundCloud user (resolves user ID via `/me`)
- 30-minute cache for likes and feed data
- Persists queue, playback position, and settings across tab close/reopen

## Likes Data Modal

- Stats overview: total tracks, total hours, average duration, longest track
- Duration breakdown with stacked bar chart
- Tracks by year released (horizontal bar chart)
- Top 5 genres and top 5 artists
- Copy all stats to clipboard as formatted text

## UI/UX

- Dark theme matching the SoundCloud aesthetic
- Logged-out overlay with instructions when not authenticated
- Auto-detects login when switching back to the tab
- Singleton tab — clicking the extension icon focuses the existing Sift tab
- Hamburger menu with feedback link, source code link, version
- Credit line with link to author
- WCAG AA accessible: keyboard navigation (track rows, progress bar), focus-visible outlines, aria labels, semantic roles
- Responsive controls bar (flex-wrap at narrow widths)
- Minimum 11px font size throughout

## Privacy & Security

- All data stays local. No external servers, no tracking, no analytics.
- Auth tokens never leave the browser
- All user-supplied content escaped via `escapeHtml()` to prevent XSS
- MIT licensed, open source

## Known Limitations

- Requires visiting soundcloud.com first to capture credentials
- Token expires ~6 hours — revisit soundcloud.com to refresh
- No drag-to-reorder tracks
- No offline mode

## Install

1. Download the extension from GitHub Releases
2. Unzip to a folder
3. Go to `chrome://extensions` and enable Developer Mode
4. Click "Load unpacked" and select the extension folder
5. Visit soundcloud.com and log in
6. Click the Sift icon and generate your queue
