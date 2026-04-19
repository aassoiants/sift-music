# Sift v0.5.1 - Release Notes

**Sift: SoundCloud, Tuned to You**

---

## Fixes

- **Moments tab no longer shows queue controls.** The queue settings bar would reappear on the Moments tab whenever you tabbed back to Sift from another browser tab. Caused by the auth re-check on visibilitychange ignoring the active tab. Fixed.
- **Em dash separator removed from moments table.** The bold group headers in the Moments tab no longer use an em dash between the set title and the account. Cleaner visual, and consistent with the project no-em-dash rule.

## Other

- Privacy policy and Chrome Web Store listing permission justifications updated to reflect what v0.5.0 added (moments storage, moment backups, like/unlike/repost actions sent to SoundCloud, clarified SoundCloud-tab requirement).
- Repeatable screenshot capture procedure documented in the Chrome Web Store upload checklist, including the DevTools dock-bottom gotcha that snaps the viewport down to 1088x680 when DevTools is right-docked.

## Install

1. Download the `.zip` from GitHub Releases
2. Unzip to a folder
3. Go to `chrome://extensions` and enable Developer Mode
4. Click "Load unpacked" and select the `extension` folder
5. Visit soundcloud.com and log in
6. Click the Sift icon and generate your queue
