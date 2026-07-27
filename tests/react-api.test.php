<?php
declare(strict_types=1);

require_once dirname(__DIR__) . '/server/react-api.php';

$fail = static function (string $message): never {
    fwrite(STDERR, $message . "\n");
    exit(1);
};

$assert = static function (bool $condition, string $message) use ($fail): void {
    if (!$condition) {
        $fail($message);
    }
};

$assertSame = static function (mixed $expected, mixed $actual, string $message) use ($fail): void {
    if ($expected !== $actual) {
        $fail($message . "\nExpected: " . var_export($expected, true) . "\nActual: " . var_export($actual, true));
    }
};

$assertThrows = static function (callable $callback, string $className, string $message) use ($fail): void {
    try {
        $callback();
    } catch (Throwable $error) {
        if ($error instanceof $className) {
            return;
        }
        $fail($message . '\nExpected exception: ' . $className . '\nActual exception: ' . $error::class);
    }
    $fail($message . '\nExpected exception: ' . $className . '\nNo exception was thrown.');
};

$assertEnvelope = static function (array $response, int $status, string $message) use ($assertSame): mixed {
    $assertSame($status, $response['status'] ?? null, $message . ' must use the expected HTTP status.');
    $assertSame(['code', 'msg', 'data'], array_keys($response['body'] ?? []), $message . ' must use the common JSON envelope.');
    $assertSame($status < 400 ? 1 : $status, $response['body']['code'], $message . ' must use a consistent business code.');

    return $response['body']['data'];
};

$assertNoKeys = static function (mixed $value, array $forbidden, string $path = 'data') use (&$assertNoKeys, $fail): void {
    if (!is_array($value)) {
        return;
    }
    foreach ($value as $key => $child) {
        if (is_string($key) && in_array($key, $forbidden, true)) {
            $fail('Forbidden API field ' . $path . '.' . $key . ' was exposed.');
        }
        $assertNoKeys($child, $forbidden, $path . '.' . (string) $key);
    }
};

$catalog = load_data();
$assertSame(['value' => 1], react_api_decode_request_body('application/json; charset=utf-8', '{"value":1}'), 'JSON request bodies must decode to objects.');
$assertThrows(
    static fn (): array => react_api_decode_request_body('application/x-www-form-urlencoded', 'value=1'),
    UnexpectedValueException::class,
    'Local write requests must reject form content types.'
);
$assertThrows(
    static fn (): array => react_api_decode_request_body('application/json', '[]'),
    InvalidArgumentException::class,
    'Local write requests must reject JSON arrays.'
);
$session = [];
$request = static function (string $method, string $action, array $body = [], array $query = [], array $headers = []) use (&$session, $catalog): array {
    return react_api_handle($session, $catalog, $method, ['action' => $action] + $query, $body, $headers);
};

$homeResponse = $request('GET', 'home');
$home = $assertEnvelope($homeResponse, 200, 'Home');
$homeCategoryShape = ['id', 'name'];
$assertSame('public, max-age=30, stale-while-revalidate=60', $homeResponse['headers']['Cache-Control'], 'Home must be safely cacheable.');
$assertSame(count($catalog['videos']), count($home['videos']), 'Home must retain every fixture video.');
$assertSame(
    $homeCategoryShape,
    array_keys($home['categories'][0]),
    'Home categories must use the same stable ID shape as the content API.'
);
$assertNoKeys($home, ['actor', 'director', 'area', 'lang', 'letter', 'src', 'url', 'mimeType']);
$assertSame(
    ['id', 'no', 'name', 'sourceId'],
    array_keys($home['videos'][0]['episodes'][0]),
    'Home episodes must retain only safe navigation identifiers and public summary fields.'
);

$navigation = $assertEnvelope($request('GET', 'navigation'), 200, 'Navigation');
$assertSame(['siteName', 'categories'], array_keys($navigation), 'Navigation must expose only shell metadata.');
$assertSame($homeCategoryShape, array_keys($navigation['categories'][0]), 'Navigation categories must use stable IDs.');

$homeV2 = $assertEnvelope($request('GET', 'home_v2'), 200, 'Home v2');
$assertSame(
    ['siteName', 'todayUpdated', 'hotSearch', 'categories', 'hero', 'ranking', 'latest', 'latestByCategory'],
    array_keys($homeV2),
    'Home v2 must expose pre-built bounded sections.'
);
$assert(count($homeV2['hero']) <= 5, 'Home v2 hero must return at most five videos.');
$assert(count($homeV2['ranking']) <= 5, 'Home v2 ranking must return at most five videos.');
$assert(count($homeV2['latest']) <= 6, 'Home v2 latest shelf must return at most six videos.');
$assertSame(['id', 'title', 'remark', 'year', 'class', 'score', 'poster'], array_keys($homeV2['ranking'][0]), 'Home v2 cards must use the compact field whitelist.');
$assertNoKeys($homeV2, ['actor', 'director', 'area', 'lang', 'letter', 'src', 'url', 'mimeType']);

$compactHomeV2 = $assertEnvelope($request('GET', 'home_v2', [], ['compact' => '1']), 200, 'Compact home v2');
$assertSame(['siteName', 'todayUpdated', 'categories', 'hero', 'ranking', 'latest', 'latestByCategory'], array_keys($compactHomeV2), 'Compact home v2 must omit unused search metadata.');
$assertSame(['id', 'sourceId'], array_keys($compactHomeV2['hero'][0]['episodes'][0]), 'Compact home hero episodes must return navigation IDs only.');

$contentResponse = $request('GET', 'content');
$content = $assertEnvelope($contentResponse, 200, 'Content');
$assertSame('public, max-age=30, stale-while-revalidate=60', $contentResponse['headers']['Cache-Control'], 'Content must be safely cacheable.');
$assertSame(count($catalog['categories']), count($content['categories']), 'Content must include the complete category catalog.');
$assertSame(count($catalog['videos']), count($content['videos']), 'Content must include the complete video catalog.');
$assertSame(['id', 'name', 'total'], array_keys($content['categories'][0]), 'Content categories must include server-side totals.');
$assertSame(count($catalog['videos']), $content['total'], 'Content must report the complete filtered total.');
$assertSame(1, $content['page'], 'Content must report the normalized page.');
$assertSame(24, $content['pageSize'], 'Content must apply the default page size.');
$assertSame((int) ceil(count($catalog['videos']) / 24), $content['totalPages'], 'Content must report total pages.');
$assertSame(['areas', 'years', 'langs', 'classes'], array_keys($content['facets']), 'Content must expose the complete server-derived filter facets.');
$assertSame(['current', 'parent', 'children'], array_keys($content['categoryContext']), 'Content must expose the current category context.');
$assertSame('42', react_api_category_id('电影'), 'Known MacCMS category IDs must stay stable.');
$assertSame(
    ['id', 'no', 'name', 'sourceId'],
    array_keys($content['videos'][0]['episodes'][0]),
    'Content episodes must expose stable IDs without source URLs.'
);
foreach (['actor', 'director', 'area', 'lang', 'letter'] as $field) {
    $assert(array_key_exists($field, $content['videos'][0]), 'Content videos must include ' . $field . '.');
}
$assertNoKeys($content, ['src', 'url', 'mimeType']);

$compactContent = $assertEnvelope($request('GET', 'content', [], ['compact' => '1']), 200, 'Compact content');
$assertSame(['siteName', 'categories', 'categoryContext', 'facets', 'videos', 'total', 'page', 'totalPages'], array_keys($compactContent), 'Compact content must omit unused summary and page-size metadata.');
$assertSame(['id', 'name'], array_keys($compactContent['categories'][0]), 'Compact content must not calculate category totals unless requested.');
$assertSame(['id', 'title', 'remark', 'year', 'class', 'score', 'poster'], array_keys($compactContent['videos'][0]), 'Compact catalog cards must use the VodCard whitelist.');
$compactCategoryContent = $assertEnvelope($request('GET', 'content', [], ['compact' => '1', 'include_category_totals' => '1']), 200, 'Compact content with category totals');
$assertSame(['id', 'name', 'total'], array_keys($compactCategoryContent['categories'][0]), 'Compact category totals must be opt-in.');
$compactSearch = $assertEnvelope($request('GET', 'content', [], ['compact' => '1', 'keyword' => (string) $catalog['videos'][0]['title']]), 200, 'Compact search');
$assertSame(['id', 'title', 'remark', 'year', 'class', 'score', 'poster', 'typeName', 'actor', 'summary'], array_keys($compactSearch['videos'][0]), 'Compact search items must add only rendered search fields.');

$pageTwo = $assertEnvelope($request('GET', 'content', [], ['sort' => 'hot', 'page' => '2', 'page_size' => '2']), 200, 'Paginated content');
$assertSame(2, $pageTwo['page'], 'Content must honor the requested page.');
$assertSame(2, $pageTwo['pageSize'], 'Content must honor a bounded page size.');
$assertSame(2, count($pageTwo['videos']), 'Content must return only the requested page.');
$emptySearch = $assertEnvelope($request('GET', 'content', [], ['keyword' => '']), 200, 'Empty search');
$assertSame(0, $emptySearch['total'], 'An explicitly empty search must not return the full catalog.');
$titleSearch = $assertEnvelope($request('GET', 'content', [], ['keyword' => (string) $catalog['videos'][0]['title']]), 200, 'Title search');
$assert($titleSearch['total'] >= 1, 'A complete title prefix must find the matching video.');
$literalWildcard = $assertEnvelope($request('GET', 'content', [], ['keyword' => '%']), 200, 'Literal wildcard search');
$assertSame(0, $literalWildcard['total'], 'Search wildcard characters must be treated as literal text.');

$detail = $assertEnvelope($request('GET', 'detail', [], ['vod_id' => $content['videos'][0]['id']]), 200, 'Detail');
$assertSame($content['videos'][0]['id'], $detail['video']['id'], 'Detail must load one exact video outside the catalog page.');
$assertSame(['siteName', 'video', 'related'], array_keys($detail), 'Detail must use the stable React DTO.');
$assertNoKeys($detail, ['src', 'url', 'mimeType']);
$compactDetail = $assertEnvelope($request('GET', 'detail', [], ['vod_id' => $content['videos'][0]['id'], 'compact' => '1']), 200, 'Compact detail');
$assertSame(['id', 'typeName', 'title', 'remark', 'actor', 'director', 'year', 'area', 'class', 'lang', 'hits', 'score', 'updated', 'poster', 'backdrop', 'duration', 'summary', 'episodes', 'playSources', 'scoreCount', 'likes', 'dislikes'], array_keys($compactDetail['video']), 'Compact detail videos must expose every rendered detail field.');
$assertSame(['id', 'title', 'remark', 'year', 'class', 'score', 'poster'], array_keys($compactDetail['related'][0]), 'Compact related videos must use the card whitelist.');
$assertEnvelope($request('GET', 'detail', [], ['vod_id' => '9999']), 404, 'Unknown detail');

$episode = $content['videos'][0]['episodes'][0];
$playbackResponse = $request('GET', 'playback', [], [
    'vod_id' => $content['videos'][0]['id'],
    'source_id' => $episode['sourceId'],
    'episode_id' => $episode['id'],
]);
$playback = $assertEnvelope($playbackResponse, 200, 'Playback');
$assertSame('private, no-store', $playbackResponse['headers']['Cache-Control'], 'Playback descriptions must never be cached.');
$assertSame(
    ['siteName', 'vodId', 'sourceId', 'episodeId', 'title', 'episodeName', 'poster', 'playSources', 'kind', 'url', 'mimeType'],
    array_keys($playback),
    'Playback must match the React descriptor exactly.'
);
$assertSame('video', $playback['kind'], 'Fixture playback must use the video descriptor.');
$assertSame('video/mp4', $playback['mimeType'], 'Fixture playback must expose the correct MIME type.');
$assertNoKeys($playback, ['src']);

foreach ([
    ['vod_id' => '9999', 'source_id' => '1', 'episode_id' => '999901'],
    ['vod_id' => '1', 'source_id' => 'missing', 'episode_id' => '101'],
    ['vod_id' => '1', 'source_id' => '1', 'episode_id' => '999'],
] as $unknownPlayback) {
    $assertEnvelope($request('GET', 'playback', [], $unknownPlayback), 404, 'Unknown playback');
}
$assertEnvelope($request('GET', 'playback'), 400, 'Incomplete playback');
$assertEnvelope($request('POST', 'content'), 405, 'Wrong content method');
$assertEnvelope($request('GET', 'missing'), 404, 'Unknown action');

$sessionResponse = $request('GET', 'session');
$sessionData = $assertEnvelope($sessionResponse, 200, 'Anonymous session');
$assertSame('private, no-store', $sessionResponse['headers']['Cache-Control'], 'Session responses must never be cached.');
$assertSame(false, $sessionData['authenticated'], 'The initial local session must be anonymous.');
$assertSame(null, $sessionData['user'], 'Anonymous sessions must not invent a user.');
$assert(strlen($sessionData['csrfToken']) === 64, 'A strong CSRF token must be issued before login.');
$assertSame(null, $sessionData['requirements']['captchaUrl'], 'The local adapter must not advertise a disabled captcha route.');
$assertSame(
    ['loginCaptcha', 'feedbackCaptcha', 'feedbackLogin', 'feedbackEnabled', 'feedbackAudit', 'commentCaptcha', 'commentLogin', 'commentEnabled', 'commentAudit', 'captchaUrl'],
    array_keys($sessionData['requirements']),
    'The local session requirements must match the production account contract.'
);
$csrf = $sessionData['csrfToken'];
$csrfHeader = ['X-CSRF-Token' => $csrf];

foreach (['account', 'favorites', 'history', 'devices'] as $privateAction) {
    $assertEnvelope($request('GET', $privateAction), 401, 'Anonymous ' . $privateAction);
}
$assertEnvelope($request('GET', 'favorite.status', [], ['vod_id' => '1']), 401, 'Anonymous favorite status');
$assertEnvelope($request('POST', 'login', ['username' => 'demo', 'password' => 'demo123']), 403, 'Login without CSRF');
$assertEnvelope(
    $request('POST', 'login', ['username' => 'demo', 'password' => 'wrong-password'], [], $csrfHeader),
    401,
    'Login with invalid credentials'
);
$assertSame(null, $session[REACT_API_SESSION_KEY]['user'], 'Rejected login attempts must not authenticate the session.');

$login = $assertEnvelope(
    $request('POST', 'login', ['username' => 'demo', 'password' => 'demo123'], [], $csrfHeader),
    200,
    'Login'
);
$assertSame(true, $login['authenticated'], 'The demo credentials must authenticate the local session.');
$assertSame('demo', $login['user']['id'], 'The demo user ID must be stable.');

foreach (['account', 'favorites', 'history', 'devices'] as $privateAction) {
    $response = $request('GET', $privateAction);
    $assertEnvelope($response, 200, 'Authenticated ' . $privateAction);
    $assertSame('private, no-store', $response['headers']['Cache-Control'], $privateAction . ' must never be cached.');
}

$favoriteBody = ['vodId' => '1', 'favorite' => true];
$assertEnvelope($request('POST', 'favorite', $favoriteBody), 403, 'Favorite without CSRF');
$assertSame([], $session[REACT_API_SESSION_KEY]['favorites'], 'Rejected favorite writes must not mutate session state.');
$assertEnvelope($request('POST', 'favorite', ['vodId' => [], 'favorite' => true], [], $csrfHeader), 422, 'Favorite with a non-scalar video ID');
$favoriteResult = $assertEnvelope($request('POST', 'favorite', $favoriteBody, [], $csrfHeader), 200, 'Favorite add');
$assertSame(['vodId' => '1', 'favorited' => true], $favoriteResult, 'Favorite writes must report the persisted state.');
$favoriteStatus = $assertEnvelope($request('GET', 'favorite.status', [], ['vod_id' => '1']), 200, 'Favorite status after add');
$assertSame(['vodId' => '1', 'favorited' => true], $favoriteStatus, 'Favorite status must read one persisted favorite.');
$assertEnvelope($request('GET', 'favorite.status'), 400, 'Favorite status without video id');
$assertEnvelope($request('POST', 'favorite', $favoriteBody, [], $csrfHeader), 409, 'Duplicate favorite');
$favorites = $assertEnvelope($request('GET', 'favorites'), 200, 'Favorites after add');
$assertSame(1, count($favorites['items']), 'A successful favorite write must be observable through the getter.');
$assertSame(['recordIds', 'vodId', 'title', 'poster', 'remark', 'createdAt'], array_keys($favorites['items'][0]), 'Favorite entries must match the React DTO.');
$assertSame(['items'], array_keys($favorites), 'Legacy favorites must retain the unpaginated response shape.');
$assertEnvelope($request('POST', 'favorite', ['vodId' => '1', 'favorite' => false], [], $csrfHeader), 200, 'Favorite remove');
$removedFavoriteStatus = $assertEnvelope($request('GET', 'favorite.status', [], ['vod_id' => '1']), 200, 'Favorite status after remove');
$assertSame(['vodId' => '1', 'favorited' => false], $removedFavoriteStatus, 'Favorite status must reflect removal.');
$assertSame([], $assertEnvelope($request('GET', 'favorites'), 200, 'Favorites after remove')['items'], 'Favorite removal must persist.');
$assertEnvelope($request('POST', 'favorite', ['vodId' => '1', 'favorite' => true], [], $csrfHeader), 200, 'Favorite add before batch delete');
$assertEnvelope($request('POST', 'favorite', ['vodId' => '2', 'favorite' => true], [], $csrfHeader), 200, 'Second favorite add before batch delete');
$session[REACT_API_SESSION_KEY]['favorites']['1']['createdAt'] = '2026-07-24T10:00:00+00:00';
$session[REACT_API_SESSION_KEY]['favorites']['2']['createdAt'] = '2026-07-24T11:00:00+00:00';
$favoritePageOne = $assertEnvelope($request('GET', 'favorites', [], ['page' => '1', 'page_size' => '1']), 200, 'First favorites page');
$assertSame(
    ['items', 'page', 'pageSize', 'total', 'totalPages'],
    array_keys($favoritePageOne),
    'Paginated favorites must expose the common page metadata.'
);
$assertSame([1, 1, 2, 2], [$favoritePageOne['page'], $favoritePageOne['pageSize'], $favoritePageOne['total'], $favoritePageOne['totalPages']], 'Favorites page metadata must describe the complete result.');
$assertSame('2', $favoritePageOne['items'][0]['vodId'], 'Favorites must sort newest first before pagination.');
$favoriteLeadingZeroPage = $assertEnvelope($request('GET', 'favorites', [], ['page' => '01', 'page_size' => '01']), 200, 'Favorites page with leading zeros');
$assertSame([1, 1], [$favoriteLeadingZeroPage['page'], $favoriteLeadingZeroPage['pageSize']], 'Favorites pagination must parse digit-only values consistently with production.');
$favoritePageTwo = $assertEnvelope($request('GET', 'favorites', [], ['page' => '2', 'page_size' => '1']), 200, 'Second favorites page');
$assertSame('1', $favoritePageTwo['items'][0]['vodId'], 'Favorites page two must contain the next stable item.');
$favoritePastEnd = $assertEnvelope($request('GET', 'favorites', [], ['page' => '99', 'page_size' => '1']), 200, 'Favorites page past the end');
$assertSame(2, $favoritePastEnd['page'], 'Favorites requests past the end must converge to the final page.');
$assertSame('1', $favoritePastEnd['items'][0]['vodId'], 'The converged favorites page must return the final item.');
foreach ([
    ['page' => '1'],
    ['page_size' => '1'],
    ['page' => '0', 'page_size' => '1'],
    ['page' => '1', 'page_size' => '0'],
    ['page' => '1', 'page_size' => '101'],
    ['page' => '100001', 'page_size' => '1'],
] as $invalidFavoritePage) {
    $assertEnvelope($request('GET', 'favorites', [], $invalidFavoritePage), 422, 'Invalid favorites pagination');
}
$assertEnvelope($request('POST', 'favorites.delete', ['recordIds' => []], [], $csrfHeader), 422, 'Empty favorite batch delete');
$favoriteDelete = $assertEnvelope($request('POST', 'favorites.delete', ['recordIds' => ['1']], [], $csrfHeader), 200, 'Favorite batch delete');
$assertSame(['removed' => 1], $favoriteDelete, 'Favorite batch delete must report the number removed.');
$favoritePageAfterDelete = $assertEnvelope($request('GET', 'favorites', [], ['page' => '2', 'page_size' => '1']), 200, 'Favorites page after deletion');
$assertSame([1, 1, 1, 1], [$favoritePageAfterDelete['page'], $favoritePageAfterDelete['pageSize'], $favoritePageAfterDelete['total'], $favoritePageAfterDelete['totalPages']], 'Favorites pagination must converge after deleting the final page item.');
$assertSame('2', $favoritePageAfterDelete['items'][0]['vodId'], 'Favorites pagination must retain the remaining item after deletion.');
$favoriteClear = $assertEnvelope($request('POST', 'favorites.delete', ['all' => true], [], $csrfHeader), 200, 'Favorite clear');
$assertSame(['removed' => 1], $favoriteClear, 'Favorite clear must remove every remaining favorite.');
$emptyFavoritePage = $assertEnvelope($request('GET', 'favorites', [], ['page' => '9', 'page_size' => '1']), 200, 'Empty favorites page');
$assertSame([[], 1, 1, 0, 0], [$emptyFavoritePage['items'], $emptyFavoritePage['page'], $emptyFavoritePage['pageSize'], $emptyFavoritePage['total'], $emptyFavoritePage['totalPages']], 'Empty favorites pagination must normalize to page one with zero total pages.');

$historyBody = [
    'vodId' => '1',
    'sourceId' => '1',
    'episodeId' => '101',
    'positionSeconds' => 37.9,
    'durationSeconds' => 120,
    'checkpointAtMs' => 1784846400200,
];
$assertEnvelope($request('POST', 'history.save', $historyBody, [], ['X-CSRF-Token' => 'wrong']), 403, 'History with invalid CSRF');
$assertEnvelope($request('POST', 'history.save', array_replace($historyBody, ['positionSeconds' => '1e309']), [], $csrfHeader), 422, 'History with an infinite position');
$assertEnvelope($request('POST', 'history.save', array_replace($historyBody, ['durationSeconds' => []]), [], $csrfHeader), 422, 'History with a non-scalar duration');
$assertEnvelope($request('POST', 'history.save', array_replace($historyBody, ['checkpointAtMs' => 0]), [], $csrfHeader), 422, 'History with an invalid checkpoint order');
$assertEnvelope($request('POST', 'history.save', array_replace($historyBody, ['positionSeconds' => 0, 'durationSeconds' => 0.5]), [], $csrfHeader), 422, 'History with a subsecond duration');
$assertEnvelope($request('POST', 'history.save', array_replace($historyBody, ['episodeId' => '999']), [], $csrfHeader), 404, 'History for an unknown episode');
$assertEnvelope($request('POST', 'history.save', $historyBody, [], $csrfHeader), 200, 'History save');
$history = $assertEnvelope($request('GET', 'history'), 200, 'History after save');
$assertSame(1, count($history['items']), 'A successful history write must be observable through the getter.');
$assertSame(
    ['recordIds', 'vodId', 'sourceId', 'episodeId', 'title', 'episodeName', 'poster', 'positionSeconds', 'durationSeconds', 'completed', 'progress', 'watchedAt'],
    array_keys($history['items'][0]),
    'History entries must match the React DTO.'
);
$assertSame(37, $history['items'][0]['positionSeconds'], 'History entries must expose the normalized playback position.');
$assertSame(120, $history['items'][0]['durationSeconds'], 'History entries must expose the normalized playback duration.');
$assertSame(false, $history['items'][0]['completed'], 'History entries below the 95 percent threshold must stay incomplete.');
$assertSame(['1:1:101'], array_keys($session[REACT_API_SESSION_KEY]['history']), 'Local history keys must isolate playback sources.');
$assertEnvelope(
    $request('POST', 'history.save', array_replace($historyBody, ['positionSeconds' => 31, 'checkpointAtMs' => 1784846400100]), [], $csrfHeader),
    200,
    'Older concurrent history save'
);
$history = $assertEnvelope($request('GET', 'history'), 200, 'History after older concurrent save');
$assertSame(37, $history['items'][0]['positionSeconds'], 'An older concurrent checkpoint must not overwrite the latest local checkpoint.');
$legacyHistoryBody = $historyBody;
unset($legacyHistoryBody['checkpointAtMs']);
$legacyHistoryBody['positionSeconds'] = 32;
$assertEnvelope($request('POST', 'history.save', $legacyHistoryBody, [], $csrfHeader), 200, 'Legacy history save after ordered checkpoint');
$history = $assertEnvelope($request('GET', 'history'), 200, 'History after legacy concurrent save');
$assertSame(37, $history['items'][0]['positionSeconds'], 'A legacy checkpoint must not overwrite a key that already has an ordering watermark.');
$resumablePlayback = $assertEnvelope($request('GET', 'playback', [], [
    'vod_id' => '1',
    'source_id' => '1',
    'episode_id' => '101',
]), 200, 'Playback with resumable history');
$assertSame(37, $resumablePlayback['resumePositionSeconds'] ?? null, 'Playback must expose only the exact resumable episode checkpoint.');

$completedHistoryBody = array_replace($historyBody, ['positionSeconds' => 114, 'checkpointAtMs' => 1784846400300]);
$assertEnvelope($request('POST', 'history.save', $completedHistoryBody, [], $csrfHeader), 200, 'Completed history save');
$completedHistory = $assertEnvelope($request('GET', 'history'), 200, 'Completed history');
$assertSame(true, $completedHistory['items'][0]['completed'], 'History entries at the 95 percent threshold must be complete.');
$completedPlayback = $assertEnvelope($request('GET', 'playback', [], [
    'vod_id' => '1',
    'source_id' => '1',
    'episode_id' => '101',
]), 200, 'Playback with completed history');
$assert(!array_key_exists('resumePositionSeconds', $completedPlayback), 'Completed playback history must not resume near the ending.');

$unknownDurationBody = $historyBody;
unset($unknownDurationBody['durationSeconds']);
$unknownDurationBody['positionSeconds'] = 0;
$unknownDurationBody['checkpointAtMs'] = 1784846400400;
$assertEnvelope($request('POST', 'history.save', $unknownDurationBody, [], $csrfHeader), 200, 'History save without duration');
$unknownDurationHistory = $assertEnvelope($request('GET', 'history'), 200, 'History without duration');
$assertSame(0, $unknownDurationHistory['items'][0]['positionSeconds'], 'Zero-second history must remain valid.');
$assertSame(120, $unknownDurationHistory['items'][0]['durationSeconds'], 'Missing playback duration must preserve the existing known duration.');
$assertSame(false, $unknownDurationHistory['items'][0]['completed'], 'History without a duration cannot be complete.');
$unknownDurationPlayback = $assertEnvelope($request('GET', 'playback', [], [
    'vod_id' => '1',
    'source_id' => '1',
    'episode_id' => '101',
]), 200, 'Playback without resumable duration');
$assert(!array_key_exists('resumePositionSeconds', $unknownDurationPlayback), 'Playback history without a duration must not resume.');

$legacyHistory = $assertEnvelope($request('GET', 'history'), 200, 'Legacy history response');
$assertSame(['items'], array_keys($legacyHistory), 'Legacy history must retain the unpaginated response shape.');
$limitedHistory = $assertEnvelope($request('GET', 'history', [], ['limit' => '1']), 200, 'Limited legacy history response');
$assertSame(['items'], array_keys($limitedHistory), 'History limit must retain the legacy response shape.');
$assertSame(1, count($limitedHistory['items']), 'History limit must retain its bounded legacy behavior.');
$assertEnvelope($request('GET', 'history', [], ['limit' => '1', 'page' => '1', 'page_size' => '1']), 422, 'History limit and pagination conflict');
$assertEnvelope($request('GET', 'history', [], ['page' => '1']), 422, 'History pagination requires page size');
$assertEnvelope($request('GET', 'history', [], ['page' => '1', 'page_size' => '101']), 422, 'History pagination rejects oversized page size');

$secondVideo = $catalog['videos'][1];
$secondEpisode = $secondVideo['episodes'][0];
$secondHistoryKey = (string) $secondVideo['id'] . ':' . REACT_API_SOURCE_ID . ':' . react_api_episode_id($secondVideo, $secondEpisode);
$secondHistoryBody = [
    'vodId' => (string) $secondVideo['id'],
    'sourceId' => REACT_API_SOURCE_ID,
    'episodeId' => react_api_episode_id($secondVideo, $secondEpisode),
    'positionSeconds' => 45,
    'durationSeconds' => 180,
    'checkpointAtMs' => 1784846400500,
];
$assertEnvelope($request('POST', 'history.save', $secondHistoryBody, [], $csrfHeader), 200, 'Second history save before pagination');
$secondEpisodeHistoryKey = (string) $secondVideo['id'] . ':' . REACT_API_SOURCE_ID . ':' . react_api_episode_id($secondVideo, $secondVideo['episodes'][1]);
$secondEpisodeHistoryBody = array_replace($secondHistoryBody, [
    'episodeId' => react_api_episode_id($secondVideo, $secondVideo['episodes'][1]),
    'positionSeconds' => 20,
    'checkpointAtMs' => 1784846400600,
]);
$assertEnvelope($request('POST', 'history.save', $secondEpisodeHistoryBody, [], $csrfHeader), 200, 'Newer episode history save before folding');
$removedEpisodeHistoryKey = (string) $secondVideo['id'] . ':' . REACT_API_SOURCE_ID . ':299';
$session[REACT_API_SESSION_KEY]['history'][$removedEpisodeHistoryKey] = array_replace(
    $session[REACT_API_SESSION_KEY]['history'][$secondEpisodeHistoryKey],
    [
        'recordIds' => [$removedEpisodeHistoryKey],
        'episodeId' => '299',
        'episodeName' => '已移除分集',
        'watchedAt' => '2026-07-24T13:00:00+00:00',
    ]
);
$session[REACT_API_SESSION_KEY]['history'][$secondHistoryKey]['recordIds'][] = $secondHistoryKey;
$session[REACT_API_SESSION_KEY]['history']['1:1:101']['watchedAt'] = '2026-07-24T10:00:00+00:00';
$session[REACT_API_SESSION_KEY]['history'][$secondHistoryKey]['watchedAt'] = '2026-07-24T11:00:00+00:00';
$session[REACT_API_SESSION_KEY]['history'][$secondEpisodeHistoryKey]['watchedAt'] = '2026-07-24T12:00:00+00:00';
$foldedLegacyHistory = $assertEnvelope($request('GET', 'history', [], ['limit' => '2']), 200, 'Folded legacy history response');
$assertSame(2, count($foldedLegacyHistory['items']), 'Legacy history must fold episodes by video before applying the limit.');
$assertSame(
    [(string) $secondVideo['id'], '1'],
    array_column($foldedLegacyHistory['items'], 'vodId'),
    'Legacy history must order folded videos by their newest display item.'
);
$assertSame($secondEpisodeHistoryBody['episodeId'], $foldedLegacyHistory['items'][0]['episodeId'], 'Folded history must display the newest episode for a video.');
$assertSame(
    [$removedEpisodeHistoryKey, $secondEpisodeHistoryKey, $secondHistoryKey],
    $foldedLegacyHistory['items'][0]['recordIds'],
    'Folded history must aggregate every episode record ID without duplicates.'
);
$historyPageOne = $assertEnvelope($request('GET', 'history', [], ['page' => '1', 'page_size' => '1']), 200, 'First history page');
$assertSame(
    ['items', 'page', 'pageSize', 'total', 'totalPages'],
    array_keys($historyPageOne),
    'Paginated history must expose the common page metadata.'
);
$assertSame([1, 1, 2, 2], [$historyPageOne['page'], $historyPageOne['pageSize'], $historyPageOne['total'], $historyPageOne['totalPages']], 'History page metadata must describe the complete result.');
$assertSame((string) $secondVideo['id'], $historyPageOne['items'][0]['vodId'], 'History must sort newest first before pagination.');
$assertSame($secondEpisodeHistoryBody['episodeId'], $historyPageOne['items'][0]['episodeId'], 'Paginated history must display the newest episode after folding.');
$assertSame([$removedEpisodeHistoryKey, $secondEpisodeHistoryKey, $secondHistoryKey], $historyPageOne['items'][0]['recordIds'], 'Paginated history must expose every folded record ID for batch deletion.');
$historyLeadingZeroPage = $assertEnvelope($request('GET', 'history', [], ['page' => '01', 'page_size' => '01']), 200, 'History page with leading zeros');
$assertSame([1, 1], [$historyLeadingZeroPage['page'], $historyLeadingZeroPage['pageSize']], 'History pagination must parse digit-only values consistently with production.');
$historyPageTwo = $assertEnvelope($request('GET', 'history', [], ['page' => '2', 'page_size' => '1']), 200, 'Second history page');
$assertSame('1', $historyPageTwo['items'][0]['vodId'], 'History page two must contain the next stable item.');
$historyPastEnd = $assertEnvelope($request('GET', 'history', [], ['page' => '99', 'page_size' => '1']), 200, 'History page past the end');
$assertSame(2, $historyPastEnd['page'], 'History requests past the end must converge to the final page.');
$assertSame('1', $historyPastEnd['items'][0]['vodId'], 'The converged history page must return the final item.');
$foldedHistoryDelete = $assertEnvelope($request('POST', 'history.delete', ['recordIds' => $historyPageOne['items'][0]['recordIds']], [], $csrfHeader), 200, 'Delete folded history item');
$assertSame(['removed' => 3], $foldedHistoryDelete, 'Deleting a folded history item must remove every underlying episode record.');
$historyPageAfterDelete = $assertEnvelope($request('GET', 'history', [], ['page' => '2', 'page_size' => '1']), 200, 'History page after deletion');
$assertSame([1, 1, 1, 1], [$historyPageAfterDelete['page'], $historyPageAfterDelete['pageSize'], $historyPageAfterDelete['total'], $historyPageAfterDelete['totalPages']], 'History pagination must converge after deleting the final page item.');
$assertSame('1', $historyPageAfterDelete['items'][0]['vodId'], 'Deleting a folded history item must not reveal an older episode for the same video.');

$assertEnvelope($request('POST', 'history.delete', ['recordIds' => [[]]], [], $csrfHeader), 422, 'History delete with an invalid ID');
$historyDelete = $assertEnvelope($request('POST', 'history.delete', ['recordIds' => ['1:1:101']], [], $csrfHeader), 200, 'History delete');
$assertSame(['removed' => 1], $historyDelete, 'History delete must remove every record for the selected video.');
$assertSame([], $assertEnvelope($request('GET', 'history'), 200, 'History after delete')['items'], 'History deletion must persist.');
$emptyHistoryPage = $assertEnvelope($request('GET', 'history', [], ['page' => '9', 'page_size' => '1']), 200, 'Empty history page');
$assertSame([[], 1, 1, 0, 0], [$emptyHistoryPage['items'], $emptyHistoryPage['page'], $emptyHistoryPage['pageSize'], $emptyHistoryPage['total'], $emptyHistoryPage['totalPages']], 'Empty history pagination must normalize to page one with zero total pages.');

$assertEnvelope($request('POST', 'device.revoke', ['sessionId' => 'local-current'], [], $csrfHeader), 409, 'Current device revoke');
$revoke = $assertEnvelope(
    $request('POST', 'device.revoke', ['sessionId' => 'local-secondary'], [], $csrfHeader),
    200,
    'Secondary device revoke'
);
$assertSame(['sessionId' => 'local-secondary', 'revoked' => true], $revoke, 'Device revocation must report the actual revoked session.');
$assertEnvelope($request('POST', 'device.revoke', ['sessionId' => 'local-secondary'], [], $csrfHeader), 404, 'Repeated device revoke');
$devices = $assertEnvelope($request('GET', 'devices'), 200, 'Devices after revoke');
$assertSame(3, $devices['maxDevices'], 'Device responses must expose the configured local limit.');
$assertSame(1, count($devices['items']), 'Revoked devices must disappear from the getter.');
$assertSame(
    ['sessionId', 'name', 'browser', 'os', 'loginAt', 'lastActiveAt', 'ipAddress', 'userAgent', 'status', 'revokedAt', 'current'],
    array_keys($devices['items'][0]),
    'Device entries must match the React DTO.'
);

$assertEnvelope($request('POST', 'feedback', ['content' => ''], [], $csrfHeader), 422, 'Empty feedback');
$feedback = $assertEnvelope($request('POST', 'feedback', ['name' => '演示用户', 'content' => '界面反馈'], [], $csrfHeader), 200, 'Feedback');
$assertSame(['id', 'status'], array_keys($feedback), 'Feedback must return a submission receipt.');
$assertSame(1, count($session[REACT_API_SESSION_KEY]['feedback']), 'Successful feedback must be persisted in the session.');

$assertEnvelope(
    $request('POST', 'report', ['vodId' => '999', 'reason' => '无法播放'], [], $csrfHeader),
    404,
    'Report for an unknown video'
);
$assertEnvelope(
    $request('POST', 'report', ['vodId' => '1', 'reason' => '无法播放', 'details' => []], [], $csrfHeader),
    422,
    'Report with non-text details'
);
$report = $assertEnvelope(
    $request('POST', 'report', [
        'vodId' => '1',
        'sourceId' => '1',
        'episodeId' => '101',
        'reason' => '播放卡顿',
        'details' => '本地验收反馈',
    ], [], $csrfHeader),
    200,
    'Report'
);
$assertSame(['id', 'status'], array_keys($report), 'Report must return a submission receipt.');

$assertEnvelope($request('POST', 'comment', ['vodId' => '1', 'content' => ''], [], $csrfHeader), 422, 'Empty comment');
$assertEnvelope($request('POST', 'comment', ['vodId' => [], 'content' => '无效 ID'], [], $csrfHeader), 422, 'Comment with a non-scalar video ID');
$comment = $assertEnvelope(
    $request('POST', 'comment', ['mid' => '1', 'vodId' => '1', 'content' => '本地评论'], [], $csrfHeader),
    200,
    'Comment'
);
$comments = $assertEnvelope($request('GET', 'comments', [], ['mid' => '1', 'content_id' => '1']), 200, 'Comments');
$assertSame(1, count($comments['items']), 'A submitted comment must appear in the public comment list.');
$assertSame(
    ['id', 'author', 'content', 'createdAt', 'likes', 'dislikes'],
    array_keys($comments['items'][0]),
    'Comment list entries must expose only the React DTO.'
);
$assertSame($comment['id'], $comments['items'][0]['id'], 'Comment receipts and list entries must reference the same item.');
$assertEnvelope($request('GET', 'comments', [], ['vod_id' => '999']), 404, 'Comments for an unknown video');

$assertEnvelope(
    $request('POST', 'reaction', ['target' => 'vod', 'targetId' => '1', 'value' => 'invalid'], [], $csrfHeader),
    422,
    'Invalid reaction'
);
$commentReaction = $assertEnvelope(
    $request('POST', 'reaction', ['target' => 'comment', 'targetId' => $comment['id'], 'value' => 'like'], [], $csrfHeader),
    200,
    'Comment reaction'
);
$assertSame(1, $commentReaction['likes'], 'A persisted like must change the returned aggregate.');
$comments = $assertEnvelope($request('GET', 'comments', [], ['mid' => '1', 'content_id' => '1']), 200, 'Comments after reaction');
$assertSame(1, $comments['items'][0]['likes'], 'Comment reactions must be visible in the comment list.');

$ratingCount = count($session[REACT_API_SESSION_KEY]['ratings']);
$assertEnvelope($request('POST', 'rating', ['vodId' => '1', 'score' => 11], [], $csrfHeader), 422, 'Invalid rating');
$assertEnvelope($request('POST', 'rating', ['vodId' => '1', 'score' => '1e309'], [], $csrfHeader), 422, 'Infinite rating');
$assertSame($ratingCount, count($session[REACT_API_SESSION_KEY]['ratings']), 'Rejected ratings must not mutate session state.');
$rating = $assertEnvelope($request('POST', 'rating', ['vodId' => '1', 'score' => 8.5], [], $csrfHeader), 200, 'Rating');
$assertSame(['vodId', 'score', 'average', 'count'], array_keys($rating), 'Rating results must match the React DTO.');
$assertSame(8.5, $rating['average'], 'The local rating aggregate must reflect the saved score.');

$assertEnvelope($request('POST', 'logout'), 403, 'Logout without CSRF');
$logout = $assertEnvelope($request('POST', 'logout', [], [], $csrfHeader), 200, 'Logout');
$assertSame(['authenticated' => false], $logout, 'Logout must report the resulting session state.');
$assertSame([], $session[REACT_API_SESSION_KEY]['history'], 'Logout must clear account-scoped history before another local user signs in.');
$assertSame([], $session[REACT_API_SESSION_KEY]['devices'], 'Logout must clear account-scoped devices before another local user signs in.');
$assertEnvelope($request('GET', 'account'), 401, 'Account after logout');

foreach (['register', 'recover', 'registration.code'] as $retiredAccountAction) {
    $assertEnvelope($request('POST', $retiredAccountAction, [], [], $csrfHeader), 404, 'Retired account action ' . $retiredAccountAction);
}

echo "React API adapter tests passed.\n";
