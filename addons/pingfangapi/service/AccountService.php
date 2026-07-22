<?php

namespace addons\pingfangapi\service;

use addons\pingfangdevice\service\DeviceSession;
use think\Db;

class AccountService
{
    const CSRF_SESSION_KEY = 'pingfangapi_csrf';
    const PRIVATE_LIST_LIMIT = 100;

    private $currentUserLoaded = false;
    private $currentUserValue;

    public function __construct($verifiedUser = null)
    {
        if (is_array($verifiedUser)) {
            $this->currentUserLoaded = true;
            $this->currentUserValue = intval(isset($verifiedUser['user_id']) ? $verifiedUser['user_id'] : 0) > 0 ? $verifiedUser : null;
        }
    }

    public function sessionData()
    {
        $user = $this->currentUser();

        return [
            'authenticated' => !empty($user),
            'csrfToken' => $this->csrfToken(),
            'user' => empty($user) ? null : self::mapUser($user),
            'requirements' => $this->requirements(),
        ];
    }

    public function requirements()
    {
        $requirements = [
            'loginCaptcha' => intval(isset($GLOBALS['config']['user']['login_verify']) ? $GLOBALS['config']['user']['login_verify'] : 0) === 1,
            'feedbackCaptcha' => intval(isset($GLOBALS['config']['gbook']['verify']) ? $GLOBALS['config']['gbook']['verify'] : 0) === 1,
            'feedbackLogin' => intval(isset($GLOBALS['config']['gbook']['login']) ? $GLOBALS['config']['gbook']['login'] : 0) === 1,
            'feedbackEnabled' => intval(isset($GLOBALS['config']['gbook']['status']) ? $GLOBALS['config']['gbook']['status'] : 1) === 1,
            'feedbackAudit' => intval(isset($GLOBALS['config']['gbook']['audit']) ? $GLOBALS['config']['gbook']['audit'] : 0) === 1,
            'commentCaptcha' => intval(isset($GLOBALS['config']['comment']['verify']) ? $GLOBALS['config']['comment']['verify'] : 0) === 1,
            'commentLogin' => intval(isset($GLOBALS['config']['comment']['login']) ? $GLOBALS['config']['comment']['login'] : 0) === 1,
            'commentEnabled' => intval(isset($GLOBALS['config']['comment']['status']) ? $GLOBALS['config']['comment']['status'] : 1) === 1,
            'commentAudit' => intval(isset($GLOBALS['config']['comment']['audit']) ? $GLOBALS['config']['comment']['audit'] : 0) === 1,
            'captchaUrl' => null,
        ];
        if ($requirements['loginCaptcha'] || $requirements['feedbackCaptcha'] || $requirements['commentCaptcha']) {
            $requirements['captchaUrl'] = $this->captchaUrl();
        }

        return $requirements;
    }

    public function currentUser()
    {
        if (!class_exists(DeviceSession::class)) {
            throw new ApiException(503, '设备会话服务不可用');
        }

        if ($this->currentUserLoaded) {
            return $this->currentUserValue;
        }

        $user = DeviceSession::currentUser();
        $this->currentUserLoaded = true;
        $this->currentUserValue = is_array($user) && intval(isset($user['user_id']) ? $user['user_id'] : 0) > 0 ? $user : null;
        return $this->currentUserValue;
    }

    public function csrfToken()
    {
        if (!function_exists('session')) {
            throw new ApiException(503, '会话服务不可用');
        }

        $token = trim((string) session(self::CSRF_SESSION_KEY));
        if (!preg_match('/^[a-f0-9]{64}$/', $token)) {
            try {
                $token = bin2hex(random_bytes(32));
            } catch (\Throwable $e) {
                throw new ApiException(503, '安全随机数服务不可用');
            }
            session(self::CSRF_SESSION_KEY, $token);
        }

        return $token;
    }

    public function login($username, $password, $captcha)
    {
        $result = model('User')->login([
            'user_name' => (string) $username,
            'user_pwd' => (string) $password,
            'verify' => (string) $captcha,
            'openid' => '',
            'col' => '',
        ], ['return_meta' => true]);

        if (!is_array($result) || intval(isset($result['code']) ? $result['code'] : 0) !== 1 || empty($result['meta'])) {
            $message = is_array($result) && !empty($result['msg']) ? (string) $result['msg'] : '用户名或密码错误';
            throw new ApiException(401, $message);
        }

        try {
            DeviceSession::registerLogin($result['meta']);
        } catch (\Throwable $e) {
            try {
                DeviceSession::logoutCurrentDevice(intval(isset($result['meta']['user_id']) ? $result['meta']['user_id'] : 0));
            } catch (\Throwable $ignored) {
            }
            model('User')->logout();
            $this->logFailure('register device login', $e);
            throw new ApiException(500, '设备会话创建失败，请重试');
        }

        $this->rotateSession();
        $this->clearCurrentUser();
        $session = $this->sessionData();
        if (empty($session['authenticated'])) {
            try {
                DeviceSession::logoutCurrentDevice(intval($result['meta']['user_id']));
            } catch (\Throwable $ignored) {
            }
            model('User')->logout();
            throw new ApiException(500, '登录状态创建失败，请重试');
        }

        return $session;
    }

    public function logout()
    {
        $user = null;
        try {
            $user = $this->currentUser();
        } catch (\Throwable $e) {
            $this->logFailure('read logout user', $e);
        }
        if (!empty($user)) {
            try {
                DeviceSession::logoutCurrentDevice(intval($user['user_id']));
            } catch (\Throwable $e) {
                $this->logFailure('revoke logout device', $e);
            }
        }

        model('User')->logout();
        $this->rotateSession();
        $this->clearCurrentUser();

        return ['authenticated' => false];
    }

    public function favorites($userId)
    {
        $rows = Db::name('Ulog')
            ->field('ulog_id,ulog_rid,ulog_time')
            ->where([
                'user_id' => intval($userId),
                'ulog_mid' => 1,
                'ulog_type' => 2,
            ])
            ->order('ulog_time desc,ulog_id desc')
            ->limit(self::PRIVATE_LIST_LIMIT)
            ->select();
        $rows = $this->rows($rows);
        $videos = $this->videosByIds($this->recordIds($rows));
        $items = [];

        foreach ($rows as $row) {
            $vodId = intval(isset($row['ulog_rid']) ? $row['ulog_rid'] : 0);
            if (!isset($videos[$vodId])) {
                continue;
            }
            $video = $videos[$vodId];
            $items[] = [
                'recordIds' => [(string) intval(isset($row['ulog_id']) ? $row['ulog_id'] : 0)],
                'vodId' => (string) $vodId,
                'title' => self::text(isset($video['vod_name']) ? $video['vod_name'] : '', '未命名影片'),
                'poster' => self::imageUrl(isset($video['vod_pic']) ? $video['vod_pic'] : ''),
                'remark' => self::text(isset($video['vod_remarks']) ? $video['vod_remarks'] : '', '已收藏'),
                'createdAt' => self::formatTime(isset($row['ulog_time']) ? $row['ulog_time'] : 0),
            ];
        }

        return $items;
    }

    public function setFavorite($userId, $vodId, $favorite)
    {
        $userId = intval($userId);
        $vodId = intval($vodId);
        $where = [
            'user_id' => $userId,
            'ulog_mid' => 1,
            'ulog_type' => 2,
            'ulog_rid' => $vodId,
        ];
        $existing = Db::name('Ulog')->field('ulog_id')->where($where)->find();

        if ($favorite) {
            if (empty($existing)) {
                $inserted = Db::name('Ulog')->insert($where + [
                    'ulog_sid' => 0,
                    'ulog_nid' => 0,
                    'ulog_points' => 0,
                    'ulog_point' => 0,
                    'ulog_duration' => 0,
                    'ulog_time' => time(),
                ]);
                if ($inserted === false) {
                    throw new ApiException(500, '收藏保存失败');
                }
            } else {
                Db::name('Ulog')->where('ulog_id', intval($existing['ulog_id']))->update(['ulog_time' => time()]);
            }
        } elseif (!empty($existing)) {
            Db::name('Ulog')->where($where)->delete();
        }

        return [
            'vodId' => (string) $vodId,
            'favorited' => (bool) $favorite,
        ];
    }

    public function deleteFavorites($userId, array $recordIds, $all)
    {
        $where = [
            'user_id' => intval($userId),
            'ulog_mid' => 1,
            'ulog_type' => 2,
        ];
        if (!$all) {
            $where['ulog_id'] = ['in', array_values($recordIds)];
        }

        $removed = Db::name('Ulog')->where($where)->delete();
        if ($removed === false) {
            throw new ApiException(500, '收藏记录删除失败');
        }

        return ['removed' => intval($removed)];
    }

    public function history($userId, $limit = self::PRIVATE_LIST_LIMIT)
    {
        $limit = max(1, min(self::PRIVATE_LIST_LIMIT, intval($limit)));
        $queryLimit = min(self::PRIVATE_LIST_LIMIT, max(20, $limit * 5));
        $rows = Db::name('Ulog')
            ->field('ulog_id,ulog_rid,ulog_sid,ulog_nid,ulog_point,ulog_duration,ulog_time')
            ->where([
                'user_id' => intval($userId),
                'ulog_mid' => 1,
                'ulog_type' => 4,
            ])
            ->where('ulog_sid', 'gt', 0)
            ->where('ulog_nid', 'gt', 0)
            ->order('ulog_time desc,ulog_id desc')
            ->limit($queryLimit)
            ->select();
        $rows = $this->rows($rows);
        $videos = $this->videosByIds($this->recordIds($rows), true);
        $items = [];
        $seen = [];
        $playLists = [];

        foreach ($rows as $row) {
            $vodId = intval(isset($row['ulog_rid']) ? $row['ulog_rid'] : 0);
            $sourceId = intval(isset($row['ulog_sid']) ? $row['ulog_sid'] : 0);
            $episodeId = intval(isset($row['ulog_nid']) ? $row['ulog_nid'] : 0);
            $recordId = intval(isset($row['ulog_id']) ? $row['ulog_id'] : 0);
            if (isset($seen[$vodId])) {
                if ($recordId > 0) {
                    $items[$seen[$vodId]]['recordIds'][] = (string) $recordId;
                }
                continue;
            }
            if ($recordId < 1 || !isset($videos[$vodId]) || $sourceId < 1 || $episodeId < 1) {
                continue;
            }
            $video = $videos[$vodId];
            if (!array_key_exists($vodId, $playLists)) {
                $playLists[$vodId] = $this->videoPlayList($video);
            }
            $episodeName = $this->episodeName($video, $sourceId, $episodeId, $playLists[$vodId]);
            if ($episodeName === null) {
                continue;
            }
            $seen[$vodId] = count($items);
            $position = max(0, intval(isset($row['ulog_point']) ? $row['ulog_point'] : 0));
            $items[] = [
                'recordIds' => [(string) $recordId],
                'vodId' => (string) $vodId,
                'sourceId' => (string) $sourceId,
                'episodeId' => (string) $episodeId,
                'title' => self::text(isset($video['vod_name']) ? $video['vod_name'] : '', '未命名影片'),
                'episodeName' => $episodeName,
                'poster' => self::imageUrl(isset($video['vod_pic']) ? $video['vod_pic'] : ''),
                'progress' => $episodeName . ' · 已看到 ' . self::clock($position),
                'watchedAt' => self::formatTime(isset($row['ulog_time']) ? $row['ulog_time'] : 0),
            ];
            if (count($items) >= $limit) {
                break;
            }
        }

        return $items;
    }

    public function saveHistory($userId, $vodId, $sourceId, $episodeId, $position, $duration)
    {
        $where = [
            'user_id' => intval($userId),
            'ulog_mid' => 1,
            'ulog_type' => 4,
            'ulog_rid' => intval($vodId),
            'ulog_sid' => intval($sourceId),
            'ulog_nid' => intval($episodeId),
        ];
        $existing = Db::name('Ulog')->field('ulog_id')->where($where)->find();
        $data = [
            'ulog_point' => intval($position),
            'ulog_time' => time(),
        ];
        if ($duration !== null) {
            $data['ulog_duration'] = intval($duration);
        }

        if (!empty($existing)) {
            $saved = Db::name('Ulog')->where('ulog_id', intval($existing['ulog_id']))->update($data);
        } else {
            $saved = Db::name('Ulog')->insert($where + $data + [
                'ulog_points' => 0,
                'ulog_duration' => $duration === null ? 0 : intval($duration),
            ]);
        }
        if ($saved === false) {
            throw new ApiException(500, '播放记录保存失败');
        }

        return ['saved' => true];
    }

    public function deleteHistory($userId, array $recordIds, $all)
    {
        $where = [
            'user_id' => intval($userId),
            'ulog_mid' => 1,
            'ulog_type' => 4,
        ];
        if (!$all) {
            $where['ulog_id'] = ['in', array_values($recordIds)];
        }

        $removed = Db::name('Ulog')->where($where)->delete();
        if ($removed === false) {
            throw new ApiException(500, '播放记录删除失败');
        }

        return ['removed' => intval($removed)];
    }

    public function feedback($userId, $name, $content, $captcha)
    {
        return $this->saveGbook($userId, $name, $content, $captcha);
    }

    public function report($userId, $vodId, $sourceId, $episodeId, $reason, $details, $captcha)
    {
        $parts = [
            '【片源报错】',
        ];
        if (intval($vodId) > 0) {
            $parts[] = '影片 ID：' . intval($vodId);
        }
        $parts[] = '问题类型：' . trim((string) $reason);
        if (intval($sourceId) > 0 && intval($episodeId) > 0) {
            $parts[] = '线路：' . intval($sourceId);
            $parts[] = '分集：' . intval($episodeId);
        }
        if (trim((string) $details) !== '') {
            $parts[] = '详情：' . trim((string) $details);
        }

        return $this->saveGbook($userId, '', implode("\n", $parts), $captcha);
    }

    public function comment($userId, $mid, $vodId, $parentId, $content, $captcha)
    {
        if (intval($mid) !== 1) {
            throw new ApiException(422, '暂不支持该评论模块');
        }
        if (intval(isset($GLOBALS['config']['comment']['status']) ? $GLOBALS['config']['comment']['status'] : 0) !== 1) {
            throw new ApiException(403, '评论功能已关闭');
        }
        $this->assertCaptcha('comment', $captcha);
        $this->assertThrottleCookie('comment_timespan');
        if (!function_exists('mac_filter_words')) {
            throw new ApiException(503, 'MacCMS 内容过滤服务不可用');
        }

        $parentId = intval($parentId);
        if ($parentId > 0) {
            $parent = Db::name('Comment')->where([
                'comment_id' => $parentId,
                'comment_mid' => 1,
                'comment_rid' => intval($vodId),
                'comment_status' => 1,
            ])->value('comment_id');
            if (intval($parent) < 1) {
                throw new ApiException(404, '父评论不存在');
            }
        }

        $model = model('Comment');
        $data = [
            'comment_mid' => 1,
            'comment_rid' => intval($vodId),
            'comment_pid' => $parentId,
            'comment_content' => htmlentities(mac_filter_words((string) $content)),
            'comment_ip' => function_exists('mac_get_ip_long') ? mac_get_ip_long() : 0,
            'comment_time' => time(),
            'user_id' => intval($userId),
            'comment_name' => htmlentities($this->userDisplayName($userId, '')),
            'comment_status' => intval(isset($GLOBALS['config']['comment']['audit']) ? $GLOBALS['config']['comment']['audit'] : 0) === 1 ? 0 : 1,
        ];
        $this->assertCommentBlacklist($data['comment_content'], $data['comment_ip']);
        $result = $model->saveData($data);
        $this->assertNativeResult($result, '评论保存失败');
        $id = $this->lastInsertId($model, '评论保存失败');
        $this->setThrottleCookie('comment_timespan', intval(isset($GLOBALS['config']['comment']['timespan']) ? $GLOBALS['config']['comment']['timespan'] : 30));

        if ($data['comment_status'] === 1 && $parentId > 0) {
            try {
                model('Notify')->sendReplyNotify($parentId, intval($userId));
            } catch (\Throwable $e) {
                $this->logFailure('send comment reply notification', $e);
            }
        }

        return [
            'id' => (string) $id,
            'status' => $data['comment_status'] === 1 ? 'published' : 'pending',
        ];
    }

    public function reaction($target, $targetId, $value)
    {
        $targetId = intval($targetId);
        if ($target === 'vod') {
            $model = model('Vod');
            $where = ['vod_id' => $targetId, 'vod_status' => 1, 'vod_recycle_time' => 0];
            $up = 'vod_up';
            $down = 'vod_down';
        } else {
            $model = model('Comment');
            $where = ['comment_id' => $targetId, 'comment_status' => 1];
            $up = 'comment_up';
            $down = 'comment_down';
        }

        $info = $model->field($up . ',' . $down)->where($where)->find();
        $info = is_object($info) && method_exists($info, 'toArray') ? $info->toArray() : $info;
        if (!is_array($info)) {
            throw new ApiException(404, '互动对象不存在');
        }

        if ($value !== 'none') {
            $cookie = $target . '-digg-' . $targetId;
            $this->assertThrottleCookie($cookie, 409, '已经操作过了');
            $field = $value === 'like' ? $up : $down;
            if ($model->where($where)->setInc($field) === false) {
                throw new ApiException(500, '互动保存失败');
            }
            $this->setThrottleCookie($cookie, 30);
            $info[$field] = intval(isset($info[$field]) ? $info[$field] : 0) + 1;
        }

        return [
            'target' => $target,
            'targetId' => (string) $targetId,
            'value' => $value,
            'likes' => max(0, intval(isset($info[$up]) ? $info[$up] : 0)),
            'dislikes' => max(0, intval(isset($info[$down]) ? $info[$down] : 0)),
        ];
    }

    public function rating($vodId, $score)
    {
        $vodId = intval($vodId);
        $score = intval($score);
        $cookie = 'vod-score-' . $vodId;
        $this->assertThrottleCookie($cookie, 409, '已经评过分了');

        $result = Db::transaction(function () use ($vodId, $score) {
            $row = Db::name('Vod')
                ->field('vod_score_num,vod_score_all')
                ->where(['vod_id' => $vodId, 'vod_status' => 1, 'vod_recycle_time' => 0])
                ->lock(true)
                ->find();
            if (empty($row)) {
                throw new ApiException(404, '影片不存在');
            }
            $count = max(0, intval($row['vod_score_num'])) + 1;
            $all = max(0, intval($row['vod_score_all'])) + $score;
            $average = number_format($all / $count, 1, '.', '');
            $saved = Db::name('Vod')->where('vod_id', $vodId)->update([
                'vod_score_num' => $count,
                'vod_score_all' => $all,
                'vod_score' => $average,
            ]);
            if ($saved === false) {
                throw new ApiException(500, '评分保存失败');
            }
            return ['average' => floatval($average), 'count' => $count];
        });
        $this->setThrottleCookie($cookie, 30);

        return [
            'vodId' => (string) $vodId,
            'score' => $score,
            'average' => $result['average'],
            'count' => $result['count'],
        ];
    }

    public function devices($userId)
    {
        $items = [];
        foreach ($this->rows(DeviceSession::listSessions(intval($userId))) as $row) {
            $label = html_entity_decode((string) (isset($row['device_label_display']) ? $row['device_label_display'] : ''), ENT_QUOTES | ENT_HTML5, 'UTF-8');
            $parts = array_map('trim', explode('·', $label, 2));
            $os = isset($parts[0]) && $parts[0] !== '' ? $parts[0] : '未知系统';
            $browser = isset($parts[1]) ? $parts[1] : '';
            $sessionId = intval(isset($row['session_id']) ? $row['session_id'] : 0);
            $revokedTime = intval(isset($row['revoked_time']) ? $row['revoked_time'] : 0);
            if ($sessionId < 1) {
                continue;
            }
            $items[] = [
                'sessionId' => (string) $sessionId,
                'name' => $label !== '' ? $label : '未知设备',
                'browser' => $browser,
                'os' => $os,
                'loginAt' => self::formatTime(isset($row['login_time']) ? $row['login_time'] : 0),
                'lastActiveAt' => self::formatTime(isset($row['last_seen_time']) ? $row['last_seen_time'] : 0),
                'ipAddress' => self::text(isset($row['ip_address_display']) ? html_entity_decode((string) $row['ip_address_display'], ENT_QUOTES | ENT_HTML5, 'UTF-8') : '', '-'),
                'userAgent' => self::text(isset($row['user_agent_display']) ? html_entity_decode((string) $row['user_agent_display'], ENT_QUOTES | ENT_HTML5, 'UTF-8') : '', '-'),
                'status' => self::text(isset($row['status_label']) ? $row['status_label'] : '', $revokedTime > 0 ? '已下线' : '在线'),
                'revokedAt' => $revokedTime > 0 ? self::formatTime($revokedTime) : null,
                'current' => !empty($row['is_current']),
            ];
        }

        return [
            'maxDevices' => DeviceSession::maxDeviceCount(),
            'items' => $items,
        ];
    }

    public function revokeDevice($userId, $sessionId)
    {
        $result = DeviceSession::revokeSession(intval($userId), intval($sessionId));
        $code = intval(is_array($result) && isset($result['code']) ? $result['code'] : 0);
        if ($code !== 1) {
            $status = $code === 1002 ? 404 : ($code === 1003 ? 409 : ($code === 1004 ? 503 : 422));
            throw new ApiException($status, is_array($result) && !empty($result['msg']) ? $result['msg'] : '设备撤销失败');
        }

        return [
            'sessionId' => (string) intval($sessionId),
            'revoked' => true,
        ];
    }

    public function guardRateLimit($action)
    {
        $limits = [
            'login' => 10,
            'password.verify' => 10,
            'search' => 20,
            'feedback' => 10,
            'report' => 10,
            'comment' => 10,
            'reaction' => 30,
            'rating' => 10,
        ];
        $limit = isset($limits[$action]) ? $limits[$action] : 60;
        $window = intval(floor(time() / 60));
        $ip = function_exists('mac_get_client_ip')
            ? (string) mac_get_client_ip()
            : (function_exists('request') ? (string) request()->ip() : 'unknown');
        $key = 'pingfangapi_rate_' . hash('sha256', $action . '|' . $ip . '|' . $window);
        $count = function_exists('cache') ? intval(cache($key)) : intval(session($key));
        if ($count >= $limit) {
            throw new ApiException(429, '请求过于频繁，请稍后重试');
        }
        if (function_exists('cache')) {
            cache($key, $count + 1, 70);
        } elseif (function_exists('session')) {
            session($key, $count + 1);
        } else {
            throw new ApiException(503, '限流服务不可用');
        }
    }

    private function rotateSession()
    {
        if (function_exists('session') && session_status() === PHP_SESSION_ACTIVE) {
            @session_regenerate_id(true);
        }
        if (function_exists('session')) {
            session(self::CSRF_SESSION_KEY, null);
        }
        $this->csrfToken();
    }

    private function videosByIds(array $ids, $withPlayback = false)
    {
        if (empty($ids)) {
            return [];
        }
        $fields = ['vod_id', 'vod_name', 'vod_pic', 'vod_remarks'];
        if ($withPlayback) {
            $fields = array_merge($fields, ['vod_play_from', 'vod_play_url', 'vod_play_server', 'vod_play_note']);
        }
        $query = Db::name('Vod')
            ->field(implode(',', $fields))
            ->where('vod_id', 'in', array_values($ids))
            ->where('vod_status', 1)
            ->where('vod_recycle_time', 0);
        $rows = $this->applyVodListAccess($query)->select();
        $out = [];
        foreach ($this->rows($rows) as $row) {
            $id = intval(isset($row['vod_id']) ? $row['vod_id'] : 0);
            if ($id > 0) {
                $out[$id] = $row;
            }
        }

        return $out;
    }

    private function applyVodListAccess($query)
    {
        if (intval(isset($GLOBALS['config']['app']['popedom_filter']) ? $GLOBALS['config']['app']['popedom_filter'] : 0) !== 1) {
            return $query;
        }
        if (!function_exists('mac_get_popedom_filter')) {
            throw new ApiException(503, 'MacCMS 分类权限服务不可用');
        }

        $groupType = isset($GLOBALS['user']['group']['group_type']) ? (string) $GLOBALS['user']['group']['group_type'] : '';
        $blocked = array_values(array_filter(array_map('intval', explode(',', (string) mac_get_popedom_filter($groupType))), function ($id) {
            return $id > 0;
        }));
        return empty($blocked) ? $query : $query->where('type_id', 'not in', $blocked);
    }

    private function videoPlayList(array $video)
    {
        if (!function_exists('mac_play_list')) {
            throw new ApiException(503, 'MacCMS 播放列表解析器不可用');
        }
        $list = mac_play_list(
            isset($video['vod_play_from']) ? $video['vod_play_from'] : '',
            isset($video['vod_play_url']) ? $video['vod_play_url'] : '',
            isset($video['vod_play_server']) ? $video['vod_play_server'] : '',
            isset($video['vod_play_note']) ? $video['vod_play_note'] : '',
            'play'
        );
        return is_array($list) ? $list : [];
    }

    private function episodeName(array $video, $sourceId, $episodeId, $list = null)
    {
        if (!is_array($list)) {
            $list = $this->videoPlayList($video);
        }
        if (empty($list[intval($sourceId)]['urls'][intval($episodeId)])) {
            return null;
        }
        $episode = $list[intval($sourceId)]['urls'][intval($episodeId)];
        return self::text(
            isset($episode['name']) ? $episode['name'] : (isset($episode['title']) ? $episode['title'] : ''),
            '第' . intval($episodeId) . '集'
        );
    }

    private function recordIds(array $rows)
    {
        $ids = [];
        foreach ($rows as $row) {
            $id = intval(isset($row['ulog_rid']) ? $row['ulog_rid'] : 0);
            if ($id > 0) {
                $ids[$id] = $id;
            }
        }
        return $ids;
    }

    private function saveGbook($userId, $name, $content, $captcha)
    {
        if (intval(isset($GLOBALS['config']['gbook']['status']) ? $GLOBALS['config']['gbook']['status'] : 0) !== 1) {
            throw new ApiException(403, '留言功能已关闭');
        }
        $this->assertCaptcha('gbook', $captcha);
        $this->assertThrottleCookie('gbook_timespan');
        if (!function_exists('mac_filter_words')) {
            throw new ApiException(503, 'MacCMS 内容过滤服务不可用');
        }

        $model = model('Gbook');
        $status = intval(isset($GLOBALS['config']['gbook']['audit']) ? $GLOBALS['config']['gbook']['audit'] : 0) === 1 ? 0 : 1;
        $result = $model->saveData([
            'gbook_content' => htmlentities(mac_filter_words((string) $content)),
            'gbook_reply' => '',
            'gbook_name' => htmlentities($this->userDisplayName($userId, $name)),
            'user_id' => intval($userId),
            'gbook_status' => $status,
            'gbook_ip' => function_exists('mac_get_ip_long') ? mac_get_ip_long() : 0,
            'gbook_time' => time(),
        ]);
        $this->assertNativeResult($result, '留言保存失败');
        $id = $this->lastInsertId($model, '留言保存失败');
        $this->setThrottleCookie('gbook_timespan', intval(isset($GLOBALS['config']['gbook']['timespan']) ? $GLOBALS['config']['gbook']['timespan'] : 30));

        return [
            'id' => (string) $id,
            'status' => $status === 1 ? 'published' : 'pending',
        ];
    }

    private function assertNativeResult($result, $fallback)
    {
        if (is_array($result) && intval(isset($result['code']) ? $result['code'] : 0) === 1) {
            return;
        }
        $code = is_array($result) ? intval(isset($result['code']) ? $result['code'] : 0) : 0;
        $status = $code === 9002 ? 429 : ($code === 9009 ? 503 : 422);
        $message = is_array($result) && !empty($result['msg']) ? (string) $result['msg'] : (string) $fallback;
        throw new ApiException($status, $message);
    }

    private function assertCaptcha($section, $captcha)
    {
        if (intval(isset($GLOBALS['config'][$section]['verify']) ? $GLOBALS['config'][$section]['verify'] : 0) !== 1) {
            return;
        }
        if (!function_exists('captcha_check')) {
            throw new ApiException(503, '验证码服务不可用');
        }
        if (!captcha_check((string) $captcha)) {
            throw new ApiException(422, '验证码错误');
        }
    }

    private function assertThrottleCookie($name, $status = 429, $message = '请勿频繁操作')
    {
        if (!function_exists('cookie')) {
            throw new ApiException(503, 'Cookie 服务不可用');
        }
        if ((string) cookie((string) $name) !== '') {
            throw new ApiException(intval($status), (string) $message);
        }
    }

    private function setThrottleCookie($name, $seconds)
    {
        cookie((string) $name, 't', max(1, intval($seconds)));
    }

    private function userDisplayName($userId, $fallback)
    {
        if (intval($userId) < 1) {
            return trim((string) $fallback) !== '' ? trim((string) $fallback) : '游客';
        }
        $current = $this->currentUser();
        if (is_array($current) && intval(isset($current['user_id']) ? $current['user_id'] : 0) === intval($userId)) {
            $name = trim((string) (isset($current['user_nick_name']) ? $current['user_nick_name'] : ''));
            if ($name === '') {
                $name = trim((string) (isset($current['user_name']) ? $current['user_name'] : ''));
            }
            if ($name !== '') {
                return $name;
            }
        }
        $row = model('User')->field('user_nick_name,user_name')->where(['user_id' => intval($userId)])->find();
        if (is_object($row) && method_exists($row, 'toArray')) {
            $row = $row->toArray();
        }
        if (is_array($row)) {
            $name = trim((string) (isset($row['user_nick_name']) ? $row['user_nick_name'] : ''));
            if ($name === '') {
                $name = trim((string) (isset($row['user_name']) ? $row['user_name'] : ''));
            }
            if ($name !== '') {
                return $name;
            }
        }
        return trim((string) $fallback) !== '' ? trim((string) $fallback) : '会员';
    }

    private function lastInsertId($model, $message)
    {
        try {
            $id = is_object($model) ? intval($model->getLastInsID()) : 0;
        } catch (\Throwable $e) {
            $this->logFailure('read last insert id', $e);
            $id = 0;
        }
        if ($id < 1) {
            throw new ApiException(500, (string) $message);
        }
        return $id;
    }

    private function captchaUrl()
    {
        if (!function_exists('url')) {
            throw new ApiException(503, '验证码路由不可用');
        }
        $value = trim((string) url('verify/index'));
        if ($value === '' || strpos($value, '//') === 0 || preg_match('/^[a-z][a-z0-9+.-]*:/i', $value)) {
            throw new ApiException(503, '验证码路由不是安全的站内地址');
        }
        return $value[0] === '/' ? $value : '/' . $value;
    }

    private function assertCommentBlacklist($content, $ip)
    {
        $blacks = function_exists('config') ? config('blacks') : [];
        if (!is_array($blacks)) {
            return;
        }
        $keywords = isset($blacks['black_keyword_list']) && is_array($blacks['black_keyword_list'])
            ? $blacks['black_keyword_list']
            : [];
        foreach ($keywords as $keyword) {
            $keyword = (string) $keyword;
            if ($keyword !== '' && strpos((string) $content, $keyword) !== false) {
                throw new ApiException(422, '评论包含禁止发布的内容');
            }
        }
        $ips = isset($blacks['black_ip_list']) && is_array($blacks['black_ip_list']) ? $blacks['black_ip_list'] : [];
        $clientIp = intval($ip) > 0 ? long2ip(intval($ip)) : '';
        if ($clientIp !== '' && in_array($clientIp, $ips, true)) {
            throw new ApiException(403, '当前地址不能发表评论');
        }
    }

    private function rows($value)
    {
        if (is_object($value) && method_exists($value, 'toArray')) {
            $value = $value->toArray();
        }
        return is_array($value) ? $value : [];
    }

    private static function mapUser(array $user)
    {
        $id = intval(isset($user['user_id']) ? $user['user_id'] : 0);
        $name = !empty($user['user_nick_name']) ? $user['user_nick_name'] : (isset($user['user_name']) ? $user['user_name'] : '用户');
        return [
            'id' => (string) $id,
            'name' => self::text($name, '用户'),
        ];
    }

    private function clearCurrentUser()
    {
        $this->currentUserLoaded = false;
        $this->currentUserValue = null;
    }

    private static function imageUrl($value)
    {
        $value = trim((string) $value);
        if ($value !== '' && function_exists('mac_url_img')) {
            $value = trim((string) mac_url_img($value));
        }
        return $value;
    }

    private static function text($value, $fallback)
    {
        $value = trim(strip_tags((string) $value));
        return $value !== '' ? $value : (string) $fallback;
    }

    private static function formatTime($value)
    {
        $timestamp = intval($value);
        return $timestamp > 0 ? date('c', $timestamp) : '1970-01-01T00:00:00+00:00';
    }

    private static function clock($seconds)
    {
        $seconds = max(0, intval($seconds));
        $hours = intval(floor($seconds / 3600));
        $minutes = intval(floor(($seconds % 3600) / 60));
        $tail = str_pad((string) ($seconds % 60), 2, '0', STR_PAD_LEFT);
        if ($hours > 0) {
            return $hours . ':' . str_pad((string) $minutes, 2, '0', STR_PAD_LEFT) . ':' . $tail;
        }
        return $minutes . ':' . $tail;
    }

    private function logFailure($action, \Throwable $e)
    {
        $message = '[pingfangapi] Failed to ' . $action . ': ' . $e->getMessage();
        if (function_exists('trace')) {
            trace($message, 'error');
            return;
        }
        error_log($message);
    }
}
