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
    $nav = '<a href="' . e(path_for('home')) . '">首页</a>';
    $nav .= '<a href="' . e(path_for('categories')) . '">分类</a>';
    $nav .= '<a href="' . e(path_for('games')) . '">游戏</a>';
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
  <link rel="stylesheet" href="/template/pingfangvideo/css/style.css">
</head>
<body>
<header class="site-header">
  <div class="wrap header-inner">
    <a class="brand" href="' . e(path_for('home')) . '" aria-label="' . e($data['siteName']) . '"><img class="brand-logo" src="/template/pingfangvideo/images/site-logo.png" alt="' . e($data['siteName']) . ' logo"></a>
    <button class="nav-toggle" type="button" aria-label="展开导航" aria-expanded="false" aria-controls="mobileDrawer"><span></span><span></span><span></span></button>
    <nav class="site-nav">' . $nav . '</nav>
    <div class="header-search-wrap">
      <form class="header-search" method="get" action="/index.php">
        <input type="hidden" name="route" value="search">
        <input type="search" name="wd" placeholder="搜索影片、演员、导演">
        <button type="submit">搜索</button>
      </form>
    </div>
    <a class="history-link" href="' . e(path_for('history')) . '">观看记录</a>
  </div>
</header>
<div class="mobile-drawer-backdrop" data-mobile-nav-close hidden></div>
<aside class="mobile-drawer" id="mobileDrawer" aria-label="移动端分类菜单" aria-hidden="true">
  <div class="mobile-drawer-head"><strong>分类导航</strong><button class="mobile-drawer-close" type="button" data-mobile-nav-close aria-label="关闭菜单">×</button></div>
  <nav class="mobile-drawer-links" aria-label="移动端快捷导航">
    <a href="' . e(path_for('home')) . '">首页</a>
    <a href="' . e(path_for('categories')) . '">全部分类</a>
    <a href="' . e(path_for('games')) . '">游戏</a>
  </nav>
  <div class="mobile-drawer-section mobile-drawer-account"><span>账号</span><div class="mobile-drawer-user"><a class="mobile-drawer-login" href="' . e(path_for('login')) . '">登录</a></div></div>
  <div class="mobile-drawer-section"><span>影片分类</span><div class="mobile-drawer-cats">' . $drawerCategories . '</div></div>
</aside>
<main>' . $content . '</main>
<footer class="site-footer">
  <div class="wrap footer-grid">
    <div><strong>' . e($data['siteName']) . '</strong><p>PHP 8.4 后端联动预览，可替换为真实数据库或 MacCMS 数据源。</p></div>
    <div class="footer-links"><a href="' . e(path_for('home')) . '">首页</a><a href="' . e(path_for('search')) . '">搜索</a></div>
  </div>
</footer>
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
    $image = $video['backdrop'] ?? $video['poster'];
    $cardClass = $featured ? 'home-shelf-card is-featured' : 'home-shelf-card';
    $badge = $featured ? ($video['category'] ?? '热播') : ($video['remark'] ?? '高清');
    $meta = $featured ? ($video['remark'] ?? '更新中') : ((string) $video['year'] . ' · ' . (string) ($video['class'] ?? $video['category']));

    return '<a class="' . e($cardClass) . '" href="' . e(path_for('detail', ['id' => $video['id']])) . '">
  <span class="home-shelf-poster"><img src="' . e($image) . '" alt="' . e($video['title']) . '" loading="lazy" decoding="async" width="360" height="203" sizes="(max-width: 760px) 76vw, 260px"><em>' . e($badge) . '</em></span>
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

    return '<div class="home-shelf-rail" data-home-tab="' . e($tabKey) . '" id="home-latest-' . e($tabKey) . '" aria-hidden="' . $aria . '"' . $hidden . '>' . $cards . '</div>';
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
    $dots = '';

    foreach ($banners as $index => $video) {
        $active = $index === 0 ? ' is-active' : '';
        $slideNo = $index + 1;
        $backdrop = $video['backdrop'] ?? $video['poster'];
        $duration = $video['duration'] ?? '时长待定';
        $version = $video['version'] ?? ($video['remark'] ?? '高清');
        $slides .= '<article class="hero-slide' . $active . '" data-carousel-slide>
  <span class="banner-bg" style="--banner-bg: url(\'' . e($backdrop) . '\');"></span>
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
        $dots .= '<button class="banner-dot' . $active . '" type="button" data-carousel-dot aria-label="第' . $slideNo . '张"></button>';
    }

    return '<section class="hero-carousel" data-carousel aria-label="首页热播轮播">
  <div class="banner-track">' . $slides . '</div>
  <div class="banner-controls">
    <div class="banner-dots" role="tablist" aria-label="轮播分页">' . $dots . '</div>
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

function render_player_preview(array $data, array $video, array $episode, string $eyebrow): string
{
    return render_layout($data, $video['title'], '<section class="player-page"><div class="wrap"><div class="player-head"><div><span class="eyebrow">' . e($eyebrow) . '</span><h1>' . e($video['title']) . ' - ' . e($episode['name']) . '</h1></div><a class="ghost-btn" href="' . e(path_for('detail', ['id' => $video['id']])) . '">返回详情</a></div><div class="player-toolbar"><span>' . e($video['title']) . ' / ' . e($episode['name']) . '</span><div class="player-toolbar-actions"><a class="ghost-btn" href="' . e(path_for('detail', ['id' => $video['id']])) . '">选集</a></div></div><div class="player-shell"><video controls poster="' . e($video['poster']) . '"><source src="' . e($episode['src']) . '" type="video/mp4"></video></div></div></section>');
}

function render_page(array $data, string $route, array $query): string
{
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

        return render_layout($data, '分类', '<section class="wrap page-title"><span class="eyebrow">分类</span><h1>全部分类</h1><p>从这里进入电影、剧集、综艺、动漫和更多频道。</p></section><section class="wrap category-index">' . $tiles . '</section>' . render_pagination('categories', [], $page, $totalPages));
    }

    if ($route === 'games') {
        return render_layout($data, '游戏', '<section class="wrap system-page"><div class="system-box module-fallback"><span class="eyebrow">游戏</span><h1>游戏入口维护中</h1><p>游戏模块暂未启用，请先浏览影片内容。</p><div class="detail-actions"><a class="primary-btn" href="' . e(path_for('categories')) . '">浏览影片库</a><a class="ghost-btn" href="' . e(path_for('home')) . '">返回首页</a></div></div></section>');
    }

    if ($route === 'category') {
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
        $channelSearch = '<div class="filter-row filter-search-row"><strong>搜索</strong><form class="channel-search" method="get" action="/index.php"><input type="hidden" name="route" value="search"><input type="hidden" name="type" value="' . e($name) . '"><input type="search" name="wd" placeholder="在' . e($channelTitle) . '中搜索"><button type="submit">搜索</button></form></div>';
        $filter = '<section class="wrap filter-panel category-filter">' . $channelSearch
            . '<div><strong>类型</strong><a href="' . e(path_for('category', ['area' => $area, 'year' => $year, 'class' => $class, 'lang' => $lang, 'letter' => $letter, 'sort' => $sort])) . '">全部</a>'
            . implode('', array_map(static fn (string $category): string => '<a href="' . e(path_for('category', ['name' => $category, 'area' => $area, 'year' => $year, 'class' => $class, 'lang' => $lang, 'letter' => $letter, 'sort' => $sort])) . '">' . e($category) . '</a>', $data['categories'])) . '</div>'
            . '<div><strong>地区</strong><a href="' . e(path_for('category', ['name' => $name, 'year' => $year, 'class' => $class, 'lang' => $lang, 'letter' => $letter, 'sort' => $sort])) . '">全部</a>'
            . implode('', array_map(static fn (string $item): string => '<a href="' . e(path_for('category', ['name' => $name, 'area' => $item, 'year' => $year, 'class' => $class, 'lang' => $lang, 'letter' => $letter, 'sort' => $sort])) . '">' . e($item) . '</a>', $areas)) . '</div>'
            . '<div><strong>年份</strong><a href="' . e(path_for('category', ['name' => $name, 'area' => $area, 'class' => $class, 'lang' => $lang, 'letter' => $letter, 'sort' => $sort])) . '">全部</a>'
            . implode('', array_map(static fn (string $item): string => '<a href="' . e(path_for('category', ['name' => $name, 'area' => $area, 'year' => $item, 'class' => $class, 'lang' => $lang, 'letter' => $letter, 'sort' => $sort])) . '">' . e($item) . '</a>', $years)) . '</div>'
            . '<div><strong>语言</strong><a href="' . e(path_for('category', ['name' => $name, 'area' => $area, 'year' => $year, 'class' => $class, 'letter' => $letter, 'sort' => $sort])) . '">全部</a>'
            . implode('', array_map(static fn (string $item): string => '<a href="' . e(path_for('category', ['name' => $name, 'area' => $area, 'year' => $year, 'class' => $class, 'lang' => $item, 'letter' => $letter, 'sort' => $sort])) . '">' . e($item) . '</a>', $langs)) . '</div>'
            . '<div><strong>字母</strong><a href="' . e(path_for('category', ['name' => $name, 'area' => $area, 'year' => $year, 'class' => $class, 'lang' => $lang, 'sort' => $sort])) . '">全部</a>'
            . implode('', array_map(static fn (string $item): string => '<a href="' . e(path_for('category', ['name' => $name, 'area' => $area, 'year' => $year, 'class' => $class, 'lang' => $lang, 'letter' => $item, 'sort' => $sort])) . '">' . e($item) . '</a>', $letters)) . '</div>'
            . '<div><strong>排序</strong><a href="' . e(path_for('category', ['name' => $name, 'area' => $area, 'year' => $year, 'class' => $class, 'lang' => $lang, 'letter' => $letter, 'sort' => 'latest'])) . '">最新</a><a href="' . e(path_for('category', ['name' => $name, 'area' => $area, 'year' => $year, 'class' => $class, 'lang' => $lang, 'letter' => $letter, 'sort' => 'hot'])) . '">最热</a><a href="' . e(path_for('category', ['name' => $name, 'area' => $area, 'year' => $year, 'class' => $class, 'lang' => $lang, 'letter' => $letter, 'sort' => 'score'])) . '">评分</a></div>'
            . '<div class="filter-actions"><a class="filter-reset" href="' . e(path_for('category', $name !== '' ? ['name' => $name] : [])) . '">重置筛选</a></div>'
            . '</section>';
        $pagination = render_pagination('category', ['name' => $name, 'area' => $area, 'year' => $year, 'class' => $class, 'lang' => $lang, 'letter' => $letter, 'sort' => $sort], $page, $totalPages);
        return render_layout($data, $name !== '' ? $name : '全部影片', '<section class="wrap page-title"><span class="eyebrow">分类浏览</span><h1>' . e($name !== '' ? $name : '全部影片') . '</h1><p>按' . e(sort_label($sort)) . '排序，共 ' . $totalCount . ' 部内容。</p></section>' . $filter . '<section class="wrap content-section"><div class="vod-grid">' . render_cards($pagedVideos) . '</div>' . $pagination . '</section>');
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
        return render_layout($data, '搜索', '<section class="wrap page-title"><span class="eyebrow">搜索结果</span><h1>' . e($keyword !== '' ? $keyword : '全部内容') . '</h1><p>找到 ' . count($videos) . ' 条相关内容。</p></section>' . $filter . '<section class="wrap content-section">' . $sectionHead . '<div class="vod-list">' . $list . '</div></section>');
    }

    if ($route === 'detail') {
        $video = find_video($data, (int) ($query['id'] ?? 1));
        $episodes = implode('', array_map(static function (array $episode) use ($video): string {
            return '<a href="' . e(path_for('play', ['id' => $video['id'], 'episode' => $episode['no']])) . '">' . e($episode['name']) . '</a>';
        }, $video['episodes']));

        return render_layout($data, $video['title'], '<section class="detail-hero"><div class="wrap detail-grid"><div class="detail-poster"><img src="' . e($video['poster']) . '" alt="' . e($video['title']) . '"><span>' . e($video['remark']) . '</span></div><div class="detail-main detail-panel"><span class="eyebrow">' . e($video['category']) . '</span><div class="detail-title-row"><h1>' . e($video['title']) . '</h1><span class="score-badge">' . e($video['score']) . '</span></div><p class="meta">' . e($video['year']) . ' / ' . e($video['area']) . ' / ' . e($video['category']) . '</p><p class="summary">' . e($video['summary']) . '</p><div class="detail-actions"><a class="primary-btn" href="' . e(path_for('play', ['id' => $video['id'], 'episode' => 1])) . '">立即播放</a><a class="ghost-btn" href="' . e(path_for('down', ['id' => $video['id']])) . '">下载</a><a class="ghost-btn" href="' . e(path_for('report', ['id' => $video['id']])) . '">报错</a><a class="ghost-btn" href="' . e(path_for('category', ['name' => $video['category']])) . '">同类影片</a></div></div></div></section><section class="wrap content-section"><div class="episode-box"><div class="section-head compact"><h2>在线播放</h2><span>' . count($video['episodes']) . ' 集</span></div><div class="episode-grid">' . $episodes . '</div></div></section>');
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

        return render_player_preview($data, $video, $episode, '试看播放');
    }

    $hot = sort_videos($data['videos'], 'hot');
    $rankVideos = array_slice($hot, 0, 5);
    $rank = implode('', array_map(static function (array $video, int $index): string {
        return '<a class="rank-item" href="' . e(path_for('detail', ['id' => $video['id']])) . '"><span class="rank-thumb"><img src="' . e($video['poster']) . '" alt="' . e($video['title']) . '" width="112" height="84" loading="lazy" decoding="async" sizes="72px"><span class="rank-index">' . ($index + 1) . '</span></span><span class="rank-body"><strong>' . e($video['title']) . '</strong><em class="rank-meta">' . e($video['year']) . ' · ' . e($video['class'] ?? $video['category']) . '</em></span><span class="rank-score">' . e($video['score']) . '</span></a>';
    }, $rankVideos, array_keys($rankVideos)));

    $preferredTabs = ['电影', '剧集', '电视剧', '综艺', '动漫', '纪录', '纪录片', '直播'];
    $homeTabs = [
        ['key' => 'all', 'label' => '推荐', 'videos' => array_slice(sort_videos($data['videos'], 'latest'), 0, 6)],
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
            'videos' => array_slice(sort_videos(filter_videos($data, $category), 'latest'), 0, 6),
        ];
    }

    $tabLinks = '<nav class="home-shelf-tabs" aria-label="最新分类">';
    $tabRails = '';
    foreach ($homeTabs as $index => $tab) {
        $active = $index === 0 ? ' class="is-active"' : '';
        $tabLinks .= '<a href="#home-latest-' . e($tab['key']) . '" data-home-tab="' . e($tab['key']) . '"' . $active . '>' . e($tab['label']) . '</a>';
        $tabRails .= render_home_latest_panel($tab['key'], $tab['videos'], $index === 0);
    }
    $tabLinks .= '</nav>';

    $latestShelf = '<section class="wrap home-shelf home-shelf-latest"><div class="home-shelf-head"><h2>最新上线</h2>' . $tabLinks . '<a class="home-shelf-more" href="' . e(path_for('category')) . '">全部影片</a></div>' . $tabRails . '</section>';
    $content = '<section class="hero"><div class="wrap hero-grid">' . render_hero_carousel($data, $hot) . '<div class="hero-rank"><div class="section-head compact"><h2>热搜榜</h2><a class="rank-refresh" href="' . e(path_for('category', ['sort' => 'hot'])) . '">换一换</a></div>' . $rank . '</div></div></section>' . $latestShelf;

    return render_layout($data, '首页', $content);
}
