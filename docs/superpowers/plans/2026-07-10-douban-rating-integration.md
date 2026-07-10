# Douban Rating Integration Implementation Plan

> **历史状态（2026-07-17）：** 这是旧版实施计划。当前仓库没有本文所述的
> `addons/douban/**`、Douban 桥接控制器或网关，发布链路也未包含这些文件。
> 请以 `addons/**` 和 `docs/addons.md` 为当前事实源；本文不能证明功能已实现或已部署。

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Douban addon reachable, source live Douban data, and make native MacCMS score sorting use Douban ratings only.

**Architecture:** A small index-controller bridge exposes the addon on a server where addon routing is disabled. A self-hosted gateway normalizes Douban subject and suggestion responses. `vod_douban_score` remains canonical while `vod_score` mirrors it for MacCMS's supported `by="score"` sort.

**Tech Stack:** PHP 8.2, ThinkPHP 5/MacCMS 10, MySQL, ThinkPHP templates, Node.js static release tests, Bash deployment.

---

### Task 1: Bridge And Release Wiring

**Files:**
- Create: `addons/douban/bridge/Douban.php`
- Create: `addons/douban/bridge/DoubanEndpoint.php`
- Modify: `scripts/deploy-theme.sh`
- Modify: `scripts/verify-release.mjs`
- Modify: `tests/template.test.mjs`

- [ ] **Step 1: Write failing release assertions**

Add assertions requiring both bridge files, `application/index/controller/Douban.php` deployment, `extend/douban.php` deployment, and bridge-based view URLs:

```js
assert.match(doubanAddonView, /url\('douban\/sync'\)/);
assert.match(deployScript, /application\/index\/controller\/Douban\.php/);
assert.match(deployScript, /extend\/douban\.php/);
```

- [ ] **Step 2: Run the test and verify RED**

Run: `npm test`

Expected: FAIL because the bridge files and deployment paths do not exist.

- [ ] **Step 3: Implement the bridge and deployment copy**

The controller bridge sets addon route parameters before delegating to the existing addon controller. The gateway bridge requires `addons/douban/service/DoubanGateway.php` and returns JSON. Deployment backs up existing target files before copying both bridges.

- [ ] **Step 4: Run focused verification and verify GREEN**

Run:

```bash
npm test
php -l addons/douban/bridge/Douban.php
php -l addons/douban/bridge/DoubanEndpoint.php
bash -n scripts/deploy-theme.sh
```

Expected: all commands exit 0.

### Task 2: Live Douban Gateway

**Files:**
- Create: `addons/douban/service/DoubanGateway.php`
- Modify: `addons/douban/bridge/DoubanEndpoint.php`
- Modify: `tests/template.test.mjs`

- [ ] **Step 1: Write failing normalization assertions**

Require the subject endpoint, suggestion endpoint, bounded timeout, and normalized rating fields:

```js
assert.match(doubanGateway, /rexxar\/api\/v2\/movie/);
assert.match(doubanGateway, /subject_suggest/);
assert.match(doubanGateway, /rating_count/);
assert.match(doubanGateway, /vod_douban_score/);
```

- [ ] **Step 2: Run the test and verify RED**

Run: `npm test`

Expected: FAIL because `DoubanGateway.php` does not exist.

- [ ] **Step 3: Implement normalization and request handling**

Implement these public methods:

```php
public static function subject(string $doubanId): array;
public static function search(string $query, int $limit = 5): array;
public static function normalizeSubject(array $data): array;
public static function normalizeCandidates(array $rows): array;
```

Subject output includes `vod_name`, `vod_pic`, `vod_year`, `vod_area`, `vod_lang`, `vod_class`, `vod_director`, `vod_actor`, `vod_content`, `vod_douban_score`, `vod_score`, `vod_score_num`, and `vod_total`.

- [ ] **Step 4: Verify syntax and live response**

Run:

```bash
php -l addons/douban/service/DoubanGateway.php
php -l addons/douban/bridge/DoubanEndpoint.php
php -r 'require "addons/douban/service/DoubanGateway.php"; print_r(addons\douban\service\DoubanGateway::normalizeSubject(["id"=>"1295644","title"=>"这个杀手不太冷","rating"=>["value"=>9.4,"count"=>2562776]]));'
```

Expected: output contains `vod_douban_score => 9.4` and `vod_score => 9.4`.

### Task 3: Matching, Score Mapping, And Calibration

**Files:**
- Modify: `addons/douban/service/DoubanData.php`
- Modify: `addons/douban/controller/Index.php`
- Modify: `addons/douban/view/index/index.html`
- Modify: `tests/template.test.mjs`

- [ ] **Step 1: Write failing service assertions**

Require canonical score mapping, compatibility mirroring, candidate matching, and calibration:

```js
assert.match(doubanDataService, /vod_douban_score/);
assert.match(doubanDataService, /calibrateScores/);
assert.match(doubanDataService, /douban_review_candidate/);
assert.match(doubanAddonController, /DoubanData::calibrateScores/);
```

- [ ] **Step 2: Run the test and verify RED**

Run: `npm test`

Expected: FAIL because calibration and real candidate matching are missing.

- [ ] **Step 3: Implement minimal matching and calibration**

`MATCH_DOUBAN_ID` calls the configured gateway with `q=<vod_name>`. Exact normalized title plus exact year auto-confirms the ID; other candidates are persisted and marked `REVIEW`; empty results become `NOT_FOUND`.

`calibrateScores()` executes:

```sql
UPDATE mac_vod SET vod_score = vod_douban_score WHERE vod_douban_score > 0 AND vod_score <> vod_douban_score;
UPDATE mac_vod SET vod_score = 0 WHERE IFNULL(vod_douban_score, 0) = 0 AND vod_score <> 0;
```

using the configured table prefix, returns affected counts, and records an admin log.

- [ ] **Step 4: Run service verification and verify GREEN**

Run:

```bash
npm test
php -l addons/douban/service/DoubanData.php
php -l addons/douban/controller/Index.php
```

Expected: all commands exit 0.

### Task 4: Frontend Semantics, Full Verification, And Deployment

**Files:**
- Modify: `template/pingfangvideo/html/public/score.html`
- Modify: `template/pingfangvideo/html/public/star.html`
- Modify: `README.md`
- Modify: `tests/template.test.mjs`

- [ ] **Step 1: Write failing wording assertions**

```js
assert.match(scorePartial, /豆瓣评分/);
assert.match(starPartial, /豆瓣评分/);
```

- [ ] **Step 2: Run the test and verify RED**

Run: `npm test`

Expected: FAIL because the frontend still says comprehensive/local score.

- [ ] **Step 3: Update score wording and operating documentation**

Keep templates on `vod_score` because it is the MacCMS sort-compatible Douban mirror. Label it as Douban, document the management route, calibration action, manual ID workflow, and worker sequence.

- [ ] **Step 4: Run complete local verification**

Run:

```bash
npm test
npm run lint:template
npm run verify:compat
npm run verify:preview
npm run package
npm run verify:release
```

Expected: all commands exit 0 and release verification includes both Douban bridge files and `DoubanGateway.php`.

- [ ] **Step 5: Deploy and verify production**

Run:

```bash
source scripts/deploy-ping2.env
npm run deploy
```

Verify the bridge route is no longer 404, `/extend/douban.php?id=1295644` returns normalized JSON, run score calibration, sync one known `vod_id`, and query the database to confirm `vod_douban_score = vod_score`.
