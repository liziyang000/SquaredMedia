<?php
declare(strict_types=1);

function e(mixed $value): string
{
    return htmlspecialchars((string) $value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

function path_for(string $route, array $params = []): string
{
    $query = http_build_query(['route' => $route] + $params);
    return '/index.php?' . $query;
}

function hot_search_terms(array $data): array
{
    if (!empty($data['hotSearch']) && is_array($data['hotSearch'])) {
        return array_values(array_filter(array_map('strval', $data['hotSearch'])));
    }

    $videos = $data['videos'];
    usort($videos, static fn (array $a, array $b): int => ((int) $b['hits']) <=> ((int) $a['hits']));

    return array_map(static fn (array $video): string => (string) $video['title'], array_slice($videos, 0, 6));
}

function render_hot_search_panel(array $data, string $extraClass = ''): string
{
    $links = implode('', array_map(
        static fn (string $term): string => '<a href="' . e(path_for('search', ['wd' => $term])) . '">' . e($term) . '</a>',
        hot_search_terms($data),
    ));

    return '<div class="hot-search-panel' . e($extraClass) . '" aria-label="热搜榜"><span>热搜榜</span>' . $links . '</div>';
}

function render_layout(array $data, string $title, string $content): string
{
    $nav = '<a href="' . e(path_for('home')) . '" data-nav-section="home">首页</a>';
    $nav .= '<a href="' . e(path_for('categories')) . '" data-nav-section="videos">视频</a>';
    $drawerCategories = implode('', array_map(
        static fn (string $category): string => '<a href="' . e(path_for('category', ['name' => $category])) . '">' . e($category) . '</a>',
        array_slice($data['categories'], 0, 12),
    ));

    return '<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>' . e($title) . ' - ' . e($data['siteName']) . '</title>
  <link rel="icon" href="/template/pingfangvideo/images/brand/favicon.ico">
  <link rel="icon" type="image/png" sizes="64x64" href="/template/pingfangvideo/images/brand/favicon.png">
  <link rel="stylesheet" href="/template/pingfangvideo/css/style.css">
</head>
<body>
<header class="site-header">
  <div class="wrap header-inner">
    <a class="brand" href="' . e(path_for('home')) . '" aria-label="' . e($data['siteName']) . '"><span class="brand-emblem" aria-hidden="true"></span><span class="brand-wordmark"><strong>' . e($data['siteName']) . '</strong><small>STREAMING EDITION</small></span><img class="brand-logo" src="/template/pingfangvideo/images/site-logo.png" alt="" width="58" height="58" decoding="async" hidden aria-hidden="true"></a>
    <button class="nav-toggle" type="button" aria-label="展开导航" aria-expanded="false" aria-controls="mobileDrawer"><span></span><span></span><span></span></button>
    <nav class="site-nav" aria-label="主导航">' . $nav . '</nav>
    <div class="header-search-wrap">
      <form class="header-search" method="get" action="/index.php">
        <input type="hidden" name="route" value="search">
        <label class="sr-only" for="previewGlobalSearch">站内搜索</label>
        <input id="previewGlobalSearch" type="search" name="wd" placeholder="搜索影片、演员或导演…" autocomplete="off">
        <button type="submit">搜索</button>
      </form>
    </div>
    <div class="theme-switcher" data-theme-switcher>
      <button class="theme-switcher-trigger" type="button" data-theme-switcher-trigger aria-expanded="false" aria-controls="themeSwitcherMenu">主题</button>
      <div class="theme-switcher-menu" id="themeSwitcherMenu" data-theme-switcher-menu hidden>
        <button class="theme-option is-active" type="button" data-theme-option="default" aria-pressed="true">
          <span class="theme-option-swatch theme-option-swatch-default" aria-hidden="true"></span>
          <span>液态影院</span>
        </button>
        <button class="theme-option" type="button" data-theme-option="blue-pink-purple" aria-pressed="false">
          <span class="theme-option-swatch theme-option-swatch-aurora" aria-hidden="true"></span>
          <span>极光夜幕</span>
        </button>
        <button class="theme-option" type="button" data-theme-option="poster-magazine" aria-pressed="false">
          <span class="theme-option-swatch theme-option-swatch-poster" aria-hidden="true"></span>
          <span>海报画廊</span>
        </button>
      </div>
    </div>
    <a class="history-link" href="' . e(path_for('history')) . '">观看记录</a>
  </div>
</header>
<div class="mobile-drawer-backdrop" data-mobile-nav-close hidden></div>
<aside class="mobile-drawer" id="mobileDrawer" role="dialog" aria-modal="true" aria-labelledby="mobileDrawerTitle" aria-hidden="true" inert>
  <div class="mobile-drawer-head"><strong id="mobileDrawerTitle">分类导航</strong><button class="mobile-drawer-close" type="button" data-mobile-nav-close aria-label="关闭菜单">×</button></div>
  <form class="mobile-drawer-search" method="get" action="/index.php" role="search">
    <input type="hidden" name="route" value="search">
    <label class="sr-only" for="phpMobileSearch">站内搜索</label>
    <input id="phpMobileSearch" type="search" name="wd" placeholder="搜索影片、演员或导演…" autocomplete="off">
    <button type="submit">搜索</button>
  </form>
  <nav class="mobile-drawer-links" aria-label="移动端快捷导航">
    <a href="' . e(path_for('home')) . '" data-nav-section="home">首页</a>
    <a href="' . e(path_for('categories')) . '" data-nav-section="videos">视频</a>
  </nav>
  <div class="mobile-drawer-section mobile-drawer-account"><span>账号</span><div class="mobile-drawer-user"><a class="mobile-drawer-login" href="' . e(path_for('login')) . '">登录</a></div></div>
  <div class="mobile-drawer-section mobile-theme-section" data-theme-switcher-mobile>
    <span>主题</span>
    <div class="theme-option-grid">
      <button class="theme-option is-active" type="button" data-theme-option="default" aria-pressed="true">
        <span class="theme-option-swatch theme-option-swatch-default" aria-hidden="true"></span>
        <span>液态影院</span>
      </button>
      <button class="theme-option" type="button" data-theme-option="blue-pink-purple" aria-pressed="false">
        <span class="theme-option-swatch theme-option-swatch-aurora" aria-hidden="true"></span>
        <span>极光夜幕</span>
      </button>
      <button class="theme-option" type="button" data-theme-option="poster-magazine" aria-pressed="false">
        <span class="theme-option-swatch theme-option-swatch-poster" aria-hidden="true"></span>
        <span>海报画廊</span>
      </button>
    </div>
  </div>
  <div class="mobile-drawer-section"><span>影片分类</span><div class="mobile-drawer-cats">' . $drawerCategories . '</div></div>
</aside>
<main id="mainContent" tabindex="-1">' . $content . '</main>
<script src="/template/pingfangvideo/js/app.js"></script>
</body>
</html>';
}

function render_cards(array $videos): string
{
    return implode('', array_map(static function (array $video): string {
        return '<a class="vod-card" href="' . e(path_for('detail', ['id' => $video['id']])) . '">
  <span class="poster"><img src="' . e($video['poster']) . '" alt="' . e($video['title']) . '" loading="lazy"><em class="quality-badge">' . e($video['remark']) . '</em><span class="score-badge">' . e($video['score']) . '</span></span>
  <strong>' . e($video['title']) . '</strong>
  <span class="card-meta"><span>' . e($video['category']) . '</span><span>' . e($video['year']) . '</span></span>
</a>';
    }, $videos));
}

function render_home_shelf_card(array $video, bool $featured = false): string
{
    $image = $featured ? ($video['backdrop'] ?? $video['poster']) : $video['poster'];
    $cardClass = $featured ? 'home-shelf-card is-featured' : 'home-shelf-card';
    $badge = $featured ? ($video['category'] ?? '热播') : ($video['remark'] ?? '高清');
    $meta = $featured ? ($video['remark'] ?? '更新中') : ((string) $video['year'] . ' · ' . (string) ($video['class'] ?? $video['category']));

    return '<a class="' . e($cardClass) . '" href="' . e(path_for('detail', ['id' => $video['id']])) . '" title="' . e($video['title']) . '">
  <span class="home-shelf-poster"><img src="' . e($image) . '" alt="' . e($video['title']) . '" loading="lazy" decoding="async" width="300" height="450" sizes="(max-width: 760px) 50vw, (max-width: 1020px) 33vw, 180px"><em>' . e($badge) . '</em></span>
  <span class="home-shelf-body"><strong>' . e($video['title']) . '</strong><small>' . e($meta) . '</small></span>
  <span class="home-shelf-score">' . e($video['score']) . '</span>
</a>';
}

function render_home_shelf(string $className, string $title, string $headExtra, array $videos, bool $featured = false): string
{
    $cards = implode('', array_map(
        static fn (array $video): string => render_home_shelf_card($video, $featured),
        $videos,
    ));

    return '<section class="wrap home-shelf ' . e($className) . '"><div class="home-shelf-head"><h2>' . e($title) . '</h2>' . $headExtra . '</div><div class="home-shelf-rail">' . $cards . '</div></section>';
}

function render_home_latest_panel(string $tabKey, array $videos, bool $isActive = false): string
{
    $cards = implode('', array_map(
        static fn (array $video): string => render_home_shelf_card($video),
        $videos,
    ));
    $hidden = $isActive ? '' : ' hidden';
    $aria = $isActive ? 'false' : 'true';
    $emptyHidden = $videos === [] ? '' : ' hidden';

    return '<div class="home-shelf-rail" data-home-tab="' . e($tabKey) . '" id="latest-panel-' . e($tabKey) . '" role="tabpanel" aria-hidden="' . $aria . '"' . $hidden . ' data-home-empty-container data-empty-item=".home-shelf-card">' . $cards
        . '<div class="home-empty-state" data-home-empty-state' . $emptyHidden . ' role="status"><strong>本年度暂无新上线内容</strong><span>' . ($tabKey === 'all' ? '有新影片上线后会显示在这里。' : '此频道有新内容后会显示在这里。') . '</span><a href="' . e(path_for('category')) . '">浏览全部影片</a></div></div>';
}

function render_pagination(string $route, array $params, int $currentPage, int $totalPages): string
{
    if ($totalPages <= 1) {
        return '';
    }

    $page = min(max($currentPage, 1), $totalPages);
    $prev = max($page - 1, 1);
    $next = min($page + 1, $totalPages);

    return '<nav class="paging" aria-label="分页">'
        . '<a href="' . e(path_for($route, $params + ['page' => 1])) . '" class="page-link">首页</a>'
        . '<a href="' . e(path_for($route, $params + ['page' => $prev])) . '" class="page-link">上一页</a>'
        . '<span class="page-state">' . $page . ' / ' . $totalPages . '</span>'
        . '<a href="' . e(path_for($route, $params + ['page' => $next])) . '" class="page-link">下一页</a>'
        . '<a href="' . e(path_for($route, $params + ['page' => $totalPages])) . '" class="page-link">尾页</a>'
        . '<form class="page-jump" data-page-jump data-page-template="' . e(path_for($route, $params + ['page' => '__PAGE__'])) . '">'
        . '<input class="page-jump-input" type="number" min="1" max="' . $totalPages . '" value="' . $page . '" aria-label="跳转页码">'
        . '<button class="page-jump-submit" type="submit">跳转</button>'
        . '</form>'
        . '</nav>';
}

function render_hero_carousel(array $data, array $videos): string
{
    $banners = array_slice($videos, 0, 5);
    $slides = '';

    foreach ($banners as $index => $video) {
        $active = $index === 0 ? ' is-active' : '';
        $backdrop = $video['backdrop'] ?? $video['poster'];
        $duration = $video['duration'] ?? '时长待定';
        $version = $video['version'] ?? ($video['remark'] ?? '高清');
        $slides .= '<article class="hero-slide' . $active . '" data-carousel-slide data-banner-bg="' . e($backdrop) . '">
  <span class="banner-bg"></span>
  <span class="banner-content">
    <span class="banner-copy">
      <em class="eyebrow">热播推荐</em>
      <strong>' . e($video['title']) . '</strong>
      <span class="banner-meta"><i>' . e($video['year']) . '</i><i>' . e($video['class'] ?? $video['category']) . '</i><i>' . e($duration) . '</i><i>' . e($version) . '</i></span>
      <small>' . e($video['summary']) . '</small>
    </span>
    <span class="banner-actions"><a class="primary-btn" href="' . e(path_for('play', ['id' => $video['id'], 'episode' => 1])) . '">立即播放</a><a class="ghost-btn" href="' . e(path_for('detail', ['id' => $video['id']])) . '">详情介绍</a></span>
  </span>
 </article>';
    }

    return '<section class="hero-carousel" data-carousel aria-label="首页热播轮播">
  <div class="banner-track">' . $slides . '</div>
  <span class="liquid-lens" aria-hidden="true"></span>
  <div class="banner-controls">
    <button class="banner-autoplay-toggle" type="button" data-carousel-autoplay-toggle aria-pressed="false" aria-label="暂停自动轮播"><span aria-hidden="true"></span></button>
    <div class="banner-dots" role="tablist" aria-label="轮播分页"></div>
  </div>
</section>';
}

function sort_label(string $sort): string
{
    return match ($sort) {
        'hot' => '最热',
        'score' => '评分',
        default => '最新',
    };
}

function find_episode(array $video, int $episodeNo): array
{
    $episode = $video['episodes'][0];
    foreach ($video['episodes'] as $item) {
        if ((int) $item['no'] === $episodeNo) {
            return $item;
        }
    }

    return $episode;
}

function render_feedback_page(array $data, string $title, string $eyebrow, string $heading, string $description, string $button): string
{
    return render_layout($data, $title, '<section class="wrap system-page">
  <form class="system-box verify-form" method="post" action="' . e(path_for('gbook-save')) . '">
    <span class="eyebrow">' . e($eyebrow) . '</span>
    <h1>' . e($heading) . '</h1>
    <p>' . e($description) . '</p>
    <label><span>称呼</span><input type="text" name="gbook_name" autocomplete="name" placeholder="请输入称呼"></label>
    <label><span>内容</span><textarea name="gbook_content" rows="5" required placeholder="请输入反馈内容"></textarea></label>
    <label><span>验证码</span><input type="text" name="verify" autocomplete="off" placeholder="输入验证码"></label>
    <div class="verify-code">本地预览无需验证码</div>
    <button class="primary-btn" type="submit">' . e($button) . '</button>
  </form>
</section>');
}

function render_player_preview(array $data, array $video, array $episode, string $eyebrow, bool $trial = false): string
{
    $episodeIndex = 0;
    foreach ($video['episodes'] as $index => $item) {
        if ((int) $item['no'] === (int) $episode['no']) {
            $episodeIndex = $index;
            break;
        }
    }

    $playerLabel = $trial ? '试看播放器' : '视频播放器';
    if ($trial) {
        $actions = '<a class="ghost-btn" href="' . e(path_for('play', ['id' => $video['id'], 'episode' => $episode['no']])) . '">完整播放</a>';
        $episodeSection = '';
    } else {
        $previousEpisode = $episodeIndex > 0 ? $video['episodes'][$episodeIndex - 1] : null;
        $nextEpisode = $episodeIndex < count($video['episodes']) - 1 ? $video['episodes'][$episodeIndex + 1] : null;
        $actions = '';
        if ($previousEpisode !== null) {
            $actions .= '<a class="ghost-btn player-step-link" href="' . e(path_for('play', ['id' => $video['id'], 'episode' => $previousEpisode['no']])) . '" rel="prev">上一集</a>';
        }
        $actions .= '<a class="ghost-btn" href="#episodeList">选集</a>';
        if ($nextEpisode !== null) {
            $actions .= '<a class="ghost-btn player-step-link" href="' . e(path_for('play', ['id' => $video['id'], 'episode' => $nextEpisode['no']])) . '" rel="next">下一集</a>';
        }

        $episodeLinks = implode('', array_map(static function (array $item) use ($video, $episode): string {
            $active = (int) $item['no'] === (int) $episode['no'] ? ' class="is-active" aria-current="page"' : '';
            return '<a' . $active . ' href="' . e(path_for('play', ['id' => $video['id'], 'episode' => $item['no']])) . '">' . e($item['name']) . '</a>';
        }, $video['episodes']));
        $episodeSection = '<section class="wrap content-section" id="episodeList" aria-label="选集列表"><div class="episode-box"><div class="section-head compact"><h2>在线播放</h2><span>' . count($video['episodes']) . ' 集</span></div><div class="episode-grid">' . $episodeLinks . '</div></div></section>';
    }

    $content = '<section class="player-page"><div class="wrap"><div class="player-head"><div><span class="eyebrow">' . e($eyebrow) . '</span><h1>' . e($video['title']) . ' - ' . e($episode['name']) . '</h1></div><a class="ghost-btn" href="' . e(path_for('detail', ['id' => $video['id']])) . '">返回详情</a></div><div class="player-shell" role="region" aria-label="' . $playerLabel . '"><video controls preload="metadata" playsinline poster="' . e($video['poster']) . '"><source src="' . e($episode['src']) . '" type="video/mp4"></video></div><div class="player-toolbar" role="group" aria-label="播放控制"><span>' . e($video['title']) . ' / ' . e($episode['name']) . '</span><div class="player-toolbar-actions">' . $actions . '</div></div></div></section>' . $episodeSection;

    return render_layout($data, $video['title'], $content);
}

function render_page(array $data, string $route, array $query): string
{
    if ($route === 'login') {
        return render_layout($data, '登录', '<section class="login-page" aria-labelledby="phpLoginTitle">
  <form class="login-panel verify-form" method="post" action="' . e(path_for('login')) . '" data-login-glass>
    <span class="login-edge-glow" aria-hidden="true"></span>
    <span class="login-glass-highlight" aria-hidden="true"></span>
    <div class="login-heading">
      <span class="login-kicker">MEMBER LOGIN</span>
      <h1 id="phpLoginTitle">欢迎回来</h1>
      <p id="phpLoginSubtitle">登录账号以继续享受精彩内容</p>
    </div>
    <div class="login-fields" aria-describedby="phpLoginSubtitle">
      <div class="login-field">
        <label class="login-label" for="phpLoginAccount">账号</label>
        <span class="login-control">
          <svg class="login-field-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm7 8a7 7 0 0 0-14 0"></path></svg>
          <input id="phpLoginAccount" type="text" name="user_name" autocomplete="username" placeholder="用户名或邮箱" required>
        </span>
      </div>
      <div class="login-field">
        <label class="login-label" for="phpLoginPassword">密码</label>
        <span class="login-control">
          <svg class="login-field-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10V8a5 5 0 0 1 10 0v2m-11 0h12a1 1 0 0 1 1 1v9H5v-9a1 1 0 0 1 1-1Zm6 4v3"></path></svg>
          <input id="phpLoginPassword" type="password" name="user_pwd" autocomplete="current-password" placeholder="登录密码" required>
          <button class="login-password-toggle" type="button" data-password-toggle aria-controls="phpLoginPassword" aria-label="显示密码" aria-pressed="false"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"></path><circle cx="12" cy="12" r="2.5"></circle></svg></button>
        </span>
      </div>
      <div class="login-field">
        <label class="login-label" for="phpLoginVerify">验证码</label>
        <div class="login-captcha-row">
          <span class="login-control">
            <svg class="login-field-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 7 3v5c0 4.6-2.9 8-7 10-4.1-2-7-5.4-7-10V6l7-3Zm0 6v4m0 3h.01"></path></svg>
            <input id="phpLoginVerify" type="text" name="verify" autocomplete="off" placeholder="输入验证码" required>
          </span>
          <span class="login-captcha-preview" aria-label="验证码 6 B 8 Y">6B8Y</span>
          <button class="login-captcha-refresh" type="button" data-verify-refresh aria-label="换一张验证码"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 7v5h-5M4 17v-5h5m9.2-3A7 7 0 0 0 6.7 6.4L4 9m16 6-2.7 2.6A7 7 0 0 1 5.8 15"></path></svg><span>换一张</span></button>
        </div>
      </div>
    </div>
    <div class="login-options"><span>安全登录 · 设备保护已启用</span><a href="' . e(path_for('login')) . '">忘记密码？</a></div>
    <button class="primary-btn login-submit" type="button">登录</button>
    <div class="login-register"><span>还没有账号？</span><a href="' . e(path_for('login')) . '">注册会员</a></div>
  </form>
</section>');
    }

    if ($route === 'gbook' || $route === 'book') {
        return render_feedback_page($data, '留言反馈', '反馈', '留言反馈', '欢迎提交意见、片源问题或合作信息，我们会尽快处理。', '提交留言');
    }

    if ($route === 'report') {
        return render_feedback_page($data, '报错反馈', '报错反馈', '片源报错', '请填写无法播放、集数错误、画质异常或字幕问题。', '提交报错');
    }

    if ($route === 'history') {
        $groups = [];
        foreach ($data['history'] as $entry) {
            $video = find_video($data, (int) $entry['videoId']);
            $episode = find_episode($video, (int) $entry['episode']);
            $date = substr((string) $entry['watchedAt'], 0, 10);
            $groups[$date][] = ['entry' => $entry, 'video' => $video, 'episode' => $episode, 'time' => substr((string) $entry['watchedAt'], 11)];
        }

        $timeline = '';
        foreach ($groups as $date => $items) {
            $timeline .= '<div class="timeline-date">' . e($date) . '</div>';
            foreach ($items as $item) {
                $timeline .= '<article class="timeline-item"><span class="timeline-dot"></span><div class="timeline-time">' . e($item['time']) . '</div><a class="timeline-card" href="' . e(path_for('play', ['id' => $item['video']['id'], 'episode' => $item['episode']['no']])) . '"><img src="' . e($item['video']['poster']) . '" alt="' . e($item['video']['title']) . '" loading="lazy"><span><strong>' . e($item['video']['title']) . ' - ' . e($item['episode']['name']) . '</strong><small>' . e($item['video']['category']) . ' / ' . e($item['video']['year']) . '</small><em>' . e($item['entry']['progress']) . '</em></span></a></article>';
            }
        }

        return render_layout($data, '观看记录', '<section class="wrap page-title"><span class="eyebrow">观看记录</span><h1>时间轴</h1><p>按最近观看时间倒序整理，方便继续播放上次内容。</p></section><section class="wrap history-timeline">' . $timeline . '</section>');
    }

    if ($route === 'categories') {
        $categoryPageSize = 12;
        $totalPages = (int) ceil(count($data['categories']) / $categoryPageSize);
        $page = min(max((int) ($query['page'] ?? 1), 1), max($totalPages, 1));
        $categories = array_slice($data['categories'], ($page - 1) * $categoryPageSize, $categoryPageSize);
        $tiles = implode('', array_map(static function (string $category) use ($data): string {
            $count = count(filter_videos($data, $category));
            $href = e(path_for('category', ['name' => $category]));
            $latestHref = e(path_for('category', ['name' => $category, 'sort' => 'latest']));
            $hotHref = e(path_for('category', ['name' => $category, 'sort' => 'hot']));
            $scoreHref = e(path_for('category', ['name' => $category, 'sort' => 'score']));
            return '<article class="category-tile"><a class="category-hit" href="' . $href . '" aria-label="进入' . e($category) . '"></a><div class="category-main"><span>' . e($category) . '</span><em>' . $count . ' 部</em></div><div class="category-children"><a class="category-sort sort-latest" href="' . $latestHref . '">最新</a><a class="category-sort sort-hot" href="' . $hotHref . '">最热</a><a class="category-sort sort-score" href="' . $scoreHref . '">评分</a></div></article>';
        }, $categories));

        return render_layout($data, '视频分类', '<section class="wrap page-title"><span class="eyebrow">视频</span><h1>视频分类</h1><p>从这里进入当前站点的全部视频分类。</p></section><section class="wrap category-index">' . $tiles . '</section>' . render_pagination('categories', [], $page, $totalPages));
    }

    if ($route === 'games') {
        return render_layout($data, '游戏', '<section class="wrap system-page"><div class="system-box module-fallback"><span class="eyebrow">游戏</span><h1>游戏入口维护中</h1><p>游戏模块暂未启用，请先浏览影片内容。</p><div class="detail-actions"><a class="primary-btn" href="' . e(path_for('videos')) . '">浏览影片库</a><a class="ghost-btn" href="' . e(path_for('home')) . '">返回首页</a></div></div></section>');
    }

    if ($route === 'comics') {
        return render_layout($data, '漫画', '<section class="wrap system-page"><div class="system-box module-fallback"><span class="eyebrow">漫画</span><h1>漫画入口维护中</h1><p>漫画模块暂未启用，请先浏览影片内容。</p><div class="detail-actions"><a class="primary-btn" href="' . e(path_for('videos')) . '">浏览影片库</a><a class="ghost-btn" href="' . e(path_for('home')) . '">返回首页</a></div></div></section>');
    }

    if ($route === 'articles') {
        return render_layout($data, '文章', '<section class="wrap system-page"><div class="system-box module-fallback"><span class="eyebrow">文章</span><h1>文章入口维护中</h1><p>文章模块暂未启用，请先浏览影片内容。</p><div class="detail-actions"><a class="primary-btn" href="' . e(path_for('videos')) . '">浏览影片库</a><a class="ghost-btn" href="' . e(path_for('home')) . '">返回首页</a></div></div></section>');
    }

    if ($route === 'category' || $route === 'videos') {
        $routeName = $route === 'videos' ? 'videos' : 'category';
        $defaultTitle = '影片库';
        $name = (string) ($query['name'] ?? '');
        $area = (string) ($query['area'] ?? '');
        $year = (string) ($query['year'] ?? '');
        $class = (string) ($query['class'] ?? '');
        $lang = (string) ($query['lang'] ?? '');
        $letter = (string) ($query['letter'] ?? '');
        $requestedSort = (string) ($query['sort'] ?? 'latest');
        $sort = in_array($requestedSort, ['latest', 'hot', 'score'], true) ? $requestedSort : 'latest';
        $videos = sort_videos(filter_videos($data, $name !== '' ? $name : null, null, $area, $year, $class, $lang, $letter), $sort);
        $totalCount = count($videos);
        $categoryPageSize = 4;
        $totalPages = (int) ceil($totalCount / $categoryPageSize);
        $page = min(max((int) ($query['page'] ?? 1), 1), max($totalPages, 1));
        $pagedVideos = array_slice($videos, ($page - 1) * $categoryPageSize, $categoryPageSize);
        $areas = ['中国大陆', '中国香港', '中国台湾', '美国', '韩国', '日本'];
        $years = ['2026', '2025', '2024', '2023', '2022', '2021'];
        $langs = ['国语', '粤语', '英语', '韩语', '日语'];
        $letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', '0~9'];
        $channelTitle = $name !== '' ? $name : '影片库';
        $channelSearch = '<div class="filter-row filter-search-row"><strong>搜索</strong><form class="channel-search" method="get" action="/index.php"><input type="hidden" name="route" value="search"><input type="hidden" name="type" value="' . e($name) . '"><label class="sr-only" for="phpCategorySearch">在' . e($channelTitle) . '中搜索</label><input id="phpCategorySearch" type="search" name="wd" placeholder="在' . e($channelTitle) . '中搜索…" autocomplete="off"><button type="submit">搜索</button></form></div>';
        $typeLinks = '<a' . ($name === '' ? ' class="is-active"' : '') . ' href="' . e(path_for($routeName, ['area' => $area, 'year' => $year, 'class' => $class, 'lang' => $lang, 'letter' => $letter, 'sort' => $sort])) . '">全部</a>';
        $typeLinks .= implode('', array_map(static function (string $category) use ($routeName, $name, $area, $year, $class, $lang, $letter, $sort): string {
            $active = $category === $name ? ' class="is-active"' : '';
            return '<a' . $active . ' href="' . e(path_for($routeName, ['name' => $category, 'area' => $area, 'year' => $year, 'class' => $class, 'lang' => $lang, 'letter' => $letter, 'sort' => $sort])) . '">' . e($category) . '</a>';
        }, $data['categories']));
        $areaLinks = '<a' . ($area === '' ? ' class="is-active"' : '') . ' href="' . e(path_for($routeName, ['name' => $name, 'year' => $year, 'class' => $class, 'lang' => $lang, 'letter' => $letter, 'sort' => $sort])) . '">全部</a>';
        $areaLinks .= implode('', array_map(static function (string $item) use ($routeName, $name, $area, $year, $class, $lang, $letter, $sort): string {
            $active = $item === $area ? ' class="is-active"' : '';
            return '<a' . $active . ' href="' . e(path_for($routeName, ['name' => $name, 'area' => $item, 'year' => $year, 'class' => $class, 'lang' => $lang, 'letter' => $letter, 'sort' => $sort])) . '">' . e($item) . '</a>';
        }, $areas));
        $yearLinks = '<a' . ($year === '' ? ' class="is-active"' : '') . ' href="' . e(path_for($routeName, ['name' => $name, 'area' => $area, 'class' => $class, 'lang' => $lang, 'letter' => $letter, 'sort' => $sort])) . '">全部</a>';
        $yearLinks .= implode('', array_map(static function (string $item) use ($routeName, $name, $area, $year, $class, $lang, $letter, $sort): string {
            $active = $item === $year ? ' class="is-active"' : '';
            return '<a' . $active . ' href="' . e(path_for($routeName, ['name' => $name, 'area' => $area, 'year' => $item, 'class' => $class, 'lang' => $lang, 'letter' => $letter, 'sort' => $sort])) . '">' . e($item) . '</a>';
        }, $years));
        $langLinks = '<a' . ($lang === '' ? ' class="is-active"' : '') . ' href="' . e(path_for($routeName, ['name' => $name, 'area' => $area, 'year' => $year, 'class' => $class, 'letter' => $letter, 'sort' => $sort])) . '">全部</a>';
        $langLinks .= implode('', array_map(static function (string $item) use ($routeName, $name, $area, $year, $class, $lang, $letter, $sort): string {
            $active = $item === $lang ? ' class="is-active"' : '';
            return '<a' . $active . ' href="' . e(path_for($routeName, ['name' => $name, 'area' => $area, 'year' => $year, 'class' => $class, 'lang' => $item, 'letter' => $letter, 'sort' => $sort])) . '">' . e($item) . '</a>';
        }, $langs));
        $letterLinks = '<a' . ($letter === '' ? ' class="is-active"' : '') . ' href="' . e(path_for($routeName, ['name' => $name, 'area' => $area, 'year' => $year, 'class' => $class, 'lang' => $lang, 'sort' => $sort])) . '">全部</a>';
        $letterLinks .= implode('', array_map(static function (string $item) use ($routeName, $name, $area, $year, $class, $lang, $letter, $sort): string {
            $active = $item === $letter ? ' class="is-active"' : '';
            return '<a' . $active . ' href="' . e(path_for($routeName, ['name' => $name, 'area' => $area, 'year' => $year, 'class' => $class, 'lang' => $lang, 'letter' => $item, 'sort' => $sort])) . '">' . e($item) . '</a>';
        }, $letters));
        $sortLinks = '<a' . ($sort === 'latest' ? ' class="is-active"' : '') . ' href="' . e(path_for($routeName, ['name' => $name, 'area' => $area, 'year' => $year, 'class' => $class, 'lang' => $lang, 'letter' => $letter, 'sort' => 'latest'])) . '">最新</a>';
        $sortLinks .= '<a' . ($sort === 'hot' ? ' class="is-active"' : '') . ' href="' . e(path_for($routeName, ['name' => $name, 'area' => $area, 'year' => $year, 'class' => $class, 'lang' => $lang, 'letter' => $letter, 'sort' => 'hot'])) . '">最热</a>';
        $sortLinks .= '<a' . ($sort === 'score' ? ' class="is-active"' : '') . ' href="' . e(path_for($routeName, ['name' => $name, 'area' => $area, 'year' => $year, 'class' => $class, 'lang' => $lang, 'letter' => $letter, 'sort' => 'score'])) . '">评分</a>';
        $filter = '<section class="wrap filter-panel category-filter">' . $channelSearch
            . '<div class="filter-row"><strong>类型</strong><div class="filter-options">' . $typeLinks . '</div></div>'
            . '<div class="filter-row"><strong>地区</strong><div class="filter-options">' . $areaLinks . '</div></div>'
            . '<div class="filter-row"><strong>年份</strong><div class="filter-options">' . $yearLinks . '</div></div>'
            . '<div class="filter-row"><strong>语言</strong><div class="filter-options">' . $langLinks . '</div></div>'
            . '<div class="filter-row"><strong>字母</strong><div class="filter-options letter-options">' . $letterLinks . '</div></div>'
            . '<div class="filter-row"><strong>排序</strong><div class="filter-options">' . $sortLinks . '</div></div>'
            . '<div class="filter-actions"><a class="filter-reset" href="' . e(path_for($routeName, $name !== '' ? ['name' => $name] : [])) . '">重置筛选</a></div>'
            . '</section>';
        $pagination = render_pagination($routeName, ['name' => $name, 'area' => $area, 'year' => $year, 'class' => $class, 'lang' => $lang, 'letter' => $letter, 'sort' => $sort], $page, $totalPages);
        $pageTitle = $name !== '' ? $name : $defaultTitle;
        $emptyState = '<div class="content-empty-state" data-empty-state hidden role="status"><strong>暂无符合条件的影片</strong><span>试试清除筛选条件，或浏览其他频道。</span><a href="' . e(path_for($routeName, $name !== '' ? ['name' => $name] : [])) . '">重置筛选</a></div>';
        return render_layout($data, $pageTitle, '<section class="wrap page-title"><span class="eyebrow">分类浏览</span><h1>' . e($pageTitle) . '</h1><p>按' . e(sort_label($sort)) . '排序，共 ' . $totalCount . ' 部内容。</p></section>' . $filter . '<section class="wrap content-section"><div class="vod-grid" data-empty-container data-empty-item=".vod-card">' . render_cards($pagedVideos) . $emptyState . '</div>' . $pagination . '</section>');
    }

    if ($route === 'search') {
        $keyword = trim((string) ($query['wd'] ?? ''));
        $type = trim((string) ($query['type'] ?? ''));
        $class = trim((string) ($query['class'] ?? ''));
        $baseVideos = filter_videos($data, null, $keyword);
        $searchClasses = $type !== ''
            ? array_values(array_unique(array_filter(array_map(static fn (array $video): string => (string) ($video['class'] ?? ''), filter_videos($data, $type)))))
            : [];
        $videos = array_values(array_filter($baseVideos, static function (array $video) use ($type, $class): bool {
            if ($type !== '' && (string) $video['category'] !== $type) {
                return false;
            }

            if ($class !== '' && (string) ($video['class'] ?? '') !== $class) {
                return false;
            }

            return true;
        }));
        $filterLinks = '<a' . ($type === '' ? ' class="is-active"' : '') . ' href="' . e(path_for('search', ['wd' => $keyword])) . '">全部</a>';
        $filterLinks .= implode('', array_map(static function (string $category) use ($keyword, $type): string {
            $active = $category === $type ? ' class="is-active"' : '';
            return '<a' . $active . ' href="' . e(path_for('search', ['wd' => $keyword, 'type' => $category])) . '">' . e($category) . '</a>';
        }, $data['categories']));
        $filter = '<section class="wrap filter-panel category-filter search-filter-panel"><div class="filter-row"><strong>频道</strong><div class="filter-options">' . $filterLinks . '</div></div>';
        if ($type !== '' && $searchClasses !== []) {
            $classFilterLinks = '<a' . ($class === '' ? ' class="is-active"' : '') . ' href="' . e(path_for('search', ['wd' => $keyword, 'type' => $type])) . '">全部</a>';
            $classFilterLinks .= implode('', array_map(static function (string $item) use ($keyword, $type, $class): string {
                $active = $item === $class ? ' class="is-active"' : '';
                return '<a' . $active . ' href="' . e(path_for('search', ['wd' => $keyword, 'type' => $type, 'class' => $item])) . '">' . e($item) . '</a>';
            }, $searchClasses));
            $filter .= '<div class="filter-row"><strong>类型</strong><div class="filter-options">' . $classFilterLinks . '</div></div>';
        }
        $filter .= '</section>';
        $list = implode('', array_map(static function (array $video): string {
            return '<a class="list-item" href="' . e(path_for('detail', ['id' => $video['id']])) . '"><img src="' . e($video['poster']) . '" alt="' . e($video['title']) . '" loading="lazy"><span><strong>' . e($video['title']) . '</strong><small>' . e($video['actor']) . '</small><span class="card-meta"><span>' . e($video['category']) . '</span><span>' . e($video['year']) . '</span><span>' . e($video['score']) . ' 分</span></span><em>' . e($video['summary']) . '</em></span></a>';
        }, $videos));
        $sectionHead = $type !== '' ? '<div class="section-head compact"><h2>' . e($type) . '</h2><span>搜索结果</span></div>' : '';
        $emptyState = '<div class="content-empty-state" data-empty-state hidden role="status"><strong>没有找到相关影片</strong><span>换个关键词或清除频道筛选后再试。</span><a href="' . e(path_for('videos')) . '">浏览影片库</a></div>';
        return render_layout($data, '搜索', '<section class="wrap page-title"><span class="eyebrow">搜索结果</span><h1>' . e($keyword !== '' ? $keyword : '全部内容') . '</h1><p>找到 ' . count($videos) . ' 条相关内容。</p></section>' . $filter . '<section class="wrap content-section">' . $sectionHead . '<div class="vod-list" data-empty-container data-empty-item=".list-item">' . $list . $emptyState . '</div></section>');
    }

    if ($route === 'detail') {
        $video = find_video($data, (int) ($query['id'] ?? 1));
        $episodes = implode('', array_map(static function (array $episode) use ($video): string {
            return '<a href="' . e(path_for('play', ['id' => $video['id'], 'episode' => $episode['no']])) . '">' . e($episode['name']) . '</a>';
        }, $video['episodes']));

        return render_layout($data, $video['title'], '<section class="detail-hero"><span class="detail-backdrop" aria-hidden="true"><img src="' . e($video['poster']) . '" alt=""></span><div class="wrap detail-grid"><div class="detail-poster"><img src="' . e($video['poster']) . '" alt="' . e($video['title']) . '"><span>' . e($video['remark']) . '</span></div><div class="detail-main detail-panel"><span class="eyebrow">' . e($video['category']) . '</span><div class="detail-title-row"><h1>' . e($video['title']) . '</h1><span class="score-badge">' . e($video['score']) . '</span></div><p class="meta">' . e($video['year']) . ' / ' . e($video['area']) . ' / ' . e($video['category']) . '</p><p class="summary">' . e($video['summary']) . '</p><div class="detail-actions"><a class="primary-btn" href="' . e(path_for('play', ['id' => $video['id'], 'episode' => 1])) . '">立即播放</a><a class="ghost-btn" href="' . e(path_for('down', ['id' => $video['id']])) . '">下载</a><a class="ghost-btn" href="' . e(path_for('report', ['id' => $video['id']])) . '">报错</a><a class="ghost-btn" href="' . e(path_for('category', ['name' => $video['category']])) . '">同类影片</a></div></div></div></section><section class="wrap content-section"><div class="episode-box"><div class="section-head compact"><h2>在线播放</h2><span>' . count($video['episodes']) . ' 集</span></div><div class="episode-grid">' . $episodes . '</div></div></section>');
    }

    if ($route === 'copyright') {
        $video = find_video($data, (int) ($query['id'] ?? 1));
        return render_layout($data, '版权提示', '<section class="wrap system-page"><div class="system-box copyright-box"><span class="eyebrow">版权限制</span><h1>当前内容暂不可播放</h1><p>由于版权或地区限制，该内容暂时无法提供播放。你可以返回详情页查看其他信息，或继续浏览片库。</p><div class="detail-actions"><a class="primary-btn" href="' . e(path_for('detail', ['id' => $video['id']])) . '">返回详情</a><a class="ghost-btn" href="' . e(path_for('category')) . '">浏览影片库</a></div></div></section>');
    }

    if ($route === 'down') {
        $video = find_video($data, (int) ($query['id'] ?? 1));
        $downloads = implode('', array_map(static function (array $episode) use ($video): string {
            return '<a href="' . e(path_for('play', ['id' => $video['id'], 'episode' => $episode['no']])) . '"><strong>' . e($episode['name']) . '</strong><span>点击下载</span></a>';
        }, $video['episodes']));

        return render_layout($data, $video['title'] . ' 下载', '<section class="wrap page-title"><span class="eyebrow">下载</span><h1>' . e($video['title']) . '</h1><p>选择下载线路后请按站点提示完成保存。</p></section><section class="wrap content-section"><div class="episode-box download-box"><div class="section-head compact"><h2>本地预览-下载</h2><span>' . count($video['episodes']) . ' 个文件</span></div><div class="download-list">' . $downloads . '</div></div></section>');
    }

    if ($route === 'play') {
        $video = find_video($data, (int) ($query['id'] ?? 1));
        $episodeNo = (int) ($query['episode'] ?? 1);
        $episode = find_episode($video, $episodeNo);

        return render_player_preview($data, $video, $episode, '正在播放');
    }

    if ($route === 'player') {
        $video = find_video($data, (int) ($query['id'] ?? 1));
        $episodeNo = (int) ($query['episode'] ?? 1);
        $episode = find_episode($video, $episodeNo);

        return render_player_preview($data, $video, $episode, '试看播放', true);
    }

    $hot = sort_videos($data['videos'], 'hot');
    $currentYear = date('Y');
    $currentYearVideos = filter_videos($data, null, null, null, $currentYear);
    $currentYearData = $data;
    $currentYearData['videos'] = $currentYearVideos;
    $rankVideos = array_slice(sort_videos($currentYearVideos, 'hot'), 0, 5);
    $rank = implode('', array_map(static function (array $video, int $index): string {
        $meta = $video['year'] . ' · ' . ($video['class'] ?? $video['category']);
        return '<a class="rank-item" href="' . e(path_for('detail', ['id' => $video['id']])) . '" data-rank-item data-rank-title="' . e($video['title']) . '" data-rank-meta="' . e($meta) . '" data-rank-score="' . e($video['score']) . '" data-rank-pic="' . e($video['poster']) . '"><span class="rank-thumb"><img src="' . e($video['poster']) . '" alt="' . e($video['title']) . '" width="112" height="84" loading="lazy" decoding="async" sizes="72px"><span class="rank-index">' . ($index + 1) . '</span></span><span class="rank-body"><strong>' . e($video['title']) . '</strong><em class="rank-meta">' . e($meta) . '</em></span><span class="rank-score">' . e($video['score']) . '</span></a>';
    }, $rankVideos, array_keys($rankVideos)));

    $preferredTabs = ['电影', '剧集', '电视剧', '综艺', '动漫', '纪录', '纪录片', '直播'];
    $homeTabs = [
        ['key' => 'all', 'label' => '推荐', 'videos' => array_slice(sort_videos($currentYearVideos, 'latest'), 0, 6)],
    ];
    $tabIndex = 0;

    foreach ($preferredTabs as $category) {
        if (!in_array($category, $data['categories'], true)) {
            continue;
        }

        $tabIndex += 1;
        $homeTabs[] = [
            'key' => 'category-' . $tabIndex,
            'label' => $category,
            'videos' => array_slice(sort_videos(filter_videos($currentYearData, $category), 'latest'), 0, 6),
        ];
    }

    $tabLinks = '<nav class="home-shelf-tabs" role="tablist" aria-label="最新分类">';
    $tabRails = '';
    foreach ($homeTabs as $index => $tab) {
        $active = $index === 0 ? ' class="is-active"' : '';
        $selected = $index === 0 ? 'true' : 'false';
        $tabIndexValue = $index === 0 ? '0' : '-1';
        $tabLinks .= '<button type="button" data-home-tab="' . e($tab['key']) . '" role="tab" aria-selected="' . $selected . '" aria-controls="latest-panel-' . e($tab['key']) . '" tabindex="' . $tabIndexValue . '"' . $active . '>' . e($tab['label']) . '</button>';
        $tabRails .= render_home_latest_panel($tab['key'], $tab['videos'], $index === 0);
    }
    $tabLinks .= '</nav>';

    $latestShelf = '<section class="wrap home-shelf home-shelf-latest" aria-label="本年最新上线"><div class="home-shelf-head"><span class="shelf-title"><small>NEW THIS YEAR</small><h2>本年最新上线</h2></span>' . $tabLinks . '<a class="home-shelf-more" href="' . e(path_for('category')) . '">全部影片</a></div>' . $tabRails . '</section>';
    $hotUrl = path_for('category', ['sort' => 'hot']);
    $channelCategories = array_slice(array_values(array_filter($preferredTabs, static fn (string $category): bool => in_array($category, $data['categories'], true))), 0, 4);
    $channelCodes = ['FILM', 'SERIES', 'SHOW', 'ANIME'];
    $channelDescriptions = ['银幕精选', '追剧现场', '轻松时刻', '次元放映'];
    $genreDock = '<nav class="wrap genre-dock" aria-label="频道快捷入口"><a class="genre-chip genre-chip-featured" data-channel="TOP" href="' . e($hotUrl) . '"><span>热播榜</span><small>全站热度</small></a>';
    foreach ($channelCategories as $index => $category) {
        $genreDock .= '<a class="genre-chip" data-channel="' . e($channelCodes[$index]) . '" href="' . e(path_for('category', ['name' => $category])) . '"><span>' . e($category) . '</span><small>' . e($channelDescriptions[$index]) . '</small></a>';
    }
    $genreDock .= '<a class="genre-chip" data-channel="NEW" href="' . e(path_for('category')) . '"><span>今日更新</span><small>刚刚上线</small></a></nav>';
    $rankEmptyHidden = $rankVideos === [] ? '' : ' hidden';
    $continueShelf = '<section class="wrap home-shelf home-continue" data-home-continue hidden aria-labelledby="homeContinueTitle"><div class="home-shelf-head"><span class="shelf-title"><small>KEEP WATCHING</small><h2 id="homeContinueTitle">继续观看</h2></span><a class="home-shelf-more" href="' . e(path_for('history')) . '">全部记录</a></div><div class="home-continue-rail" data-home-continue-list aria-live="polite"></div></section>';
    $rankEmpty = '<div class="home-empty-state home-rank-empty" data-home-empty-state' . $rankEmptyHidden . ' role="status"><strong>本年度暂无上榜内容</strong><span>新内容产生热度后会显示在这里。</span><a href="' . e(path_for('category')) . '">浏览全部影片</a></div>';
    $content = '<h1 class="sr-only">' . e($data['siteName']) . '首页</h1><section class="hero" data-home-gsap-src="/template/pingfangvideo/js/gsap.min.js?v=3.15.0"><div class="wrap hero-grid">' . render_hero_carousel($data, $hot) . '<div class="hero-rank" data-rank-react-root data-rank-more-url="' . e($hotUrl) . '"><div class="section-head compact"><span class="rank-heading"><small>TOP 05</small><h2>年度热度榜</h2></span><a class="rank-refresh" href="' . e($hotUrl) . '">查看更多</a></div><div class="rank-list" data-rank-react-list data-home-empty-container data-empty-item=".rank-item">' . $rank . $rankEmpty . '</div></div></div></section>' . $genreDock . $continueShelf . $latestShelf;

    return render_layout($data, '首页', $content);
}
