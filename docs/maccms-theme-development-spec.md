# MacCMS Theme Development Spec

Last checked: 2026-06-16

This repository develops the `pingfangvideo` theme as a MacCMS V10 theme. All
theme changes must follow the official MacCMS theme documentation first:

- Theme entry: https://www.maccms.la/theme
- Using a theme: https://www.maccms.la/theme/using-a-theme
- Writing a theme: https://www.maccms.la/theme/writing-a-theme
- Theme structure: https://www.maccms.la/theme/structure
- Video templates and tags: https://www.maccms.la/theme/theme-vod
- Type/category tags: https://www.maccms.la/theme/theme-type
- Global tags: https://www.maccms.la/theme/tags-global

When a change touches another MacCMS module, read the matching official module
page from the theme documentation before editing.

## Scope

This spec applies to:

- `template/pingfangvideo/**`
- local preview files that mirror MacCMS behavior: `preview/**`, `server/**`
- verification scripts and tests that protect MacCMS compatibility

Local preview behavior can help development, but production theme files must
remain valid MacCMS templates.

## Required Theme Structure

Keep the theme under `template/pingfangvideo/` and preserve the standard MacCMS
theme shape:

```text
template/pingfangvideo/
  info.ini
  ads/
  css/
  js/
  images/
  html/
    public/
    index/
    vod/
    art/
    topic/
    actor/
    role/
    website/
    user/
    comment/
    gbook/
    book/
    label/
    map/
    rss/
    plot/
```

Do not place production static assets in the CMS root. Do not implement a theme
admin backend inside the theme directory; use MacCMS plugin extension patterns
instead.

## Public Includes

`html/public/include.html`, `head.html`, `foot.html`, and `paging.html` are
shared runtime surfaces. Keep them compatible with MacCMS:

- load assets through MacCMS runtime paths such as `{$maccms.path}` or
  `{$maccms.path_tpl}`
- keep the MacCMS JavaScript config available for `home.js`
- include MacCMS core JavaScript dependencies needed for history, user log,
  favorite, hits, comments, score, digg, and timing hooks
- never reference `localhost`, `preview/data.json`, `server/index.php`, Docker,
  npm commands, or other development-only paths from production theme files

This repo intentionally normalizes the JavaScript `maccms.path` value without a
trailing slash. Preserve that behavior unless a real MacCMS runtime test proves
it wrong.

## Template Syntax Rules

Use documented MacCMS/ThinkPHP template syntax:

- loop tags have explicit open and close tags, such as
  `{maccms:vod ...}{/maccms:vod}`
- inside MacCMS list tags, item fields use `$vo`, for example `{$vo.vod_name}`
- current page objects use `$obj`, for example `{$obj.type_name}`
- request parameters use `$param`, for example `{$param['area']}`
- global site values use `$maccms`, for example `{$maccms.site_name}`
- image URLs must pass through `mac_url_img` when outputting video, article,
  topic, or category images
- internal URLs must use helpers such as `mac_url`, `mac_url_type`,
  `mac_url_vod_detail`, `mac_url_vod_play`, and `mac_url_vod_down`

Do not invent tag parameters. If a parameter is not listed in the relevant
official page, do not rely on it.

## Video List And Category Rules

For `html/vod/type.html`:

- use `maccms:vod` with `type="current"` for the current category list
- use `paging="yes"` when the list needs pagination
- use documented sort fields only: `time`, `hits`, `score`, and other fields
  listed by the official video tag page

For `html/vod/show.html`:

- use `maccms:vod` with `type="all"` or the documented filtered scope
- include `paging="yes"` for paged result lists
- include `pageurl="vod/show"` on paged filtered lists so pagination URLs keep
  the correct route
- generate filter links through `mac_url('vod/show', ...)` or
  `mac_url_type(..., 'show')`, matching the route being rendered

For `html/label/categories.html`:

- use `maccms:type` for category data
- use only documented `maccms:type` parameters: `order`, `by`, `start`, `num`,
  `ids`, `parent`, `mid`, `not`, and `cachetime`
- do not use `paging="yes"` on `maccms:type`; the official category tag docs do
  not define that parameter

## Filter And Sorting Safety

Do not pass raw request parameters directly into MacCMS tag attributes when the
value controls query shape or ordering. Prefer fixed branches:

```html
{if condition="$param.by eq 'hits'"}
{maccms:vod by="hits" ...}
...
{elseif condition="$param.by eq 'score'"}
{maccms:vod by="score" ...}
...
{else}
{maccms:vod by="time" ...}
...
{/if}
```

This keeps the template aligned with documented sort fields and avoids exposing
raw request data to query parameters.

## Module Compatibility

Keep standard MacCMS route files present even when the theme provides simple
fallback content. At minimum preserve the existing coverage for:

- home: `html/index/index.html`
- video: `html/vod/type.html`, `show.html`, `search.html`, `detail.html`,
  `play.html`, `player.html`, `down.html`, `copyright.html`, password pages,
  RSS, and plot
- public: `include.html`, `head.html`, `foot.html`, `paging.html`,
  `jump.html`, `msg.html`, `verify.html`, interaction partials
- comments, gbook/book, user center, label pages, RSS/map pages
- fallback module pages for article, topic, actor, role, plot, and website

When adding or removing a route file, update tests and compatibility checks in
the same change.

## Development Workflow

Before editing:

1. Identify the touched MacCMS module.
2. Read the relevant official page under `https://www.maccms.la/theme`.
3. Inspect the existing local template pattern.
4. Make the smallest compatible change.
5. Update tests or preview verification when behavior changes.

After editing, run the relevant commands:

```bash
npm test
npm run lint:template
npm run verify:compat
npm run verify:preview
```

For release work, also run:

```bash
npm run package
npm run verify:release
```

## Definition Of Done

A change is not ready unless:

- production theme files use MacCMS runtime paths and documented tags
- list tags are balanced
- shared head and foot includes remain present on ordinary HTML pages
- pagination uses documented list tag behavior and route-specific `pageurl`
  where required
- no development-only references leak into `template/pingfangvideo/**`
- tests, lint, compatibility, and preview checks pass or the exact blocker is
  documented
