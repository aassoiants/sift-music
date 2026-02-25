# Privacy Policy — Sift: SoundCloud, Tuned to You

**Last updated: February 24, 2026**

## What Sift does

Sift is a Chrome Extension that builds personalized listening queues from your SoundCloud likes and feed. Everything runs locally in your browser.

## What data is accessed

- **SoundCloud OAuth token** — Read from your existing SoundCloud session cookie. Used to authenticate API requests on your behalf. Never stored permanently, never transmitted anywhere except to SoundCloud's own API.
- **SoundCloud client ID** — Extracted from SoundCloud's web app at runtime. Used alongside the OAuth token for API calls.
- **Your liked tracks and feed** — Fetched from SoundCloud's API (`api-v2.soundcloud.com`) and cached locally in your browser for up to 30 minutes using `chrome.storage.local`.
- **Queue state and preferences** — Your queue order, playback position, and settings (ratio, duration filter) are stored locally in `chrome.storage.local` so they persist across sessions.

## What data is NOT collected

- No personal information is collected, stored, or transmitted by Sift.
- No analytics, telemetry, or usage tracking of any kind.
- No cookies are created or modified.
- No data is sent to any server other than SoundCloud's own API.
- No accounts, sign-ups, or registrations.

## Where data is stored

All data stays in your browser's local storage (`chrome.storage.local`). Nothing is sent to external servers. There is no backend, no database, no cloud service.

## Third-party services

The only external service Sift communicates with is **SoundCloud** (`soundcloud.com`, `api-v2.soundcloud.com`, `*.sndcdn.com`). These requests fetch your liked tracks, your feed, and audio streams for playback — all using your existing SoundCloud session.

## Permissions and why they're needed

| Permission | Why |
|---|---|
| `cookies` | Reads your existing SoundCloud OAuth token from `soundcloud.com` cookies. No cookies are created or modified. |
| `storage` | Caches track data and persists your queue, playback position, and settings locally. |
| `tabs` | Detects if a Sift tab is already open so clicking the icon focuses the existing tab instead of opening duplicates. |
| `https://soundcloud.com/*` | Runs content scripts to extract the SoundCloud client ID needed for API authentication. |
| `https://api-v2.soundcloud.com/*` | Fetches your liked tracks, feed, and resolves audio stream URLs. |
| `https://*.sndcdn.com/*` | Loads audio streams from SoundCloud's CDN for playback. |

## Data sharing

Sift does not share any data with anyone. There are no third-party analytics, advertising, or data-sharing arrangements.

## Changes to this policy

If this policy changes, the updated version will be posted here with a new date. Since Sift collects no data, meaningful changes are unlikely.

## Contact

Questions or concerns? Open an issue on [GitHub](https://github.com/aassoiants/sift-music) or use the feedback link in the extension.

## Chrome Web Store compliance

The use and transfer of information received from Google APIs adheres to the [Chrome Web Store User Data Policy](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq), including the Limited Use requirements.
