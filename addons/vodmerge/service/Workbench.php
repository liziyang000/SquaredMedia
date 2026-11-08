<?php

namespace addons\vodmerge\service;

class Workbench
{
    private $db;
    private $prefix;
    private $service;
    private const IDENTITY = ['vod_name', 'vod_sub', 'vod_en', 'vod_year', 'vod_area', 'vod_lang', 'vod_actor', 'vod_director', 'vod_class', 'vod_version', 'vod_douban_id', 'type_id'];
    private const CASE_FIELDS = 'c.left_id,c.right_id,c.issue_id,c.assessment,c.priority,c.discovered_at,c.decision,c.identity_signature,c.resource_signature,c.resolution,c.reason,c.actor_id,c.reviewed_at,c.snoozed_until,c.job_id,';

    public function __construct(\PDO $db, string $prefix, Service $service)
    {
        if (!preg_match('/^[a-zA-Z0-9_]{0,40}$/D', $prefix)) {
            throw new \InvalidArgumentException('数据库表前缀无效。');
        }
        $this->db = $db;
        $this->prefix = $prefix;
        $this->service = $service;
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

    private function mysql(): bool
    {
        return $this->db->getAttribute(\PDO::ATTR_DRIVER_NAME) === 'mysql';
    }

    private function locked(callable $action)
    {
        $name = 'vodmerge:' . substr(hash('sha256', $this->prefix . ($this->mysql() ? $this->query('SELECT DATABASE()')->fetchColumn() : 'test')), 0, 48);
        if ($this->mysql() && (int) $this->query('SELECT GET_LOCK(?, 0)', [$name])->fetchColumn() !== 1) {
            throw new \RuntimeException('另一个审核或资源操作正在执行，请稍后重试。');
        }
        try {
            return $action();
        } finally {
            if ($this->mysql()) {
                $this->query('SELECT RELEASE_LOCK(?)', [$name]);
            }
        }
    }

    public static function searchText(array $left, array $right): string
    {
        $parts = [];
        foreach ([$left, $right] as $video) {
            foreach (['vod_name', 'vod_sub', 'vod_en'] as $field) {
                if (!empty($video[$field])) {
                    $parts[] = (string) $video[$field];
                }
            }
        }
        return implode("\n", array_unique($parts));
    }

    public function discover(int $issueId, int $left, int $right, string $assessment, int $priority, int $at, string $searchText = ''): void
    {
        [$left, $right] = [min($left, $right), max($left, $right)];
        if ($left < 1 || $left === $right) {
            throw new \InvalidArgumentException('影片对无效。');
        }
        $sql = 'INSERT INTO ' . $this->table('vodmerge_case') . ' (left_id,right_id,issue_id,assessment,priority,discovered_at,search_text) VALUES (?,?,?,?,?,?,?)';
        $sql .= $this->mysql()
            ? ' ON DUPLICATE KEY UPDATE search_text=IF(VALUES(issue_id)>issue_id,VALUES(search_text),search_text),assessment=IF(VALUES(issue_id)>issue_id,VALUES(assessment),assessment),priority=IF(VALUES(issue_id)>issue_id,VALUES(priority),priority),issue_id=GREATEST(issue_id,VALUES(issue_id))'
            : ' ON CONFLICT(left_id,right_id) DO UPDATE SET search_text=excluded.search_text,assessment=excluded.assessment,priority=excluded.priority,issue_id=excluded.issue_id WHERE excluded.issue_id>issue_id';
        $this->query($sql, [$left, $right, $issueId, $assessment, $priority, $at, $searchText]);
    }

    public function importIssues(): int
    {
        $issue = $this->table('vodmerge_audit_issue');
        $case = $this->table('vodmerge_case');
        $parts = [];
        foreach (['left', 'right'] as $side) {
            foreach (['vod_name', 'vod_sub', 'vod_en'] as $field) {
                $value = "JSON_EXTRACT(i.detail_json,'$." . $side . '.' . $field . "')";
                $parts[] = 'COALESCE(' . ($this->mysql() ? 'JSON_UNQUOTE(' . $value . ')' : $value) . ",'')";
            }
        }
        $search = $this->mysql() ? 'CONCAT_WS(CHAR(10),' . implode(',', $parts) . ')' : implode(' || CHAR(10) || ', $parts);
        $sql = 'INSERT INTO ' . $case . ' (left_id,right_id,issue_id,assessment,priority,discovered_at,search_text)'
            . ' SELECT i.left_id,i.right_id,i.issue_id,i.assessment,i.priority,i.created_at,' . $search . ' FROM ' . $issue . ' i'
            . ' WHERE i.left_id<i.right_id AND NOT EXISTS (SELECT 1 FROM ' . $issue . ' n WHERE n.left_id=i.left_id AND n.right_id=i.right_id AND n.issue_id>i.issue_id)';
        $sql .= $this->mysql()
            ? ' ON DUPLICATE KEY UPDATE search_text=IF(' . $case . '.search_text IS NULL OR VALUES(issue_id)>' . $case . '.issue_id,VALUES(search_text),' . $case . '.search_text),assessment=IF(VALUES(issue_id)>' . $case . '.issue_id,VALUES(assessment),' . $case . '.assessment),priority=IF(VALUES(issue_id)>' . $case . '.issue_id,VALUES(priority),' . $case . '.priority),issue_id=GREATEST(' . $case . '.issue_id,VALUES(issue_id))'
            : ' ON CONFLICT(left_id,right_id) DO UPDATE SET search_text=CASE WHEN search_text IS NULL OR excluded.issue_id>issue_id THEN excluded.search_text ELSE search_text END,assessment=CASE WHEN excluded.issue_id>issue_id THEN excluded.assessment ELSE assessment END,priority=CASE WHEN excluded.issue_id>issue_id THEN excluded.priority ELSE priority END,issue_id=MAX(issue_id,excluded.issue_id)';
        $this->db->exec($sql);
        while ($rows = $this->query('SELECT left_id,right_id FROM ' . $case . " WHERE search_text IS NULL OR REPLACE(COALESCE(search_text,''),CHAR(10),'')='' LIMIT 100")->fetchAll(\PDO::FETCH_ASSOC)) {
            foreach ($rows as $row) {
                $videos = $this->query('SELECT vod_name,vod_sub,vod_en FROM ' . $this->table('vod') . ' WHERE vod_id IN (?,?)', [$row['left_id'], $row['right_id']])->fetchAll(\PDO::FETCH_ASSOC);
                $this->update($row, ['search_text' => self::searchText($videos[0] ?? [], $videos[1] ?? []) ?: '#' . $row['left_id'] . ' #' . $row['right_id']]);
            }
        }
        return (int) $this->query('SELECT COUNT(*) FROM ' . $this->table('vodmerge_case'))->fetchColumn();
    }

    private function signature(array $left, array $right, array $fields): string
    {
        $parts = [];
        foreach ([$left, $right] as $video) {
            foreach ($fields as $field) {
                $parts[] = strtoupper(bin2hex((string) ($video[$field] ?? '')));
            }
        }
        return hash('sha256', implode(':', $parts));
    }

    private function signatureSql(array $fields, array $aliases = ['a', 'b']): string
    {
        $parts = [];
        foreach ($aliases as $alias) {
            foreach ($fields as $field) {
                $parts[] = "HEX(CAST(COALESCE($alias.`$field`,'') AS " . ($this->mysql() ? 'CHAR' : 'TEXT') . '))';
            }
        }
        if ($this->mysql()) {
            return "SHA2(CONCAT_WS(':'," . implode(',', $parts) . '),256)';
        }
        $this->db->sqliteCreateFunction('vm_sha256', static function ($value) { return hash('sha256', $value); }, 1);
        return "vm_sha256(" . implode(" || ':' || ", $parts) . ')';
    }

    private function viewSql(string $filter = ''): string
    {
        $pair = ' FROM ' . $this->table('vod') . ' x JOIN ' . $this->table('vod') . ' y ON y.vod_id=c.right_id WHERE x.vod_id=c.left_id)';
        $identity = '(SELECT ' . $this->signatureSql(self::IDENTITY, ['x', 'y']) . $pair;
        $resources = '(SELECT ' . $this->signatureSql(Playlist::FIELDS, ['x', 'y']) . $pair;
        $facts = 'SELECT ' . self::CASE_FIELDS . 'j.status AS job_status,(a.vod_id IS NULL OR b.vod_id IS NULL) AS missing,'
            . "CASE WHEN c.identity_signature='' THEN 1 ELSE c.identity_signature=$identity END AS identity_fresh,"
            . "CASE WHEN c.resource_signature='' THEN 0 ELSE c.resource_signature=$resources END AS resources_fresh"
            . ' FROM ' . $this->table('vodmerge_case') . ' c LEFT JOIN ' . $this->table('vod') . ' a ON a.vod_id=c.left_id'
            . ' LEFT JOIN ' . $this->table('vod') . ' b ON b.vod_id=c.right_id'
            . ' LEFT JOIN ' . $this->table('vodmerge_job') . ' j ON j.job_id=c.job_id' . $filter;
        return 'SELECT f.*,CASE WHEN missing THEN \'missing\''
            . " WHEN job_status IN ('applying','creating','rolling_back') THEN 'attention'"
            . " WHEN NOT identity_fresh THEN 'pending'"
            . " WHEN (job_status='applied' OR resolution='noop') AND resources_fresh THEN 'done'"
            . ' WHEN snoozed_until>' . time() . " THEN 'snoozed' WHEN decision='different' THEN 'different'"
            . " WHEN decision='needs_info' THEN 'needs_info' WHEN decision='pending' AND assessment='related' AND job_id=0 THEN 'related'"
            . " ELSE 'pending' END AS queue FROM ($facts) f";
    }

    private function plainViewSql(string $filter): string
    {
        return 'SELECT ' . self::CASE_FIELDS . 'NULL AS job_status,(a.vod_id IS NULL OR b.vod_id IS NULL) AS missing,1 AS identity_fresh,0 AS resources_fresh,'
            . "CASE WHEN a.vod_id IS NULL OR b.vod_id IS NULL THEN 'missing' WHEN c.assessment='related' THEN 'related' ELSE 'pending' END AS queue"
            . ' FROM ' . $this->table('vodmerge_case') . ' c LEFT JOIN ' . $this->table('vod') . ' a ON a.vod_id=c.left_id'
            . ' LEFT JOIN ' . $this->table('vod') . ' b ON b.vod_id=c.right_id' . $filter;
    }

    public function cases(string $query = '', string $queue = 'pending', string $assessment = '', int $page = 1): array
    {
        if (!in_array($queue, ['pending', 'needs_info', 'snoozed', 'done', 'different', 'all'], true)
            || !in_array($assessment, ['', 'high', 'probable', 'conflict', 'insufficient', 'related', 'unrated'], true)
            || mb_strlen($query) > 100 || $page < 1 || $page > 100000) {
            throw new \InvalidArgumentException('搜索、筛选或分页参数无效。');
        }
        $where = ' WHERE 1=1';
        $values = [];
        if ($queue !== 'all') {
            $where .= $queue === 'pending' ? " AND queue IN ('pending','attention')" : ' AND queue=?';
            if ($queue !== 'pending') {
                $values[] = $queue;
            }
        }
        if ($assessment !== '') {
            $where .= ' AND assessment=?';
            $values[] = $assessment;
        }
        $numeric = preg_match('/^#?[0-9]{1,10}$/D', trim($query)) === 1;
        $filter = '';
        $sourceValues = [];
        if ($numeric) {
            $filter = ' WHERE (c.left_id=? OR c.right_id=?)';
            $sourceValues = [(int) ltrim(trim($query), '#'), (int) ltrim(trim($query), '#')];
        } elseif (trim($query) !== '') {
            $like = '%' . strtr(trim($query), ['!' => '!!', '%' => '!%', '_' => '!_']) . '%';
            $matches = $this->query('SELECT issue_id FROM ' . $this->table('vodmerge_case') . " WHERE search_text LIKE ? ESCAPE '!' LIMIT 5001", [$like])->fetchAll(\PDO::FETCH_COLUMN);
            if (count($matches) > 5000) {
                throw new \InvalidArgumentException('名称匹配超过 5000 对，请输入更完整的片名、别名或影片 ID。');
            }
            if (!$matches) {
                return ['items' => [], 'total' => 0, 'page' => $page, 'has_more' => false];
            }
            $filter = ' WHERE c.issue_id IN (' . implode(',', array_fill(0, count($matches), '?')) . ')';
            $sourceValues = $matches;
        }
        $values = array_merge($sourceValues, $values);
        $plain = "c.identity_signature='' AND c.job_id=0";
        $reviewed = "(c.identity_signature<>'' OR (c.identity_signature='' AND c.job_id>0))";
        $and = $filter === '' ? ' WHERE ' : ' AND ';
        $plainFrom = ' FROM (' . $this->plainViewSql($filter . $and . '(' . $plain . ')') . ') v' . $where;
        $reviewedFrom = ' FROM (' . $this->viewSql($filter . $and . $reviewed) . ') v' . $where;
        $total = (int) $this->query('SELECT COUNT(*)' . $plainFrom, $values)->fetchColumn()
            + (int) $this->query('SELECT COUNT(*)' . $reviewedFrom, $values)->fetchColumn();
        $limit = $page * 30;
        $order = " ORDER BY CASE WHEN queue='attention' THEN 1 ELSE 0 END DESC,priority DESC,issue_id DESC";
        $plainPage = 'SELECT *' . $plainFrom . ' ORDER BY priority DESC,issue_id DESC LIMIT ' . $limit;
        $reviewedPage = 'SELECT *' . $reviewedFrom . $order . ' LIMIT ' . $limit;
        $union = 'SELECT * FROM (' . $plainPage . ') plain_page UNION ALL SELECT * FROM (' . $reviewedPage . ') reviewed_page';
        $rows = $this->query('SELECT * FROM (' . $union . ') merged_page' . $order . ' LIMIT 30 OFFSET ' . (($page - 1) * 30), array_merge($values, $values))->fetchAll(\PDO::FETCH_ASSOC);
        $items = [];
        $ids = [];
        foreach ($rows as $row) {
            $ids[] = (int) $row['left_id'];
            $ids[] = (int) $row['right_id'];
        }
        $metadata = $ids ? $this->query('SELECT vod_id,vod_name,vod_year FROM ' . $this->table('vod') . ' WHERE vod_id IN (' . implode(',', array_fill(0, count($ids), '?')) . ')', $ids)->fetchAll(\PDO::FETCH_UNIQUE | \PDO::FETCH_ASSOC) : [];
        foreach ($rows as $row) {
            $row['left_name'] = $metadata[(int) $row['left_id']]['vod_name'] ?? '';
            $row['right_name'] = $metadata[(int) $row['right_id']]['vod_name'] ?? '';
            $row['left_year'] = $metadata[(int) $row['left_id']]['vod_year'] ?? '';
            $row['right_year'] = $metadata[(int) $row['right_id']]['vod_year'] ?? '';
            $items[] = array_intersect_key($row, array_flip(['issue_id', 'left_id', 'right_id', 'left_name', 'right_name', 'left_year', 'right_year', 'assessment', 'priority', 'decision', 'queue', 'job_status', 'identity_fresh', 'resources_fresh', 'reason', 'reviewed_at', 'snoozed_until']));
        }
        return ['items' => $items, 'total' => $total, 'page' => $page, 'has_more' => $page * 30 < $total];
    }

    private function caseRow(int $issueId): array
    {
        $row = $this->query('SELECT c.* FROM ' . $this->table('vodmerge_case') . ' c JOIN ' . $this->table('vodmerge_audit_issue')
            . ' i ON i.left_id=c.left_id AND i.right_id=c.right_id WHERE i.issue_id=?', [$issueId])->fetch(\PDO::FETCH_ASSOC);
        if (!$row) {
            throw new \RuntimeException('审核项目不存在，请刷新列表。');
        }
        return $row;
    }

    private function videos(array $case): array
    {
        $rows = $this->query('SELECT * FROM ' . $this->table('vod') . ' WHERE vod_id IN (?,?)', [$case['left_id'], $case['right_id']])->fetchAll(\PDO::FETCH_UNIQUE | \PDO::FETCH_ASSOC);
        return [$rows[(int) $case['left_id']] ?? [], $rows[(int) $case['right_id']] ?? []];
    }

    private function update(array $case, array $values): void
    {
        $set = implode(',', array_map(static function ($key) { return '`' . $key . '`=?'; }, array_keys($values)));
        $this->query('UPDATE ' . $this->table('vodmerge_case') . ' SET ' . $set . ' WHERE left_id=? AND right_id=?', array_merge(array_values($values), [$case['left_id'], $case['right_id']]));
    }

    private function event(array $case, string $kind, int $actor, int $jobId = 0, array $detail = [], string $key = ''): void
    {
        $this->query(($this->mysql() ? 'INSERT IGNORE' : 'INSERT OR IGNORE') . ' INTO ' . $this->table('vodmerge_event')
            . ' (left_id,right_id,kind,actor_id,job_id,detail_json,event_key,created_at) VALUES (?,?,?,?,?,?,?,?)',
            [$case['left_id'], $case['right_id'], $kind, $actor, $jobId, Payload::json($detail), $key ?: bin2hex(random_bytes(16)), time()]);
    }

    public static function resources(array $video): array
    {
        $lines = [];
        foreach (Playlist::groups($video) as $slot => $group) {
            $names = [];
            foreach (explode('#', rtrim($group['vod_play_url'], '#')) as $entry) {
                $parts = explode('$', $entry, 2);
                $names[] = count($parts) === 2 && !preg_match('~https?://~i', $parts[0]) ? $parts[0] : '未命名播放条目';
            }
            $lines[] = ['slot' => $slot, 'player' => $group['vod_play_from'], 'count' => count($names), 'names' => $names];
        }
        return $lines;
    }

    public function detail(int $issueId): array
    {
        $case = $this->caseRow($issueId);
        [$left, $right] = $this->videos($case);
        $issue = $this->query('SELECT detail_json FROM ' . $this->table('vodmerge_audit_issue') . ' WHERE issue_id=?', [$case['issue_id']])->fetchColumn();
        $old = json_decode($issue, true) ?: [];
        $current = $this->query('SELECT * FROM (' . $this->viewSql(' WHERE c.left_id=? AND c.right_id=?') . ') v', [$case['left_id'], $case['right_id']])->fetch(\PDO::FETCH_ASSOC);
        $resourceError = '';
        try {
            $leftLines = self::resources($left);
            $rightLines = self::resources($right);
        } catch (\Throwable $error) {
            $leftLines = $rightLines = [];
            $resourceError = '播放资源格式需先在视频管理中核对，暂不能生成资源预览。';
        }
        $review = $old['ai_review'] ?? null;
        if ($review) {
            $review = array_intersect_key($review, array_flip(['status', 'judgment', 'model', 'reviewed_at', 'elapsed_ms', 'reused']));
            $review['stale'] = $this->signature($left, $right, self::IDENTITY) !== $this->signature($old['ai_review']['left'] ?? [], $old['ai_review']['right'] ?? [], self::IDENTITY);
        }
        $job = $this->service->libraryStatus((int) $case['issue_id'])['job'];
        return ['issue_id' => (int) $case['issue_id'], 'left_id' => (int) $case['left_id'], 'right_id' => (int) $case['right_id'],
            'left' => Payload::metadata($left), 'right' => Payload::metadata($right), 'left_lines' => $leftLines, 'right_lines' => $rightLines,
            'left_seasons' => Payload::identity($left)['seasons'], 'right_seasons' => Payload::identity($right)['seasons'],
            'fingerprint' => $this->signature($left, $right, self::IDENTITY), 'missing' => !$left || !$right, 'resource_error' => $resourceError,
            'rule' => AuditMatch::assess($left, $right), 'rule_stale' => $this->signature($left, $right, self::IDENTITY) !== $this->signature($old['left'] ?? [], $old['right'] ?? [], self::IDENTITY),
            'decision' => $case['decision'], 'reason' => $case['reason'], 'reviewed_at' => (int) $case['reviewed_at'], 'actor_id' => (int) $case['actor_id'],
            'identity_fresh' => (bool) $current['identity_fresh'], 'queue' => $current['queue'], 'job' => $job, 'ai_review' => $review,
            'events' => $this->history(1, (int) $case['left_id'], (int) $case['right_id'])['items']];
    }

    public function decide(int $issueId, string $decision, string $fingerprint, string $reason, int $actor): array
    {
        if (!in_array($decision, ['same', 'different', 'needs_info', 'snooze', 'restore'], true) || mb_strlen($reason) > 200 || !preg_match('/^[a-f0-9]{64}$/D', $fingerprint)) {
            throw new \InvalidArgumentException('人工结论或当前资料凭据无效。');
        }
        return $this->locked(function () use ($issueId, $decision, $fingerprint, $reason, $actor) {
            $case = $this->caseRow($issueId);
            [$left, $right] = $this->videos($case);
            if (!$left || !$right || !hash_equals($this->signature($left, $right, self::IDENTITY), $fingerprint)) {
                throw new \RuntimeException('影片资料已变化或记录不存在，请重新读取后审核。');
            }
            $job = $this->service->libraryStatus((int) $case['issue_id'])['job'];
            if ($job && in_array($job['status'], ['applying', 'creating', 'rolling_back'], true)) {
                throw new \RuntimeException('先核验未完成的资源操作，再更改审核结论。');
            }
            if ($job && $job['status'] === 'applied' && in_array($decision, ['different', 'needs_info'], true)) {
                throw new \RuntimeException('此对影片已有资源补充记录，请先核对并按条件回滚，再更改身份结论。');
            }
            $value = in_array($decision, ['snooze', 'restore'], true) ? $case['decision'] : $decision;
            if ($decision === 'restore' && ($value === 'needs_info' || $case['identity_signature'] !== $fingerprint)) {
                $value = 'pending';
            }
            $this->db->beginTransaction();
            try {
                $this->update($case, ['decision' => $value, 'identity_signature' => $fingerprint, 'reason' => $reason,
                    'search_text' => self::searchText($left, $right),
                    'actor_id' => $actor, 'reviewed_at' => time(), 'snoozed_until' => $decision === 'snooze' ? time() + 604800 : 0,
                    'resolution' => in_array($decision, ['different', 'needs_info'], true) ? '' : $case['resolution']]);
                $this->event($case, $decision, $actor, 0, ['reason' => $reason]);
                $this->db->commit();
            } catch (\Throwable $error) {
                $this->db->rollBack();
                throw $error;
            }
            return $this->detail($issueId);
        });
    }

    public function resourceAction(int $issueId, string $operation, int $actor, int $target = 0, bool $separate = false, int $jobId = 0, string $token = ''): array
    {
        return $this->locked(function () use ($issueId, $operation, $actor, $target, $separate, $jobId, $token) {
            $case = $this->caseRow($issueId);
            $current = $this->detail($issueId);
            if (in_array($operation, ['merge_preview', 'merge_apply', 'no_change'], true)
                && ($case['decision'] !== 'same' || !$current['identity_fresh'] || $current['missing'])) {
                throw new \RuntimeException('请先对当前资料确认同片，再预览与处理资源。');
            }
            $oldJob = $current['job'];
            if ($operation === 'merge_preview') {
                if ($current['queue'] === 'done') {
                    throw new \RuntimeException('当前资源已处理，资源变化后再生成新预览。');
                }
                $result = $this->service->libraryPreview((int) $case['issue_id'], $target, $separate, true);
            } else {
                if (!$oldJob || (int) $oldJob['job_id'] !== $jobId) {
                    throw new \RuntimeException('资源记录已变化，请刷新核验。');
                }
                if (in_array($operation, ['merge_apply', 'no_change'], true) && (int) $case['job_id'] !== $jobId) {
                    throw new \RuntimeException('请在新版待处理入口重新生成预览，再确认资源变化。');
                }
                if ($operation === 'merge_apply') {
                    $result = $this->service->libraryApply((int) $case['issue_id'], $jobId, $token, $actor);
                } elseif ($operation === 'merge_rollback') {
                    $result = $this->service->libraryRollback((int) $case['issue_id'], $jobId, $actor);
                } elseif ($operation === 'merge_recover') {
                    $result = $this->service->libraryRecover((int) $case['issue_id'], $jobId);
                } elseif ($operation === 'no_change') {
                    $raw = $this->query('SELECT * FROM ' . $this->table('vodmerge_job') . ' WHERE job_id=?', [$jobId])->fetch(\PDO::FETCH_ASSOC);
                    $plan = json_decode($raw['plan_json'], true);
                    if ($raw['status'] !== 'ready' || !$token || !hash_equals($raw['preview_token'], $token) || (int) $raw['preview_until'] < time()
                        || (int) $plan['added_groups'] !== 0 || (int) $plan['added_episodes'] !== 0) {
                        throw new \RuntimeException('需要有效且无资源变化的预览，才能记录无需写入。');
                    }
                    [$left, $right] = $this->videos($case);
                    $source = (int) $oldJob['library']['source_vod_id'] === (int) $case['left_id'] ? $left : $right;
                    $targetVideo = (int) $oldJob['library']['target_vod_id'] === (int) $case['left_id'] ? $left : $right;
                    foreach ([[$source, $plan['library_source_before']], [$targetVideo, $plan['before']]] as $pair) {
                        foreach ($pair[1] as $field => $expected) {
                            if ((string) ($pair[0][$field] ?? '') !== (string) $expected) {
                                throw new \RuntimeException('资源或资料已变化，请重新生成预览。');
                            }
                        }
                    }
                    $this->update($case, ['resource_signature' => $this->signature($left, $right, Playlist::FIELDS), 'resolution' => 'noop', 'job_id' => $jobId]);
                    $this->query("UPDATE " . $this->table('vodmerge_job') . " SET status='review',preview_token='',preview_until=0,message=?,updated_at=? WHERE job_id=?", ['人工核对完成，无需资源写入。', time(), $jobId]);
                    $this->event($case, 'no_change', $actor, $jobId, [], 'job:' . $jobId . ':no_change');
                    return $this->detail($issueId);
                } else {
                    throw new \InvalidArgumentException('未知资源操作。');
                }
            }
            $job = $result['job'];
            $this->update($case, ['job_id' => $job['job_id'], 'resolution' => '']);
            if ($operation === 'merge_preview') {
                $plan = json_decode($this->query('SELECT plan_json FROM ' . $this->table('vodmerge_job') . ' WHERE job_id=?', [$job['job_id']])->fetchColumn(), true);
                $left = (int) $job['library']['source_vod_id'] === (int) $case['left_id'] ? $plan['library_source_before'] : $plan['after'];
                $right = (int) $job['library']['source_vod_id'] === (int) $case['right_id'] ? $plan['library_source_before'] : $plan['after'];
                $this->update($case, ['resource_signature' => $this->signature($left, $right, Playlist::FIELDS)]);
            }
            $this->event($case, $operation, $actor, (int) $job['job_id'], [], 'job:' . $job['job_id'] . ':' . $operation . ($operation === 'merge_preview' ? ':' . substr(hash('sha256', $job['preview_token']), 0, 16) : ''));
            return $this->detail($issueId);
        });
    }

    public function importJobs(): int
    {
        $jobs = $this->query('SELECT * FROM ' . $this->table('vodmerge_job') . " WHERE source_key='vodmerge-library' ORDER BY job_id")->fetchAll(\PDO::FETCH_ASSOC);
        foreach ($jobs as $job) {
            $marker = json_decode($job['review_json'] ?? '', true)['library'] ?? [];
            if (empty($marker['issue_id'])) {
                continue;
            }
            $case = $this->caseRow((int) $marker['issue_id']);
            if ((int) $case['job_id'] > (int) $job['job_id']) {
                continue;
            }
            $this->update($case, ['job_id' => $job['job_id']]);
            if ($job['status'] === 'applied' && $case['resource_signature'] === '') {
                [$left, $right] = $this->videos($case);
                $plan = json_decode($job['plan_json'], true);
                $source = (int) $marker['source_vod_id'] === (int) $case['left_id'] ? $left : $right;
                $target = (int) $marker['target_vod_id'] === (int) $case['left_id'] ? $left : $right;
                $matches = !empty($plan['after']) && !empty($plan['library_source_before']);
                foreach ([[$source, $plan['library_source_before'] ?? []], [$target, $plan['after'] ?? []]] as $pair) {
                    foreach ($pair[1] as $field => $value) {
                        $matches = $matches && (string) ($pair[0][$field] ?? '') === (string) $value;
                    }
                }
                if ($matches) {
                    $this->update($case, ['resource_signature' => $this->signature($left, $right, Playlist::FIELDS), 'identity_signature' => $this->signature($left, $right, self::IDENTITY)]);
                }
            }
        }
        return count($jobs);
    }

    public function history(int $page = 1, int $left = 0, int $right = 0): array
    {
        if ($page < 1 || $page > 100000) {
            throw new \InvalidArgumentException('记录页码无效。');
        }
        $where = $left && $right ? ' WHERE left_id=? AND right_id=?' : '';
        $values = $where ? [min($left, $right), max($left, $right)] : [];
        $total = (int) $this->query('SELECT COUNT(*) FROM ' . $this->table('vodmerge_event') . $where, $values)->fetchColumn();
        $events = $this->query('SELECT event_id,left_id,right_id,kind,actor_id,job_id,detail_json,created_at FROM ' . $this->table('vodmerge_event') . $where . ' ORDER BY event_id DESC LIMIT 30 OFFSET ' . (($page - 1) * 30), $values)->fetchAll(\PDO::FETCH_ASSOC);
        foreach ($events as &$event) {
            $event['detail'] = json_decode($event['detail_json'], true) ?: [];
            unset($event['detail_json']);
            $case = $this->query('SELECT issue_id FROM ' . $this->table('vodmerge_case') . ' WHERE left_id=? AND right_id=?', [$event['left_id'], $event['right_id']])->fetchColumn();
            $event['issue_id'] = (int) $case;
        }
        unset($event);
        $jobWhere = $left && $right ? " AND ((source_id=? AND vod_id=?) OR (source_id=? AND vod_id=?))" : '';
        $jobs = $this->query('SELECT job_id,source_key,source_id,vod_id,status,operator_id,created_at,updated_at FROM ' . $this->table('vodmerge_job') . " WHERE 1=1" . $jobWhere . ' ORDER BY job_id DESC LIMIT 30 OFFSET ' . (($page - 1) * 30), $jobWhere ? [(string) $left, $right, (string) $right, $left] : [])->fetchAll(\PDO::FETCH_ASSOC);
        foreach ($jobs as &$job) {
            $detail = $this->service->detail((int) $job['job_id']);
            $job['title'] = $detail['video']['vod_name'] ?? '';
            $job['library'] = $detail['library'] ?? null;
            $job['plan'] = $detail['plan'];
        }
        unset($job);
        return ['items' => $events, 'jobs' => $jobs, 'total' => $total, 'page' => $page, 'has_more' => $page * 30 < $total || count($jobs) === 30];
    }
}
