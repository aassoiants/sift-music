# Sift Release Checklist

Use this every time you ship a new version. Items are ordered.

## 1. Pre-flight

- [ ] All planned changes merged to `main`
- [ ] `node utilities/test-e2e.mjs` passes (151+)
- [ ] Manual smoke test in loaded extension: queue generates, playback works, moments save, resume position restores
- [ ] No dev cruft inside `extension/` (check `git status`, especially `extension/images/` for stray screenshots)

## 2. Version bump

Update **all four** spots to the new version:

- [ ] `extension/manifest.json`: `"version"` field
- [ ] `extension/app.html`: menu dropdown footer
- [ ] `extension/app.html`: logged-out overlay footer
- [ ] `extension/app.html`: no-soundcloud-tab overlay footer

Quick check: `grep -n "v0\." extension/app.html extension/manifest.json` should show 4 hits at the new version.

## 3. Update listing copy

- [ ] `docs/RELEASE_NOTES.md`: rewrite for the new version (this is the GitHub release body + the source for the per-version snapshot)
- [ ] `store/listing/store-listing.md`: update Detailed description if user-facing features changed
- [ ] If new screenshots are needed, capture and replace files in `store/listing/screenshots/` (1280x800 PNG, no PII visible)

## 4. Build the release artifact

- [ ] `node utilities/build-release.mjs`
  - Produces `store/releases/v{X}/sift-music-v{X}.zip`
  - Snapshots `docs/RELEASE_NOTES.md` to `store/releases/v{X}/release-notes.md`
  - Warns if app.html doesn't have the bumped version in 3 spots

## 5. Git

- [ ] `git status`: confirm only intended files staged
- [ ] Commit with concise message (no AI attribution, no em dashes)
- [ ] `git push origin main`
- [ ] `git tag v{X} && git push origin v{X}`

## 6. GitHub release

- [ ] `gh release create v{X} store/releases/v{X}/sift-music-v{X}.zip --notes-file store/releases/v{X}/release-notes.md --title "v{X}"`
- [ ] Verify release page renders correctly

## 7. Chrome Web Store submission

The CWS Developer Dashboard for Sift has these sections. Update only what changed since the last submission. **Whenever the live listing is more than one version behind, do a full review of every field below.**

### Build → Package

- [ ] Upload `store/releases/v{X}/sift-music-v{X}.zip`

### Build → Store listing → Product details

Source of truth: `store/listing/store-listing.md`. Compare what's live in CWS to what's in our markdown. They may have drifted.

- [ ] **Title**: read from package (no edit needed; pulled from `manifest.json` "name")
- [ ] **Summary**: read from package (no edit needed; pulled from `manifest.json` "description"). 132 char max.
- [ ] **Description**: paste the Detailed description from `store/listing/store-listing.md`. Plain text, no markdown. Newlines preserved.
- [ ] **Category**: `Entertainment`
- [ ] **Language**: English (US)

### Build → Store listing → Graphic assets

- [ ] **Store icon (128x128)**: pulled from `manifest.json` "icons" → `extension/images/icon-128.png`. No upload needed unless icon changed.
- [ ] **Screenshots**: replace from `store/listing/screenshots/` (1280x800 PNG, exact). Up to 5. Order matters; first one shows largest. See "Screenshot capture procedure" below.
- [ ] **Small promo tile (440x280)**: required. Source: `store/listing/promo-tile.html` rendered to PNG. Skipping this hurts ranking (Google demotes listings without it).
- [ ] **Marquee promo tile (1400x560)**: optional. Skip unless we're actively pursuing being featured (editorial-only, can't request). See `research/cws-promo-tiles.md`.

### Build → Privacy → Single purpose

Source of truth: `store/listing/store-listing.md` "Single purpose statement" section.

- [ ] **Single purpose description**: paste from store-listing.md. 1000 char max. Should match what's actually in the extension's behavior.

### Build → Privacy → Permission justification

Source of truth: `store/listing/store-listing.md` "Permission justifications" section. The CWS form has one field per permission/host. The host-permission warning in CWS reads: *"Because of the host permission, your extension may require an in-depth review that will delay publishing."* Plan for review delay.

For Sift, the fields the form asks for:

- [ ] **`cookies` justification**: paste from store-listing.md
- [ ] **`storage` justification**: paste from store-listing.md
- [ ] **Host permission justification** (combined for all hosts in `manifest.json`): covers `soundcloud.com`, `api-v2.soundcloud.com`, AND `*.sndcdn.com`. The CWS form may show a single combined field or one per host depending on dashboard version. If it's one combined: paste a merged version that mentions all three hosts and what each is for.
- [ ] **Are you using remote code?**: **No** (hls.js is bundled at `extension/lib/hls.light.min.js`, not loaded from CDN)
- [ ] **Data usage disclosures**: confirm "does not collect" / local-only is still selected
- [ ] **Privacy policy URL**: confirm the link still resolves (currently published via GitHub or wherever `privacy-policy.md` is hosted)

### Submit

- [ ] Save all changes
- [ ] Submit for review
- [ ] Note expected review delay (host-permission listings typically 3-7 days)

## 8. Post-ship

- [ ] Update `docs/session-log.md` with what shipped and any review surprises
- [ ] Update `docs/todo.md`: move shipped items to Done
- [ ] Update `CLAUDE.md`'s "Current Project State" with new version

## Notes

- `store/listing/` mirrors what's currently live in CWS. Update it when you change what's submitted.
- `store/releases/v{X}/` is the immutable snapshot of what shipped at version X. Don't edit after the release is tagged.
- `store/archive/` holds zips from before the new structure (pre-v0.5.0). Reference only, not used in submission.
- When upgrading after multiple versions of GitHub-only releases, expect to refresh **all** screenshots, copy, and possibly the promo tile. The live CWS state is whatever was uploaded last, not what's in our repo.

## Screenshot capture procedure

CWS requires screenshots at exactly 1280x800. Chrome's DevTools Responsive mode will silently snap to a smaller width if the DevTools panel is eating horizontal space. The most common failure: capturing at 1088x680 or 1120x800 because DevTools was docked to the right.

**Setup once:**
1. Reload Sift at `chrome://extensions` so the latest code is active (otherwise UI bugs already fixed in source will still appear in the screenshot)
2. Open Sift's app tab
3. Open DevTools (F12)
4. **Dock DevTools to bottom**, not right (top-right `...` in DevTools, "Dock side" -> bottom). This is the critical step. Right-docked DevTools steals horizontal width and Responsive mode caps at whatever is left.
5. Click the device-toolbar icon in DevTools (Ctrl+Shift+M) to enter Responsive mode
6. Set dimensions to exactly 1280 x 800

**Per screenshot:**
1. Navigate to the view you want (Queue tab, Moments tab, menu open, modal open, etc.)
2. Verify the dimensions readout still says 1280 x 800
3. In DevTools device toolbar, three-dot menu -> Capture screenshot
4. Save to `store/listing/screenshots/{name}.png` (overwrite if it exists)
5. Verify size with PowerShell: `powershell.exe -NoProfile -Command "Add-Type -AssemblyName System.Drawing; [System.Drawing.Image]::FromFile('Z:\path\to\file.png') | Select-Object Width,Height"`

**Current screenshot set** (target views, all on a populated Sift):

| File | What to show |
|---|---|
| queue.png | Queue tab with several tracks visible, player bar showing track playing, controls-bar at top |
| moments.png | Moments tab with grouped table, mini-timelines visible, at least one set with multiple moments |
| menu.png | Hamburger menu open showing all menu items |
| likes-modal.png | Likes data modal open showing year breakdown, top genres/artists |
| logged-out.png | Logged-out overlay (sign out of soundcloud.com or test from a fresh profile) |
| no-soundcloud-tab.png | No-SC-tab overlay (close all soundcloud.com tabs while signed in elsewhere) |

**Privacy note:** real account names and set titles are acceptable to upload (per project decision). Don't capture views that show your queue order or anything you'd consider personal listening telemetry.
