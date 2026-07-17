<?php

namespace addons\douban\service;

use think\Db;

class DoubanData
{
    private const VOD_TABLE = 'vod';
    private const TYPE_TABLE = 'type';
    private const CONFIG_TABLE = 'douban_config';
    private const META_TABLE = 'douban_vod_meta';
    private const TASK_TABLE = 'douban_task';
    private const LOG_TABLE = 'douban_log';
    private const CANDIDATE_TABLE = 'douban_review_candidate';
    private const STATS_CACHE_KEY = 'douban_dashboard_stats_v1';
    private const STATS_CACHE_SECONDS = 60;
    private const RATE_LIMIT_STATE_KEY = 'rate_limit_next_at';
    private const MANUAL_RETRY_AT = 2147483647;

    private const TASK_SYNC = 'SYNC_DOUBAN';
    private const TASK_MATCH = 'MATCH_DOUBAN_ID';
    private const ACTION_AUTO_SYNC = 'AUTO_SYNC';
    private static $nextLocalRequestAt = 0.0;
    private static $rateLimitStateReady = false;

    public static function configDefaults()
    {
        return [
            'douban_endpoint' => 'internal',
            'exclude_type_ids' => '',
            'batch_size' => 100,
            'worker_limit' => 20,
            'request_per_minute' => 30,
            'max_attempts' => 5,
            'auto_confirm_score' => 85,
            'candidate_topn' => 5,
        ];
    }

    public static function config()
    {
        $config = self::configDefaults();
        try {
            $rows = self::toArray(Db::name(self::CONFIG_TABLE)->select());
            foreach ($rows as $row) {
                $key = (string) ($row['config_key'] ?? '');
                if ($key !== '' && array_key_exists($key, $config)) {
                    $config[$key] = (string) ($row['config_value'] ?? '');
                }
            }
        } catch (\Throwable $e) {
            return $config;
        }

        return self::normalizeConfig($config);
    }

    public static function saveConfig(array $input)
    {
        $config = self::normalizeConfig(array_merge(self::config(), $input));
        $now = time();
        foreach ($config as $key => $value) {
            $row = Db::name(self::CONFIG_TABLE)->where('config_key', $key)->find();
            $data = [
                'config_key' => $key,
                'config_value' => (string) $value,
                'updated_at' => $now,
            ];
            if (!empty($row)) {
                Db::name(self::CONFIG_TABLE)->where('config_key', $key)->update($data);
            } else {
                Db::name(self::CONFIG_TABLE)->insert($data);
            }
        }

        return $config;
    }

    public static function dashboard()
    {
        return [
            'config' => self::config(),
            'stats' => self::stats(),
            'task_stats' => self::taskStats(),
            'logs' => self::recentLogs(20),
            'categories' => self::calibrationCategories(),
        ];
    }

    public static function listVideos(string $status = 'review', int $page = 1, int $limit = 20, string $q = '')
    {
        $page = max(1, $page);
        $limit = max(10, min(100, $limit));
        $query = self::videoQuery($status, $q);
        $total = (int) $query->count();
        $rows = self::toArray(self::videoQuery($status, $q)
            ->order('v.vod_id desc')
            ->page($page, $limit)
            ->select());
        $candidates = $status === 'review' ? self::candidatesForVodIds(array_column($rows, 'vod_id')) : [];

        foreach ($rows as &$row) {
            $vodId = (int) ($row['vod_id'] ?? 0);
            $row['display_douban_id'] = self::resolveDoubanId($row, $row);
            $row['douban_review_status'] = (string) ($row['douban_review_status'] ?? '');
            $row['douban_next_sync_label'] = self::formatTime((int) ($row['douban_next_sync_at'] ?? 0));
            $row['douban_last_sync_label'] = self::formatTime((int) ($row['douban_last_sync_at'] ?? 0));
            $row['candidates'] = $candidates[$vodId] ?? [];
        }
        unset($row);

        return [
            'data' => $rows,
            'page' => $page,
            'limit' => $limit,
            'total' => $total,
        ];
    }

    public static function listTasks(string $status = 'PENDING', int $limit = 50)
    {
        $status = strtoupper(trim($status));
        $allowed = ['PENDING', 'RUNNING', 'FAILED', 'SUCCESS', 'SKIP', 'ALL'];
        if (!in_array($status, $allowed, true)) {
            $status = 'PENDING';
        }
        $limit = max(1, min(100, $limit));
        $vodTable = self::tableName(self::VOD_TABLE) . ' v';
        $typeTable = self::tableName(self::TYPE_TABLE) . ' ty';
        $fields = 't.task_id,t.vod_id,t.task_type,t.status,t.priority,t.attempts,t.run_after,t.last_error,' .
            't.created_at,t.updated_at,v.vod_name,v.vod_year,ty.type_name';
        if (self::columnExists(self::VOD_TABLE, 'vod_douban_id')) {
            $fields .= ',v.vod_douban_id';
        }
        $query = Db::name(self::TASK_TABLE)
            ->alias('t')
            ->join($vodTable, 'v.vod_id = t.vod_id', 'LEFT')
            ->join($typeTable, 'ty.type_id = v.type_id', 'LEFT')
            ->field($fields);
        if ($status !== 'ALL') {
            $query = $query->where('t.status', $status);
        }
        $rows = self::toArray($query
            ->order('t.priority desc,t.task_id asc')
            ->limit($limit)
            ->select());
        foreach ($rows as &$row) {
            $taskType = (string) ($row['task_type'] ?? '');
            $taskStatus = (string) ($row['status'] ?? '');
            $row['task_type_label'] = $taskType === self::TASK_MATCH ? '匹配豆瓣ID' : ($taskType === self::TASK_SYNC ? '同步豆瓣资料' : $taskType);
            if ($taskStatus === 'PENDING' && (int) ($row['attempts'] ?? 0) > 0) {
                $row['status_label'] = '等待重试';
            } else {
                $statusLabels = [
                    'PENDING' => '待执行',
                    'RUNNING' => '执行中',
                    'FAILED' => '失败',
                    'SUCCESS' => '成功',
                    'SKIP' => '已跳过',
                ];
                $row['status_label'] = $statusLabels[$taskStatus] ?? $taskStatus;
            }
            $row['run_after_label'] = self::formatTime((int) ($row['run_after'] ?? 0));
        }
        unset($row);

        return $rows;
    }

    public static function previewTargetedTasks(array $input)
    {
        $filters = self::normalizeTargetedFilters($input, self::categoryRows());
        $parts = self::targetedQueryParts($filters, time());
        $fromSql = "FROM {$parts['vod_table']} v LEFT JOIN {$parts['meta_table']} m ON m.vod_id = v.vod_id ";
        $total = self::scalar(
            "SELECT COUNT(*) AS total {$fromSql}WHERE {$parts['where']}",
            $parts['bind']
        );
        $rows = self::toArray(Db::query(
            "SELECT " .
            "COALESCE(SUM(CASE WHEN {$parts['id_expr']} IS NULL THEN 1 ELSE 0 END), 0) AS match_tasks, " .
            "COALESCE(SUM(CASE WHEN {$parts['id_expr']} IS NOT NULL THEN 1 ELSE 0 END), 0) AS sync_tasks " .
            "{$fromSql}WHERE {$parts['where']} AND {$parts['inactive_sql']}",
            $parts['bind']
        ));
        $row = $rows[0] ?? [];
        $matchTasks = (int) ($row['match_tasks'] ?? 0);
        $syncTasks = (int) ($row['sync_tasks'] ?? 0);

        return array_merge($filters, [
            'total' => $total,
            'match_tasks' => $matchTasks,
            'sync_tasks' => $syncTasks,
            'existing_tasks' => max(0, $total - $matchTasks - $syncTasks),
            'will_enqueue' => min((int) $filters['limit'], $matchTasks + $syncTasks),
        ]);
    }

    public static function enqueueTargeted(array $input, int $operatorId = 0)
    {
        $filters = self::normalizeTargetedFilters($input, self::categoryRows());
        $now = time();
        $parts = self::targetedQueryParts($filters, $now);
        $hasVodDoubanId = self::columnExists(self::VOD_TABLE, 'vod_douban_id');
        $doubanField = $hasVodDoubanId ? 'v.vod_douban_id' : "''";
        $rows = self::toArray(Db::query(
            "SELECT v.vod_id,v.vod_name,v.type_id,v.vod_year,{$doubanField} AS vod_douban_id," .
            "m.vod_id AS meta_vod_id,m.douban_id AS meta_douban_id,m.douban_ignore_until,m.douban_next_sync_at " .
            "FROM {$parts['vod_table']} v LEFT JOIN {$parts['meta_table']} m ON m.vod_id = v.vod_id " .
            "WHERE {$parts['where']} AND {$parts['inactive_sql']} " .
            "ORDER BY v.vod_id ASC LIMIT " . (int) $filters['limit'],
            $parts['bind']
        ));
        $vodIds = array_values(array_unique(array_filter(array_map('intval', array_column($rows, 'vod_id')))));
        self::insertMissingMetaRows($rows, $now);
        $activeTaskKeys = self::activeTaskKeys($vodIds);
        $prepared = self::prepareTaskRows($rows, $activeTaskKeys, $now);
        self::insertTaskRows($prepared['task_rows']);
        if (!empty($prepared['match_vod_ids'])) {
            Db::name(self::META_TABLE)->whereIn('vod_id', $prepared['match_vod_ids'])->update([
                'douban_review_status' => 'NOT_FOUND',
                'douban_review_reason' => '等待匹配豆瓣ID',
                'updated_at' => $now,
            ]);
        }
        $created = count($prepared['task_rows']);
        if ($created > 0) {
            self::recordLog(0, 'ENQUEUE_TARGETED', [], [
                'created' => $created,
                'match_created' => $prepared['match_created'],
                'sync_created' => $prepared['sync_created'],
                'filters' => $filters,
            ], '按筛选范围生成豆瓣任务', 0, $operatorId);
        }
        if (!empty($rows)) {
            self::forgetStatsCache();
        }

        return array_merge($filters, [
            'scanned' => count($rows),
            'created' => $created,
            'match_created' => $prepared['match_created'],
            'sync_created' => $prepared['sync_created'],
        ]);
    }

    public static function enqueueDue(int $limit = 100, int $operatorId = 0)
    {
        $config = self::config();
        $limit = max(1, min(500, $limit));
        $now = time();
        $vodTable = self::quoteTable(self::tableName(self::VOD_TABLE));
        $metaTable = self::quoteTable(self::tableName(self::META_TABLE));
        $hasVodDoubanId = self::columnExists(self::VOD_TABLE, 'vod_douban_id');
        $doubanField = $hasVodDoubanId ? 'v.vod_douban_id' : "''";
        $excludeIds = self::parseIds((string) $config['exclude_type_ids']);
        $bind = [$now, $now];
        $excludeSql = '';
        if (!empty($excludeIds)) {
            $excludeSql = ' AND v.type_id NOT IN (' . implode(',', array_fill(0, count($excludeIds), '?')) . ')';
            foreach ($excludeIds as $id) {
                $bind[] = $id;
            }
        }

        $sql = "SELECT v.vod_id, v.vod_name, v.type_id, v.vod_year, {$doubanField} AS vod_douban_id, " .
            "m.vod_id AS meta_vod_id, m.douban_id AS meta_douban_id, m.douban_ignore_until, m.douban_next_sync_at " .
            "FROM {$vodTable} v LEFT JOIN {$metaTable} m ON m.vod_id = v.vod_id " .
            "WHERE IFNULL(v.vod_status, 1) = 1 " .
            "AND (m.vod_id IS NULL OR IFNULL(m.douban_next_sync_at, 0) <= ?) " .
            "AND (IFNULL(m.douban_ignore_until, 0) = 0 OR m.douban_ignore_until <= ?) " .
            $excludeSql .
            " ORDER BY IFNULL(m.douban_next_sync_at, 0) ASC, v.vod_id ASC LIMIT " . $limit;

        $rows = self::toArray(Db::query($sql, $bind));
        $vodIds = [];
        foreach ($rows as $row) {
            $vodId = (int) ($row['vod_id'] ?? 0);
            if ($vodId > 0) {
                $vodIds[$vodId] = $vodId;
            }
        }
        self::insertMissingMetaRows($rows, $now);
        $activeTaskKeys = self::activeTaskKeys(array_values($vodIds));
        $prepared = self::prepareTaskRows($rows, $activeTaskKeys, $now);
        $taskRows = $prepared['task_rows'];
        $matchVodIds = $prepared['match_vod_ids'];
        self::insertTaskRows($taskRows);
        if (!empty($matchVodIds)) {
            Db::name(self::META_TABLE)->whereIn('vod_id', array_values($matchVodIds))->update([
                'douban_review_status' => 'NOT_FOUND',
                'douban_review_reason' => '等待匹配豆瓣ID',
                'updated_at' => $now,
            ]);
        }

        $created = count($taskRows);
        if ($created > 0) {
            self::recordLog(0, 'ENQUEUE_DUE', [], ['created' => $created, 'limit' => $limit], '批量生成到期任务', 0, $operatorId);
        }
        if (!empty($rows)) {
            self::forgetStatsCache();
        }

        return ['created' => $created, 'scanned' => count($rows)];
    }

    public static function runPending(int $limit = 20, int $operatorId = 0)
    {
        $config = self::config();
        $limit = max(1, min(100, (int) $config['request_per_minute'], $limit));
        $now = time();
        $recovered = (int) Db::name(self::TASK_TABLE)
            ->where('status', 'RUNNING')
            ->where('updated_at', '<', $now - 1800)
            ->update([
                'status' => 'PENDING',
                'run_after' => $now,
                'last_error' => 'Worker 超时，已重新入队',
                'updated_at' => $now,
            ]);
        $tasks = self::toArray(Db::name(self::TASK_TABLE)
            ->where('status', 'PENDING')
            ->where('run_after', '<=', $now)
            ->order('priority desc, task_id asc')
            ->limit($limit)
            ->select());
        $result = ['success' => 0, 'retrying' => 0, 'failed' => 0, 'skipped' => 0, 'recovered' => $recovered, 'items' => []];

        foreach ($tasks as $task) {
            $taskId = (int) ($task['task_id'] ?? 0);
            $attempts = (int) ($task['attempts'] ?? 0) + 1;
            $claimedAt = time();
            $claimed = Db::name(self::TASK_TABLE)
                ->where('task_id', $taskId)
                ->where('status', 'PENDING')
                ->where('run_after', '<=', $claimedAt)
                ->update([
                    'status' => 'RUNNING',
                    'attempts' => $attempts,
                    'updated_at' => $claimedAt,
                ]);
            if ((int) $claimed !== 1) {
                continue;
            }

            try {
                $itemResult = self::runTask($task, $operatorId, $config);
                $status = !empty($itemResult['skipped']) ? 'SKIP' : 'SUCCESS';
                $completed = Db::name(self::TASK_TABLE)
                    ->where('task_id', $taskId)
                    ->where('status', 'RUNNING')
                    ->where('attempts', $attempts)
                    ->update([
                        'status' => $status,
                        'payload' => self::json($itemResult),
                        'last_error' => '',
                        'updated_at' => time(),
                    ]);
                if ((int) $completed !== 1) {
                    continue;
                }
                if ($status === 'SKIP') {
                    $result['skipped']++;
                } else {
                    $result['success']++;
                }
                $result['items'][] = $itemResult;
            } catch (\Throwable $e) {
                $message = mb_substr($e->getMessage(), 0, 255, 'UTF-8');
                $failedAt = time();
                $failureUpdate = self::taskFailureUpdate($attempts, (int) $config['max_attempts'], $failedAt);
                $failed = Db::name(self::TASK_TABLE)
                    ->where('task_id', $taskId)
                    ->where('status', 'RUNNING')
                    ->where('attempts', $attempts)
                    ->update(array_merge($failureUpdate, [
                        'last_error' => $message,
                        'updated_at' => $failedAt,
                    ]));
                if ((int) $failed !== 1) {
                    continue;
                }
                $terminal = $failureUpdate['status'] === 'FAILED';
                self::markSyncFailure((int) ($task['vod_id'] ?? 0), $message, $attempts, $terminal);
                if ($terminal) {
                    $result['failed']++;
                } else {
                    $result['retrying']++;
                }
                $result['items'][] = [
                    'task_id' => $taskId,
                    'vod_id' => (int) ($task['vod_id'] ?? 0),
                    'code' => 1002,
                    'msg' => $message,
                    'status' => $failureUpdate['status'],
                    'run_after' => $failureUpdate['run_after'],
                ];
            }
        }
        if (!empty($tasks)) {
            self::forgetStatsCache();
        }

        return $result;
    }

    public static function retryFailed(int $limit = 100, int $operatorId = 0)
    {
        $limit = max(1, min(500, $limit));
        $tasks = self::toArray(Db::name(self::TASK_TABLE)
            ->where('status', 'FAILED')
            ->order('priority desc, updated_at asc, task_id asc')
            ->limit($limit)
            ->select());
        if (empty($tasks)) {
            return ['requeued' => 0, 'skipped' => 0];
        }

        $vodIds = [];
        foreach ($tasks as $task) {
            $vodId = (int) ($task['vod_id'] ?? 0);
            if ($vodId > 0) {
                $vodIds[$vodId] = $vodId;
            }
        }
        $activeKeys = self::activeTaskKeys(array_values($vodIds), ['PENDING', 'RUNNING']);
        $selectedKeys = [];
        $taskIds = [];
        $selectedVodIds = [];
        foreach ($tasks as $task) {
            $taskId = (int) ($task['task_id'] ?? 0);
            $vodId = (int) ($task['vod_id'] ?? 0);
            $taskType = (string) ($task['task_type'] ?? '');
            $key = $vodId . ':' . $taskType;
            if ($taskId < 1 || $vodId < 1 || $taskType === '' || isset($activeKeys[$key]) || isset($selectedKeys[$key])) {
                continue;
            }
            $taskIds[] = $taskId;
            $selectedVodIds[$vodId] = $vodId;
            $selectedKeys[$key] = true;
        }
        if (empty($taskIds)) {
            return ['requeued' => 0, 'skipped' => count($tasks)];
        }

        $now = time();
        $requeued = (int) Db::name(self::TASK_TABLE)
            ->whereIn('task_id', $taskIds)
            ->where('status', 'FAILED')
            ->update([
                'status' => 'PENDING',
                'attempts' => 0,
                'run_after' => $now,
                'last_error' => '',
                'updated_at' => $now,
            ]);
        if ($requeued > 0) {
            Db::name(self::META_TABLE)->whereIn('vod_id', array_values($selectedVodIds))->update([
                'douban_next_sync_at' => $now,
                'updated_at' => $now,
            ]);
            self::recordLog(0, 'RETRY_FAILED', [], ['requeued' => $requeued], '批量重新入队失败任务', 0, $operatorId);
            self::forgetStatsCache();
        }

        return ['requeued' => $requeued, 'skipped' => count($tasks) - $requeued];
    }

    public static function syncVod(int $vodId, int $operatorId = 0)
    {
        $result = self::syncVodWithConfig($vodId, $operatorId, self::config());
        if ((int) ($result['code'] ?? 0) === 1) {
            self::resolveFailedTasks($vodId, '已由手动同步解决');
        }
        self::forgetStatsCache();

        return $result;
    }

    private static function syncVodWithConfig(int $vodId, int $operatorId, array $config)
    {
        if ($vodId < 1) {
            throw new \InvalidArgumentException('vod_id missing');
        }
        $vod = Db::name(self::VOD_TABLE)->where('vod_id', $vodId)->find();
        if (empty($vod)) {
            throw new \RuntimeException('影片不存在');
        }
        $meta = self::ensureMeta($vodId);
        $doubanId = self::resolveDoubanId($meta, $vod);
        if ($doubanId === '') {
            self::updateMeta($vodId, [
                'douban_review_status' => 'NOT_FOUND',
                'douban_review_reason' => '缺少豆瓣ID，无法同步',
            ]);
            return ['vod_id' => $vodId, 'code' => 1001, 'msg' => '缺少豆瓣ID，无法同步'];
        }

        $data = self::fetchDoubanData($doubanId, $config);
        $updates = self::buildVodUpdates((array) $vod, (array) $meta, $data, $doubanId);
        $oldValues = [];
        foreach ($updates as $field => $value) {
            $oldValues[$field] = $vod[$field] ?? '';
        }
        if (!empty($updates)) {
            Db::name(self::VOD_TABLE)->where('vod_id', $vodId)->update($updates);
        }

        $now = time();
        self::updateMeta($vodId, [
            'douban_id' => $doubanId,
            'douban_id_source' => (string) ($meta['douban_id_source'] ?? 'manual'),
            'douban_review_status' => 'CONFIRMED',
            'douban_review_reason' => '',
            'douban_last_sync_at' => $now,
            'douban_next_sync_at' => self::nextSyncAt((array) $vod),
            'douban_sync_fail_count' => 0,
            'douban_last_fail_at' => 0,
            'douban_last_fail_reason' => '',
        ]);
        self::recordLog($vodId, self::ACTION_AUTO_SYNC, $oldValues, $updates, '调用豆瓣数据接口同步资料', 0, $operatorId);

        return [
            'vod_id' => $vodId,
            'code' => 1,
            'msg' => '同步完成',
            'updated_fields' => array_keys($updates),
        ];
    }

    public static function setDoubanId(int $vodId, string $doubanId, int $lock = 0, int $operatorId = 0)
    {
        $vodId = max(0, $vodId);
        $doubanId = self::normalizeDoubanId($doubanId);
        if ($vodId < 1 || $doubanId === '') {
            throw new \InvalidArgumentException('参数错误');
        }
        $vod = Db::name(self::VOD_TABLE)->where('vod_id', $vodId)->find();
        if (empty($vod)) {
            throw new \RuntimeException('影片不存在');
        }
        if (self::columnExists(self::VOD_TABLE, 'vod_douban_id')) {
            Db::name(self::VOD_TABLE)->where('vod_id', $vodId)->update([
                'vod_douban_id' => $doubanId,
            ]);
        }

        $old = self::ensureMeta($vodId);
        $now = time();
        self::updateMeta($vodId, [
            'douban_id' => $doubanId,
            'douban_id_source' => 'manual',
            'douban_id_confidence' => 100,
            'douban_id_locked' => $lock ? 1 : 0,
            'douban_id_lock_time' => $lock ? $now : 0,
            'douban_review_status' => 'CONFIRMED',
            'douban_review_reason' => '',
            'douban_next_sync_at' => $now,
        ]);
        self::recordLog($vodId, 'MANUAL_SET_ID', $old, ['douban_id' => $doubanId, 'lock' => $lock], '手动设置豆瓣ID', 100, $operatorId);
        self::resolveFailedTasks($vodId, '已由手动设置豆瓣ID解决');
        self::forgetStatsCache();

        return ['vod_id' => $vodId, 'douban_id' => $doubanId, 'locked' => $lock ? 1 : 0];
    }

    public static function setLock(int $vodId, string $field, int $locked, int $operatorId = 0)
    {
        $vodId = max(0, $vodId);
        if ($vodId < 1) {
            throw new \InvalidArgumentException('vod_id missing');
        }
        $now = time();
        $old = self::ensureMeta($vodId);
        if ($field === 'intro') {
            $updates = [
                'intro_locked' => $locked ? 1 : 0,
                'intro_lock_time' => $locked ? $now : 0,
            ];
            $action = $locked ? 'LOCK_INTRO' : 'UNLOCK_INTRO';
        } else {
            $updates = [
                'douban_id_locked' => $locked ? 1 : 0,
                'douban_id_lock_time' => $locked ? $now : 0,
            ];
            $action = $locked ? 'LOCK_ID' : 'UNLOCK_ID';
        }

        self::updateMeta($vodId, $updates);
        self::recordLog($vodId, $action, $old, $updates, '后台手动切换锁定状态', 0, $operatorId);
        self::forgetStatsCache();

        return ['vod_id' => $vodId, 'locked' => $locked ? 1 : 0];
    }

    public static function ignore(int $vodId, int $days, int $operatorId = 0)
    {
        $vodId = max(0, $vodId);
        $days = max(1, min(3650, $days));
        if ($vodId < 1) {
            throw new \InvalidArgumentException('vod_id missing');
        }
        $old = self::ensureMeta($vodId);
        $until = time() + $days * 86400;
        $updates = [
            'douban_review_status' => 'IGNORED',
            'douban_review_reason' => '后台忽略 ' . $days . ' 天',
            'douban_ignore_until' => $until,
        ];
        self::updateMeta($vodId, $updates);
        self::recordLog($vodId, 'IGNORE', $old, $updates, '后台忽略核查项', 0, $operatorId);
        self::forgetStatsCache();

        return ['vod_id' => $vodId, 'ignore_until' => $until];
    }

    public static function calibrateScores(int $operatorId = 0)
    {
        $result = self::applyScoreCalibration([]);
        self::recordLog(0, 'CALIBRATE_SCORE', [], $result, '统一使用豆瓣评分排序', 0, $operatorId);

        return $result;
    }

    public static function calibrationCategories()
    {
        return self::categoryOptionsFromRows(self::categoryRows());
    }

    public static function previewScoreCalibration(array $typeIds, int $includeChildren = 1)
    {
        $scope = self::calibrationScope($typeIds, $includeChildren === 1);
        $result = self::scoreCalibrationPreview($scope['type_ids']);

        return array_merge($result, $scope);
    }

    public static function calibrateScoresByType(array $typeIds, int $includeChildren = 1, int $operatorId = 0)
    {
        $scope = self::calibrationScope($typeIds, $includeChildren === 1);
        $result = array_merge(self::applyScoreCalibration($scope['type_ids']), $scope);
        self::recordLog(
            0,
            'CALIBRATE_TYPE_SCORE',
            [],
            $result,
            '按分类校准豆瓣评分：' . implode('、', $scope['type_names']),
            0,
            $operatorId
        );

        return $result;
    }

    private static function calibrationScope(array $typeIds, bool $includeChildren)
    {
        $rows = self::categoryRows();
        $resolvedIds = self::resolveCalibrationTypeIds($typeIds, $includeChildren, $rows);
        $labels = array_column(self::categoryOptionsFromRows($rows), 'display_name', 'type_id');
        $names = [];
        foreach ($resolvedIds as $typeId) {
            $names[] = (string) ($labels[$typeId] ?? ('分类 #' . $typeId));
        }

        return [
            'type_ids' => $resolvedIds,
            'type_names' => $names,
            'include_children' => $includeChildren ? 1 : 0,
        ];
    }

    private static function normalizeTargetedFilters(array $input, array $categories)
    {
        $selectedTypeIds = $input['type_ids'] ?? [];
        if (!is_array($selectedTypeIds)) {
            $selectedTypeIds = [$selectedTypeIds];
        }
        $includeChildren = (int) ($input['include_children'] ?? 1) === 1;
        $typeIds = self::resolveCalibrationTypeIds($selectedTypeIds, $includeChildren, $categories);
        $labels = array_column(self::categoryOptionsFromRows($categories), 'display_name', 'type_id');
        $typeNames = [];
        foreach ($typeIds as $typeId) {
            $typeNames[] = (string) ($labels[$typeId] ?? ('分类 #' . $typeId));
        }

        $targets = [
            'missing_score' => '无豆瓣评分',
            'missing_id' => '无豆瓣ID',
            'has_id_missing_score' => '已有豆瓣ID但无评分',
            'due' => '已到同步时间',
            'all' => '所选范围全部视频',
        ];
        $target = trim((string) ($input['target'] ?? 'missing_score'));
        if (!isset($targets[$target])) {
            throw new \InvalidArgumentException('数据范围无效');
        }

        $yearFrom = trim((string) ($input['year_from'] ?? ''));
        $yearTo = trim((string) ($input['year_to'] ?? ''));
        if (($yearFrom !== '' && !ctype_digit($yearFrom)) || ($yearTo !== '' && !ctype_digit($yearTo))) {
            throw new \InvalidArgumentException('年份范围无效');
        }
        $yearFrom = $yearFrom === '' ? 0 : (int) $yearFrom;
        $yearTo = $yearTo === '' ? 0 : (int) $yearTo;
        if (($yearFrom !== 0 && ($yearFrom < 1800 || $yearFrom > 2100))
            || ($yearTo !== 0 && ($yearTo < 1800 || $yearTo > 2100))) {
            throw new \InvalidArgumentException('年份范围无效');
        }
        if ($yearFrom > 0 && $yearTo > 0 && $yearFrom > $yearTo) {
            throw new \InvalidArgumentException('起始年份不能大于结束年份');
        }

        $q = trim(strip_tags((string) ($input['q'] ?? '')));
        if (function_exists('mb_substr')) {
            $q = mb_substr($q, 0, 100, 'UTF-8');
        } else {
            $q = substr($q, 0, 100);
        }

        return [
            'type_ids' => $typeIds,
            'type_names' => $typeNames,
            'include_children' => $includeChildren ? 1 : 0,
            'target' => $target,
            'target_label' => $targets[$target],
            'year_from' => $yearFrom,
            'year_to' => $yearTo,
            'q' => $q,
            'limit' => max(1, min(500, (int) ($input['limit'] ?? 100))),
        ];
    }

    private static function targetedWhere(array $filters, array $excludeIds, string $idExpr, int $now)
    {
        $typeIds = array_values(array_unique(array_filter(array_map('intval', $filters['type_ids'] ?? []))));
        if (empty($typeIds)) {
            throw new \InvalidArgumentException('请至少选择一个分类');
        }
        $conditions = [
            'IFNULL(v.vod_status, 1) = 1',
            'v.type_id IN (' . implode(',', array_fill(0, count($typeIds), '?')) . ')',
            '(IFNULL(m.douban_ignore_until, 0) = 0 OR m.douban_ignore_until <= ?)',
            '(' . $idExpr . ' IS NOT NULL OR IFNULL(m.douban_id_locked, 0) = 0)',
        ];
        $bind = $typeIds;
        $bind[] = $now;

        $excludeIds = array_values(array_unique(array_filter(array_map('intval', $excludeIds))));
        if (!empty($excludeIds)) {
            $conditions[] = 'v.type_id NOT IN (' . implode(',', array_fill(0, count($excludeIds), '?')) . ')';
            foreach ($excludeIds as $excludeId) {
                $bind[] = $excludeId;
            }
        }

        $yearFrom = (int) ($filters['year_from'] ?? 0);
        $yearTo = (int) ($filters['year_to'] ?? 0);
        if ($yearFrom > 0) {
            $conditions[] = 'CAST(v.vod_year AS UNSIGNED) >= ?';
            $bind[] = $yearFrom;
        }
        if ($yearTo > 0) {
            $conditions[] = 'CAST(v.vod_year AS UNSIGNED) <= ?';
            $bind[] = $yearTo;
        }

        $target = (string) ($filters['target'] ?? 'missing_score');
        if ($target === 'missing_score') {
            $conditions[] = 'IFNULL(v.vod_douban_score, 0) = 0';
        } elseif ($target === 'missing_id') {
            $conditions[] = $idExpr . ' IS NULL';
        } elseif ($target === 'has_id_missing_score') {
            $conditions[] = $idExpr . ' IS NOT NULL';
            $conditions[] = 'IFNULL(v.vod_douban_score, 0) = 0';
        } elseif ($target === 'due') {
            $conditions[] = '(m.vod_id IS NULL OR IFNULL(m.douban_next_sync_at, 0) <= ?)';
            $bind[] = $now;
        } elseif ($target !== 'all') {
            throw new \InvalidArgumentException('数据范围无效');
        }

        $q = trim((string) ($filters['q'] ?? ''));
        if ($q !== '') {
            if (ctype_digit($q)) {
                $conditions[] = 'v.vod_id = ?';
                $bind[] = (int) $q;
            } else {
                $conditions[] = 'v.vod_name LIKE ?';
                $bind[] = '%' . $q . '%';
            }
        }

        return [implode(' AND ', $conditions), $bind];
    }

    private static function targetedQueryParts(array $filters, int $now)
    {
        if (in_array((string) ($filters['target'] ?? ''), ['missing_score', 'has_id_missing_score'], true)
            && !self::columnExists(self::VOD_TABLE, 'vod_douban_score')) {
            throw new \RuntimeException('视频表缺少豆瓣评分字段');
        }
        $metaIdExpr = "CASE WHEN CAST(IFNULL(m.douban_id, '0') AS UNSIGNED) > 0 " .
            'THEN TRIM(m.douban_id) ';
        if (self::columnExists(self::VOD_TABLE, 'vod_douban_id')) {
            $metaIdExpr .= "WHEN CAST(IFNULL(v.vod_douban_id, '0') AS UNSIGNED) > 0 " .
                'THEN TRIM(CAST(v.vod_douban_id AS CHAR)) ';
        }
        $idExpr = $metaIdExpr . 'ELSE NULL END';
        $config = self::config();
        [$where, $bind] = self::targetedWhere(
            $filters,
            self::parseIds((string) ($config['exclude_type_ids'] ?? '')),
            $idExpr,
            $now
        );
        $taskTable = self::quoteTable(self::tableName(self::TASK_TABLE));
        $taskTypeExpr = "CASE WHEN {$idExpr} IS NULL THEN '" . self::TASK_MATCH . "' ELSE '" . self::TASK_SYNC . "' END";
        $taskPredicate = "SELECT 1 FROM {$taskTable} existing_task " .
            'WHERE existing_task.vod_id = v.vod_id ' .
            "AND existing_task.status IN ('PENDING','RUNNING','FAILED') " .
            "AND existing_task.task_type = {$taskTypeExpr}";

        return [
            'vod_table' => self::quoteTable(self::tableName(self::VOD_TABLE)),
            'meta_table' => self::quoteTable(self::tableName(self::META_TABLE)),
            'id_expr' => $idExpr,
            'inactive_sql' => 'NOT EXISTS (' . $taskPredicate . ')',
            'where' => $where,
            'bind' => $bind,
        ];
    }

    private static function applyScoreCalibration(array $typeIds)
    {
        self::assertScoreColumns();
        $vodTable = self::quoteTable(self::tableName(self::VOD_TABLE));
        [$scopePredicate, $bind] = self::scoreCalibrationScopeSql($typeIds);
        $scopeSql = $scopePredicate === '' ? '' : $scopePredicate . ' AND ';
        $invalidReset = Db::execute(
            "UPDATE {$vodTable} SET vod_douban_score = 0, vod_score = 0 " .
            "WHERE {$scopeSql}(vod_douban_score < 0 OR vod_douban_score > 10)",
            $bind
        );
        $mirrored = Db::execute(
            "UPDATE {$vodTable} SET vod_score = vod_douban_score " .
            "WHERE {$scopeSql}vod_douban_score > 0 AND vod_douban_score <= 10 " .
            "AND IFNULL(vod_score, 0) <> vod_douban_score",
            $bind
        );
        $reset = Db::execute(
            "UPDATE {$vodTable} SET vod_score = 0 " .
            "WHERE {$scopeSql}IFNULL(vod_douban_score, 0) = 0 AND IFNULL(vod_score, 0) <> 0",
            $bind
        );

        return ['invalid_reset' => (int) $invalidReset, 'mirrored' => (int) $mirrored, 'reset' => (int) $reset];
    }

    private static function scoreCalibrationPreview(array $typeIds)
    {
        self::assertScoreColumns();
        $vodTable = self::quoteTable(self::tableName(self::VOD_TABLE));
        [$scopePredicate, $bind] = self::scoreCalibrationScopeSql($typeIds);
        $whereSql = $scopePredicate === '' ? '' : ' WHERE ' . $scopePredicate;
        $rows = self::toArray(Db::query(
            "SELECT COUNT(*) AS total, " .
            "COALESCE(SUM(CASE WHEN vod_douban_score < 0 OR vod_douban_score > 10 THEN 1 ELSE 0 END), 0) AS invalid_reset, " .
            "COALESCE(SUM(CASE WHEN vod_douban_score > 0 AND vod_douban_score <= 10 " .
            "AND IFNULL(vod_score, 0) <> vod_douban_score THEN 1 ELSE 0 END), 0) AS mirrored, " .
            "COALESCE(SUM(CASE WHEN IFNULL(vod_douban_score, 0) = 0 " .
            "AND IFNULL(vod_score, 0) <> 0 THEN 1 ELSE 0 END), 0) AS reset " .
            "FROM {$vodTable}{$whereSql}",
            $bind
        ));
        $row = $rows[0] ?? [];

        return [
            'total' => (int) ($row['total'] ?? 0),
            'invalid_reset' => (int) ($row['invalid_reset'] ?? 0),
            'mirrored' => (int) ($row['mirrored'] ?? 0),
            'reset' => (int) ($row['reset'] ?? 0),
        ];
    }

    private static function scoreCalibrationScopeSql(array $typeIds)
    {
        if (empty($typeIds)) {
            return ['', []];
        }
        $typeIds = array_values(array_unique(array_filter(array_map('intval', $typeIds))));
        if (empty($typeIds)) {
            throw new \InvalidArgumentException('请至少选择一个分类');
        }

        return [
            'type_id IN (' . implode(',', array_fill(0, count($typeIds), '?')) . ')',
            $typeIds,
        ];
    }

    private static function assertScoreColumns()
    {
        if (!self::columnExists(self::VOD_TABLE, 'vod_douban_score') || !self::columnExists(self::VOD_TABLE, 'vod_score')) {
            throw new \RuntimeException('视频表缺少豆瓣评分字段');
        }
    }

    private static function categoryRows()
    {
        try {
            $rows = model('Type')->getCache('type_list');
            if (is_array($rows) && !empty($rows)) {
                $normalized = self::normalizeCategoryRows($rows);
                if (!empty($normalized)) {
                    return $normalized;
                }
            }
        } catch (\Throwable $e) {
        }

        try {
            return self::normalizeCategoryRows(self::toArray(Db::name(self::TYPE_TABLE)
                ->field('type_id,type_pid,type_mid,type_name,type_sort')
                ->order('type_pid asc,type_sort asc,type_id asc')
                ->select()));
        } catch (\Throwable $e) {
            return [];
        }
    }

    private static function normalizeCategoryRows(array $rows)
    {
        $normalized = [];
        foreach ($rows as $row) {
            if (!is_array($row)) {
                continue;
            }
            $typeId = (int) ($row['type_id'] ?? 0);
            $typeMid = (int) ($row['type_mid'] ?? 0);
            if ($typeId < 1 || $typeMid !== 1) {
                continue;
            }
            $typeName = trim(strip_tags((string) ($row['type_name'] ?? '')));
            if ($typeName === '') {
                $typeName = '分类 #' . $typeId;
            }
            $normalized[$typeId] = [
                'type_id' => $typeId,
                'type_pid' => max(0, (int) ($row['type_pid'] ?? 0)),
                'type_mid' => $typeMid,
                'type_name' => $typeName,
                'type_sort' => (int) ($row['type_sort'] ?? 0),
            ];
        }

        return array_values($normalized);
    }

    private static function resolveCalibrationTypeIds(array $typeIds, bool $includeChildren, array $categories)
    {
        $selected = array_values(array_unique(array_filter(array_map('intval', $typeIds))));
        if (empty($selected)) {
            throw new \InvalidArgumentException('请至少选择一个分类');
        }
        $categoryMap = [];
        foreach (self::normalizeCategoryRows($categories) as $category) {
            $categoryMap[(int) $category['type_id']] = $category;
        }
        foreach ($selected as $typeId) {
            if (!isset($categoryMap[$typeId])) {
                throw new \InvalidArgumentException('所选分类不存在');
            }
        }

        $resolved = array_fill_keys($selected, true);
        if ($includeChildren) {
            do {
                $changed = false;
                foreach ($categoryMap as $typeId => $category) {
                    $parentId = (int) ($category['type_pid'] ?? 0);
                    if (!isset($resolved[$typeId]) && isset($resolved[$parentId])) {
                        $resolved[$typeId] = true;
                        $changed = true;
                    }
                }
            } while ($changed);
        }
        $resolvedIds = array_map('intval', array_keys($resolved));
        sort($resolvedIds, SORT_NUMERIC);

        return $resolvedIds;
    }

    private static function categoryOptionsFromRows(array $rows)
    {
        $categoryMap = [];
        foreach (self::normalizeCategoryRows($rows) as $category) {
            $categoryMap[(int) $category['type_id']] = $category;
        }
        $options = [];
        foreach ($categoryMap as $typeId => $category) {
            $path = [];
            $seen = [];
            $currentId = $typeId;
            while ($currentId > 0 && isset($categoryMap[$currentId]) && !isset($seen[$currentId])) {
                $seen[$currentId] = true;
                array_unshift($path, (string) $categoryMap[$currentId]['type_name']);
                $currentId = (int) $categoryMap[$currentId]['type_pid'];
            }
            $category['display_name'] = implode(' / ', $path);
            $options[] = $category;
        }
        usort($options, function (array $left, array $right): int {
            $nameCompare = strcmp((string) $left['display_name'], (string) $right['display_name']);
            return $nameCompare !== 0 ? $nameCompare : ((int) $left['type_id'] <=> (int) $right['type_id']);
        });

        return $options;
    }

    private static function runTask(array $task, int $operatorId, array $config)
    {
        $taskType = (string) ($task['task_type'] ?? '');
        $vodId = (int) ($task['vod_id'] ?? 0);
        if ($taskType === self::TASK_SYNC) {
            return self::syncVodWithConfig($vodId, $operatorId, $config);
        }
        if ($taskType === self::TASK_MATCH) {
            return self::matchVod($vodId, $operatorId, $config);
        }

        return ['vod_id' => $vodId, 'skipped' => true, 'msg' => '未知任务类型'];
    }

    private static function matchVod(int $vodId, int $operatorId, array $config)
    {
        $vod = Db::name(self::VOD_TABLE)->where('vod_id', $vodId)->find();
        if (empty($vod)) {
            throw new \RuntimeException('影片不存在');
        }
        $meta = self::ensureMeta($vodId);
        if (self::resolveDoubanId($meta, $vod) !== '') {
            return self::syncVodWithConfig($vodId, $operatorId, $config);
        }
        if ((int) ($meta['douban_id_locked'] ?? 0) === 1) {
            return ['vod_id' => $vodId, 'skipped' => true, 'msg' => '豆瓣ID已锁定'];
        }

        $candidates = self::fetchDoubanCandidates((string) ($vod['vod_name'] ?? ''), $config);
        if (empty($candidates)) {
            $updates = [
                'douban_review_status' => 'NOT_FOUND',
                'douban_review_reason' => '未找到豆瓣候选',
                'douban_next_sync_at' => time() + 7 * 86400,
            ];
            self::updateMeta($vodId, $updates);
            self::recordLog($vodId, 'MATCH_DOUBAN_ID', $meta, $updates, '未找到豆瓣候选', 0, $operatorId);

            return ['vod_id' => $vodId, 'skipped' => true, 'msg' => '未找到豆瓣候选'];
        }

        $ranked = DoubanMatcher::rank((array) $vod, $candidates, (int) $config['auto_confirm_score']);
        self::saveCandidates($vodId, $ranked['candidates'], (int) $config['candidate_topn']);
        $top = $ranked['candidates'][0] ?? [];
        $doubanId = (string) ($top['douban_id'] ?? '');
        $duplicate = $doubanId !== '' && Db::name(self::META_TABLE)
            ->where('douban_id', $doubanId)
            ->where('vod_id', '<>', $vodId)
            ->find();

        if (!empty($ranked['auto_confirm']) && empty($duplicate)) {
            $score = (int) ($top['score_total'] ?? 0);
            $updates = [
                'douban_id' => $doubanId,
                'douban_id_source' => 'auto',
                'douban_id_confidence' => $score,
                'douban_review_status' => 'CONFIRMED',
                'douban_review_reason' => '',
                'douban_next_sync_at' => time(),
            ];
            self::updateMeta($vodId, $updates);
            self::recordLog($vodId, 'AUTO_MATCH', $meta, $updates, '片名和年份唯一匹配', $score, $operatorId);
            $synced = self::syncVodWithConfig($vodId, $operatorId, $config);
            $synced['matched_douban_id'] = $doubanId;

            return $synced;
        }

        $reason = !empty($duplicate) ? '候选豆瓣ID已被其他影片使用' : '候选匹配需要人工核查';
        $updates = [
            'douban_review_status' => 'REVIEW',
            'douban_review_reason' => $reason,
            'douban_next_sync_at' => time() + 7 * 86400,
        ];
        self::updateMeta($vodId, $updates);
        self::recordLog($vodId, 'MATCH_DOUBAN_ID', $meta, $updates, $reason, (int) ($top['score_total'] ?? 0), $operatorId);

        return ['vod_id' => $vodId, 'skipped' => true, 'msg' => $reason];
    }

    private static function saveCandidates(int $vodId, array $candidates, int $limit)
    {
        Db::name(self::CANDIDATE_TABLE)->where('vod_id', $vodId)->delete();
        $now = time();
        foreach (array_slice($candidates, 0, max(1, min(10, $limit))) as $rank => $candidate) {
            $scoreDetail = (array) ($candidate['score_detail'] ?? []);
            $scoreDetail['candidate_title'] = trim((string) ($candidate['title'] ?? ''));
            $scoreDetail['candidate_year'] = trim((string) ($candidate['year'] ?? ''));
            Db::name(self::CANDIDATE_TABLE)->insert([
                'vod_id' => $vodId,
                'douban_id' => (string) ($candidate['douban_id'] ?? ''),
                'score_total' => (int) ($candidate['score_total'] ?? 0),
                'score_detail' => self::json($scoreDetail),
                'conflicts' => self::json($candidate['conflicts'] ?? []),
                'rank' => $rank + 1,
                'created_at' => $now,
            ]);
        }
    }

    private static function candidatesForVodIds(array $vodIds)
    {
        $vodIds = array_values(array_unique(array_filter(array_map('intval', $vodIds))));
        if (empty($vodIds)) {
            return [];
        }
        $rows = self::toArray(Db::name(self::CANDIDATE_TABLE)
            ->field('vod_id,douban_id,score_total,score_detail,conflicts,rank')
            ->whereIn('vod_id', $vodIds)
            ->order('vod_id asc, rank asc')
            ->select());
        $grouped = [];
        foreach ($rows as $row) {
            $vodId = (int) ($row['vod_id'] ?? 0);
            if ($vodId < 1) {
                continue;
            }
            if (!isset($grouped[$vodId])) {
                $grouped[$vodId] = [];
            }
            $grouped[$vodId][] = self::candidateForView($row);
        }

        return $grouped;
    }

    private static function candidateForView(array $row)
    {
        $detail = json_decode((string) ($row['score_detail'] ?? ''), true);
        $detail = is_array($detail) ? $detail : [];
        $row['candidate_title'] = trim((string) ($detail['candidate_title'] ?? ''));
        $row['candidate_year'] = trim((string) ($detail['candidate_year'] ?? ''));

        return $row;
    }

    private static function stats()
    {
        if (function_exists('cache')) {
            $cached = cache(self::STATS_CACHE_KEY);
            if (is_array($cached)) {
                return $cached;
            }
        }
        $metaTable = self::quoteTable(self::tableName(self::META_TABLE));
        $vodTable = self::quoteTable(self::tableName(self::VOD_TABLE));
        $hasVodDoubanId = self::columnExists(self::VOD_TABLE, 'vod_douban_id');
        $idExpr = $hasVodDoubanId ? "COALESCE(NULLIF(m.douban_id, ''), NULLIF(v.vod_douban_id, ''))" : "NULLIF(m.douban_id, '')";
        $rows = self::toArray(Db::query(
            "SELECT COUNT(*) AS total_videos, " .
            "COALESCE(SUM(CASE WHEN {$idExpr} IS NULL THEN 1 ELSE 0 END), 0) AS no_douban_id, " .
            "COALESCE(SUM(CASE WHEN m.douban_review_status = 'REVIEW' THEN 1 ELSE 0 END), 0) AS review, " .
            "COALESCE(SUM(CASE WHEN m.douban_review_status = 'NOT_FOUND' THEN 1 ELSE 0 END), 0) AS not_found, " .
            "COALESCE(SUM(CASE WHEN m.douban_review_status = 'CONFIRMED' THEN 1 ELSE 0 END), 0) AS confirmed, " .
            "COALESCE(SUM(CASE WHEN m.douban_review_status = 'IGNORED' THEN 1 ELSE 0 END), 0) AS ignored, " .
            "COALESCE(SUM(CASE WHEN m.douban_id_locked = 1 THEN 1 ELSE 0 END), 0) AS locked_id, " .
            "COALESCE(SUM(CASE WHEN m.intro_locked = 1 THEN 1 ELSE 0 END), 0) AS locked_intro " .
            "FROM {$vodTable} v LEFT JOIN {$metaTable} m ON m.vod_id = v.vod_id",
            []
        ));
        $row = $rows[0] ?? [];

        $stats = [
            'total_videos' => (int) ($row['total_videos'] ?? 0),
            'no_douban_id' => (int) ($row['no_douban_id'] ?? 0),
            'duplicate_douban_id' => self::duplicateCount(),
            'review' => (int) ($row['review'] ?? 0),
            'not_found' => (int) ($row['not_found'] ?? 0),
            'confirmed' => (int) ($row['confirmed'] ?? 0),
            'ignored' => (int) ($row['ignored'] ?? 0),
            'locked_id' => (int) ($row['locked_id'] ?? 0),
            'locked_intro' => (int) ($row['locked_intro'] ?? 0),
        ];
        if (function_exists('cache')) {
            cache(self::STATS_CACHE_KEY, $stats, self::STATS_CACHE_SECONDS);
        }

        return $stats;
    }

    private static function forgetStatsCache()
    {
        if (function_exists('cache')) {
            cache(self::STATS_CACHE_KEY, null);
        }
    }

    private static function taskStats()
    {
        $rows = self::toArray(Db::name(self::TASK_TABLE)
            ->field("task_type,status,COUNT(*) AS total,SUM(CASE WHEN status = 'PENDING' AND attempts > 0 THEN 1 ELSE 0 END) AS retrying")
            ->group('task_type,status')
            ->select());
        $stats = [];
        foreach ($rows as $row) {
            $type = (string) ($row['task_type'] ?? '');
            $status = (string) ($row['status'] ?? '');
            if ($type === '' || $status === '') {
                continue;
            }
            if (!isset($stats[$type])) {
                $stats[$type] = [];
            }
            $stats[$type][$status] = (int) ($row['total'] ?? 0);
            if ($status === 'PENDING') {
                $stats[$type]['RETRYING'] = (int) ($row['retrying'] ?? 0);
            }
        }

        return $stats;
    }

    private static function recentLogs(int $limit)
    {
        return self::toArray(Db::name(self::LOG_TABLE)
            ->order('log_id desc')
            ->limit(max(1, min(50, $limit)))
            ->select());
    }

    private static function videoQuery(string $status, string $q)
    {
        $metaTable = self::tableName(self::META_TABLE) . ' m';
        $hasVodDoubanId = self::columnExists(self::VOD_TABLE, 'vod_douban_id');
        $fields = 'v.vod_id,v.vod_name,v.type_id,v.vod_year,v.vod_area,v.vod_director,v.vod_actor,v.vod_time,' .
            'm.douban_id,m.douban_id_locked,m.douban_id_source,m.douban_id_confidence,m.douban_review_status,' .
            'm.douban_review_reason,m.douban_ignore_until,m.douban_last_sync_at,m.douban_next_sync_at,' .
            'm.douban_sync_fail_count,m.douban_last_fail_reason,m.intro_locked';
        if ($hasVodDoubanId) {
            $fields .= ',v.vod_douban_id';
        }
        $query = Db::name(self::VOD_TABLE)
            ->alias('v')
            ->join($metaTable, 'm.vod_id = v.vod_id', 'LEFT')
            ->field($fields);

        $q = trim($q);
        if ($q !== '') {
            if (ctype_digit($q)) {
                $query = $query->where('v.vod_id|v.vod_name', 'like', '%' . $q . '%');
            } else {
                $query = $query->whereLike('v.vod_name', '%' . $q . '%');
            }
        }

        if ($status === 'review') {
            return $query->where('m.douban_review_status', 'REVIEW');
        }
        if ($status === 'not_found') {
            return $query->where('m.douban_review_status', 'NOT_FOUND');
        }
        if ($status === 'locked') {
            return $query->where('m.douban_id_locked|m.intro_locked', 1);
        }
        if ($status === 'confirmed') {
            return $query->where('m.douban_review_status', 'CONFIRMED');
        }
        if ($status === 'duplicate') {
            $ids = self::duplicateDoubanIds();
            if (empty($ids)) {
                return $query->where('v.vod_id', 0);
            }
            return $query->whereIn('m.douban_id', $ids);
        }

        return $query;
    }

    private static function duplicateDoubanIds()
    {
        $rows = self::toArray(Db::name(self::META_TABLE)
            ->field('douban_id,COUNT(*) AS total')
            ->where('douban_id', '<>', '')
            ->group('douban_id')
            ->having('total>1')
            ->limit(500)
            ->select());

        return array_values(array_filter(array_map(function ($row) {
            return (string) ($row['douban_id'] ?? '');
        }, $rows)));
    }

    private static function duplicateCount()
    {
        $metaTable = self::quoteTable(self::tableName(self::META_TABLE));

        return self::scalar(
            "SELECT COALESCE(SUM(duplicates.total), 0) AS total FROM (" .
            "SELECT COUNT(*) AS total FROM {$metaTable} WHERE douban_id <> '' " .
            "GROUP BY douban_id HAVING COUNT(*) > 1" .
            ") duplicates",
            []
        );
    }

    private static function ensureMeta(int $vodId)
    {
        $row = Db::name(self::META_TABLE)->where('vod_id', $vodId)->find();
        if (!empty($row)) {
            return $row;
        }
        $now = time();
        Db::name(self::META_TABLE)->insert([
            'vod_id' => $vodId,
            'douban_review_status' => 'NOT_FOUND',
            'douban_next_sync_at' => $now,
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        return Db::name(self::META_TABLE)->where('vod_id', $vodId)->find();
    }

    private static function updateMeta(int $vodId, array $updates)
    {
        self::ensureMeta($vodId);
        $updates['updated_at'] = time();
        return Db::name(self::META_TABLE)->where('vod_id', $vodId)->update($updates);
    }

    private static function insertMissingMetaRows(array $rows, int $now)
    {
        $values = [];
        $bind = [];
        foreach ($rows as $row) {
            $vodId = (int) ($row['vod_id'] ?? 0);
            if ($vodId < 1 || (int) ($row['meta_vod_id'] ?? 0) > 0) {
                continue;
            }
            $values[] = '(?,?,?,?,?)';
            array_push($bind, $vodId, 'NOT_FOUND', $now, $now, $now);
        }
        if (empty($values)) {
            return;
        }
        $metaTable = self::quoteTable(self::tableName(self::META_TABLE));
        Db::execute(
            "INSERT IGNORE INTO {$metaTable} " .
            "(`vod_id`,`douban_review_status`,`douban_next_sync_at`,`created_at`,`updated_at`) VALUES " .
            implode(',', $values),
            $bind
        );
    }

    private static function activeTaskKeys(array $vodIds, array $statuses = ['PENDING', 'RUNNING', 'FAILED'])
    {
        if (empty($vodIds) || empty($statuses)) {
            return [];
        }
        $rows = self::toArray(Db::name(self::TASK_TABLE)
            ->field('vod_id,task_type')
            ->whereIn('vod_id', $vodIds)
            ->whereIn('status', $statuses)
            ->select());
        $keys = [];
        foreach ($rows as $row) {
            $vodId = (int) ($row['vod_id'] ?? 0);
            $taskType = (string) ($row['task_type'] ?? '');
            if ($vodId > 0 && $taskType !== '') {
                $keys[$vodId . ':' . $taskType] = true;
            }
        }

        return $keys;
    }

    private static function prepareTaskRows(array $rows, array $activeTaskKeys, int $now)
    {
        $taskRows = [];
        $matchVodIds = [];
        $matchCreated = 0;
        $syncCreated = 0;
        foreach ($rows as $row) {
            $vodId = (int) ($row['vod_id'] ?? 0);
            if ($vodId < 1) {
                continue;
            }
            $doubanId = self::resolveDoubanId([
                'douban_id' => $row['meta_douban_id'] ?? '',
                'vod_douban_id' => $row['vod_douban_id'] ?? '',
            ], $row);
            $taskType = $doubanId !== '' ? self::TASK_SYNC : self::TASK_MATCH;
            $taskKey = $vodId . ':' . $taskType;
            if (isset($activeTaskKeys[$taskKey])) {
                continue;
            }
            $taskRows[] = [
                'vod_id' => $vodId,
                'task_type' => $taskType,
                'status' => 'PENDING',
                'priority' => self::priorityForVod($row),
                'run_after' => $now,
                'attempts' => 0,
                'payload' => self::json([
                    'vod_name' => (string) ($row['vod_name'] ?? ''),
                    'douban_id' => $doubanId,
                ]),
                'created_at' => $now,
                'updated_at' => $now,
            ];
            $activeTaskKeys[$taskKey] = true;
            if ($taskType === self::TASK_MATCH) {
                $matchVodIds[$vodId] = $vodId;
                $matchCreated++;
            } else {
                $syncCreated++;
            }
        }

        return [
            'task_rows' => $taskRows,
            'match_vod_ids' => array_values($matchVodIds),
            'match_created' => $matchCreated,
            'sync_created' => $syncCreated,
        ];
    }

    private static function resolveFailedTasks(int $vodId, string $reason)
    {
        if ($vodId < 1) {
            return 0;
        }

        return (int) Db::name(self::TASK_TABLE)
            ->where('vod_id', $vodId)
            ->where('status', 'FAILED')
            ->update([
                'status' => 'SKIP',
                'last_error' => mb_substr($reason, 0, 255, 'UTF-8'),
                'updated_at' => time(),
            ]);
    }

    private static function insertTaskRows(array $rows)
    {
        if (empty($rows)) {
            return;
        }
        $values = [];
        $bind = [];
        foreach ($rows as $row) {
            $values[] = '(?,?,?,?,?,?,?,?,?)';
            array_push(
                $bind,
                (int) $row['vod_id'],
                (string) $row['task_type'],
                (string) $row['status'],
                (int) $row['priority'],
                (int) $row['run_after'],
                (int) $row['attempts'],
                (string) $row['payload'],
                (int) $row['created_at'],
                (int) $row['updated_at']
            );
        }
        $taskTable = self::quoteTable(self::tableName(self::TASK_TABLE));
        Db::execute(
            "INSERT INTO {$taskTable} " .
            "(`vod_id`,`task_type`,`status`,`priority`,`run_after`,`attempts`,`payload`,`created_at`,`updated_at`) VALUES " .
            implode(',', $values),
            $bind
        );
    }

    private static function fetchDoubanData(string $doubanId, array $config)
    {
        $endpoint = trim((string) ($config['douban_endpoint'] ?? ''));
        if ($endpoint === '') {
            throw new \RuntimeException('未配置豆瓣数据接口');
        }
        self::throttleRequests($config);
        if ($endpoint === 'internal' || $endpoint === '/extend/douban.php') {
            $data = DoubanGateway::subject($doubanId);
        } else {
            $data = self::requestEndpoint(self::buildEndpointUrl($endpoint, ['id' => $doubanId]));
        }

        return self::validateDoubanData($data, $doubanId);
    }

    private static function fetchDoubanCandidates(string $query, array $config)
    {
        $endpoint = trim((string) ($config['douban_endpoint'] ?? ''));
        if ($endpoint === '') {
            throw new \RuntimeException('未配置豆瓣数据接口');
        }
        self::throttleRequests($config);
        if ($endpoint === 'internal' || $endpoint === '/extend/douban.php') {
            return DoubanGateway::search($query, (int) ($config['candidate_topn'] ?? 5));
        }
        $data = self::requestEndpoint(self::buildEndpointUrl($endpoint, [
            'q' => $query,
            'limit' => (int) ($config['candidate_topn'] ?? 5),
        ]));

        return array_values(array_filter($data, 'is_array'));
    }

    private static function requestEndpoint(string $url)
    {
        $context = stream_context_create([
            'http' => [
                'method' => 'GET',
                'timeout' => 20,
                'ignore_errors' => true,
                'header' => "Accept: application/json\r\n",
            ],
        ]);
        $raw = @file_get_contents($url, false, $context);
        if ($raw === false || trim($raw) === '') {
            throw new \RuntimeException('豆瓣数据接口无响应');
        }
        $decoded = json_decode($raw, true);
        if (!is_array($decoded)) {
            throw new \RuntimeException('豆瓣数据接口返回内容不是 JSON');
        }
        if (isset($decoded['code']) && (int) $decoded['code'] !== 1 && empty($decoded['data'])) {
            throw new \RuntimeException((string) ($decoded['msg'] ?? '豆瓣数据接口返回失败'));
        }
        if (isset($decoded['data']) && is_array($decoded['data'])) {
            return $decoded['data'];
        }

        return $decoded;
    }

    private static function buildEndpointUrl(string $endpoint, array $query)
    {
        if (preg_match('/^https?:\/\//i', $endpoint)) {
            $url = $endpoint;
        } elseif (str_starts_with($endpoint, '/')) {
            $siteUrl = self::siteUrl();
            if ($siteUrl === '') {
                throw new \RuntimeException('相对豆瓣数据接口地址需要配置站点 URL');
            }
            $url = rtrim($siteUrl, '/') . $endpoint;
        } else {
            throw new \RuntimeException('豆瓣数据接口地址必须是完整 URL 或以 / 开头');
        }

        return $url . (strpos($url, '?') === false ? '?' : '&') . http_build_query($query);
    }

    private static function throttleRequests(array $config)
    {
        $requestsPerMinute = max(1, min(300, (int) ($config['request_per_minute'] ?? 30)));
        $interval = 60 / $requestsPerMinute;
        $reservedAt = self::reserveRequestSlot($interval);
        $delay = $reservedAt - microtime(true);
        if ($delay > 0) {
            usleep((int) ($delay * 1000000));
        }
    }

    private static function reserveRequestSlot(float $interval)
    {
        $now = microtime(true);
        $transactionStarted = false;
        try {
            self::ensureRateLimitState();
            Db::startTrans();
            $transactionStarted = true;
            $row = Db::name(self::CONFIG_TABLE)
                ->where('config_key', self::RATE_LIMIT_STATE_KEY)->lock(true)
                ->find();
            if (empty($row)) {
                throw new \RuntimeException('限流状态不存在');
            }
            $reservation = self::requestReservation($now, (float) ($row['config_value'] ?? 0), $interval);
            $updated = Db::name(self::CONFIG_TABLE)
                ->where('config_key', self::RATE_LIMIT_STATE_KEY)
                ->update([
                    'config_value' => sprintf('%.6F', $reservation['next_available_at']),
                    'updated_at' => time(),
                ]);
            if ((int) $updated !== 1) {
                throw new \RuntimeException('限流状态更新失败');
            }
            Db::commit();
            self::$nextLocalRequestAt = $reservation['next_available_at'];

            return $reservation['reserved_at'];
        } catch (\Throwable $e) {
            if ($transactionStarted) {
                try {
                    Db::rollback();
                } catch (\Throwable $ignored) {
                }
            }
            $reservation = self::requestReservation($now, self::$nextLocalRequestAt, $interval);
            self::$nextLocalRequestAt = $reservation['next_available_at'];

            return $reservation['reserved_at'];
        }
    }

    private static function ensureRateLimitState()
    {
        if (self::$rateLimitStateReady) {
            return;
        }
        $configTable = self::quoteTable(self::tableName(self::CONFIG_TABLE));
        Db::execute(
            "INSERT IGNORE INTO {$configTable} (`config_key`,`config_value`,`updated_at`) VALUES (?,?,?)",
            [self::RATE_LIMIT_STATE_KEY, '0', time()]
        );
        self::$rateLimitStateReady = true;
    }

    private static function requestReservation(float $now, float $nextAvailableAt, float $interval)
    {
        $interval = max(0.001, $interval);
        $reservedAt = max($now, $nextAvailableAt);

        return [
            'reserved_at' => $reservedAt,
            'next_available_at' => $reservedAt + $interval,
        ];
    }

    private static function validateDoubanData(array $data, string $expectedDoubanId)
    {
        $doubanId = self::normalizeDoubanId(self::extractValue($data, ['vod_douban_id', 'douban_id', 'id']));
        if ($doubanId === '') {
            throw new \RuntimeException('豆瓣数据源未返回有效ID');
        }
        if ($doubanId !== self::normalizeDoubanId($expectedDoubanId)) {
            throw new \RuntimeException('豆瓣数据源ID与请求不一致');
        }
        $score = self::extractValue($data, ['vod_douban_score', 'vod_score', 'score', 'rating']);
        if ($score === '' || !is_numeric($score)) {
            throw new \RuntimeException('豆瓣数据源未返回有效评分');
        }
        $score = self::normalizeDoubanScore($score);
        $data['vod_douban_id'] = $doubanId;
        $data['vod_douban_score'] = $score;
        $data['vod_score'] = $score;

        return $data;
    }

    private static function buildVodUpdates(array $vod, array $meta, array $data, string $doubanId)
    {
        $map = [
            'vod_name' => ['vod_name', 'title', 'name'],
            'vod_pic' => ['vod_pic', 'pic', 'cover', 'poster'],
            'vod_year' => ['vod_year', 'year'],
            'vod_area' => ['vod_area', 'area', 'country', 'region'],
            'vod_lang' => ['vod_lang', 'lang', 'language'],
            'vod_class' => ['vod_class', 'class', 'genre', 'genres'],
            'vod_director' => ['vod_director', 'director', 'directors'],
            'vod_actor' => ['vod_actor', 'actor', 'actors', 'cast'],
            'vod_content' => ['vod_content', 'content', 'summary', 'intro', 'description'],
            'vod_douban_score' => ['vod_douban_score', 'vod_score', 'score', 'rating'],
            'vod_score' => ['vod_douban_score', 'vod_score', 'score', 'rating'],
            'vod_total' => ['vod_total', 'total', 'episodes'],
            'vod_remarks' => ['vod_remarks', 'remarks', 'status_text'],
        ];
        $updates = [];
        foreach ($map as $field => $aliases) {
            if (!self::columnExists(self::VOD_TABLE, $field)) {
                continue;
            }
            if ($field === 'vod_content' && (int) ($meta['intro_locked'] ?? 0) === 1) {
                continue;
            }
            $value = self::extractValue($data, $aliases);
            if ($value === '') {
                continue;
            }
            if ($field === 'vod_douban_score' || $field === 'vod_score') {
                $value = self::normalizeDoubanScore($value);
            }
            if ((string) ($vod[$field] ?? '') !== $value) {
                $updates[$field] = $value;
            }
        }

        if (self::columnExists(self::VOD_TABLE, 'vod_douban_id') && (int) ($meta['douban_id_locked'] ?? 0) !== 1) {
            if ((string) ($vod['vod_douban_id'] ?? '') !== $doubanId) {
                $updates['vod_douban_id'] = $doubanId;
            }
        }

        return $updates;
    }

    private static function normalizeDoubanScore(string $value)
    {
        if (!is_numeric($value) || (float) $value < 0 || (float) $value > 10) {
            throw new \RuntimeException('豆瓣评分必须在 0 到 10 之间');
        }

        return number_format((float) $value, 1, '.', '');
    }

    private static function extractValue(array $data, array $keys)
    {
        foreach ($keys as $key) {
            if (!array_key_exists($key, $data)) {
                continue;
            }
            $value = $data[$key];
            if (is_array($value)) {
                $value = implode('/', array_filter(array_map('strval', $value)));
            }
            $value = trim(strip_tags((string) $value));
            if ($value !== '') {
                return $value;
            }
        }

        return '';
    }

    private static function markSyncFailure(int $vodId, string $message, int $attempts, bool $terminal = false)
    {
        if ($vodId < 1) {
            return;
        }
        $updates = [
            'douban_sync_fail_count' => $attempts,
            'douban_last_fail_at' => time(),
            'douban_last_fail_reason' => $message,
            'douban_next_sync_at' => $terminal ? self::MANUAL_RETRY_AT : time() + self::failureDelay($attempts),
        ];
        if ($terminal) {
            $updates['douban_review_status'] = 'REVIEW';
            $updates['douban_review_reason'] = '同步连续失败，等待后台重试';
        }
        self::updateMeta($vodId, $updates);
    }

    private static function taskFailureUpdate(int $attempts, int $maxAttempts, int $failedAt)
    {
        if ($attempts >= max(1, $maxAttempts)) {
            return ['status' => 'FAILED', 'run_after' => 0];
        }

        return [
            'status' => 'PENDING',
            'run_after' => $failedAt + self::failureDelay($attempts),
        ];
    }

    private static function failureDelay(int $attempts)
    {
        if ($attempts <= 1) {
            return 10 * 60;
        }
        if ($attempts === 2) {
            return 30 * 60;
        }
        if ($attempts === 3) {
            return 2 * 3600;
        }
        if ($attempts === 4) {
            return 6 * 3600;
        }

        return 24 * 3600;
    }

    private static function nextSyncAt(array $vod)
    {
        $now = time();
        $updateTime = (int) ($vod['vod_time'] ?? 0);
        $age = $updateTime > 0 ? max(0, $now - $updateTime) : 9999 * 86400;
        if ($age <= 30 * 86400) {
            $days = 3;
        } elseif ($age <= 183 * 86400) {
            $days = 7;
        } elseif ($age <= 365 * 86400) {
            $days = 30;
        } elseif ($age <= 730 * 86400) {
            $days = 60;
        } else {
            $days = 90;
        }

        return $now + $days * 86400 + random_int(0, 120);
    }

    private static function priorityForVod(array $vod)
    {
        $year = (int) ($vod['vod_year'] ?? 0);
        $currentYear = (int) date('Y');
        if ($year >= $currentYear) {
            return 30;
        }
        if ($year >= $currentYear - 1) {
            return 20;
        }

        return 10;
    }

    private static function recordLog(int $vodId, string $action, array $oldValues, array $newValues, string $reason, int $score = 0, int $operatorId = 0)
    {
        Db::name(self::LOG_TABLE)->insert([
            'vod_id' => $vodId,
            'action' => $action,
            'old_values' => self::json($oldValues),
            'new_values' => self::json($newValues),
            'reason' => mb_substr($reason, 0, 255, 'UTF-8'),
            'score' => max(0, min(100, $score)),
            'operator' => $operatorId > 0 ? ('admin:' . $operatorId) : 'system',
            'created_at' => time(),
        ]);
    }

    private static function resolveDoubanId(array $meta, array $vod)
    {
        $metaId = self::normalizeDoubanId((string) ($meta['douban_id'] ?? ''));
        if ($metaId !== '') {
            return $metaId;
        }
        $vodId = self::normalizeDoubanId((string) ($vod['vod_douban_id'] ?? ''));
        if ($vodId !== '') {
            return $vodId;
        }

        return '';
    }

    private static function normalizeDoubanId(string $value)
    {
        $id = preg_replace('/\D+/', '', $value);
        return $id !== '' && ltrim($id, '0') !== '' ? $id : '';
    }

    private static function normalizeConfig(array $input)
    {
        $defaults = self::configDefaults();
        $config = [];
        $config['douban_endpoint'] = trim((string) ($input['douban_endpoint'] ?? $defaults['douban_endpoint']));
        $config['exclude_type_ids'] = implode(',', self::parseIds((string) ($input['exclude_type_ids'] ?? '')));
        $config['batch_size'] = max(1, min(500, (int) ($input['batch_size'] ?? $defaults['batch_size'])));
        $config['worker_limit'] = max(1, min(100, (int) ($input['worker_limit'] ?? $defaults['worker_limit'])));
        $config['request_per_minute'] = max(1, min(300, (int) ($input['request_per_minute'] ?? $defaults['request_per_minute'])));
        $config['max_attempts'] = max(1, min(10, (int) ($input['max_attempts'] ?? $defaults['max_attempts'])));
        $config['auto_confirm_score'] = max(0, min(100, (int) ($input['auto_confirm_score'] ?? $defaults['auto_confirm_score'])));
        $config['candidate_topn'] = max(1, min(10, (int) ($input['candidate_topn'] ?? $defaults['candidate_topn'])));

        return $config;
    }

    private static function parseIds(string $value)
    {
        $ids = [];
        foreach (explode(',', $value) as $item) {
            $id = (int) trim($item);
            if ($id > 0) {
                $ids[$id] = $id;
            }
        }

        return array_values($ids);
    }

    private static function scalar(string $sql, array $bind)
    {
        $rows = self::toArray(Db::query($sql, $bind));
        if (empty($rows)) {
            return 0;
        }
        $row = reset($rows);

        return (int) ($row['total'] ?? 0);
    }

    private static function columnExists(string $table, string $column)
    {
        static $cache = [];
        $key = $table . '.' . $column;
        if (isset($cache[$key])) {
            return $cache[$key];
        }
        try {
            $rows = Db::query(
                'SELECT COLUMN_NAME FROM information_schema.COLUMNS ' .
                'WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1',
                [self::tableName($table), $column]
            );
            $cache[$key] = !empty($rows);
        } catch (\Throwable $e) {
            $cache[$key] = false;
        }

        return $cache[$key];
    }

    private static function tableName(string $table)
    {
        try {
            $query = Db::name($table);
            if (is_object($query) && method_exists($query, 'getTable')) {
                return $query->getTable();
            }
        } catch (\Throwable $e) {
        }

        $prefix = '';
        try {
            $database = config('database');
            if (is_array($database) && isset($database['prefix'])) {
                $prefix = (string) $database['prefix'];
            } else {
                $prefix = (string) config('database.prefix');
            }
        } catch (\Throwable $e) {
            $prefix = '';
        }

        return $prefix . $table;
    }

    private static function quoteTable(string $table)
    {
        return '`' . str_replace('`', '``', $table) . '`';
    }

    private static function siteUrl()
    {
        try {
            $maccms = config('maccms');
            if (is_array($maccms) && !empty($maccms['site']['site_url'])) {
                return rtrim((string) $maccms['site']['site_url'], '/');
            }
            if (is_array($maccms) && !empty($maccms['site_url'])) {
                return rtrim((string) $maccms['site_url'], '/');
            }
            $siteUrl = (string) config('maccms.site_url');
            return rtrim($siteUrl, '/');
        } catch (\Throwable $e) {
            return '';
        }
    }

    private static function formatTime(int $time)
    {
        if ($time >= self::MANUAL_RETRY_AT) {
            return '等待手动重试';
        }

        return $time > 0 ? date('Y-m-d H:i', $time) : '-';
    }

    private static function json($value)
    {
        return json_encode($value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    }

    private static function toArray($rows)
    {
        if (is_object($rows) && method_exists($rows, 'toArray')) {
            return $rows->toArray();
        }
        if (is_array($rows)) {
            return $rows;
        }

        return [];
    }
}
