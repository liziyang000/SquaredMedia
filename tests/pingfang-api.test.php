<?php
declare(strict_types=1);

use addons\pingfangapi\service\AccountService;
use addons\pingfangapi\service\ApiException;
use addons\pingfangapi\service\ApiRequest;
use addons\pingfangapi\service\ContentService;

require_once dirname(__DIR__) . '/addons/pingfangapi/service/ApiException.php';
require_once dirname(__DIR__) . '/addons/pingfangapi/service/ContentService.php';
require_once dirname(__DIR__) . '/addons/pingfangapi/service/AccountService.php';
require_once dirname(__DIR__) . '/addons/pingfangapi/service/ApiRequest.php';

if (!function_exists('mac_url_img')) {
    function mac_url_img($value)
    {
        return (string) $value;
    }
}

if (!function_exists('url')) {
    function url($route)
    {
        return '/index.php/' . trim((string) $route, '/') . '.html';
    }
}

if (!function_exists('mac_alphaID')) {
    function mac_alphaID($id, $decode = false, $length = 0, $key = '')
    {
        return $decode ? intval(str_replace('alpha-', '', (string) $id)) : 'alpha-' . intval($id);
    }
}

final class PingfangApiFakeTypeModel
{
    public function getCache($name)
    {
        return [
            42 => [
                'type_id' => 42,
                'type_pid' => 0,
                'type_mid' => 1,
                'type_status' => 1,
                'type_name' => '电影',
                'type_sort' => 1,
            ],
            420 => [
                'type_id' => 420,
                'type_pid' => 42,
                'type_mid' => 1,
                'type_status' => 1,
                'type_name' => '受限电影',
                'type_sort' => 2,
            ],
        ];
    }
}

final class PingfangApiFakeVodModel
{
    public array $calls = [];

    public function listCacheData($params, $fields = '*')
    {
        $this->calls[] = ['params' => $params, 'fields' => $fields];
        return [
            'code' => 1,
            'list' => [[
                'vod_id' => 7,
                'vod_name' => '测试影片',
                'vod_remarks' => '正片',
                'vod_year' => '2026',
                'vod_class' => '剧情',
                'vod_score' => 8.5,
                'vod_pic' => '/upload/poster.jpg',
                'vod_pic_slide' => '/upload/backdrop.jpg',
                'vod_duration' => '120分钟',
                'vod_version' => '高清',
                'vod_blurb' => '简介',
                'vod_play_from' => 'local',
                'vod_play_url' => '第1集$https://media.example/private.m3u8',
                'vod_play_server' => '',
                'vod_play_note' => '',
            ]],
        ];
    }
}

if (!function_exists('model')) {
    function model($name)
    {
        return $GLOBALS['pingfangApiModels'][(string) $name] ?? null;
    }
}

if (!function_exists('mac_play_list')) {
    function mac_play_list()
    {
        return [1 => ['urls' => [1 => ['name' => '第1集']]]];
    }
}

if (!function_exists('mac_get_popedom_filter')) {
    function mac_get_popedom_filter()
    {
        return (string) ($GLOBALS['pingfangApiBlockedTypeIds'] ?? '');
    }
}

final class PingfangApiFakeContent extends ContentService
{
    public array $episodeChecks = [];
    public array $contentQueries = [];
    public array $detailIds = [];
    public array $accessInput = [];
    public array $passwordInput = [];
    public array $videoChecks = [];
    public array $commentChecks = [];

    private function video()
    {
        $episode = ['id' => '1', 'no' => 1, 'name' => '第1集', 'sourceId' => '1'];
        return [
            'id' => '7',
            'typeId' => '1',
            'typeName' => '电影',
            'title' => '测试影片',
            'remark' => '正片',
            'actor' => '',
            'director' => '',
            'year' => '2026',
            'area' => '',
            'class' => '剧情',
            'lang' => '',
            'letter' => 'C',
            'hits' => 1,
            'score' => 8.5,
            'updated' => '2026-07-21 12:00:00',
            'poster' => '/upload/poster.jpg',
            'backdrop' => '/upload/backdrop.jpg',
            'duration' => '120分钟',
            'version' => '正片',
            'summary' => '简介',
            'episodes' => [$episode],
            'playSources' => [[
                'id' => '1',
                'name' => '主线路',
                'tip' => '高清',
                'episodes' => [$episode],
            ]],
            'scoreCount' => 12,
            'likes' => 9,
            'dislikes' => 1,
        ];
    }

    public function home()
    {
        $video = $this->video();
        return [
            'siteName' => '平方影视',
            'todayUpdated' => 1,
            'hotSearch' => [],
            'categories' => [['id' => '1', 'name' => '电影']],
            'videos' => [[
                'id' => $video['id'],
                'title' => $video['title'],
                'category' => $video['typeName'],
                'remark' => $video['remark'],
                'year' => $video['year'],
                'class' => $video['class'],
                'hits' => $video['hits'],
                'score' => $video['score'],
                'updated' => $video['updated'],
                'poster' => $video['poster'],
                'backdrop' => $video['backdrop'],
                'duration' => $video['duration'],
                'version' => $video['version'],
                'summary' => $video['summary'],
                'episodes' => $video['episodes'],
            ]],
        ];
    }

    public function navigation()
    {
        return [
            'siteName' => '平方影视',
            'categories' => [['id' => '1', 'name' => '电影']],
        ];
    }

    public function homeV2($compact = false)
    {
        $video = $this->video();
        $card = [
            'id' => $video['id'],
            'title' => $video['title'],
            'remark' => $video['remark'],
            'year' => $video['year'],
            'class' => $video['class'],
            'score' => $video['score'],
            'poster' => $video['poster'],
        ];

        $home = [
            'siteName' => '平方影视',
            'todayUpdated' => 1,
            'categories' => [['id' => '1', 'name' => '电影']],
            'hero' => [[
                'id' => $video['id'],
                'title' => $video['title'],
                'year' => $video['year'],
                'class' => $video['class'],
                'backdrop' => $video['backdrop'],
                'duration' => $video['duration'],
                'version' => $video['version'],
                'summary' => $video['summary'],
                'episodes' => $video['episodes'],
            ]],
            'ranking' => [$card],
            'latest' => [$card],
            'latestByCategory' => [['categoryId' => '1', 'videos' => [$card]]],
        ];
        if (!$compact) {
            $home = array_slice($home, 0, 2, true) + ['hotSearch' => []] + array_slice($home, 2, null, true);
        }
        if ($compact) {
            $home['hero'][0]['episodes'] = [['id' => '1', 'sourceId' => '1']];
        }
        return $home;
    }

    public function contentPage(array $query)
    {
        $this->contentQueries[] = $query;
        if (!empty($query['compact'])) {
            $video = [
                'id' => '7',
                'title' => '测试影片',
                'remark' => '正片',
                'year' => '2026',
                'class' => '剧情',
                'score' => 8.5,
                'poster' => '/upload/poster.jpg',
            ];
            if (array_key_exists('keyword', $query)) {
                $video += ['typeName' => '电影', 'actor' => '', 'summary' => '简介'];
            }
            return [
                'siteName' => '平方影视',
                'categories' => !empty($query['includeCategoryTotals'])
                    ? [['id' => '1', 'name' => '电影', 'total' => 1]]
                    : [['id' => '1', 'name' => '电影']],
                'categoryContext' => ['current' => null, 'parent' => null, 'children' => []],
                'facets' => [
                    'areas' => !empty($query['includeFacets']) ? ['中国大陆'] : [],
                    'years' => !empty($query['includeFacets']) ? ['2026'] : [],
                    'langs' => !empty($query['includeFacets']) ? ['国语'] : [],
                    'classes' => !empty($query['includeFacets']) ? ['剧情'] : [],
                ],
                'videos' => [$video],
                'total' => 1,
                'page' => $query['page'],
                'totalPages' => 1,
            ];
        }
        return [
            'siteName' => '平方影视',
            'todayUpdated' => 1,
            'contentYear' => '2026',
            'hotSearch' => [],
            'categories' => [['id' => '1', 'name' => '电影', 'total' => 1]],
            'categoryContext' => ['current' => null, 'parent' => null, 'children' => []],
            'facets' => ['areas' => ['中国大陆'], 'years' => ['2026'], 'langs' => ['国语'], 'classes' => ['剧情']],
            'videos' => [$this->video()],
            'total' => 1,
            'page' => $query['page'],
            'pageSize' => $query['pageSize'],
            'totalPages' => 1,
        ];
    }

    public function detail($vodId, $compact = false)
    {
        $this->detailIds[] = (int) $vodId;
        $video = $this->video();
        if ($compact) {
            unset($video['typeId'], $video['letter'], $video['version']);
        }
        $related = [];
        if ($compact) {
            $related[] = [
                'id' => '8',
                'title' => '相关影片',
                'remark' => '正片',
                'year' => '2026',
                'class' => '剧情',
                'score' => 8.1,
                'poster' => '/upload/related.jpg',
            ];
        }
        return ['siteName' => '平方影视', 'video' => $video, 'related' => $related];
    }

    public function playback($vodId, $sourceId, $episodeId)
    {
        $this->assertEpisode($vodId, $sourceId, $episodeId);
        return [
            'siteName' => '平方影视',
            'vodId' => (string) $vodId,
            'sourceId' => (string) $sourceId,
            'episodeId' => (string) $episodeId,
            'title' => '测试影片',
            'episodeName' => '第1集',
            'poster' => '/upload/poster.jpg',
            'playSources' => [[
                'id' => '1',
                'name' => '高清线路',
                'tip' => '',
                'episodes' => [['id' => '1', 'no' => 1, 'name' => '第1集', 'sourceId' => '1']],
            ]],
            'kind' => 'iframe',
            'url' => '/index.php/pingfangapi/player/id/7/sid/1/nid/1.html',
        ];
    }

    public function access($vodId, $scope, $sourceId = 0, $episodeId = 0)
    {
        $this->accessInput[] = [(int) $vodId, (string) $scope, (int) $sourceId, (int) $episodeId];
        return [
            'siteName' => '平方影视',
            'video' => ['id' => (string) $vodId, 'title' => '测试影片'],
            'scope' => (string) $scope,
            'state' => 'allowed',
            'authorized' => true,
            'passwordRequired' => false,
            'message' => '允许访问',
            'points' => 0,
            'tryseeMinutes' => 0,
        ];
    }

    public function downloads($vodId)
    {
        return [
            'siteName' => '平方影视',
            'video' => ['id' => (string) $vodId, 'title' => '测试影片'],
            'access' => ['state' => 'allowed', 'authorized' => true, 'passwordRequired' => false, 'message' => '允许访问', 'points' => 0],
            'sources' => [[
                'id' => '2',
                'name' => '网盘下载',
                'tip' => '需要客户端',
                'items' => [['id' => '3', 'name' => '1080P', 'href' => '/index.php/vod/down/id/7/sid/2/nid/3.html']],
            ]],
        ];
    }

    public function plot($vodId)
    {
        return [
            'siteName' => '平方影视',
            'video' => ['id' => (string) $vodId, 'title' => '测试影片', 'summary' => '简介'],
            'items' => [['name' => '第一集', 'detail' => '真实剧情']],
        ];
    }

    public function verifyPassword($vodId, $scope, $password)
    {
        $this->passwordInput[] = [(int) $vodId, (string) $scope, (string) $password];
        return ['vodId' => (string) $vodId, 'scope' => (string) $scope, 'authorized' => true];
    }

    public function assertEpisode($vodId, $sourceId, $episodeId)
    {
        $this->episodeChecks[] = [(int) $vodId, (int) $sourceId, (int) $episodeId];
        if ((int) $vodId !== 7 || (int) $sourceId !== 1 || (int) $episodeId !== 1) {
            throw new ApiException(404, '播放资源不存在');
        }
    }

    public function assertVideo($vodId)
    {
        $this->videoChecks[] = (int) $vodId;
        if ((int) $vodId !== 7) {
            throw new ApiException(404, '影片不存在');
        }
    }

    public function assertComment($commentId)
    {
        $this->commentChecks[] = (int) $commentId;
        if ((int) $commentId !== 3) {
            throw new ApiException(404, '评论不存在');
        }
    }

    public function comments($vodId, $mid)
    {
        if ((int) $vodId !== 7 || (int) $mid !== 1) {
            throw new ApiException(404, '影片不存在');
        }
        return [[
            'id' => '3',
            'author' => '测试用户',
            'content' => '测试评论',
            'createdAt' => '2026-07-21T12:00:00+08:00',
            'likes' => 0,
            'dislikes' => 0,
        ]];
    }
}

final class PingfangApiContentTotalProbe extends ContentService
{
    public function categoryTotal(array $query, array $categories)
    {
        return $this->categoryTotalForQuery($query, $categories);
    }

    public function forcedIndex(array $query, string $sort): string
    {
        return $this->forcedIndexForQuery($query, $sort);
    }

    public function primaryScan(array $query, array $types): bool
    {
        return $this->shouldUsePrimaryScan($query, $types);
    }

    public function routeId(array $row)
    {
        return $this->nativeVodRouteId($row);
    }

    public function state(array $row, string $scope, int $sourceId = 0, int $episodeId = 0): array
    {
        return $this->accessState($row, $scope, $sourceId, $episodeId);
    }

    public function gateProjection(string $scope, bool $withEpisode): array
    {
        return explode(',', $this->gateFields($scope, $withEpisode));
    }

    public function checkAccessEpisode(array $row, string $scope, int $sourceId, int $episodeId): void
    {
        $this->assertAccessEpisode($row, $scope, $sourceId, $episodeId);
    }

    public function checkPlaybackAccess(array $row, int $sourceId, int $episodeId): void
    {
        $this->assertPlaybackAccess($row, $sourceId, $episodeId);
    }

    public function typeIds(array $query, array $types): array
    {
        return $this->typeIdsForQuery($query, $types);
    }

    public function catalog(array $types, string $scope): array
    {
        return $this->catalogCategories($types, $scope);
    }

    public function facetFilters(array $query, string $without): array
    {
        return $this->facetQuery($query, $without);
    }
}

final class PingfangApiFakeAccount extends AccountService
{
    public ?array $user = null;
    public string $csrf = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    public array $loginInput = [];
    public array $favoriteInput = [];
    public array $historyInput = [];
    public array $historyLimits = [];
    public array $feedbackInput = [];
    public array $reportInput = [];
    public array $commentInput = [];
    public array $reactionInput = [];
    public array $ratingInput = [];
    public array $rateActions = [];

    public function sessionData()
    {
        return [
            'authenticated' => $this->user !== null,
            'csrfToken' => $this->csrf,
            'user' => $this->user === null ? null : ['id' => (string) $this->user['user_id'], 'name' => $this->user['user_name']],
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

    public function currentUser()
    {
        return $this->user;
    }

    public function csrfToken()
    {
        return $this->csrf;
    }

    public function login($username, $password, $captcha)
    {
        $this->loginInput = [$username, $password, $captcha];
        $this->user = ['user_id' => 42, 'user_name' => 'alice'];
        return $this->sessionData();
    }

    public function logout()
    {
        $this->user = null;
        return ['authenticated' => false];
    }

    public function favorites($userId)
    {
        return [];
    }

    public function setFavorite($userId, $vodId, $favorite)
    {
        $this->favoriteInput = [$userId, $vodId, $favorite];
        return ['vodId' => (string) $vodId, 'favorited' => (bool) $favorite];
    }

    public function deleteFavorites($userId, array $recordIds, $all)
    {
        return ['removed' => $all ? 2 : count($recordIds)];
    }

    public function history($userId, $limit = 100)
    {
        $this->historyLimits[] = (int) $limit;
        return [];
    }

    public function saveHistory($userId, $vodId, $sourceId, $episodeId, $position, $duration)
    {
        $this->historyInput = [$userId, $vodId, $sourceId, $episodeId, $position, $duration];
        return ['saved' => true];
    }

    public function deleteHistory($userId, array $recordIds, $all)
    {
        return ['removed' => $all ? 2 : count($recordIds)];
    }

    public function devices($userId)
    {
        return [
            'maxDevices' => 3,
            'items' => [[
                'sessionId' => '9',
                'name' => 'macOS · Safari',
                'browser' => 'Safari',
                'os' => 'macOS',
                'loginAt' => '2026-07-21T10:00:00+08:00',
                'lastActiveAt' => '2026-07-21T12:00:00+08:00',
                'ipAddress' => '127.0.0.1',
                'userAgent' => 'Safari',
                'status' => '在线',
                'revokedAt' => null,
                'current' => true,
            ]],
        ];
    }

    public function revokeDevice($userId, $sessionId)
    {
        return ['sessionId' => (string) $sessionId, 'revoked' => true];
    }

    public function feedback($userId, $name, $content, $captcha)
    {
        $this->feedbackInput = [$userId, $name, $content, $captcha];
        return ['id' => '11', 'status' => 'pending'];
    }

    public function report($userId, $vodId, $sourceId, $episodeId, $reason, $details, $captcha)
    {
        $this->reportInput = [$userId, $vodId, $sourceId, $episodeId, $reason, $details, $captcha];
        return ['id' => '12', 'status' => 'pending'];
    }

    public function comment($userId, $mid, $vodId, $parentId, $content, $captcha)
    {
        $this->commentInput = [$userId, $mid, $vodId, $parentId, $content, $captcha];
        return ['id' => '13', 'status' => 'published'];
    }

    public function reaction($target, $targetId, $value)
    {
        $this->reactionInput = [$target, $targetId, $value];
        return ['target' => $target, 'targetId' => (string) $targetId, 'value' => $value, 'likes' => 1, 'dislikes' => 0];
    }

    public function rating($vodId, $score)
    {
        $this->ratingInput = [$vodId, $score];
        return ['vodId' => (string) $vodId, 'score' => $score, 'average' => 8.6, 'count' => 120];
    }

    public function guardRateLimit($action)
    {
        $this->rateActions[] = $action;
    }
}

$fail = static function (string $message): never {
    fwrite(STDERR, $message . "\n");
    exit(1);
};
$assert = static function (bool $condition, string $message) use ($fail): void {
    if (!$condition) {
        $fail($message);
    }
};
$assertSame = static function ($expected, $actual, string $message) use ($fail): void {
    if ($expected !== $actual) {
        $fail($message . "\nExpected: " . var_export($expected, true) . "\nActual: " . var_export($actual, true));
    }
};
$assertThrowsStatus = static function (callable $callback, int $status, string $message) use ($fail): void {
    try {
        $callback();
    } catch (ApiException $error) {
        if ($error->status() === $status) {
            return;
        }
        $fail($message . "\nExpected status: " . $status . "\nActual status: " . $error->status());
    }
    $fail($message . "\nNo ApiException was thrown.");
};
$assertEnvelope = static function (array $response, int $status, string $message) use ($assertSame) {
    $assertSame($status, $response['status'] ?? null, $message . ' must use the expected HTTP status.');
    $assertSame(['code', 'msg', 'data'], array_keys($response['body'] ?? []), $message . ' must use the common envelope.');
    $assertSame($status < 400 ? 1 : $status, $response['body']['code'], $message . ' must use a consistent code.');
    return $response['body']['data'];
};
$assertNoKeys = static function ($value, array $forbidden, string $path = 'data') use (&$assertNoKeys, $fail): void {
    if (!is_array($value)) {
        return;
    }
    foreach ($value as $key => $child) {
        if (is_string($key) && in_array($key, $forbidden, true)) {
            $fail('Forbidden field exposed at ' . $path . '.' . $key);
        }
        $assertNoKeys($child, $forbidden, $path . '.' . (string) $key);
    }
};

$content = new PingfangApiFakeContent(static function () {
    return ['code' => 1, 'msg' => 'ok'];
});
$account = new PingfangApiFakeAccount();
$api = new ApiRequest($content, $account);
$writeHeaders = [
    'Host' => 'video.example.com',
    'Origin' => 'https://video.example.com',
    'X-Pingfang-Request-Scheme' => 'https',
    'Sec-Fetch-Site' => 'same-origin',
    'X-Requested-With' => 'XMLHttpRequest',
    'X-CSRF-Token' => $account->csrf,
];
$request = static function (string $method, string $action, array $body = [], array $query = [], array $headers = []) use ($api) {
    return $api->handle($method, ['action' => $action] + $query, $body, $headers);
};

$homeResponse = $request('GET', 'home');
$home = $assertEnvelope($homeResponse, 200, 'Home');
$assertSame('private, no-store', $homeResponse['headers']['Cache-Control'], 'Home must not share a response that may carry MacCMS session cookies.');
$assertNoKeys($home, ['url', 'src', 'vod_play_url', 'token']);

$navigation = $assertEnvelope($request('GET', 'navigation'), 200, 'Navigation');
$assertSame(['siteName', 'categories'], array_keys($navigation), 'Navigation must expose only the shell metadata.');
$assertNoKeys($navigation, ['url', 'src', 'vod_play_url', 'token']);

$homeV2 = $assertEnvelope($request('GET', 'home_v2'), 200, 'Home v2');
$assertSame(
    ['siteName', 'todayUpdated', 'hotSearch', 'categories', 'hero', 'ranking', 'latest', 'latestByCategory'],
    array_keys($homeV2),
    'Home v2 must return pre-built homepage sections.'
);
$assertSame(1, count($homeV2['hero']), 'Home v2 must keep the hero bounded.');
$assertSame(1, count($homeV2['ranking']), 'Home v2 must keep the ranking bounded.');
$assertSame(1, count($homeV2['latest']), 'Home v2 must keep the latest shelf bounded.');
$assertSame(['id', 'title', 'remark', 'year', 'class', 'score', 'poster'], array_keys($homeV2['ranking'][0]), 'Home cards must use the compact field whitelist.');
$assertNoKeys($homeV2, ['url', 'src', 'vod_play_url', 'token']);

$compactHomeV2 = $assertEnvelope($request('GET', 'home_v2', [], ['compact' => '1']), 200, 'Compact home v2');
$assertSame(
    ['siteName', 'todayUpdated', 'categories', 'hero', 'ranking', 'latest', 'latestByCategory'],
    array_keys($compactHomeV2),
    'Compact home v2 must omit unused search metadata.'
);
$assertSame(['id', 'sourceId'], array_keys($compactHomeV2['hero'][0]['episodes'][0]), 'Compact home hero episodes must return navigation IDs only.');

$contentResponse = $request('GET', 'content', [], [
    'type_id' => '1',
    'area' => '中国大陆',
    'year' => '2026',
    'class' => '剧情',
    'lang' => '国语',
    'letter' => 'D',
    'sort' => 'hot',
    'page' => '2',
    'page_size' => '24',
    'keyword' => '测试',
]);
$catalog = $assertEnvelope($contentResponse, 200, 'Content');
$assertNoKeys($catalog, ['url', 'src', 'vod_play_url', 'token']);
$assertSame([
    'sort' => 'hot',
    'page' => 2,
    'pageSize' => 24,
    'typeId' => 1,
    'area' => '中国大陆',
    'year' => '2026',
    'class' => '剧情',
    'lang' => '国语',
    'letter' => 'D',
    'keyword' => '测试',
], $content->contentQueries[0], 'Content must pass only normalized server-side query values.');

$compactCatalog = $assertEnvelope($request('GET', 'content', [], [
    'compact' => '1',
    'include_category_totals' => '1',
    'include_facets' => '1',
    'page_size' => '24',
]), 200, 'Compact content');
$assertSame(
    ['siteName', 'categories', 'categoryContext', 'facets', 'videos', 'total', 'page', 'totalPages'],
    array_keys($compactCatalog),
    'Compact content must omit unused summary and page-size metadata.'
);
$assertSame(['id', 'title', 'remark', 'year', 'class', 'score', 'poster'], array_keys($compactCatalog['videos'][0]), 'Compact catalog cards must use the VodCard whitelist.');
$assertSame(['id', 'name', 'total'], array_keys($compactCatalog['categories'][0]), 'Category totals must be returned only when explicitly requested.');
$assertSame(['areas', 'years', 'langs', 'classes'], array_keys($compactCatalog['facets']), 'Compact content must return every native filter family.');
$assertSame([
    'sort' => 'latest',
    'page' => 1,
    'pageSize' => 24,
    'compact' => true,
    'includeCategoryTotals' => true,
    'includeFacets' => true,
], $content->contentQueries[1], 'Compact content flags must be normalized before reaching the service.');

$compactSearch = $assertEnvelope($request('GET', 'content', [], ['compact' => '1', 'keyword' => '测试']), 200, 'Compact search');
$assertSame(
    ['id', 'title', 'remark', 'year', 'class', 'score', 'poster', 'typeName', 'actor', 'summary'],
    array_keys($compactSearch['videos'][0]),
    'Compact searches must add only fields rendered by search results.'
);
$assertEnvelope($request('GET', 'content', [], ['include_facets' => '1']), 422, 'Compact-only content option without compact mode');
$assertEnvelope($request('GET', 'home_v2', [], ['compact' => 'yes']), 422, 'Invalid compact flag');

$detailResponse = $request('GET', 'detail', [], ['vod_id' => '7']);
$detail = $assertEnvelope($detailResponse, 200, 'Detail');
$assertSame('7', $detail['video']['id'], 'Detail must load one exact video.');
$assertSame([7], $content->detailIds, 'Detail must pass the normalized video ID.');
$assertNoKeys($detail, ['url', 'src', 'vod_play_url', 'token']);

$compactDetail = $assertEnvelope($request('GET', 'detail', [], ['vod_id' => '7', 'compact' => '1']), 200, 'Compact detail');
$assertSame(
    ['id', 'typeName', 'title', 'remark', 'actor', 'director', 'year', 'area', 'class', 'lang', 'hits', 'score', 'updated', 'poster', 'backdrop', 'duration', 'summary', 'episodes', 'playSources', 'scoreCount', 'likes', 'dislikes'],
    array_keys($compactDetail['video']),
    'Compact detail videos must omit fields not rendered by any React detail view.'
);
$assertSame(['id', 'title', 'remark', 'year', 'class', 'score', 'poster'], array_keys($compactDetail['related'][0]), 'Compact related videos must use the card whitelist.');

$access = $assertEnvelope($request('GET', 'access', [], [
    'vod_id' => '7',
    'scope' => 'playback',
    'source_id' => '1',
    'episode_id' => '1',
]), 200, 'Access');
$assertSame('allowed', $access['state'], 'Access must expose a structured gate state.');
$assertSame([[7, 'playback', 1, 1]], $content->accessInput, 'Access must pass the normalized scope and episode identifiers.');
$assertEnvelope($request('GET', 'access', [], ['vod_id' => '7', 'scope' => 'unsupported']), 422, 'Invalid access scope');
$assertEnvelope($request('GET', 'access', [], ['vod_id' => '7', 'scope' => 'playback', 'source_id' => '1']), 422, 'Incomplete access episode');

$downloads = $assertEnvelope($request('GET', 'downloads', [], ['vod_id' => '7']), 200, 'Downloads');
$assertSame('网盘下载', $downloads['sources'][0]['name'], 'Downloads must use the dedicated download list.');
$assertNoKeys($downloads, ['url', 'src', 'vod_down_url', 'vod_play_url']);
$assert(str_starts_with($downloads['sources'][0]['items'][0]['href'], '/index.php/vod/down/'), 'Downloads may expose only a native same-origin authorization entry.');

$plot = $assertEnvelope($request('GET', 'plot', [], ['vod_id' => '7']), 200, 'Plot');
$assertSame([['name' => '第一集', 'detail' => '真实剧情']], $plot['items'], 'Plot must return native plot entries.');

$playbackResponse = $request('GET', 'playback', [], ['vod_id' => '7', 'source_id' => '1', 'episode_id' => '1']);
$playback = $assertEnvelope($playbackResponse, 200, 'Playback');
$assertSame('private, no-store', $playbackResponse['headers']['Cache-Control'], 'Playback must never be cached.');
$assertSame('iframe', $playback['kind'], 'Production playback must use the native MacCMS iframe.');
$assert(str_starts_with($playback['url'], '/index.php/pingfangapi/player/'), 'Playback must return only the access-controlled player route.');

$wrongMethod = $request('POST', 'content', [], [], $writeHeaders);
$assertEnvelope($wrongMethod, 405, 'Wrong method');
$assertSame('GET', $wrongMethod['headers']['Allow'], 'Wrong methods must advertise the allowed method.');
$assertEnvelope($api->handle('GET', [], [], []), 400, 'Missing action');
$assertEnvelope($request('GET', 'missing'), 404, 'Unknown action');
$assertEnvelope($request('GET', 'content', [], ['unexpected' => '1']), 400, 'Unknown query field');
$assertEnvelope($request('GET', 'content', [], ['page_size' => '101']), 422, 'Oversized page');
$assertEnvelope($request('GET', 'content', [], ['sort' => 'random']), 422, 'Unknown sort');

$sessionResponse = $request('GET', 'session');
$session = $assertEnvelope($sessionResponse, 200, 'Anonymous session');
$assertSame(false, $session['authenticated'], 'Initial session must be anonymous.');
$assertSame($account->csrf, $session['csrfToken'], 'Anonymous session must bootstrap CSRF.');
$assertSame(false, $session['requirements']['feedbackLogin'], 'Session must expose the native feedback login policy.');
$assertSame(false, $session['requirements']['commentLogin'], 'Session must expose the native comment login policy.');
$assertEnvelope($request('GET', 'favorites'), 401, 'Anonymous favorites');
$assertEnvelope($request('GET', 'history'), 401, 'Anonymous history');
$assertEnvelope($request('GET', 'devices'), 401, 'Anonymous devices');
$assertEnvelope($request('POST', 'logout', [], [], $writeHeaders), 401, 'Anonymous logout');
$assertEnvelope($request('POST', 'favorite', ['vodId' => '7', 'favorite' => true], [], $writeHeaders), 401, 'Anonymous favorite write');
$assertEnvelope($request('POST', 'favorites.delete', ['recordIds' => ['71']], [], $writeHeaders), 401, 'Anonymous favorite delete');
$assertEnvelope($request('POST', 'history.save', [
    'vodId' => '7',
    'sourceId' => '1',
    'episodeId' => '1',
    'positionSeconds' => 0,
], [], $writeHeaders), 401, 'Anonymous history write');
$assertEnvelope($request('POST', 'history.delete', ['recordIds' => ['81']], [], $writeHeaders), 401, 'Anonymous history delete');
$assertEnvelope($request('POST', 'device.revoke', ['sessionId' => '9'], [], $writeHeaders), 401, 'Anonymous device revoke');

$password = $assertEnvelope($request('POST', 'password.verify', [
    'vodId' => '7',
    'scope' => 'detail',
    'password' => 'secret',
], [], $writeHeaders), 200, 'Anonymous content password verification');
$assertSame(['vodId' => '7', 'scope' => 'detail', 'authorized' => true], $password, 'Password verification must use the native scoped session contract.');
$assertSame([[7, 'detail', 'secret']], $content->passwordInput, 'Password verification must pass only the normalized scope and secret.');
$assertEnvelope($request('POST', 'password.verify', ['vodId' => '7', 'scope' => 'confirm', 'password' => 'secret'], [], $writeHeaders), 422, 'Invalid password scope');

$interactionConfig = $GLOBALS['config'] ?? [];
$GLOBALS['config']['gbook']['login'] = 0;
$GLOBALS['config']['comment']['login'] = 0;
$videoChecksBeforeStandaloneReport = count($content->videoChecks);
$standaloneReport = $assertEnvelope($request('POST', 'report', [
    'reason' => '其他',
    'details' => '旧报错页面直达提交',
], [], $writeHeaders), 200, 'Anonymous standalone report');
$assertSame(['id' => '12', 'status' => 'pending'], $standaloneReport, 'Standalone reports must keep the native moderation state.');
$assertSame([0, 0, 0, 0, '其他', '旧报错页面直达提交', ''], $account->reportInput, 'Standalone reports must not invent a video context.');
$assertSame($videoChecksBeforeStandaloneReport, count($content->videoChecks), 'Standalone reports must not validate a missing video.');
$assertEnvelope($request('POST', 'report', [
    'sourceId' => '1',
    'episodeId' => '1',
    'reason' => '无法播放',
], [], $writeHeaders), 422, 'Report episode without video');

$anonymousFeedback = $assertEnvelope($request('POST', 'feedback', ['name' => '访客', 'content' => '匿名留言'], [], $writeHeaders), 200, 'Anonymous feedback when enabled');
$assertSame(['id' => '11', 'status' => 'pending'], $anonymousFeedback, 'Anonymous feedback must use the native moderation state.');
$assertSame([0, '访客', '匿名留言', ''], $account->feedbackInput, 'Anonymous feedback must be persisted as a guest.');
$anonymousComment = $assertEnvelope($request('POST', 'comment', ['mid' => '1', 'vodId' => '7', 'content' => '匿名评论'], [], $writeHeaders), 200, 'Anonymous comment when enabled');
$assertSame(['id' => '13', 'status' => 'published'], $anonymousComment, 'Anonymous comments must use the native moderation state.');
$assertSame([0, 1, 7, 0, '匿名评论', ''], $account->commentInput, 'Anonymous comments must be persisted as a guest.');
$anonymousReaction = $assertEnvelope($request('POST', 'reaction', ['target' => 'vod', 'targetId' => '7', 'value' => 'like'], [], $writeHeaders), 200, 'Anonymous reaction');
$assertSame('like', $anonymousReaction['value'], 'Anonymous reactions must remain available.');
$anonymousRating = $assertEnvelope($request('POST', 'rating', ['vodId' => '7', 'score' => 8], [], $writeHeaders), 200, 'Anonymous rating');
$assertSame(8, $anonymousRating['score'], 'Anonymous ratings must remain available.');

$GLOBALS['config']['gbook']['login'] = 1;
$GLOBALS['config']['comment']['login'] = 1;
$assertEnvelope($request('POST', 'feedback', ['content' => '需要登录'], [], $writeHeaders), 401, 'Anonymous feedback when login is required');
$assertEnvelope($request('POST', 'report', ['reason' => '需要登录'], [], $writeHeaders), 401, 'Anonymous report when login is required');
$assertEnvelope($request('POST', 'comment', ['vodId' => '7', 'content' => '需要登录'], [], $writeHeaders), 401, 'Anonymous comment when login is required');
$assertEnvelope($request('POST', 'reaction', ['target' => 'vod', 'targetId' => '7', 'value' => 'like'], [], $writeHeaders), 200, 'Anonymous reaction with private comments');
$assertEnvelope($request('POST', 'rating', ['vodId' => '7', 'score' => 7], [], $writeHeaders), 200, 'Anonymous rating with private comments');
$GLOBALS['config'] = $interactionConfig;

foreach (['register', 'recover', 'registration.code'] as $retiredAccountAction) {
    $assertEnvelope($request('POST', $retiredAccountAction, [], [], $writeHeaders), 404, 'Retired account action ' . $retiredAccountAction);
}

$assertEnvelope($request('POST', 'login', ['username' => 'alice', 'password' => 'secret']), 403, 'Login without source headers');
$crossOriginHeaders = $writeHeaders;
$crossOriginHeaders['Origin'] = 'https://evil.example';
$assertEnvelope($request('POST', 'login', ['username' => 'alice', 'password' => 'secret'], [], $crossOriginHeaders), 403, 'Cross-origin login');
$crossSchemeHeaders = $writeHeaders;
$crossSchemeHeaders['Origin'] = 'http://video.example.com';
$assertEnvelope($request('POST', 'login', ['username' => 'alice', 'password' => 'secret'], [], $crossSchemeHeaders), 403, 'Cross-scheme login');
$badCsrfHeaders = $writeHeaders;
$badCsrfHeaders['X-CSRF-Token'] = str_repeat('b', 64);
$assertEnvelope($request('POST', 'login', ['username' => 'alice', 'password' => 'secret'], [], $badCsrfHeaders), 403, 'Login with invalid CSRF');
$assertEnvelope($request('POST', 'login', ['username' => 'alice', 'password' => 'secret', 'openid' => 'forbidden'], [], $writeHeaders), 422, 'Login with an unsupported field');
$login = $assertEnvelope($request('POST', 'login', ['username' => 'alice', 'password' => 'secret', 'captcha' => '1234'], [], $writeHeaders), 200, 'Login');
$assertSame(['alice', 'secret', '1234'], $account->loginInput, 'Login must pass only whitelisted native credentials.');
$assertSame(true, $login['authenticated'], 'Successful login must return an authenticated session.');
$assertNoKeys($login, ['user_random', 'user_check', 'token_hash']);

$devices = $assertEnvelope($request('GET', 'devices'), 200, 'Devices');
$assertSame(['maxDevices', 'items'], array_keys($devices), 'Devices must expose the configured limit beside the session list.');
$assertSame(
    ['sessionId', 'name', 'browser', 'os', 'loginAt', 'lastActiveAt', 'ipAddress', 'userAgent', 'status', 'revokedAt', 'current'],
    array_keys($devices['items'][0]),
    'Device sessions must retain the native security and status fields.'
);

$assertEnvelope($request('POST', 'register', ['username' => 'newuser', 'password' => 'secret'], [], $writeHeaders), 404, 'Retired registration while logged in');

$feedback = $assertEnvelope($request('POST', 'feedback', ['name' => '测试用户', 'content' => '测试留言'], [], $writeHeaders), 200, 'Feedback');
$assertSame(['id' => '11', 'status' => 'pending'], $feedback, 'Feedback must return its native moderation state.');
$report = $assertEnvelope($request('POST', 'report', ['vodId' => '7', 'sourceId' => '1', 'episodeId' => '1', 'reason' => '无法播放', 'details' => '黑屏'], [], $writeHeaders), 200, 'Report');
$assertSame(['id' => '12', 'status' => 'pending'], $report, 'Report must return its native moderation state.');
$comment = $assertEnvelope($request('POST', 'comment', ['mid' => '1', 'vodId' => '7', 'content' => '很好看'], [], $writeHeaders), 200, 'Comment');
$assertSame(['id' => '13', 'status' => 'published'], $comment, 'Comment must return its native moderation state.');
$reaction = $assertEnvelope($request('POST', 'reaction', ['target' => 'comment', 'targetId' => '3', 'value' => 'like'], [], $writeHeaders), 200, 'Reaction');
$assertSame(['target' => 'comment', 'targetId' => '3', 'value' => 'like', 'likes' => 1, 'dislikes' => 0], $reaction, 'Reaction must return persisted native counters.');
$assertSame([3], $content->commentChecks, 'Comment reactions must verify the comment and parent video access.');
$rating = $assertEnvelope($request('POST', 'rating', ['vodId' => '7', 'score' => 9], [], $writeHeaders), 200, 'Rating');
$assertSame(['vodId' => '7', 'score' => 9, 'average' => 8.6, 'count' => 120], $rating, 'Rating must return the native aggregate.');
$assertEnvelope($request('POST', 'rating', ['vodId' => '7', 'score' => 8.5], [], $writeHeaders), 422, 'Fractional rating');

$favorite = $assertEnvelope($request('POST', 'favorite', ['vodId' => '7', 'favorite' => true], [], $writeHeaders), 200, 'Favorite');
$assertSame(['42', 7, true], [(string) $account->favoriteInput[0], $account->favoriteInput[1], $account->favoriteInput[2]], 'Favorite writes must be bound to the current user.');
$assertSame(['vodId' => '7', 'favorited' => true], $favorite, 'Favorite must return persisted state.');
$assertEnvelope($request('POST', 'favorite', ['vodId' => '7', 'favorite' => 1], [], $writeHeaders), 422, 'Non-boolean favorite');
$assertEnvelope($request('POST', 'favorites.delete', [], [], $writeHeaders), 422, 'Empty favorite delete');
$assertEnvelope($request('POST', 'favorites.delete', ['all' => true, 'recordIds' => ['71']], [], $writeHeaders), 422, 'Ambiguous favorite delete');
$assertEnvelope($request('POST', 'favorites.delete', ['recordIds' => ['key' => '71']], [], $writeHeaders), 422, 'Object-shaped favorite delete');
$deleteFavorite = $assertEnvelope($request('POST', 'favorites.delete', ['recordIds' => ['71']], [], $writeHeaders), 200, 'Favorite delete');
$assertSame(['removed' => 1], $deleteFavorite, 'Favorite delete must report removed rows.');

$assertEnvelope($request('GET', 'history', [], ['limit' => '4']), 200, 'Bounded history');
$assertSame([4], $account->historyLimits, 'History must pass the validated response limit to the account service.');
$assertEnvelope($request('GET', 'history', [], ['limit' => '101']), 422, 'Oversized history limit');

$historyBody = [
    'vodId' => '7',
    'sourceId' => '1',
    'episodeId' => '1',
    'positionSeconds' => 37.9,
    'durationSeconds' => 120,
];
$history = $assertEnvelope($request('POST', 'history.save', $historyBody, [], $writeHeaders), 200, 'History save');
$assertSame(['saved' => true], $history, 'History save must return the persisted state.');
$assertSame([42, 7, 1, 1, 37, 120], $account->historyInput, 'History save must use validated integer seconds and current user.');
$assertSame([7, 1, 1], $content->episodeChecks[array_key_last($content->episodeChecks)], 'History must verify episode ownership.');
$invalidProgress = $historyBody;
$invalidProgress['positionSeconds'] = 121;
$assertEnvelope($request('POST', 'history.save', $invalidProgress, [], $writeHeaders), 422, 'History position beyond duration');
$subsecondDuration = $historyBody;
$subsecondDuration['durationSeconds'] = 0.5;
$assertEnvelope($request('POST', 'history.save', $subsecondDuration, [], $writeHeaders), 422, 'Subsecond history duration');
$unknownEpisode = $historyBody;
$unknownEpisode['episodeId'] = '2';
$assertEnvelope($request('POST', 'history.save', $unknownEpisode, [], $writeHeaders), 404, 'History unknown episode');
$deleteHistory = $assertEnvelope($request('POST', 'history.delete', ['recordIds' => ['81', '82']], [], $writeHeaders), 200, 'History delete');
$assertSame(['removed' => 2], $deleteHistory, 'History delete must target only the selected native Ulog rows.');

$device = $assertEnvelope($request('POST', 'device.revoke', ['sessionId' => '9'], [], $writeHeaders), 200, 'Device revoke');
$assertSame(['sessionId' => '9', 'revoked' => true], $device, 'Device revoke must return the session ID.');
$assertEnvelope($request('POST', 'device.revoke', ['sessionId' => 'local-current'], [], $writeHeaders), 422, 'Non-native device ID');

$comments = $assertEnvelope($request('GET', 'comments', [], ['content_id' => '7']), 200, 'Comments');
$assertSame(1, count($comments['items']), 'Comments must return approved DTOs.');
$assertNoKeys($comments, ['vod_play_url', 'user_id', 'ip']);

$logout = $assertEnvelope($request('POST', 'logout', [], [], $writeHeaders), 200, 'Logout');
$assertSame(['authenticated' => false], $logout, 'Logout must clear authentication.');

$assertSame(['value' => 1], ApiRequest::decodeJson('application/json; charset=utf-8', '{"value":1}'), 'JSON objects must decode.');
$assertThrowsStatus(static fn () => ApiRequest::decodeJson('text/plain', '{}'), 415, 'Non-JSON bodies must be rejected.');
$assertThrowsStatus(static fn () => ApiRequest::decodeJson('application/json', '[]'), 422, 'JSON arrays must be rejected.');
$assertThrowsStatus(static fn () => ApiRequest::decodeJson('application/json', '{'), 400, 'Malformed JSON must be rejected.');
$assertThrowsStatus(static fn () => ApiRequest::decodeJson('application/json', '{"value":"' . str_repeat('x', ApiRequest::MAX_BODY_BYTES) . '"}'), 413, 'Oversized JSON must be rejected.');

$mapped = ContentService::mapVideoRow(
    [
        'vod_id' => 7,
        'type_id' => 1,
        'vod_name' => '测试影片',
        'vod_pic' => '/upload/poster.jpg',
        'vod_blurb' => '不应优先展示的短简介',
        'vod_content' => '<p>' . str_repeat('剧', 200) . '</p>',
        'vod_play_url' => '第1集$https://media.example/private.m3u8',
    ],
    [1 => ['type_id' => 1, 'type_pid' => 0, 'type_name' => '电影']],
    [1 => ['urls' => [1 => ['name' => '第1集', 'url' => 'https://media.example/private.m3u8']]]],
    '/template/pingfangvideo/images/brand/lazyload.png'
);
$assertNoKeys($mapped, ['url', 'src', 'vod_play_url']);
$assert(!str_contains(json_encode($mapped, JSON_UNESCAPED_SLASHES), 'media.example'), 'Mapped catalog data must not contain raw media hosts.');
$assertSame(str_repeat('剧', 180), $mapped['summary'], 'Detail summaries must preserve the PingFangVideo vod_content-first 180-character behavior.');

$cardRow = [
    'vod_id' => 7,
    'type_id' => 1,
    'vod_name' => '测试影片',
    'vod_remarks' => '正片',
    'vod_year' => '2026',
    'vod_class' => '剧情',
    'vod_score' => 8.5,
    'vod_pic' => '/upload/poster.jpg',
    'vod_actor' => '测试演员',
    'vod_blurb' => '精简简介',
    'vod_content' => '不应读取或返回的完整正文',
    'vod_play_url' => '第1集$https://media.example/private.m3u8',
];
$card = ContentService::mapContentCardRow(
    $cardRow,
    [1 => ['type_id' => 1, 'type_pid' => 0, 'type_name' => '电影']],
    '/template/pingfangvideo/images/brand/lazyload.png'
);
$assertSame(
    ['id', 'title', 'remark', 'year', 'class', 'score', 'poster'],
    array_keys($card),
    'Catalog cards must expose only fields rendered by VodCard.'
);
$searchCard = ContentService::mapContentCardRow(
    $cardRow,
    [1 => ['type_id' => 1, 'type_pid' => 0, 'type_name' => '电影']],
    '/template/pingfangvideo/images/brand/lazyload.png',
    true
);
$assertSame(
    ['id', 'title', 'remark', 'year', 'class', 'score', 'poster', 'typeName', 'actor', 'summary'],
    array_keys($searchCard),
    'Search cards may add only the three fields rendered by search results.'
);
$assert(!str_contains(json_encode($searchCard, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), '完整正文'), 'Search cards must not fall back to the full Vod content body.');

$homeRow = [
    'vod_id' => 7,
    'vod_name' => '测试影片',
    'vod_remarks' => '正片',
    'vod_year' => '2026',
    'vod_class' => '剧情',
    'vod_score' => 8.5,
    'vod_pic' => '/upload/poster.jpg',
    'vod_pic_slide' => '/upload/backdrop.jpg',
    'vod_duration' => '120分钟',
    'vod_version' => '高清',
    'vod_blurb' => '简介',
];
$homeCard = ContentService::mapHomeCardRow($homeRow, '/template/pingfangvideo/images/brand/lazyload.png');
$assertSame(['id', 'title', 'remark', 'year', 'class', 'score', 'poster'], array_keys($homeCard), 'Home cards must not carry detail or playback fields.');
$homeHero = ContentService::mapHomeHeroRow(
    $homeRow,
    [1 => ['urls' => [1 => ['name' => '第1集', 'url' => 'https://media.example/private.m3u8'], 2 => ['name' => '第2集']]]],
    '/template/pingfangvideo/images/brand/lazyload.png'
);
$assertSame(
    ['id', 'title', 'year', 'class', 'backdrop', 'duration', 'version', 'summary', 'episodes'],
    array_keys($homeHero),
    'Home hero items must use the compact hero whitelist.'
);
$assertSame([['id' => '1', 'no' => 1, 'name' => '第1集', 'sourceId' => '1']], $homeHero['episodes'], 'Home hero items must retain only the first safe episode descriptor.');
$assert(!str_contains(json_encode($homeHero, JSON_UNESCAPED_SLASHES), 'media.example'), 'Home hero data must not expose raw media hosts.');
$compactHomeHero = ContentService::mapHomeHeroRow(
    $homeRow,
    [1 => ['urls' => [1 => ['name' => '第1集', 'url' => 'https://media.example/private.m3u8']]]],
    '/template/pingfangvideo/images/brand/lazyload.png',
    true
);
$assertSame([['id' => '1', 'sourceId' => '1']], $compactHomeHero['episodes'], 'Compact home hero items must omit unused episode labels and ordinals.');

$totalProbe = new PingfangApiContentTotalProbe(static function () {
    return ['code' => 1, 'msg' => 'ok'];
});
$gateBaseFields = ['vod_id', 'type_id', 'vod_name', 'vod_copyright'];
$gatePlaybackFields = array_merge($gateBaseFields, ['vod_pwd_play', 'vod_points', 'vod_points_play', 'vod_trysee']);
$gateDownloadFields = array_merge($gateBaseFields, ['vod_pwd_down', 'vod_points', 'vod_points_down']);
$gateCases = [
    ['detail', false, array_merge($gateBaseFields, ['vod_pwd'])],
    ['detail', true, array_merge($gateBaseFields, ['vod_pwd'])],
    ['unavailable', false, array_merge($gateBaseFields, ['vod_pwd'])],
    ['playback', false, $gatePlaybackFields],
    ['confirm', false, $gatePlaybackFields],
    ['playback', true, array_merge($gatePlaybackFields, ['vod_play_from', 'vod_play_server', 'vod_play_note', 'vod_play_url'])],
    ['confirm', true, array_merge($gatePlaybackFields, ['vod_play_from', 'vod_play_server', 'vod_play_note', 'vod_play_url'])],
    ['download', false, $gateDownloadFields],
    ['download', true, array_merge($gateDownloadFields, ['vod_down_from', 'vod_down_server', 'vod_down_note', 'vod_down_url'])],
];
foreach ($gateCases as [$scope, $withEpisode, $expectedFields]) {
    $assertSame(
        $expectedFields,
        $totalProbe->gateProjection($scope, $withEpisode),
        $scope . ' access must query only the fields required by its scope and episode validation.'
    );
}

$totalProbe->checkAccessEpisode([], 'playback', 1, 1);
$totalProbe->checkAccessEpisode([], 'confirm', 1, 1);
$assertThrowsStatus(static function () use ($totalProbe): void {
    $totalProbe->checkAccessEpisode([], 'playback', 1, 2);
}, 404, 'Playback access must reject a missing episode.');
$assertThrowsStatus(static function () use ($totalProbe): void {
    $totalProbe->checkAccessEpisode([], 'confirm', 1, 2);
}, 404, 'Confirm access must share playback episode validation.');

$categoryTotals = [
    ['id' => '47', 'name' => '电影', 'total' => 12],
    ['id' => '48', 'name' => '综艺', 'total' => 8],
];
$assertSame(20, $totalProbe->categoryTotal([], $categoryTotals), 'Unfiltered content must reuse the permission-scoped category total.');
$assertSame(12, $totalProbe->categoryTotal(['typeId' => 47], $categoryTotals), 'A root category must reuse its permission-scoped total.');
$assertSame(null, $totalProbe->categoryTotal(['typeId' => 99], $categoryTotals), 'Unknown or child categories must fall back to an exact count.');
$assertSame(null, $totalProbe->categoryTotal(['year' => '2026'], $categoryTotals), 'Filtered content must keep an exact query-specific count.');
$assertSame(null, $totalProbe->categoryTotal(['keyword' => '测试'], $categoryTotals), 'Search results must keep an exact query-specific count.');
$assertSame('vod_time', $totalProbe->forcedIndex([], 'latest'), 'Unfiltered latest queries must keep the sequential sort index.');
$assertSame('vod_hits', $totalProbe->forcedIndex(['page' => 2], 'hot'), 'Pagination alone must not disable the sort index.');
$assertSame('', $totalProbe->forcedIndex(['typeId' => 47], 'latest'), 'Category queries must let the optimizer choose a selective index.');
foreach (['area', 'year', 'lang', 'letter'] as $filter) {
    $assertSame('', $totalProbe->forcedIndex([$filter => '测试'], 'latest'), $filter . ' filters must let the optimizer choose a selective index.');
    $assertSame('vod_time', $totalProbe->forcedIndex([$filter => ''], 'latest'), 'Empty ' . $filter . ' filters must not disable the sort index.');
}
$assertSame('vod_time', $totalProbe->forcedIndex(['class' => '剧情'], 'latest'), 'LIKE-based class filters must keep the sequential sort index.');
$assertSame('', $totalProbe->forcedIndex(['keyword' => ''], 'latest'), 'Even an empty search query must not force a full sort-index scan.');

$scopeConfig = $GLOBALS['config'] ?? [];
$GLOBALS['config']['app']['popedom_filter'] = 0;
$scopeTypes = [
    42 => ['type_id' => 42, 'type_pid' => 0, 'type_mid' => 1, 'type_status' => 1, 'type_name' => '电影', 'type_sort' => 1],
    420 => ['type_id' => 420, 'type_pid' => 42, 'type_mid' => 1, 'type_status' => 1, 'type_name' => '动作', 'type_sort' => 2],
    999 => ['type_id' => 999, 'type_pid' => 0, 'type_mid' => 1, 'type_status' => 1, 'type_name' => '站外频道', 'type_sort' => 3],
];
$assertSame([42, 420], $totalProbe->typeIds(['scope' => 'library'], $scopeTypes), 'Library scope must contain only the five configured channels and their children.');
$assertSame([420], $totalProbe->typeIds(['scope' => 'library', 'typeId' => 420], $scopeTypes), 'A library child filter must stay inside the library scope.');
$assertSame([], $totalProbe->typeIds(['scope' => 'library', 'typeId' => 999], $scopeTypes), 'A library filter must not escape into unrelated root categories.');
$assertSame(true, $totalProbe->primaryScan(['scope' => 'library'], $scopeTypes), 'Multi-category library queries must use the measured sequential primary scan.');
$assertSame(true, $totalProbe->primaryScan(['typeId' => 42], $scopeTypes), 'Root category queries must use the measured sequential primary scan.');
$assertSame(false, $totalProbe->primaryScan(['typeId' => 420], $scopeTypes), 'Leaf category queries must keep their selective index plan.');
$assertSame(false, $totalProbe->primaryScan(['typeId' => 999], $scopeTypes), 'Unknown categories must keep the empty-result plan.');
$assertSame(
    [['id' => '42', 'name' => '电影']],
    $totalProbe->catalog($scopeTypes, 'library'),
    'The library category index must not create links outside its configured channel scope.'
);
$assertSame(
    ['typeId' => 420, 'year' => '2026', 'lang' => '国语', 'scope' => 'library'],
    $totalProbe->facetFilters([
        'typeId' => 420,
        'area' => '中国大陆',
        'year' => '2026',
        'lang' => '国语',
        'scope' => 'library',
        'page' => 3,
    ], 'area'),
    'Each facet query must remove only its own dimension while retaining every other active filter and scope.'
);
$GLOBALS['config'] = $scopeConfig;

$routeConfig = $GLOBALS['config'] ?? [];
$GLOBALS['config']['rewrite'] = ['vod_id' => 0, 'encode_len' => 6, 'encode_key' => 'test'];
$assertSame(371745, $totalProbe->routeId(['vod_id' => 371745, 'vod_en' => 'three-lives']), 'Numeric Vod routes must keep the native ID.');
$GLOBALS['config']['rewrite']['vod_id'] = 1;
$assertSame('three-lives', $totalProbe->routeId(['vod_id' => 371745, 'vod_en' => 'three-lives']), 'Alias Vod routes must use vod_en.');
$GLOBALS['config']['rewrite']['vod_id'] = 2;
$assertSame('alpha-371745', $totalProbe->routeId(['vod_id' => 371745, 'vod_en' => 'three-lives']), 'Encoded Vod routes must use MacCMS alpha IDs.');

$gateRow = [
    'vod_id' => 7,
    'type_id' => 42,
    'vod_copyright' => 1,
    'vod_pwd' => '',
    'vod_pwd_play' => '',
    'vod_pwd_down' => '',
    'vod_trysee' => 0,
];
$GLOBALS['config']['user']['trysee'] = 0;
$GLOBALS['config']['app']['copyright_status'] = 3;
$deniedGate = new PingfangApiContentTotalProbe(static function () {
    return ['code' => 3003, 'msg' => '需要积分', 'confirm' => 1, 'points' => 8, 'trysee' => 0];
});
$state = $deniedGate->state($gateRow, 'playback', 1, 1);
$assertSame('copyright', $state['state'], 'Copyright mode 3 must precede playback permission and payment states.');
$assertSame(false, $state['authorized'], 'Copyright mode 3 must never authorize playback.');
$assertSame(0, $state['points'], 'Copyright responses must not expose a stale purchase requirement.');

$GLOBALS['config']['app']['copyright_status'] = 4;
$state = $deniedGate->state($gateRow, 'playback', 1, 1);
$assertSame('confirm', $state['state'], 'Copyright mode 4 must preserve a denied native payment state.');
$allowedGate = new PingfangApiContentTotalProbe(static function () {
    return ['code' => 1, 'msg' => '允许访问', 'trysee' => 0];
});
$assertSame('copyright', $allowedGate->state($gateRow, 'playback', 1, 1)['state'], 'Copyright mode 4 must replace authorized player output.');

$GLOBALS['config']['app']['copyright_status'] = 2;
$permissionGate = new PingfangApiContentTotalProbe(static function () {
    return ['code' => 3001, 'msg' => '无权访问', 'trysee' => 0];
});
$assertSame('permission', $permissionGate->state($gateRow, 'detail')['state'], 'Copyright mode 2 must not replace a denied detail permission state.');
$assertSame('copyright', $allowedGate->state($gateRow, 'detail')['state'], 'Copyright mode 2 must replace authorized detail output.');
$assertThrowsStatus(static function () use ($permissionGate, $gateRow): void {
    $permissionGate->checkPlaybackAccess($gateRow, 1, 1);
}, 403, 'Playback descriptors must not be returned before the native permission gate passes.');
$allowedGate->checkPlaybackAccess($gateRow, 1, 1);
$GLOBALS['config'] = $routeConfig;

$addonSource = '';
foreach (glob(dirname(__DIR__) . '/addons/pingfangapi/**/*.php') ?: [] as $file) {
    $addonSource .= (string) file_get_contents($file);
}
$assert(!str_contains($addonSource, 'preview/data.json'), 'Production API must not reference preview fixtures.');
$assert(!str_contains($addonSource, 'demo123'), 'Production API must not contain demo credentials.');
$assert(!str_contains($addonSource, 'mac_data_count('), 'The home API must not trigger MacCMS-wide aggregate statistics.');

$accountSource = (string) file_get_contents(dirname(__DIR__) . '/addons/pingfangapi/service/AccountService.php');
$methodSource = static function (string $name, string $next) use ($accountSource, $fail): string {
    $pattern = '/public function ' . preg_quote($name, '/') . '\b.*?(?=\n    public function ' . preg_quote($next, '/') . '\b)/s';
    if (preg_match($pattern, $accountSource, $matches) !== 1) {
        $fail('Unable to inspect AccountService::' . $name . ' source contract.');
    }
    return $matches[0];
};
$logoutSource = $methodSource('logout', 'favorites');
$assert(str_contains($logoutSource, "model('User')->logout();"), 'Logout must always reach the native MacCMS logout.');
$assert(!str_contains($logoutSource, "throw new ApiException(503"), 'Device revocation failure must not prevent native logout.');
$favoritesSource = $methodSource('favorites', 'setFavorite');
$assert(str_contains($favoritesSource, "'recordIds'"), 'Favorite DTOs must retain the native Ulog ID.');
$deleteFavoritesSource = $methodSource('deleteFavorites', 'history');
$assert(str_contains($deleteFavoritesSource, "\$where['ulog_id'] = ['in', array_values(\$recordIds)];"), 'Favorite deletes must target selected Ulog IDs.');
$assert(!str_contains($deleteFavoritesSource, "'ulog_rid' => ['in'"), 'Favorite deletes must not expand a selection to hidden duplicate rows.');
$historySource = $methodSource('history', 'saveHistory');
$assert(str_contains($historySource, "'recordIds'"), 'History DTOs must retain the native Ulog IDs represented by each collapsed row.');
$assert(!str_contains($historySource, "'ulog_points' => 0"), 'History reads must retain paid and protected Ulog records.');
$saveHistorySource = $methodSource('saveHistory', 'deleteHistory');
$assert(preg_match('/\$where = \[(.*?)\];/s', $saveHistorySource, $historyWhere) === 1, 'History save must define an exact Ulog key.');
$assert(str_contains($historyWhere[1], "'ulog_sid' => intval(\$sourceId)"), 'History upserts must isolate playback sources.');
$assert(!str_contains($historyWhere[1], "'ulog_points'"), 'History upserts must match existing records regardless of points.');
$assert(preg_match('/\$data = \[(.*?)\];/s', $saveHistorySource, $historyData) === 1, 'History save must define an update payload.');
$assert(!str_contains($historyData[1], "'ulog_points'"), 'History updates must preserve existing points.');
$assert(str_contains($saveHistorySource, "'ulog_points' => 0"), 'Only newly inserted history records may default points to zero.');
$deleteHistorySource = $methodSource('deleteHistory', 'feedback');
$assert(str_contains($deleteHistorySource, "\$where['ulog_id'] = ['in', array_values(\$recordIds)];"), 'History deletes must target selected Ulog IDs instead of every row for a video.');
$assert(!str_contains($deleteHistorySource, "'ulog_rid' => ['in'"), 'History deletes must not expand a selected row into every record for that video.');
$assert(!str_contains($deleteHistorySource, "'ulog_points' => 0"), 'History deletes must include paid and protected Ulog records.');
$reportSource = $methodSource('report', 'comment');
$assert(str_contains($reportSource, 'if (intval($vodId) > 0)'), 'Standalone reports must not render a synthetic video ID.');
$devicesSource = $methodSource('devices', 'revokeDevice');
$assert(str_contains($devicesSource, 'DeviceSession::maxDeviceCount()'), 'Device responses must expose the configured session limit.');
$assert(!str_contains($devicesSource, "if (intval(isset(\$row['revoked_time'])"), 'Device responses must retain revoked and expired sessions.');
foreach (['loginAt', 'lastActiveAt', 'ipAddress', 'userAgent', 'status', 'revokedAt', 'current'] as $field) {
    $assert(str_contains($devicesSource, "'" . $field . "'"), 'Device responses must expose ' . $field . '.');
}

$nativeVodModel = new PingfangApiFakeVodModel();
$GLOBALS['pingfangApiModels'] = [
    'Type' => new PingfangApiFakeTypeModel(),
    'Vod' => $nativeVodModel,
];
$nativeHome = (new ContentService(static function () {
    return ['code' => 1, 'msg' => 'ok'];
}))->homeV2(true);
$assertSame(['siteName', 'todayUpdated', 'categories', 'hero', 'ranking', 'latest', 'latestByCategory'], array_keys($nativeHome), 'Native compact home must use the lean response contract.');
$assertSame(4, count($nativeVodModel->calls), 'One visible home category must use three shared shelves and one category shelf.');
$pageUrls = [];
foreach ($nativeVodModel->calls as $index => $call) {
    $assert($call['fields'] !== '*', 'Every native home query must pass a field whitelist.');
    $pageUrl = (string) ($call['params']['pageurl'] ?? '');
    $assert($pageUrl !== '', 'Every native home field projection must isolate the MacCMS list cache.');
    $pageUrls[$pageUrl] = true;
    if ($index === 0) {
        $assert(str_contains($call['fields'], 'vod_play_url'), 'Hero queries must retain only the playback fields needed to resolve the first episode.');
    } else {
        $assert(!str_contains($call['fields'], 'vod_play_url'), 'Home card queries must not read playback fields.');
        $assert(!str_contains($call['fields'], 'vod_content'), 'Home card queries must not read full content bodies.');
    }
}
$assertSame(4, count($pageUrls), 'Each native home shelf must have a distinct cache namespace.');
unset($GLOBALS['pingfangApiModels']);

$accessConfig = $GLOBALS['config'] ?? [];
$accessUser = $GLOBALS['user'] ?? null;
$GLOBALS['config']['app']['popedom_filter'] = 1;
$GLOBALS['pingfangApiBlockedTypeIds'] = '420';
$GLOBALS['user'] = ['group_id' => 2, 'group' => ['group_type' => 'restricted']];
$restrictedVodModel = new PingfangApiFakeVodModel();
$GLOBALS['pingfangApiModels'] = [
    'Type' => new PingfangApiFakeTypeModel(),
    'Vod' => $restrictedVodModel,
];
(new ContentService(static function () {
    return ['code' => 1, 'msg' => 'ok'];
}))->homeV2(true);
$restrictedPageUrl = (string) ($restrictedVodModel->calls[0]['params']['pageurl'] ?? '');
foreach ($restrictedVodModel->calls as $call) {
    $assertSame('420', (string) ($call['params']['typenot'] ?? ''), 'Native home queries must exclude every category blocked for the current group.');
}

$GLOBALS['user'] = ['group_id' => 3, 'group' => ['group_type' => 'open']];
$GLOBALS['pingfangApiBlockedTypeIds'] = '';
$openVodModel = new PingfangApiFakeVodModel();
$GLOBALS['pingfangApiModels']['Vod'] = $openVodModel;
(new ContentService(static function () {
    return ['code' => 1, 'msg' => 'ok'];
}))->homeV2(true);
$openPageUrl = (string) ($openVodModel->calls[0]['params']['pageurl'] ?? '');
$assertSame('', (string) ($openVodModel->calls[0]['params']['typenot'] ?? ''), 'Unrestricted home queries must not add a category exclusion.');
$assert($restrictedPageUrl !== $openPageUrl, 'Native home cache namespaces must be isolated by content access scope.');

$GLOBALS['config'] = $accessConfig;
if ($accessUser === null) {
    unset($GLOBALS['user']);
} else {
    $GLOBALS['user'] = $accessUser;
}
unset($GLOBALS['pingfangApiBlockedTypeIds'], $GLOBALS['pingfangApiModels']);

$requirementsConfig = $GLOBALS['config'] ?? [];
$GLOBALS['config']['user'] = [
    'login_verify' => 1,
];
$GLOBALS['config']['gbook']['status'] = 1;
$GLOBALS['config']['gbook']['audit'] = 1;
$GLOBALS['config']['gbook']['verify'] = 1;
$GLOBALS['config']['gbook']['login'] = 1;
$GLOBALS['config']['comment']['status'] = 1;
$GLOBALS['config']['comment']['audit'] = 1;
$GLOBALS['config']['comment']['verify'] = 1;
$GLOBALS['config']['comment']['login'] = 1;
$requirements = (new AccountService())->requirements();
$assertSame(true, $requirements['feedbackLogin'], 'Native feedback login policy must be exposed.');
$assertSame(true, $requirements['feedbackEnabled'], 'Native feedback availability must be exposed.');
$assertSame(true, $requirements['feedbackAudit'], 'Native feedback audit policy must be exposed.');
$assertSame(true, $requirements['commentLogin'], 'Native comment login policy must be exposed.');
$assertSame(true, $requirements['commentEnabled'], 'Native comment availability must be exposed.');
$assertSame(true, $requirements['commentAudit'], 'Native comment audit policy must be exposed.');
$assertSame('/index.php/verify/index.html', $requirements['captchaUrl'], 'Captcha requirements must expose a same-origin native route.');
$GLOBALS['config'] = $requirementsConfig;

echo "Pingfang production API contract tests passed.\n";
