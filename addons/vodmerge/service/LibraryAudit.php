<?php

namespace addons\vodmerge\service;

class LibraryAudit
{
    private $db;
    private $prefix;
    private $reviewer;
    private $discovered;
    private const WEEK = 604800;
    private const FIELDS = 'vod_id,vod_name,vod_sub,vod_en,vod_year,vod_area,vod_lang,vod_actor,vod_director,vod_class,vod_version,vod_douban_id,type_id';
    private const SEASON_PATTERN = '/(?:第\s*[0-9０-９一二三四五六七八九十两零〇]+\s*季|(?<![a-z0-9０-９])(?:season\s*|s\s*)[0-9０-９]{1,3}(?![a-z0-9０-９]))/iu';

    public function __construct(\PDO $db, string $prefix, ?callable $reviewer = null, ?callable $discovered = null)
    {
        if (!preg_match('/^[a-zA-Z0-9_]{0,40}$/D', $prefix)) {
            throw new \RuntimeException('数据库表前缀无效。');
        }
        $this->db = $db;
        $this->prefix = $prefix;
        $this->reviewer = $reviewer ?? [Jev::class, 'review'];
        $this->discovered = $discovered;
        $this->db->setAttribute(\PDO::ATTR_ERRMODE, \PDO::ERRMODE_EXCEPTION);
    }

    private function table(string $name): string
    {
        return '`' . $this->prefix . $name . '`';
    }

    private function query(string $sql, array $values = []): \PDOStatement
    {
        $statement = $this->db->prepare($sql);
        $statement->execute($values);
        return $statement;
    }

    private function transaction(callable $action)
    {
        $this->db->beginTransaction();
        try {
            $suffix = $this->db->getAttribute(\PDO::ATTR_DRIVER_NAME) === 'mysql' ? ' FOR UPDATE' : '';
            $state = $this->query('SELECT * FROM ' . $this->table('vodmerge_audit_state') . ' WHERE state_id=1' . $suffix)->fetch(\PDO::FETCH_ASSOC);
            if (!$state) {
                throw new \RuntimeException('请先安装影片排查数据表。');
            }
            $result = $action($state);
            $this->db->commit();
            return $result;
        } catch (\Throwable $error) {
            if ($this->db->inTransaction()) {
                $this->db->rollBack();
            }
            throw $error;
        }
    }

    private function update(string $name, string $idField, int $id, array $values): void
    {
        $set = implode(',', array_map(static function ($key) { return '`' . $key . '`=?'; }, array_keys($values)));
        $this->query('UPDATE ' . $this->table($name) . ' SET ' . $set . ' WHERE ' . $idField . '=?', array_merge(array_values($values), [$id]));
    }

    private function run(int $id): array
    {
        $run = $this->query('SELECT * FROM ' . $this->table('vodmerge_audit_run') . ' WHERE run_id=?', [$id])->fetch(\PDO::FETCH_ASSOC);
        if (!$run) {
            throw new \RuntimeException('影片排查记录不存在。');
        }
        return $run;
    }

    private function createRun(string $mode, array $state): array
    {
        $lower = $mode === 'full' ? 0 : (int) $state['watermark'];
        $upper = max($lower, (int) $this->query('SELECT MAX(vod_id) FROM ' . $this->table('vod'))->fetchColumn());
        $count = (int) $this->query('SELECT COUNT(*) FROM ' . $this->table('vod') . ' WHERE vod_id>? AND vod_id<=?', [$lower, $upper])->fetchColumn();
        $now = time();
        $this->query('INSERT INTO ' . $this->table('vodmerge_audit_run')
            . ' (status,mode,lower_id,upper_id,cursor_id,total_count,started_at,updated_at) VALUES (?,?,?,?,?,?,?,?)',
            ['running', $mode, $lower, $upper, $lower, $count, $now, $now]);
        $id = (int) $this->db->lastInsertId();
        $this->update('vodmerge_audit_state', 'state_id', 1, ['active_run_id' => $id]);
        return $this->run($id);
    }

    public function start(bool $weekly = true): array
    {
        $this->transaction(function ($state) use ($weekly) {
            $this->update('vodmerge_audit_state', 'state_id', 1, ['weekly_enabled' => $weekly ? 1 : 0, 'next_run_at' => 0]);
            if ((int) $state['active_run_id'] === 0) {
                $this->createRun('full', $state);
            }
        });
        return $this->summary();
    }

    public function schedule(bool $enabled): array
    {
        $this->transaction(function ($state) use ($enabled) {
            $next = $enabled && (int) $state['last_completed_at'] > 0 ? (int) $state['last_completed_at'] + self::WEEK : 0;
            $this->update('vodmerge_audit_state', 'state_id', 1, ['weekly_enabled' => $enabled ? 1 : 0, 'next_run_at' => $next]);
        });
        return $this->summary();
    }

    private function metadata(array $video): array
    {
        $metadata = Payload::metadata($video);
        unset($metadata['vod_content']);
        return ['vod_id' => (int) $video['vod_id']] + $metadata;
    }

    private function keys(array $video): array
    {
        $keys = [];
        if ((int) ($video['vod_douban_id'] ?? 0) > 0) {
            $value = (string) (int) $video['vod_douban_id'];
            $keys[hash('sha256', 'douban:' . $value)] = ['kind' => 'douban', 'value' => $value];
        }
        $fullKeys = [];
        foreach (AuditMatch::searchTitles($video, false) as $title) {
            $fullKeys[] = AuditMatch::titleKey($title);
        }
        foreach (AuditMatch::searchTitles($video) as $title) {
            $title = mb_convert_kana($title, 'n', 'UTF-8');
            if (Payload::key(preg_replace(self::SEASON_PATTERN, '', $title)) === '') {
                continue;
            }
            $key = AuditMatch::titleKey($title);
            if ($key !== '') {
                $keys[hash('sha256', 'title:' . $key)] = ['kind' => in_array($key, $fullKeys, true) ? 'title' : 'stem', 'value' => $title];
            }
        }
        return $keys;
    }

    private function auditVideo(array $video, int $runId, int $now): array
    {
        $id = (int) $video['vod_id'];
        $keys = $this->keys($video);
        $this->query('DELETE FROM ' . $this->table('vodmerge_audit_key') . ' WHERE vod_id=?', [$id]);
        $candidates = [];
        foreach ($keys as $hash => $key) {
            $priority = $key['kind'] === 'douban' ? 0 : ($key['kind'] === 'title' ? 1 : 2);
            $ids = $this->query('SELECT vod_id FROM ' . $this->table('vodmerge_audit_key')
                . ' WHERE key_hash=? AND vod_id<? ORDER BY vod_id ASC LIMIT 51', [$hash, $id])->fetchAll(\PDO::FETCH_COLUMN);
            foreach ($ids as $candidateId) {
                $candidateId = (int) $candidateId;
                $candidates[$candidateId] = min($priority, $candidates[$candidateId] ?? $priority);
            }
        }
        uksort($candidates, static function ($left, $right) use ($candidates) {
            return [$candidates[$left], (int) $left] <=> [$candidates[$right], (int) $right];
        });
        $candidates = array_slice($candidates, 0, 51, true);
        $truncated = count($candidates) > 50 ? 1 : 0;
        $count = 0;
        $candidateIds = array_slice(array_keys($candidates), 0, 50);
        $rows = [];
        if ($candidateIds) {
            $placeholders = implode(',', array_fill(0, count($candidateIds), '?'));
            $rows = $this->query('SELECT ' . self::FIELDS . ' FROM ' . $this->table('vod') . ' WHERE vod_id IN (' . $placeholders . ') ORDER BY vod_id ASC', $candidateIds)->fetchAll(\PDO::FETCH_ASSOC);
        }
        foreach ($rows as $candidate) {
            $candidateId = (int) $candidate['vod_id'];
            $candidateKeys = $this->keys($candidate);
            $matched = array_intersect_key($keys, $candidateKeys);
            if (!$matched) {
                continue;
            }
            $labels = [];
            foreach ($matched as $hash => $key) {
                $label = $key['kind'] === 'douban' ? '豆瓣编号相同'
                    : ($key['kind'] === 'stem' || $candidateKeys[$hash]['kind'] === 'stem' ? '季数主干相同' : '完整标题相同（含别名与英文名）');
                $labels[] = $label . '：' . $key['value'];
            }
            $conflicts = Payload::conflicts($video, $candidate);
            $detail = ['left' => $this->metadata($candidate), 'right' => $this->metadata($video),
                'conflicts' => $conflicts, 'matched_keys' => $labels];
            $assessment = $this->assessment($detail);
            $detail['rule_assessment'] = $assessment;
            $this->query('INSERT INTO ' . $this->table('vodmerge_audit_issue')
                . ' (run_id,left_id,right_id,kind,assessment,priority,assessment_version,detail_json,created_at) VALUES (?,?,?,?,?,?,?,?,?)',
                [$runId, (int) $candidateId, $id, $conflicts ? 'conflict' : 'possible_duplicate',
                    $assessment['level'], $assessment['priority'], AuditMatch::VERSION, Payload::json($detail), $now]);
            if ($this->discovered) {
                ($this->discovered)((int) $this->db->lastInsertId(), (int) $candidateId, $id, $assessment['level'], $assessment['priority'], $now, Workbench::searchText($detail['left'], $detail['right']));
            }
            $count++;
        }
        foreach ($keys as $hash => $label) {
            $this->query('INSERT INTO ' . $this->table('vodmerge_audit_key') . ' (key_hash,vod_id) VALUES (?,?)', [$hash, $id]);
        }
        return [$count, $truncated];
    }

    private function snapshot(array $video): array
    {
        return $this->metadata(['vod_id' => (int) ($video['vod_id'] ?? 0)] + $video);
    }

    private function assessment(array $detail): array
    {
        $valid = is_array($detail['left'] ?? null) && is_array($detail['right'] ?? null);
        $assessment = $valid ? AuditMatch::assess($detail['left'], $detail['right'])
            : ['level' => 'unrated', 'label' => '扫描证据不完整，待人工核对', 'priority' => 0,
                'evidence' => [], 'missing' => ['历史记录缺少左右影片的扫描资料'], 'risks' => [], 'conflicts' => []];
        $assessment['version'] = AuditMatch::VERSION;
        $assessment['source'] = 'scan_snapshot';
        $assessment['snapshot_hash'] = $valid ? hash('sha256', Payload::json([
            $this->snapshot($detail['left']), $this->snapshot($detail['right']),
        ])) : '';
        return $assessment;
    }

    public function assessBatch(int $batchSize = 200): array
    {
        $batchSize = max(1, min(500, $batchSize));
        $this->db->beginTransaction();
        try {
            $rows = $this->query('SELECT issue_id,detail_json FROM ' . $this->table('vodmerge_audit_issue')
                . ' WHERE assessment_version<? ORDER BY assessment_version ASC,issue_id ASC LIMIT ' . $batchSize, [AuditMatch::VERSION])->fetchAll(\PDO::FETCH_ASSOC);
            $processed = 0;
            $condition = $this->db->getAttribute(\PDO::ATTR_DRIVER_NAME) === 'mysql' ? 'BINARY detail_json=?' : 'detail_json=?';
            $update = $this->db->prepare('UPDATE ' . $this->table('vodmerge_audit_issue')
                . ' SET assessment=?,priority=?,assessment_version=?,detail_json=? WHERE issue_id=? AND assessment_version<? AND ' . $condition);
            foreach ($rows as $row) {
                $detail = json_decode($row['detail_json'], true);
                $detail = is_array($detail) ? $detail : [];
                unset($detail['rule_stale'], $detail['current_missing']);
                $assessment = $this->assessment($detail);
                $detail['rule_assessment'] = $assessment;
                $update->execute([$assessment['level'], $assessment['priority'], AuditMatch::VERSION, Payload::json($detail),
                    (int) $row['issue_id'], AuditMatch::VERSION, $row['detail_json']]);
                $processed += $update->rowCount();
            }
            $remaining = (int) $this->query('SELECT COUNT(*) FROM ' . $this->table('vodmerge_audit_issue')
                . ' WHERE assessment_version<?', [AuditMatch::VERSION])->fetchColumn();
            $this->db->commit();
            return ['processed' => $processed, 'remaining' => $remaining, 'skipped' => count($rows) - $processed];
        } catch (\Throwable $error) {
            if ($this->db->inTransaction()) {
                $this->db->rollBack();
            }
            throw $error;
        }
    }

    private function complete(array $run, array $state, int $now): void
    {
        $this->update('vodmerge_audit_run', 'run_id', (int) $run['run_id'], [
            'status' => 'completed', 'cursor_id' => (int) $run['upper_id'], 'finished_at' => $now, 'updated_at' => $now, 'error_message' => '',
        ]);
        $this->update('vodmerge_audit_state', 'state_id', 1, [
            'watermark' => max((int) $state['watermark'], (int) $run['upper_id']), 'last_completed_at' => $now,
            'next_run_at' => (int) $state['weekly_enabled'] === 1 ? $now + self::WEEK : 0, 'active_run_id' => 0,
        ]);
    }

    public function tick(int $batchSize = 200): array
    {
        $batchSize = max(1, min(500, $batchSize));
        $runId = 0;
        try {
            $this->transaction(function ($state) {
                if ((int) $state['active_run_id'] === 0 && (int) $state['weekly_enabled'] === 1
                    && (int) $state['last_completed_at'] > 0 && (int) $state['next_run_at'] > 0 && (int) $state['next_run_at'] <= time()) {
                    $this->createRun('incremental', $state);
                }
            });
            $this->transaction(function ($state) use ($batchSize, &$runId) {
                if ((int) $state['active_run_id'] === 0) {
                    return;
                }
                $run = $this->run((int) $state['active_run_id']);
                $runId = (int) $run['run_id'];
                $free = disk_free_space(dirname(__DIR__, 3));
                if ($free !== false && $free < 1073741824) {
                    throw new \RuntimeException('服务器可用空间不足 1 GB。', 1001);
                }
                $now = time();
                $videos = $this->query('SELECT ' . self::FIELDS . ' FROM ' . $this->table('vod')
                    . ' WHERE vod_id>? AND vod_id<=? ORDER BY vod_id ASC LIMIT ' . $batchSize,
                    [(int) $run['cursor_id'], (int) $run['upper_id']])->fetchAll(\PDO::FETCH_ASSOC);
                $issues = 0;
                $truncated = 0;
                foreach ($videos as $video) {
                    [$found, $limited] = $this->auditVideo($video, (int) $run['run_id'], $now);
                    $issues += $found;
                    $truncated += $limited;
                    $run['cursor_id'] = (int) $video['vod_id'];
                }
                $finished = time();
                $this->update('vodmerge_audit_run', 'run_id', (int) $run['run_id'], [
                    'status' => 'running', 'cursor_id' => (int) $run['cursor_id'],
                    'processed_count' => (int) $run['processed_count'] + count($videos),
                    'issue_count' => (int) $run['issue_count'] + $issues,
                    'truncated_count' => (int) $run['truncated_count'] + $truncated, 'updated_at' => $finished, 'error_message' => '',
                ]);
                if (count($videos) < $batchSize || (int) $run['cursor_id'] >= (int) $run['upper_id']) {
                    $this->complete($run, $state, $finished);
                }
            });
        } catch (\Throwable $error) {
            error_log('VodMerge library audit failed: ' . get_class($error) . ' code=' . (string) $error->getCode());
            $message = $error->getCode() === 1001
                ? '服务器可用空间不足 1 GB，排查已暂停；此前进度保留，请清理空间后重试。'
                : '本批排查未保存，请稍后重试；此前进度已保留。';
            try {
                $recorded = $this->transaction(function ($state) use ($runId, $message) {
                    if ($runId === 0 || (int) $state['active_run_id'] !== $runId) {
                        return false;
                    }
                    $this->update('vodmerge_audit_run', 'run_id', (int) $state['active_run_id'], [
                        'status' => 'error', 'updated_at' => time(), 'error_message' => $message,
                    ]);
                    return true;
                });
            } catch (\Throwable $failure) {
                throw new \RuntimeException('排查暂未完成，请稍后重试。');
            }
            if (!$recorded) {
                throw new \RuntimeException('排查暂未完成，请稍后重试。');
            }
        }
        return $this->summary();
    }

    private function runSummary(array $run): array
    {
        foreach (['run_id', 'lower_id', 'upper_id', 'cursor_id', 'total_count', 'processed_count', 'issue_count',
            'truncated_count', 'started_at', 'updated_at', 'finished_at'] as $field) {
            $run[$field] = (int) $run[$field];
        }
        $run['elapsed_seconds'] = max(0, ($run['finished_at'] ?: time()) - $run['started_at']);
        return $run;
    }

    public function summary(): array
    {
        $state = $this->query('SELECT * FROM ' . $this->table('vodmerge_audit_state') . ' WHERE state_id=1')->fetch(\PDO::FETCH_ASSOC);
        if (!$state) {
            throw new \RuntimeException('请先安装影片排查数据表。');
        }
        $runs = $this->query('SELECT * FROM ' . $this->table('vodmerge_audit_run') . ' ORDER BY run_id DESC LIMIT 10')->fetchAll(\PDO::FETCH_ASSOC);
        $runs = array_map([$this, 'runSummary'], $runs);
        $counts = array_fill_keys(['high', 'probable', 'conflict', 'insufficient', 'related', 'unrated'], 0);
        if ($runs) {
            try {
                $groups = $this->query('SELECT assessment,COUNT(*) AS total FROM ' . $this->table('vodmerge_audit_issue')
                    . ' WHERE run_id=? GROUP BY assessment', [$runs[0]['run_id']])->fetchAll(\PDO::FETCH_ASSOC);
            } catch (\PDOException $error) {
                if ($error->getCode() !== '42S22' && strpos($error->getMessage(), 'no such column: assessment') === false) {
                    throw $error;
                }
                throw new \RuntimeException('排查数据表需要升级，请由服务器运维运行 upgrade-audit.php --apply 后重试。');
            }
            foreach ($groups as $group) {
                if (isset($counts[$group['assessment']])) {
                    $counts[$group['assessment']] = (int) $group['total'];
                }
            }
        }
        return [
            'weekly_enabled' => (int) $state['weekly_enabled'] === 1, 'watermark' => (int) $state['watermark'],
            'last_completed_at' => (int) $state['last_completed_at'], 'next_run_at' => (int) $state['next_run_at'],
            'active_run_id' => (int) $state['active_run_id'],
            'run' => (int) $state['active_run_id'] > 0 ? $this->runSummary($this->run((int) $state['active_run_id'])) : null,
            'latest_run' => $runs[0] ?? null, 'recent_runs' => $runs, 'assessment_counts' => $counts,
        ];
    }

    private function issueSummary(array $row): array
    {
        foreach (['issue_id', 'run_id', 'left_id', 'right_id', 'created_at'] as $field) {
            $row[$field] = (int) $row[$field];
        }
        $row['assessment'] = (string) ($row['assessment'] ?? 'unrated');
        $row['priority'] = (int) ($row['priority'] ?? 0);
        $row['assessment_version'] = (int) ($row['assessment_version'] ?? 0);
        $detail = json_decode($row['detail_json'], true);
        $row['detail'] = is_array($detail) ? $detail : [];
        unset($row['detail_json']);
        return $row;
    }

    private function currentMetadata(array $ids): array
    {
        $ids = array_values(array_unique($ids));
        if (!$ids) {
            return [];
        }
        $placeholders = implode(',', array_fill(0, count($ids), '?'));
        $rows = $this->query('SELECT ' . self::FIELDS . ' FROM ' . $this->table('vod') . ' WHERE vod_id IN (' . $placeholders . ')', $ids)->fetchAll(\PDO::FETCH_ASSOC);
        $metadata = [];
        foreach ($rows as $row) {
            $metadata[(int) $row['vod_id']] = $this->metadata($row);
        }
        return $metadata;
    }

    private function annotateRule(array $issue, array $metadata): array
    {
        $leftId = $issue['left_id'];
        $rightId = $issue['right_id'];
        $detail = $issue['detail'];
        $missing = !isset($metadata[$leftId], $metadata[$rightId]);
        $valid = is_array($detail['left'] ?? null) && is_array($detail['right'] ?? null);
        $issue['detail']['current_missing'] = $missing;
        $issue['detail']['rule_stale'] = $missing || !$valid
            || Payload::json([$this->snapshot($detail['left']), $this->snapshot($detail['right'])])
                !== Payload::json([$this->snapshot($metadata[$leftId]), $this->snapshot($metadata[$rightId])]);
        return $issue;
    }

    private function reviewRequest(array $metadata, int $leftId, int $rightId): array
    {
        if (!isset($metadata[$leftId], $metadata[$rightId])) {
            throw new \RuntimeException('影片已删除或不存在，无法复核，请刷新排查结果。');
        }
        return Jev::request($metadata[$rightId], [$metadata[$leftId]]);
    }

    private function validatedJudgment(array $judgment, array $request, string $model): array
    {
        $key = array_keys($request['questions'])[0];
        try {
            $parsed = Jev::parse(['model' => $model, 'answers' => [$key => ['type' => 'choice'] + $judgment]], $request);
            $answer = $parsed['answers'][(int) substr($key, 4)];
            $answer['probabilities'] = array_map('floatval', $answer['probabilities']);
            return $answer;
        } catch (\Throwable $error) {
            throw new \RuntimeException('Jev 返回格式或概率分布无效，请稍后重新复核。');
        }
    }

    private function reviewFailure(array $result): void
    {
        $status = $result['status'] ?? '';
        $http = (int) ($result['http_status'] ?? 0);
        if ($status === 'unavailable') {
            $message = '尚未配置 Jev Token，或服务器未启用 cURL，请在设置中检查。';
        } elseif ($status === 'invalid') {
            $message = 'Jev 返回格式或概率分布无效，请稍后重新复核。';
        } elseif ($http === 401 || $http === 403) {
            $message = 'Jev Token 认证失败，请在设置中检查 Token。';
        } elseif ($http === 429) {
            $message = 'Jev 请求已限流，请稍后重试。';
        } elseif ($http >= 500) {
            $message = 'Jev 上游服务暂时不可用，请稍后重试。';
        } elseif ($status === 'failed' && $http === 0) {
            $message = 'Jev 网络连接失败或超时，请检查服务器网络后重试。';
        } else {
            $message = 'Jev 复核未完成，请检查服务器配置后重试。';
        }
        throw new \RuntimeException($message);
    }

    public function reviewIssue(int $issueId, bool $force = false): array
    {
        if ($issueId < 1) {
            throw new \InvalidArgumentException('请选择有效的排查影片对。');
        }
        $row = $this->query('SELECT * FROM ' . $this->table('vodmerge_audit_issue') . ' WHERE issue_id=?', [$issueId])->fetch(\PDO::FETCH_ASSOC);
        if (!$row) {
            throw new \RuntimeException('排查影片对不存在，请刷新结果。');
        }
        $issue = $this->issueSummary($row);
        $leftId = $issue['left_id'];
        $rightId = $issue['right_id'];
        $metadata = $this->currentMetadata([$leftId, $rightId]);
        $request = $this->reviewRequest($metadata, $leftId, $rightId);
        $hash = hash('sha256', Payload::json($request));
        $saved = $issue['detail']['ai_review'] ?? [];
        $age = time() - (int) ($saved['reviewed_at'] ?? 0);
        if (!$force && ($saved['status'] ?? '') === 'ok' && ($saved['request_hash'] ?? '') === $hash && $age >= 0 && $age <= 600) {
            try {
                $saved['judgment'] = $this->validatedJudgment((array) ($saved['judgment'] ?? []), $request, (string) ($saved['model'] ?? ''));
                $saved['stale'] = false;
                $saved['reused'] = true;
                $issue['detail']['ai_review'] = $saved;
                return $this->annotateRule($issue, $metadata);
            } catch (\RuntimeException $error) {
                // Invalid saved judgments are refreshed rather than displayed as probabilities.
            }
        }
        $started = microtime(true);
        try {
            $result = call_user_func($this->reviewer, $metadata[$rightId], [$metadata[$leftId]]);
        } catch (\Throwable $error) {
            throw new \RuntimeException('Jev 复核未完成，请检查服务器网络后重试。');
        }
        if (!is_array($result) || ($result['status'] ?? '') !== 'ok') {
            $this->reviewFailure(is_array($result) ? $result : []);
        }
        $model = mb_substr(trim(strip_tags((string) ($result['model'] ?? $request['model']))), 0, 128, 'UTF-8');
        $judgment = $this->validatedJudgment((array) ($result['answers'][$leftId] ?? []), $request, $model);
        $current = $this->currentMetadata([$leftId, $rightId]);
        $currentRequest = $this->reviewRequest($current, $leftId, $rightId);
        if (hash('sha256', Payload::json($currentRequest)) !== $hash) {
            throw new \RuntimeException('复核期间影片资料已变化，本次结果未保存，请重新复核。');
        }
        $issue['detail']['ai_review'] = [
            'status' => 'ok', 'model' => $model, 'judgment' => $judgment, 'reviewed_at' => time(),
            'elapsed_ms' => max(0, (int) round((microtime(true) - $started) * 1000)), 'request_hash' => $hash,
            'left' => $current[$leftId], 'right' => $current[$rightId], 'stale' => false, 'reused' => false,
        ];
        $detail = Payload::json($issue['detail']);
        $condition = $this->db->getAttribute(\PDO::ATTR_DRIVER_NAME) === 'mysql' ? 'BINARY detail_json=?' : 'detail_json=?';
        $updated = $this->query('UPDATE ' . $this->table('vodmerge_audit_issue') . ' SET detail_json=? WHERE issue_id=? AND ' . $condition,
            [$detail, $issueId, $row['detail_json']])->rowCount();
        if ($updated !== 1 && $this->query('SELECT detail_json FROM ' . $this->table('vodmerge_audit_issue') . ' WHERE issue_id=?', [$issueId])->fetchColumn() !== $detail) {
            throw new \RuntimeException('排查结果已由其他操作更新，本次复核未保存，请刷新后重试。');
        }
        return $this->annotateRule($issue, $current);
    }

    public function issues(int $runId, int $before = 0, string $kind = '', string $quality = '', int $beforePriority = -1): array
    {
        $qualities = ['', 'review', 'all', 'high', 'probable', 'conflict', 'insufficient', 'related', 'unrated'];
        if ($runId < 1 || !in_array($kind, ['', 'possible_duplicate', 'conflict'], true)
            || !in_array($quality, $qualities, true) || $before < 0 || $beforePriority < -1 || $beforePriority > 4
            || ($quality !== '' && (($before > 0 && $beforePriority < 0) || ($before === 0 && $beforePriority !== -1)))) {
            throw new \InvalidArgumentException('排查记录、结果类型或分页位置无效。');
        }
        $updating = $quality !== '' && (bool) $this->query('SELECT issue_id FROM ' . $this->table('vodmerge_audit_issue')
            . ' WHERE run_id=? AND assessment_version<? LIMIT 1', [$runId, AuditMatch::VERSION])->fetchColumn();
        if ($before > 0 && $updating) {
            throw new \InvalidArgumentException('规则分级仍在更新，请刷新首页；完成后再翻页。');
        }
        $values = [$runId];
        $where = ' WHERE run_id=?';
        if ($kind !== '') {
            $where .= ' AND kind=?';
            $values[] = $kind;
        }
        if ($quality === 'review') {
            $where .= " AND assessment<>'related'";
        } elseif ($quality !== '' && $quality !== 'all') {
            $where .= ' AND assessment=?';
            $values[] = $quality;
        }
        if ($before > 0) {
            if ($quality === '') {
                $where .= ' AND issue_id<?';
                $values[] = $before;
            } else {
                $where .= ' AND (priority<? OR (priority=? AND issue_id<?))';
                $values = array_merge($values, [$beforePriority, $beforePriority, $before]);
            }
        }
        $order = $quality === '' ? 'issue_id DESC' : 'priority DESC,issue_id DESC';
        $rows = $this->query('SELECT * FROM ' . $this->table('vodmerge_audit_issue') . $where
            . ' ORDER BY ' . $order . ' LIMIT 31', $values)->fetchAll(\PDO::FETCH_ASSOC);
        $more = count($rows) > 30;
        $rows = array_slice($rows, 0, 30);
        $ids = [];
        foreach ($rows as &$row) {
            $row = $this->issueSummary($row);
            $ids[] = $row['left_id'];
            $ids[] = $row['right_id'];
        }
        unset($row);
        $metadata = $this->currentMetadata($ids);
        foreach ($rows as &$row) {
            $row = $this->annotateRule($row, $metadata);
            if (!isset($row['detail']['ai_review'])) {
                continue;
            }
            $leftId = $row['left_id'];
            $rightId = $row['right_id'];
            $review = $row['detail']['ai_review'];
            if (($review['status'] ?? '') === 'ok') {
                $request = Jev::request((array) ($review['right'] ?? []), [['vod_id' => $leftId] + (array) ($review['left'] ?? [])]);
                $row['detail']['ai_review']['judgment'] = $this->validatedJudgment((array) ($review['judgment'] ?? []), $request, (string) ($review['model'] ?? ''));
            }
            $row['detail']['ai_review']['stale'] = !isset($metadata[$leftId], $metadata[$rightId])
                || hash('sha256', Payload::json($this->reviewRequest($metadata, $leftId, $rightId))) !== ($row['detail']['ai_review']['request_hash'] ?? '');
        }
        unset($row);
        $last = $rows ? $rows[count($rows) - 1] : [];
        return ['items' => $rows, 'next_before' => $more ? $last['issue_id'] : 0,
            'next_priority' => $more && $quality !== '' ? $last['priority'] : -1, 'has_more' => $more,
            'assessment_updating' => $updating];
    }
}
