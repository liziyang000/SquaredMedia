import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const themeRoot = path.join(root, "template", "pingfangvideo");
const addonRoot = path.join(root, "addons", "pingfangdevice");
const fullLetterFilter = "A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z,0~9";
const nonAdultVodTypeScope = "42,47,48,57,111";
const assetVersionPlaceholder = "__PINGFANG_ASSET_VERSION__";

const requiredFiles = [
  "info.ini",
  "css/style.css",
  "images/site-logo.png",
  "js/gsap.min.js",
  "js/app.js",
  "html/public/include.html",
  "html/public/head.html",
  "html/public/foot.html",
  "html/public/paging.html",
  "html/public/jump.html",
  "html/public/msg.html",
  "html/public/verify.html",
  "html/public/digg.html",
  "html/public/score.html",
  "html/public/star.html",
  "html/public/vod_card.html",
  "html/comment/index.html",
  "html/comment/ajax.html",
  "html/gbook/index.html",
  "html/book/index.html",
  "html/book/report.html",
  "html/index/index.html",
  "html/label/categories.html",
  "html/label/history.html",
  "html/label/hot.html",
  "html/label/videos.html",
  "html/pingfangdevice/index.html",
  "html/topic/index.html",
  "html/topic/detail.html",
  "html/art/index.html",
  "html/art/confirm.html",
  "html/art/detail.html",
  "html/art/detail_pwd.html",
  "html/art/rss.html",
  "html/art/search.html",
  "html/art/type.html",
  "html/art/show.html",
  "html/map/rss.html",
  "html/map/baidu.html",
  "html/map/google.html",
  "html/rss/rss.html",
  "html/rss/baidu.html",
  "html/rss/google.html",
  "html/vod/type.html",
  "html/vod/show.html",
  "html/vod/search.html",
  "html/vod/detail.html",
  "html/vod/confirm.html",
  "html/vod/detail_pwd.html",
  "html/vod/play.html",
  "html/vod/player.html",
  "html/vod/player_pwd.html",
  "html/vod/down.html",
  "html/vod/downer_pwd.html",
  "html/vod/copyright.html",
  "html/vod/plot.html",
  "html/vod/rss.html",
  "html/plot/uindex.html",
  "html/plot/udetail.html",
  "html/actor/index.html",
  "html/actor/detail.html",
  "html/actor/search.html",
  "html/actor/show.html",
  "html/actor/type.html",
  "html/role/index.html",
  "html/role/detail.html",
  "html/role/show.html",
  "html/website/index.html",
  "html/website/detail.html",
  "html/website/search.html",
  "html/website/show.html",
  "html/website/type.html",
  "html/user/head.html",
  "html/user/foot.html",
  "html/user/include.html",
  "html/user/favs.html",
  "html/user/index.html",
  "html/user/login.html",
  "html/user/plays.html",
  "html/user/reg.html",
  "html/user/findpass.html",
];

const requiredRootFiles = [
  "docker-compose.yml",
  "docker/php/Dockerfile",
  "docker/php/php.ini",
  "README.md",
  ".github/workflows/ci.yml",
  "addons/pingfangdevice/Pingfangdevice.php",
  "addons/pingfangdevice/bridge/Pingfangdevice.php",
  "addons/pingfangdevice/config.php",
  "addons/pingfangdevice/controller/Index.php",
  "addons/pingfangdevice/info.ini",
  "addons/pingfangdevice/install.sql",
  "addons/pingfangdevice/service/DeviceSession.php",
  "addons/pingfangdevice/view/index/index.html",
  "preview/data.json",
  "scripts/lint-template.mjs",
  "scripts/deploy-theme.sh",
  "scripts/rollback-theme.sh",
  "scripts/package-theme.mjs",
  "scripts/verify-compat.mjs",
  "scripts/verify-preview.mjs",
  "scripts/verify-release.mjs",
  "server/index.php",
  "server/lib/data.php",
  "server/lib/render.php",
];

for (const file of requiredRootFiles) {
  assert.ok(existsSync(path.join(root, file)), `${file} should exist`);
}

for (const file of requiredFiles) {
  assert.ok(existsSync(path.join(themeRoot, file)), `${file} should exist`);
}

function readThemeFile(file) {
  return readFileSync(path.join(themeRoot, file), "utf8");
}

function readAddonFile(file) {
  return readFileSync(path.join(addonRoot, file), "utf8");
}

const info = readThemeFile("info.ini");
assert.match(info, /name\s*=\s*PingFang Video/i);
assert.match(info, /adsdir\s*=\s*ads/i);

const dockerfile = readFileSync(path.join(root, "docker/php/Dockerfile"), "utf8");
assert.match(dockerfile, /FROM php:8\.4-apache/);
assert.match(dockerfile, /pdo_mysql/);
assert.match(dockerfile, /php\.ini/);

const phpIni = readFileSync(path.join(root, "docker/php/php.ini"), "utf8");
assert.match(phpIni, /expose_php\s*=\s*Off/);
assert.match(phpIni, /display_errors\s*=\s*Off/);
assert.match(phpIni, /opcache\.enable\s*=\s*1/);

const compose = readFileSync(path.join(root, "docker-compose.yml"), "utf8");
assert.match(compose, /php84/);
assert.match(compose, /template\/pingfangvideo/);
assert.match(compose, /healthcheck:/);

const readme = readFileSync(path.join(root, "README.md"), "utf8");
assert.match(readme, /PHP 8\.4/);
assert.match(readme, /npm run lint:template/);
assert.match(readme, /npm run package/);
assert.match(readme, /npm run verify:release/);
assert.match(readme, /npm run deploy/);
assert.match(readme, /npm run rollback/);
assert.match(readme, /DEPLOY_HOST/);
assert.match(readme, /DEPLOY_PATH/);
assert.match(readme, /DEPLOY_CLEAR_CACHE/);
assert.match(readme, /ROLLBACK_BACKUP/);
assert.match(readme, /GitHub Actions/);
assert.match(readme, /登录设备管理/);
assert.match(readme, /pingfangdevice/);
assert.match(readme, /最多 3 台/);
assert.match(readme, /server\/index\.php/);
assert.match(readme, /MacCMS/);

const include = readThemeFile("html/public/include.html");
assert.match(include, /\{\$maccms\.path\}static\/js\/jquery\.js/);
assert.match(include, /\{\$maccms\.path\}static\/js\/home\.js/);
assert.match(include, /css\/style\.css\?v=/);
assert.match(include, /"path":"\{:\s*rtrim\(\$maccms\['path'\], '\/'\)\}"/);
assert.match(include, /"aid":"\{\$maccms\.aid\}"/);
assert.match(include, new RegExp(`css/style\\.css\\?v=${assetVersionPlaceholder}`));
assert.doesNotMatch(include, /css\/style\.css\?v=20260626"/);
assert.doesNotMatch(include, /css\/style\.css\?v=20260621/);
assert.doesNotMatch(include, /css\/style\.css\?v=20260615/);
assert.doesNotMatch(include, /css\/style\.css\?v=20260616/);
assert.doesNotMatch(include, /css\/style\.css\?v=20260617/);
assert.doesNotMatch(include, /css\/style\.css\?v=20260618/);
assert.doesNotMatch(include, /css\/style\.css\?v=20260619/);
assert.doesNotMatch(include, /css\/style\.css\?v=20260620/);
assert.doesNotMatch(include, /__ROOT__/);

const head = readThemeFile("html/public/head.html");
assert.match(head, /\[seo_title\]/);
assert.match(head, /\[seo_keywords\]/);
assert.match(head, /\[seo_description\]/);
assert.match(head, /site-logo\.png/);
assert.match(head, /brand-logo/);
assert.match(head, /class="brand-logo"[^>]*width="136"[^>]*height="58"/);
assert.match(head, /class="brand-logo"[^>]*decoding="async"/);
assert.doesNotMatch(head, /brand-mark">PF/);
assert.doesNotMatch(head, /brand-text/);
assert.match(head, /mac_url\('label\/categories'\)/);
assert.match(head, /mac_url\('website\/index'\)/);
assert.match(head, /<a href="\{:mac_url\('website\/index'\)\}">游戏<\/a>/);
assert.match(head, /class="mobile-category-entry"/);
assert.match(head, /<a class="mobile-category-entry" href="\{:mac_url\('label\/categories'\)\}">分类<\/a>/);
assert.match(head, /class="mobile-shortcuts"/);
assert.match(head, /<a class="mobile-game-entry" href="\{:mac_url\('website\/index'\)\}">游戏<\/a>/);
assert.match(head, /mac_url\('user\/plays'\)/);
assert.match(head, /mac_url\('user\/favs'\)/);
assert.match(head, /class="user-menu"/);
assert.match(head, /\$user\.user_id/);
assert.match(head, /mac_url\('user\/login'\)/);
assert.match(head, /mac_url\('user\/index'\)/);
assert.match(head, /url\('pingfangdevice\/index'\)/);
assert.match(head, /url\('pingfangdevice\/logout'\)/);
assert.match(head, /data-avatar-random/);
assert.match(head, /data-avatar-name="\{\$user\.user_name\|mac_default='用户'\}"/);
assert.match(head, /class="user-avatar-letter"/);
assert.match(head, /\{if condition="\$user\.user_name neq ''"\}\{\$user\.user_name\|mac_substring=1\}\{else\/\}用\{\/if\}/);
assert.doesNotMatch(head, /user\.user_portrait/);
assert.match(head, /class="user-dropdown"/);
assert.match(head, />收藏</);
assert.match(head, />播放记录</);
assert.match(head, />登录设备</);
assert.match(head, />退出登录</);
assert.doesNotMatch(head, /class="hot-search-panel"/);
assert.doesNotMatch(head, /热搜榜/);
assert.doesNotMatch(head, /\$maccms\.search_hot/);
assert.doesNotMatch(head, /\{maccms:foreach name=":explode\(',',\$maccms\.search_hot\)" id="vo2"/);
assert.doesNotMatch(head, /mac_url\('vod\/search',\['wd'=>\$vo2\]\)/);
assert.doesNotMatch(head, /class="history-link mac_history" href="javascript:;"/);
assert.doesNotMatch(head, /\{maccms:type ids="parent" order="asc" by="sort" num=/);

const foot = readThemeFile("html/public/foot.html");
assert.match(foot, /mac_url\('map\/google'\)/);
assert.match(foot, /mac_url\('gbook\/index'\)/);
assert.match(foot, /mac_url\('map\/rss'\)/);
assert.match(foot, /js\/gsap\.min\.js\?v=3\.15\.0/);
assert.match(foot, new RegExp(`js/gsap\\.min\\.js\\?v=3\\.15\\.0[\\s\\S]*js/app\\.js\\?v=${assetVersionPlaceholder}`));
assert.doesNotMatch(foot, /js\/app\.js\?v=20260621/);
assert.match(foot, new RegExp(`js/app\\.js\\?v=${assetVersionPlaceholder}`));
assert.doesNotMatch(foot, /js\/app\.js\?v=20260615/);
assert.doesNotMatch(foot, /js\/app\.js\?v=20260616/);
assert.doesNotMatch(foot, /js\/app\.js\?v=20260618/);
assert.doesNotMatch(foot, /js\/app\.js\?v=20260619/);
assert.doesNotMatch(foot, /mac_url\('map\/index'\)/);
assert.doesNotMatch(foot, /mac_url\('rss\/index'\)/);

const gbookPage = readThemeFile("html/gbook/index.html");
assert.match(gbookPage, /seo_title="留言反馈"/);
assert.match(gbookPage, /mac_url\('gbook\/save'\)/);
assert.match(gbookPage, /name="gbook_content"/);
assert.match(gbookPage, /\{include file="public\/foot" \/\}/);

const bookPage = readThemeFile("html/book/index.html");
assert.match(bookPage, /seo_title="留言反馈"/);
assert.match(bookPage, /mac_url\('gbook\/save'\)/);
assert.match(bookPage, /name="gbook_content"/);
assert.match(bookPage, /\{include file="public\/foot" \/\}/);

const bookReportPage = readThemeFile("html/book/report.html");
assert.match(bookReportPage, /seo_title="报错反馈"/);
assert.match(bookReportPage, /mac_url\('gbook\/save'\)/);
assert.match(bookReportPage, /name="gbook_content"/);
assert.match(bookReportPage, /报错反馈/);

const commentIndexPage = readThemeFile("html/comment/index.html");
assert.match(commentIndexPage, /seo_title="评论"/);
assert.match(commentIndexPage, /comment-list/);
assert.match(commentIndexPage, /mac_url\('comment\/save'\)/);
assert.match(commentIndexPage, /name="comment_content"/);

const commentAjaxPage = readThemeFile("html/comment/ajax.html");
assert.match(commentAjaxPage, /comment-list/);
assert.match(commentAjaxPage, /maccms:comment/);
assert.doesNotMatch(commentAjaxPage, /include file="public\/head"/);

const pagingPage = readThemeFile("html/public/paging.html");
assert.match(pagingPage, /data-page-jump/);
assert.match(pagingPage, /data-page-template="\{\$__PAGING__\.page_url\|mac_url_page='__PAGE__'\}"/);
assert.match(pagingPage, /class="page-jump"/);
assert.match(pagingPage, /class="page-jump-input"/);
assert.match(pagingPage, /class="page-jump-submit"/);
assert.match(pagingPage, /type="number"/);
assert.match(pagingPage, /min="1"/);
assert.match(pagingPage, /max="\{\$__PAGING__\.page_total\}"/);
assert.match(pagingPage, />跳转</);

const jumpPage = readThemeFile("html/public/jump.html");
assert.match(jumpPage, /页面将在 <strong>1<\/strong> 秒后自动跳转/);
assert.match(jumpPage, /setTimeout[\s\S]*1000/);
assert.doesNotMatch(jumpPage, /<strong>\{\$wait\}<\/strong>/);
assert.doesNotMatch(jumpPage, /Number\("\{\$wait\}"\) \* 1000/);

const categoriesPage = readThemeFile("html/label/categories.html");
assert.match(categoriesPage, /seo_title="分类"/);
assert.match(categoriesPage, /category-index/);
assert.doesNotMatch(categoriesPage, /class="category-search"/);
assert.doesNotMatch(categoriesPage, /data-category-search/);
assert.doesNotMatch(categoriesPage, /data-category-search-input/);
assert.doesNotMatch(categoriesPage, /placeholder="搜索分类"/);
assert.doesNotMatch(categoriesPage, /data-category-search-empty/);
assert.doesNotMatch(categoriesPage, /data-category-name="\{\$type\.type_name\}"/);
assert.match(categoriesPage, /\{maccms:type ids="parent" order="asc" by="sort"/);
assert.match(categoriesPage, /num="100"/);
assert.doesNotMatch(categoriesPage, /paging="yes"/);
assert.match(categoriesPage, /category-tile/);
assert.match(categoriesPage, /<a class="category-hit" href="\{:mac_url_type\(\$type\)\}"/);
assert.match(categoriesPage, /aria-label="进入\{\$type\.type_name\}"/);
assert.match(categoriesPage, /class="category-sort sort-latest"/);
assert.match(categoriesPage, /class="category-sort sort-hot"/);
assert.match(categoriesPage, /class="category-sort sort-score"/);
assert.match(categoriesPage, /by'=>'time'/);
assert.match(categoriesPage, /by'=>'hits'/);
assert.match(categoriesPage, /by'=>'score'/);
assert.doesNotMatch(categoriesPage, /\{include file="public\/paging" \/\}/);

const historyPage = readThemeFile("html/label/history.html");
assert.match(historyPage, /seo_title="观看记录"/);
assert.match(historyPage, /history-timeline/);
assert.match(historyPage, /timeline-item/);
assert.match(historyPage, /data-history-source/);

const hotLabelPage = readThemeFile("html/label/hot.html");
assert.match(hotLabelPage, /seo_title="热播榜"/);
assert.match(hotLabelPage, new RegExp(`\\{maccms:vod num="24" paging="yes" pageurl="label/hot" type="${nonAdultVodTypeScope}" order="desc" by="hits" id="vo"\\}`));
assert.doesNotMatch(hotLabelPage, /\{maccms:vod[^}]*type="all"[^}]*by="hits"/);
assert.match(hotLabelPage, /include file="public\/vod_card"/);
assert.match(hotLabelPage, /include file="public\/paging"/);
assert.match(hotLabelPage, /\{include file="public\/foot" \/\}/);

const videosLabelPage = readThemeFile("html/label/videos.html");
assert.match(videosLabelPage, /seo_title="影片库"/);
assert.match(videosLabelPage, /\{maccms:vod num="24" paging="yes" pageurl="label\/videos" type="all" order="desc" by="time" id="vo"\}/);
assert.match(videosLabelPage, /include file="public\/vod_card"/);
assert.match(videosLabelPage, /include file="public\/paging"/);
assert.match(videosLabelPage, /\{include file="public\/foot" \/\}/);

const userIndexPage = readThemeFile("html/user/index.html");
assert.match(userIndexPage, /mac_url\('user\/plays'\)/);
assert.match(userIndexPage, /mac_url\('user\/favs'\)/);
assert.match(userIndexPage, /url\('pingfangdevice\/index'\)/);
assert.match(userIndexPage, /登录设备管理/);
assert.doesNotMatch(userIndexPage, /mac_url\('user\/downs'\)/);

const userLoginPage = readThemeFile("html/user/login.html");
assert.match(userLoginPage, /action="\{:\s*url\('pingfangdevice\/login'\)\}"/);
assert.match(userLoginPage, /data-login-form/);
assert.match(userLoginPage, /data-success-redirect="\{\$maccms\.path\}"/);

const devicePage = readThemeFile("html/pingfangdevice/index.html");
assert.match(devicePage, /\{include file="public\/head" seo_title="登录设备管理"/);
assert.match(devicePage, /登录设备管理/);
assert.match(devicePage, /最多 3 台设备/);
assert.match(devicePage, /\{volist name="device_list" id="vo"\}/);
assert.match(devicePage, /当前设备/);
assert.match(devicePage, /最近登录时间/);
assert.match(devicePage, /data-device-revoke/);
assert.match(devicePage, /url\('pingfangdevice\/revoke'\)/);
assert.match(devicePage, /\{include file="public\/foot" \/\}/);

const userPlaysPage = readThemeFile("html/user/plays.html");
assert.match(userPlaysPage, /\{include file="user\/head" \/\}/);
assert.match(userPlaysPage, /seo_title="播放记录"|我的播放|播放记录/);
assert.match(userPlaysPage, /\{volist name="list" id="vo"\}/);
assert.match(userPlaysPage, /\{\$vo\.ulog_id\}/);
assert.match(userPlaysPage, /\{\$vo\.data\.link\}/);
assert.match(userPlaysPage, /\{\$vo\.data\.name\}/);
assert.match(userPlaysPage, /record-poster/);
assert.match(userPlaysPage, /\{\$vo\.data\.pic\|mac_url_img\}/);
assert.match(userPlaysPage, /alt="\{\$vo\.data\.name\}"/);
assert.match(userPlaysPage, /loading="lazy" decoding="async" width="160" height="240" sizes="76px"/);
assert.match(userPlaysPage, /\{\$vo\.ulog_sid\}/);
assert.match(userPlaysPage, /\{\$vo\.ulog_nid\}/);
assert.match(userPlaysPage, /user\/ulog_del/);
assert.match(userPlaysPage, /type:\s*4/);
assert.doesNotMatch(userPlaysPage, /user\/downs|user\/buy|user\/pay/);

const userFavsPage = readThemeFile("html/user/favs.html");
assert.match(userFavsPage, /\{include file="user\/head" \/\}/);
assert.match(userFavsPage, /seo_title="收藏记录"|我的收藏|收藏记录/);
assert.match(userFavsPage, /favorite-page/);
assert.match(userFavsPage, /favorite-toolbar/);
assert.match(userFavsPage, /favorite-list/);
assert.match(userFavsPage, /favorite-card/);
assert.match(userFavsPage, /favorite-status/);
assert.match(userFavsPage, />已收藏</);
assert.match(userFavsPage, /favorite-empty/);
assert.match(userFavsPage, /\{volist name="list" id="vo"\}/);
assert.match(userFavsPage, /\{\$vo\.ulog_id\}/);
assert.match(userFavsPage, /\{\$vo\.data\.link\}/);
assert.match(userFavsPage, /\{\$vo\.data\.name\}/);
assert.match(userFavsPage, /record-poster/);
assert.match(userFavsPage, /\{\$vo\.data\.pic\|mac_url_img\}/);
assert.match(userFavsPage, /alt="\{\$vo\.data\.name\}"/);
assert.match(userFavsPage, /loading="lazy" decoding="async" width="160" height="240" sizes="104px"/);
assert.match(userFavsPage, /user\/ulog_del/);
assert.match(userFavsPage, /type:\s*2/);
assert.match(userFavsPage, /PingFangVideo\.clearFavoriteCache/);
assert.doesNotMatch(userFavsPage, /user\/downs|user\/buy|user\/pay/);

const fallbackPages = [
  ["html/topic/index.html", "专题"],
  ["html/topic/detail.html", "专题"],
  ["html/art/index.html", "文章"],
  ["html/art/confirm.html", "文章"],
  ["html/art/detail.html", "文章"],
  ["html/art/detail_pwd.html", "文章"],
  ["html/art/search.html", "文章"],
  ["html/art/type.html", "文章"],
  ["html/art/show.html", "文章"],
  ["html/plot/uindex.html", "剧情"],
  ["html/plot/udetail.html", "剧情"],
  ["html/actor/index.html", "演员"],
  ["html/actor/detail.html", "演员"],
  ["html/actor/search.html", "演员"],
  ["html/actor/show.html", "演员"],
  ["html/actor/type.html", "演员"],
  ["html/role/index.html", "角色"],
  ["html/role/detail.html", "角色"],
  ["html/role/show.html", "角色"],
  ["html/website/index.html", "游戏"],
  ["html/website/detail.html", "游戏"],
  ["html/website/search.html", "游戏"],
  ["html/website/show.html", "游戏"],
  ["html/website/type.html", "游戏"],
];

for (const [file, label] of fallbackPages) {
  const page = readThemeFile(file);
  assert.match(page, new RegExp(`seo_title="${label}`));
  assert.match(page, /module-fallback/);
  assert.match(page, /mac_url\('vod\/show'\)/);
}

const artRssPage = readThemeFile("html/art/rss.html");
assert.match(artRssPage, /maccms:art/);
assert.match(artRssPage, /mac_url_art_detail/);

for (const userPage of ["head", "foot", "include", "index", "login", "reg", "findpass"]) {
  const page = readThemeFile(`html/user/${userPage}.html`);
  assert.match(page, /用户中心|会员|登录|注册|找回密码/);
}

const msgPage = readThemeFile("html/public/msg.html");
assert.doesNotMatch(msgPage, /href="javascript:/);
assert.match(msgPage, /mac_url\('vod\/show'\)/);

const index = readThemeFile("html/index/index.html");
assert.match(index, /\{include file="public\/head" seo_title=/);
assert.match(index, /\{maccms:vod type="all" num="12"/);
assert.match(index, /\{maccms:type ids="parent" order="asc"/);
assert.match(index, /mac_data_count\(0,'today','vod'\)/);
assert.match(index, /hero-carousel/);
assert.match(index, /hero-slide/);
assert.match(index, /banner-dots/);
assert.match(index, /hero-stats/);
assert.match(index, /class="banner-poster"[^>]*width="380"[^>]*height="570"/);
assert.match(index, /class="banner-poster"[^>]*sizes="\(max-width: 760px\) 34vw, 190px"/);
assert.match(index, /\{if condition="\$key eq 1"\}loading="eager" fetchpriority="high"\{else\/\}loading="lazy" fetchpriority="low"\{\/if\}/);
assert.match(index, /class="banner-poster"[^>]*decoding="async"/);
assert.match(index, /include file="public\/vod_card"/);
assert.match(index, /<h2>热播榜<\/h2>/);
assert.match(index, /mac_url\('label\/hot'\)/);
assert.match(index, /mac_url\('label\/videos'\)/);
assert.equal((index.match(new RegExp(`\\{maccms:vod type="${nonAdultVodTypeScope}" num="5" order="desc" by="hits"`, "g")) || []).length, 2);
assert.match(index, new RegExp(`\\{maccms:vod type="${nonAdultVodTypeScope}" num="6" order="desc" by="hits" id="vo" key="key"\\}`));
assert.doesNotMatch(index, /\{maccms:vod type="all"[^}]*by="hits"/);
assert.doesNotMatch(index, /mac_url\('vod\/show',\['by'=>'hits'\]\)/);
assert.doesNotMatch(index, /<a href="\{:mac_url\('vod\/show'\)\}">全部影片<\/a>/);

const detail = readThemeFile("html/vod/detail.html");
assert.match(detail, /\{include file="public\/head" seo_title=/);
assert.match(detail, /\{\$obj\.vod_pic\|mac_url_img\}/);
assert.match(detail, /class="detail-poster"[\s\S]*<img src="\{\$obj\.vod_pic\|mac_url_img\}" alt="\{\$obj\.vod_name\}" width="380" height="570" loading="eager" decoding="async" fetchpriority="high" sizes="\(max-width: 760px\) 44vw, 250px">/);
assert.match(detail, /mac_url_vod_play/);
assert.match(detail, /mac_history_set/);
assert.match(detail, /obj\.vod_play_list/);
assert.match(detail, /detail-panel/);
assert.match(detail, /detail-title-row/);
assert.match(detail, /include file="public\/score"/);
assert.match(detail, /include file="public\/star"/);
assert.match(detail, /include file="public\/digg"/);
assert.match(detail, /data-favorite-action/);
assert.match(detail, /data-favorite-label/);
assert.match(detail, /data-favorite-saved-label="已收藏"/);
assert.match(detail, /aria-pressed="false"/);
assert.match(detail, /<dt>热度<\/dt><dd>\{\$obj\.vod_hits\|mac_default='0'\} 次<\/dd>/);
assert.match(detail, /loading="lazy" decoding="async" width="300" height="450" sizes="\(max-width: 560px\) 46vw, \(max-width: 920px\) 30vw, 180px"/);

const vodCard = readThemeFile("html/public/vod_card.html");
assert.match(vodCard, /<img src="\{\$vo\.vod_pic\|mac_url_img\}" alt="\{\$vo\.vod_name\}" loading="lazy" decoding="async" width="300" height="450" sizes="\(max-width: 560px\) 46vw, \(max-width: 920px\) 30vw, 180px">/);

const searchImagePage = readThemeFile("html/vod/search.html");
assert.equal((searchImagePage.match(/sizes="96px"/g) || []).length, 2);

const play = readThemeFile("html/vod/play.html");
assert.match(play, /\{include file="public\/head" seo_title=/);
assert.match(play, /\{\$player_data\}/);
assert.match(play, /\{\$player_js\}/);
assert.match(play, /mac_ulog_set/);
assert.match(play, /player-toolbar/);
assert.match(play, /data-player-fullscreen/);
assert.match(play, /\$obj\['vod_play_list'\]\[\$param\['sid'\]\]\['urls'\]\[\$param\['nid'\]\]\['name'\]/);
assert.match(play, /<h1>\{\$obj\.vod_name\} - \{\$obj\['vod_play_list'\]\[\$param\['sid'\]\]\['urls'\]\[\$param\['nid'\]\]\['name'\]\}<\/h1>/);
assert.match(play, /<span>\{\$obj\.vod_name\} \/ \{\$obj\['vod_play_list'\]\[\$param\['sid'\]\]\['urls'\]\[\$param\['nid'\]\]\['name'\]\}<\/span>/);
assert.doesNotMatch(play, /<h1>\{\$obj\.vod_name\}<\/h1>/);

const vodConfirmPage = readThemeFile("html/vod/confirm.html");
assert.match(vodConfirmPage, /seo_title="确认点播"/);
assert.match(vodConfirmPage, /mac_url_vod_detail/);
assert.match(vodConfirmPage, /确认继续/);

const vodDetailPwdPage = readThemeFile("html/vod/detail_pwd.html");
assert.match(vodDetailPwdPage, /seo_title="访问验证"/);
assert.match(vodDetailPwdPage, /name="pwd"/);
assert.match(vodDetailPwdPage, /验证码/);

const playerPage = readThemeFile("html/vod/player.html");
assert.match(playerPage, /\{\$player_data\}/);
assert.match(playerPage, /\{\$player_js\}/);
assert.match(playerPage, /试看播放/);
assert.match(playerPage, /data-player-fullscreen/);
assert.match(playerPage, /\$obj\['vod_play_list'\]\[\$param\['sid'\]\]\['urls'\]\[\$param\['nid'\]\]\['name'\]/);
assert.doesNotMatch(playerPage, /<h1>\{\$obj\.vod_name\}<\/h1>/);
assert.match(playerPage, /\{include file="public\/foot" \/\}/);

const playerPwdPage = readThemeFile("html/vod/player_pwd.html");
assert.match(playerPwdPage, /seo_title="播放验证"/);
assert.match(playerPwdPage, /name="pwd"/);
assert.match(playerPwdPage, /验证码/);

const downPage = readThemeFile("html/vod/down.html");
assert.match(downPage, /seo_title="\$obj\.vod_name 下载"/);
assert.match(downPage, /obj\.vod_down_list/);
assert.match(downPage, /download-list/);
assert.match(downPage, /mac_url_vod_down/);

const downerPwdPage = readThemeFile("html/vod/downer_pwd.html");
assert.match(downerPwdPage, /seo_title="下载验证"/);
assert.match(downerPwdPage, /name="pwd"/);
assert.match(downerPwdPage, /验证码/);

const copyrightPage = readThemeFile("html/vod/copyright.html");
assert.match(copyrightPage, /seo_title="版权提示"/);
assert.match(copyrightPage, /版权限制/);
assert.match(copyrightPage, /mac_url_vod_detail/);

const plotPage = readThemeFile("html/vod/plot.html");
assert.match(plotPage, /seo_title="\$obj\.vod_name 分集剧情"/);
assert.match(plotPage, /plot-list/);
assert.match(plotPage, /obj\.vod_plot_list/);

for (const rssAlias of ["rss/rss.html", "rss/baidu.html", "rss/google.html"]) {
  const rssAliasPage = readThemeFile(`html/${rssAlias}`);
  assert.match(rssAliasPage, /maccms:vod/);
  assert.match(rssAliasPage, /mac_url_vod_detail/);
}

const typePage = readThemeFile("html/vod/type.html");
assert.match(typePage, /\{include file="public\/head" seo_title=/);
assert.match(typePage, /\{maccms:vod num="24" paging="yes"/);
assert.match(typePage, /pageurl="vod\/type"/);
assert.doesNotMatch(typePage, /\$param\['by'\]/);
assert.match(typePage, /filter-panel category-filter/);
assert.match(typePage, /class="channel-search"/);
assert.match(typePage, /class="filter-row filter-search-row"/);
assert.match(typePage, /action="\{:mac_url\('vod\/search'\)\}"/);
assert.match(typePage, /name="type" value="\{\$obj\.type_id\}"/);
assert.match(typePage, /placeholder="在\{\$obj\.type_name\}中搜索"/);
assert.match(typePage, /filter-row/);
assert.match(typePage, /filter-options/);
assert.match(typePage, /filter-actions/);
assert.match(typePage, /filter-reset/);
assert.match(typePage, />重置筛选</);
assert.match(typePage, /mac_url_type\(\$obj,\[\],'show'\)/);
assert.match(typePage, /mac_url_type\(\$type,\['area'=>\$param\['area'\][\s\S]*\],'show'\)/);
assert.match(typePage, /mac_url_type\(\$obj,\['area'=>\$param\['area'\][\s\S]*'by'=>'hits'\],'show'\)/);
assert.doesNotMatch(typePage, /<strong>子类<\/strong>/);
assert.equal((typePage.match(/<strong>类型<\/strong>/g) || []).length, 1);
assert.match(typePage, /<strong>地区<\/strong>/);
assert.match(typePage, /<strong>年份<\/strong>/);
assert.match(typePage, /<strong>语言<\/strong>/);
assert.match(typePage, /<strong>字母<\/strong>/);
assert.match(typePage, /<strong>排序<\/strong>/);
assert.match(typePage, /\$obj\.type_extend\.area/);
assert.match(typePage, /\$obj\.parent\.type_extend\.area/);
assert.match(typePage, /\$obj\.type_extend\.year/);
assert.doesNotMatch(typePage, /\$obj\.type_extend\.class/);
assert.doesNotMatch(typePage, /\$obj\.parent\.type_extend\.class/);
assert.match(typePage, /\$obj\.type_extend\.lang/);
assert.match(typePage, /'area'=>\$vo2/);
assert.match(typePage, /'year'=>\$vo2/);
assert.doesNotMatch(typePage, /'class'=>\$vo2/);
assert.match(typePage, /'lang'=>\$vo2/);
assert.match(typePage, /\{if condition="\$param\['area'\] eq \$vo2"\} class="is-active" \{\/if\}/);
assert.match(typePage, /\{if condition="\$param\['lang'\] eq \$vo2"\} class="is-active" \{\/if\}/);
assert.ok(typePage.includes(`{maccms:foreach name=":explode(',','${fullLetterFilter}')" id="vo2"}`), "vod/type should render a complete letter filter");
assert.match(typePage, /\{if condition="\$param\['letter'\] eq \$vo2"\} class="is-active" \{\/if\}/);
assert.match(typePage, /'letter'=>\$vo2/);
assert.doesNotMatch(typePage, /\$param\['letter'\] eq 'Y'/);
assert.doesNotMatch(typePage, /'area'=>'中国大陆'/);
assert.doesNotMatch(typePage, /'lang'=>'国语'/);
assert.doesNotMatch(typePage, /'class'=>'剧情'/);
assert.doesNotMatch(typePage, /'year'=>'2026'/);
assert.match(typePage, /area="'\.\$param\['area'\]\.'"/);
assert.match(typePage, /lang="'\.\$param\['lang'\]\.'"/);
assert.match(typePage, /year="'\.\$param\['year'\]\.'"/);
assert.match(typePage, /letter="'\.\$param\['letter'\]\.'"/);
assert.match(typePage, /class="'\.\$param\['class'\]\.'"/);
assert.match(typePage, /\$param\.by eq 'hits'/);
assert.match(typePage, /\$param\.by eq 'score'/);
assert.match(typePage, /by="hits"/);
assert.match(typePage, /by="score"/);
assert.match(typePage, /by="time"/);
assert.match(typePage, /\{include file="public\/paging" \/\}/);

const showPage = readThemeFile("html/vod/show.html");
assert.match(showPage, /class="channel-search"/);
assert.match(showPage, /class="filter-row filter-search-row"/);
assert.match(showPage, /action="\{:mac_url\('vod\/search'\)\}"/);
assert.match(showPage, /name="type" value="\{\$obj\.type_id\}"/);
assert.match(showPage, /placeholder="在影片库中搜索"/);
assert.match(showPage, /filter-actions/);
assert.match(showPage, /filter-reset/);
assert.match(showPage, />重置筛选</);
assert.match(showPage, /\$obj\.type_pid gt 0/);
assert.match(showPage, /mac_url_type\(\$obj\.parent,\[\],'show'\)/);
assert.match(showPage, /mac_url_type\(\$obj,\[\],'show'\)/);
assert.match(showPage, /mac_url_type\(\$type,\['area'=>\$param\['area'\][\s\S]*\],'show'\)/);
assert.match(showPage, /mac_url_type\(\$obj,\['area'=>\$param\['area'\][\s\S]*'by'=>'hits'\],'show'\)/);
assert.doesNotMatch(showPage, /<strong>子类<\/strong>/);
assert.equal((showPage.match(/<strong>类型<\/strong>/g) || []).length, 1);
assert.match(showPage, /<strong>地区<\/strong>/);
assert.match(showPage, /<strong>年份<\/strong>/);
assert.match(showPage, /<strong>语言<\/strong>/);
assert.match(showPage, /<strong>字母<\/strong>/);
assert.match(showPage, /\$obj\.type_extend\.area/);
assert.match(showPage, /\$obj\.parent\.type_extend\.area/);
assert.match(showPage, /\$obj\.type_extend\.year/);
assert.doesNotMatch(showPage, /\$obj\.type_extend\.class/);
assert.doesNotMatch(showPage, /\$obj\.parent\.type_extend\.class/);
assert.match(showPage, /\$obj\.type_extend\.lang/);
assert.match(showPage, /'area'=>\$vo2/);
assert.match(showPage, /'year'=>\$vo2/);
assert.doesNotMatch(showPage, /'class'=>\$vo2/);
assert.match(showPage, /'lang'=>\$vo2/);
assert.doesNotMatch(showPage, /'area'=>'中国大陆'/);
assert.doesNotMatch(showPage, /'lang'=>'国语'/);
assert.doesNotMatch(showPage, /'class'=>'剧情'/);
assert.doesNotMatch(showPage, /'year'=>'2026'/);
assert.match(showPage, /'area'=>\$param\['area'\]/);
assert.match(showPage, /'lang'=>\$param\['lang'\]/);
assert.match(showPage, /'year'=>\$param\['year'\]/);
assert.match(showPage, /'letter'=>\$param\['letter'\]/);
assert.match(showPage, /'class'=>\$param\['class'\]/);
assert.ok(showPage.includes(`{maccms:foreach name=":explode(',','${fullLetterFilter}')" id="vo2"}`), "vod/show should render a complete letter filter");
assert.match(showPage, /\{if condition="\$param\['letter'\] eq \$vo2"\} class="is-active" \{\/if\}/);
assert.match(showPage, /'letter'=>\$vo2/);
assert.doesNotMatch(showPage, /\$param\['letter'\] eq 'Y'/);
assert.doesNotMatch(showPage, /\$param\['by'\]/);
assert.match(showPage, /'by'=>'time'/);
assert.match(showPage, /'by'=>'hits'/);
assert.match(showPage, /'by'=>'score'/);
assert.match(showPage, /\$param\.by eq 'hits'/);
assert.match(showPage, /\$param\.by eq 'score'/);
assert.match(showPage, /area="'\.\$param\['area'\]\.'"/);
assert.match(showPage, /lang="'\.\$param\['lang'\]\.'"/);
assert.match(showPage, /year="'\.\$param\['year'\]\.'"/);
assert.match(showPage, /letter="'\.\$param\['letter'\]\.'"/);
assert.match(showPage, /class="'\.\$param\['class'\]\.'"/);
assert.match(showPage, /by="hits"/);
assert.match(showPage, /by="score"/);
assert.match(showPage, /by="time"/);
assert.match(showPage, /pageurl="vod\/show"/);

const searchPage = readThemeFile("html/vod/search.html");
assert.match(searchPage, /\{maccms:vod num="20" paging="yes" pageurl="vod\/search"/);
assert.match(searchPage, /loading="lazy" decoding="async" width="160" height="240"/);
assert.doesNotMatch(searchPage, /class="hot-search-panel search-hot-panel"/);
assert.doesNotMatch(searchPage, /\$maccms\.search_hot/);
assert.doesNotMatch(searchPage, /mac_url\('vod\/search',\['wd'=>\$vo2\]\)/);

const performanceStyle = readThemeFile("css/style.css");
assert.match(performanceStyle, /@supports \(content-visibility: auto\)/);
assert.match(performanceStyle, /content-visibility: auto;/);
assert.match(performanceStyle, /contain-intrinsic-size: auto 520px;/);
assert.match(searchPage, /class="wrap filter-panel category-filter search-filter-panel"/);
assert.match(searchPage, /<strong>频道<\/strong>/);
assert.match(searchPage, /mac_url\('vod\/search',\['wd'=>\$param\['wd'\]\]\)/);
assert.match(searchPage, /\{maccms:type ids="parent" order="asc" by="sort" mid="1" num="20" id="type"\}/);
assert.match(searchPage, /mac_url\('vod\/search',\['wd'=>\$param\['wd'\],'type'=>\$type\['type_id'\]\]\)/);
assert.match(searchPage, /\{maccms:type ids="'\.\$param\['type'\]\.'" id="current"\}/);
assert.match(searchPage, /\$current\.type_id eq \$type\.type_id or \$current\.type_pid eq \$type\.type_id/);
assert.match(searchPage, /<strong>类型<\/strong>/);
assert.match(searchPage, /\{if condition="\$current\.type_pid gt 0"\}/);
assert.match(searchPage, /\{maccms:type parent="'\.\$current\['type_pid'\]\.'" order="asc" by="sort" id="child"\}/);
assert.match(searchPage, /\{maccms:type parent="'\.\$current\['type_id'\]\.'" order="asc" by="sort" id="child"\}/);
assert.match(searchPage, /mac_url\('vod\/search',\['wd'=>\$param\['wd'\],'type'=>\$child\['type_id'\]\]\)/);
assert.doesNotMatch(searchPage, /'parent'=>/);
assert.match(searchPage, /\{if condition="\$current\.type_id eq \$child\.type_id"\} class="is-active" \{\/if\}/);
assert.match(searchPage, /type="'\.\$current\['type_id'\]\.'"/);
assert.doesNotMatch(searchPage, /type="'\.\$param\['type/);

const vodCardPartial = readThemeFile("html/public/vod_card.html");
assert.match(vodCardPartial, /class="vod-card"/);
assert.match(vodCardPartial, /mac_url_vod_detail/);
assert.match(vodCardPartial, /score-badge/);
assert.match(vodCardPartial, /card-meta/);

const diggPartial = readThemeFile("html/public/digg.html");
assert.match(diggPartial, /digg-panel/);
assert.match(diggPartial, /vod_up/);
assert.match(diggPartial, /vod_down/);

const scorePartial = readThemeFile("html/public/score.html");
assert.match(scorePartial, /score-panel/);
assert.match(scorePartial, /vod_score/);
assert.match(scorePartial, /vod_score_num/);

const starPartial = readThemeFile("html/public/star.html");
assert.match(starPartial, /star-panel/);
assert.match(starPartial, /vod_score/);

const style = readThemeFile("css/style.css");
const siteHeaderRule = style.match(/\.site-header\s*\{[\s\S]*?\}/)?.[0] || "";
const userDropdownRule = style.match(/\.user-dropdown\s*\{[\s\S]*?\}/)?.[0] || "";
assert.match(style, /@media \(max-width: 760px\)/);
assert.match(style, /\.vod-grid/);
assert.match(style, /\.system-page/);
assert.match(style, /\.site-notice/);
assert.match(style, /\.site-notice\.is-visible/);
assert.match(style, /\.site-notice\.is-error/);
assert.match(style, /\.site-notice[\s\S]*z-index: 1200/);
assert.match(style, /\.verify-form textarea/);
assert.match(style, /\.filter-panel div[\s\S]*flex-wrap: wrap/);
assert.match(style, /\.filter-bar[\s\S]*flex-wrap: wrap/);
assert.match(style, /\.category-filter/);
assert.match(style, /\.filter-row/);
assert.match(style, /\.filter-options/);
assert.match(style, /\.filter-actions/);
assert.match(style, /\.filter-reset/);
assert.match(style, /\.page-jump/);
assert.match(style, /\.page-jump-input/);
assert.match(style, /\.page-jump-submit/);
assert.match(style, /\.filter-panel a\.is-active/);
assert.match(style, /\.filter-options[\s\S]*overflow-x: auto/);
assert.doesNotMatch(style, /\.filter-panel[\s\S]{0,80}overflow-x: auto/);
assert.match(style, /\.hero-stats/);
assert.match(style, /\.hero-carousel/);
assert.match(style, /\.banner-track/);
assert.match(style, /\.hero-slide\.is-active/);
assert.match(style, /\.hero-carousel\[data-gsap-carousel="true"\] \.hero-slide\s*\{[\s\S]*transition: none/);
assert.match(style, /\[data-gsap-reveal-ready="true"\]/);
assert.match(style, /\[data-gsap-revealed="true"\]/);
assert.match(style, /@media \(prefers-reduced-motion: reduce\)/);
assert.match(style, /\[data-gsap-carousel="true"\] \.hero-slide/);
assert.match(style, /\.banner-dot/);
assert.match(style, /\.banner-copy\s*\{[\s\S]*padding: 38px 0 200px 34px/);
assert.match(style, /\.banner-poster\s*\{[\s\S]*height: auto/);
assert.match(style, /\.score-badge/);
assert.match(style, /\.card-meta/);
assert.match(style, /\.detail-panel/);
assert.match(style, /\.player-toolbar/);
assert.match(style, /\.player-toolbar-actions/);
assert.match(style, /\.player-shell #MacPlayer/);
assert.match(style, /\.player-shell embed/);
assert.match(style, /\.player-shell object/);
assert.match(style, /\.download-list/);
assert.match(style, /\.copyright-box/);
assert.match(style, /\.comment-list/);
assert.match(style, /\.plot-list/);
assert.match(style, /\.module-fallback/);
assert.match(style, /\.poster::after/);
assert.match(style, /\.vod-card[\s\S]*background: var\(--surface\)/);
assert.match(style, /\.vod-card[\s\S]*box-shadow/);
assert.match(style, /\.vod-card[\s\S]*display: flex/);
assert.match(style, /\.vod-card strong[\s\S]*-webkit-line-clamp: 2/);
assert.match(style, /\.poster[\s\S]*isolation: isolate/);
assert.match(style, /\.brand-logo/);
assert.match(style, /object-fit: contain/);
assert.match(style, /\.brand-logo[\s\S]*filter: drop-shadow/);
assert.match(style, /\.site-header \.brand img[\s\S]*width: 136px/);
assert.match(style, /\.site-header \.brand img[\s\S]*height: 58px/);
assert.match(style, /\.site-header \.brand img[\s\S]*max-width: 156px/);
assert.match(siteHeaderRule, /z-index: 1000/);
assert.match(siteHeaderRule, /overflow: visible/);
assert.doesNotMatch(siteHeaderRule, /overflow: clip/);
assert.doesNotMatch(style, /\.brand-logo[\s\S]{0,160}box-shadow/);
assert.match(style, /\.user-menu/);
assert.match(style, /\.user-avatar/);
assert.match(style, /\.user-avatar[\s\S]*color: #fff/);
assert.match(style, /--avatar-bg/);
assert.match(style, /\.user-avatar-letter/);
assert.match(style, /\.user-dropdown/);
assert.match(style, /\.device-panel/);
assert.match(style, /\.device-card/);
assert.match(style, /\.device-current/);
assert.match(style, /\.device-meta/);
assert.match(style, /\.device-status/);
assert.match(style, /\.user-menu::after[\s\S]*height: 12px/);
assert.match(userDropdownRule, /z-index: 1001/);
assert.match(style, /\.user-menu:hover \.user-dropdown/);
assert.match(style, /\.record-poster/);
assert.match(style, /\.record-poster-img/);
assert.match(style, /\.record-poster[\s\S]*aspect-ratio: 2 \/ 3/);
assert.match(style, /\.favorite-page/);
assert.match(style, /\.favorite-toolbar/);
assert.match(style, /\.favorite-list/);
assert.match(style, /\.favorite-card/);
assert.match(style, /\.favorite-card:hover/);
assert.match(style, /\.favorite-status/);
assert.match(style, /\.favorite-cover/);
assert.match(style, /\.favorite-empty/);
assert.match(style, /@media \(max-width: 760px\)[\s\S]*\.favorite-card/);
assert.match(style, /\.record-empty/);
assert.match(style, /\.record-item-actions[\s\S]*flex-wrap: wrap/);
assert.match(style, /@media \(max-width: 760px\)[\s\S]*\.record-toolbar/);
assert.match(style, /@media \(max-width: 760px\)[\s\S]*\.record-item/);
assert.match(style, /@media \(max-width: 760px\)[\s\S]*\.header-inner\s*\{[\s\S]*grid-template-columns: minmax\(0, 1fr\) auto auto/);
assert.match(style, /@media \(max-width: 760px\)[\s\S]*\.header-search\s*\{[\s\S]*grid-column: 1/);
assert.match(style, /@media \(max-width: 760px\)[\s\S]*\.header-search button\s*\{[\s\S]*min-width: 76px/);
assert.match(style, /@media \(max-width: 760px\)[\s\S]*\.site-header \.brand img\s*\{[\s\S]*width: 72px/);
assert.match(style, /@media \(max-width: 760px\)[\s\S]*\.hero-rank\s*\{[\s\S]*margin-top: 4px/);
assert.match(style, /@media \(max-width: 760px\)[\s\S]*\.header-search\s*\{[\s\S]*display: grid/);
assert.match(style, /@media \(max-width: 760px\)[\s\S]*\.player-shell\s*\{[\s\S]*aspect-ratio: 16 \/ 9/);
assert.match(style, /@media \(orientation: landscape\) and \(max-height: 520px\)/);
assert.match(style, /\.mobile-category-entry\s*\{[\s\S]*display: none/);
assert.match(style, /\.mobile-shortcuts\s*\{[\s\S]*display: none/);
assert.match(style, /\.mobile-game-entry/);
assert.match(style, /@media \(max-width: 520px\)[\s\S]*\.mobile-category-entry\s*\{[\s\S]*display: inline-flex/);
assert.match(style, /@media \(max-width: 520px\)[\s\S]*\.mobile-shortcuts\s*\{[\s\S]*display: flex/);
assert.match(style, /@media \(max-width: 520px\)[\s\S]*\.mobile-game-entry\s*\{[\s\S]*display: inline-flex/);
assert.match(style, /@media \(max-width: 520px\)[\s\S]*\.user-menu\s*\{[\s\S]*grid-column: 4/);
assert.match(style, /@media \(max-width: 520px\)[\s\S]*\.nav-toggle\s*\{[\s\S]*display: block/);
assert.match(style, /@media \(max-width: 520px\)[\s\S]*\.site-header \.brand img\s*\{[\s\S]*width: 52px/);
assert.match(style, /@media \(max-width: 520px\)[\s\S]*\.hero-stats\s*\{[\s\S]*min-width: 0/);
assert.match(style, /\.site-nav[\s\S]*overflow: hidden/);
assert.doesNotMatch(style, /\.site-nav[\s\S]{0,80}overflow-x: auto/);
assert.match(style, /\.category-index/);
assert.doesNotMatch(style, /\.category-search/);
assert.doesNotMatch(style, /\.category-empty/);
assert.match(style, /\.filter-search-row/);
assert.match(style, /\.channel-search/);
assert.match(style, /\.channel-search input/);
assert.match(style, /\.channel-search[\s\S]*grid-template-columns: minmax\(0, 1fr\) auto/);
assert.match(style, /\.channel-search input\[type="search"\][\s\S]*background: transparent/);
assert.match(style, /\.channel-search button[\s\S]*background: var\(--accent\)/);
assert.match(style, /@media \(max-width: 760px\)[\s\S]*\.page-title\s*\{[\s\S]*padding: 24px 0 8px/);
assert.match(style, /@media \(max-width: 760px\)[\s\S]*\.content-section\s*\{[\s\S]*padding: 24px 0/);
assert.match(style, /@media \(max-width: 760px\)[\s\S]*\.hero-carousel\s*\{[\s\S]*min-height: 360px/);
assert.match(style, /@media \(max-width: 760px\)[\s\S]*\.filter-panel\s*\{[\s\S]*padding: 14px/);
assert.match(style, /@media \(max-width: 760px\)[\s\S]*\.filter-options\s*\{[\s\S]*margin-right: -14px/);
assert.match(style, /@media \(max-width: 760px\)[\s\S]*\.list-item\s*\{[\s\S]*grid-template-columns: 86px minmax\(0, 1fr\)/);
assert.match(style, /@media \(max-width: 760px\)[\s\S]*\.page-link,\n  \.page-state\s*\{[\s\S]*flex: 1 1 88px/);
assert.match(include, new RegExp(`style\\.css\\?v=${assetVersionPlaceholder}`));
assert.match(style, /\.search-filter-panel/);
assert.doesNotMatch(style, /\.search-type-filter/);
assert.doesNotMatch(style, /\.search-type-panel/);
assert.doesNotMatch(style, /\.search-type-section/);
assert.match(style, /\.category-tile/);
assert.match(style, /\.category-tile[\s\S]*position: relative/);
assert.match(style, /\.category-hit[\s\S]*position: absolute/);
assert.match(style, /\.category-main[\s\S]*pointer-events: none/);
assert.match(style, /\.category-children[\s\S]*z-index: 2/);
assert.match(style, /\.category-children[\s\S]*pointer-events: none/);
assert.match(style, /\.category-children a[\s\S]*pointer-events: auto/);
assert.match(style, /\.category-sort/);
assert.match(style, /\.sort-latest/);
assert.match(style, /\.sort-hot/);
assert.match(style, /\.sort-score/);
assert.doesNotMatch(style, /\.category-sort::before/);
assert.doesNotMatch(style, /\.sort-latest::before/);
assert.doesNotMatch(style, /\.sort-hot::before/);
assert.doesNotMatch(style, /\.sort-score::before/);
assert.match(style, /\.history-timeline/);
assert.match(style, /\.timeline-date/);
assert.match(style, /\.timeline-item/);
assert.match(style, /\.interaction-panel/);
assert.match(style, /\.star-meter/);

const logo = readFileSync(path.join(themeRoot, "images/site-logo.png"));
assert.equal(logo.subarray(1, 4).toString("ascii"), "PNG");
assert.deepEqual([logo.readUInt32BE(16), logo.readUInt32BE(20)], [1024, 1024]);

const packageScript = readFileSync(path.join(root, "scripts/package-theme.mjs"), "utf8");
assert.match(packageScript, /pingfangvideo/);
assert.match(packageScript, /pingfangdevice/);
assert.match(packageScript, /dist/);
assert.match(packageScript, /addonArchive/);
assert.match(packageScript, /startsWith\("\."\)/);
assert.match(packageScript, /createHash/);
assert.match(packageScript, /assetVersionPlaceholder/);
assert.match(packageScript, /replaceAssetVersionPlaceholders/);
assert.match(packageScript, /COPYFILE_DISABLE/);
assert.match(packageScript, /--no-xattrs/);

const packageJson = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
assert.equal(packageJson.scripts["lint:template"], "node scripts/lint-template.mjs");
assert.equal(packageJson.scripts["verify:compat"], "node scripts/verify-compat.mjs");
assert.equal(packageJson.scripts["verify:preview"], "node scripts/verify-preview.mjs");
assert.equal(packageJson.scripts["verify:release"], "node scripts/verify-release.mjs");
assert.equal(packageJson.scripts.deploy, "bash scripts/deploy-theme.sh");
assert.equal(packageJson.scripts.rollback, "bash scripts/rollback-theme.sh");

const deployScript = readFileSync(path.join(root, "scripts/deploy-theme.sh"), "utf8");
assert.match(deployScript, /^#!\/usr\/bin\/env bash/);
assert.match(deployScript, /set -euo pipefail/);
assert.match(deployScript, /npm test/);
assert.match(deployScript, /npm run lint:template/);
assert.match(deployScript, /npm run verify:compat/);
assert.match(deployScript, /npm run verify:preview/);
assert.match(deployScript, /npm run package/);
assert.match(deployScript, /npm run verify:release/);
assert.match(deployScript, /dist\/pingfangvideo\.tar\.gz/);
assert.match(deployScript, /\$\{DEPLOY_HOST/);
assert.match(deployScript, /\$\{DEPLOY_USER/);
assert.match(deployScript, /\$\{DEPLOY_PORT/);
assert.match(deployScript, /\$\{DEPLOY_PATH/);
assert.match(deployScript, /SSHPASS/);
assert.match(deployScript, /scp/);
assert.match(deployScript, /ssh/);
assert.match(deployScript, /tar -xzf/);
assert.match(deployScript, /pingfangvideo\.backup/);
assert.match(deployScript, /ADDON_NAME="pingfangdevice"/);
assert.match(deployScript, /pingfangdevice\.tar\.gz/);
assert.match(deployScript, /application\/index\/controller\/Pingfangdevice\.php/);
assert.match(deployScript, /application\/extra\/addons\.php/);
assert.match(deployScript, /install\.sql/);
assert.match(deployScript, /DEPLOY_CLEAR_CACHE/);
assert.match(deployScript, /maccms_root="\$\(dirname "\$DEPLOY_PATH"\)"/);
assert.match(deployScript, /runtime\/cache/);
assert.match(deployScript, /runtime\/temp/);
assert.match(deployScript, /view\/_cache/);
assert.match(deployScript, /find "\$cache_dir" -mindepth 1/);
assert.doesNotMatch(deployScript, /DEPLOY_PASSWORD=/);

const rollbackScript = readFileSync(path.join(root, "scripts/rollback-theme.sh"), "utf8");
assert.match(rollbackScript, /^#!\/usr\/bin\/env bash/);
assert.match(rollbackScript, /set -euo pipefail/);
assert.match(rollbackScript, /\$\{DEPLOY_HOST/);
assert.match(rollbackScript, /\$\{DEPLOY_USER/);
assert.match(rollbackScript, /\$\{DEPLOY_PORT/);
assert.match(rollbackScript, /\$\{DEPLOY_PATH/);
assert.match(rollbackScript, /ROLLBACK_BACKUP/);
assert.match(rollbackScript, /SSHPASS/);
assert.match(rollbackScript, /find \. -maxdepth 1 -type d -name "\$\{THEME_NAME\}\.backup\.\*"/);
assert.match(rollbackScript, /pingfangvideo\.failed/);
assert.match(rollbackScript, /cp -a "\$backup" "\$THEME_NAME"/);
assert.match(rollbackScript, /DEPLOY_CLEAR_CACHE/);
assert.match(rollbackScript, /runtime\/cache/);
assert.doesNotMatch(rollbackScript, /DEPLOY_PASSWORD=/);

const ciWorkflow = readFileSync(path.join(root, ".github/workflows/ci.yml"), "utf8");
assert.match(ciWorkflow, /name: Theme CI/);
assert.match(ciWorkflow, /pull_request:/);
assert.match(ciWorkflow, /actions\/checkout@v4/);
assert.match(ciWorkflow, /actions\/setup-node@v4/);
assert.match(ciWorkflow, /node-version: 22/);
assert.match(ciWorkflow, /shivammathur\/setup-php@v2/);
assert.match(ciWorkflow, /php-version: "8\.4"/);
assert.match(ciWorkflow, /npm test/);
assert.match(ciWorkflow, /npm run lint:template/);
assert.match(ciWorkflow, /npm run verify:compat/);
assert.match(ciWorkflow, /npm run verify:preview/);
assert.match(ciWorkflow, /npm run package/);
assert.match(ciWorkflow, /npm run verify:release/);
assert.match(ciWorkflow, /actions\/upload-artifact@v4/);

const deviceAddonInfo = readAddonFile("info.ini");
assert.match(deviceAddonInfo, /name = pingfangdevice/);
assert.match(deviceAddonInfo, /state = 1/);

const deviceAddonConfig = readAddonFile("config.php");
assert.match(deviceAddonConfig, /max_devices/);
assert.match(deviceAddonConfig, /'value'\s*=>\s*'3'/);
assert.match(deviceAddonConfig, /pfv_device_token/);

const deviceAddonHook = readAddonFile("Pingfangdevice.php");
assert.match(deviceAddonHook, /namespace addons\\pingfangdevice/);
assert.match(deviceAddonHook, /extends Addons/);
assert.match(deviceAddonHook, /public function appBegin/);
assert.match(deviceAddonHook, /DeviceSession::syncActiveCookie/);

const deviceBridgeController = readAddonFile("bridge/Pingfangdevice.php");
assert.match(deviceBridgeController, /namespace app\\index\\controller/);
assert.match(deviceBridgeController, /class Pingfangdevice extends Base/);
assert.match(deviceBridgeController, /DeviceSession::registerLogin/);
assert.match(deviceBridgeController, /DeviceSession::listSessions/);
assert.match(deviceBridgeController, /DeviceSession::revokeSession/);
assert.match(deviceBridgeController, /DeviceSession::logoutCurrentDevice/);

const deviceAddonController = readAddonFile("controller/Index.php");
assert.match(deviceAddonController, /model\('User'\)->login\(\$param, \['return_meta' => true\]\)/);
assert.match(deviceAddonController, /DeviceSession::registerLogin/);
assert.match(deviceAddonController, /DeviceSession::listSessions/);
assert.match(deviceAddonController, /DeviceSession::revokeSession/);
assert.match(deviceAddonController, /DeviceSession::logoutCurrentDevice/);
assert.match(deviceAddonController, /addon_url\('pingfangdevice\/index\/index'\)/);

const deviceSessionService = readAddonFile("service/DeviceSession.php");
assert.match(deviceSessionService, /const DEFAULT_MAX_DEVICES = 3/);
assert.match(deviceSessionService, /const TOKEN_COOKIE = 'pfv_device_token'/);
assert.match(deviceSessionService, /public static function registerLogin/);
assert.match(deviceSessionService, /public static function syncActiveCookie/);
assert.match(deviceSessionService, /public static function enforceDeviceLimit/);
assert.match(deviceSessionService, /public static function revokeSession/);
assert.match(deviceSessionService, /hash_equals/);
assert.match(deviceSessionService, /cookie\('user_check'/);
assert.match(deviceSessionService, /revoked_reason' => 'device_limit'/);
assert.match(deviceSessionService, /last_seen_time/);

const deviceAddonSql = readAddonFile("install.sql");
assert.match(deviceAddonSql, /CREATE TABLE IF NOT EXISTS `__PREFIX__pingfang_device_session`/);
assert.match(deviceAddonSql, /`token_hash` char\(64\) NOT NULL/);
assert.match(deviceAddonSql, /UNIQUE KEY `uniq_token_hash`/);
assert.match(deviceAddonSql, /KEY `idx_user_active`/);
assert.doesNotMatch(deviceAddonSql, /DROP\s+TABLE/i);

const deviceAddonView = readAddonFile("view/index/index.html");
assert.match(deviceAddonView, /登录设备管理/);
assert.match(deviceAddonView, /当前设备/);
assert.match(deviceAddonView, /最近登录时间/);
assert.match(deviceAddonView, /踢下线/);
assert.match(deviceAddonView, /data-device-revoke/);

const categoryMaintenanceSql = readFileSync(path.join(root, "scripts/sql/maccms-vod-category-maintenance.sql"), "utf8");
assert.match(categoryMaintenanceSql, /MacCMS V10 vod category maintenance/i);
assert.match(categoryMaintenanceSql, /SELECT type_id, type_pid, type_name/);
assert.match(categoryMaintenanceSql, /START TRANSACTION/);
assert.match(categoryMaintenanceSql, /UPDATE mac_vod v\s+JOIN mac_type t ON v\.type_id = t\.type_id/);
assert.match(categoryMaintenanceSql, /SET v\.type_id_1 = CASE/);
assert.match(categoryMaintenanceSql, /COALESCE\(v\.type_id_1, 0\)/);
assert.match(categoryMaintenanceSql, /ROLLBACK/);
assert.match(categoryMaintenanceSql, /COMMIT/);
assert.doesNotMatch(categoryMaintenanceSql, /DROP\s+TABLE/i);
assert.doesNotMatch(categoryMaintenanceSql, /TRUNCATE/i);

const categoryMaintenanceDoc = readFileSync(path.join(root, "docs/maccms-vod-category-maintenance.md"), "utf8");
assert.match(categoryMaintenanceDoc, /mac_vod/);
assert.match(categoryMaintenanceDoc, /type_id_1/);
assert.match(categoryMaintenanceDoc, /mysqldump/);
assert.match(categoryMaintenanceDoc, /scripts\/sql\/maccms-vod-category-maintenance\.sql/);

const templateLinter = readFileSync(path.join(root, "scripts/lint-template.mjs"), "utf8");
assert.match(templateLinter, /maccms:vod/);
assert.match(templateLinter, /include file/);
assert.match(templateLinter, /forbiddenProductionPatterns/);
assert.match(templateLinter, /assertSafeAssetReference/);
assert.match(templateLinter, /preview\\\/data\\\.json/);
assert.match(templateLinter, /localhost/);
assert.match(templateLinter, /public\/digg\.html/);
assert.match(templateLinter, /public\/score\.html/);
assert.match(templateLinter, /public\/star\.html/);
assert.match(templateLinter, /maccms\.path without a trailing slash/);
assert.match(templateLinter, /Template lint passed/);

const compatVerifier = readFileSync(path.join(root, "scripts/verify-compat.mjs"), "utf8");
assert.match(compatVerifier, /requiredThemeDirs/);
assert.match(compatVerifier, /html\/comment\/index\.html/);
assert.match(compatVerifier, /html\/comment\/ajax\.html/);
assert.match(compatVerifier, /html\/rss\/rss\.html/);
assert.match(compatVerifier, /html\/book\/index\.html/);
assert.match(compatVerifier, /html\/book\/report\.html/);
assert.match(compatVerifier, /html\/vod\/copyright\.html/);
assert.match(compatVerifier, /html\/vod\/player\.html/);
assert.match(compatVerifier, /html\/vod\/down\.html/);
assert.match(compatVerifier, /html\/vod\/detail_pwd\.html/);
assert.match(compatVerifier, /html\/vod\/plot\.html/);
assert.match(compatVerifier, /href="#"/);
assert.match(compatVerifier, /javascript:history/);
assert.match(compatVerifier, /Compatibility verification passed/);

const previewVerifier = readFileSync(path.join(root, "scripts/verify-preview.mjs"), "utf8");
assert.match(previewVerifier, /php/);
assert.match(previewVerifier, /route=player/);
assert.match(previewVerifier, /route=down/);
assert.match(previewVerifier, /route=copyright/);
assert.match(previewVerifier, /route=gbook/);
assert.match(previewVerifier, /route=book/);
assert.match(previewVerifier, /route=report/);
assert.match(previewVerifier, /Preview verification passed/);

const releaseVerifier = readFileSync(path.join(root, "scripts/verify-release.mjs"), "utf8");
assert.match(releaseVerifier, /pingfangvideo\.tar\.gz/);
assert.match(releaseVerifier, /pingfangdevice\.tar\.gz/);
assert.match(releaseVerifier, /html\/public\/include\.html/);
assert.match(releaseVerifier, /html\/comment\/index\.html/);
assert.match(releaseVerifier, /html\/rss\/rss\.html/);
assert.match(releaseVerifier, /html\/vod\/play\.html/);
assert.match(releaseVerifier, /html\/vod\/detail_pwd\.html/);
assert.match(releaseVerifier, /html\/vod\/plot\.html/);
assert.match(releaseVerifier, /No hidden dotfiles/);
assert.match(releaseVerifier, /maccms\\\['path'\\\]/);
assert.match(releaseVerifier, /htmlEntries/);
assert.match(releaseVerifier, /forbiddenProductionPatterns/);
assert.match(releaseVerifier, /assertSafeAssetReference/);
assert.match(releaseVerifier, /preview\\\/data\\\.json/);
assert.match(releaseVerifier, /assetVersionPlaceholder/);
assert.match(releaseVerifier, /assetVersionPattern/);
assert.match(releaseVerifier, /requiredAddonEntries/);
assert.match(releaseVerifier, /pingfang_device_session/);
assert.match(releaseVerifier, /LIBARCHIVE\\\.xattr/);

const preview = readFileSync(path.join(root, "preview/index.html"), "utf8");
assert.doesNotMatch(preview, /href="#"/);
assert.match(preview, /css\/style\.css\?v=/);
assert.match(preview, new RegExp(`css/style\\.css\\?v=${assetVersionPlaceholder}`));
assert.doesNotMatch(preview, /css\/style\.css\?v=20260626"/);
assert.doesNotMatch(preview, /css\/style\.css\?v=20260621/);
assert.match(preview, /js\/app\.js\?v=/);
assert.match(preview, /js\/gsap\.min\.js\?v=3\.15\.0/);
assert.match(preview, new RegExp(`js/gsap\\.min\\.js\\?v=3\\.15\\.0[\\s\\S]*js/app\\.js\\?v=${assetVersionPlaceholder}`));
assert.doesNotMatch(preview, /js\/app\.js\?v=20260621/);
assert.match(preview, /sizes="\(max-width: 560px\) 46vw, \(max-width: 920px\) 30vw, 180px"/);
assert.match(preview, /sizes="\(max-width: 760px\) 34vw, 190px"/);
assert.match(preview, /sizes="96px"/);
assert.doesNotMatch(preview, /v=20260615/);
assert.doesNotMatch(preview, /v=20260618/);
assert.doesNotMatch(preview, /style\.css\?v=20260619/);
assert.doesNotMatch(preview, /style\.css\?v=20260620/);
assert.match(preview, /data-page-jump/);
assert.match(preview, /page: "__PAGE__"/);
assert.match(preview, /page-jump-input/);
assert.match(preview, /preview\/data\.json/);
assert.match(preview, /data-route="detail"/);
assert.match(preview, /data-route="play"/);
assert.match(preview, /data-player-fullscreen/);
assert.match(preview, /mobile-category-entry/);
assert.match(preview, /filter-panel/);
assert.match(preview, /search-filter-panel/);
assert.match(preview, /channel-search/);
assert.match(preview, /filter-search-row/);
assert.match(preview, /selectedClass/);
assert.match(preview, /searchClassOptions/);
assert.match(preview, /type: selectedType, class: item/);
assert.doesNotMatch(preview, /<strong>子类<\/strong>/);
assert.doesNotMatch(preview, /data-search-type-filter/);
assert.doesNotMatch(preview, /data-search-type-section/);
assert.doesNotMatch(preview, /data-category-search/);
assert.doesNotMatch(preview, /data-category-search-input/);
assert.match(preview, /hero-carousel/);
assert.match(preview, /banner-dots/);
assert.match(preview, /hero-stats/);
assert.match(preview, /hot-search-panel/);
assert.match(preview, /热搜榜/);
assert.doesNotMatch(preview, /id="hotSearchPanel"/);
assert.doesNotMatch(preview, /renderHeaderHotSearch/);
assert.match(preview, /url\("category", \{ sort: "hot" \}\)/);
assert.match(preview, /score-badge/);
assert.match(preview, /card-meta/);
assert.match(preview, /detail-panel/);
assert.match(preview, /site-logo\.png/);
assert.doesNotMatch(preview, /brand-text/);
assert.match(preview, /route === "categories"/);
assert.match(preview, /route === "games"/);
assert.match(preview, /route === "history"/);
assert.match(preview, /function renderGamesPage/);
assert.match(preview, /data-route="games">游戏/);
assert.match(preview, /<a class="mobile-game-entry" href="\?route=games" data-route="games">游戏<\/a>/);
assert.match(preview, /category-index/);
assert.match(preview, /<a class="category-hit" href="\$\{url\("category", \{ name: category \}\)\}" data-route="category"/);
assert.match(preview, /aria-label="进入\$\{escapeHtml\(category\)\}"/);
assert.match(preview, /sortUrl\(category, "latest"\)/);
assert.match(preview, /sortUrl\(category, "hot"\)/);
assert.match(preview, /renderPagination\("category"/);
assert.match(preview, /sortUrl\(category, "score"\)/);
assert.match(preview, /filterVideos\(name, area, year, genre, lang, letter\)/);
assert.match(preview, /filterUrl\(\{ area: item \}\)/);
assert.match(preview, /filterUrl\(\{ year: item \}\)/);
assert.doesNotMatch(preview, /filterUrl\(\{ class: item \}\)/);
assert.match(preview, /filterUrl\(\{ lang: item \}\)/);
assert.match(preview, /filterUrl\(\{ letter: item \}\)/);
assert.match(preview, /const letters = \["A", "B", "C", "D", "E", "F"/);
assert.match(preview, /"M", "N", "O", "P"/);
assert.match(preview, /"X", "Y", "Z", "0~9"\]/);
assert.match(preview, /const categoryPageSize = 12/);
assert.match(preview, /function renderPagination/);
assert.match(preview, /renderPagination\("categories"/);
assert.match(preview, /sortVideos\(filterVideos\(name, area, year, genre, lang, letter\), currentSort\)/);
assert.match(preview, /history-timeline/);
assert.match(preview, /timeline-item/);
assert.doesNotMatch(preview, /renderNav\(\)[\s\S]{0,180}store\.categories\.slice/);

const previewData = JSON.parse(readFileSync(path.join(root, "preview/data.json"), "utf8"));
assert.ok(Array.isArray(previewData.videos), "preview data should include videos");
assert.ok(previewData.videos.length >= 6, "preview data should include enough videos");
assert.ok(previewData.videos.every((video) => video.id && video.title && video.category && video.episodes?.length), "preview videos should be navigable");
assert.ok(previewData.videos.every((video) => typeof video.score === "number"), "preview videos should include scores");
assert.ok(previewData.videos.every((video) => video.area && video.year && video.class && video.lang && video.letter), "preview videos should include filter metadata");
assert.ok(Array.isArray(previewData.history), "preview data should include history");
assert.ok(previewData.history.length >= 4, "preview history should include timeline entries");
assert.ok(previewData.history.every((entry) => entry.videoId && entry.watchedAt && entry.progress), "preview history should include usable timeline metadata");

const phpEntry = readFileSync(path.join(root, "server/index.php"), "utf8");
assert.match(phpEntry, /declare\(strict_types=1\)/);
assert.match(phpEntry, /render_page/);
assert.match(phpEntry, /PHP_VERSION_ID/);

const phpRender = readFileSync(path.join(root, "server/lib/render.php"), "utf8");
assert.match(phpRender, /hero-stats/);
assert.match(phpRender, /hot-search-panel/);
assert.match(phpRender, /热搜榜/);
assert.doesNotMatch(phpRender, /render_hot_search_panel\(\$data\)[\s\S]{0,120}<a class="history-link"/);
assert.match(phpRender, /path_for\('games'\)/);
assert.match(phpRender, /\$route === 'games'/);
assert.match(phpRender, /游戏入口/);
assert.match(phpRender, /path_for\('category', \['sort' => 'hot'\]\)/);
assert.match(phpRender, /hero-carousel/);
assert.match(phpRender, /banner-dots/);
assert.match(phpRender, /score-badge/);
assert.match(phpRender, /detail-panel/);
assert.match(phpRender, /site-logo\.png/);
assert.doesNotMatch(phpRender, /brand-text/);
assert.match(phpRender, /mobile-category-entry/);
assert.match(phpRender, /search-filter-panel/);
assert.match(phpRender, /channel-search/);
assert.match(phpRender, /filter-search-row/);
assert.match(phpRender, /\$searchClasses/);
assert.match(phpRender, /\$classFilterLinks/);
assert.match(phpRender, /path_for\('search', \['wd' => \$keyword, 'type' => \$type, 'class' => \$item\]\)/);
assert.doesNotMatch(phpRender, /<strong>子类<\/strong>/);
assert.doesNotMatch(phpRender, /data-search-type-filter/);
assert.doesNotMatch(phpRender, /data-search-type-section/);
assert.doesNotMatch(phpRender, /data-category-search/);
assert.doesNotMatch(phpRender, /data-category-search-input/);
assert.match(phpRender, /route === 'categories'/);
assert.match(phpRender, /route === 'history'/);
assert.match(phpRender, /route === 'player'/);
assert.match(phpRender, /route === 'down'/);
assert.match(phpRender, /route === 'copyright'/);
assert.match(phpRender, /data-player-fullscreen/);
assert.match(phpRender, /route === 'gbook'/);
assert.match(phpRender, /route === 'book'/);
assert.match(phpRender, /route === 'report'/);
assert.match(phpRender, /category-index/);
assert.match(phpRender, /<a class="category-hit" href="/);
assert.match(phpRender, /aria-label="进入' \. e\(\$category\) \. '"/);
assert.match(phpRender, /\$categoryPageSize = 12/);
assert.match(phpRender, /render_pagination\('categories'/);
assert.match(phpRender, /data-page-jump/);
assert.match(phpRender, /page-jump-input/);
assert.match(phpRender, /page-jump-submit/);
assert.match(phpRender, /\$area = \(string\) \(\$query\['area'\] \?\? ''\)/);
assert.match(phpRender, /\$year = \(string\) \(\$query\['year'\] \?\? ''\)/);
assert.match(phpRender, /\$class = \(string\) \(\$query\['class'\] \?\? ''\)/);
assert.match(phpRender, /\$lang = \(string\) \(\$query\['lang'\] \?\? ''\)/);
assert.match(phpRender, /\$letter = \(string\) \(\$query\['letter'\] \?\? ''\)/);
assert.match(phpRender, /\$letters = \['A', 'B', 'C', 'D', 'E', 'F'/);
assert.match(phpRender, /'M', 'N', 'O', 'P'/);
assert.match(phpRender, /'X', 'Y', 'Z', '0~9'\]/);
assert.match(phpRender, /sort_videos\(filter_videos\(\$data, \$name !== '' \? \$name : null, null, \$area, \$year, \$class, \$lang, \$letter\), \$sort\)/);
assert.match(phpRender, /'sort' => 'latest'/);
assert.match(phpRender, /'sort' => 'hot'/);
assert.match(phpRender, /'sort' => 'score'/);
assert.match(phpRender, /'area' => \$area/);
assert.match(phpRender, /'year' => \$year/);
assert.match(phpRender, /'class' => \$class/);
assert.match(phpRender, /'lang' => \$lang/);
assert.match(phpRender, /'letter' => \$letter/);
assert.match(phpRender, /history-timeline/);
assert.match(phpRender, /download-list/);
assert.match(phpRender, /copyright-box/);
assert.match(phpRender, /gbook_content/);
assert.doesNotMatch(phpRender, /array_slice\(\$data\['categories'\], 0, 6\)/);

const appJs = readThemeFile("js/app.js");
assert.match(appJs, /initLoginForms/);
assert.match(appJs, /data-login-form/);
assert.match(appJs, /fetch\(form\.action/);
assert.match(appJs, /new FormData\(form\)/);
assert.match(appJs, /X-Requested-With/);
assert.match(appJs, /showSiteNotice/);
assert.match(appJs, /initSearchForms/);
assert.doesNotMatch(appJs, /search[\s\S]{0,180}setTimeout/);
assert.match(appJs, /initPlayerFullscreen/);
assert.match(appJs, /data-player-fullscreen/);
assert.match(appJs, /requestFullscreen/);
assert.match(appJs, /webkitEnterFullscreen/);
assert.match(appJs, /screen\.orientation\.lock\("landscape"\)/);
assert.match(appJs, /window\.location\.href = redirect/);
assert.match(appJs, /initFavoriteButtons/);
assert.match(appJs, /data-favorite-action/);
assert.match(appJs, /pingfang_favorite_/);
assert.match(appJs, /is-favorited/);
assert.match(appJs, /收藏成功/);
assert.match(appJs, /clearFavoriteCache/);
assert.match(appJs, /ajaxSuccess/);
assert.match(appJs, /initPageJumpForms/);
assert.match(appJs, /data-page-jump/);
assert.match(appJs, /data-page-template/);
assert.match(appJs, /__PAGE__/);
assert.match(appJs, /window\.location\.href = target/);
assert.match(appJs, /initGsapMotion/);
assert.match(appJs, /window\.gsap/);
assert.match(appJs, /gsap\.matchMedia\(\)/);
assert.match(appJs, /prefers-reduced-motion: reduce/);
assert.match(appJs, /gsap\.timeline/);
assert.match(appJs, /initRevealMotion/);
assert.match(appJs, /IntersectionObserver/);
assert.match(appJs, /data-gsap-reveal-ready/);
assert.match(appJs, /data-gsap-revealed/);
assert.match(appJs, /\.page-title/);
assert.match(appJs, /\.filter-panel/);
assert.match(appJs, /\.content-section/);
assert.match(appJs, /\.detail-grid/);
assert.match(appJs, /\.episode-box/);
assert.match(appJs, /\.player-shell/);
assert.match(appJs, /category-tile/);
assert.match(appJs, /timeline-item/);
assert.match(appJs, /record-item/);
assert.match(appJs, /list-item/);
assert.match(appJs, /revealBatchSize/);
assert.match(appJs, /observer\.unobserve/);
assert.match(appJs, /willChange/);
assert.match(appJs, /data-gsap-carousel/);
assert.match(appJs, /delete carousel\.dataset\.gsapCarousel/);
assert.match(appJs, /clearProps: "transform,opacity,visibility,willChange"/);
assert.match(appJs, /clearProps: "transform,opacity,visibility,willChange,zIndex"/);
assert.match(appJs, /hero-slide\.is-active \.banner-copy/);
assert.match(appJs, /vod-card/);
assert.match(appJs, /rank-item/);
assert.match(appJs, /bindGsapHover\(scope, "\.category-tile"/);
assert.match(appJs, /bindGsapHover\(scope, "\.episode-grid a"/);
assert.match(appJs, /bindGsapPressFeedback/);
assert.match(appJs, /PingFangVideo\.initGsapMotion/);
assert.doesNotMatch(appJs, /initSearchTypeFilters/);
assert.doesNotMatch(appJs, /data-search-type-filter/);
assert.doesNotMatch(appJs, /data-search-type-section/);
assert.doesNotMatch(appJs, /initCategorySearch/);
assert.doesNotMatch(appJs, /data-category-search-input/);
assert.doesNotMatch(appJs, /data-category-name/);
assert.match(appJs, /initHeroCarousel/);
assert.match(appJs, /data-carousel/);
assert.match(appJs, /initRandomAvatars/);
assert.match(appJs, /data-avatar-random/);
assert.match(appJs, /data-avatar-name/);
assert.match(appJs, /letter\.textContent = name\.slice\(0, 1\) \|\| "用"/);
assert.match(appJs, /--avatar-bg/);
assert.match(appJs, /fallbackHistoryUrl/);
assert.doesNotMatch(appJs, /javascript:;/);

function renderPreview(query) {
  const code = `
parse_str(${JSON.stringify(query)}, $_GET);
require "server/lib/data.php";
require "server/lib/render.php";
$data = load_data();
echo render_page($data, (string)($_GET["route"] ?? "home"), $_GET);
`;

  return execFileSync("php", ["-r", code], { encoding: "utf8" });
}

const areaFiltered = renderPreview("route=category&area=中国香港");
assert.match(areaFiltered, /午夜档案/);
assert.doesNotMatch(areaFiltered, /云端回声/);

const yearFiltered = renderPreview("route=category&year=2025");
assert.match(yearFiltered, /南城旧事/);
assert.doesNotMatch(yearFiltered, /云端回声/);

const classFiltered = renderPreview("route=category&class=悬疑");
assert.match(classFiltered, /午夜档案/);
assert.doesNotMatch(classFiltered, /远山计划/);

const langFiltered = renderPreview("route=category&lang=粤语");
assert.match(langFiltered, /午夜档案/);
assert.doesNotMatch(langFiltered, /云端回声/);

const letterFiltered = renderPreview("route=category&letter=Y");
assert.match(letterFiltered, /云端回声/);
assert.match(letterFiltered, /远山计划/);
assert.doesNotMatch(letterFiltered, /暮色航线/);

const letterMFiltered = renderPreview("route=category&letter=M");
assert.match(letterMFiltered, /暮色航线/);
assert.doesNotMatch(letterMFiltered, /云端回声/);
