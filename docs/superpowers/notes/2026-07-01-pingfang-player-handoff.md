# PingFang Player Handoff

Date: 2026-07-01

## Conversation Summary

The original request was to build a custom player for the MacCMS theme. We clarified that `.m3u8` links from different websites are not uniformly playable: standard public HLS/MP4 links can be played by a browser, while anti-hotlinking, login cookies, token expiry, cross-origin restrictions, region locks, DRM, or special encryption still require the original MacCMS player or iframe/parse line.

The chosen direction was a hybrid player:

- keep MacCMS `{$player_data}` and `{$player_js}`;
- add a self-hosted player for direct `.mp4` and `.m3u8` only;
- use native video for MP4;
- use native HLS where supported, otherwise local `hls.js`;
- restore the original MacCMS player if setup or playback fails.

After implementation, the follow-up decision was to keep the player code for later development but not use it as the active production player yet.

## Current State

The player assets exist but are intentionally disabled:

- `template/pingfangvideo/js/pingfang-player.js`
- `template/pingfangvideo/js/hls.min.js`
- `.pf-player` styles in `template/pingfangvideo/css/style.css`

These templates currently do not load the player scripts:

- `template/pingfangvideo/html/vod/play.html`
- `template/pingfangvideo/html/vod/player.html`

The local preview renderer also does not load the player scripts. This keeps the current site behavior on the original MacCMS/native preview player while preserving the prototype for follow-up work.

## Relevant Docs

- `docs/superpowers/specs/2026-07-01-pingfang-player-design.md`
- `docs/superpowers/plans/2026-07-01-pingfang-player.md`

Both documents were updated to note that the player is currently retained for later development and is not active.

## Implementation Notes

`pingfang-player.js` currently:

- reads `window.player_data.url`, then falls back to a preview `<video>` source;
- accepts only `.m3u8` and `.mp4`;
- replaces `.player-shell` only after a supported direct source is detected;
- stores playback progress in `localStorage`;
- supports play/pause, progress, mute, volume, speed, fullscreen, and keyboard shortcuts;
- restores the original player markup on unsupported HLS or fatal playback errors.

To re-enable later, add these scripts after `{$player_js}` in both `vod/play.html` and `vod/player.html`, then update tests from `doesNotMatch` to `match` for these two script references:

```html
<script src="{$maccms.path_tpl}js/hls.min.js?v=1.6.16"></script>
<script src="{$maccms.path_tpl}js/pingfang-player.js?v=__PINGFANG_ASSET_VERSION__"></script>
```

## Verification

The current disabled-player state was verified with:

```bash
npm test
npm run lint:template
npm run verify:compat
npm run verify:preview
```

All four commands passed before this handoff note was added.
