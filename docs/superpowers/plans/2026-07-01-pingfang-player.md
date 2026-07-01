# PingFang Player Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a hybrid self-hosted player for the MacCMS `pingfangvideo` theme that takes over direct HLS/MP4 playback and falls back to the original MacCMS player for complex lines.

**Architecture:** Keep `{$player_data}` and `{$player_js}` intact, then load a local enhancement script after MacCMS creates the player. The enhancement script reads `window.player_data.url` or a preview `<video>` source, upgrades only `.m3u8` and `.mp4`, and restores the original player markup on unsupported or failed playback.

**Current Status:** The player assets and styles are kept for follow-up development, but production and preview playback templates currently do not load the enhancement scripts.

**Tech Stack:** MacCMS V10 templates, vanilla JavaScript, vendored `hls.js`, CSS, Node.js assertion tests, PHP preview renderer.

---

### Task 1: Add Player Regression Tests

**Files:**
- Modify: `tests/template.test.mjs`

- [ ] **Step 1: Add failing assertions**

Add assertions near the existing `vod/play.html`, `vod/player.html`, CSS, and JS checks:

```js
assert.match(play, /\{\$maccms\.path_tpl\}js\/hls\.min\.js\?v=1\.6\.16/);
assert.match(play, /\{\$maccms\.path_tpl\}js\/pingfang-player\.js\?v=__PINGFANG_ASSET_VERSION__/);
assert.match(playerPage, /\{\$maccms\.path_tpl\}js\/hls\.min\.js\?v=1\.6\.16/);
assert.match(playerPage, /\{\$maccms\.path_tpl\}js\/pingfang-player\.js\?v=__PINGFANG_ASSET_VERSION__/);
assert.match(style, /\.pf-player\s*\{/);
assert.match(style, /\.pf-player-controls\s*\{/);
assert.match(style, /\.pf-player-progress\s*\{/);
assert.match(style, /@media \(max-width: 760px\)[\s\S]*\.pf-player-controls/);
const pingfangPlayer = readThemeFile("../js/pingfang-player.js");
assert.match(pingfangPlayer, /window\.player_data/);
assert.match(pingfangPlayer, /\.m3u8/);
assert.match(pingfangPlayer, /\.mp4/);
assert.match(pingfangPlayer, /restoreOriginalPlayer/);
assert.match(pingfangPlayer, /localStorage/);
```

- [ ] **Step 2: Run the test and verify it fails**

Run:

```bash
npm test
```

Expected: failure because the new scripts, styles, and player source do not exist yet.

### Task 2: Add Player Assets

**Files:**
- Create: `template/pingfangvideo/js/hls.min.js`
- Create: `template/pingfangvideo/js/pingfang-player.js`

- [ ] **Step 1: Vendor hls.js**

Download the minified browser build for `hls.js` version `1.6.16` into `template/pingfangvideo/js/hls.min.js`. Keep the upstream license banner if present.

- [ ] **Step 2: Implement the direct-link player**

Create `pingfang-player.js` with these responsibilities:

- read `window.player_data.url` first, then fallback to `.player-shell video source`;
- detect only `.m3u8` and `.mp4` URLs;
- clone and preserve original `.player-shell` markup before replacing it;
- render a `.pf-player` wrapper with `<video>`, control buttons, progress range, volume range, speed select, and status text;
- use native HLS when supported;
- use `window.Hls` when native HLS is unavailable;
- restore original markup on setup errors and fatal HLS errors;
- store progress in `localStorage` under a key derived from the playback URL;
- support space, arrow keys, `m`, and `f` keyboard shortcuts while focus is inside the player.

### Task 3: Wire Templates And Preview

**Files:**
- Modify: `template/pingfangvideo/html/vod/play.html`
- Modify: `template/pingfangvideo/html/vod/player.html`
- Modify: `server/lib/render.php`

- [ ] **Step 1: Load local player scripts after MacCMS player output**

Add this after `{$player_js}` in both player templates:

```html
      <script src="{$maccms.path_tpl}js/hls.min.js?v=1.6.16"></script>
      <script src="{$maccms.path_tpl}js/pingfang-player.js?v=__PINGFANG_ASSET_VERSION__"></script>
```

- [ ] **Step 2: Keep preview compatible**

Update the preview renderer's `<video>` output so `pingfang-player.js` can upgrade it during local preview without adding development-only references to production templates.

### Task 4: Add Player Styling

**Files:**
- Modify: `template/pingfangvideo/css/style.css`

- [ ] **Step 1: Add base player styles**

Add scoped styles for `.pf-player`, `.pf-player-media`, `.pf-player-overlay`, `.pf-player-controls`, `.pf-player-progress`, `.pf-player-button`, `.pf-player-volume`, `.pf-player-speed`, and `.pf-player-status`.

- [ ] **Step 2: Add responsive player styles**

Inside `@media (max-width: 760px)`, make `.pf-player-controls` wrap cleanly and keep range controls full width where needed.

### Task 5: Verify

**Files:**
- Read-only verification.

- [ ] **Step 1: Run full required verification**

Run:

```bash
npm test
npm run lint:template
npm run verify:compat
npm run verify:preview
```

Expected: all commands exit 0.

- [ ] **Step 2: Inspect git diff**

Run:

```bash
git diff --stat
git diff -- template/pingfangvideo/html/vod/play.html template/pingfangvideo/html/vod/player.html template/pingfangvideo/js/pingfang-player.js template/pingfangvideo/css/style.css tests/template.test.mjs
```

Expected: changes are limited to the planned files plus the vendored `hls.min.js` asset and preview renderer.
