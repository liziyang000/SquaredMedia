<?php

namespace addons\vodmerge\service;

class Service
{
    private $db;
    private $prefix;
    private $players;
    private $judge;
    private const LIBRARY_SOURCE = 'vodmerge-library';
    private const LIBRARY_ACCESS = [
        'vod_status', 'vod_level', 'vod_points', 'vod_points_play', 'vod_points_down',
        'vod_pwd', 'vod_pwd_play', 'vod_pwd_down', 'vod_trysee',
    ];
    private const GUARDS = [
        'vod_name', 'vod_year', 'vod_version', 'vod_douban_id', 'type_id', 'vod_lock', 'vod_time',
        'vod_sub', 'vod_en', 'vod_actor', 'vod_director', 'vod_area', 'vod_lang', 'vod_class', 'vod_content',
        'vod_play_from', 'vod_play_url', 'vod_play_server', 'vod_play_note',
    ];

    public function __construct(\PDO $db, string $prefix, array $players, ?callable $judge = null)
    {
        if (!preg_match('/^[a-zA-Z0-9_]{0,40}$/D', $prefix)) {
            throw new \RuntimeException('数据库表前缀无效。');
        }
        $this->db = $db;
        $this->prefix = $prefix;
        $this->players = $players;
        $this->judge = $judge ?? [Jev::class, 'review'];
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

    private function locked(callable $action)
    {
        $mysql = $this->db->getAttribute(\PDO::ATTR_DRIVER_NAME) === 'mysql';
        $name = 'vodmerge:' . substr(hash('sha256', $this->prefix . ($mysql ? $this->query('SELECT DATABASE()')->fetchColumn() : 'test')), 0, 48);
        if ($mysql && (int) $this->query('SELECT GET_LOCK(?, 0)', [$name])->fetchColumn() !== 1) {
            throw new \RuntimeException('另一个合并操作正在执行，请稍后重试。');
        }
        try {
            return $action();
        } finally {
            if ($mysql) {
                $this->query('SELECT RELEASE_LOCK(?)', [$name]);
            }
        }
    }

    private function updateJob(int $id, array $values): void
    {
        $values['updated_at'] = time();
        $set = implode(',', array_map(static function ($key) { return '`' . $key . '`=?'; }, array_keys($values)));
        $this->query('UPDATE ' . $this->table('vodmerge_job') . ' SET ' . $set . ' WHERE job_id=?', array_merge(array_values($values), [$id]));
    }

    private function job(int $id): array
    {
        $job = $this->query('SELECT * FROM ' . $this->table('vodmerge_job') . ' WHERE job_id=?', [$id])->fetch(\PDO::FETCH_ASSOC);
        if (!$job) {
            throw new \RuntimeException('采集任务不存在。');
        }
        return $job;
    }

    private function binding(array $job): ?array
    {
        $row = $this->query('SELECT * FROM ' . $this->table('vodmerge_binding') . ' WHERE source_key=? AND source_id=?', [$job['source_key'], $job['source_id']])->fetch(\PDO::FETCH_ASSOC);
        if (!$row) {
            return null;
        }
        $row['vod_id'] = (int) $row['vod_id'];
        $row['last_job_id'] = (int) $row['last_job_id'];
        return $row;
    }

    private function video(int $id): array
    {
        $row = $this->query('SELECT * FROM ' . $this->table('vod') . ' WHERE vod_id=?', [$id])->fetch(\PDO::FETCH_ASSOC);
        if (!$row) {
            throw new \RuntimeException('目标视频不存在。');
        }
        return $row;
    }

    private function checkPlayers(array $video, bool $library = false): void
    {
        foreach (Playlist::groups($video, true, $library) as $group) {
            if (!array_key_exists($group['vod_play_from'], $this->players)) {
                throw new \RuntimeException('请先在 MacCMS 安装播放器：' . $group['vod_play_from']);
            }
        }
    }

    private function checkUnfinished(array $job): void
    {
        $other = $this->query('SELECT job_id FROM ' . $this->table('vodmerge_job')
            . " WHERE source_key=? AND source_id=? AND job_id<>? AND status IN ('applying','creating','rolling_back') LIMIT 1",
            [$job['source_key'], $job['source_id'], $job['job_id']])->fetchColumn();
        if ($other) {
            throw new \RuntimeException('此来源须先恢复任务 #' . $other);
        }
    }

    private function checkTargetUnfinished(int $targetId, int $jobId): void
    {
        if ($targetId < 1) {
            return;
        }
        $other = $this->query('SELECT job_id FROM ' . $this->table('vodmerge_job')
            . " WHERE vod_id=? AND job_id<>? AND status IN ('applying','creating','rolling_back') LIMIT 1",
            [$targetId, $jobId])->fetchColumn();
        if ($other) {
            throw new \RuntimeException('目标视频须先恢复任务 #' . $other);
        }
    }

    public function submit(array $input): array
    {
        $input = Payload::envelope($input);
        if ($input['source'] === self::LIBRARY_SOURCE) {
            throw new \InvalidArgumentException('此来源仅供已有影片人工合并使用。');
        }
        $this->checkPlayers($input['video']);
        return $this->locked(function () use ($input) {
            $json = Payload::json($input['video']);
            $identity = [$input['source'], $input['source_id'], hash('sha256', $json)];
            $old = $this->query('SELECT job_id,status,vod_id FROM ' . $this->table('vodmerge_job') . ' WHERE source_key=? AND source_id=? AND payload_hash=?', $identity)->fetch(\PDO::FETCH_ASSOC);
            if ($old) {
                return $old + ['duplicate' => true];
            }
            $this->query('INSERT INTO ' . $this->table('vodmerge_job') . ' (source_key,source_id,payload_hash,video_json,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?)', array_merge($identity, [$json, 'pending', time(), time()]));
            return ['job_id' => (int) $this->db->lastInsertId(), 'status' => 'pending', 'vod_id' => 0, 'duplicate' => false];
        });
    }

    public function jobs(int $before = 0): array
    {
        $rows = $this->query('SELECT job_id,source_key,source_id,status,vod_id,message,video_json,updated_at FROM ' . $this->table('vodmerge_job')
            . ' WHERE source_key<>?' . ($before > 0 ? ' AND job_id < ?' : '') . ' ORDER BY job_id DESC LIMIT 30',
            $before > 0 ? [self::LIBRARY_SOURCE, $before] : [self::LIBRARY_SOURCE])->fetchAll(\PDO::FETCH_ASSOC);
        foreach ($rows as &$row) {
            $row['title'] = json_decode($row['video_json'], true)['vod_name'] ?? '';
            unset($row['video_json']);
        }
        return $rows;
    }

    public function detail(int $id): array
    {
        $job = $this->job($id);
        $plan = json_decode($job['plan_json'] ?? '', true) ?: [];
        $binding = $this->binding($job);
        $reviewable = in_array($job['status'], ['pending', 'review', 'ready'], true);
        $previewUntil = (int) $job['preview_until'];
        $library = $job['source_key'] === self::LIBRARY_SOURCE;
        $actions = [
            'review' => !$library && $reviewable,
            'requeue' => !$library && $job['status'] === 'review' && empty($job['creation_json']),
            'preview' => $reviewable || ($job['status'] === 'creating' && (int) $job['vod_id'] < 1),
            'create' => !$library && $reviewable && !$binding && empty($job['creation_json']),
            'apply' => $job['status'] === 'ready' && $job['preview_token'] !== '' && $previewUntil >= time(),
            'recover' => in_array($job['status'], ['applying', 'creating', 'rolling_back'], true) && (int) $job['vod_id'] > 0,
            'rollback' => $job['status'] === 'applied' && ($plan['mode'] ?? '') === 'merge',
            'reject' => !$library && $reviewable,
        ];
        $detail = [
            'job_id' => $id, 'source' => $job['source_key'], 'source_id' => $job['source_id'],
            'status' => $job['status'], 'vod_id' => (int) $job['vod_id'], 'message' => $job['message'],
            'video' => Payload::metadata(json_decode($job['video_json'], true)),
            'review' => json_decode($job['review_json'] ?? '', true) ?: [],
            'plan' => array_intersect_key($plan, array_flip(['mode', 'title', 'added_groups', 'added_episodes', 'new_status', 'line_changes'])),
            'preview_token' => $job['status'] === 'ready' ? $job['preview_token'] : '',
            'preview_until' => $previewUntil, 'actions' => $actions,
        ];
        if ($library) {
            $marker = $detail['review']['library'] ?? [];
            $detail['library'] = array_intersect_key($marker, array_flip(['issue_id', 'source_vod_id', 'target_vod_id', 'separate', 'target_metadata']));
            $detail['library']['source_metadata'] = $detail['video'];
        }
        return $detail;
    }

    private function libraryIssue(int $id): array
    {
        $issue = $this->query('SELECT issue_id,left_id,right_id FROM ' . $this->table('vodmerge_audit_issue') . ' WHERE issue_id=?', [$id])->fetch(\PDO::FETCH_ASSOC);
        if (!$issue || (int) $issue['left_id'] < 1 || (int) $issue['right_id'] < 1 || (int) $issue['left_id'] === (int) $issue['right_id']) {
            throw new \RuntimeException('已有影片排查记录不存在或影片对无效。');
        }
        return $issue;
    }

    private function libraryJob(int $issueId, int $id): array
    {
        $issue = $this->libraryIssue($issueId);
        $job = $this->job($id);
        $marker = json_decode($job['review_json'] ?? '', true)['library'] ?? [];
        $pair = [(int) $issue['left_id'], (int) $issue['right_id']];
        if ($job['source_key'] !== self::LIBRARY_SOURCE || (int) ($marker['issue_id'] ?? 0) !== $issueId
            || !in_array((int) ($marker['source_vod_id'] ?? 0), $pair, true)
            || !in_array((int) ($marker['target_vod_id'] ?? 0), $pair, true)
            || (int) $marker['source_vod_id'] === (int) $marker['target_vod_id']
            || (string) $job['source_id'] !== (string) $marker['source_vod_id']
            || (int) $job['vod_id'] !== (int) $marker['target_vod_id']) {
            throw new \RuntimeException('此任务不属于当前排查影片对。');
        }
        return $job;
    }

    private function latestLibraryJob(array $issue): ?array
    {
        $rows = $this->query('SELECT * FROM ' . $this->table('vodmerge_job')
            . ' WHERE source_key=? AND source_id IN (?,?) ORDER BY job_id DESC',
            [self::LIBRARY_SOURCE, (string) $issue['left_id'], (string) $issue['right_id']]);
        while ($job = $rows->fetch(\PDO::FETCH_ASSOC)) {
            $marker = json_decode($job['review_json'] ?? '', true)['library'] ?? [];
            if ((int) ($marker['issue_id'] ?? 0) === (int) $issue['issue_id']) {
                return $this->libraryJob((int) $issue['issue_id'], (int) $job['job_id']);
            }
        }
        return null;
    }

    private function librarySnapshot(array $video): array
    {
        $snapshot = [];
        foreach (array_merge(self::GUARDS, self::LIBRARY_ACCESS) as $field) {
            if (array_key_exists($field, $video)) {
                $snapshot[$field] = (string) $video[$field];
            }
        }
        return $snapshot;
    }

    private function assertLibraryAccess(array $source, array $target): void
    {
        foreach (self::LIBRARY_ACCESS as $field) {
            if (array_key_exists($field, $source) !== array_key_exists($field, $target)
                || (string) ($source[$field] ?? '') !== (string) ($target[$field] ?? '')) {
                throw new \RuntimeException('两条影片的审核状态、访问限制或付费设置不同，请先在视频后台核实；不能直接合并。');
            }
        }
    }

    private function assertLibrarySource(array $job, array $plan): void
    {
        $marker = json_decode($job['review_json'] ?? '', true)['library'] ?? [];
        $this->libraryJob((int) ($marker['issue_id'] ?? 0), (int) $job['job_id']);
        $this->checkTargetUnfinished((int) $marker['source_vod_id'], (int) $job['job_id']);
        $source = $this->video((int) $marker['source_vod_id']);
        $this->checkPlayers($source, true);
        foreach (Playlist::groups($this->video((int) $marker['target_vod_id'])) as $group) {
            $this->checkPlayers($group);
        }
        if (!$this->same($source, $plan['library_source_before'] ?? [])) {
            throw new \RuntimeException('来源影片在预览后发生变化，请重新预览。');
        }
        if (empty($plan['library_source_before'])) {
            throw new \RuntimeException('来源影片快照缺失，请重新预览。');
        }
    }

    public function libraryStatus(int $issueId): array
    {
        $job = $this->latestLibraryJob($this->libraryIssue($issueId));
        return ['issue_id' => $issueId, 'job' => $job ? $this->detail((int) $job['job_id']) : null];
    }

    public function libraryPreview(int $issueId, int $targetId, bool $separate = false): array
    {
        $id = $this->locked(function () use ($issueId, $targetId, $separate) {
            $issue = $this->libraryIssue($issueId);
            if (!in_array($targetId, [(int) $issue['left_id'], (int) $issue['right_id']], true)) {
                throw new \RuntimeException('只能选择当前排查影片对中的一条作为保留目标。');
            }
            $sourceId = (int) $issue['left_id'] === $targetId ? (int) $issue['right_id'] : (int) $issue['left_id'];
            $job = $this->latestLibraryJob($issue);
            if ($job && !in_array($job['status'], ['review', 'ready', 'rolled_back'], true)) {
                throw new \RuntimeException('此影片对已合并或有待恢复操作，请先处理已有记录。');
            }
            if ($job && $job['status'] === 'ready') {
                $this->updateJob((int) $job['job_id'], ['status' => 'review', 'plan_json' => null, 'preview_token' => '', 'preview_until' => 0]);
            }
            $source = $this->video($sourceId);
            $target = $this->video($targetId);
            if (!empty($source['vod_lock']) || !empty($target['vod_lock'])) {
                throw new \RuntimeException('影片已锁定，请先在视频后台核实。');
            }
            $this->assertLibraryAccess($source, $target);
            $video = array_intersect_key($source, array_flip(array_merge(self::GUARDS, array_keys(Payload::metadata([])))));
            $marker = ['library' => ['issue_id' => $issueId, 'source_vod_id' => $sourceId, 'target_vod_id' => $targetId,
                'separate' => $separate, 'target_metadata' => Payload::metadata($target)]];
            $values = ['source_id' => (string) $sourceId, 'video_json' => Payload::json($video), 'review_json' => Payload::json($marker),
                'status' => 'review', 'vod_id' => $targetId, 'plan_json' => null, 'preview_token' => '', 'preview_until' => 0,
                'message' => '仅人工预览与确认；来源影片保留。'];
            if ($job && $job['status'] !== 'rolled_back') {
                $id = (int) $job['job_id'];
                $this->updateJob($id, $values);
            } else {
                $values += ['source_key' => self::LIBRARY_SOURCE, 'payload_hash' => bin2hex(random_bytes(32)), 'created_at' => time(), 'updated_at' => time()];
                $fields = array_keys($values);
                $this->query('INSERT INTO ' . $this->table('vodmerge_job') . ' (`' . implode('`,`', $fields) . '`) VALUES ('
                    . implode(',', array_fill(0, count($fields), '?')) . ')', array_values($values));
                $id = (int) $this->db->lastInsertId();
            }
            return $id;
        });
        return ['issue_id' => $issueId, 'job' => $this->preview($id, $targetId, $separate, false, false, true)];
    }

    public function libraryApply(int $issueId, int $jobId, string $token, int $operator): array
    {
        $this->libraryJob($issueId, $jobId);
        return ['issue_id' => $issueId, 'job' => $this->apply($jobId, $token, $operator, true)];
    }

    public function libraryRollback(int $issueId, int $jobId, int $operator): array
    {
        $job = $this->libraryJob($issueId, $jobId);
        return ['issue_id' => $issueId, 'job' => $job['status'] === 'rolled_back' ? $this->detail($jobId) : $this->rollback($jobId, $operator, true)];
    }

    public function libraryRecover(int $issueId, int $jobId): array
    {
        $this->libraryJob($issueId, $jobId);
        return ['issue_id' => $issueId, 'job' => $this->recover($jobId, true)];
    }

    private function candidates(array $video): array
    {
        $rows = [];
        $columns = '`' . implode('`,`', array_merge(['vod_id'], array_keys(Payload::metadata([])))) . '`';
        $append = function (array $where, array $values) use (&$rows, $video, $columns): void {
            if (!$where || count($rows) >= 11) {
                return;
            }
            $sql = 'SELECT ' . $columns . ' FROM ' . $this->table('vod') . ' WHERE (' . implode(' OR ', $where) . ')';
            if ($rows) {
                $ids = array_column($rows, 'vod_id');
                $sql .= ' AND vod_id NOT IN (' . implode(',', array_fill(0, count($ids), '?')) . ')';
                $values = array_merge($values, $ids);
            }
            $sql .= ' ORDER BY ';
            if (($video['vod_year'] ?? '') !== '') {
                $sql .= 'CASE WHEN vod_year=? THEN 0 ELSE 1 END, ';
                $values[] = $video['vod_year'];
            }
            $sql .= 'vod_id ASC LIMIT ' . (11 - count($rows));
            $rows = array_merge($rows, $this->query($sql, $values)->fetchAll(\PDO::FETCH_ASSOC));
        };
        if ((int) $video['vod_douban_id'] > 0) {
            $append(['vod_douban_id=?'], [(int) $video['vod_douban_id']]);
        }
        $fullTitles = Payload::searchTitles($video, false);
        $stems = array_values(array_diff(Payload::searchTitles($video), $fullTitles));
        // Exact identities precede broad recall, so a popular stem cannot crowd them out.
        foreach (['exact', 'alias', 'prefix', 'stem'] as $stage) {
            $where = [];
            $values = [];
            foreach ($stage === 'stem' ? $stems : $fullTitles as $title) {
                if ($stage !== 'exact' && mb_strlen($title, 'UTF-8') < 2) {
                    continue;
                }
                $escaped = str_replace(['!', '%', '_'], ['!!', '!%', '!_'], $title);
                $fields = $stage === 'alias' ? ['vod_sub']
                    : ($stage === 'prefix' ? ['vod_name', 'vod_en'] : ['vod_name', 'vod_sub', 'vod_en']);
                foreach ($fields as $field) {
                    $where[] = $field . " LIKE ? ESCAPE '!'";
                    $values[] = ($stage === 'alias' ? '%' : '') . $escaped . ($stage === 'exact' ? '' : '%');
                }
            }
            $append($where, $values);
        }
        return $rows;
    }

    public function review(int $id, bool $force = false): array
    {
        $job = $this->job($id);
        if ($job['source_key'] === self::LIBRARY_SOURCE) {
            throw new \RuntimeException('已有影片请在排查页按影片对复核。');
        }
        if (!in_array($job['status'], ['pending', 'review', 'ready'], true)) {
            throw new \RuntimeException('此状态不能重新调用 Jev。');
        }
        $video = json_decode($job['video_json'], true);
        $binding = $this->binding($job);
        $candidates = $binding ? [$this->video($binding['vod_id'])] : $this->candidates($video);
        $truncated = count($candidates) > 10;
        $candidates = array_slice($candidates, 0, 10);
        $eligible = array_values(array_filter($candidates, static function ($candidate) use ($video) {
            return !Payload::conflicts($video, $candidate);
        }));
        $request = Jev::request($video, $eligible);
        $requestHash = hash('sha256', Payload::json($request));
        $previous = json_decode($job['review_json'] ?? '', true) ?: [];
        $checkedAt = time();
        $cached = false;
        $result = null;
        if (!$force && $eligible && ($previous['status'] ?? '') === 'ok'
            && is_string($previous['request_hash'] ?? null) && hash_equals($requestHash, $previous['request_hash'])
            && is_int($previous['checked_at'] ?? null) && $previous['checked_at'] <= $checkedAt
            && $previous['checked_at'] >= $checkedAt - 600) {
            try {
                if (!is_array($previous['candidates'] ?? null) || !is_string($previous['model'] ?? '')) {
                    throw new \RuntimeException('已保存的 Jev 判断格式无效。');
                }
                $answers = [];
                foreach ($previous['candidates'] ?? [] as $candidate) {
                    if (is_array($candidate['judgment'] ?? null)) {
                        $answers['vod_' . (int) ($candidate['vod_id'] ?? 0)] = ['type' => 'choice'] + $candidate['judgment'];
                    }
                }
                $result = Jev::parse(['model' => $previous['model'] ?? '', 'answers' => $answers], $request);
                $checkedAt = $previous['checked_at'];
                $cached = true;
            } catch (\Throwable $error) {
                $result = null;
            }
        }
        if ($result === null) {
            $result = $candidates && !$eligible ? ['status' => 'blocked', 'answers' => []] : call_user_func($this->judge, $video, $eligible);
            $checkedAt = time();
        }
        $result['request_hash'] = $requestHash;
        $result['checked_at'] = $checkedAt;
        $result['cached'] = $cached;
        $rows = [];
        foreach ($candidates as $candidate) {
            $rows[] = [
                'vod_id' => (int) $candidate['vod_id'], 'metadata' => Payload::metadata($candidate),
                'conflicts' => Payload::conflicts($video, $candidate),
                'judgment' => $result['answers'][(int) $candidate['vod_id']] ?? null,
                'exact_id' => (int) $video['vod_douban_id'] > 0 && (int) $video['vod_douban_id'] === (int) $candidate['vod_douban_id'],
            ];
        }
        $rank = static function ($row): array {
            $rank = ['same' => 0, 'uncertain' => 1, 'different' => 2];
            return [!empty($row['conflicts']) ? 1 : 0,
                $rank[$row['judgment']['choice'] ?? 'uncertain'], $row['exact_id'] ? 0 : 1,
                -(float) ($row['judgment']['probabilities']['same'] ?? 0), $row['vod_id']];
        };
        usort($rows, static function ($left, $right) use ($rank) {
            return $rank($left) <=> $rank($right);
        });
        $result['candidates'] = $rows;
        $result['truncated'] = $truncated;
        unset($result['answers']);
        return $this->locked(function () use ($id, $job, $video, $result) {
            $current = $this->job($id);
            if ($current['status'] !== $job['status'] || $current['preview_token'] !== $job['preview_token']
                || $current['review_json'] !== $job['review_json']) {
                throw new \RuntimeException('任务状态已变化，请刷新。');
            }
            $result['automatic'] = $this->binding($current)
                ? ['eligible' => false, 'target_id' => 0, 'reasons' => ['该来源已有绑定，按自动补集规则处理。']]
                : $this->automaticDecision($video, $result);
            $message = $result['automatic']['eligible'] ? '满足严格自动首绑规则；仅开启该功能后的 Worker 可自动执行。'
                : '需人工审核：' . implode('；', $result['automatic']['reasons']);
            $this->updateJob($id, ['status' => 'review', 'review_json' => Payload::json($result), 'preview_token' => '', 'plan_json' => null, 'message' => mb_substr($message, 0, 255, 'UTF-8')]);
            return $this->detail($id);
        });
    }

    private function automaticDecision(array $video, array $review): array
    {
        $deny = static function (array $reasons): array {
            return ['eligible' => false, 'target_id' => 0, 'reasons' => $reasons];
        };
        if (($review['status'] ?? '') !== 'ok') {
            $reasons = ['no_candidates' => '未检索到已有目标，须人工核实。', 'blocked' => '候选存在身份冲突。',
                'failed' => 'Jev 调用失败，等待人工审核。', 'unavailable' => 'Jev 当前不可用。', 'invalid' => 'Jev 返回未通过校验。'];
            return $deny([$reasons[$review['status'] ?? ''] ?? 'Jev 未完成有效判断。']);
        }
        if (!empty($review['truncated'])) {
            return $deny(['候选超过 10 条，覆盖不完整。']);
        }
        $same = array_values(array_filter($review['candidates'], static function ($row) {
            return !$row['conflicts'] && ($row['judgment']['choice'] ?? '') === 'same';
        }));
        if (count($same) !== 1) {
            return $deny(['Jev 没有给出唯一的相同作品候选。']);
        }
        $candidate = $same[0];
        $issues = Payload::automaticIssues($video, $candidate['metadata']);
        if (($candidate['judgment']['probabilities']['same'] ?? 0) < 0.98 || ($candidate['judgment']['confidence'] ?? 0) < 0.95) {
            $issues[] = 'Jev 判断未达到自动首绑门槛。';
        }
        foreach ($review['candidates'] as $other) {
            if ($other['vod_id'] !== $candidate['vod_id'] && !$other['conflicts']
                && (($other['judgment']['choice'] ?? '') !== 'different' || ($other['judgment']['probabilities']['different'] ?? 0) < 0.95)) {
                $issues[] = '其他候选仍存在匹配歧义。';
                break;
            }
        }
        $ids = $this->query('SELECT vod_id FROM ' . $this->table('vod') . ' WHERE vod_douban_id=? LIMIT 2', [(int) $video['vod_douban_id']])->fetchAll(\PDO::FETCH_COLUMN);
        if (count($ids) !== 1 || (int) $ids[0] !== $candidate['vod_id']) {
            $issues[] = '豆瓣 ID 在库内不是唯一目标。';
        }
        return $issues ? $deny(array_values(array_unique($issues)))
            : ['eligible' => true, 'target_id' => $candidate['vod_id'], 'reasons' => []];
    }

    private function assertAutomaticMatch(array $job, int $targetId): void
    {
        if ($this->binding($job) || !empty($job['creation_json']) || $targetId < 1) {
            throw new \RuntimeException('自动首绑仅适用于未绑定且没有不确定新增的已有视频。');
        }
        $video = json_decode($job['video_json'], true);
        $review = json_decode($job['review_json'] ?? '', true) ?: [];
        $decision = $this->automaticDecision($video, $review);
        if (!$decision['eligible'] || $decision['target_id'] !== $targetId) {
            throw new \RuntimeException('自动首绑条件不满足：' . implode('；', $decision['reasons']));
        }
        $before = [];
        foreach ($review['candidates'] as $candidate) {
            $before[$candidate['vod_id']] = $candidate['metadata'];
        }
        $now = [];
        foreach ($this->candidates($video) as $candidate) {
            $now[(int) $candidate['vod_id']] = Payload::metadata($candidate);
        }
        ksort($before);
        ksort($now);
        if ($before !== $now) {
            throw new \RuntimeException('候选或身份资料在判断后发生变化，须重新匹配。');
        }
    }

    public function preview(int $id, int $targetId, bool $separate = false, bool $automatic = false, bool $firstAutomatic = false, bool $library = false): array
    {
        return $this->locked(function () use ($id, $targetId, $separate, $automatic, $firstAutomatic, $library) {
            $job = $this->job($id);
            if ($job['source_key'] === self::LIBRARY_SOURCE && (!$library || $automatic || $firstAutomatic)) {
                throw new \RuntimeException('已有影片只能在排查页人工预览合并。');
            }
            $librarySource = null;
            if ($job['source_key'] === self::LIBRARY_SOURCE) {
                $marker = json_decode($job['review_json'], true)['library'] ?? [];
                $this->libraryJob((int) ($marker['issue_id'] ?? 0), $id);
                if ($targetId !== (int) $marker['target_vod_id'] || $separate !== $marker['separate']) {
                    throw new \RuntimeException('合并目标已变化，请重新预览。');
                }
                $librarySource = $this->video((int) $marker['source_vod_id']);
                $this->checkTargetUnfinished((int) $marker['source_vod_id'], $id);
                if (!$this->same($librarySource, json_decode($job['video_json'], true)) || !empty($librarySource['vod_lock'])) {
                    throw new \RuntimeException('来源影片已变化，请重新预览。');
                }
            }
            if (!in_array($job['status'], ['pending', 'review', 'ready', 'creating'], true)) {
                throw new \RuntimeException('此状态不能生成预览。');
            }
            $this->checkUnfinished($job);
            if ($job['status'] === 'creating' && (int) $job['vod_id'] > 0) {
                throw new \RuntimeException('新增 ID 已记录，请使用核验恢复功能。');
            }
            $incoming = json_decode($job['video_json'], true);
            $this->checkPlayers($incoming, $librarySource !== null);
            $binding = $this->binding($job);
            if ($firstAutomatic) {
                $this->assertAutomaticMatch($job, $targetId);
            }
            $identity = $binding ? json_decode($binding['identity_json'], true) : [];
            if ($binding && $binding['vod_id'] !== $targetId) {
                throw new \RuntimeException('该来源已绑定其他视频，不能自动改绑。');
            }
            if ($automatic && (!$binding || $identity['incoming'] !== Payload::identity($incoming))) {
                throw new \RuntimeException('来源身份未确认或片名发生变化，需人工确认。');
            }
            if ($binding && Payload::conflicts(Payload::identity($incoming), $identity['incoming'])) {
                throw new \RuntimeException('新资源与已确认的来源身份冲突。');
            }
            if ($targetId > 0) {
                $this->checkTargetUnfinished($targetId, $id);
                $target = $this->video($targetId);
                if ($librarySource !== null) {
                    $this->assertLibraryAccess($librarySource, $target);
                    foreach (Playlist::groups($target) as $group) {
                        $this->checkPlayers($group);
                    }
                }
                if ($automatic && $identity['target'] !== Payload::identity($target)) {
                    throw new \RuntimeException('目标视频身份资料已被修改，须重新人工确认。');
                }
                if (!empty($target['vod_lock'])) {
                    throw new \RuntimeException('视频已锁定，不能合并。');
                }
                $conflicts = Payload::conflicts($incoming, $target);
                if ($conflicts) {
                    throw new \RuntimeException(implode('；', $conflicts));
                }
                $before = [];
                foreach (self::GUARDS as $field) {
                    $before[$field] = (string) ($target[$field] ?? '');
                }
                if ($librarySource !== null) {
                    $before += array_intersect_key($this->librarySnapshot($target), array_flip(self::LIBRARY_ACCESS));
                }
                $reservedSlots = [];
                $otherBindings = $this->query('SELECT routes_json FROM ' . $this->table('vodmerge_binding')
                    . ' WHERE vod_id=? AND NOT (source_key=? AND source_id=?)',
                    [$targetId, $job['source_key'], $job['source_id']])->fetchAll(\PDO::FETCH_ASSOC);
                foreach ($otherBindings as $otherBinding) {
                    foreach (json_decode($otherBinding['routes_json'], true) ?: [] as $route) {
                        $reservedSlots[] = (int) $route['slot'];
                    }
                }
                $merge = Playlist::merge($target, $incoming, $binding && !$separate ? json_decode($binding['routes_json'], true) : [], $reservedSlots, $librarySource !== null);
                $after = array_merge($before, $merge['fields']);
                if (!$this->same($before, $after)) {
                    $after['vod_time'] = (string) time();
                }
                $plan = ['mode' => 'merge', 'title' => $target['vod_name'], 'before' => $before, 'after' => $after];
                if ($librarySource !== null) {
                    $plan['library_source_before'] = $this->librarySnapshot($librarySource);
                    $plan['line_changes'] = [];
                    $oldGroups = Playlist::groups($before);
                    foreach (Playlist::groups($after) as $slot => $group) {
                        $oldCount = isset($oldGroups[$slot]) ? count(explode('#', rtrim($oldGroups[$slot]['vod_play_url'], '#'))) : 0;
                        $newCount = count(explode('#', rtrim($group['vod_play_url'], '#')));
                        $plan['line_changes'][] = ['slot' => $slot, 'player' => $group['vod_play_from'],
                            'before_episodes' => $oldCount, 'after_episodes' => $newCount,
                            'added_episodes' => $newCount - $oldCount, 'is_new' => !isset($oldGroups[$slot])];
                    }
                }
            } else {
                if ($automatic || $binding || !empty($job['creation_json'])) {
                    throw new \RuntimeException('不能自动新增，或上次新增结果待核验；请找到已有记录后绑定，禁止重复新增。');
                }
                $type = $this->query('SELECT type_pid,type_mid FROM ' . $this->table('type') . ' WHERE type_id=?', [$incoming['type_id']])->fetch(\PDO::FETCH_ASSOC);
                if (!$type || (int) $type['type_mid'] !== 1) {
                    throw new \RuntimeException('新视频需要有效的本站视频分类 type_id。');
                }
                $merge = Playlist::merge([], $incoming);
                $after = array_merge($incoming, $merge['fields'], [
                    'type_id_1' => (int) $type['type_pid'], 'vod_status' => 0, 'vod_lock' => 0,
                    'vod_time' => time(), 'vod_time_add' => time(),
                    'vod_down_url' => '', 'vod_plot_name' => '', 'vod_plot_detail' => '',
                ]);
                $plan = ['mode' => 'create', 'title' => $incoming['vod_name'], 'before' => [], 'after' => $after, 'new_status' => '待审核'];
            }
            $plan += ['binding_before' => $binding, 'routes' => $merge['routes'], 'automatic_first' => $firstAutomatic,
                'added_groups' => $merge['added_groups'], 'added_episodes' => $merge['added_episodes']];
            $updates = [
                'status' => 'ready', 'vod_id' => $targetId, 'plan_json' => Payload::json($plan),
                'preview_token' => bin2hex(random_bytes(32)), 'preview_until' => time() + 600,
                'message' => '预览有效期 10 分钟；确认时会重新检查原值。',
            ];
            if ($librarySource !== null) {
                $marker['target_metadata'] = Payload::metadata($target);
                $updates['review_json'] = Payload::json(['library' => $marker]);
            }
            $this->updateJob($id, $updates);
            return $this->detail($id);
        });
    }

    private function same(array $actual, array $expected): bool
    {
        foreach ($expected as $field => $value) {
            if (!array_key_exists($field, $actual) || (string) $actual[$field] !== (string) $value) {
                return false;
            }
        }
        return true;
    }

    private function conditionalUpdate(int $id, array $before, array $after): void
    {
        if ($this->same($before, $after)) {
            return;
        }
        $set = [];
        $where = ['vod_id=?'];
        $values = [];
        foreach ($after as $field => $value) {
            if (array_key_exists($field, $before) && (string) $before[$field] === (string) $value) {
                continue;
            }
            $set[] = '`' . $field . '`=?';
            $values[] = $value;
        }
        $values[] = $id;
        $binary = $this->db->getAttribute(\PDO::ATTR_DRIVER_NAME) === 'mysql' ? 'BINARY ' : '';
        foreach ($before as $field => $value) {
            $where[] = $binary . '`' . $field . '`=?';
            $values[] = $value;
        }
        if ($this->query('UPDATE ' . $this->table('vod') . ' SET ' . implode(',', $set) . ' WHERE ' . implode(' AND ', $where), $values)->rowCount() !== 1) {
            throw new \RuntimeException('视频在预览后发生修改，未覆盖，请重新预览。');
        }
    }

    public function apply(int $id, string $token, int $operator, bool $library = false): array
    {
        return $this->locked(function () use ($id, $token, $operator, $library) {
            $job = $this->job($id);
            if ($job['source_key'] === self::LIBRARY_SOURCE && !$library) {
                throw new \RuntimeException('已有影片只能在排查页人工确认合并。');
            }
            if ($job['status'] === 'applied') {
                return $this->detail($id);
            }
            if ($job['status'] !== 'ready' || $job['preview_until'] < time() || $token === '' || !hash_equals($job['preview_token'], $token)) {
                throw new \RuntimeException('预览已失效，请重新预览。');
            }
            $plan = json_decode($job['plan_json'], true);
            $this->checkUnfinished($job);
            $this->checkTargetUnfinished((int) $job['vod_id'], $id);
            if ($this->binding($job) !== $plan['binding_before']) {
                throw new \RuntimeException('来源映射已变化，请重新预览。');
            }
            $this->checkPlayers(json_decode($job['video_json'], true), $job['source_key'] === self::LIBRARY_SOURCE);
            if (!empty($plan['automatic_first'])) {
                $this->assertAutomaticMatch($job, (int) $job['vod_id']);
            }
            if ($plan['mode'] === 'merge') {
                if (!$this->same($this->video((int) $job['vod_id']), $plan['before'])) {
                    throw new \RuntimeException('目标视频已变化，请重新预览。');
                }
                if ($job['source_key'] === self::LIBRARY_SOURCE) {
                    $this->assertLibrarySource($job, $plan);
                }
                // The durable intent precedes MyISAM writes; a transaction is not a rollback guarantee.
                $this->updateJob($id, ['status' => 'applying', 'operator_id' => $operator]);
                $this->conditionalUpdate((int) $job['vod_id'], $plan['before'], $plan['after']);
            } else {
                $this->updateJob($id, ['status' => 'creating', 'operator_id' => $operator, 'creation_json' => Payload::json($plan['after'])]);
                $fields = array_keys($plan['after']);
                $this->query('INSERT INTO ' . $this->table('vod') . ' (`' . implode('`,`', $fields) . '`) VALUES (' . implode(',', array_fill(0, count($fields), '?')) . ')', array_values($plan['after']));
                $job['vod_id'] = (int) $this->db->lastInsertId();
                $this->updateJob($id, ['vod_id' => $job['vod_id']]);
            }
            $this->finish($this->job($id), $plan);
            return $this->detail($id);
        });
    }

    private function finish(array $job, array $plan): void
    {
        $binding = $this->binding($job);
        if (!$binding || $binding['last_job_id'] !== (int) $job['job_id']) {
            if ($binding !== $plan['binding_before']) {
                throw new \RuntimeException('来源映射已变化，写入快照已保留，请人工核验。');
            }
            $values = [(int) $job['vod_id'], Payload::json($plan['routes']),
                Payload::json(['incoming' => Payload::identity(json_decode($job['video_json'], true)),
                    'target' => Payload::identity($plan['after'])]), (int) $job['job_id'],
                $job['source_key'], $job['source_id']];
            if ($binding) {
                $this->query('UPDATE ' . $this->table('vodmerge_binding') . ' SET vod_id=?,routes_json=?,identity_json=?,last_job_id=? WHERE source_key=? AND source_id=?', $values);
            } else {
                $this->query('INSERT INTO ' . $this->table('vodmerge_binding') . ' (vod_id,routes_json,identity_json,last_job_id,source_key,source_id) VALUES (?,?,?,?,?,?)', $values);
            }
        }
        $this->updateJob((int) $job['job_id'], ['status' => 'applied', 'preview_token' => '',
            'message' => !empty($plan['automatic_first']) ? '严格自动首绑已完成，原值快照已保存。' : '已写入，原值快照已保存。']);
    }

    public function recover(int $id, bool $library = false): array
    {
        return $this->locked(function () use ($id, $library) {
            $job = $this->job($id);
            if ($job['source_key'] === self::LIBRARY_SOURCE && !$library) {
                throw new \RuntimeException('已有影片请在排查页恢复合并记录。');
            }
            $plan = json_decode($job['plan_json'] ?? '', true) ?: [];
            if (!in_array($job['status'], ['applying', 'creating', 'rolling_back'], true)) {
                throw new \RuntimeException('此任务没有待恢复的写入。');
            }
            if ((int) $job['vod_id'] < 1) {
                throw new \RuntimeException('新增结果不确定，请在视频后台核对后输入已有 ID 绑定；不会重复新增。');
            }
            $this->checkTargetUnfinished((int) $job['vod_id'], $id);
            $binding = $this->binding($job);
            if ($binding !== $plan['binding_before'] && (!$binding || $binding['last_job_id'] !== $id)) {
                throw new \RuntimeException('来源映射已变化，停止恢复。');
            }
            $target = $this->video((int) $job['vod_id']);
            if ($job['status'] === 'rolling_back') {
                $this->finishRollback($job, $plan, $target);
            } else {
                if (!$this->same($target, $plan['after'])) {
                    if ($plan['mode'] !== 'merge' || !$this->same($target, $plan['before'])) {
                        throw new \RuntimeException('当前视频与写入前后快照都不一致，已停止恢复。');
                    }
                    if (!empty($plan['automatic_first'])) {
                        $this->assertAutomaticMatch($job, (int) $job['vod_id']);
                    }
                    if ($job['source_key'] === self::LIBRARY_SOURCE) {
                        $this->assertLibrarySource($job, $plan);
                    }
                    $this->conditionalUpdate((int) $job['vod_id'], $plan['before'], $plan['after']);
                }
                $this->finish($job, $plan);
            }
            return $this->detail($id);
        });
    }

    public function rollback(int $id, int $operator, bool $library = false): array
    {
        return $this->locked(function () use ($id, $operator, $library) {
            $job = $this->job($id);
            if ($job['source_key'] === self::LIBRARY_SOURCE && !$library) {
                throw new \RuntimeException('已有影片请在排查页回滚合并记录。');
            }
            $plan = json_decode($job['plan_json'] ?? '', true) ?: [];
            if ($job['status'] !== 'applied' || ($plan['mode'] ?? '') !== 'merge') {
                throw new \RuntimeException('只支持回滚合并；新建视频需在原生后台检查关联后处理。');
            }
            $this->checkTargetUnfinished((int) $job['vod_id'], $id);
            $binding = $this->binding($job);
            if (!$binding || $binding['last_job_id'] !== $id || !$this->same($this->video((int) $job['vod_id']), $plan['after'])) {
                throw new \RuntimeException('合并后视频或来源已变化，不能自动回滚。');
            }
            $this->checkRollbackDependencies($job, $plan);
            $this->updateJob($id, ['status' => 'rolling_back', 'operator_id' => $operator]);
            $this->finishRollback($this->job($id), $plan, $this->video((int) $job['vod_id']));
            return $this->detail($id);
        });
    }

    private function finishRollback(array $job, array $plan, array $target): void
    {
        $this->checkRollbackDependencies($job, $plan);
        $binding = $this->binding($job);
        if ($binding !== $plan['binding_before'] && (!$binding || $binding['last_job_id'] !== (int) $job['job_id'])) {
            throw new \RuntimeException('回滚映射冲突，快照已保留。');
        }
        if (!$this->same($target, $plan['before'])) {
            if (!$this->same($target, $plan['after'])) {
                throw new \RuntimeException('回滚时原值冲突，已停止。');
            }
            $this->conditionalUpdate((int) $job['vod_id'], $plan['after'], $plan['before']);
        }
        if ($binding && $binding['last_job_id'] === (int) $job['job_id']) {
            $old = $plan['binding_before'];
            if ($old) {
                $this->query('UPDATE ' . $this->table('vodmerge_binding') . ' SET vod_id=?,routes_json=?,identity_json=?,last_job_id=? WHERE source_key=? AND source_id=?',
                    [$old['vod_id'], $old['routes_json'], $old['identity_json'], $old['last_job_id'], $job['source_key'], $job['source_id']]);
            } else {
                $this->query('DELETE FROM ' . $this->table('vodmerge_binding') . ' WHERE source_key=? AND source_id=?', [$job['source_key'], $job['source_id']]);
            }
        } elseif ($binding !== $plan['binding_before']) {
            throw new \RuntimeException('回滚映射冲突，快照已保留。');
        }
        $this->updateJob((int) $job['job_id'], ['status' => 'rolled_back', 'message' => '已按原值快照回滚。']);
    }

    private function checkRollbackDependencies(array $job, array $plan): void
    {
        $before = Playlist::groups($plan['before']);
        $after = Playlist::groups($plan['after']);
        $changed = [];
        foreach ($after as $slot => $group) {
            if (!isset($before[$slot]) || $before[$slot] !== $group) {
                $changed[$slot] = true;
            }
        }
        if (!$changed) {
            return;
        }
        $bindings = $this->query('SELECT routes_json FROM ' . $this->table('vodmerge_binding')
            . ' WHERE vod_id=? AND NOT (source_key=? AND source_id=?)',
            [(int) $job['vod_id'], $job['source_key'], $job['source_id']])->fetchAll(\PDO::FETCH_ASSOC);
        foreach ($bindings as $binding) {
            foreach (json_decode($binding['routes_json'], true) ?: [] as $route) {
                if (isset($changed[(int) $route['slot']])) {
                    throw new \RuntimeException('其他来源仍依赖此合并修改的播放线路，不能自动回滚。');
                }
            }
        }
    }

    public function reject(int $id): array
    {
        return $this->locked(function () use ($id) {
            $job = $this->job($id);
            if ($job['source_key'] === self::LIBRARY_SOURCE) {
                throw new \RuntimeException('已有影片人工合并记录不能作为采集任务丢弃。');
            }
            if (!in_array($job['status'], ['pending', 'review', 'ready'], true)) {
                throw new \RuntimeException('已执行或结果不确定的任务不能丢弃。');
            }
            $this->updateJob($id, ['status' => 'rejected', 'preview_token' => '', 'message' => '已忽略此版本资源。']);
            return $this->detail($id);
        });
    }

    public function requeue(int $id): array
    {
        return $this->locked(function () use ($id) {
            $job = $this->job($id);
            if ($job['source_key'] === self::LIBRARY_SOURCE) {
                throw new \RuntimeException('已有影片合并只能人工确认，不能重新排队。');
            }
            if ($job['status'] !== 'review' || !empty($job['creation_json'])) {
                throw new \RuntimeException('仅普通待审核任务可以重新排队；已写入或结果不确定的任务不能重试。');
            }
            $this->checkUnfinished($job);
            $this->updateJob($id, ['status' => 'pending', 'review_json' => null, 'plan_json' => null,
                'preview_token' => '', 'message' => '已重新排队，Worker 将按当前自动化开关处理。']);
            return $this->detail($id);
        });
    }

    public function run(int $limit, bool $autoBound, bool $autoFirst = false): array
    {
        $rows = $this->query('SELECT job_id FROM ' . $this->table('vodmerge_job') . " WHERE status='pending' AND source_key<>? ORDER BY job_id ASC LIMIT " . max(1, min(10, $limit)), [self::LIBRARY_SOURCE])->fetchAll(\PDO::FETCH_ASSOC);
        $results = [];
        foreach ($rows as $row) {
            $id = (int) $row['job_id'];
            try {
                $job = $this->job($id);
                $binding = $this->binding($job);
                $uncertain = $this->query('SELECT job_id FROM ' . $this->table('vodmerge_job') . " WHERE source_key=? AND source_id=? AND status IN ('applying','creating','rolling_back') LIMIT 1", [$job['source_key'], $job['source_id']])->fetchColumn();
                if ($uncertain) {
                    throw new \RuntimeException('该来源有未完成写入，请先恢复任务 #' . $uncertain);
                }
                if ($autoBound && $binding) {
                    $preview = $this->preview($id, $binding['vod_id'], false, true);
                    $this->apply($id, $preview['preview_token'], 0);
                } else {
                    $review = $this->review($id);
                    if ($autoFirst && !$binding && $review['review']['automatic']['eligible']) {
                        $preview = $this->preview($id, $review['review']['automatic']['target_id'], false, false, true);
                        $this->apply($id, $preview['preview_token'], 0);
                    }
                }
            } catch (\RuntimeException | \InvalidArgumentException $error) {
                $this->locked(function () use ($id, $error) {
                    $job = $this->job($id);
                    $values = ['message' => mb_substr($error instanceof \PDOException ? '数据库操作失败，请检查服务器日志及写入快照。' : $error->getMessage(), 0, 255, 'UTF-8')];
                    if (in_array($job['status'], ['pending', 'ready'], true)) {
                        $values += ['status' => 'review', 'preview_token' => ''];
                    }
                    $this->updateJob($id, $values);
                });
            }
            $results[] = ['job_id' => $id, 'status' => $this->job($id)['status']];
        }
        return $results;
    }
}
