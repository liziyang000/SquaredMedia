# Douban Rating Integration Design

> **历史状态（2026-07-17）：** 这是首次落地时的设计快照。当前实现已经纳入
> `addons/douban/**` 和发布链路，但控制器源码已迁入标准 `application/` 载荷，
> 默认数据源改为插件内置 `internal` 网关，不再部署根目录 `extend/douban.php`。
> 请以代码和 `docs/addons.md` 为当前事实源。

## Goal

Make the deployed Douban addon usable end to end and make every MacCMS
"score" sort use Douban ratings only.

## Rating Semantics

- `vod_douban_score` is the canonical Douban rating.
- `vod_score` mirrors `vod_douban_score` because MacCMS only supports
  `by="score"` for native score sorting.
- Existing rows with a positive `vod_douban_score` are copied into
  `vod_score`.
- Existing rows without a Douban rating have `vod_score` reset to `0`, so
  unrated videos sort after rated videos.
- Frontend score labels use Douban wording. Local score and Douban score are
  not mixed.

## Admin Access

The server has ThinkPHP addon routes disabled, so the addon ships a small
`app\index\controller\Douban` bridge. The deploy script installs the bridge
under `application/index/controller/Douban.php`. The addon view uses bridge
URLs such as `url('douban/sync')` instead of `addon_url(...)`.

The bridge delegates to the addon controller and keeps the existing
administrator-session checks. The management page remains unavailable to
non-admin sessions.

## Data Source

The addon ships a self-hosted `bridge/DoubanEndpoint.php` gateway source.
Deployment copies it to `extend/douban.php` in the MacCMS root.

- `id=<douban_id>` requests subject details from Douban's mobile JSON endpoint
  and normalizes them into the existing addon contract.
- `q=<title>` requests Douban subject suggestions and returns normalized
  candidates.
- Responses are JSON, use bounded timeouts, and never expose upstream response
  bodies in errors.

The gateway normalizes title, poster, year, countries, languages, genres,
directors, actors, introduction, episode count, rating value, and rating count.

## Matching And Sync

Videos with an existing addon `douban_id` or MacCMS `vod_douban_id` enqueue a
`SYNC_DOUBAN` task directly.

Videos without an ID enqueue `MATCH_DOUBAN_ID`:

- Exact normalized title and year matches are confirmed automatically.
- Ambiguous candidates are saved in `douban_review_candidate` and marked
  `REVIEW`.
- Empty results are marked `NOT_FOUND`.

A successful sync updates MacCMS video metadata, writes both
`vod_douban_score` and its `vod_score` compatibility mirror, records the
rating count, and schedules the next refresh. Locked introductions are not
overwritten.

## Existing Data Calibration

Calibration is an explicit admin action and service method rather than a
silent install-time update. It runs two indexed SQL updates and reports the
affected row counts:

1. Copy positive `vod_douban_score` values to `vod_score`.
2. Reset `vod_score` to `0` where `vod_douban_score` is missing or zero.

The action is administrator-only and writes an operation log.

## Verification

- Static tests require the bridge, gateway, deployment wiring, score mapping,
  calibration action, and bridge URLs.
- PHP and shell syntax checks cover all new executable files.
- Repository verification runs `npm test`, `npm run lint:template`,
  `npm run verify:compat`, and `npm run verify:preview`.
- Release packaging verifies the bridge and gateway are included.
- After deployment, HTTP checks verify the management bridge no longer
  returns 404, the gateway returns normalized JSON, and a known video sync
  writes matching `vod_douban_score` and `vod_score` values.
