import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
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
  "images/brand/favicon.ico",
  "images/brand/favicon.png",
  "images/brand/ios_fav.png",
  "images/site-logo.png",
  "js/gsap.min.js",
  "js/react.production.min.js",
  "js/react-dom.production.min.js",
  "js/rank-react.js",
  "js/app.js",
  "player/preload.html",
  "player/buffering.html",
  "player/prompt.css",
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
  "html/public/vod_filter_common.html",
  "html/public/vod_grid_results.html",
  "html/comment/index.html",
  "html/comment/ajax.html",
  "html/gbook/index.html",
  "html/book/index.html",
  "html/book/report.html",
  "html/index/index.html",
  "html/label/categories.html",
  "html/label/comics.html",
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
  "js/hls.min.js",
  "js/pingfang-player.js",
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
  "addons/pingfangdevice/service/VodFilterOptions.php",
  "addons/pingfangdevice/view/index/index.html",
  "preview/data.json",
  "scripts/lint-template.mjs",
  "scripts/deploy-ping2.env",
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

function extractAnchorTexts(markup) {
  return [...markup.matchAll(/<a\b[^>]*>([^<]*)<\/a>/g)].map((match) => match[1]);
}

function extractCssRule(css, selector) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return css.match(new RegExp(`${escapedSelector}\\s*\\{[^}]*\\}`))?.[0] || "";
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
assert.match(readme, /scripts\/deploy-ping2\.env/);
assert.match(readme, /ROLLBACK_BACKUP/);
assert.match(readme, /GitHub Actions/);
assert.match(readme, /登录设备管理/);
assert.match(readme, /pingfangdevice/);
assert.match(readme, /最多 3 台/);
assert.match(readme, /server\/index\.php/);
assert.match(readme, /MacCMS/);
assert.match(readme, /\/template\/pingfangvideo\/player\/preload\.html/);
assert.match(readme, /\/template\/pingfangvideo\/player\/buffering\.html/);

const include = readThemeFile("html/public/include.html");
assert.match(include, /<link rel="icon" href="\{\$maccms\.path_tpl\}images\/brand\/favicon\.ico">/);
assert.match(include, /<link rel="icon" type="image\/png" sizes="64x64" href="\{\$maccms\.path_tpl\}images\/brand\/favicon\.png">/);
assert.match(include, /<link rel="apple-touch-icon" sizes="512x512" href="\{\$maccms\.path_tpl\}images\/brand\/ios_fav\.png">/);
assert.match(include, /\{\$maccms\.path\}static\/js\/jquery\.js/);
assert.match(include, /\{\$maccms\.path\}static\/js\/home\.js/);
assert.match(include, /css\/style\.css\?v=/);
assert.match(include, /"path":"\{:\s*rtrim\(\$maccms\['path'\], '\/'\)\}"/);
assert.match(include, /"aid":"\{\$maccms\.aid\}"/);
assert.match(include, new RegExp(`css/style\\.css\\?v=${assetVersionPlaceholder}`));
assert.match(include, /window\.localStorage\.getItem\("pingfang_theme"\)/);
assert.match(include, /theme === "poster-magazine"/);
assert.match(include, /document\.documentElement\.setAttribute\("data-theme", theme\)/);
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
assert.match(head, /class="brand-logo"[^>]*width="58"[^>]*height="58"/);
assert.match(head, /class="brand-logo"[^>]*decoding="async"/);
assert.doesNotMatch(head, /brand-mark">PF/);
assert.doesNotMatch(head, /brand-text/);
assert.match(head, /class="theme-switcher" data-theme-switcher/);
assert.match(head, /<button class="theme-switcher-trigger" type="button" data-theme-switcher-trigger aria-haspopup="true" aria-expanded="false">主题<\/button>/);
assert.match(head, /class="theme-switcher-menu" data-theme-switcher-menu hidden/);
assert.match(head, /data-theme-option="default" aria-pressed="true"[\s\S]*?<span>默认<\/span>/);
assert.match(head, /data-theme-option="blue-pink-purple" aria-pressed="false"[\s\S]*?<span>蓝粉紫<\/span>/);
assert.match(head, /data-theme-option="poster-magazine" aria-pressed="false"[\s\S]*?<span>海报杂志<\/span>/);
assert.match(head, /class="mobile-drawer-section mobile-theme-section"/);
assert.match(head, /data-theme-switcher-mobile/);
const desktopNavLinks = head.match(/<nav class="site-nav"[\s\S]*?<\/nav>/)?.[0] || "";
assert.deepEqual(extractAnchorTexts(desktopNavLinks), ["首页", "视频", "漫画", "文章", "游戏"]);
assert.match(desktopNavLinks, /<a href="\{:mac_url\('label\/categories'\)\}">视频<\/a>/);
assert.doesNotMatch(desktopNavLinks, /nav-video-menu/);
assert.doesNotMatch(desktopNavLinks, /nav-video-panel/);
assert.match(desktopNavLinks, /<a href="\{:mac_url\('label\/comics'\)\}">漫画<\/a>/);
assert.match(desktopNavLinks, /<a href="\{:mac_url\('art\/index'\)\}">文章<\/a>/);
assert.match(desktopNavLinks, /<a href="\{:mac_url\('website\/index'\)\}">游戏<\/a>/);
assert.doesNotMatch(desktopNavLinks, />分类<\/a>/);
assert.doesNotMatch(desktopNavLinks, />收藏<\/a>/);
const mobileDrawerLinks = head.match(/<nav class="mobile-drawer-links"[\s\S]*?<\/nav>/)?.[0] || "";
assert.deepEqual(extractAnchorTexts(mobileDrawerLinks), ["首页", "视频", "漫画", "文章", "游戏"]);
assert.match(mobileDrawerLinks, /<a href="\{:mac_url\('label\/categories'\)\}">视频<\/a>/);
assert.match(mobileDrawerLinks, /<a href="\{:mac_url\('label\/comics'\)\}">漫画<\/a>/);
assert.match(mobileDrawerLinks, /<a href="\{:mac_url\('art\/index'\)\}">文章<\/a>/);
assert.match(head, /mac_url\('website\/index'\)/);
assert.match(head, /<a href="\{:mac_url\('website\/index'\)\}">游戏<\/a>/);
assert.match(head, /aria-controls="mobileDrawer"/);
assert.match(head, /class="mobile-drawer-backdrop" data-mobile-nav-close hidden/);
assert.match(head, /<aside class="mobile-drawer" id="mobileDrawer" aria-label="移动端分类菜单" aria-hidden="true">/);
assert.match(head, /class="mobile-drawer-close"[^>]*data-mobile-nav-close/);
assert.match(head, /<nav class="mobile-drawer-links" aria-label="移动端快捷导航">/);
assert.doesNotMatch(mobileDrawerLinks, /user\/favs/);
assert.doesNotMatch(mobileDrawerLinks, /user\/plays/);
assert.match(head, /class="mobile-drawer-section mobile-drawer-account"/);
assert.match(head, /<span>账号<\/span>/);
assert.match(head, /class="mobile-drawer-user"/);
assert.match(head, /class="mobile-drawer-login" href="\{:mac_url\('user\/login'\)\}">登录<\/a>/);
assert.match(head, /<a href="\{:mac_url\('user\/index'\)\}">用户中心<\/a>/);
assert.match(head, /<a href="\{:mac_url\('user\/favs'\)\}">我的收藏<\/a>/);
assert.match(head, /class="mobile-drawer-cats"/);
assert.match(head, /\{maccms:type ids="parent" mid="1" order="asc" by="sort" num="100" id="type"\}/);
assert.match(head, /href="\{:mac_url_type\(\$type\)\}">\{\$type\.type_name\}<\/a>/);
assert.match(head, /mac_url\('user\/plays'\)/);
assert.match(head, /mac_url\('user\/favs'\)/);
assert.match(head, /class="user-menu"/);
assert.match(head, /\$user\.user_id/);
assert.match(head, /mac_url\('user\/login'\)/);
assert.match(head, /mac_url\('user\/index'\)/);
assert.match(head, /url\('pingfangdevice\/index'\)/);
assert.match(head, /url\('pingfangdevice\/logout'\)/);
assert.equal((head.match(/data-logout-link/g) || []).length, 2);
assert.equal((head.match(/data-logout-redirect="\{:mac_url\('user\/login'\)\}"/g) || []).length, 2);
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
assert.match(categoriesPage, /seo_title="视频分类"/);
assert.match(categoriesPage, /category-index/);
assert.doesNotMatch(categoriesPage, /class="category-search"/);
assert.doesNotMatch(categoriesPage, /data-category-search/);
assert.doesNotMatch(categoriesPage, /data-category-search-input/);
assert.doesNotMatch(categoriesPage, /placeholder="搜索分类"/);
assert.doesNotMatch(categoriesPage, /data-category-search-empty/);
assert.doesNotMatch(categoriesPage, /data-category-name="\{\$type\.type_name\}"/);

const comicsPage = readThemeFile("html/label/comics.html");
assert.match(comicsPage, /seo_title="漫画"/);
assert.match(comicsPage, /module-fallback/);
assert.match(comicsPage, /漫画入口维护中/);
assert.match(comicsPage, /mac_url\('vod\/show'\)/);
assert.match(comicsPage, /\{include file="public\/foot" \/\}/);
assert.match(categoriesPage, /\{maccms:type ids="parent" mid="1" order="asc" by="sort"/);
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
const currentYearVodAttr = String.raw`year="'\.date\('Y'\)\.'"`;
assert.match(hotLabelPage, /seo_title="年度热播榜"/);
assert.match(hotLabelPage, /本年最多播放/);
assert.match(hotLabelPage, new RegExp(`\\{maccms:vod num="24" paging="yes" pageurl="label/hot" type="${nonAdultVodTypeScope}" ${currentYearVodAttr} order="desc" by="hits" id="vo"\\}`));
assert.doesNotMatch(hotLabelPage, /\{maccms:vod[^}]*type="all"[^}]*by="hits"/);
assert.match(hotLabelPage, /include file="public\/vod_card"/);
assert.match(hotLabelPage, /include file="public\/paging"/);
assert.match(hotLabelPage, /\{include file="public\/foot" \/\}/);

const videosLabelPage = readThemeFile("html/label/videos.html");
assert.match(videosLabelPage, /seo_title="影片库"/);
assert.match(videosLabelPage, new RegExp(`\\{maccms:vod num="24" paging="yes" pageurl="label/videos" type="${nonAdultVodTypeScope}" order="desc" by="time" id="vo"\\}`));
assert.doesNotMatch(videosLabelPage, /\{maccms:vod[^}]*type="all"[^}]*by="time"/);
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
assert.match(userLoginPage, /login_verify/);
assert.match(userLoginPage, /name="verify"/);
assert.match(userLoginPage, /class="mac_verify_img"[^>]*src="\{:url\('verify\/index'\)\}"/);
assert.match(userLoginPage, /type="hidden" name="openid"/);
assert.match(userLoginPage, /type="hidden" name="col"/);

const devicePage = readThemeFile("html/pingfangdevice/index.html");
assert.match(devicePage, /\{include file="public\/head" seo_title="登录设备管理"/);
assert.match(devicePage, /登录设备管理/);
assert.match(devicePage, /最多 \{\$max_devices\} 台设备/);
assert.match(devicePage, /\{volist name="device_list" id="vo"\}/);
assert.match(devicePage, /当前设备/);
assert.match(devicePage, /最近登录时间/);
assert.match(devicePage, /device_label_display/);
assert.match(devicePage, /ip_address_display/);
assert.match(devicePage, /user_agent_display/);
assert.match(devicePage, /data-device-revoke/);
assert.match(devicePage, /url\('pingfangdevice\/revoke'\)/);
assert.match(devicePage, /"X-Requested-With": "XMLHttpRequest"/);
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
assert.match(userPlaysPage, /data-record-video-id="\{\$vo\.ulog_rid\}"/);
assert.match(userPlaysPage, /data-record-id="\{\$vo\.ulog_id\}"/);
assert.match(userPlaysPage, /collapsePlaybackRecords/);
assert.match(userPlaysPage, /recordDeleteIds/);
assert.match(userPlaysPage, /seenByVideo/);
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
assert.match(index, new RegExp(`\\{maccms:vod type="${nonAdultVodTypeScope}" num="6" ${currentYearVodAttr} order="desc" by="time" cachetime="300" id="vo"\\}`));
assert.doesNotMatch(index, /\{maccms:vod type="all" num="6" order="desc" by="time" id="vo"\}/);
for (const typeId of nonAdultVodTypeScope.split(",")) {
  assert.match(index, new RegExp(`\\{maccms:type ids="${typeId}" order="asc" by="sort" num="1" id="type"\\}`));
}
assert.match(index, /mac_data_count\(0,'today','vod'\)/);
assert.doesNotMatch(index, /mac_data_count\(0,'all','vod'\)/);
assert.doesNotMatch(index, /全站片库/);
assert.match(index, /hero-carousel/);
assert.doesNotMatch(index, /hero-gradient-strips/);
assert.doesNotMatch(index, /data-gradient-strips?/);
assert.match(index, /hero-slide/);
assert.match(index, /banner-content/);
assert.match(index, /data-banner-bg="\{if condition="\$vo\.vod_pic_slide neq ''"\}\{\$vo\.vod_pic_slide\|mac_url_img\}\{else\/\}\{\$vo\.vod_pic\|mac_url_img\}\{\/if\}"/);
assert.match(index, /\{if condition="\$key eq 1"\} style="--banner-bg: url\('\{if condition="\$vo\.vod_pic_slide neq ''"\}\{\$vo\.vod_pic_slide\|mac_url_img\}\{else\/\}\{\$vo\.vod_pic\|mac_url_img\}\{\/if\}'\);"\{\/if\}/);
assert.match(index, /class="primary-btn" href="\{:mac_url_vod_play\(\$vo\)\}">立即播放<\/a>/);
assert.match(index, /class="ghost-btn" href="\{:mac_url_vod_detail\(\$vo\)\}">详情介绍<\/a>/);
assert.match(index, /vod_duration\|mac_default='时长待定'/);
assert.match(index, /vod_version\|mac_default='高清'/);
assert.match(index, /banner-dots/);
assert.doesNotMatch(index, /hero-stats/);
assert.doesNotMatch(index, /banner-art/);
assert.doesNotMatch(index, /banner-poster/);
assert.doesNotMatch(index, /data-carousel-prev/);
assert.doesNotMatch(index, /data-carousel-next/);
assert.match(index, /rank-index/);
assert.match(index, /rank-thumb/);
assert.match(index, /data-rank-react-root/);
assert.doesNotMatch(index, /data-rank-visible-count/);
assert.match(index, /data-rank-react-list/);
assert.match(index, /data-rank-item/);
assert.match(index, /\{maccms:vod type="42,47,48,57,111" num="5" order="desc" by="hits" cachetime="300" id="vo" key="key"\}/);
assert.match(index, new RegExp(`\\{maccms:vod type="${nonAdultVodTypeScope}" num="5" ${currentYearVodAttr} order="desc" by="hits" cachetime="300" id="vo" key="key"\\}`));
assert.doesNotMatch(index, /is-rank-extra/);
assert.match(index, /data-rank-title="\{\$vo\.vod_name\}"/);
assert.match(index, /data-rank-meta="\{\$vo\.vod_year\|mac_default='年份未知'\} · \{\$vo\.vod_class\|mac_default='类型待定'\}"/);
assert.match(index, /data-rank-score="\{\$vo\.vod_score\|mac_default='8\.0'\}"/);
assert.match(index, /data-rank-pic="\{\$vo\.vod_pic\|mac_url_img\}"/);
assert.match(index, /class="rank-thumb"[\s\S]*<img src="\{\$vo\.vod_pic\|mac_url_img\}" alt="\{\$vo\.vod_name\}" width="112" height="84" loading="lazy" decoding="async" sizes="72px">/);
assert.match(index, /rank-body/);
assert.match(index, /rank-meta/);
assert.match(index, /rank-score/);
assert.doesNotMatch(index, /js\/react\.production\.min\.js/);
assert.doesNotMatch(index, /js\/react-dom\.production\.min\.js/);
assert.doesNotMatch(index, /js\/rank-react\.js/);
assert.doesNotMatch(index, /unpkg|jsdelivr|localhost|127\.0\.0\.1/);
assert.match(index, /home-shelf home-shelf-latest/);
assert.match(index, /home-shelf-tabs/);
assert.match(index, /home-shelf-card" href="\{:\s*mac_url_vod_detail\(\$vo\)\}" title="\{\$vo\.vod_name\}">/);
assert.match(index, /home-shelf-poster/);
assert.match(index, /home-shelf-score/);
assert.match(index, /<h2>本年最新上线<\/h2>/);
assert.match(index, /aria-label="最新分类"/);
assert.match(index, /data-home-tab="all"/);
assert.match(index, /data-home-tab="category-1"/);
assert.match(index, /data-home-tab="category-5"/);
assert.match(index, /<button class="is-active" type="button" data-home-tab="all" role="tab" aria-selected="true" aria-controls="latest-panel-all">推荐<\/button>/);
assert.match(index, /<button type="button" data-home-tab="category-1" role="tab" aria-selected="false" aria-controls="latest-panel-category-1">/);
assert.match(index, /<button type="button" data-home-tab="category-5" role="tab" aria-selected="false" aria-controls="latest-panel-category-5">/);
assert.doesNotMatch(index, /href="#home-latest-/);
assert.doesNotMatch(index, /id="home-latest-/);
assert.match(index, /id="latest-panel-all"/);
for (const [tabIndex, typeId] of [
  ["1", "42"],
  ["2", "47"],
  ["3", "48"],
  ["4", "57"],
  ["5", "111"],
]) {
  assert.match(index, new RegExp(`id="latest-panel-category-${tabIndex}"[\\s\\S]*?\\{maccms:vod type="${typeId}" num="6" ${currentYearVodAttr} order="desc" by="time" cachetime="300" id="vo"\\}`));
}
for (const vodTag of index.match(/\{maccms:vod[^}]+\}/g) || []) {
  assert.doesNotMatch(vodTag, /\stype="[^"]*\{/, `${vodTag} should not use dynamic template syntax in type attribute`);
}
assert.doesNotMatch(index, /include file="public\/vod_card"/);
assert.match(index, /<h2>年度热播榜<\/h2>/);
assert.match(index, /class="rank-refresh" href="\{:mac_url\('label\/hot'\)\}">查看更多<\/a>/);
assert.doesNotMatch(index, /换一换/);
assert.match(index, /mac_url\('label\/hot'\)/);
assert.match(index, /mac_url\('label\/videos'\)/);
assert.doesNotMatch(index, /class="wrap quick-types"/);
assert.doesNotMatch(index, /\{maccms:type ids="parent" order="asc" by="sort" num="10" id="type"\}/);
assert.doesNotMatch(index, /\{maccms:type ids="parent" order="asc" by="sort" num="4" id="type"\}/);
assert.equal((index.match(new RegExp(`\\{maccms:vod type="${nonAdultVodTypeScope}" num="5" order="desc" by="hits"`, "g")) || []).length, 1);
assert.equal((index.match(new RegExp(`\\{maccms:vod type="${nonAdultVodTypeScope}" num="5" ${currentYearVodAttr} order="desc" by="hits"`, "g")) || []).length, 1);
assert.equal((index.match(/data-carousel-dot/g) || []).length, 0);
assert.equal((index.match(new RegExp(`\\{maccms:vod type="${nonAdultVodTypeScope}" num="12" order="desc" by="rnd"`, "g")) || []).length, 0);
assert.equal((index.match(new RegExp(`\\{maccms:vod type="${nonAdultVodTypeScope}" num="6" order="desc" by="hits"`, "g")) || []).length, 0);
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
assert.doesNotMatch(play, /\{\$maccms\.path_tpl\}js\/hls\.min\.js/);
assert.doesNotMatch(play, /\{\$maccms\.path_tpl\}js\/pingfang-player\.js/);
assert.match(play, /mac_ulog_set/);
assert.match(play, /data-next-play-url="\{\$obj\.player_info\.link_next\}"/);
assert.match(play, /player-toolbar/);
assert.doesNotMatch(play, /data-player-fullscreen/);
assert.doesNotMatch(play, /横屏全屏/);
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
assert.doesNotMatch(playerPage, /\{\$maccms\.path_tpl\}js\/hls\.min\.js/);
assert.doesNotMatch(playerPage, /\{\$maccms\.path_tpl\}js\/pingfang-player\.js/);
assert.match(playerPage, /试看播放/);
assert.doesNotMatch(playerPage, /data-player-fullscreen/);
assert.doesNotMatch(playerPage, /横屏全屏/);
assert.match(playerPage, /\$obj\['vod_play_list'\]\[\$param\['sid'\]\]\['urls'\]\[\$param\['nid'\]\]\['name'\]/);
assert.doesNotMatch(playerPage, /<h1>\{\$obj\.vod_name\}<\/h1>/);
assert.match(playerPage, /\{include file="public\/foot" \/\}/);

const preloadPrompt = readThemeFile("player/preload.html");
const bufferingPrompt = readThemeFile("player/buffering.html");
const playerPromptStyle = readThemeFile("player/prompt.css");

assert.match(preloadPrompt, /class="player-prompt player-prompt--preload"/);
assert.match(preloadPrompt, /role="status"/);
assert.match(preloadPrompt, /aria-live="polite"/);
assert.match(preloadPrompt, /正在准备播放/);
assert.match(preloadPrompt, new RegExp(`href="\\.\\/prompt\\.css\\?v=${assetVersionPlaceholder}"`));

assert.match(bufferingPrompt, /class="player-prompt player-prompt--buffering"/);
assert.match(bufferingPrompt, /role="status"/);
assert.match(bufferingPrompt, /aria-live="polite"/);
assert.match(bufferingPrompt, /正在续接画面/);
assert.match(bufferingPrompt, new RegExp(`href="\\.\\/prompt\\.css\\?v=${assetVersionPlaceholder}"`));

for (const prompt of [preloadPrompt, bufferingPrompt]) {
  assert.match(prompt, /<meta name="viewport"/);
  assert.doesNotMatch(prompt, /<script\b/);
  assert.doesNotMatch(prompt, /https?:\/\//);
}

assert.match(playerPromptStyle, /@media \(prefers-reduced-motion: reduce\)/);
assert.match(playerPromptStyle, /@media \(max-width: 560px\)/);
assert.match(playerPromptStyle, /@keyframes preload-signal/);
assert.match(playerPromptStyle, /@keyframes buffer-orbit/);
assert.doesNotMatch(playerPromptStyle, /transition:\s*all/);

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

const vodFilterCommonPartial = readThemeFile("html/public/vod_filter_common.html");
const vodGridResultsPartial = readThemeFile("html/public/vod_grid_results.html");
function expandVodGridResults(pageurl, vodType) {
  return vodGridResultsPartial.replaceAll("[pageurl]", pageurl).replaceAll("[vod_type]", vodType);
}

const typePageSource = readThemeFile("html/vod/type.html");
const typePage = [typePageSource, vodFilterCommonPartial, expandVodGridResults("vod/type", "current")].join("\n");
assert.match(typePage, /\{include file="public\/head" seo_title=/);
assert.match(typePageSource, /\{include file="public\/vod_filter_common" \/\}/);
assert.match(typePageSource, /\{include file="public\/vod_grid_results" pageurl="vod\/type" vod_type="current" \/\}/);
assert.match(typePage, /\{maccms:vod num="24" paging="yes"/);
assert.match(typePage, /pageurl="vod\/type"/);
assert.doesNotMatch(typePage, /\$param\['by'\]/);
assert.match(typePage, /filter-panel category-filter/);
assert.match(typePage, /data-dynamic-vod-filters/);
assert.match(typePage, /data-filter-endpoint="\{:url\('pingfangdevice\/filters'\)\}"/);
assert.match(typePage, /data-filter-type-id="\{\$obj\.type_id\}"/);
assert.match(typePage, /data-current-area="\{\$param\.area\}"/);
assert.match(typePage, /data-current-year="\{\$param\.year\}"/);
assert.match(typePage, /data-current-lang="\{\$param\.lang\}"/);
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
assert.match(typePage, /\{maccms:type parent="'\.\$obj\['type_id'\]\.'" order="asc" by="sort" num="100" id="type"\}/);
assert.match(typePage, /mac_url_type\(\$type,\['area'=>\$param\['area'\][\s\S]*\],'show'\)/);
assert.match(typePage, /mac_url_type\(\$obj,\['area'=>\$param\['area'\][\s\S]*'by'=>'hits'\],'show'\)/);
assert.doesNotMatch(typePage, /<strong>子类<\/strong>/);
assert.equal((typePage.match(/<strong>类型<\/strong>/g) || []).length, 1);
assert.match(typePage, /<div class="filter-row">\s*<strong>类型<\/strong>/);
assert.doesNotMatch(typePage, /<div class="filter-row" data-filter-kind="area">\s*<strong>类型<\/strong>/);
assert.match(typePage, /<strong>地区<\/strong>/);
assert.match(typePage, /<div class="filter-row" data-filter-kind="area">\s*<strong>地区<\/strong>/);
assert.match(typePage, /data-filter-kind="area"/);
assert.match(typePage, /<strong>年份<\/strong>/);
assert.match(typePage, /data-filter-kind="year"/);
assert.match(typePage, /<strong>语言<\/strong>/);
assert.match(typePage, /data-filter-kind="lang"/);
assert.match(typePage, /<strong>字母<\/strong>/);
assert.match(typePage, /<strong>排序<\/strong>/);
assert.match(typePage, /\$obj\.type_extend\.area/);
assert.match(typePage, /\$obj\.parent\.type_extend\.area/);
assert.match(typePage, /\$maccms\.vod_extend_area/);
assert.match(typePage, /\$obj\.type_extend\.year/);
assert.match(typePage, /\$maccms\.vod_extend_year/);
assert.doesNotMatch(typePage, /\$obj\.type_extend\.class/);
assert.doesNotMatch(typePage, /\$obj\.parent\.type_extend\.class/);
assert.match(typePage, /\$obj\.type_extend\.lang/);
assert.match(typePage, /\$maccms\.vod_extend_lang/);
assert.match(typePage, /'area'=>\$vo2/);
assert.match(typePage, /data-filter-value="\{\$vo2\}"/);
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

const showPageSource = readThemeFile("html/vod/show.html");
const showPage = [showPageSource, vodFilterCommonPartial, expandVodGridResults("vod/show", nonAdultVodTypeScope)].join("\n");
assert.match(showPageSource, /\{include file="public\/vod_filter_common" \/\}/);
assert.match(showPageSource, new RegExp(`\\{include file="public/vod_grid_results" pageurl="vod/show" vod_type="${nonAdultVodTypeScope}" \\/\\}`));
assert.match(vodGridResultsPartial, /pageurl="\[pageurl\]"/);
assert.match(vodGridResultsPartial, /type="\[vod_type\]"/);
assert.match(showPage, /data-dynamic-vod-filters/);
assert.match(showPage, /data-filter-endpoint="\{:url\('pingfangdevice\/filters'\)\}"/);
assert.match(showPage, /data-filter-type-id="\{\$obj\.type_id\}"/);
assert.match(showPage, /data-current-area="\{\$param\.area\}"/);
assert.match(showPage, /data-current-year="\{\$param\.year\}"/);
assert.match(showPage, /data-current-lang="\{\$param\.lang\}"/);
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
assert.match(showPage, /\{maccms:type parent="'\.\$obj\['type_pid'\]\.'" order="asc" by="sort" num="100" id="type"\}/);
assert.match(showPage, /\{maccms:type parent="'\.\$obj\['type_id'\]\.'" order="asc" by="sort" num="100" id="type"\}/);
assert.match(showPage, /mac_url_type\(\$type,\['area'=>\$param\['area'\][\s\S]*\],'show'\)/);
assert.match(showPage, /mac_url_type\(\$obj,\['area'=>\$param\['area'\][\s\S]*'by'=>'hits'\],'show'\)/);
assert.doesNotMatch(showPage, /<strong>子类<\/strong>/);
assert.equal((showPage.match(/<strong>类型<\/strong>/g) || []).length, 1);
assert.match(showPage, /<div class="filter-row">\s*<strong>类型<\/strong>/);
assert.doesNotMatch(showPage, /<div class="filter-row" data-filter-kind="area">\s*<strong>类型<\/strong>/);
assert.match(showPage, /<strong>地区<\/strong>/);
assert.match(showPage, /<div class="filter-row" data-filter-kind="area">\s*<strong>地区<\/strong>/);
assert.match(showPage, /data-filter-kind="area"/);
assert.match(showPage, /<strong>年份<\/strong>/);
assert.match(showPage, /data-filter-kind="year"/);
assert.match(showPage, /<strong>语言<\/strong>/);
assert.match(showPage, /data-filter-kind="lang"/);
assert.match(showPage, /<strong>字母<\/strong>/);
assert.match(showPage, /\$obj\.type_extend\.area/);
assert.match(showPage, /\$obj\.parent\.type_extend\.area/);
assert.match(showPage, /\$maccms\.vod_extend_area/);
assert.match(showPage, /\$obj\.type_extend\.year/);
assert.match(showPage, /\$maccms\.vod_extend_year/);
assert.doesNotMatch(showPage, /\$obj\.type_extend\.class/);
assert.doesNotMatch(showPage, /\$obj\.parent\.type_extend\.class/);
assert.match(showPage, /\$obj\.type_extend\.lang/);
assert.match(showPage, /\$maccms\.vod_extend_lang/);
assert.match(showPage, /'area'=>\$vo2/);
assert.match(showPage, /data-filter-value="\{\$vo2\}"/);
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
for (const sortField of ["hits", "score", "time"]) {
  assert.match(showPage, new RegExp(`\\{maccms:vod num="24" paging="yes" pageurl="vod/show" type="${nonAdultVodTypeScope}"[\\s\\S]*order="desc" by="${sortField}" id="vo"\\}`));
}
assert.doesNotMatch(showPage, /\{maccms:vod[^}]*pageurl="vod\/show"[^}]*type="all"/);

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
assert.doesNotMatch(vodCardPartial, /vod_actor/);
assert.doesNotMatch(vodCardPartial, /主演待更新/);

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
const appScript = readThemeFile("js/app.js");
const posterRootRule = extractCssRule(style, 'html[data-theme="poster-magazine"]');
const posterHeroGridRule = extractCssRule(style, 'html[data-theme="poster-magazine"] .hero-grid');
const posterHeroCarouselRule = extractCssRule(style, 'html[data-theme="poster-magazine"] .hero-carousel');
const posterHeroRankRule = extractCssRule(style, 'html[data-theme="poster-magazine"] .hero-rank');
const posterHeroRankBeforeRule = extractCssRule(style, 'html[data-theme="poster-magazine"] .hero-rank::before');
const posterShelfRailRule = extractCssRule(style, 'html[data-theme="poster-magazine"] .home-shelf-rail');
const posterShelfCardRule = extractCssRule(style, 'html[data-theme="poster-magazine"] .home-shelf-card');
const posterShelfFirstCardRule = extractCssRule(style, 'html[data-theme="poster-magazine"] .home-shelf-card:first-child');
const playerShellRule = [...style.matchAll(/(?:^|\n)\.player-shell\s*\{[^}]*\}/g)].map((match) => match[0]).find((rule) => /aspect-ratio/.test(rule)) || "";
const playerMediaRule = style.match(/\.player-shell #MacPlayer,[\s\S]*?\.player-shell object\s*\{[^}]*\}/)?.[0] || "";
const playerMacRule = extractCssRule(style, ".player-shell #MacPlayer");
const playerMacChildrenRule = extractCssRule(style, ".player-shell #MacPlayer > *");
const rootRule = style.match(/:root\s*\{[\s\S]*?\}/)?.[0] || "";
const siteHeaderRule = style.match(/\.site-header\s*\{[\s\S]*?\}/)?.[0] || "";
const userDropdownRule = style.match(/\.user-dropdown\s*\{[\s\S]*?\}/)?.[0] || "";
const navigationBorderRule = style.match(/\.site-nav a,\n\.history-link,[\s\S]*?\.filter-panel a\s*\{[\s\S]*?\}/)?.[0] || "";
const interactiveHoverRule = style.match(/\.site-nav a:hover,[\s\S]*?\.filter-panel a:hover\s*\{[\s\S]*?\}/)?.[0] || "";
const selectedBorderRule = style.match(/\.site-nav a\[aria-current="page"\],[\s\S]*?\.page-state\s*\{[\s\S]*?\}/)?.[0] || "";
const focusBorderRule = style.match(/a:focus-visible,[\s\S]*?\.user-dropdown a:focus-visible\s*\{[\s\S]*?\}/)?.[0] || "";
const fieldFocusRule = style.match(/\.header-search:focus-within,[\s\S]*?\.page-jump-input:focus-visible\s*\{[\s\S]*?\}/)?.[0] || "";
const heroGridRule = style.match(/\.hero-grid\s*\{[\s\S]*?\}/)?.[0] || "";
const heroCarouselRule = style.match(/\.hero-carousel\s*\{[\s\S]*?\}/)?.[0] || "";
const heroCarouselAfterRule = style.match(/\.hero-carousel::after\s*\{[\s\S]*?\}/)?.[0] || "";
const bannerTrackRule = style.match(/\.banner-track\s*\{[\s\S]*?\}/)?.[0] || "";
const bannerBgBeforeRule = style.match(/\.hero-carousel\[data-banner-iridescence="true"\] \.banner-bg::before\s*\{[\s\S]*?\}/)?.[0] || "";
const bannerBgAfterRule = style.match(/\.banner-bg::after\s*\{[\s\S]*?\}/)?.[0] || "";
const heroRankRule = style.match(/\.hero-rank\s*\{[\s\S]*?\}/)?.[0] || "";
const heroRankBeforeRule = style.match(/\.hero-rank::before\s*\{[\s\S]*?\}/)?.[0] || "";
const heroRankHeadRule = style.match(/\.hero-rank \.section-head\s*\{[\s\S]*?\}/)?.[0] || "";
const rankRefreshRule = style.match(/\.rank-refresh\s*\{[\s\S]*?\}/)?.[0] || "";
const rankItemRule = style.match(/\.rank-item\s*\{[\s\S]*?\}/)?.[0] || "";
const rankFirstItemRule = style.match(/\.hero-rank \.rank-item:first-of-type\s*\{[\s\S]*?\}/)?.[0] || "";
const rankFirstIndexRule = style.match(/\.hero-rank \.rank-item:first-of-type \.rank-index\s*\{[\s\S]*?\}/)?.[0] || "";
const rankIndexRule = style.match(/(?:^|\n)\.rank-index\s*\{[\s\S]*?\}/)?.[0] || "";
const rankThumbRule = style.match(/\.rank-thumb\s*\{[\s\S]*?\}/)?.[0] || "";
const rankThumbImgRule = style.match(/\.rank-thumb img\s*\{[\s\S]*?\}/)?.[0] || "";
const rankBodyRule = style.match(/(?:^|\n)\.rank-body\s*\{[\s\S]*?\}/)?.[0] || "";
const rankMetaRule = style.match(/\.rank-meta\s*\{[\s\S]*?\}/)?.[0] || "";
const rankScoreRule = style.match(/\.rank-score\s*\{[\s\S]*?\}/)?.[0] || "";
const heroSlideRule = style.match(/\.hero-slide\s*\{[\s\S]*?\}/)?.[0] || "";
const activeHeroSlideRule = style.match(/\.hero-slide\.is-active\s*\{[\s\S]*?\}/)?.[0] || "";
const bannerContentRule = style.match(/\.banner-content\s*\{[\s\S]*?\}/)?.[0] || "";
const bannerCopyRule = style.match(/\.banner-copy\s*\{[\s\S]*?\}/)?.[0] || "";
const bannerTitleRule = style.match(/\.banner-copy strong\s*\{[\s\S]*?\}/)?.[0] || "";
const bannerExcerptRule = style.match(/\.banner-copy small\s*\{[\s\S]*?\}/)?.[0] || "";
const heroCarouselStatsRule = style.match(/\.hero-carousel \.hero-stats\s*\{[\s\S]*?\}/)?.[0] || "";
const bannerControlsRule = style.match(/\.banner-controls\s*\{[\s\S]*?\}/)?.[0] || "";
const bannerControlsBeforeRule = style.match(/\.banner-controls::before\s*\{[\s\S]*?\}/)?.[0] || "";
const bannerDotRule = style.match(/\.banner-dot\s*\{[\s\S]*?\}/)?.[0] || "";
const bannerDotAfterRule = style.match(/\.banner-dot::after\s*\{[\s\S]*?\}/)?.[0] || "";
const bannerDotActiveRule = style.match(/\.banner-dot\.is-active\s*\{[\s\S]*?\}/)?.[0] || "";
const bannerDotActiveAfterRule = style.match(/\.banner-dot\.is-active::after\s*\{[\s\S]*?\}/)?.[0] || "";
const hotSearchTermRule = style.match(/\.hot-search-panel a\s*\{[\s\S]*?\}/)?.[0] || "";
const pageHeadingRule = style.match(/\.hero-copy h1,[\s\S]*?\.player-head h1\s*\{[\s\S]*?\}/)?.[0] || "";
const rankListTitleRule = style.match(/\.rank-item strong,[\s\S]*?\.list-item strong\s*\{[\s\S]*?\}/)?.[0] || "";
const vodCardTitleRule = style.match(/\.vod-card strong\s*\{[\s\S]*?\}/)?.[0] || "";
const vodCardRule = style.match(/\.vod-card\s*\{[\s\S]*?\}/)?.[0] || "";
const vodCardMetaRule = style.match(/\.card-meta\s*\{[\s\S]*?\}/)?.[0] || "";
const vodCardMetaChipRule = style.match(/\.card-meta span\s*\{[\s\S]*?\}/)?.[0] || "";
const posterRemarkRule = style.match(/\.poster em,[\s\S]*?\.detail-poster span\s*\{[\s\S]*?\}/)?.[0] || "";
const categoryMainTitleRule = style.match(/\.category-main span\s*\{[\s\S]*?\}/)?.[0] || "";
const categoryChildLinkRule = style.match(/\.category-children a\s*\{[\s\S]*?\}/)?.[0] || "";
const timelineTitleRule = style.match(/\.timeline-card strong\s*\{[\s\S]*?\}/)?.[0] || "";
const episodeLinkRule = style.match(/\.episode-grid a\s*\{[\s\S]*?\}/)?.[0] || "";
const episodeActiveRule = style.match(/\.episode-grid a:hover,[\s\S]*?\.episode-grid a\.is-active\s*\{[\s\S]*?\}/)?.[0] || "";
const playerToolbarTextRule = style.match(/\.player-toolbar span\s*\{[\s\S]*?\}/)?.[0] || "";
const downloadTitleRule = style.match(/\.download-list strong\s*\{[\s\S]*?\}/)?.[0] || "";
const recordTitleRule = [...style.matchAll(/(?:^|\n)\.record-title\s*\{[\s\S]*?\}/g)].map((match) => match[0]).find((rule) => /overflow/.test(rule)) || "";
const systemBoxTitleRule = style.match(/\.system-box h1\s*\{[\s\S]*?\}/)?.[0] || "";
const contentBodyWrapRule = style.match(/\.hero-copy p,[\s\S]*?\.site-footer p\s*\{[\s\S]*?\}/)?.[0] || "";
const homeShelfRule = style.match(/(?:^|\n)\.home-shelf\s*\{[\s\S]*?\}/)?.[0] || "";
const homeShelfHeadRule = style.match(/\.home-shelf-head\s*\{[\s\S]*?\}/)?.[0] || "";
const homeShelfTabsRule = style.match(/\.home-shelf-tabs\s*\{[\s\S]*?\}/)?.[0] || "";
const homeShelfTabsActiveRule = style.match(/\.home-shelf-tabs button\.is-active\s*\{[\s\S]*?\}/)?.[0] || "";
const homeShelfRailRule = style.match(/\.home-shelf-rail\s*\{[\s\S]*?\}/)?.[0] || "";
const hiddenHomeShelfRailRule = style.match(/\.home-shelf-rail\[hidden\]\s*\{[\s\S]*?\}/)?.[0] || "";
const homeShelfCardRule = style.match(/(?:^|\n)\.home-shelf-card\s*\{[\s\S]*?\}/)?.[0] || "";
const homeShelfCardBeforeRule = style.match(/\.home-shelf-card::before\s*\{[\s\S]*?\}/)?.[0] || "";
const homeShelfCardHoverRule = style.match(/\.home-shelf-card:hover\s*\{[\s\S]*?\}/)?.[0] || "";
const homeShelfPosterRule = style.match(/\.home-shelf-poster\s*\{[\s\S]*?\}/)?.[0] || "";
const homeShelfPosterImgRule = style.match(/\.home-shelf-poster img\s*\{[\s\S]*?\}/)?.[0] || "";
const homeShelfPosterHoverRule = style.match(/\.home-shelf-card:hover \.home-shelf-poster\s*\{[\s\S]*?\}/)?.[0] || "";
const homeShelfPosterImgHoverRule = style.match(/\.home-shelf-card:hover \.home-shelf-poster img\s*\{[\s\S]*?\}/)?.[0] || "";
const homeShelfBadgeRule = style.match(/\.home-shelf-poster em\s*\{[\s\S]*?\}/)?.[0] || "";
const homeShelfBodyRule = style.match(/\.home-shelf-body\s*\{[\s\S]*?\}/)?.[0] || "";
const homeShelfTitleRule = style.match(/\.home-shelf-body strong\s*\{[\s\S]*?\}/)?.[0] || "";
const homeShelfMetaRule = style.match(/\.home-shelf-body small\s*\{[\s\S]*?\}/)?.[0] || "";
const homeShelfScoreRule = style.match(/\.home-shelf-score\s*\{[\s\S]*?\}/)?.[0] || "";
const homeShelfFeaturedBodyRule = style.match(/\.home-shelf-card\.is-featured \.home-shelf-body\s*\{[\s\S]*?\}/)?.[0] || "";
const homeShelfFeaturedTextRule = style.match(/\.home-shelf-card\.is-featured \.home-shelf-body strong,\n\.home-shelf-card\.is-featured \.home-shelf-body small\s*\{[\s\S]*?\}/)?.[0] || "";
assert.match(appScript, /themeStorageKey = "pingfang_theme"/);
assert.match(appScript, /validThemes = \{[\s\S]*"blue-pink-purple": true/);
assert.match(appScript, /"poster-magazine": true/);
assert.match(appScript, /theme-transitioning/);
assert.match(appScript, /document\.documentElement\.setAttribute\("data-theme", theme\)/);
assert.match(appScript, /document\.documentElement\.removeAttribute\("data-theme"\)/);
assert.match(appScript, /window\.localStorage\.setItem\(themeStorageKey, theme\)/);
assert.match(appScript, /window\.localStorage\.removeItem\(themeStorageKey\)/);
assert.match(appScript, /initThemeSwitchers\(document\)/);
assert.match(style, /\.theme-switcher/);
assert.match(style, /\.theme-switcher-menu/);
assert.match(style, /\.theme-switcher-menu\[hidden\]\s*\{[\s\S]*display: none/);
assert.match(style, /\.theme-option/);
assert.match(style, /\.theme-option-swatch/);
assert.match(style, /\.theme-option-swatch-poster/);
assert.match(style, /\.theme-option\.is-active/);
assert.match(style, /html\[data-theme="poster-magazine"\]/);
assert.match(posterRootRule, /--wrap: min\(1840px, calc\(100vw - 88px\)\)/);
assert.match(posterHeroGridRule, /grid-template-columns: minmax\(0, 1fr\) minmax\(300px, 340px\)/);
assert.match(posterHeroCarouselRule, /min-height: clamp\(480px, 56vh, 610px\)/);
assert.doesNotMatch(posterHeroRankRule, /position: absolute/);
assert.match(posterHeroRankRule, /background: rgba\(9, 12, 31, 0\.72\)/);
assert.doesNotMatch(posterHeroRankBeforeRule, /background: linear-gradient\(90deg/);
assert.match(posterShelfRailRule, /grid-auto-flow: row/);
assert.match(posterShelfRailRule, /grid-auto-columns: auto/);
assert.match(posterShelfCardRule, /grid-template-rows: clamp\(178px, 14vw, 230px\) minmax\(54px, auto\) minmax\(0, 1fr\) auto/);
assert.match(posterShelfCardRule, /min-height: 360px/);
assert.doesNotMatch(posterShelfFirstCardRule, /grid-row: span 2/);
assert.match(style, /@media \(max-width: 1020px\)[\s\S]*html\[data-theme="poster-magazine"\]\s+\.hero-grid\s*\{[\s\S]*grid-template-columns: 1fr/);
assert.match(style, /html\.theme-transitioning::before/);
assert.match(style, /@media \(prefers-reduced-motion: reduce\)[\s\S]*theme-transitioning/);
assert.match(rootRule, /--line-soft: rgba\(255, 255, 255, 0\.08\)/);
assert.match(rootRule, /--line-strong: rgba\(255, 255, 255, 0\.22\)/);
assert.match(rootRule, /--line-accent: rgba\(38, 212, 175, 0\.34\)/);
assert.match(rootRule, /--line-accent-strong: rgba\(38, 212, 175, 0\.5\)/);
assert.match(rootRule, /--line-warm: rgba\(255, 90, 61, 0\.42\)/);
assert.match(rootRule, /--selected-bg: rgba\(38, 212, 175, 0\.12\)/);
assert.match(rootRule, /--selected-compact-shadow: inset 0 0 0 1px rgba\(38, 212, 175, 0\.16\)/);
assert.match(rootRule, /--selected-shadow: 0 0 0 1px rgba\(38, 212, 175, 0\.2\), 0 10px 24px rgba\(38, 212, 175, 0\.08\)/);
assert.match(rootRule, /--focus-field-shadow: 0 0 0 1px rgba\(38, 212, 175, 0\.2\)/);
assert.match(navigationBorderRule, /border: 1px solid transparent/);
assert.match(navigationBorderRule, /transition: border-color 0\.18s ease, background 0\.18s ease, color 0\.18s ease, box-shadow 0\.18s ease, transform 0\.18s ease/);
assert.match(interactiveHoverRule, /border-color: var\(--line-strong\)/);
assert.match(selectedBorderRule, /\.filter-panel a\.is-active/);
assert.match(selectedBorderRule, /\.episode-grid a\.is-active/);
assert.match(selectedBorderRule, /\.favorite-btn\.is-favorited/);
assert.match(selectedBorderRule, /\.page-state/);
assert.match(selectedBorderRule, /border-color: var\(--line-accent-strong\)/);
assert.match(selectedBorderRule, /background: var\(--selected-bg\)/);
assert.match(selectedBorderRule, /box-shadow: var\(--selected-compact-shadow\)/);
assert.match(focusBorderRule, /border-color: var\(--line-accent-strong\)/);
assert.match(fieldFocusRule, /box-shadow: var\(--focus-field-shadow\)/);
assert.doesNotMatch(fieldFocusRule, /var\(--focus-ring\)/);
assert.match(style, /@media \(max-width: 760px\)/);
assert.match(style, /@media \(max-width: 1020px\)[\s\S]*\.header-inner\s*\{[\s\S]*grid-template-columns: auto auto minmax\(0, 1fr\) auto/);
assert.doesNotMatch(style, /@media \(max-width: 1020px\)[\s\S]*\.header-inner\s*\{[\s\S]*grid-template-columns: auto auto 1fr/);
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
assert.match(style, /\.hero \.wrap\s*\{[\s\S]*width: var\(--wrap\)/);
assert.doesNotMatch(style, /width: min\(1500px, calc\(100vw - 48px\)\)/);
assert.doesNotMatch(style, /\.quick-types/);
assert.match(heroGridRule, /grid-template-columns: minmax\(0, 1fr\) minmax\(300px, 360px\)/);
assert.match(heroGridRule, /align-items: stretch/);
assert.match(heroGridRule, /perspective: 1200px/);
assert.match(heroCarouselRule, /min-height: 0/);
assert.match(heroCarouselRule, /display: grid/);
assert.match(heroCarouselRule, /background: linear-gradient\(145deg, rgba\(24, 27, 34, 0\.88\), rgba\(8, 10, 14, 0\.94\)\)/);
assert.match(heroCarouselRule, /transform-style: preserve-3d/);
assert.match(heroCarouselRule, /box-shadow: 0 34px 110px rgba\(0, 0, 0, 0\.48\), 0 0 48px rgba\(38, 212, 175, 0\.14\), inset 0 1px 0 rgba\(255, 255, 255, 0\.08\)/);
assert.match(heroCarouselAfterRule, /pointer-events: none/);
assert.match(heroCarouselAfterRule, /linear-gradient\(90deg, transparent, rgba\(255, 255, 255, 0\.18\), transparent\)/);
assert.match(heroCarouselAfterRule, /mix-blend-mode: screen/);
assert.doesNotMatch(style, /hero-gradient-strips/);
assert.doesNotMatch(style, /hero-gradient-strip/);
assert.doesNotMatch(style, /gradient-strip-drift/);
assert.doesNotMatch(appScript, /initHeroGradientStrips/);
assert.doesNotMatch(appScript, /data-gradient-strips/);
assert.match(bannerTrackRule, /position: relative/);
assert.match(bannerTrackRule, /display: grid/);
assert.match(bannerTrackRule, /grid-area: 1 \/ 1/);
assert.match(bannerTrackRule, /min-height: 100%/);
assert.match(heroRankRule, /position: relative/);
assert.match(heroRankRule, /display: grid/);
assert.match(heroRankRule, /grid-auto-rows: max-content/);
assert.match(heroRankRule, /min-height: 0/);
assert.match(heroRankRule, /gap: 8px/);
assert.match(heroRankRule, /padding: 20px 18px/);
assert.match(heroRankRule, /border-color: var\(--line-accent-soft\)/);
assert.match(heroRankRule, /background: linear-gradient\(155deg, rgba\(25, 27, 31, 0\.9\), rgba\(13, 24, 25, 0\.94\)\)/);
assert.doesNotMatch(heroRankRule, /translateZ/);
assert.match(heroRankRule, /box-shadow: 0 30px 90px rgba\(0, 0, 0, 0\.38\), 0 0 42px rgba\(38, 212, 175, 0\.13\), inset 0 1px 0 rgba\(255, 255, 255, 0\.06\)/);
assert.match(heroRankBeforeRule, /background: linear-gradient\(180deg, rgba\(38, 212, 175, 0\.18\), transparent\)/);
assert.match(heroRankHeadRule, /position: relative/);
assert.match(heroRankHeadRule, /padding-bottom: 10px/);
assert.match(rankRefreshRule, /color: rgba\(244, 240, 232, 0\.62\)/);
assert.match(rankItemRule, /grid-template-columns: 72px minmax\(0, 1fr\) auto/);
assert.match(rankItemRule, /align-items: center/);
assert.match(rankItemRule, /min-height: 0/);
assert.match(rankItemRule, /border-bottom: 1px solid var\(--line-hairline\)/);
assert.match(rankItemRule, /padding: 9px 0/);
assert.match(rankFirstItemRule, /padding-top: 4px/);
assert.match(rankFirstIndexRule, /background: linear-gradient\(135deg, var\(--accent\), var\(--gold\)\)/);
assert.match(rankIndexRule, /position: absolute/);
assert.match(rankIndexRule, /width: 22px/);
assert.match(rankThumbRule, /position: relative/);
assert.match(rankThumbRule, /aspect-ratio: 4 \/ 3/);
assert.match(rankThumbRule, /overflow: hidden/);
assert.match(rankThumbImgRule, /object-fit: cover/);
assert.match(rankBodyRule, /display: grid/);
assert.match(rankBodyRule, /min-width: 0/);
assert.match(rankMetaRule, /color: rgba\(244, 240, 232, 0\.48\)/);
assert.match(rankScoreRule, /color: var\(--accent-2\)/);
assert.match(style, /\.home-shelf/);
assert.match(homeShelfRule, /padding: 34px 0 18px/);
assert.match(homeShelfHeadRule, /grid-template-columns: auto minmax\(0, 1fr\) auto/);
assert.match(homeShelfHeadRule, /align-items: center/);
assert.match(homeShelfTabsRule, /display: flex/);
assert.match(homeShelfTabsRule, /justify-content: center/);
assert.match(homeShelfTabsRule, /overflow-x: auto/);
assert.match(homeShelfTabsActiveRule, /border-color: var\(--accent-2\)/);
assert.match(homeShelfTabsActiveRule, /color: var\(--text\)/);
assert.match(style, /\.home-shelf-tabs button\s*\{[\s\S]*appearance: none/);
assert.match(style, /\.home-shelf-tabs button\s*\{[\s\S]*font-family: inherit/);
assert.match(homeShelfRailRule, /grid-template-columns: repeat\(6, minmax\(0, 1fr\)\)/);
assert.match(homeShelfRailRule, /grid-auto-flow: column/);
assert.match(homeShelfRailRule, /overflow-x: auto/);
assert.match(homeShelfRailRule, /scroll-snap-type: x proximity/);
assert.match(homeShelfRailRule, /perspective: 900px/);
assert.match(hiddenHomeShelfRailRule, /display: none/);
assert.match(homeShelfCardRule, /display: grid/);
assert.match(homeShelfCardRule, /grid-template-columns: minmax\(0, 1fr\) auto/);
assert.match(homeShelfCardRule, /grid-template-rows: 260px minmax\(64px, auto\) minmax\(0, 1fr\) auto/);
assert.match(homeShelfCardRule, /row-gap: 10px/);
assert.match(homeShelfCardRule, /padding: 10px/);
assert.match(homeShelfCardRule, /min-height: 420px/);
assert.match(homeShelfCardRule, /border: 1px solid var\(--line-soft\)/);
assert.match(homeShelfCardRule, /background: linear-gradient/);
assert.match(homeShelfCardRule, /box-shadow: 0 18px 44px rgba\(0, 0, 0, 0\.22\), inset 0 1px 0 rgba\(255, 255, 255, 0\.055\)/);
assert.match(homeShelfCardRule, /transform: translateZ\(0\)/);
assert.match(homeShelfCardRule, /transform-style: preserve-3d/);
assert.match(homeShelfCardBeforeRule, /pointer-events: none/);
assert.match(homeShelfCardBeforeRule, /linear-gradient\(135deg, rgba\(255, 255, 255, 0\.14\), transparent 42%\)/);
assert.match(style, /\.home-shelf-card:hover\s*\{[\s\S]*border-color: var\(--line-accent\)/);
assert.match(homeShelfCardHoverRule, /transform: translateY\(-4px\) translateZ\(16px\)/);
assert.match(homeShelfCardHoverRule, /box-shadow: 0 28px 72px rgba\(0, 0, 0, 0\.32\), 0 0 26px rgba\(38, 212, 175, 0\.12\)/);
assert.match(homeShelfPosterRule, /height: 100%/);
assert.doesNotMatch(homeShelfPosterRule, /aspect-ratio/);
assert.match(homeShelfPosterRule, /border: 1px solid var\(--line-soft\)/);
assert.match(homeShelfPosterImgRule, /object-fit: cover/);
assert.match(homeShelfPosterImgRule, /transform: scale\(1\.012\)/);
assert.match(homeShelfPosterHoverRule, /box-shadow: 0 18px 40px rgba\(0, 0, 0, 0\.3\)/);
assert.match(homeShelfPosterImgHoverRule, /transform: scale\(1\.035\)/);
assert.match(homeShelfBadgeRule, /white-space: normal/);
assert.match(homeShelfBadgeRule, /overflow-wrap: anywhere/);
assert.match(homeShelfBodyRule, /display: contents/);
assert.match(homeShelfTitleRule, /overflow-wrap: anywhere/);
assert.match(homeShelfTitleRule, /display: block/);
assert.match(homeShelfTitleRule, /grid-column: 1 \/ -1/);
assert.match(homeShelfTitleRule, /grid-row: 2/);
assert.match(homeShelfTitleRule, /align-self: start/);
assert.match(homeShelfTitleRule, /overflow: visible/);
assert.doesNotMatch(homeShelfTitleRule, /-webkit-line-clamp/);
assert.match(homeShelfMetaRule, /display: block/);
assert.match(homeShelfMetaRule, /grid-column: 1/);
assert.match(homeShelfMetaRule, /grid-row: 4/);
assert.match(homeShelfMetaRule, /overflow: visible/);
assert.doesNotMatch(homeShelfMetaRule, /-webkit-line-clamp/);
assert.doesNotMatch(style, /-webkit-line-clamp:\s*[1-9]/);
assert.match(homeShelfScoreRule, /grid-column: 2/);
assert.match(homeShelfScoreRule, /grid-row: 4/);
assert.match(homeShelfScoreRule, /height: 20px/);
assert.match(homeShelfScoreRule, /font-size: 11px/);
assert.match(homeShelfScoreRule, /line-height: 1/);
assert.match(homeShelfScoreRule, /padding: 0 7px/);
assert.match(homeShelfScoreRule, /color: var\(--accent-2\)/);
assert.match(homeShelfScoreRule, /border: 1px solid var\(--line-accent-soft\)/);
assert.match(homeShelfScoreRule, /background: rgba\(38, 212, 175, 0\.1\)/);
assert.doesNotMatch(homeShelfPosterRule, /transform 0\.2s ease/);
assert.doesNotMatch(homeShelfPosterHoverRule, /transform: translateY\(-2px\)/);
assert.doesNotMatch(homeShelfPosterImgHoverRule, /transform: scale\(1\.04\)/);
assert.match(homeShelfFeaturedBodyRule, /display: grid/);
assert.match(homeShelfFeaturedTextRule, /grid-column: auto/);
assert.match(homeShelfFeaturedTextRule, /grid-row: auto/);
assert.match(style, /\.banner-track/);
assert.match(style, /\.hero-slide\.is-active/);
assert.match(style, /\.hero-carousel\[data-gsap-carousel="true"\] \.hero-slide\s*\{[\s\S]*transition: none/);
assert.match(heroSlideRule, /grid-template-columns: minmax\(0, 680px\)/);
assert.match(heroSlideRule, /grid-template-areas: "content"/);
assert.match(heroSlideRule, /position: absolute/);
assert.match(heroSlideRule, /min-height: clamp\(420px, 34vw, 520px\)/);
assert.match(heroSlideRule, /padding: clamp\(34px, 4vw, 58px\) clamp\(28px, 4vw, 52px\) 74px/);
assert.match(activeHeroSlideRule, /position: relative/);
assert.match(heroCarouselRule, /--banner-shine-x: 50%/);
assert.match(heroCarouselRule, /--banner-shine-y: 44%/);
assert.match(heroCarouselRule, /--banner-shine-rotate: 0deg/);
assert.match(heroCarouselRule, /--banner-shine-opacity: 0/);
assert.match(bannerBgBeforeRule, /pointer-events: none/);
assert.match(bannerBgBeforeRule, /mix-blend-mode: screen/);
assert.match(bannerBgBeforeRule, /var\(--banner-shine-x\) var\(--banner-shine-y\)/);
assert.match(bannerBgBeforeRule, /opacity: var\(--banner-shine-opacity\)/);
assert.match(bannerBgAfterRule, /rgba\(7, 9, 13, 0\.76\) 100%/);
assert.match(bannerContentRule, /grid-area: content/);
assert.match(bannerContentRule, /align-content: center/);
assert.doesNotMatch(style, /\.banner-art/);
assert.doesNotMatch(style, /\.banner-poster/);
assert.match(bannerCopyRule, /max-width: 640px/);
assert.match(bannerCopyRule, /min-width: 0/);
assert.match(bannerTitleRule, /overflow: visible/);
assert.match(bannerTitleRule, /line-height: 1\.08/);
assert.match(bannerTitleRule, /overflow-wrap: anywhere/);
assert.match(bannerExcerptRule, /white-space: normal/);
assert.match(bannerExcerptRule, /overflow-wrap: anywhere/);
assert.doesNotMatch(bannerExcerptRule, /-webkit-line-clamp/);
assert.doesNotMatch(bannerExcerptRule, /display: -webkit-box/);
assert.doesNotMatch(bannerExcerptRule, /overflow: hidden/);
assert.match(pageHeadingRule, /overflow-wrap: anywhere/);
assert.equal(heroCarouselStatsRule, "");
assert.match(bannerControlsRule, /position: absolute/);
assert.match(bannerControlsRule, /left: 50%/);
assert.match(bannerControlsRule, /bottom: 22px/);
assert.match(bannerControlsRule, /border-radius: 999px/);
assert.match(bannerControlsRule, /min-height: 20px/);
assert.match(bannerControlsRule, /background: transparent/);
assert.match(bannerControlsRule, /padding: 0 10px/);
assert.match(bannerControlsBeforeRule, /inset: 0/);
assert.match(bannerControlsBeforeRule, /backdrop-filter: blur\(12px\)/);
assert.match(style, /\[data-gsap-reveal-ready="true"\]/);
assert.match(style, /\[data-gsap-revealed="true"\]/);
assert.match(style, /@media \(prefers-reduced-motion: reduce\)/);
assert.match(style, /\[data-gsap-carousel="true"\] \.hero-slide/);
assert.match(style, /\.banner-dot/);
assert.match(bannerDotRule, /min-width: 44px/);
assert.match(bannerDotRule, /min-height: 20px/);
assert.match(bannerDotRule, /width: 44px/);
assert.match(bannerDotRule, /height: 20px/);
assert.match(bannerDotRule, /max-height: 20px/);
assert.match(bannerDotAfterRule, /width: 28px/);
assert.match(bannerDotAfterRule, /height: 5px/);
assert.match(bannerDotActiveAfterRule, /width: 36px/);
assert.match(bannerDotActiveRule, /background: transparent/);
assert.doesNotMatch(style, /#d83cff|#2d74ff|#ff38d0|#8a5cff|#ff4edb/);
assert.doesNotMatch(style, /214, 72, 255|43, 19, 76|11, 18, 45|58, 93, 255|128, 155, 255|62, 91, 255/);
for (const chipRule of [
  hotSearchTermRule,
  posterRemarkRule,
  vodCardMetaChipRule,
  categoryChildLinkRule,
  homeShelfBadgeRule,
]) {
  assert.match(chipRule, /white-space: normal/);
  assert.match(chipRule, /overflow-wrap: anywhere/);
  assert.doesNotMatch(chipRule, /text-overflow: ellipsis/);
  assert.doesNotMatch(chipRule, /overflow: hidden/);
}
for (const titleRule of [
  rankListTitleRule,
  categoryMainTitleRule,
  timelineTitleRule,
  episodeLinkRule,
  playerToolbarTextRule,
  downloadTitleRule,
  recordTitleRule,
]) {
  assert.match(titleRule, /white-space: normal/);
  assert.match(titleRule, /overflow-wrap: anywhere/);
  assert.doesNotMatch(titleRule, /overflow: hidden/);
}
assert.match(systemBoxTitleRule, /overflow-wrap: anywhere/);
assert.match(contentBodyWrapRule, /white-space: normal/);
assert.match(contentBodyWrapRule, /overflow-wrap: anywhere/);
assert.match(style, /\.score-badge/);
assert.match(style, /\.card-meta/);
assert.match(style, /--surface-elevated/);
assert.match(style, /--shadow-soft/);
assert.match(style, /\.page-title::after/);
assert.match(style, /\.page-title h1[\s\S]*text-wrap: balance/);
assert.match(style, /\.category-filter[\s\S]*background: linear-gradient/);
assert.match(style, /\.filter-row \+ \.filter-row[\s\S]*border-top/);
assert.match(style, /\.filter-options[\s\S]*-webkit-overflow-scrolling: touch/);
assert.match(style, /\.detail-panel/);
assert.match(style, /\.detail-panel[\s\S]*min-width: 0/);
assert.match(style, /\.detail-actions[\s\S]*flex-wrap: wrap/);
assert.match(style, /\.detail-hero,\n\.player-page\s*\{[\s\S]*radial-gradient/);
assert.match(style, /\.detail-poster[\s\S]*box-shadow/);
assert.match(style, /\.player-toolbar/);
assert.match(style, /\.player-toolbar-actions/);
assert.match(style, /\.player-shell #MacPlayer/);
assert.match(style, /\.player-shell embed/);
assert.match(style, /\.player-shell object/);
assert.match(playerShellRule, /min-height: clamp\(220px, 52vw, 500px\)/);
assert.match(playerMediaRule, /min-height: clamp\(220px, 52vw, 500px\)/);
assert.match(playerMacRule, /height: clamp\(220px, 52vw, 500px\)/);
assert.match(playerMacChildrenRule, /min-height: clamp\(220px, 52vw, 500px\)/);
assert.doesNotMatch(playerShellRule, /min-height: 500px/);
assert.doesNotMatch(playerMacChildrenRule, /min-height: 500px/);
assert.match(style, /\.pf-player\s*\{/);
assert.match(style, /\.pf-player-controls\s*\{/);
assert.match(style, /\.pf-player-progress\s*\{/);
assert.match(style, /@media \(max-width: 760px\)[\s\S]*\.pf-player-controls/);
assert.match(style, /\.download-list/);
assert.match(style, /\.download-list a[\s\S]*transition: border-color/);
assert.match(style, /\.copyright-box/);
assert.match(style, /\.comment-list/);
assert.match(style, /\.comment-layout \.system-box[\s\S]*position: sticky/);
assert.match(style, /\.plot-list/);
assert.match(style, /\.module-fallback/);
assert.match(style, /\.system-box[\s\S]*background: linear-gradient/);
assert.match(style, /\.verify-code img[\s\S]*max-width: 100%/);
assert.match(style, /\.primary-btn:hover,\n\.ghost-btn:hover/);
assert.match(style, /\.episode-grid a:focus-visible/);
assert.match(episodeLinkRule, /border: 1px solid var\(--line-soft\)/);
assert.match(episodeLinkRule, /transition: border-color 0\.18s ease, background 0\.18s ease, color 0\.18s ease, box-shadow 0\.18s ease, transform 0\.18s ease/);
assert.match(episodeActiveRule, /border-color: var\(--line-accent-strong\)/);
assert.match(episodeActiveRule, /box-shadow: var\(--selected-shadow\)/);
assert.match(style, /\.list-item:hover/);
assert.match(style, /\.poster::after/);
assert.match(style, /\.vod-card[\s\S]*background: var\(--surface\)/);
assert.match(style, /\.vod-card[\s\S]*box-shadow/);
assert.match(style, /\.vod-card[\s\S]*display: flex/);
assert.match(vodCardRule, /min-height: 0/);
assert.match(vodCardRule, /transition: border-color 0\.2s ease, background 0\.2s ease, box-shadow 0\.2s ease, color 0\.2s ease/);
assert.doesNotMatch(vodCardRule, /transform 0\.2s ease/);
assert.doesNotMatch(appScript, /revealSelectors = \[[\s\S]*"\.vod-card"/);
assert.doesNotMatch(appScript, /cards = scopedElements\(scope, "\.vod-card, \.home-shelf-card"\)/);
assert.doesNotMatch(appScript, /bindGsapHover\(scope, "\.vod-card"/);
assert.match(appScript, /var cards = scopedElements\(scope, "\.home-shelf-card"\)/);
assert.doesNotMatch(style, /\.vod-card small/);
assert.match(vodCardTitleRule, /overflow: visible/);
assert.match(vodCardTitleRule, /overflow-wrap: anywhere/);
assert.doesNotMatch(vodCardTitleRule, /-webkit-line-clamp/);
assert.match(vodCardMetaRule, /margin: 12px 2px 0/);
assert.match(vodCardMetaRule, /flex-wrap: wrap/);
assert.match(vodCardMetaChipRule, /white-space: normal/);
assert.match(vodCardMetaChipRule, /overflow-wrap: anywhere/);
assert.doesNotMatch(vodCardMetaChipRule, /text-overflow: ellipsis/);
assert.match(style, /\.poster[\s\S]*isolation: isolate/);
assert.match(style, /\.brand-logo/);
assert.match(style, /object-fit: contain/);
assert.match(style, /\.brand-logo[\s\S]*filter: drop-shadow/);
assert.match(style, /\.site-header \.brand img[\s\S]*width: 58px/);
assert.match(style, /\.site-header \.brand img[\s\S]*height: 58px/);
assert.match(style, /\.site-header \.brand img[\s\S]*max-width: 58px/);
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
assert.match(style, /\.device-card:hover/);
assert.match(style, /\.device-current/);
assert.match(style, /\.device-meta/);
assert.match(style, /\.device-status/);
assert.match(style, /\.user-menu::after[\s\S]*height: 12px/);
assert.match(userDropdownRule, /z-index: 1001/);
assert.match(style, /\.user-menu:hover \.user-dropdown/);
assert.match(style, /\.record-poster/);
assert.match(style, /\.record-poster-img/);
assert.match(style, /\.record-poster[\s\S]*aspect-ratio: 2 \/ 3/);
assert.match(style, /\.record-item:hover/);
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
assert.match(style, /@media \(max-width: 760px\)[\s\S]*\.site-header \.brand img\s*\{[\s\S]*width: 56px/);
assert.match(style, /@media \(max-width: 760px\)[\s\S]*\.hero-rank\s*\{[\s\S]*margin-top: 4px/);
assert.match(style, /@media \(max-width: 760px\)[\s\S]*\.hero-rank \.rank-item:first-of-type\s*\{[\s\S]*padding-top: 4px/);
assert.match(style, /@media \(max-width: 760px\)[\s\S]*\.hero-rank \.rank-item:first-of-type \.rank-index\s*\{[\s\S]*width: 22px/);
assert.match(style, /@media \(max-width: 760px\)[\s\S]*\.rank-item\s*\{[\s\S]*grid-template-columns: 62px minmax\(0, 1fr\) auto/);
assert.match(style, /@media \(max-width: 760px\)[\s\S]*\.rank-index\s*\{[\s\S]*width: 20px/);
assert.match(style, /@media \(max-width: 760px\)[\s\S]*\.header-search\s*\{[\s\S]*display: grid/);
assert.match(style, /@media \(max-width: 760px\)[\s\S]*\.player-shell\s*\{[\s\S]*aspect-ratio: 16 \/ 9/);
assert.match(style, /@media \(max-width: 1020px\)[\s\S]*\.home-shelf-rail\s*\{[\s\S]*grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/);
assert.match(style, /@media \(max-width: 1020px\)[\s\S]*\.home-shelf-rail\s*\{[\s\S]*grid-auto-flow: row/);
assert.match(style, /@media \(max-width: 1020px\)[\s\S]*\.home-shelf-rail\s*\{[\s\S]*overflow: visible/);
assert.doesNotMatch(style, /@media \(max-width: 1020px\)[\s\S]*\.home-shelf-rail\s*\{[\s\S]*grid-template-columns: none/);
assert.match(style, /@media \(max-width: 760px\)[\s\S]*\.system-page\s*\{[\s\S]*min-height: auto/);
assert.match(style, /@media \(max-width: 760px\)[\s\S]*\.system-box\s*\{[\s\S]*padding: 20px/);
assert.match(style, /@media \(max-width: 760px\)[\s\S]*\.device-card\s*\{[\s\S]*grid-template-columns: 1fr/);
assert.match(style, /@media \(max-width: 760px\)[\s\S]*\.comment-layout \.system-box\s*\{[\s\S]*position: static/);
assert.match(style, /@media \(max-width: 760px\)[\s\S]*\.detail-actions \.primary-btn,\n  \.detail-actions \.ghost-btn\s*\{[\s\S]*flex: 1 1 132px/);
assert.match(style, /@media \(orientation: landscape\) and \(max-height: 520px\)/);
assert.match(style, /\.mobile-category-entry\s*\{[\s\S]*display: none/);
assert.match(style, /\.mobile-shortcuts\s*\{[\s\S]*display: none/);
assert.match(style, /\.mobile-game-entry/);
assert.match(style, /\.mobile-drawer\s*\{[\s\S]*transform: translateX\(100%\)/);
assert.match(style, /\.mobile-drawer\.is-open\s*\{[\s\S]*transform: translateX\(0\)/);
assert.match(style, /\.mobile-drawer-backdrop\.is-visible\s*\{[\s\S]*opacity: 1/);
assert.match(style, /body\.mobile-nav-open\s*\{[\s\S]*overflow: hidden/);
assert.match(style, /\.mobile-drawer-user\s*\{[\s\S]*display: grid/);
assert.match(style, /\.mobile-drawer-user\s*\{[\s\S]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
assert.match(style, /\.mobile-drawer-login\s*\{[\s\S]*border-color: var\(--line-accent-strong\)/);
assert.match(style, /\.mobile-drawer-login\s*\{[\s\S]*grid-column: 1 \/ -1/);
assert.doesNotMatch(style, /\.nav-video-menu/);
assert.doesNotMatch(style, /\.nav-video-panel/);
assert.match(style, /\.mobile-drawer-links\s*\{[\s\S]*grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/);
assert.match(style, /\.mobile-drawer-links a\s*\{[\s\S]*justify-content: center/);
assert.match(style, /\.mobile-drawer-cats a\s*\{[\s\S]*font-size: 15px/);
assert.match(style, /\.mobile-drawer-links a,\n\.mobile-drawer-user a,\n\.mobile-drawer-cats a/);
assert.match(style, /\.mobile-drawer-cats\s*\{[\s\S]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
assert.match(style, /@media \(max-width: 760px\)[\s\S]*\.mobile-shortcuts\s*\{[\s\S]*display: none/);
assert.match(style, /@media \(max-width: 760px\)[\s\S]*\.site-nav\s*\{[\s\S]*display: none/);
assert.match(style, /@media \(max-width: 760px\)[\s\S]*\.user-menu\s*\{[\s\S]*display: none/);
assert.match(style, /@media \(max-width: 520px\)[\s\S]*\.nav-toggle\s*\{[\s\S]*display: block/);
assert.match(style, /@media \(max-width: 520px\)[\s\S]*\.site-header \.brand img\s*\{[\s\S]*width: 48px/);
assert.doesNotMatch(style, /\.hero-carousel \.hero-stats/);
assert.doesNotMatch(style, /@media \(max-width: 760px\)[\s\S]*\.banner-copy small\s*\{[\s\S]*-webkit-line-clamp/);
assert.match(style, /@media \(max-width: 760px\)[\s\S]*\.banner-copy strong\s*\{[\s\S]*-webkit-line-clamp: unset/);
assert.doesNotMatch(style, /@media \(max-width: 760px\)[\s\S]*\.hero-carousel \.hero-stats/);
assert.match(style, /@media \(max-width: 760px\)[\s\S]*\.banner-controls\s*\{[\s\S]*min-height: 0/);
assert.match(style, /@media \(max-width: 760px\)[\s\S]*\.banner-controls\s*\{[\s\S]*left: 50%/);
assert.match(style, /@media \(max-width: 760px\)[\s\S]*\.banner-controls\s*\{[\s\S]*bottom: 12px/);
assert.match(style, /@media \(max-width: 760px\)[\s\S]*\.banner-controls\s*\{[\s\S]*transform: translateX\(-50%\)/);
assert.match(style, /@media \(max-width: 520px\)[\s\S]*\.hero-carousel\s*\{[\s\S]*min-height: 0/);
assert.match(style, /@media \(max-width: 520px\)[\s\S]*\.hero-slide\s*\{[\s\S]*padding: 18px 14px 70px/);
assert.match(style, /@media \(max-width: 520px\)[\s\S]*\.banner-content\s*\{[\s\S]*min-height: 300px/);
assert.doesNotMatch(style, /@media \(max-width: 520px\)[\s\S]*\.hero-carousel \.hero-stats/);
assert.match(style, /@media \(max-width: 520px\)[\s\S]*\.banner-controls\s*\{[\s\S]*bottom: 12px/);
assert.doesNotMatch(style, /@media \(max-width: 520px\)[\s\S]*\.list-item small\s*\{[\s\S]*-webkit-line-clamp/);
assert.match(style, /@media \(max-width: 520px\)[\s\S]*\.card-meta\s*\{[\s\S]*flex-wrap: wrap/);
assert.match(style, /@media \(max-width: 520px\)[\s\S]*\.card-meta span\s*\{[\s\S]*min-width: 0/);
assert.match(style, /@media \(max-width: 760px\)[\s\S]*\.home-shelf-rail\s*\{[\s\S]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
assert.match(style, /@media \(max-width: 520px\)[\s\S]*\.home-shelf-rail\s*\{[\s\S]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
assert.doesNotMatch(style, /@media \(max-width: 760px\)[\s\S]*\.home-shelf-rail\s*\{[\s\S]*grid-auto-columns: minmax\(220px, 78vw\)/);
assert.doesNotMatch(style, /@media \(max-width: 520px\)[\s\S]*\.home-shelf-rail\s*\{[\s\S]*grid-auto-columns: minmax\(210px, 82vw\)/);
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
assert.match(style, /@media \(max-width: 760px\)[\s\S]*\.content-section\s*\{[\s\S]*padding: 22px 0/);
assert.match(style, /@media \(max-width: 760px\)[\s\S]*\.hero-carousel\s*\{[\s\S]*min-height: 0/);
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
assert.doesNotMatch(style, /border(?:-color)?: [^;]*rgba\(40, 199, 167/);

const logo = readFileSync(path.join(themeRoot, "images/site-logo.png"));
assert.equal(logo.subarray(1, 4).toString("ascii"), "PNG");
assert.deepEqual([logo.readUInt32BE(16), logo.readUInt32BE(20)], [1024, 1024]);
const logoMode = statSync(path.join(themeRoot, "images/site-logo.png")).mode & 0o777;
assert.equal(logoMode & 0o044, 0o044, "site logo must be readable by the web server after deployment");

const packageScript = readFileSync(path.join(root, "scripts/package-theme.mjs"), "utf8");
assert.match(packageScript, /pingfangvideo/);
assert.match(packageScript, /pingfangdevice/);
assert.match(packageScript, /dist/);
assert.match(packageScript, /addonArchive/);
assert.match(packageScript, /startsWith\("\."\)/);
assert.match(packageScript, /createHash/);
assert.match(packageScript, /assetVersionPlaceholder/);
assert.match(packageScript, /"js\/rank-react\.js"/);
assert.match(packageScript, /"player\/prompt\.css"/);
assert.match(packageScript, /replaceAssetVersionPlaceholders/);
assert.match(packageScript, /normalizePackagePermissions/);
assert.match(packageScript, /chmodSync\(filePath, 0o644\)/);
assert.match(packageScript, /chmodSync\(filePath, 0o755\)/);
assert.match(packageScript, /COPYFILE_DISABLE/);
assert.match(packageScript, /--no-xattrs/);

const packageJson = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
assert.equal(packageJson.scripts["lint:template"], "node scripts/lint-template.mjs");
assert.equal(packageJson.scripts["verify:compat"], "node scripts/verify-compat.mjs");
assert.equal(packageJson.scripts["verify:preview"], "node scripts/verify-preview.mjs");
assert.equal(packageJson.scripts["verify:release"], "node scripts/verify-release.mjs");
assert.equal(packageJson.scripts.deploy, "bash scripts/deploy-theme.sh");
assert.equal(packageJson.scripts.rollback, "bash scripts/rollback-theme.sh");

const ping2DeployEnv = readFileSync(path.join(root, "scripts/deploy-ping2.env"), "utf8");
assert.match(ping2DeployEnv, /export DEPLOY_HOST=ping2\.my/);
assert.match(ping2DeployEnv, /export DEPLOY_USER=root/);
assert.match(ping2DeployEnv, /export DEPLOY_PATH=\/www\/wwwroot\/squaredMedia\/template/);
assert.match(ping2DeployEnv, /export DEPLOY_PORT=22/);
assert.doesNotMatch(ping2DeployEnv, /DEPLOY_PASSWORD/);

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
assert.match(deployScript, /php -l "\$php_file"/);
assert.match(deployScript, /Addon app_begin hook verification failed/);
assert.match(deployScript, /COLUMN_NAME = \?/);
assert.match(deployScript, /Device session schema verification failed/);
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
assert.match(deviceAddonConfig, /session_lifetime_days/);

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
assert.match(deviceBridgeController, /DeviceSession::maxDeviceCount/);
assert.match(deviceBridgeController, /\$param \+= \['verify' => '', 'openid' => '', 'col' => ''\]/);
assert.match(deviceBridgeController, /isPost\(\) \|\| !Request\(\)->isAjax\(\)/);
assert.match(deviceBridgeController, /VodFilterOptions::filters\(input\(\)\)/);
assert.match(deviceBridgeController, /public function filters\(\)/);

const deviceAddonController = readAddonFile("controller/Index.php");
assert.match(deviceAddonController, /model\('User'\)->login\(\$param, \['return_meta' => true\]\)/);
assert.match(deviceAddonController, /DeviceSession::registerLogin/);
assert.match(deviceAddonController, /DeviceSession::listSessions/);
assert.match(deviceAddonController, /DeviceSession::revokeSession/);
assert.match(deviceAddonController, /DeviceSession::logoutCurrentDevice/);
assert.match(deviceAddonController, /DeviceSession::maxDeviceCount/);
assert.match(deviceAddonController, /\$param \+= \['verify' => '', 'openid' => '', 'col' => ''\]/);
assert.match(deviceAddonController, /addon_url\('pingfangdevice\/index\/index'\)/);
assert.match(deviceAddonController, /VodFilterOptions::filters\(input\(\)\)/);
assert.match(deviceAddonController, /public function filters\(\)/);

const deviceSessionService = readAddonFile("service/DeviceSession.php");
assert.match(deviceSessionService, /const DEFAULT_MAX_DEVICES = 3/);
assert.match(deviceSessionService, /const TOKEN_COOKIE = 'pfv_device_token'/);
assert.match(deviceSessionService, /const MAX_DEVICES_LIMIT = 20/);
assert.match(deviceSessionService, /const DEFAULT_SESSION_LIFETIME_DAYS = 30/);
assert.match(deviceSessionService, /public static function registerLogin/);
assert.match(deviceSessionService, /public static function syncActiveCookie/);
assert.match(deviceSessionService, /public static function enforceDeviceLimit/);
assert.match(deviceSessionService, /public static function revokeSession/);
assert.match(deviceSessionService, /hash_equals/);
assert.match(deviceSessionService, /syncCookie\('user_check'/);
assert.match(deviceSessionService, /revoked_reason' => 'device_limit'/);
assert.match(deviceSessionService, /revoked_reason' => 'session_expired'/);
assert.match(deviceSessionService, /Db::startTrans\(\)/);
assert.match(deviceSessionService, /device_token_cookie/);
assert.match(deviceSessionService, /htmlspecialchars/);
assert.match(deviceSessionService, /last_seen_time/);

const vodFilterOptionsService = readAddonFile("service/VodFilterOptions.php");
assert.match(vodFilterOptionsService, /class VodFilterOptions/);
assert.match(vodFilterOptionsService, /const VOD_TABLE = 'vod'/);
assert.match(vodFilterOptionsService, /public static function filters\(array \$input\)/);
assert.match(vodFilterOptionsService, /const CACHE_VERSION = 'v4'/);
assert.match(vodFilterOptionsService, /\$params\['type_ids'\] = self::typeScope\(\$params\['type_id'\]\)/);
assert.match(vodFilterOptionsService, /responseParams/);
assert.match(vodFilterOptionsService, /'area' => 'vod_area'/);
assert.match(vodFilterOptionsService, /'year' => 'vod_year'/);
assert.match(vodFilterOptionsService, /'lang' => 'vod_lang'/);
assert.match(vodFilterOptionsService, /Db::name\(self::VOD_TABLE\)/);
assert.match(vodFilterOptionsService, /where\('vod_status', 1\)/);
assert.match(vodFilterOptionsService, /withoutDimension/);
assert.match(vodFilterOptionsService, /typeScope/);
assert.match(vodFilterOptionsService, /dimensionCandidates/);
assert.match(vodFilterOptionsService, /globalExtendValue/);
assert.doesNotMatch(vodFilterOptionsService, /optionExists/);
assert.match(vodFilterOptionsService, /\$maccms\['app'\]\['vod_extend_' \. \$dimension\]/);
assert.match(vodFilterOptionsService, /where\(\$field, 'in', array_values\(\$values\)\)/);
assert.match(vodFilterOptionsService, /field\(\$field \. ' as value, count\(\*\) as total'\)/);
assert.match(vodFilterOptionsService, /allowed_classes' => false/);
assert.match(vodFilterOptionsService, /isValidYearValue/);
assert.match(vodFilterOptionsService, /preg_match\('\/\^\[0-9\]\{4\}\$\/'/);
assert.match(vodFilterOptionsService, /max\(\$params\['limit'\] \* 4, 120\)/);
assert.match(vodFilterOptionsService, /count\(\$options\) >= \$params\['limit'\]/);
assert.doesNotMatch(vodFilterOptionsService, /where\(\$field, 'regexp'/);
assert.match(vodFilterOptionsService, /date\('Y'\)/);
assert.match(vodFilterOptionsService, /group\(\$field\)/);

const deviceAddonSql = readAddonFile("install.sql");
assert.match(deviceAddonSql, /CREATE TABLE IF NOT EXISTS `__PREFIX__pingfang_device_session`/);
assert.match(deviceAddonSql, /`token_hash` char\(64\) NOT NULL/);
assert.match(deviceAddonSql, /`login_check_hash` char\(64\) NOT NULL/);
assert.match(deviceAddonSql, /information_schema\.COLUMNS/);
assert.match(deviceAddonSql, /PREPARE pingfang_login_check_hash_stmt/);
assert.match(deviceAddonSql, /UNIQUE KEY `uniq_token_hash`/);
assert.match(deviceAddonSql, /KEY `idx_user_active`/);
assert.doesNotMatch(deviceAddonSql, /DROP\s+TABLE/i);

const deviceAddonView = readAddonFile("view/index/index.html");
assert.match(deviceAddonView, /登录设备管理/);
assert.match(deviceAddonView, /当前设备/);
assert.match(deviceAddonView, /最近登录时间/);
assert.match(deviceAddonView, /踢下线/);
assert.match(deviceAddonView, /data-device-revoke/);
assert.match(deviceAddonView, /\{\$max_devices\}/);
assert.match(deviceAddonView, /device_label_display/);
assert.match(deviceAddonView, /"X-Requested-With": "XMLHttpRequest"/);

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
assert.match(templateLinter, /value\.startsWith\("\{:url\("\)/);
assert.match(templateLinter, /preview\\\/data\\\.json/);
assert.match(templateLinter, /localhost/);
assert.match(templateLinter, /public\/digg\.html/);
assert.match(templateLinter, /public\/score\.html/);
assert.match(templateLinter, /public\/star\.html/);
assert.match(templateLinter, /maccms\.path without a trailing slash/);
assert.match(templateLinter, /Template lint passed/);

const compatVerifier = readFileSync(path.join(root, "scripts/verify-compat.mjs"), "utf8");
assert.match(compatVerifier, /requiredThemeDirs/);
assert.match(compatVerifier, /html\/label\/comics\.html/);
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
assert.match(previewVerifier, /route=videos/);
assert.match(previewVerifier, /route=comics/);
assert.match(previewVerifier, /route=articles/);
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
assert.match(releaseVerifier, /pingfangdevice\/service\/VodFilterOptions\.php/);
assert.match(releaseVerifier, /pingfangvideo\/js\/react\.production\.min\.js/);
assert.match(releaseVerifier, /pingfangvideo\/js\/react-dom\.production\.min\.js/);
assert.match(releaseVerifier, /pingfangvideo\/js\/rank-react\.js/);
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
assert.doesNotMatch(preview, /js\/react\.production\.min\.js\?v=18\.3\.1/);
assert.doesNotMatch(preview, /js\/react-dom\.production\.min\.js\?v=18\.3\.1/);
assert.doesNotMatch(preview, new RegExp(`js/rank-react\\.js\\?v=${assetVersionPlaceholder}`));
assert.match(preview, new RegExp(`js/gsap\\.min\\.js\\?v=3\\.15\\.0[\\s\\S]*js/app\\.js\\?v=${assetVersionPlaceholder}`));
assert.doesNotMatch(preview, /js\/app\.js\?v=20260621/);
assert.match(preview, /sizes="\(max-width: 560px\) 46vw, \(max-width: 920px\) 30vw, 180px"/);
assert.match(preview, /class="rank-thumb"[\s\S]*sizes="72px"/);
assert.match(preview, /class="rank-score"/);
assert.match(preview, /data-banner-bg="\$\{escapeHtml\(backdrop\)\}"/);
assert.match(preview, /bannerBgStyle = index === 0 \? ` style="--banner-bg: url\('\$\{escapeHtml\(backdrop\)\}'\);"` : ""/);
assert.doesNotMatch(preview, /banner-poster/);
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
assert.doesNotMatch(preview, /data-player-fullscreen/);
assert.doesNotMatch(preview, /横屏全屏/);
assert.doesNotMatch(preview, /initPlayerFullscreen/);
assert.match(preview, /aria-controls="mobileDrawer"/);
assert.match(preview, /class="mobile-drawer-backdrop" data-mobile-nav-close hidden/);
assert.match(preview, /<aside class="mobile-drawer" id="mobileDrawer" aria-label="移动端分类菜单" aria-hidden="true">/);
assert.match(preview, /class="mobile-drawer-section mobile-drawer-account"/);
assert.match(preview, /<span>账号<\/span>/);
assert.match(preview, /class="mobile-drawer-login" href="\?route=login" data-route="login">登录<\/a>/);
assert.match(preview, /id="mobileDrawerCats"/);
assert.match(preview, /function renderMobileDrawerCategories/);
assert.match(preview, /mobileDrawerCats\.innerHTML = store\.categories\.slice\(0, 12\)\.map/);
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
assert.doesNotMatch(preview, /class="wrap quick-types"/);
assert.doesNotMatch(preview, /store\.categories\.slice\(0, 10\)/);
assert.match(preview, /banner-dots/);
assert.doesNotMatch(preview, /hero-stats/);
assert.doesNotMatch(preview, /片库内容/);
assert.match(preview, /hot-search-panel/);
assert.match(preview, /热搜榜/);
assert.match(preview, /data-rank-react-root/);
assert.doesNotMatch(preview, /data-rank-visible-count/);
assert.match(preview, /data-rank-react-list/);
assert.match(preview, /data-rank-item/);
assert.match(preview, /rankVideos = hot\.slice\(0, 5\)/);
assert.doesNotMatch(preview, /shuffleVideos/);
assert.doesNotMatch(preview, /is-rank-extra/);
assert.match(preview, /class="rank-refresh" href="\$\{url\("category", \{ sort: "hot" \}\)\}">查看更多<\/a>/);
assert.doesNotMatch(preview, /换一换/);
assert.match(preview, /PingFangRankReact\?\.mountAll\?\.\(app\)/);
assert.doesNotMatch(preview, /id="hotSearchPanel"/);
assert.doesNotMatch(preview, /renderHeaderHotSearch/);
assert.match(preview, /url\("category", \{ sort: "hot" \}\)/);
assert.match(preview, /score-badge/);
assert.match(preview, /card-meta/);
assert.match(preview, /function homeShelfCard\(video, featured = false\)/);
assert.match(preview, /title="\$\{escapeHtml\(video\.title\)\}"/);
assert.match(preview, /function homeShelfTabs\(tabs\)/);
assert.match(preview, /home-shelf home-shelf-latest/);
assert.doesNotMatch(preview, /home-shelf home-shelf-hot/);
assert.match(preview, /aria-label="最新分类"/);
assert.match(preview, /<button type="button" data-home-tab="\$\{escapeHtml\(tab\.key\)\}" role="tab" aria-selected="\$\{tab\.isActive \? "true" : "false"\}" aria-controls="latest-panel-\$\{escapeHtml\(tab\.key\)\}"/);
assert.doesNotMatch(preview, /href="#home-latest-/);
assert.match(preview, /home-shelf-rail"\s+data-home-tab="\$\{escapeHtml\(tab\.key\)\}"\s+id="latest-panel-\$\{escapeHtml\(tab\.key\)\}"\s+role="tabpanel"\s+aria-hidden="\$\{tab\.isActive \? "false" : "true"\}"\$\{tab\.isActive \? "" : " hidden"\}/);
assert.doesNotMatch(preview, /homeShelfCard\(video, true\)/);
assert.match(preview, /latestTabs\.map\(\(tab\) => homeShelfPanel\(tab\)\)\.join\(""\)/);
assert.doesNotMatch(preview, /<div class="vod-grid">\$\{latest\.map\(card\)\.join\(""\)\}<\/div>/);
const previewCardFunction = preview.match(/function card\(video\) \{[\s\S]*?function rankItem/)?.[0] || "";
assert.doesNotMatch(previewCardFunction, /<small>\$\{escapeHtml\(video\.actor\)\}<\/small>/);
assert.match(preview, /detail-panel/);
assert.match(preview, /site-logo\.png/);
assert.doesNotMatch(preview, /brand-text/);
assert.match(preview, /route === "categories"/);
assert.match(preview, /route === "videos"/);
assert.match(preview, /route === "comics"/);
assert.match(preview, /route === "articles"/);
assert.match(preview, /route === "games"/);
assert.match(preview, /route === "history"/);
assert.match(preview, /route === "login"/);
assert.match(preview, /function renderLoginPage/);
assert.match(preview, /function renderGamesPage/);
assert.match(preview, /function renderComicsPage/);
assert.match(preview, /function renderArticlesPage/);
assert.match(preview, /store\.categories\.map\(\(category\) =>/);
assert.doesNotMatch(preview, /function renderVideoNavCategories/);
assert.doesNotMatch(preview, /nav-video-panel/);
assert.doesNotMatch(preview, /nav-video-trigger/);
const previewRenderNavFunction = preview.match(/function renderNav\(\) \{[\s\S]*?\n\}/)?.[0] || "";
assert.deepEqual(extractAnchorTexts(previewRenderNavFunction), ["首页", "视频", "漫画", "文章", "游戏"]);
assert.match(previewRenderNavFunction, /href="\$\{url\("categories"\)\}" data-route="categories">视频/);
assert.match(previewRenderNavFunction, /data-route="comics">漫画/);
assert.match(previewRenderNavFunction, /data-route="articles">文章/);
assert.doesNotMatch(previewRenderNavFunction, /data-route="categories">分类/);
assert.match(preview, /data-route="games">游戏/);
assert.match(preview, /<a href="\?route=games" data-route="games">游戏<\/a>/);
assert.match(preview, /<a href="\?route=categories" data-route="categories">视频<\/a>/);
assert.match(preview, /<a href="\?route=comics" data-route="comics">漫画<\/a>/);
assert.match(preview, /<a href="\?route=articles" data-route="articles">文章<\/a>/);
assert.match(preview, /category-index/);
assert.match(preview, /<a class="category-hit" href="\$\{url\("category", \{ name: category \}\)\}" data-route="category"/);
assert.match(preview, /aria-label="进入\$\{escapeHtml\(category\)\}"/);
assert.match(preview, /sortUrl\(category, "latest"\)/);
assert.match(preview, /sortUrl\(category, "hot"\)/);
assert.match(preview, /function renderCategory\(name, sort = "latest", area = "", year = "", genre = "", page = 1, lang = "", letter = "", routeName = "category"\)/);
assert.match(preview, /return url\(routeName, params\)/);
assert.match(preview, /renderPagination\(routeName, pageParams/);
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
assert.doesNotMatch(phpRender, /hero-stats/);
assert.doesNotMatch(phpRender, /片库内容/);
assert.match(phpRender, /hot-search-panel/);
assert.match(phpRender, /热搜榜/);
assert.doesNotMatch(phpRender, /render_hot_search_panel\(\$data\)[\s\S]{0,120}<a class="history-link"/);
assert.match(phpRender, /path_for\('categories'\)/);
assert.match(phpRender, /path_for\('videos'\)/);
assert.match(phpRender, /path_for\('comics'\)/);
assert.match(phpRender, /path_for\('articles'\)/);
assert.match(phpRender, /path_for\('games'\)/);
assert.match(phpRender, /\$route === 'videos'/);
assert.match(phpRender, /\$route === 'comics'/);
assert.match(phpRender, /\$route === 'articles'/);
assert.match(phpRender, /\$route === 'games'/);
assert.match(phpRender, /游戏入口/);
assert.match(phpRender, /漫画入口/);
assert.match(phpRender, /文章入口/);
assert.doesNotMatch(phpRender, /\$navVideoCategories = implode/);
assert.doesNotMatch(phpRender, /class="nav-video-menu"/);
assert.doesNotMatch(phpRender, /class="nav-video-trigger"/);
assert.doesNotMatch(phpRender, /class="nav-video-panel"/);
const phpNavSnippet = phpRender.match(/\$nav = [\s\S]*?\$drawerCategories = implode/)?.[0] || "";
assert.deepEqual(extractAnchorTexts(phpNavSnippet), ["首页", "视频", "漫画", "文章", "游戏"]);
assert.match(phpNavSnippet, /path_for\('categories'\)[\s\S]*>视频<\/a>/);
assert.match(phpNavSnippet, /path_for\('comics'\)[\s\S]*>漫画<\/a>/);
assert.match(phpNavSnippet, /path_for\('articles'\)[\s\S]*>文章<\/a>/);
assert.doesNotMatch(phpNavSnippet, />分类<\/a>/);
const phpMobileDrawerLinksSnippet = phpRender.match(/<nav class="mobile-drawer-links"[\s\S]*?<\/nav>/)?.[0] || "";
assert.deepEqual(extractAnchorTexts(phpMobileDrawerLinksSnippet), ["首页", "视频", "漫画", "文章", "游戏"]);
assert.match(phpMobileDrawerLinksSnippet, /path_for\('categories'\)[\s\S]*>视频<\/a>/);
assert.doesNotMatch(phpMobileDrawerLinksSnippet, /path_for\('videos'\)[\s\S]*>视频<\/a>/);
assert.match(phpRender, /path_for\('category', \['sort' => 'hot'\]\)/);
assert.match(phpRender, /hero-carousel/);
assert.match(phpRender, /banner-dots/);
assert.match(phpRender, /score-badge/);
assert.match(phpRender, /function render_home_shelf_card\(array \$video, bool \$featured = false\): string/);
assert.match(phpRender, /title="' \. e\(\$video\['title'\]\) \. '"/);
assert.match(phpRender, /\$homeTabs = \[/);
assert.match(phpRender, /\$tabRails \.= render_home_latest_panel\(\$tab\['key'\], \$tab\['videos'\], \$index === 0\)/);
assert.match(phpRender, /\$tabLinks \.= '<button type="button" data-home-tab="' \. e\(\$tab\['key'\]\)/);
assert.doesNotMatch(phpRender, /href="#home-latest-/);
assert.match(phpRender, /\$latestShelf = '<section class="wrap home-shelf home-shelf-latest"[\s\S]*<h2>最新上线<\/h2>' \. \$tabLinks \. '<a class="home-shelf-more" href="' \. e\(path_for\('category'\)\) \. '">全部影片<\/a>/);
assert.match(phpRender, /array_slice\(sort_videos\(filter_videos\(\$data, \$category\), 'latest'\), 0, 6\)/);
assert.match(phpRender, /detail-panel/);
const phpRenderCardsFunction = phpRender.match(/function render_cards\(array \$videos\): string[\s\S]*?function hero_slides/)?.[0] || "";
assert.doesNotMatch(phpRenderCardsFunction, /<small>' \. e\(\$video\['actor'\]\) \. '<\/small>/);
assert.match(phpRender, /site-logo\.png/);
assert.doesNotMatch(phpRender, /brand-text/);
assert.match(phpRender, /mobile-drawer/);
assert.match(phpRender, /mobile-drawer-backdrop/);
assert.match(phpRender, /mobile-drawer-account/);
assert.match(phpRender, /mobile-drawer-login/);
assert.match(phpRender, /path_for\('login'\)/);
assert.match(phpRender, /\$drawerCategories = implode/);
assert.match(phpRender, /array_slice\(\$data\['categories'\], 0, 12\)/);
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
assert.doesNotMatch(phpRender, /data-player-fullscreen/);
assert.doesNotMatch(phpRender, /横屏全屏/);
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
const rankReact = readThemeFile("js/rank-react.js");
const pingfangPlayer = readThemeFile("js/pingfang-player.js");
assert.match(rankReact, /window\.React/);
assert.match(rankReact, /window\.ReactDOM/);
assert.match(rankReact, /ReactDOM\.createRoot/);
assert.match(rankReact, /data-rank-react-root/);
assert.match(rankReact, /data-rank-item/);
assert.match(rankReact, /href: props\.moreUrl \|\| "#"/);
assert.match(rankReact, /"查看更多"/);
assert.doesNotMatch(rankReact, /data-rank-refresh/);
assert.doesNotMatch(rankReact, /data-rank-visible-count/);
assert.doesNotMatch(rankReact, /shuffleItems/);
assert.doesNotMatch(rankReact, /rotateItems/);
assert.doesNotMatch(rankReact, /setOffset/);
assert.doesNotMatch(rankReact, /换一换/);
assert.match(rankReact, /PingFangRankReact/);
assert.doesNotMatch(rankReact, /unpkg|jsdelivr|localhost|127\.0\.0\.1/);
assert.match(pingfangPlayer, /window\.player_data/);
assert.match(pingfangPlayer, /\.m3u8/);
assert.match(pingfangPlayer, /\.mp4/);
assert.match(pingfangPlayer, /restoreOriginalPlayer/);
assert.match(pingfangPlayer, /localStorage/);
assert.match(appJs, /document\.querySelector\("\.mobile-drawer"\)/);
assert.match(appJs, /document\.querySelector\("\.mobile-drawer-backdrop"\)/);
assert.match(appJs, /mobile-nav-open/);
assert.match(appJs, /aria-controls", "mobileDrawer"/);
assert.match(appJs, /\[data-mobile-nav-close\]/);
assert.match(appJs, /drawer\.classList\.toggle\("is-open", isOpen\)/);
assert.match(appJs, /backdrop\.hidden = !isOpen/);
assert.match(appJs, /window\.matchMedia\("\(min-width: 1021px\)"\)/);
assert.match(appJs, /\.site-nav a, \.mobile-drawer a/);
assert.match(appJs, /initLoginForms/);
assert.match(appJs, /data-login-form/);
assert.match(appJs, /fetch\(form\.action/);
assert.match(appJs, /new FormData\(form\)/);
assert.match(appJs, /X-Requested-With/);
assert.match(appJs, /showSiteNotice/);
assert.match(appJs, /initSearchForms/);
assert.doesNotMatch(appJs, /search[\s\S]{0,180}setTimeout/);
assert.doesNotMatch(appJs, /initPlayerFullscreen/);
assert.doesNotMatch(appJs, /data-player-fullscreen/);
assert.doesNotMatch(appJs, /requestFullscreen/);
assert.doesNotMatch(appJs, /webkitEnterFullscreen/);
assert.doesNotMatch(appJs, /screen\.orientation\.lock\("landscape"\)/);
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
assert.match(appJs, /button\[data-home-tab\]/);
assert.match(appJs, /aria-selected", isActive \? "true" : "false"/);
assert.match(appJs, /window\.history\.replaceState\(\{\}, "", window\.location\.pathname \+ window\.location\.search\)/);
assert.doesNotMatch(appJs, /home-latest-/);
assert.doesNotMatch(appJs, /replaceState\(\{\}, "", current\.pathname \+ current\.search \+ current\.hash\)/);
assert.match(appJs, /function initAutoNextPlayback/);
assert.match(appJs, /\[data-next-play-url\]/);
assert.match(appJs, /MacPlayer\.PlayLinkNext/);
assert.match(appJs, /addEventListener\("ended"/);
assert.match(appJs, /contentDocument/);
assert.match(appJs, /window\.top\.location\.href = nextUrl/);
assert.match(appJs, /function initLogoutLinks/);
assert.match(appJs, /\[data-logout-link\]/);
assert.match(appJs, /data-logout-redirect/);
assert.match(appJs, /fetch\(logoutUrl,\s*\{\s*method: "POST"/);
assert.match(appJs, /X-Requested-With": "XMLHttpRequest"/);
assert.match(appJs, /queueSiteNotice\("已退出登录", "success"\)/);
assert.match(appJs, /window\.PingFangVideo\.initLogoutLinks = initLogoutLinks/);
assert.match(appJs, /initLogoutLinks\(document\)/);
assert.match(appJs, /initGsapMotion/);
assert.match(appJs, /window\.gsap/);
assert.match(appJs, /gsap\.matchMedia\(\)/);
assert.match(appJs, /prefers-reduced-motion: reduce/);
assert.match(appJs, /gsap\.timeline/);
assert.match(appJs, /initBannerIridescence/);
assert.match(appJs, /data-banner-iridescence/);
assert.match(appJs, /--banner-shine-x/);
assert.match(appJs, /--banner-shine-y/);
assert.match(appJs, /--banner-shine-rotate/);
assert.match(appJs, /--banner-shine-opacity/);
assert.match(appJs, /DeviceOrientationEvent/);
assert.match(appJs, /requestPermission/);
assert.match(appJs, /deviceorientation/);
assert.match(appJs, /repeat: -1/);
assert.match(appJs, /initRevealMotion/);
assert.match(appJs, /IntersectionObserver/);
assert.match(appJs, /data-gsap-reveal-ready/);
assert.match(appJs, /data-gsap-revealed/);
assert.match(appJs, /\.page-title/);
assert.match(appJs, /\.filter-panel/);
assert.match(appJs, /function initDynamicVodFilters/);
assert.match(appJs, /data-dynamic-vod-filters/);
assert.match(appJs, /data-filter-endpoint/);
assert.match(appJs, /data-filter-kind/);
assert.match(appJs, /data-filter-value/);
assert.match(appJs, /pingfangFilterReady/);
assert.match(appJs, /X-Requested-With/);
assert.match(appJs, /\.content-section/);
assert.match(appJs, /\.home-shelf/);
assert.match(appJs, /\.home-shelf-card/);
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
assert.doesNotMatch(appJs, /vod-card/);
assert.match(appJs, /rank-item/);
assert.doesNotMatch(appJs, /bindGsapHover\(scope, "\.home-shelf-card"/);
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
assert.match(appJs, /function ensureCarouselDots\(carousel, slides\)/);
assert.match(appJs, /document\.createElement\("button"\)/);
assert.match(appJs, /function ensureHeroSlideBackground\(slide\)/);
assert.match(appJs, /data-banner-bg/);
assert.match(appJs, /carousel\.addEventListener\("focusin", stop\)/);
assert.match(appJs, /carousel\.addEventListener\("touchstart"/);
assert.match(appJs, /carousel\.addEventListener\("touchend"/);
assert.match(appJs, /Math\.abs\(deltaX\) > 44/);
assert.match(appJs, /document\.addEventListener\("visibilitychange"/);
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

const videosPreview = renderPreview("route=videos");
const videosPreviewMain = videosPreview.match(/<main>[\s\S]*<\/main>/)?.[0] || "";
assert.match(videosPreview, /<title>影片库 - 平方影视<\/title>/);
assert.match(videosPreview, /<h1>影片库<\/h1>/);
assert.match(videosPreview, /\/index\.php\?route=videos[^"]*sort=hot/);
assert.doesNotMatch(videosPreview, /<title>全部影片 - 平方影视<\/title>/);
assert.doesNotMatch(videosPreview, /<h1>全部影片<\/h1>/);
assert.doesNotMatch(videosPreviewMain, /\/index\.php\?route=category(?:&amp;|")/);

const categoryIndexPreview = renderPreview("route=category");
assert.match(categoryIndexPreview, /<title>影片库 - 平方影视<\/title>/);
assert.match(categoryIndexPreview, /<h1>影片库<\/h1>/);
assert.doesNotMatch(categoryIndexPreview, /<title>全部影片 - 平方影视<\/title>/);
assert.doesNotMatch(categoryIndexPreview, /<h1>全部影片<\/h1>/);

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
