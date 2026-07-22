<?php
declare(strict_types=1);

require_once __DIR__ . '/lib/data.php';

const REACT_API_SOURCE_ID = '1';
const REACT_API_SESSION_KEY = 'pingfang_react_preview';

function react_api_response(int $status, int $code, string $message, mixed $data, string $cacheControl = 'private, no-store'): array
{
    return [
        'status' => $status,
        'headers' => [
            'Content-Type' => 'application/json; charset=utf-8',
            'Cache-Control' => $cacheControl,
            'X-Content-Type-Options' => 'nosniff',
        ],
        'body' => [
            'code' => $code,
            'msg' => $message,
            'data' => $data,
        ],
    ];
}

function react_api_success(mixed $data, string $message = '操作成功', int $status = 200, bool $public = false): array
{
    $cacheControl = $public ? 'public, max-age=30, stale-while-revalidate=60' : 'private, no-store';

    return react_api_response($status, 1, $message, $data, $cacheControl);
}

function react_api_error(int $status, string $message): array
{
    return react_api_response($status, $status, $message, null);
}

function react_api_now(): string
{
    return gmdate(DATE_ATOM);
}

function react_api_initialize_session(array &$session): void
{
    if (!isset($session[REACT_API_SESSION_KEY]) || !is_array($session[REACT_API_SESSION_KEY])) {
        $session[REACT_API_SESSION_KEY] = [];
    }

    $state =& $session[REACT_API_SESSION_KEY];
    if (!isset($state['csrfToken']) || !is_string($state['csrfToken']) || $state['csrfToken'] === '') {
        $state['csrfToken'] = bin2hex(random_bytes(32));
    }
    if (!array_key_exists('user', $state)) {
        $state['user'] = null;
    }

    foreach (['favorites', 'history', 'devices', 'feedback', 'reports', 'comments', 'reactions', 'ratings'] as $key) {
        if (!isset($state[$key]) || !is_array($state[$key])) {
            $state[$key] = [];
        }
    }
}

function react_api_category_id(string $name): string
{
    static $knownIds = [
        '电影' => '42',
        '剧集' => '47',
        '综艺' => '48',
        '动漫' => '57',
        '纪录' => '111',
    ];

    return $knownIds[$name] ?? 'local-' . substr(hash('sha256', $name), 0, 12);
}

function react_api_episode_id(array $video, array $episode): string
{
    return (string) (((int) ($video['id'] ?? 0) * 100) + (int) ($episode['no'] ?? 0));
}

function react_api_home_video(array $video): array
{
    return [
        'id' => (string) $video['id'],
        'title' => (string) $video['title'],
        'category' => (string) $video['category'],
        'remark' => (string) ($video['remark'] ?? ''),
        'year' => (string) ($video['year'] ?? ''),
        'class' => (string) ($video['class'] ?? ''),
        'hits' => (int) ($video['hits'] ?? 0),
        'score' => (float) ($video['score'] ?? 0),
        'updated' => (string) ($video['updated'] ?? ''),
        'poster' => (string) ($video['poster'] ?? ''),
        'backdrop' => (string) ($video['backdrop'] ?? ''),
        'duration' => (string) ($video['duration'] ?? ''),
        'version' => (string) ($video['version'] ?? ''),
        'summary' => (string) ($video['summary'] ?? ''),
        'episodes' => array_values(array_map(static fn (array $episode): array => [
            'id' => react_api_episode_id($video, $episode),
            'no' => (int) $episode['no'],
            'name' => (string) $episode['name'],
            'sourceId' => REACT_API_SOURCE_ID,
        ], array_slice($video['episodes'] ?? [], 0, 1))),
    ];
}

function react_api_content_episodes(array $video): array
{
    return array_values(array_map(static fn (array $episode): array => [
        'id' => react_api_episode_id($video, $episode),
        'no' => (int) $episode['no'],
        'name' => (string) $episode['name'],
        'sourceId' => REACT_API_SOURCE_ID,
    ], $video['episodes'] ?? []));
}

function react_api_play_sources(array $video): array
{
    $episodes = react_api_content_episodes($video);
    if ($episodes === []) {
        return [];
    }

    return [[
        'id' => REACT_API_SOURCE_ID,
        'name' => '默认线路',
        'tip' => '本地验收线路',
        'episodes' => $episodes,
    ]];
}

function react_api_content_video(array $video): array
{
    $typeName = (string) $video['category'];

    return [
        'id' => (string) $video['id'],
        'typeId' => react_api_category_id($typeName),
        'typeName' => $typeName,
        'title' => (string) $video['title'],
        'remark' => (string) ($video['remark'] ?? ''),
        'actor' => (string) ($video['actor'] ?? ''),
        'director' => (string) ($video['director'] ?? ''),
        'year' => (string) ($video['year'] ?? ''),
        'area' => (string) ($video['area'] ?? ''),
        'class' => (string) ($video['class'] ?? ''),
        'lang' => (string) ($video['lang'] ?? ''),
        'letter' => (string) ($video['letter'] ?? ''),
        'hits' => (int) ($video['hits'] ?? 0),
        'score' => (float) ($video['score'] ?? 0),
        'updated' => (string) ($video['updated'] ?? ''),
        'poster' => (string) ($video['poster'] ?? ''),
        'backdrop' => (string) ($video['backdrop'] ?? ''),
        'duration' => (string) ($video['duration'] ?? ''),
        'version' => (string) ($video['version'] ?? ''),
        'summary' => (string) ($video['summary'] ?? ''),
        'episodes' => react_api_content_episodes($video),
    ];
}

function react_api_home_data(array $catalog): array
{
    return [
        'siteName' => (string) ($catalog['siteName'] ?? ''),
        'todayUpdated' => (int) ($catalog['todayUpdated'] ?? 0),
        'hotSearch' => array_values(array_map('strval', $catalog['hotSearch'] ?? [])),
        'categories' => array_values(array_map(static fn (string $name): array => [
            'id' => react_api_category_id($name),
            'name' => $name,
        ], array_map('strval', $catalog['categories'] ?? []))),
        'videos' => array_values(array_map('react_api_home_video', $catalog['videos'] ?? [])),
    ];
}

function react_api_home_card(array $video): array
{
    return [
        'id' => (string) $video['id'],
        'title' => (string) $video['title'],
        'remark' => (string) ($video['remark'] ?? '已收录'),
        'year' => (string) ($video['year'] ?? '未知'),
        'class' => (string) ($video['class'] ?? '其他'),
        'score' => (float) ($video['score'] ?? 0),
        'poster' => (string) ($video['poster'] ?? ''),
    ];
}

function react_api_content_card(array $video, bool $search = false): array
{
    $card = react_api_home_card($video);
    if ($search) {
        $card['typeName'] = (string) ($video['category'] ?? '其他');
        $card['actor'] = (string) ($video['actor'] ?? '');
        $card['summary'] = (string) ($video['summary'] ?? '');
    }
    return $card;
}

function react_api_home_hero(array $video): array
{
    $homeVideo = react_api_home_video($video);

    return [
        'id' => $homeVideo['id'],
        'title' => $homeVideo['title'],
        'year' => $homeVideo['year'],
        'class' => $homeVideo['class'],
        'backdrop' => $homeVideo['backdrop'],
        'duration' => $homeVideo['duration'],
        'version' => $homeVideo['version'],
        'summary' => $homeVideo['summary'],
        'episodes' => $homeVideo['episodes'],
    ];
}

function react_api_navigation_data(array $catalog): array
{
    $home = react_api_home_data($catalog);

    return [
        'siteName' => $home['siteName'],
        'categories' => $home['categories'],
    ];
}

function react_api_home_v2_data(array $catalog, bool $compact = false): array
{
    $videos = array_values($catalog['videos'] ?? []);
    $byHits = $videos;
    usort($byHits, static fn (array $left, array $right): int => ((int) ($right['hits'] ?? 0) <=> (int) ($left['hits'] ?? 0)));
    $byLatest = $videos;
    usort($byLatest, static fn (array $left, array $right): int => strcmp((string) ($right['updated'] ?? ''), (string) ($left['updated'] ?? '')));
    $years = array_values(array_filter(array_map(static fn (array $video): string => (string) ($video['year'] ?? ''), $videos)));
    rsort($years, SORT_STRING);
    $year = $years[0] ?? date('Y');
    $yearlyByHits = array_values(array_filter($byHits, static fn (array $video): bool => (string) ($video['year'] ?? '') === $year));
    $yearlyByLatest = array_values(array_filter($byLatest, static fn (array $video): bool => (string) ($video['year'] ?? '') === $year));
    $navigation = react_api_navigation_data($catalog);

    $hero = [];
    foreach ($byHits as $video) {
        $item = react_api_home_hero($video);
        if ($item['episodes'] !== []) {
            $hero[] = $item;
        }
        if (count($hero) >= 5) {
            break;
        }
    }

    $latestByCategory = [];
    foreach ($navigation['categories'] as $category) {
        $name = (string) $category['name'];
        $categoryVideos = array_values(array_filter(
            $yearlyByLatest,
            static fn (array $video): bool => (string) ($video['category'] ?? '') === $name
        ));
        $latestByCategory[] = [
            'categoryId' => (string) $category['id'],
            'videos' => array_values(array_map('react_api_home_card', array_slice($categoryVideos, 0, 6))),
        ];
    }

    $home = [
        'siteName' => $navigation['siteName'],
        'todayUpdated' => (int) ($catalog['todayUpdated'] ?? 0),
        'categories' => $navigation['categories'],
        'hero' => $hero,
        'ranking' => array_values(array_map('react_api_home_card', array_slice($yearlyByHits, 0, 5))),
        'latest' => array_values(array_map('react_api_home_card', array_slice($yearlyByLatest, 0, 6))),
        'latestByCategory' => $latestByCategory,
    ];
    if (!$compact) {
        $home = array_slice($home, 0, 2, true)
            + ['hotSearch' => array_values(array_map('strval', $catalog['hotSearch'] ?? []))]
            + array_slice($home, 2, null, true);
    } else {
        foreach ($home['hero'] as &$hero) {
            $hero['episodes'] = array_values(array_map(static fn (array $episode): array => [
                'id' => (string) $episode['id'],
                'sourceId' => (string) $episode['sourceId'],
            ], $hero['episodes']));
        }
        unset($hero);
    }
    return $home;
}

function react_api_content_categories(array $catalog, bool $includeTotals = true): array
{
    $totals = [];
    foreach ($catalog['videos'] ?? [] as $video) {
        $name = (string) ($video['category'] ?? '');
        if ($name !== '') {
            $totals[$name] = ($totals[$name] ?? 0) + 1;
        }
    }

    $categories = [];
    foreach (array_map('strval', $catalog['categories'] ?? []) as $name) {
        $category = [
            'id' => react_api_category_id($name),
            'name' => $name,
        ];
        if ($includeTotals) {
            $category['total'] = (int) ($totals[$name] ?? 0);
        }
        $categories[] = $category;
    }
    return $categories;
}

function react_api_content_data(array $catalog, array $query = []): array
{
    $compact = (string) ($query['compact'] ?? '0') === '1';
    $includeCategoryTotals = !$compact || (string) ($query['include_category_totals'] ?? '0') === '1';
    $includeFacets = !$compact || (string) ($query['include_facets'] ?? '0') === '1';
    $typeId = trim((string) ($query['type_id'] ?? ''));
    $keywordProvided = array_key_exists('keyword', $query);
    $keyword = trim((string) ($query['keyword'] ?? ''));
    $videos = array_values(array_filter($catalog['videos'] ?? [], static function (array $video) use ($query, $typeId, $keyword, $keywordProvided): bool {
        if ($typeId !== '' && react_api_category_id((string) ($video['category'] ?? '')) !== $typeId) {
            return false;
        }
        foreach (['area', 'year', 'lang', 'letter'] as $field) {
            $expected = trim((string) ($query[$field] ?? ''));
            $actual = trim((string) ($video[$field] ?? ''));
            if ($field === 'letter' && $expected === '0~9') {
                if (!preg_match('/^[0-9]/', $actual)) {
                    return false;
                }
            } elseif ($expected !== '' && strcasecmp($actual, $expected) !== 0) {
                return false;
            }
        }
        $class = trim((string) ($query['class'] ?? ''));
        if ($class !== '' && strpos((string) ($video['class'] ?? ''), $class) === false) {
            return false;
        }
        if ($keywordProvided) {
            if ($keyword === '') {
                return false;
            }
            $matches = false;
            foreach (['title', 'actor', 'director'] as $field) {
                if (stripos((string) ($video[$field] ?? ''), $keyword) === 0) {
                    $matches = true;
                    break;
                }
            }
            if (!$matches) {
                return false;
            }
        }
        return true;
    }));

    $sort = (string) ($query['sort'] ?? 'latest');
    usort($videos, static function (array $left, array $right) use ($sort): int {
        if ($sort === 'hot') {
            return ((int) ($right['hits'] ?? 0) <=> (int) ($left['hits'] ?? 0)) ?: ((int) ($right['id'] ?? 0) <=> (int) ($left['id'] ?? 0));
        }
        if ($sort === 'score') {
            return ((float) ($right['score'] ?? 0) <=> (float) ($left['score'] ?? 0))
                ?: ((int) ($right['hits'] ?? 0) <=> (int) ($left['hits'] ?? 0))
                ?: ((int) ($right['id'] ?? 0) <=> (int) ($left['id'] ?? 0));
        }
        return strcmp((string) ($right['updated'] ?? ''), (string) ($left['updated'] ?? ''))
            ?: ((int) ($right['id'] ?? 0) <=> (int) ($left['id'] ?? 0));
    });

    $pageSize = max(1, min(100, (int) ($query['page_size'] ?? 24)));
    $requestedPage = max(1, (int) ($query['page'] ?? 1));
    $total = count($videos);
    $totalPages = $total > 0 ? (int) ceil($total / $pageSize) : 0;
    $page = min($requestedPage, max(1, $totalPages));
    $pageVideos = array_slice($videos, ($page - 1) * $pageSize, $pageSize);

    $facets = [
        'areas' => [],
        'years' => [],
        'langs' => [],
        'classes' => [],
    ];
    if ($includeFacets) {
        foreach ($videos as $video) {
            foreach (['area' => 'areas', 'year' => 'years', 'lang' => 'langs', 'class' => 'classes'] as $field => $facet) {
                $value = trim((string) ($video[$field] ?? ''));
                if ($value !== '') {
                    $facets[$facet][$value] = $value;
                }
            }
        }
        foreach ($facets as &$values) {
            $values = array_values($values);
            sort($values, SORT_NATURAL);
        }
        unset($values);
    }

    $categories = react_api_content_categories($catalog, $includeCategoryTotals);
    $currentCategory = null;
    if ($typeId !== '') {
        foreach ($categories as $category) {
            if ((string) $category['id'] === $typeId) {
                $currentCategory = $category;
                break;
            }
        }
    }

    $content = [
        'siteName' => (string) ($catalog['siteName'] ?? ''),
        'categories' => $categories,
        'categoryContext' => [
            'current' => $currentCategory,
            'parent' => null,
            'children' => [],
        ],
        'facets' => $facets,
        'videos' => array_values(array_map(
            $compact
                ? static fn (array $video): array => react_api_content_card($video, $keywordProvided)
                : 'react_api_content_video',
            $pageVideos
        )),
        'total' => $total,
        'page' => $page,
        'totalPages' => $totalPages,
    ];
    if (!$compact) {
        $years = array_map(static fn (array $video): string => (string) ($video['year'] ?? ''), $catalog['videos'] ?? []);
        rsort($years, SORT_STRING);
        $content = array_slice($content, 0, 1, true)
            + [
                'todayUpdated' => (int) ($catalog['todayUpdated'] ?? 0),
                'contentYear' => $years[0] ?? '',
                'hotSearch' => array_values(array_map('strval', $catalog['hotSearch'] ?? [])),
            ]
            + array_slice($content, 1, 5, true)
            + ['pageSize' => $pageSize]
            + array_slice($content, 6, null, true);
    }
    return $content;
}

function react_api_detail_data(array $catalog, string $vodId, bool $compact = false): ?array
{
    $video = react_api_find_video($catalog, $vodId);
    if ($video === null) {
        return null;
    }
    $related = [];
    foreach ($catalog['videos'] ?? [] as $candidate) {
        if ((string) ($candidate['id'] ?? '') === $vodId || (string) ($candidate['category'] ?? '') !== (string) ($video['category'] ?? '')) {
            continue;
        }
        $related[] = $compact ? react_api_content_card($candidate) : react_api_content_video($candidate);
        if (count($related) >= 6) {
            break;
        }
    }

    $detailVideo = react_api_content_video($video);
    $detailVideo['playSources'] = react_api_play_sources($video);
    $detailVideo['scoreCount'] = max(0, (int) ($video['scoreCount'] ?? 0));
    $detailVideo['likes'] = max(0, (int) ($video['likes'] ?? 0));
    $detailVideo['dislikes'] = max(0, (int) ($video['dislikes'] ?? 0));
    if ($compact) {
        unset($detailVideo['typeId'], $detailVideo['letter'], $detailVideo['version']);
    }
    return [
        'siteName' => (string) ($catalog['siteName'] ?? ''),
        'video' => $detailVideo,
        'related' => $related,
    ];
}

function react_api_find_video(array $catalog, string $vodId): ?array
{
    foreach ($catalog['videos'] ?? [] as $video) {
        if ((string) ($video['id'] ?? '') === $vodId) {
            return $video;
        }
    }

    return null;
}

function react_api_find_episode(array $video, string $sourceId, string $episodeId): ?array
{
    if ($sourceId !== REACT_API_SOURCE_ID) {
        return null;
    }

    foreach ($video['episodes'] ?? [] as $episode) {
        if (react_api_episode_id($video, $episode) === $episodeId) {
            return $episode;
        }
    }

    return null;
}

function react_api_mime_type(string $url): string
{
    $extension = strtolower(pathinfo((string) parse_url($url, PHP_URL_PATH), PATHINFO_EXTENSION));

    return match ($extension) {
        'm3u8' => 'application/vnd.apple.mpegurl',
        'webm' => 'video/webm',
        'ogg', 'ogv' => 'video/ogg',
        default => 'video/mp4',
    };
}

function react_api_playback(array $catalog, array $query): array
{
    $vodId = react_api_identifier_value($query['vod_id'] ?? null);
    $sourceId = react_api_identifier_value($query['source_id'] ?? null);
    $episodeId = react_api_identifier_value($query['episode_id'] ?? null);
    if ($vodId === null || $sourceId === null || $episodeId === null) {
        return react_api_error(400, '缺少播放资源参数');
    }

    $video = react_api_find_video($catalog, $vodId);
    $episode = $video === null ? null : react_api_find_episode($video, $sourceId, $episodeId);
    if ($video === null || $episode === null) {
        return react_api_error(404, '播放资源不存在');
    }

    $url = (string) ($episode['src'] ?? '');
    $scheme = strtolower((string) parse_url($url, PHP_URL_SCHEME));
    if (filter_var($url, FILTER_VALIDATE_URL) === false || !in_array($scheme, ['http', 'https'], true)) {
        return react_api_error(503, '播放资源暂不可用');
    }

    return react_api_success([
        'siteName' => (string) ($catalog['siteName'] ?? ''),
        'vodId' => $vodId,
        'sourceId' => $sourceId,
        'episodeId' => $episodeId,
        'title' => (string) $video['title'],
        'episodeName' => (string) $episode['name'],
        'poster' => (string) ($video['poster'] ?? ''),
        'playSources' => react_api_play_sources($video),
        'kind' => 'video',
        'url' => $url,
        'mimeType' => react_api_mime_type($url),
    ], '播放信息加载成功');
}

function react_api_session_data(array $state): array
{
    return [
        'authenticated' => is_array($state['user']),
        'csrfToken' => (string) $state['csrfToken'],
        'user' => is_array($state['user']) ? $state['user'] : null,
        'requirements' => [
            'loginCaptcha' => false,
            'feedbackCaptcha' => false,
            'feedbackLogin' => false,
            'feedbackEnabled' => true,
            'feedbackAudit' => false,
            'commentCaptcha' => false,
            'commentLogin' => false,
            'commentEnabled' => true,
            'commentAudit' => false,
            'captchaUrl' => null,
        ],
    ];
}

function react_api_header(array $headers, string $name): string
{
    foreach ($headers as $key => $value) {
        if (strcasecmp((string) $key, $name) === 0) {
            return trim((string) $value);
        }
    }

    return '';
}

function react_api_valid_csrf(array $state, array $body, array $headers): bool
{
    $provided = react_api_header($headers, 'X-CSRF-Token');
    if ($provided === '') {
        $bodyToken = $body['csrfToken'] ?? $body['csrf_token'] ?? null;
        $provided = is_string($bodyToken) ? trim($bodyToken) : '';
    }

    return $provided !== '' && hash_equals((string) $state['csrfToken'], $provided);
}

function react_api_input(array $body, string ...$names): mixed
{
    foreach ($names as $name) {
        if (array_key_exists($name, $body)) {
            return $body[$name];
        }
    }

    return null;
}

function react_api_text(array $body, array $names, int $maxLength): ?string
{
    $value = react_api_input($body, ...$names);
    if (!is_string($value)) {
        return null;
    }

    $value = trim($value);
    if ($value === '' || mb_strlen($value) > $maxLength) {
        return null;
    }

    return $value;
}

function react_api_identifier_value(mixed $value, int $maxLength = 128): ?string
{
    if (is_int($value)) {
        $value = (string) $value;
    }
    if (!is_string($value)) {
        return null;
    }

    $value = trim($value);
    if ($value === '' || mb_strlen($value) > $maxLength || preg_match('/\A[A-Za-z0-9][A-Za-z0-9_.:-]*\z/', $value) !== 1) {
        return null;
    }

    return $value;
}

function react_api_identifier(array $body, array $names, int $maxLength = 128): ?string
{
    return react_api_identifier_value(react_api_input($body, ...$names), $maxLength);
}

function react_api_optional_text(array $body, array $names, int $maxLength): ?string
{
    $value = react_api_input($body, ...$names);
    if ($value === null) {
        return '';
    }
    if (!is_string($value)) {
        return null;
    }

    $value = trim($value);
    return mb_strlen($value) <= $maxLength ? $value : null;
}

function react_api_number(mixed $value): ?float
{
    if (is_bool($value) || (!is_int($value) && !is_float($value) && !is_string($value))) {
        return null;
    }
    if (is_string($value) && (trim($value) === '' || mb_strlen($value) > 64 || !is_numeric($value))) {
        return null;
    }

    $number = (float) $value;
    return is_finite($number) ? $number : null;
}

function react_api_video_card(array $video): array
{
    return [
        'recordIds' => [(string) $video['id']],
        'vodId' => (string) $video['id'],
        'title' => (string) $video['title'],
        'poster' => (string) ($video['poster'] ?? ''),
        'remark' => (string) ($video['remark'] ?? ''),
    ];
}

function react_api_devices(): array
{
    $now = react_api_now();

    return [
        'local-current' => [
            'sessionId' => 'local-current',
            'name' => '本机浏览器',
            'browser' => 'Local Preview',
            'os' => PHP_OS_FAMILY,
            'loginAt' => $now,
            'lastActiveAt' => $now,
            'ipAddress' => '127.0.0.1',
            'userAgent' => 'Local Preview',
            'status' => 'active',
            'revokedAt' => null,
            'current' => true,
        ],
        'local-secondary' => [
            'sessionId' => 'local-secondary',
            'name' => '演示备用设备',
            'browser' => 'Local Preview',
            'os' => 'Demo',
            'loginAt' => $now,
            'lastActiveAt' => $now,
            'ipAddress' => '127.0.0.1',
            'userAgent' => 'Local Preview',
            'status' => 'active',
            'revokedAt' => null,
            'current' => false,
        ],
    ];
}

function react_api_require_user(array $state): ?array
{
    return is_array($state['user']) ? null : react_api_error(401, '请先登录');
}

function react_api_account(array $state): array
{
    return [
        'user' => $state['user'],
        'counts' => [
            'favorites' => count($state['favorites']),
            'history' => count($state['history']),
            'devices' => count($state['devices']),
            'feedback' => count($state['feedback']),
            'reports' => count($state['reports']),
            'comments' => count($state['comments']),
        ],
    ];
}

function react_api_clear_account_state(array &$state): void
{
    foreach (['favorites', 'history', 'devices', 'reactions', 'ratings'] as $key) {
        $state[$key] = [];
    }
}

function react_api_login(array &$state, array $body): array
{
    $username = react_api_text($body, ['username', 'user_name'], 100);
    $password = react_api_text($body, ['password', 'user_pwd'], 200);
    if ($username === null || $password === null) {
        return react_api_error(422, '用户名和密码不能为空');
    }
    if (!hash_equals('demo', $username) || !hash_equals('demo123', $password)) {
        return react_api_error(401, '用户名或密码错误');
    }

    $state['user'] = [
        'id' => 'demo',
        'name' => '本地演示用户',
        'avatar' => '',
    ];
    if ($state['devices'] === []) {
        $state['devices'] = react_api_devices();
    }

    return react_api_success(react_api_session_data($state), '登录成功');
}

function react_api_favorite(array &$state, array $catalog, array $body): array
{
    $vodId = react_api_identifier($body, ['vodId', 'vod_id']);
    $favorite = react_api_input($body, 'favorite');
    if ($vodId === null || !is_bool($favorite)) {
        return react_api_error(422, '收藏参数不正确');
    }

    $video = react_api_find_video($catalog, $vodId);
    if ($video === null) {
        return react_api_error(404, '影片不存在');
    }

    $exists = isset($state['favorites'][$vodId]);
    if ($favorite === $exists) {
        return react_api_error(409, $favorite ? '影片已收藏' : '影片未收藏');
    }

    if ($favorite) {
        $state['favorites'][$vodId] = react_api_video_card($video) + ['createdAt' => react_api_now()];
    } else {
        unset($state['favorites'][$vodId]);
    }

    return react_api_success(['vodId' => $vodId, 'favorited' => $favorite], $favorite ? '收藏成功' : '已取消收藏');
}

function react_api_delete_records(array &$state, string $collection, array $body, string $message): array
{
    $all = react_api_input($body, 'all');
    if ($all !== null && !is_bool($all)) {
        return react_api_error(422, '删除参数不正确');
    }

    if ($all === true) {
        $removed = count($state[$collection]);
        $state[$collection] = [];

        return react_api_success(['removed' => $removed], $message);
    }

    $rawIds = react_api_input($body, 'recordIds', 'record_ids');
    if (!is_array($rawIds) || $rawIds === [] || count($rawIds) > 100) {
        return react_api_error(422, '删除参数不正确');
    }

    $ids = [];
    foreach ($rawIds as $rawId) {
        $id = react_api_identifier_value($rawId);
        if ($id === null) {
            return react_api_error(422, '删除参数不正确');
        }
        $ids[$id] = true;
    }

    $removed = 0;
    foreach ($state[$collection] as $key => $item) {
        $recordIds = array_map('strval', is_array($item['recordIds'] ?? null) ? $item['recordIds'] : []);
        if (array_intersect(array_keys($ids), $recordIds) !== []) {
            unset($state[$collection][$key]);
            $removed++;
        }
    }

    return react_api_success(['removed' => $removed], $message);
}

function react_api_history_save(array &$state, array $catalog, array $body): array
{
    $vodId = react_api_identifier($body, ['vodId', 'vod_id']);
    $sourceId = react_api_identifier($body, ['sourceId', 'source_id']);
    $episodeId = react_api_identifier($body, ['episodeId', 'episode_id']);
    $position = react_api_number(react_api_input($body, 'positionSeconds', 'position_seconds'));
    $durationValue = react_api_input($body, 'durationSeconds', 'duration_seconds');
    $duration = $durationValue === null ? null : react_api_number($durationValue);
    if ($vodId === null || $sourceId === null || $episodeId === null || $position === null || $position < 0) {
        return react_api_error(422, '播放记录参数不正确');
    }
    if ($durationValue !== null && ($duration === null || $duration <= 0)) {
        return react_api_error(422, '播放时长参数不正确');
    }

    $video = react_api_find_video($catalog, $vodId);
    $episode = $video === null ? null : react_api_find_episode($video, $sourceId, $episodeId);
    if ($video === null || $episode === null) {
        return react_api_error(404, '播放资源不存在');
    }

    $positionSeconds = $position;
    if ($duration !== null && $positionSeconds > $duration) {
        return react_api_error(422, '播放进度不能超过总时长');
    }
    $key = $vodId . ':' . $episodeId;
    $state['history'][$key] = [
        'recordIds' => [$key],
        'vodId' => $vodId,
        'sourceId' => $sourceId,
        'episodeId' => $episodeId,
        'title' => (string) $video['title'],
        'episodeName' => (string) $episode['name'],
        'poster' => (string) ($video['poster'] ?? ''),
        'progress' => (string) ((int) floor($positionSeconds)) . ' 秒',
        'watchedAt' => react_api_now(),
    ];

    return react_api_success(['saved' => true], '播放记录已保存');
}

function react_api_revoke_device(array &$state, array $body): array
{
    $sessionId = react_api_text($body, ['sessionId', 'session_id'], 200);
    if ($sessionId === null) {
        return react_api_error(422, '缺少设备会话 ID');
    }
    if (!isset($state['devices'][$sessionId])) {
        return react_api_error(404, '设备会话不存在');
    }
    if (($state['devices'][$sessionId]['current'] ?? false) === true) {
        return react_api_error(409, '不能撤销当前设备');
    }

    unset($state['devices'][$sessionId]);

    return react_api_success(['sessionId' => $sessionId, 'revoked' => true], '设备已撤销');
}

function react_api_submission(array &$state, string $collection, array $item, string $prefix): array
{
    $id = $prefix . '-' . (count($state[$collection]) + 1);
    $state[$collection][$id] = ['id' => $id, 'createdAt' => react_api_now()] + $item;

    return react_api_success(['id' => $id, 'status' => 'accepted'], '提交成功');
}

function react_api_feedback(array &$state, array $body): array
{
    $content = react_api_text($body, ['content'], 5000);
    if ($content === null) {
        return react_api_error(422, '反馈内容不能为空且不能超过 5000 字');
    }

    $name = react_api_optional_text($body, ['name'], 100);
    if ($name === null) {
        return react_api_error(422, '反馈称呼格式不正确');
    }

    return react_api_submission($state, 'feedback', ['name' => $name, 'content' => $content], 'feedback');
}

function react_api_report(array &$state, array $catalog, array $body): array
{
    $vodId = react_api_identifier($body, ['vodId', 'vod_id']);
    $reason = react_api_text($body, ['reason'], 200);
    $details = react_api_optional_text($body, ['details'], 5000);
    if ($vodId === null || $reason === null || $details === null) {
        return react_api_error(422, '报错参数不正确');
    }

    $video = react_api_find_video($catalog, $vodId);
    if ($video === null) {
        return react_api_error(404, '影片不存在');
    }

    $sourceValue = react_api_input($body, 'sourceId', 'source_id');
    $episodeValue = react_api_input($body, 'episodeId', 'episode_id');
    $sourceId = $sourceValue === null ? '' : react_api_identifier_value($sourceValue);
    $episodeId = $episodeValue === null ? '' : react_api_identifier_value($episodeValue);
    if ($sourceId === null || $episodeId === null || (($sourceId === '') !== ($episodeId === ''))) {
        return react_api_error(422, '播放线路和分集参数必须同时提供');
    }
    if ($sourceId !== '' && react_api_find_episode($video, $sourceId, $episodeId) === null) {
        return react_api_error(404, '播放资源不存在');
    }

    return react_api_submission($state, 'reports', [
        'vodId' => $vodId,
        'sourceId' => $sourceId,
        'episodeId' => $episodeId,
        'reason' => $reason,
        'details' => $details,
    ], 'report');
}

function react_api_comment(array &$state, array $catalog, array $body): array
{
    $midValue = react_api_input($body, 'mid');
    $mid = $midValue === null ? '1' : react_api_identifier_value($midValue);
    $vodId = react_api_identifier($body, ['vodId', 'vod_id']);
    $content = react_api_text($body, ['content'], 5000);
    if ($mid !== '1' || $vodId === null || $content === null) {
        return react_api_error(422, '评论参数不正确');
    }
    if (react_api_find_video($catalog, $vodId) === null) {
        return react_api_error(404, '影片不存在');
    }

    $parentValue = react_api_input($body, 'parentId', 'parent_id');
    $parentId = $parentValue === null ? '' : react_api_identifier_value($parentValue);
    if ($parentId === null) {
        return react_api_error(422, '父评论参数不正确');
    }
    if ($parentId !== '' && !isset($state['comments'][$parentId])) {
        return react_api_error(404, '父评论不存在');
    }

    return react_api_submission($state, 'comments', [
        'mid' => $mid,
        'vodId' => $vodId,
        'parentId' => $parentId,
        'author' => (string) ($state['user']['name'] ?? '本地用户'),
        'content' => $content,
    ], 'comment');
}

function react_api_comments(array $state, array $catalog, array $query): array
{
    $mid = react_api_identifier_value($query['mid'] ?? '1');
    $vodId = react_api_identifier_value($query['content_id'] ?? $query['vod_id'] ?? null);
    if ($mid !== '1' || $vodId === null) {
        return react_api_error(400, '缺少影片 ID');
    }
    if (react_api_find_video($catalog, $vodId) === null) {
        return react_api_error(404, '影片不存在');
    }

    $items = [];
    foreach ($state['comments'] as $comment) {
        if ((string) ($comment['mid'] ?? '1') !== $mid || (string) ($comment['vodId'] ?? '') !== $vodId) {
            continue;
        }

        $id = (string) $comment['id'];
        $reaction = $state['reactions']['comment:' . $id] ?? 'none';
        $item = [
            'id' => $id,
            'author' => (string) ($comment['author'] ?? '本地用户'),
            'content' => (string) $comment['content'],
            'createdAt' => (string) $comment['createdAt'],
            'likes' => $reaction === 'like' ? 1 : 0,
            'dislikes' => $reaction === 'dislike' ? 1 : 0,
        ];
        if (($comment['parentId'] ?? '') !== '') {
            $item['parentId'] = (string) $comment['parentId'];
        }
        $items[] = $item;
    }

    return react_api_success(['items' => $items], '评论加载成功');
}

function react_api_reaction(array &$state, array $catalog, array $body): array
{
    $target = react_api_text($body, ['target'], 20);
    $targetId = react_api_identifier($body, ['targetId', 'target_id']);
    $value = react_api_text($body, ['value'], 20);
    if (!in_array($target, ['vod', 'comment'], true) || $targetId === null || !in_array($value, ['like', 'dislike', 'none'], true)) {
        return react_api_error(422, '互动参数不正确');
    }
    if ($target === 'vod' && react_api_find_video($catalog, $targetId) === null) {
        return react_api_error(404, '影片不存在');
    }
    if ($target === 'comment' && !isset($state['comments'][$targetId])) {
        return react_api_error(404, '评论不存在');
    }

    $key = $target . ':' . $targetId;
    if ($value === 'none') {
        unset($state['reactions'][$key]);
    } else {
        $state['reactions'][$key] = $value;
    }
    $current = $state['reactions'][$key] ?? 'none';

    return react_api_success([
        'target' => $target,
        'targetId' => $targetId,
        'value' => $current,
        'likes' => $current === 'like' ? 1 : 0,
        'dislikes' => $current === 'dislike' ? 1 : 0,
    ], '互动状态已更新');
}

function react_api_rating(array &$state, array $catalog, array $body): array
{
    $vodId = react_api_identifier($body, ['vodId', 'vod_id']);
    $score = react_api_number(react_api_input($body, 'score'));
    if ($vodId === null || $score === null || $score < 1 || $score > 10) {
        return react_api_error(422, '评分参数不正确');
    }
    if (react_api_find_video($catalog, $vodId) === null) {
        return react_api_error(404, '影片不存在');
    }

    $state['ratings'][$vodId] = $score;

    return react_api_success([
        'vodId' => $vodId,
        'score' => $score,
        'average' => $score,
        'count' => 1,
    ], '评分已提交');
}

function react_api_history_items(array $state, array $query): array
{
    $limit = isset($query['limit']) && preg_match('/^[1-9][0-9]{0,2}$/', (string) $query['limit'])
        ? (int) $query['limit']
        : 100;
    $limit = max(1, min(100, $limit));
    return array_slice(array_values($state['history']), 0, $limit);
}

function react_api_handle(array &$session, array $catalog, string $method, array $query = [], array $body = [], array $headers = []): array
{
    react_api_initialize_session($session);
    $state =& $session[REACT_API_SESSION_KEY];
    $method = strtoupper($method);
    $action = trim((string) ($query['action'] ?? 'home'));

    $routes = [
        'home' => ['GET'],
        'home_v2' => ['GET'],
        'navigation' => ['GET'],
        'content' => ['GET'],
        'detail' => ['GET'],
        'playback' => ['GET'],
        'session' => ['GET'],
        'comments' => ['GET'],
        'account' => ['GET'],
        'favorites' => ['GET', 'POST'],
        'favorite' => ['POST'],
        'favorites.delete' => ['POST'],
        'history' => ['GET', 'POST'],
        'history.save' => ['POST'],
        'history.delete' => ['POST'],
        'devices' => ['GET'],
        'device.revoke' => ['POST'],
        'devices/revoke' => ['POST'],
        'revoke' => ['POST'],
        'login' => ['POST'],
        'logout' => ['POST'],
        'feedback' => ['POST'],
        'report' => ['POST'],
        'comment' => ['POST'],
        'reaction' => ['POST'],
        'rating' => ['POST'],
    ];
    if (!isset($routes[$action])) {
        return react_api_error(404, '接口不存在');
    }
    if (!in_array($method, $routes[$action], true)) {
        $response = react_api_error(405, '请求方法不被允许');
        $response['headers']['Allow'] = implode(', ', $routes[$action]);

        return $response;
    }

    if ($method === 'GET') {
        if ($action === 'home') {
            return react_api_success(react_api_home_data($catalog), '首页加载成功', 200, true);
        }
        if ($action === 'home_v2') {
            return react_api_success(react_api_home_v2_data($catalog, (string) ($query['compact'] ?? '0') === '1'), '首页加载成功', 200, true);
        }
        if ($action === 'navigation') {
            return react_api_success(react_api_navigation_data($catalog), '导航加载成功', 200, true);
        }
        if ($action === 'content') {
            return react_api_success(react_api_content_data($catalog, $query), '内容加载成功', 200, true);
        }
        if ($action === 'detail') {
            $vodId = react_api_identifier_value($query['vod_id'] ?? null);
            if ($vodId === null) {
                return react_api_error(400, '缺少影片参数');
            }
            $detail = react_api_detail_data($catalog, $vodId, (string) ($query['compact'] ?? '0') === '1');
            return $detail === null ? react_api_error(404, '影片不存在') : react_api_success($detail, '影片详情加载成功', 200, true);
        }
        if ($action === 'playback') {
            return react_api_playback($catalog, $query);
        }
        if ($action === 'session') {
            return react_api_success(react_api_session_data($state), '登录状态加载成功');
        }
        if ($action === 'comments') {
            return react_api_comments($state, $catalog, $query);
        }

        $authError = react_api_require_user($state);
        if ($authError !== null) {
            return $authError;
        }

        return match ($action) {
            'account' => react_api_success(react_api_account($state), '账户加载成功'),
            'favorites' => react_api_success(['items' => array_values($state['favorites'])], '收藏加载成功'),
            'history' => react_api_success(['items' => react_api_history_items($state, $query)], '播放记录加载成功'),
            'devices' => react_api_success(['maxDevices' => 3, 'items' => array_values($state['devices'])], '登录设备加载成功'),
            default => react_api_error(404, '接口不存在'),
        };
    }

    if ($action !== 'login') {
        $authError = react_api_require_user($state);
        if ($authError !== null) {
            return $authError;
        }
    }
    if (!react_api_valid_csrf($state, $body, $headers)) {
        return react_api_error(403, 'CSRF Token 无效');
    }

    if ($action === 'login') {
        return react_api_login($state, $body);
    }
    if ($action === 'logout') {
        $state['user'] = null;
        react_api_clear_account_state($state);

        return react_api_success(['authenticated' => false], '已退出登录');
    }

    return match ($action) {
        'favorite', 'favorites' => react_api_favorite($state, $catalog, $body),
        'favorites.delete' => react_api_delete_records($state, 'favorites', $body, '收藏记录已删除'),
        'history', 'history.save' => react_api_history_save($state, $catalog, $body),
        'history.delete' => react_api_delete_records($state, 'history', $body, '播放记录已删除'),
        'device.revoke', 'devices/revoke', 'revoke' => react_api_revoke_device($state, $body),
        'feedback' => react_api_feedback($state, $body),
        'report' => react_api_report($state, $catalog, $body),
        'comment' => react_api_comment($state, $catalog, $body),
        'reaction' => react_api_reaction($state, $catalog, $body),
        'rating' => react_api_rating($state, $catalog, $body),
        default => react_api_error(404, '接口不存在'),
    };
}

function react_api_needs_session(string $method, string $action): bool
{
    return strtoupper($method) !== 'GET' || !in_array($action, ['home', 'home_v2', 'navigation', 'content', 'playback'], true);
}

function react_api_request_headers(): array
{
    $headers = [];
    if (isset($_SERVER['HTTP_X_CSRF_TOKEN'])) {
        $headers['X-CSRF-Token'] = (string) $_SERVER['HTTP_X_CSRF_TOKEN'];
    }

    return $headers;
}

function react_api_decode_request_body(string $contentType, string $raw): array
{
    $normalizedContentType = strtolower(trim(explode(';', $contentType)[0]));
    if ($normalizedContentType !== 'application/json') {
        throw new UnexpectedValueException('Content-Type 必须为 application/json');
    }
    if (trim($raw) === '') {
        return [];
    }

    $decoded = json_decode($raw, false, 512, JSON_THROW_ON_ERROR);
    if (!is_object($decoded)) {
        throw new InvalidArgumentException('JSON 请求体必须是对象');
    }

    $body = json_decode($raw, true, 512, JSON_THROW_ON_ERROR);

    return $body;
}

function react_api_request_body(): array
{
    $raw = file_get_contents('php://input');

    return react_api_decode_request_body(
        (string) ($_SERVER['CONTENT_TYPE'] ?? ''),
        $raw === false ? '' : $raw
    );
}

function react_api_emit(array $response): never
{
    http_response_code((int) $response['status']);
    foreach ($response['headers'] as $name => $value) {
        header($name . ': ' . $value);
    }
    echo json_encode($response['body'], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
    exit;
}

function react_api_run(): never
{
    $method = strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET'));
    $action = trim((string) ($_GET['action'] ?? 'home'));
    $session = [];

    try {
        if (react_api_needs_session($method, $action)) {
            ini_set('session.use_strict_mode', '1');
            session_name('pingfang_react_preview');
            session_set_cookie_params([
                'lifetime' => 0,
                'path' => '/',
                'secure' => isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off',
                'httponly' => true,
                'samesite' => 'Lax',
            ]);
            if (session_start() !== true) {
                throw new RuntimeException('Unable to start the local preview session.');
            }
            $session =& $_SESSION;
        }

        $catalog = load_data();
        $body = $method === 'POST' ? react_api_request_body() : [];
        $response = react_api_handle($session, $catalog, $method, $_GET, $body, react_api_request_headers());
        if (session_status() === PHP_SESSION_ACTIVE) {
            if ($response['status'] < 400 && in_array($action, ['login', 'logout'], true)) {
                session_regenerate_id(true);
            }
            session_write_close();
        }
        react_api_emit($response);
    } catch (UnexpectedValueException $error) {
        react_api_emit(react_api_error(415, 'Content-Type 必须为 application/json'));
    } catch (JsonException | InvalidArgumentException $error) {
        react_api_emit(react_api_error(400, '请求体不是有效的 JSON 对象'));
    } catch (Throwable $error) {
        react_api_emit(react_api_error(500, '本地 React API 暂不可用'));
    }
}

if (realpath((string) ($_SERVER['SCRIPT_FILENAME'] ?? '')) === __FILE__) {
    react_api_run();
}
