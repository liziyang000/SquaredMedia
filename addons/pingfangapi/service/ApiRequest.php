<?php

namespace addons\pingfangapi\service;

class ApiRequest
{
    const MAX_BODY_BYTES = 32768;
    const MAX_IDENTIFIER = 2147483647;

    private $content;
    private $account;

    public function __construct(ContentService $content, AccountService $account)
    {
        $this->content = $content;
        $this->account = $account;
    }

    public function handle($method, array $query, array $body, array $headers)
    {
        try {
            return $this->dispatch(strtoupper(trim((string) $method)), $query, $body, $this->normalizeHeaders($headers));
        } catch (ApiException $e) {
            return self::failure($e->status(), $e->getMessage());
        }
    }

    public static function decodeJson($contentType, $raw)
    {
        $type = strtolower(trim(explode(';', (string) $contentType)[0]));
        if ($type !== 'application/json') {
            throw new ApiException(415, 'Content-Type 必须为 application/json');
        }
        $raw = (string) $raw;
        if (strlen($raw) > self::MAX_BODY_BYTES) {
            throw new ApiException(413, '请求体过大');
        }
        if (trim($raw) === '') {
            return [];
        }

        try {
            $object = json_decode($raw, false, 512, JSON_THROW_ON_ERROR);
        } catch (\Throwable $e) {
            throw new ApiException(400, 'JSON 请求体格式错误');
        }
        if (!is_object($object)) {
            throw new ApiException(422, 'JSON 请求体必须是对象');
        }

        return json_decode($raw, true, 512, JSON_THROW_ON_ERROR);
    }

    public static function failure($status, $message)
    {
        $status = max(400, intval($status));
        return self::response($status, $status, (string) $message, null);
    }

    private function dispatch($method, array $query, array $body, array $headers)
    {
        $action = $this->queryString($query, 'action', true, 64);
        $routes = [
            'home' => 'GET',
            'home_v2' => 'GET',
            'navigation' => 'GET',
            'content' => 'GET',
            'detail' => 'GET',
            'access' => 'GET',
            'downloads' => 'GET',
            'plot' => 'GET',
            'playback' => 'GET',
            'session' => 'GET',
            'comments' => 'GET',
            'favorites' => 'GET',
            'history' => 'GET',
            'devices' => 'GET',
            'login' => 'POST',
            'logout' => 'POST',
            'favorite' => 'POST',
            'favorites.delete' => 'POST',
            'history.save' => 'POST',
            'history.delete' => 'POST',
            'device.revoke' => 'POST',
            'feedback' => 'POST',
            'report' => 'POST',
            'comment' => 'POST',
            'reaction' => 'POST',
            'rating' => 'POST',
            'password.verify' => 'POST',
        ];
        if (!isset($routes[$action])) {
            throw new ApiException(404, '接口不存在');
        }
        if ($method !== $routes[$action]) {
            $response = self::failure(405, '请求方法不被允许');
            $response['headers']['Allow'] = $routes[$action];
            return $response;
        }

        if ($method === 'GET') {
            return $this->read($action, $query);
        }

        $this->assertSameOrigin($headers);
        $this->assertCsrf($headers);
        $this->account->guardRateLimit($action);

        if ($action === 'login') {
            return $this->login($body);
        }
        if ($action === 'password.verify') {
            $this->assertBodyKeys($body, ['vodId', 'scope', 'password']);
            $vodId = $this->identifier($this->bodyValue($body, 'vodId'), 'vodId');
            $scope = $this->stringValue($this->bodyValue($body, 'scope'), 'scope', 1, 20, true);
            if (!in_array($scope, ['detail', 'playback', 'download'], true)) {
                throw new ApiException(422, 'scope 不受支持');
            }
            $password = $this->stringValue($this->bodyValue($body, 'password'), 'password', 1, 200, false);
            return self::success($this->content->verifyPassword($vodId, $scope, $password), '密码验证成功');
        }

        $user = null;
        if (in_array($action, ['logout', 'favorite', 'favorites.delete', 'history.save', 'history.delete', 'device.revoke'], true)) {
            $user = $this->requireUser();
        } elseif (in_array($action, ['feedback', 'report', 'comment'], true)) {
            $requirements = $this->account->requirements();
            $loginRequired = $action === 'comment'
                ? !empty($requirements['commentLogin'])
                : !empty($requirements['feedbackLogin']);
            $user = $loginRequired ? $this->requireUser() : $this->account->currentUser();
        }
        $userId = empty($user) ? 0 : intval($user['user_id']);

        if ($action === 'logout') {
            $this->assertBodyKeys($body, []);
            return self::success($this->account->logout(), '已退出登录');
        }
        if ($action === 'favorite') {
            $this->assertBodyKeys($body, ['vodId', 'favorite']);
            $vodId = $this->identifier($this->bodyValue($body, 'vodId'), 'vodId');
            if (!isset($body['favorite']) || !is_bool($body['favorite'])) {
                throw new ApiException(422, 'favorite 必须为布尔值');
            }
            $this->content->assertVideo($vodId);
            return self::success($this->account->setFavorite($userId, $vodId, $body['favorite']), '收藏状态已更新');
        }
        if ($action === 'favorites.delete') {
            list($recordIds, $all) = $this->recordDeleteInput($body);
            return self::success($this->account->deleteFavorites($userId, $recordIds, $all), '收藏记录已删除');
        }
        if ($action === 'history.save') {
            return $this->saveHistory($userId, $body);
        }
        if ($action === 'history.delete') {
            list($recordIds, $all) = $this->recordDeleteInput($body);
            return self::success($this->account->deleteHistory($userId, $recordIds, $all), '播放记录已删除');
        }
        if ($action === 'device.revoke') {
            $this->assertBodyKeys($body, ['sessionId']);
            $sessionId = $this->identifier($this->bodyValue($body, 'sessionId'), 'sessionId');
            return self::success($this->account->revokeDevice($userId, $sessionId), '设备已撤销');
        }
        if ($action === 'feedback') {
            $this->assertBodyKeys($body, ['name', 'content', 'captcha']);
            $name = isset($body['name']) ? $this->stringValue($body['name'], 'name', 1, 100, true) : '';
            $content = $this->stringValue($this->bodyValue($body, 'content'), 'content', 1, 5000, true);
            $captcha = isset($body['captcha']) ? $this->stringValue($body['captcha'], 'captcha', 1, 100, true) : '';
            return self::success($this->account->feedback($userId, $name, $content, $captcha), '留言已提交');
        }
        if ($action === 'report') {
            $this->assertBodyKeys($body, ['vodId', 'sourceId', 'episodeId', 'reason', 'details', 'captcha']);
            $vodId = isset($body['vodId']) ? $this->identifier($body['vodId'], 'vodId') : 0;
            $sourceId = isset($body['sourceId']) ? $this->identifier($body['sourceId'], 'sourceId') : 0;
            $episodeId = isset($body['episodeId']) ? $this->identifier($body['episodeId'], 'episodeId') : 0;
            if (($sourceId > 0) !== ($episodeId > 0)) {
                throw new ApiException(422, 'sourceId 和 episodeId 必须同时提供');
            }
            if ($sourceId > 0 && $vodId < 1) {
                throw new ApiException(422, 'sourceId 和 episodeId 必须与 vodId 一起提供');
            }
            if ($sourceId > 0) {
                $this->content->assertEpisode($vodId, $sourceId, $episodeId);
            } elseif ($vodId > 0) {
                $this->content->assertVideo($vodId);
            }
            $reason = $this->stringValue($this->bodyValue($body, 'reason'), 'reason', 1, 200, true);
            $details = isset($body['details']) ? $this->stringValue($body['details'], 'details', 0, 5000, true) : '';
            $captcha = isset($body['captcha']) ? $this->stringValue($body['captcha'], 'captcha', 1, 100, true) : '';
            return self::success($this->account->report($userId, $vodId, $sourceId, $episodeId, $reason, $details, $captcha), '报错已提交');
        }
        if ($action === 'comment') {
            $this->assertBodyKeys($body, ['mid', 'vodId', 'parentId', 'content', 'captcha']);
            $mid = isset($body['mid']) ? $this->identifier($body['mid'], 'mid') : 1;
            $vodId = $this->identifier($this->bodyValue($body, 'vodId'), 'vodId');
            $parentId = isset($body['parentId']) ? $this->identifier($body['parentId'], 'parentId') : 0;
            $content = $this->stringValue($this->bodyValue($body, 'content'), 'content', 1, 5000, true);
            $captcha = isset($body['captcha']) ? $this->stringValue($body['captcha'], 'captcha', 1, 100, true) : '';
            $this->content->assertVideo($vodId);
            return self::success($this->account->comment($userId, $mid, $vodId, $parentId, $content, $captcha), '评论已提交');
        }
        if ($action === 'reaction') {
            $this->assertBodyKeys($body, ['target', 'targetId', 'value']);
            $target = $this->stringValue($this->bodyValue($body, 'target'), 'target', 1, 20, true);
            $targetId = $this->identifier($this->bodyValue($body, 'targetId'), 'targetId');
            $value = $this->stringValue($this->bodyValue($body, 'value'), 'value', 1, 20, true);
            if (!in_array($target, ['vod', 'comment'], true) || !in_array($value, ['like', 'dislike', 'none'], true)) {
                throw new ApiException(422, '互动参数不正确');
            }
            if ($target === 'vod') {
                $this->content->assertVideo($targetId);
            } else {
                $this->content->assertComment($targetId);
            }
            return self::success($this->account->reaction($target, $targetId, $value), '互动状态已更新');
        }
        if ($action === 'rating') {
            $this->assertBodyKeys($body, ['vodId', 'score']);
            $vodId = $this->identifier($this->bodyValue($body, 'vodId'), 'vodId');
            $score = $this->bodyValue($body, 'score');
            if ((!is_int($score) && !is_float($score)) || intval($score) != $score || intval($score) < 1 || intval($score) > 10) {
                throw new ApiException(422, 'score 必须为 1 至 10 的整数');
            }
            $this->content->assertVideo($vodId);
            return self::success($this->account->rating($vodId, intval($score)), '评分已提交');
        }

        throw new ApiException(404, '接口不存在');
    }

    private function read($action, array $query)
    {
        if ($action === 'home') {
            $this->assertQueryKeys($query, ['action']);
            return self::success($this->content->home(), '首页加载成功');
        }
        if ($action === 'home_v2') {
            $this->assertQueryKeys($query, ['action', 'compact']);
            $compact = array_key_exists('compact', $query) ? $this->queryFlag($query['compact'], 'compact') : false;
            return self::success($this->content->homeV2($compact), '首页加载成功');
        }
        if ($action === 'navigation') {
            $this->assertQueryKeys($query, ['action']);
            return self::success($this->content->navigation(), '导航加载成功');
        }
        if ($action === 'content') {
            $contentQuery = $this->contentQuery($query);
            if (array_key_exists('keyword', $contentQuery)) {
                $this->account->guardRateLimit('search');
            }
            return self::success($this->content->contentPage($contentQuery), '内容加载成功');
        }
        if ($action === 'detail') {
            $this->assertQueryKeys($query, ['action', 'vod_id', 'compact']);
            $vodId = $this->identifier($this->queryValue($query, 'vod_id'), 'vod_id');
            $compact = array_key_exists('compact', $query) ? $this->queryFlag($query['compact'], 'compact') : false;
            return self::success($this->content->detail($vodId, $compact), '影片详情加载成功');
        }
        if ($action === 'access') {
            $this->assertQueryKeys($query, ['action', 'vod_id', 'scope', 'source_id', 'episode_id']);
            $vodId = $this->identifier($this->queryValue($query, 'vod_id'), 'vod_id');
            $scope = $this->queryText($this->queryValue($query, 'scope'), 'scope', 20, false);
            if (!in_array($scope, ['detail', 'playback', 'download', 'confirm', 'unavailable'], true)) {
                throw new ApiException(422, 'scope 不受支持');
            }
            $sourceId = array_key_exists('source_id', $query) ? $this->identifier($query['source_id'], 'source_id') : 0;
            $episodeId = array_key_exists('episode_id', $query) ? $this->identifier($query['episode_id'], 'episode_id') : 0;
            if (($sourceId > 0) !== ($episodeId > 0)) {
                throw new ApiException(422, 'source_id 和 episode_id 必须同时提供');
            }
            return self::success($this->content->access($vodId, $scope, $sourceId, $episodeId), '访问状态加载成功');
        }
        if ($action === 'downloads') {
            $this->assertQueryKeys($query, ['action', 'vod_id']);
            $vodId = $this->identifier($this->queryValue($query, 'vod_id'), 'vod_id');
            return self::success($this->content->downloads($vodId), '下载列表加载成功');
        }
        if ($action === 'plot') {
            $this->assertQueryKeys($query, ['action', 'vod_id']);
            $vodId = $this->identifier($this->queryValue($query, 'vod_id'), 'vod_id');
            return self::success($this->content->plot($vodId), '分集剧情加载成功');
        }
        if ($action === 'playback') {
            $this->assertQueryKeys($query, ['action', 'vod_id', 'source_id', 'episode_id']);
            $vodId = $this->identifier($this->queryValue($query, 'vod_id'), 'vod_id');
            $sourceId = $this->identifier($this->queryValue($query, 'source_id'), 'source_id');
            $episodeId = $this->identifier($this->queryValue($query, 'episode_id'), 'episode_id');
            return self::success($this->content->playback($vodId, $sourceId, $episodeId), '播放信息加载成功');
        }
        if ($action === 'session') {
            $this->assertQueryKeys($query, ['action']);
            return self::success($this->account->sessionData(), '登录状态加载成功');
        }
        if ($action === 'comments') {
            $this->assertQueryKeys($query, ['action', 'mid', 'content_id']);
            $mid = array_key_exists('mid', $query) ? $this->identifier($this->queryValue($query, 'mid'), 'mid') : 1;
            $vodId = $this->identifier($this->queryValue($query, 'content_id'), 'content_id');
            return self::success(['items' => $this->content->comments($vodId, $mid)], '评论加载成功');
        }

        $this->assertQueryKeys($query, $action === 'history' ? ['action', 'limit'] : ['action']);
        $user = $this->requireUser();
        $userId = intval($user['user_id']);
        if ($action === 'favorites') {
            return self::success(['items' => $this->account->favorites($userId)], '收藏加载成功');
        }
        if ($action === 'history') {
            $limit = array_key_exists('limit', $query) ? $this->queryInteger($query['limit'], 'limit', 1, AccountService::PRIVATE_LIST_LIMIT) : AccountService::PRIVATE_LIST_LIMIT;
            return self::success(['items' => $this->account->history($userId, $limit)], '播放记录加载成功');
        }
        if ($action === 'devices') {
            return self::success($this->account->devices($userId), '登录设备加载成功');
        }

        throw new ApiException(404, '接口不存在');
    }

    private function login(array $body)
    {
        $this->assertBodyKeys($body, ['username', 'password', 'captcha']);
        $username = $this->stringValue($this->bodyValue($body, 'username'), 'username', 1, 100, true);
        $password = $this->stringValue($this->bodyValue($body, 'password'), 'password', 1, 200, false);
        $captcha = isset($body['captcha']) ? $this->stringValue($body['captcha'], 'captcha', 1, 100, true) : '';

        return self::success($this->account->login($username, $password, $captcha), '登录成功');
    }

    private function saveHistory($userId, array $body)
    {
        $this->assertBodyKeys($body, ['vodId', 'sourceId', 'episodeId', 'positionSeconds', 'durationSeconds']);
        $vodId = $this->identifier($this->bodyValue($body, 'vodId'), 'vodId');
        $sourceId = $this->identifier($this->bodyValue($body, 'sourceId'), 'sourceId');
        $episodeId = $this->identifier($this->bodyValue($body, 'episodeId'), 'episodeId');
        $position = $this->seconds($this->bodyValue($body, 'positionSeconds'), 'positionSeconds', true);
        $duration = isset($body['durationSeconds']) ? $this->seconds($body['durationSeconds'], 'durationSeconds', false) : null;
        if ($duration !== null && $position > $duration) {
            throw new ApiException(422, 'positionSeconds 不能大于 durationSeconds');
        }

        $this->content->assertEpisode($vodId, $sourceId, $episodeId);
        return self::success(
            $this->account->saveHistory($userId, $vodId, $sourceId, $episodeId, $position, $duration),
            '播放记录已保存'
        );
    }

    private function recordDeleteInput(array $body)
    {
        $this->assertBodyKeys($body, ['recordIds', 'all']);
        $all = isset($body['all']) && $body['all'] === true;
        if (isset($body['all']) && !is_bool($body['all'])) {
            throw new ApiException(422, 'all 必须为布尔值');
        }
        $ids = [];
        if (array_key_exists('recordIds', $body)) {
            if (!is_array($body['recordIds']) || !array_is_list($body['recordIds']) || count($body['recordIds']) < 1 || count($body['recordIds']) > 100) {
                throw new ApiException(422, 'recordIds 必须包含 1 至 100 个记录 ID');
            }
            foreach ($body['recordIds'] as $value) {
                $id = $this->identifier($value, 'recordIds');
                $ids[$id] = $id;
            }
        }
        if (($all && !empty($ids)) || (!$all && empty($ids))) {
            throw new ApiException(422, 'all 与 recordIds 必须且只能选择一种');
        }

        return [array_values($ids), $all];
    }

    private function contentQuery(array $query)
    {
        $this->assertQueryKeys($query, [
            'action',
            'type_id',
            'area',
            'year',
            'class',
            'lang',
            'letter',
            'sort',
            'page',
            'page_size',
            'keyword',
            'scope',
            'compact',
            'include_category_totals',
            'include_facets',
        ]);

        $out = [
            'sort' => 'latest',
            'page' => 1,
            'pageSize' => 24,
        ];
        if (array_key_exists('type_id', $query)) {
            $out['typeId'] = $this->identifier($query['type_id'], 'type_id');
        }
        foreach (['area', 'year', 'class', 'lang', 'letter'] as $name) {
            if (array_key_exists($name, $query)) {
                $value = $this->queryText($query[$name], $name, 40, false);
                if ($value !== '') {
                    $out[$name] = $value;
                }
            }
        }
        if (array_key_exists('keyword', $query)) {
            $out['keyword'] = $this->queryText($query['keyword'], 'keyword', 100, true);
        }
        if (array_key_exists('scope', $query)) {
            $scope = $this->queryText($query['scope'], 'scope', 20, false);
            if (!in_array($scope, ['library', 'yearly'], true)) {
                throw new ApiException(422, 'scope 不受支持');
            }
            $out['scope'] = $scope;
        }
        if (array_key_exists('sort', $query)) {
            $sort = $this->queryText($query['sort'], 'sort', 10, false);
            if (!in_array($sort, ['latest', 'hot', 'score'], true)) {
                throw new ApiException(422, 'sort 不受支持');
            }
            $out['sort'] = $sort;
        }
        if (array_key_exists('page', $query)) {
            $out['page'] = $this->queryInteger($query['page'], 'page', 1, 100000);
        }
        if (array_key_exists('page_size', $query)) {
            $out['pageSize'] = $this->queryInteger($query['page_size'], 'page_size', 1, 100);
        }
        if (array_key_exists('compact', $query)) {
            $out['compact'] = $this->queryFlag($query['compact'], 'compact');
        }
        if (array_key_exists('include_category_totals', $query)) {
            $out['includeCategoryTotals'] = $this->queryFlag($query['include_category_totals'], 'include_category_totals');
        }
        if (array_key_exists('include_facets', $query)) {
            $out['includeFacets'] = $this->queryFlag($query['include_facets'], 'include_facets');
        }
        if ((!empty($out['includeCategoryTotals']) || !empty($out['includeFacets'])) && empty($out['compact'])) {
            throw new ApiException(422, '精简选项必须与 compact=1 一起使用');
        }

        return $out;
    }

    private function queryFlag($value, $name)
    {
        if ($value === 1 || $value === '1') {
            return true;
        }
        if ($value === 0 || $value === '0') {
            return false;
        }
        throw new ApiException(422, $name . ' 必须为 0 或 1');
    }

    private function requireUser()
    {
        $user = $this->account->currentUser();
        if (empty($user)) {
            throw new ApiException(401, '请先登录');
        }
        return $user;
    }

    private function assertCsrf(array $headers)
    {
        $actual = isset($headers['x-csrf-token']) ? trim((string) $headers['x-csrf-token']) : '';
        $expected = $this->account->csrfToken();
        if ($actual === '' || !hash_equals($expected, $actual)) {
            throw new ApiException(403, 'CSRF Token 无效');
        }
    }

    private function assertSameOrigin(array $headers)
    {
        if (isset($headers['sec-fetch-site']) && strtolower(trim((string) $headers['sec-fetch-site'])) === 'cross-site') {
            throw new ApiException(403, '拒绝跨站请求');
        }
        if (!isset($headers['x-requested-with']) || strcasecmp(trim((string) $headers['x-requested-with']), 'XMLHttpRequest') !== 0) {
            throw new ApiException(403, '请求来源无效');
        }

        $host = isset($headers['host']) ? trim((string) $headers['host']) : '';
        $requestScheme = isset($headers['x-pingfang-request-scheme']) ? strtolower(trim((string) $headers['x-pingfang-request-scheme'])) : '';
        if ($host === '' || ($requestScheme !== 'http' && $requestScheme !== 'https')) {
            throw new ApiException(403, '请求来源无效');
        }
        $origin = isset($headers['origin']) ? trim((string) $headers['origin']) : '';
        $referer = isset($headers['referer']) ? trim((string) $headers['referer']) : '';
        if ($origin === '' && $referer === '') {
            throw new ApiException(403, '请求来源无效');
        }
        if ($origin !== '' && !$this->matchesOrigin($origin, $host, $requestScheme)) {
            throw new ApiException(403, '拒绝跨源请求');
        }
        if ($referer !== '' && !$this->matchesOrigin($referer, $host, $requestScheme)) {
            throw new ApiException(403, '拒绝跨源请求');
        }
    }

    private function matchesOrigin($url, $hostHeader, $requestScheme)
    {
        $parts = parse_url((string) $url);
        if (!is_array($parts) || !isset($parts['scheme'], $parts['host'])) {
            return false;
        }
        $scheme = strtolower((string) $parts['scheme']);
        if ($scheme !== 'http' && $scheme !== 'https') {
            return false;
        }
        if (!hash_equals((string) $requestScheme, $scheme)) {
            return false;
        }
        $hostParts = parse_url('http://' . (string) $hostHeader);
        if (!is_array($hostParts) || empty($hostParts['host'])) {
            return false;
        }
        $urlHost = strtolower(rtrim((string) $parts['host'], '.'));
        $requestHost = strtolower(rtrim((string) $hostParts['host'], '.'));
        if ($urlHost === '' || !hash_equals($requestHost, $urlHost)) {
            return false;
        }

        $urlPort = isset($parts['port']) ? intval($parts['port']) : ($scheme === 'https' ? 443 : 80);
        if (isset($hostParts['port'])) {
            return $urlPort === intval($hostParts['port']);
        }

        return !isset($parts['port']) || $urlPort === ($scheme === 'https' ? 443 : 80);
    }

    private function identifier($value, $name)
    {
        if (is_int($value)) {
            $id = $value;
        } elseif (is_string($value) && preg_match('/^[1-9][0-9]{0,9}$/', $value)) {
            $id = intval($value);
        } else {
            throw new ApiException(422, $name . ' 必须为正整数');
        }
        if ($id < 1 || $id > self::MAX_IDENTIFIER) {
            throw new ApiException(422, $name . ' 超出允许范围');
        }
        return $id;
    }

    private function seconds($value, $name, $allowZero)
    {
        if (!is_int($value) && !is_float($value)) {
            throw new ApiException(422, $name . ' 必须为数字');
        }
        $number = floatval($value);
        if (!is_finite($number) || $number < ($allowZero ? 0 : 0.000001) || $number > self::MAX_IDENTIFIER) {
            throw new ApiException(422, $name . ' 超出允许范围');
        }
        $seconds = intval(floor($number));
        if (!$allowZero && $seconds < 1) {
            throw new ApiException(422, $name . ' 必须至少为 1 秒');
        }
        return $seconds;
    }

    private function stringValue($value, $name, $minimum, $maximum, $trim)
    {
        if (!is_string($value)) {
            throw new ApiException(422, $name . ' 必须为字符串');
        }
        $value = $trim ? trim($value) : $value;
        $length = function_exists('mb_strlen') ? mb_strlen($value, 'UTF-8') : strlen($value);
        if ($length < intval($minimum) || $length > intval($maximum)) {
            throw new ApiException(422, $name . ' 长度不正确');
        }
        return $value;
    }

    private function queryString(array $query, $name, $required, $maximum)
    {
        if (!array_key_exists($name, $query)) {
            if ($required) {
                throw new ApiException(400, '缺少 ' . $name);
            }
            return '';
        }
        if (!is_string($query[$name]) && !is_int($query[$name])) {
            throw new ApiException(400, $name . ' 格式错误');
        }
        $value = trim((string) $query[$name]);
        if (($required && $value === '') || strlen($value) > intval($maximum)) {
            throw new ApiException(400, $name . ' 格式错误');
        }
        return $value;
    }

    private function queryText($value, $name, $maximum, $allowEmpty)
    {
        if (!is_string($value) && !is_int($value)) {
            throw new ApiException(422, $name . ' 格式错误');
        }
        $value = trim((string) $value);
        $length = function_exists('mb_strlen') ? mb_strlen($value, 'UTF-8') : strlen($value);
        if ((!$allowEmpty && $value === '') || $length > intval($maximum) || preg_match('/[\r\n\t]/', $value)) {
            throw new ApiException(422, $name . ' 格式错误');
        }
        return $value;
    }

    private function queryInteger($value, $name, $minimum, $maximum)
    {
        if (is_int($value)) {
            $number = $value;
        } elseif (is_string($value) && preg_match('/^[0-9]+$/', $value)) {
            $number = intval($value);
        } else {
            throw new ApiException(422, $name . ' 必须为整数');
        }
        if ($number < intval($minimum) || $number > intval($maximum)) {
            throw new ApiException(422, $name . ' 超出允许范围');
        }
        return $number;
    }

    private function queryValue(array $query, $name)
    {
        if (!array_key_exists($name, $query)) {
            throw new ApiException(400, '缺少 ' . $name);
        }
        return $query[$name];
    }

    private function bodyValue(array $body, $name)
    {
        if (!array_key_exists($name, $body)) {
            throw new ApiException(422, '缺少 ' . $name);
        }
        return $body[$name];
    }

    private function assertQueryKeys(array $query, array $allowed)
    {
        $unknown = array_diff(array_keys($query), $allowed);
        if (!empty($unknown)) {
            throw new ApiException(400, '存在未支持的查询参数');
        }
    }

    private function assertBodyKeys(array $body, array $allowed)
    {
        $unknown = array_diff(array_keys($body), $allowed);
        if (!empty($unknown)) {
            throw new ApiException(422, '存在未支持的请求字段');
        }
    }

    private function normalizeHeaders(array $headers)
    {
        $out = [];
        foreach ($headers as $name => $value) {
            if (is_scalar($value)) {
                $out[strtolower(trim((string) $name))] = (string) $value;
            }
        }
        return $out;
    }

    private static function success($data, $message)
    {
        return self::response(200, 1, (string) $message, $data);
    }

    private static function response($status, $code, $message, $data)
    {
        $headers = [
            'Content-Type' => 'application/json; charset=utf-8',
            'X-Content-Type-Options' => 'nosniff',
            'Cache-Control' => 'private, no-store',
        ];

        return [
            'status' => intval($status),
            'headers' => $headers,
            'body' => [
                'code' => $code,
                'msg' => (string) $message,
                'data' => $data,
            ],
        ];
    }

}
