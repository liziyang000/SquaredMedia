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
See [the 84-template migration matrix](docs/react-template-migration-matrix.md)
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

The React frontend never embeds either page. A non-empty `预加载提示` enables a
native React preparation hint after the configured `预加载时间`; a non-empty
`缓冲提示` enables the native buffering hint. Only the normalized delay and
enable flags reach React, so the configured HTML URLs are never requested by
the React player. The React lazyload image is configured from the
`pingfangapi` addon settings in the same MacCMS admin panel.

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
dist/vodops.tar.gz
```

The same command builds the independently reviewed static player archive:

```text
dist/pingfangplayer-player.tar.gz
```

That archive has its own `pingfangplayer-player/` root and contains only the
approved files under `static/player/`: the player HTML, versioned ArtPlayer and
hls.js distributions, and the first-party player JavaScript and CSS. PHP,
hidden files, and links are rejected by `npm run verify:player-release`. The
`npm run deploy` installs the theme, addons, and multiplayer game service, while
`npm run rollback` defaults to the theme and also supports an explicit VodOps
scope. Neither command installs or removes this player archive.

This player is the performance-first HLS profile: it keeps ArtPlayer controls,
playback-rate selection, progress restore, native HLS fallback, bounded hls.js
recovery, and slow-line actions. With the matching theme, the line action only
switches to a uniquely named same-episode link in another MacCMS play group and
restores the position from tab-scoped session storage; ambiguous names fall
back to the episode list. Legacy ad, danmuku, FLV, jQuery, CryptoJS, and PHP
configuration requests are intentionally not loaded on its critical path. Those
existing server files are not included in or deleted by the archive.

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

The `vodops` addon adds a native-admin video data center. Its quality module scans a
fixed `vod_id` range in bounded chunks and records deterministic category,
metadata, poster, playback-source, and exact-duplicate findings in addon-owned
InnoDB tables. Scans never write the video table. After a scan is completed or
stopped, an administrator can explicitly preview and repair one whitelisted
parent-category, year, area, language, or poster field at a time. Each write
stores the old value first, uses that value as an optimistic update guard,
rechecks the same rule, and supports a guarded rollback. It never automatically
repairs, deletes, merges, or optimizes videos. Results can be filtered and exported as a bounded CSV without exposing
raw playback URLs. Scan creation is serialized through an addon-owned InnoDB
mutex row; completed results remain until an administrator explicitly deletes
that VodOps snapshot. The page retains direct access to the latest 50 scans,
shows rows that disappeared inside the bounded source range, and leaves a
server audit log when a result is deleted. Findings link to the native video
editor and show safe structured evidence; running scans cannot be exported,
and internal scan or export failures remain in server logs. A scan can stay
page-driven or explicitly enable the CLI worker: after the admin page is closed,
the server Cron continues bounded chunks without depending on visitor traffic.
An expiring database lease and an external `flock` prevent overlapping workers;
legacy `traffic` tasks are treated as worker tasks and abandoned leases recover
automatically. Front-end responses no longer query VodOps task state.

The same `vodops` archive now contains the former Douban addon as a second
admin module. It keeps the complete local-video search, Douban ID matching,
candidate review, direct and queued synchronization, retry/ignore controls,
score calibration by category, database audit, CSV export, AI-assisted review,
configuration, task statistics, and operation history. The existing
`douban_config`, `douban_vod_meta`, `douban_task`, `douban_log`,
`douban_review_candidate`, `douban_scan`, and `douban_scan_issue` tables keep
their names, so an existing installation continues from its current data.
The legacy `admin/douban/*` actions remain valid, but there is now only one
native “视频数据中心” workbench. Its module tabs switch between quality repair
and Douban metadata without opening a second page shell; the legacy Douban index
redirects into that workbench. Douban sync preserves the current `vod_pic`;
image replacement remains an explicit VodOps repair action.

`npm run verify:release` checks the generated archive before upload: required
MacCMS template files must exist, hidden dotfiles must be absent, and development
directories such as `preview`, `server`, `docker`, `tests`, and `scripts` must
not be included.

Deploy the verified package to a MacCMS server over SSH:

For the operator-run checklist, preflight, post-deployment verification, and
component-specific rollback boundaries, see
[`docs/manual-theme-addon-deployment.md`](docs/manual-theme-addon-deployment.md).

```bash
DEPLOY_HOST=example.com \
DEPLOY_USER=root \
DEPLOY_PORT=22 \
DEPLOY_PATH=/www/wwwroot/example.com/template \
npm run deploy
```

For the production server, the non-secret deployment target is stored in
`scripts/deploy-ping2.env`. This file uses SSH target `144.34.184.95:814`,
distinguishes it from the public site host `www.ping2video.xyz`, and selects the
dedicated local deployment identity:

```bash
source scripts/deploy-ping2.env
npm run deploy
```

For production API releases, use the dedicated command. It loads
`scripts/deploy-ping2.env` itself and never deploys the theme or game service:

```bash
npm run deploy:api -- --check
npm run deploy:api
```

`--check` performs only the SSH safety probe and prints the target and selected
scope. The actual command installs locked npm dependencies when they are absent,
then asks the operator to type `deploy`. It selects `backend` when the API is not
installed or the `pingfangdevice` files/hook need this release, and otherwise
selects `api`. A backend release can update the device-session schema, so confirm
the current database backup before continuing. After a reviewed plan and backup,
approved non-interactive automation may use:

```bash
npm run deploy:api -- --yes
```

If the authoritative database preflight reports an incomplete device baseline,
back up the database and rerun with `npm run deploy:api -- --backend`. API-only
deployment uploads only `dist/pingfangapi.tar.gz`, snapshots only the installed
API addon and application controller, clears the normal MacCMS caches, and runs
bounded site/API loopback checks: at most five serial requests, ten seconds per
request and a shared thirty-second network-request budget. The first deployment
of a workspace fingerprint runs the full release gate; repeated API-only
deployment of the same fingerprint runs only the production
API/controller/device-session tests and builds and verifies only the API archive.

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
the default scope, a failure restores the theme and the current scope's addon,
application, hook, quick-menu, and Cron snapshots. Backend failure restores the
device/API files without touching the theme; API-only failure restores only the
API addon and controller; VodOps-only failure restores its migration snapshot
and Cron. Additive database schema changes are intentionally retained. If
automatic restoration or rollback cache clearing fails, the script exits with
status `95` and preserves the remote snapshot, temporary root, and uploaded
archives. SSH status `255` is also treated as an unknown remote state, so
recovery archives are not deleted.

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

Deployment separately installs the integrated `vodops` archive, both native
admin controllers and the `application/admin/view_new` quality page. It creates
or verifies five `vodops_*` tables and the seven retained `douban_*` tables,
captures the previous VodOps/Douban directories and application payloads in one
`vodops.backup.*` migration snapshot, then retires the standalone `addons/douban`
directory and obsolete public Douban bridge only after that snapshot succeeds.
It then replaces legacy VodOps/Douban shortcuts with one “视频数据中心” entry without
touching unrelated quick-menu entries. Both routes inherit MacCMS admin authentication and
action permissions; without a separately granted route it is available to the
super administrator. Finished audit results can be deleted explicitly from the
page; this cleanup never writes to or deletes from `mac_vod`. Deployment also
removes the obsolete `response_end` hook after the additive worker-column
migration succeeds and installs one idempotent, single-instance Cron entry for
`addons/vodops/bin/vodops-worker.php`. Existing VodOps config values are
preserved. Set `VODOPS_INSTALL_CRON=0` only when the host cannot use user
crontabs and the task will remain page-driven or be invoked by another scheduler.

VodOps scans either all videos or a selected category. Selecting a parent freezes
that category and its current descendants into the task, so later resume and
export keep the original scope; leaf categories scan only themselves. The query
uses resolved `type_id` values rather than the potentially inconsistent
`type_id_1` field.

VodOps settings can optionally create recurring scans every 1–720 hours for a
configured category and batch size. The default interval is `0`, so deployment
does not silently schedule new full-site scans; the Cron still continues worker
tasks that an administrator starts explicitly.

For a VodOps-only server release, load `scripts/deploy-ping2.env` and run
`npm run deploy:vodops`. This scoped command keeps the full local release gates
but uploads and installs only the VodOps archive; it does not replace the theme,
the device addon, the game service, or the standalone player.

After the theme and addons pass verification, deployment installs the versioned
`pingfanggames-server` release under `/opt/pingfanggames`, preserves or creates
the shared ticket secret, updates the addon and Nginx configuration, restarts
the systemd service, and checks `/healthz`. Use `npm run deploy:games` when only
the multiplayer service needs to be updated.

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

Theme rollback keeps the failed live directory as `pingfangvideo.failed.*`, restores
the selected backup to `pingfangvideo`, and clears the same MacCMS cache
directories unless `DEPLOY_CLEAR_CACHE=0` is set. Set
`ROLLBACK_SCOPE=vodops` to restore a selected `vodops.backup.*` directory and
its application payloads. A first merged release can therefore restore the
previous standalone VodOps/Douban directories as well; later backups restore the
previous integrated plugin.
Neither rollback removes or rewinds database tables, so device history,
quality snapshots, repair logs, Douban metadata, tasks, and audit history remain
available for an explicit data-recovery decision.

GitHub Actions installs the pinned npm workspace dependencies with `npm ci` and
the Playwright Chromium runtime, then runs the same release gate on pushes and
pull requests: `npm test`, `npm run lint`, `npm run typecheck:web`,
`npm run test:e2e`, `npm run build:web`, `npm run lint:template`,
`npm run verify:compat`, `npm run verify:preview`, `npm run package`, and
`npm run verify:release`. After verification, the CI
workflow uploads `dist/pingfangvideo.tar.gz` as `pingfangvideo-theme` and
`dist/pingfangdevice.tar.gz` as `pingfangdevice-addon`, plus
`dist/pingfangapi.tar.gz` as `pingfangapi-addon`,
`dist/vodops.tar.gz` as `vodops-addon`,
`dist/pingfangplayer-player.tar.gz` as `pingfangplayer-player` and
`dist/pingfanggames-server.tar.gz` as `pingfanggames-server`, keeping all six
release units separate.

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
