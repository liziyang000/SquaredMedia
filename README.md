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

The container starts at:

```text
http://localhost:8084/index.php
```

Docker sets `PINGFANG_PREVIEW_DATA` to the mounted
`/var/www/html/preview/data.json`, so the backend preview and the static preview
read the same sample data inside the container.

`server/index.php` is a PHP 8.4 backend-linked preview entry. It reads `preview/data.json` and renders home, category, search, detail, and play routes with normal links. In production MacCMS will render the real theme under `template/pingfangvideo`; this preview backend is a local integration layer for testing page flow before connecting a real database or MacCMS data source.

## Next.js Frontend Workspace

`apps/web` is the local Next.js 16 App Router workspace. It uses React,
TypeScript, TanStack Query, React Hook Form, Zod, Vitest, Testing Library, and
Playwright. MacCMS remains the backend, admin, session owner, API provider, and
native player authorization boundary.
Node.js 22.22.0 or newer is required for this workspace.

Start the switched local environment with one command:

```bash
npm run dev:local
```

Use the Next.js frontend as the primary local entry:

```text
http://127.0.0.1:5173/
```

The command also starts the PHP preview backend on port `8084`. Next.js keeps
requests same-origin in the browser and rewrites `/react-api.php`, `/index.php`,
`/api.php`, `/template`, `/static`, `/upload`, and `/preview` to that backend.
`/react-api.php` is rewritten to the local-only `server/react-api.php` adapter;
the retained PHP preview remains available through the Next.js origin at:

```text
http://127.0.0.1:5173/index.php?route=home
```

Stopping the command stops both local processes. This switches only the local
development entry; it does not change the production MacCMS theme or server.

To run only the Next.js development server when a backend is already listening on
`127.0.0.1:8084`:

```bash
npm ci
npm run dev:web
```

Validate the Next.js workspace with:

```bash
npm run test:web
npm run lint:web
npm run typecheck:web
npx playwright install chromium
npm run test:e2e
npm run build:web
```

The local Next.js frontend now covers the home, catalog, categories, search,
rankings, video detail, plot, download authorization entry, watch/trial shell,
existing-member login, account, favorites, history, devices, comments,
feedback, reports, challenge/status, and `404` pages. New-member registration
and password recovery are intentionally unavailable; their clean and legacy
page routes return HTTP `410`. All internal links use clean URLs without
`index.php`. During local development, Next.js Proxy returns one-hop `301`
responses for the known legacy public routes and real HTTP `410` responses for
retired modules instead of rendering soft React error pages.
Playwright covers those status codes, clean-route refreshes, account flows, and
the 320/390/1100/1180/1181/1440-pixel responsive boundaries.

`server/react-api.php` is a local acceptance adapter over `preview/data.json`.
It exposes a lightweight navigation action, a section-based `home_v2`, and
whitelisted content DTOs, keeps media URLs out of lists and
details, returns a media URL only from the dedicated playback action, and uses
a real PHP session plus CSRF validation for local login and strict JSON writes.
Anonymous history remains in validated browser storage; authenticated
favorites and history support select, delete, and clear operations in the
session-backed adapter. The local demo account is `demo` / `demo123`. Its state
is intentionally disposable.

This adapter is not a production MacCMS API. The independent `pingfangapi`
addon now provides the production contract at
`/index.php/pingfangapi/index?action=...`; copy `apps/web/.env.example` when
building Next.js so both endpoints remain same-origin. The client rejects absolute
or protocol-relative API endpoints. Real MacCMS data, Cookie policy, native
player authorization, and the `ulog` progress columns still require staging
validation before traffic is switched.
The local Next.js Proxy `301`/`410` policy is not a production Nginx configuration; the
production aliases, PHP pass-through order, RSS decision, and reverse-proxy topology must
still be derived from the real server and access logs.
See [the 79-template migration matrix](docs/react-template-migration-matrix.md)
for each legacy template's React, backend-pass-through, or retirement outcome.

`npm run build:web` creates a server-capable standalone output under
`apps/web/.next/standalone`. It is intentionally not a static export because
arbitrary video routes, Cookie sessions, and Proxy behavior require a Next.js
runtime. The Next.js release path is separate from the MacCMS theme/addon
deployment path.

### Next.js staging deployment

`react.ping2.my` uses a loopback-only Next.js process on port `3100`. BaoTa
Nginx keeps `/index.php`, `/api.php`, `/upload`, `/static`, and `/template`
under MacCMS/PHP ownership and reverse proxies clean public routes to Next.js.
The local fixture endpoints `/react-api.php` and `/preview` are blocked.

After Node.js 22.22 or newer is installed on the staging server:

```bash
source scripts/deploy-ping2.env
npm run deploy:web
```

The command runs the full local gate and builds a Linux x64/glibc standalone
archive locally. A content/toolchain fingerprint lets repeated deployments reuse
the verified archive while still rerunning the complete test gate and archive
validation. Cache access is serialized locally; a hit is copied and hashed again,
while a miss is published from a complete temporary entry by atomic rename. The
server starts it on a candidate port and switches `current` only
after the health, route, static asset, Nginx, and 10-second real content API checks pass. Releases live under
`/www/wwwroot/react_squared_media/releases/`; the previous target is preserved
for rollback. This command does not change the main `www.ping2video.xyz` site,
the MacCMS theme, addons, or database.

Rollback to the recorded previous staging release with:

```bash
source scripts/deploy-ping2.env
npm run rollback:web
```

Pass `NEXT_ROLLBACK_RELEASE=<release-id>` to select a specific preserved
release. The first rollback can also restore the pre-Next static staging
configuration.

## Install

1. Run MacCMS on PHP 8.4 with `mysqli`, `pdo_mysql`, `gd`, `zip`, `opcache`, and Apache rewrite support enabled.
2. Copy `template/pingfangvideo` into the MacCMS `template` directory.
3. In the MacCMS admin panel, switch the frontend template to `pingfangvideo`.
4. Clear template cache after changing files under `html/public`, `css`, or `js`.
5. Confirm home, category, search, detail, play, download, comment, feedback, RSS, sitemap, jump, message, password, and copyright pages render correctly with production data.

### Player Loading Prompts

The theme includes two standalone, dependency-free player prompt pages. After
uploading the theme, set the matching fields in the MacCMS player settings to:

```text
预加载提示: /template/pingfangvideo/player/preload.html
缓冲提示:   /template/pingfangvideo/player/buffering.html
```

These pages stay inside the theme package, so deployment and rollback update
them together with the rest of the theme without replacing MacCMS core files
under `/static/player`.

## Release Package

Create a deployable archive:

```bash
npm ci
npm run lint
npm test
npm run typecheck:web
npx playwright install chromium
npm run test:e2e
npm run build:web
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
It also builds the companion MacCMS addon archives:

```text
dist/pingfangdevice.tar.gz
dist/pingfangapi.tar.gz
```

The `pingfangdevice` addon provides 登录设备管理 for member accounts. It records
each successful login as a device session, shows current devices with recent
login and activity time, supports manually kicking other devices offline, and
keeps 3 devices online by default（默认最多 3 台设备）. The addon settings allow
1–20 concurrent devices and a 1–365 day server-side session lifetime; the
defaults are 3 devices and 30 days. When the configured limit is exceeded, the
oldest active device is revoked.

The addon can also adopt valid MacCMS native or OAuth sessions created outside
the React frontend into device management; this does not expose registration in
the React frontend or `pingfangapi`. Once a login has been managed, deleting or replacing its
device token cannot recreate the session: the native login cookies are cleared
instead. Logout and manual revoke actions require same-origin Ajax `POST`
requests. `device_token_cookie` changes the actual cookie name; changing it on a
running site signs current devices out and requires users to log in again.

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

For the `ping2.my` server, the non-secret deployment target is stored in
`scripts/deploy-ping2.env`. This file distinguishes the SSH host `ping2.my`
from the public site host `www.ping2video.xyz` and selects the dedicated local
deployment identity:

```bash
source scripts/deploy-ping2.env
npm run deploy
```

For the first production API release, publish both backend addons while leaving
the current theme unchanged:

```bash
source scripts/deploy-ping2.env
DEPLOY_SCOPE=backend npm run deploy
```

After that dependency baseline is installed, publish only the production API
while leaving the current theme and `pingfangdevice` files unchanged:

```bash
source scripts/deploy-ping2.env
DEPLOY_SCOPE=api npm run deploy
```

API-only deployment uploads only `dist/pingfangapi.tar.gz`, snapshots only the
installed API addon and application controller, clears the normal MacCMS caches,
and runs bounded site/API loopback checks: at most five serial requests, ten
seconds per request and a shared thirty-second network-request budget. Before changing files it requires
the installed `pingfangdevice` service and hook files, enabled `app_begin` hook,
and database schema to match the current API dependency; a mismatch fails safely
and requires `DEPLOY_SCOPE=backend` first. The first deployment of a workspace
fingerprint runs the full release gate; repeated API-only deployment of the same
fingerprint runs only the production API/controller/device-session tests and
builds and verifies only the API archive. The default scope remains `all`.

`DEPLOY_PATH` must point to the remote MacCMS `template` directory. With the
default scope, the deploy script runs the full local verification sequence,
uploads `dist/pingfangvideo.tar.gz`, backs up any existing remote
`pingfangvideo` directory as `pingfangvideo.backup.*`, replaces it with the
verified package, and clears common MacCMS cache directories under the site
root: `runtime/cache`, `runtime/temp`, `application/admin/view/_cache`, and
`application/index/view/_cache`. Set `DEPLOY_CLEAR_CACHE=0` only when cache
clearing must be skipped for a controlled maintenance window. For password
authentication, set `DEPLOY_PASSWORD` in the shell environment and install
`sshpass`; SSH key authentication is preferred for routine releases. When the
deployment key is not the default SSH identity, set `DEPLOY_IDENTITY_FILE` to
its local private-key path; the script enables `IdentitiesOnly` for that key.
When `DEPLOY_SITE_HOST` is configured, the remote script performs an HTTPS
loopback request with the real Host/SNI after cache clearing. An optional
`DEPLOY_SITE_MARKER` must also occur in the response, preventing a generic
control-panel default page from being accepted as a successful deployment.
This verification runs after remote files and database changes are applied. In
the default scope, a failure restores the theme, both addons, both application
controllers, and addon hook config. Backend failure restores both addons,
controllers, and hook config without touching the theme; API-only failure
restores only the API addon and controller. Additive database schema changes
are intentionally retained. If automatic restoration or rollback cache clearing
fails, the script exits with status `95` and preserves the remote snapshot,
temporary root, and uploaded archives. SSH status `255` is also treated as an
unknown remote state, so recovery archives are not deleted.

The default full deployment installs the `pingfangdevice` and
`pingfangapi` addons under the remote MacCMS `addons` directory, applies
`addons/pingfangdevice/install.sql`, and
adds the addon's `app_begin` hook to `application/extra/addons.php`. This hook
keeps valid device sessions synchronized with MacCMS `user_check` cookies and
lets revoked devices fall back to the normal MacCMS logged-out state. Before
finishing, deployment validates every addon PHP file, the installed hook, and
the upgraded `login_check_hash` database column. The frontend compatibility
controller is packaged in the addon's standard
`application/index/controller/Pingfangdevice.php` payload and copied to the
matching MacCMS application path during SSH deployment.

`pingfangapi` is packaged separately as `dist/pingfangapi.tar.gz`. Deployment
copies its application controller to
`application/index/controller/Pingfangapi.php`, verifies every PHP file and
requires `ulog_point` plus `ulog_duration` before completing. It has no CORS or
runtime hook. `home_v2` reuses MacCMS list queries and returns bounded homepage
sections; catalog cards skip playback parsing, and unfiltered pagination reuses
permission-scoped category totals instead of repeating an exact table count.
Filtered totals and metadata use permission-scoped server-side caches, while every HTTP
response is `private, no-store` so MacCMS session cookies cannot enter a shared
cache. Login, comments, feedback, reports, reactions, and ratings reuse MacCMS
user, moderation, blacklist, captcha, Ulog, and counter rules behind the same
CSRF and rate-limit boundary. Registration, registration-code delivery, and
password recovery are excluded from the public action whitelist and return
`404`. The session response publishes only the login, comment, and feedback
form requirements needed by React. These retained flows still require staging
acceptance against the deployed MacCMS configuration before traffic is
switched.

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
directories unless `DEPLOY_CLEAR_CACHE=0` is set. This command intentionally
rolls back only the theme. Addon code and its additive device-session schema are
left in place so a theme rollback cannot discard login history or silently
remove a security migration; deploy-created addon and application-controller
backups remain on the server for an explicit manual addon rollback if one is
required.

GitHub Actions installs the pinned npm workspace dependencies with `npm ci` and
the Playwright Chromium runtime, then runs the same release gate on pushes and
pull requests: `npm test`, `npm run lint`, `npm run typecheck:web`,
`npm run test:e2e`, `npm run build:web`, `npm run lint:template`,
`npm run verify:compat`, `npm run verify:preview`, `npm run package`, and
`npm run verify:release`. After verification, the CI
workflow uploads `dist/pingfangvideo.tar.gz` as `pingfangvideo-theme` and
`dist/pingfangdevice.tar.gz` as `pingfangdevice-addon`, and
`dist/pingfangapi.tar.gz` as `pingfangapi-addon`, keeping all three release
units separate.

`npm run lint` checks theme browser JavaScript with ESLint, Next.js/React TypeScript with
Oxc, theme CSS with Stylelint, and source/config formatting with Prettier.
Vendored minified libraries are excluded. Run `npm run format` to format the
covered sources and configuration files.

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

Serve the repository root over HTTP before opening the static preview. The page
fetches `/preview/data.json`, so opening `preview/index.html` directly with a
`file://` URL does not provide a working data-linked preview:

```bash
php -S 127.0.0.1:8080 -t .
```

Then open `http://localhost:8080/preview/index.html`. It supports category,
search, detail, and play navigation without requiring MacCMS.

For backend-rendered route verification, run `npm run verify:preview`. It invokes
`server/index.php` through the local PHP CLI without requiring Docker.

## Verify

```bash
npm ci
npm run lint
npm test
npm run typecheck:web
npx playwright install chromium
npm run test:e2e
npm run build:web
npm run lint:template
npm run verify:compat
npm run verify:preview
npm run package
npm run verify:release
```

Repository checks covered by the test suite:

- MacCMS V10 theme directory and key page structure
- public header, video list, detail, and play template hooks
- React clean routes, local API contracts, browser history, account writes, and responsive boundaries
- comment, RSS alias, video password, download, copyright, and plot route coverage
- PHP 8.4 Docker runtime configuration
- release packaging script
