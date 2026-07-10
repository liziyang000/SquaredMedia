<?php

namespace addons\douban\service;

use think\Db;

class DoubanData
{
    private const VOD_TABLE = 'vod';
    private const CONFIG_TABLE = 'douban_config';
    private const META_TABLE = 'douban_vod_meta';
    private const TASK_TABLE = 'douban_task';
    private const LOG_TABLE = 'douban_log';
    private const CANDIDATE_TABLE = 'douban_review_candidate';

    private const TASK_SYNC = 'SYNC_DOUBAN';
    private const TASK_MATCH = 'MATCH_DOUBAN_ID';
    private const ACTION_AUTO_SYNC = 'AUTO_SYNC';

    public static function configDefaults()
    {
        return [
            'douban_endpoint' => '/extend/douban.php',
            'exclude_type_ids' => '',
            'batch_size' => 100,
            'worker_limit' => 20,
            'request_per_minute' => 30,
            'auto_confirm_score' => 85,
            'review_score' => 70,
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

        foreach ($rows as &$row) {
            $row['display_douban_id'] = self::resolveDoubanId($row, $row);
            $row['douban_review_status'] = (string) ($row['douban_review_status'] ?? '');
            $row['douban_next_sync_label'] = self::formatTime((int) ($row['douban_next_sync_at'] ?? 0));
            $row['douban_last_sync_label'] = self::formatTime((int) ($row['douban_last_sync_at'] ?? 0));
        }
        unset($row);

        return [
            'data' => $rows,
            'page' => $page,
            'limit' => $limit,
            'total' => $total,
        ];
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
            "m.douban_id AS meta_douban_id, m.douban_ignore_until, m.douban_next_sync_at " .
            "FROM {$vodTable} v LEFT JOIN {$metaTable} m ON m.vod_id = v.vod_id " .
            "WHERE IFNULL(v.vod_status, 1) = 1 " .
            "AND (m.vod_id IS NULL OR IFNULL(m.douban_next_sync_at, 0) <= ?) " .
            "AND (IFNULL(m.douban_ignore_until, 0) = 0 OR m.douban_ignore_until <= ?) " .
            $excludeSql .
            " ORDER BY IFNULL(m.douban_next_sync_at, 0) ASC, v.vod_id ASC LIMIT " . $limit;

        $rows = self::toArray(Db::query($sql, $bind));
        $created = 0;
        foreach ($rows as $row) {
            $vodId = (int) ($row['vod_id'] ?? 0);
            if ($vodId < 1) {
                continue;
            }
            self::ensureMeta($vodId);
            $doubanId = self::resolveDoubanId([
                'douban_id' => $row['meta_douban_id'] ?? '',
                'vod_douban_id' => $row['vod_douban_id'] ?? '',
            ], $row);
            $taskType = $doubanId !== '' ? self::TASK_SYNC : self::TASK_MATCH;
            if (self::taskExists($vodId, $taskType)) {
                continue;
            }
            Db::name(self::TASK_TABLE)->insert([
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
            ]);
            if ($doubanId === '') {
                self::updateMeta($vodId, [
                    'douban_review_status' => 'NOT_FOUND',
                    'douban_review_reason' => '等待匹配豆瓣ID',
                ]);
            }
            $created++;
        }

        if ($created > 0) {
            self::recordLog(0, 'ENQUEUE_DUE', [], ['created' => $created, 'limit' => $limit], '批量生成到期任务', 0, $operatorId);
        }

        return ['created' => $created, 'scanned' => count($rows)];
    }

    public static function runPending(int $limit = 20, int $operatorId = 0)
    {
        $limit = max(1, min(100, $limit));
        $now = time();
        $tasks = self::toArray(Db::name(self::TASK_TABLE)
            ->where('status', 'PENDING')
            ->where('run_after', '<=', $now)
            ->order('priority desc, task_id asc')
            ->limit($limit)
            ->select());
        $result = ['success' => 0, 'failed' => 0, 'skipped' => 0, 'items' => []];

        foreach ($tasks as $task) {
            $taskId = (int) ($task['task_id'] ?? 0);
            $attempts = (int) ($task['attempts'] ?? 0) + 1;
            Db::name(self::TASK_TABLE)->where('task_id', $taskId)->update([
                'status' => 'RUNNING',
                'attempts' => $attempts,
                'updated_at' => $now,
            ]);

            try {
                $itemResult = self::runTask($task, $operatorId);
                $status = !empty($itemResult['skipped']) ? 'SKIP' : 'SUCCESS';
                Db::name(self::TASK_TABLE)->where('task_id', $taskId)->update([
                    'status' => $status,
                    'payload' => self::json($itemResult),
                    'last_error' => '',
                    'updated_at' => time(),
                ]);
                if ($status === 'SKIP') {
                    $result['skipped']++;
                } else {
                    $result['success']++;
                }
                $result['items'][] = $itemResult;
            } catch (\Throwable $e) {
                $message = mb_substr($e->getMessage(), 0, 255, 'UTF-8');
                $delay = self::failureDelay($attempts);
                Db::name(self::TASK_TABLE)->where('task_id', $taskId)->update([
                    'status' => 'PENDING',
                    'run_after' => time() + $delay,
                    'last_error' => $message,
                    'updated_at' => time(),
                ]);
                self::markSyncFailure((int) ($task['vod_id'] ?? 0), $message, $attempts);
                $result['failed']++;
                $result['items'][] = [
                    'task_id' => $taskId,
                    'vod_id' => (int) ($task['vod_id'] ?? 0),
                    'code' => 1002,
                    'msg' => $message,
                ];
            }
        }

        return $result;
    }

    public static function syncVod(int $vodId, int $operatorId = 0)
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

        $data = self::fetchDoubanData($doubanId, self::config());
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
        self::recordLog($vodId, self::ACTION_AUTO_SYNC, $oldValues, $updates, '调用 douban.php 同步资料', 0, $operatorId);

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
        $doubanId = preg_replace('/\D+/', '', $doubanId);
        if ($vodId < 1 || $doubanId === '') {
            throw new \InvalidArgumentException('参数错误');
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

        return ['vod_id' => $vodId, 'ignore_until' => $until];
    }

    public static function calibrateScores(int $operatorId = 0)
    {
        if (!self::columnExists(self::VOD_TABLE, 'vod_douban_score') || !self::columnExists(self::VOD_TABLE, 'vod_score')) {
            throw new \RuntimeException('视频表缺少豆瓣评分字段');
        }
        $vodTable = self::quoteTable(self::tableName(self::VOD_TABLE));
        $mirrored = Db::execute(
            "UPDATE {$vodTable} SET vod_score = vod_douban_score " .
            "WHERE vod_douban_score > 0 AND IFNULL(vod_score, 0) <> vod_douban_score"
        );
        $reset = Db::execute(
            "UPDATE {$vodTable} SET vod_score = 0 " .
            "WHERE IFNULL(vod_douban_score, 0) = 0 AND IFNULL(vod_score, 0) <> 0"
        );
        $result = ['mirrored' => (int) $mirrored, 'reset' => (int) $reset];
        self::recordLog(0, 'CALIBRATE_SCORE', [], $result, '统一使用豆瓣评分排序', 0, $operatorId);

        return $result;
    }

    private static function runTask(array $task, int $operatorId)
    {
        $taskType = (string) ($task['task_type'] ?? '');
        $vodId = (int) ($task['vod_id'] ?? 0);
        if ($taskType === self::TASK_SYNC) {
            return self::syncVod($vodId, $operatorId);
        }
        if ($taskType === self::TASK_MATCH) {
            return self::matchVod($vodId, $operatorId);
        }

        return ['vod_id' => $vodId, 'skipped' => true, 'msg' => '未知任务类型'];
    }

    private static function matchVod(int $vodId, int $operatorId)
    {
        $vod = Db::name(self::VOD_TABLE)->where('vod_id', $vodId)->find();
        if (empty($vod)) {
            throw new \RuntimeException('影片不存在');
        }
        $meta = self::ensureMeta($vodId);
        if ((int) ($meta['douban_id_locked'] ?? 0) === 1) {
            return ['vod_id' => $vodId, 'skipped' => true, 'msg' => '豆瓣ID已锁定'];
        }

        $config = self::config();
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
            $synced = self::syncVod($vodId, $operatorId);
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
            Db::name(self::CANDIDATE_TABLE)->insert([
                'vod_id' => $vodId,
                'douban_id' => (string) ($candidate['douban_id'] ?? ''),
                'score_total' => (int) ($candidate['score_total'] ?? 0),
                'score_detail' => self::json($candidate['score_detail'] ?? []),
                'conflicts' => self::json($candidate['conflicts'] ?? []),
                'rank' => $rank + 1,
                'created_at' => $now,
            ]);
        }
    }

    private static function stats()
    {
        $metaTable = self::quoteTable(self::tableName(self::META_TABLE));
        $vodTable = self::quoteTable(self::tableName(self::VOD_TABLE));
        $hasVodDoubanId = self::columnExists(self::VOD_TABLE, 'vod_douban_id');
        $idExpr = $hasVodDoubanId ? "COALESCE(NULLIF(m.douban_id, ''), NULLIF(v.vod_douban_id, ''))" : "NULLIF(m.douban_id, '')";

        return [
            'total_videos' => self::scalar("SELECT COUNT(*) AS total FROM {$vodTable}", []),
            'no_douban_id' => self::scalar("SELECT COUNT(*) AS total FROM {$vodTable} v LEFT JOIN {$metaTable} m ON m.vod_id = v.vod_id WHERE {$idExpr} IS NULL", []),
            'duplicate_douban_id' => self::duplicateCount(),
            'review' => self::countMetaStatus('REVIEW'),
            'not_found' => self::countMetaStatus('NOT_FOUND'),
            'confirmed' => self::countMetaStatus('CONFIRMED'),
            'ignored' => self::countMetaStatus('IGNORED'),
            'locked_id' => self::scalar("SELECT COUNT(*) AS total FROM {$metaTable} WHERE douban_id_locked = 1", []),
            'locked_intro' => self::scalar("SELECT COUNT(*) AS total FROM {$metaTable} WHERE intro_locked = 1", []),
        ];
    }

    private static function taskStats()
    {
        $rows = self::toArray(Db::name(self::TASK_TABLE)
            ->field('task_type,status,COUNT(*) AS total')
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
        $fields = 'v.vod_id,v.vod_name,v.type_id,v.vod_year,v.vod_area,v.vod_director,v.vod_actor,v.update_time,' .
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
        $ids = self::duplicateDoubanIds();
        if (empty($ids)) {
            return 0;
        }

        return (int) Db::name(self::META_TABLE)->whereIn('douban_id', $ids)->count();
    }

    private static function countMetaStatus(string $status)
    {
        return (int) Db::name(self::META_TABLE)->where('douban_review_status', $status)->count();
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

    private static function taskExists(int $vodId, string $taskType)
    {
        return !empty(Db::name(self::TASK_TABLE)
            ->where('vod_id', $vodId)
            ->where('task_type', $taskType)
            ->whereIn('status', ['PENDING', 'RUNNING'])
            ->find());
    }

    private static function fetchDoubanData(string $doubanId, array $config)
    {
        $endpoint = trim((string) ($config['douban_endpoint'] ?? ''));
        if ($endpoint === '') {
            throw new \RuntimeException('未配置 douban.php 接口地址');
        }
        if ($endpoint === '/extend/douban.php') {
            return DoubanGateway::subject($doubanId);
        }
        return self::requestEndpoint(self::buildEndpointUrl($endpoint, ['id' => $doubanId]));
    }

    private static function fetchDoubanCandidates(string $query, array $config)
    {
        $endpoint = trim((string) ($config['douban_endpoint'] ?? ''));
        if ($endpoint === '') {
            throw new \RuntimeException('未配置 douban.php 接口地址');
        }
        if ($endpoint === '/extend/douban.php') {
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
            'ssl' => [
                'verify_peer' => false,
                'verify_peer_name' => false,
            ],
        ]);
        $raw = @file_get_contents($url, false, $context);
        if ($raw === false || trim($raw) === '') {
            throw new \RuntimeException('douban.php 无响应');
        }
        $decoded = json_decode($raw, true);
        if (!is_array($decoded)) {
            throw new \RuntimeException('douban.php 返回内容不是 JSON');
        }
        if (isset($decoded['code']) && (int) $decoded['code'] !== 1 && empty($decoded['data'])) {
            throw new \RuntimeException((string) ($decoded['msg'] ?? 'douban.php 返回失败'));
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
                throw new \RuntimeException('相对 douban.php 地址需要配置站点 URL');
            }
            $url = rtrim($siteUrl, '/') . $endpoint;
        } else {
            throw new \RuntimeException('douban.php 接口地址必须是完整 URL 或以 / 开头');
        }

        return $url . (strpos($url, '?') === false ? '?' : '&') . http_build_query($query);
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
            'vod_score_all' => ['vod_score_all', 'score_all'],
            'vod_score_num' => ['vod_score_num', 'score_num', 'rating_count', 'comments_count'],
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

    private static function markSyncFailure(int $vodId, string $message, int $attempts)
    {
        if ($vodId < 1) {
            return;
        }
        self::updateMeta($vodId, [
            'douban_sync_fail_count' => $attempts,
            'douban_last_fail_at' => time(),
            'douban_last_fail_reason' => $message,
            'douban_next_sync_at' => time() + self::failureDelay($attempts),
        ]);
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
        $updateTime = (int) ($vod['update_time'] ?? 0);
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
        $metaId = trim((string) ($meta['douban_id'] ?? ''));
        if ($metaId !== '') {
            return preg_replace('/\D+/', '', $metaId);
        }
        $vodId = trim((string) ($vod['vod_douban_id'] ?? ''));
        if ($vodId !== '') {
            return preg_replace('/\D+/', '', $vodId);
        }

        return '';
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
        $config['auto_confirm_score'] = max(0, min(100, (int) ($input['auto_confirm_score'] ?? $defaults['auto_confirm_score'])));
        $config['review_score'] = max(0, min(100, (int) ($input['review_score'] ?? $defaults['review_score'])));
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
