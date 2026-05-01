# Privacy Policy - Sift: SoundCloud, Tuned to You

**Last updated: May 1, 2026**

## What Sift does

Sift is a Chrome Extension that builds listening queues from your SoundCloud likes and feed. Everything runs locally in your browser.

## What data is accessed

- **SoundCloud OAuth token**: Read from your existing SoundCloud session cookie. Used to authenticate API requests on your behalf. Never stored permanently, never sent anywhere except SoundCloud's own API.
- **SoundCloud client ID**: Extracted from SoundCloud's web app and cached in `chrome.storage.local`. Used alongside the OAuth token for API calls.
- **Your SoundCloud user ID**: Fetched once from SoundCloud's `/me` endpoint and cached in `chrome.storage.local` so Sift can build the URLs that load your likes.
- **Your liked tracks and feed**: Fetched from SoundCloud's API (`api-v2.soundcloud.com`) and cached locally in your browser using `chrome.storage.local`. Cache persists until you explicitly refresh.
- **Your repost IDs**: Fetched from `api-v2.soundcloud.com` so the repost button can show the correct state on each track row. Kept in memory for the session, not stored.
- **Queue state and preferences**: Your queue order, playback position, and settings (ratio, duration filter) are stored locally in `chrome.storage.local` so they persist across sessions.
- **Your moments**: When you press B to bookmark a moment in a set, Sift saves the timestamp, the track it belongs to, and any note you wrote. Stored locally in `chrome.storage.local`. Never transmitted anywhere.
- **Local backups of moments**: To protect against data loss, Sift keeps a rolling backup of your moments and creates a one-time snapshot every time the extension is updated. All backups stay in `chrome.storage.local` and are never transmitted.

## What data is sent to SoundCloud on your behalf

When you click the Like, Unlike, Repost, or Un-repost buttons on a track row, Sift sends the corresponding API request to `api-v2.soundcloud.com` using your OAuth token. This modifies your SoundCloud account state the same way clicking those buttons on soundcloud.com would. No other actions are ever sent.

## What data is NOT collected

- No personal information is collected, stored, or transmitted by Sift.
- No analytics, telemetry, or usage tracking of any kind.
- No cookies are created or modified.
- No data is sent to any server other than SoundCloud's own API.
- No accounts, sign-ups, or registrations.

## Where data is stored

All data stays in your browser's local storage (`chrome.storage.local`). Nothing is sent to external servers. There is no backend, no database, no cloud service.

## Third-party services

The only external service Sift talks to is **SoundCloud** (`soundcloud.com`, `api-v2.soundcloud.com`, `*.sndcdn.com`). These requests fetch your liked tracks, your feed, and audio streams for playback, all using your existing SoundCloud session.

## Permissions and why they're needed

| Permission | Why |
|---|---|
| `cookies` | Reads your existing SoundCloud OAuth token from `soundcloud.com` cookies. No cookies are created or modified. |
| `storage` | Caches track data and persists your queue, playback position, settings, moments (timestamps and notes you wrote), and rolling/per-update moment backups locally. |
| `https://soundcloud.com/*` | Runs content scripts to extract the SoundCloud client ID needed for API authentication. Also detects whether a SoundCloud tab is open so Sift can prompt you to open one if needed (the tab keeps the client ID fresh). |
| `https://api-v2.soundcloud.com/*` | Fetches your liked tracks, feed, and resolves audio stream URLs. Also sends like, unlike, repost, and un-repost actions when you click those buttons on a track row. |
| `https://*.sndcdn.com/*` | Loads audio streams from SoundCloud's CDN for playback. |

## Data sharing

Sift does not share any data with anyone. There are no third-party analytics, advertising, or data-sharing arrangements.

## Changes to this policy

If this policy changes, the updated version will be posted here with a new date. Since Sift collects no data, meaningful changes are unlikely.

## Contact

Questions or concerns? Open an issue on [GitHub](https://github.com/aassoiants/sift-music) or use the feedback link in the extension.

## Chrome Web Store compliance

The use and transfer of information received from Google APIs adheres to the [Chrome Web Store User Data Policy](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq), including the Limited Use requirements.
