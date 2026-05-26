# Sift v0.5.2 - Release Notes

**Sift: SoundCloud, Tuned to You**

---

## Fixes

- **Restored Like and Repost actions.** SoundCloud's anti-bot service had started rejecting Sift's direct write requests with a 403 challenge. Sift now routes Like, Unlike, Repost, and Un-repost actions through your open SoundCloud tab so they ride your real session and clear the challenge.

## Improvements

- **Clearer failure messages on Like and Repost.** Three new sticky messages tell you exactly what to do: when no SoundCloud tab is open, when Chrome's Memory Saver has unloaded your SoundCloud tab, and when SoundCloud's anti-bot pauses an action. Each replaces the previous silent red-flash on the button.
- **Accessibility pass on the failure messages.** Screen readers now announce them. Keyboard users can dismiss with Escape. Dismiss-button contrast now passes WCAG AA. Tap target enlarged. Motion respects the system "Reduce motion" preference.

## Install

1. Download the `.zip` from GitHub Releases
2. Unzip to a folder
3. Go to `chrome://extensions` and enable Developer Mode
4. Click "Load unpacked" and select the `extension` folder
5. Visit soundcloud.com and log in
6. Click the Sift icon and generate your queue
