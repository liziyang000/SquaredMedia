# PingFang Video MacCMS Template

This repository contains a MacCMS V10 video website theme:

```text
template/pingfangvideo/
```

## PHP Requirement

Development is targeted at PHP 8.4. The template itself is MacCMS HTML/CSS/JS, but it is intended to be parsed and rendered by a PHP 8.4 MacCMS runtime.

For a PHP 8.4 container:

```bash
docker compose up --build php84
```

The static preview is then available at:

```text
http://localhost:8084/index.php
```

`server/index.php` is a PHP 8.4 backend-linked preview entry. It reads `preview/data.json` and renders home, category, search, detail, and play routes with normal links. In production MacCMS will render the real theme under `template/pingfangvideo`; this preview backend is a local integration layer for testing page flow before connecting a real database or MacCMS data source.

## Install

1. Run MacCMS on PHP 8.4 with `mysqli`, `pdo_mysql`, `gd`, `zip`, `opcache`, and Apache rewrite support enabled.
2. Copy `template/pingfangvideo` into the MacCMS `template` directory.
3. In the MacCMS admin panel, switch the frontend template to `pingfangvideo`.
4. Clear template cache after changing files under `html/public`, `css`, or `js`.
5. Confirm home, category, search, detail, play, download, comment, feedback, RSS, sitemap, jump, message, password, and copyright pages render correctly with production data.

## Release Package

Create a deployable archive:

```bash
npm run lint:template
npm run verify:compat
npm run verify:preview
npm run package
npm run verify:release
```

The packaged theme is written to:

```text
dist/pingfangvideo.tar.gz
```

The archive contains only the MacCMS theme directory. Upload or extract the
`pingfangvideo` directory into the MacCMS `template` directory; do not deploy
`preview`, `server`, `docker`, `tests`, or other repository tooling to the
production site.

The package script filters hidden dotfiles such as `.DS_Store` and `.gitkeep`
so local metadata and repository placeholders are not shipped with the theme.
It also builds the companion MacCMS addon archive:

```text
dist/pingfangdevice.tar.gz
```

The `pingfangdevice` addon provides 登录设备管理 for member accounts. It records
each successful login as a device session, shows current devices with recent
login and activity time, supports manually kicking other devices offline, and
keeps a maximum of 3 devices online（最多 3 台设备）. When a fourth device logs
in, the oldest active device is revoked.

`npm run verify:release` checks the generated archive before upload: required
MacCMS template files must exist, hidden dotfiles must be absent, and development
directories such as `preview`, `server`, `docker`, `tests`, and `scripts` must
not be included.

Deploy the verified package to a MacCMS server over SSH:

```bash
DEPLOY_HOST=example.com \
DEPLOY_USER=root \
DEPLOY_PORT=22 \
DEPLOY_PATH=/www/wwwroot/example.com/template \
npm run deploy
```

`DEPLOY_PATH` must point to the remote MacCMS `template` directory. The deploy
script runs the full local verification sequence, uploads `dist/pingfangvideo.tar.gz`,
backs up any existing remote `pingfangvideo` directory as `pingfangvideo.backup.*`,
replaces it with the verified package, and clears common MacCMS cache directories
under the site root: `runtime/cache`, `runtime/temp`, `application/admin/view/_cache`,
and `application/index/view/_cache`. Set `DEPLOY_CLEAR_CACHE=0` only when cache
clearing must be skipped for a controlled maintenance window. For password
authentication, set `DEPLOY_PASSWORD` in the shell environment and install
`sshpass`; SSH key authentication is preferred for routine releases.

The deploy script also installs the `pingfangdevice` addon under the remote
MacCMS `addons` directory, applies `addons/pingfangdevice/install.sql`, and
adds the addon's `app_begin` hook to `application/extra/addons.php`. This hook
keeps valid device sessions synchronized with MacCMS `user_check` cookies and
lets revoked devices fall back to the normal MacCMS logged-out state.

Rollback to the latest remote backup:

```bash
DEPLOY_HOST=example.com \
DEPLOY_USER=root \
DEPLOY_PORT=22 \
DEPLOY_PATH=/www/wwwroot/example.com/template \
npm run rollback
```

To roll back to a specific backup directory, pass its directory name:

```bash
ROLLBACK_BACKUP=pingfangvideo.backup.20260627093000 npm run rollback
```

Rollback keeps the failed live directory as `pingfangvideo.failed.*`, restores
the selected backup to `pingfangvideo`, and clears the same MacCMS cache
directories unless `DEPLOY_CLEAR_CACHE=0` is set.

GitHub Actions runs the same release gate on pushes and pull requests: `npm test`,
`npm run lint:template`, `npm run verify:compat`, `npm run verify:preview`,
`npm run package`, and `npm run verify:release`. The CI workflow uploads
`dist/pingfangvideo.tar.gz` and `dist/pingfangdevice.tar.gz` as the
`pingfangvideo-theme` artifact after the package is verified.

`npm run lint:template` checks local MacCMS template structure before packaging:
includes must point to existing files, common MacCMS loop tags must be balanced,
ordinary HTML pages must include the shared head and foot templates, and known
unsafe runtime placeholders are rejected. It also blocks local preview or
development references inside theme files, rejects dead form actions, and checks
that linked CSS, JavaScript, and image assets use MacCMS runtime path variables.

`npm run verify:compat` checks the MacCMS theme compatibility surface: required
theme directories, public includes, comment routes, RSS aliases, sitemap routes,
video fallback pages, user routes, non-video module fallbacks, and dead or unsafe
link patterns.

`npm run verify:preview` renders the PHP 8.4 local preview routes through PHP
CLI and checks that core pages such as home, category, detail, play, download,
copyright, history, and feedback return full HTML without runtime errors.

## Included Pages

- `html/index/index.html` - home page with hero search, hot ranking, categories, and latest videos
- `html/vod/type.html` - category list page
- `html/vod/show.html` - all videos and filters page
- `html/vod/search.html` - search results page
- `html/vod/detail.html` - video detail page with playlists, history, and favorite hooks
- `html/vod/play.html` - playback page with MacCMS player variables
- `html/vod/player.html`, `html/vod/down.html`, and `html/vod/copyright.html` - trial player, download, and copyright fallback pages
- `html/vod/confirm.html`, `html/vod/detail_pwd.html`, `html/vod/player_pwd.html`, and `html/vod/downer_pwd.html` - permission and password verification pages
- `html/vod/plot.html` - episode plot list page
- `html/comment/index.html` and `html/comment/ajax.html` - comment page and Ajax fragment
- `html/gbook/index.html` - message and feedback page linked from the footer
- `html/book/index.html` and `html/book/report.html` - compatibility aliases for message and report routes
- `html/topic`, `html/art`, `html/plot`, `html/actor`, `html/role`, and `html/website` - MacCMS standard module fallback pages
- `html/user` - lightweight member entry plus playback and favorite record pages backed by MacCMS user logs
- `html/public/msg.html` and `html/public/jump.html` - system prompt and redirect pages
- `html/public/vod_card.html` - shared video card partial used by list pages
- `html/public/digg.html`, `html/public/score.html`, and `html/public/star.html` - shared interaction partials for detail pages
- `html/map/*.html`, `html/rss/*.html`, and `html/vod/rss.html` - RSS and sitemap templates

Category and all-video list pages expose fixed MacCMS sorting branches for
latest (`by="time"`), hottest (`by="hits"`), and score (`by="score"`) views.
This avoids passing raw request parameters directly into MacCMS tag attributes.

The theme follows the MacCMS V10 template structure and includes `jquery.js`, `home.js`, and the standard `maccms` JavaScript config in `html/public/include.html`.

The public include exposes the MacCMS runtime values used by `home.js`, including
`path`, `mid`, `aid`, `url`, `wapurl`, and `mob_status`. Keep these values in
place when customizing the header, otherwise built-in history, favorite, and
timing hooks may stop working.

The JavaScript `maccms.path` value is normalized without a trailing slash so the
MacCMS player and history scripts generate `/index.php/...` and
`/static/player/...` paths instead of protocol-relative `//index.php/...` or
`//static/...` URLs.

## Local Preview

Open `preview/index.html` in a browser to view a local data-linked preview. It reads `preview/data.json` and supports category, search, detail, and play navigation without requiring MacCMS.

When Docker/PHP is available, use `server/index.php` through the PHP 8.4 container for backend-rendered navigation.

## Verify

```bash
npm test
npm run lint:template
npm run verify:compat
npm run verify:preview
npm run package
npm run verify:release
```

Production readiness checks covered by the test suite:

- MacCMS V10 theme directory and key page structure
- SEO-aware public header includes
- video list, detail, and play template hooks
- comment, RSS alias, video password, download, copyright, and plot route coverage
- PHP 8.4 Docker runtime configuration
- release packaging script
