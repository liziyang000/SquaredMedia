<?php

namespace think {
    class Db
    {
        public static $tables = [];
        public static $columns = [];
        public static $beforeUpdate = null;

        public static function name($name)
        {
            return new DoubanWorkerQuery($name);
        }

        public static function query($sql, $bind = [])
        {
            if (strpos($sql, 'information_schema.COLUMNS') !== false) {
                $table = (string) ($bind[0] ?? '');
                $column = (string) ($bind[1] ?? '');
                return in_array($column, self::$columns[$table] ?? [], true)
                    ? [['COLUMN_NAME' => $column]]
                    : [];
            }
            return [];
        }

        public static function execute($sql, $bind = [])
        {
            return 0;
        }

        public static function startTrans()
        {
        }

        public static function commit()
        {
        }

        public static function rollback()
        {
        }
    }

    class DoubanWorkerQuery
    {
        private $table;
        private $where = [];
        private $whereIn = [];
        private $limit = 0;

        public function __construct($table)
        {
            $this->table = $table;
        }

        public function where($field, $operator = null, $value = null)
        {
            $this->where[] = func_num_args() === 2
                ? [$field, '=', $operator]
                : [$field, $operator, $value];
            return $this;
        }

        public function whereIn($field, $values)
        {
            $this->whereIn[] = [$field, $values];
            return $this;
        }

        public function whereLike($field, $value)
        {
            $this->where[] = [$field, 'like', $value];
            return $this;
        }

        public function field($fields)
        {
            return $this;
        }

        public function group($fields)
        {
            return $this;
        }

        public function order($order)
        {
            return $this;
        }

        public function limit($limit)
        {
            $this->limit = (int) $limit;
            return $this;
        }

        public function lock($lock)
        {
            return $this;
        }

        public function select()
        {
            $rows = $this->rows();
            return $this->limit > 0 ? array_slice($rows, 0, $this->limit) : $rows;
        }

        public function find()
        {
            $rows = $this->rows();
            return $rows[0] ?? null;
        }

        public function update(array $data)
        {
            if (is_callable(Db::$beforeUpdate)) {
                $callback = Db::$beforeUpdate;
                if ($callback($this->table, $this->where, $data) !== false) {
                    Db::$beforeUpdate = null;
                }
            }
            $updated = 0;
            foreach (Db::$tables[$this->table] ?? [] as $index => $row) {
                if (!$this->matches($row)) {
                    continue;
                }
                Db::$tables[$this->table][$index] = array_merge($row, $data);
                $updated++;
            }
            return $updated;
        }

        public function insert(array $data)
        {
            Db::$tables[$this->table][] = $data;
            return 1;
        }

        public function insertGetId(array $data)
        {
            $primaryKey = $this->table === 'douban_scan'
                ? 'scan_id'
                : ($this->table === 'douban_log' ? 'log_id' : 'id');
            $ids = array_map(static function ($row) use ($primaryKey) {
                return (int) ($row[$primaryKey] ?? 0);
            }, Db::$tables[$this->table] ?? []);
            $id = empty($ids) ? 1 : max($ids) + 1;
            $data[$primaryKey] = $id;
            Db::$tables[$this->table][] = $data;
            return $id;
        }

        public function insertAll(array $rows)
        {
            foreach ($rows as $row) {
                if ($this->table === 'douban_scan_issue' && empty($row['issue_id'])) {
                    $ids = array_map(static function ($existing) {
                        return (int) ($existing['issue_id'] ?? 0);
                    }, Db::$tables[$this->table] ?? []);
                    $row['issue_id'] = empty($ids) ? 1 : max($ids) + 1;
                }
                Db::$tables[$this->table][] = $row;
            }
            return count($rows);
        }

        public function count()
        {
            return count($this->rows());
        }

        public function max($field)
        {
            $values = array_map(static function ($row) use ($field) {
                return (int) ($row[$field] ?? 0);
            }, $this->rows());
            return empty($values) ? 0 : max($values);
        }

        public function delete()
        {
            $deleted = 0;
            foreach (Db::$tables[$this->table] ?? [] as $index => $row) {
                if (!$this->matches($row)) {
                    continue;
                }
                unset(Db::$tables[$this->table][$index]);
                $deleted++;
            }
            Db::$tables[$this->table] = array_values(Db::$tables[$this->table] ?? []);
            return $deleted;
        }

        private function rows()
        {
            return array_values(array_filter(Db::$tables[$this->table] ?? [], function ($row) {
                return $this->matches($row);
            }));
        }

        private function matches(array $row)
        {
            foreach ($this->where as [$field, $operator, $expected]) {
                $actual = $row[$field] ?? null;
                if ($operator === '=' && (string) $actual !== (string) $expected) {
                    return false;
                }
                if ($operator === '<>' && (string) $actual === (string) $expected) {
                    return false;
                }
                if ($operator === '<' && !($actual < $expected)) {
                    return false;
                }
                if ($operator === '<=' && !($actual <= $expected)) {
                    return false;
                }
                if ($operator === '>' && !($actual > $expected)) {
                    return false;
                }
                if ($operator === 'like') {
                    $needle = trim((string) $expected, '%');
                    if ($needle !== '' && strpos((string) $actual, $needle) === false) {
                        return false;
                    }
                }
            }
            foreach ($this->whereIn as [$field, $values]) {
                if (!in_array($row[$field] ?? null, $values, true)) {
                    return false;
                }
            }
            return true;
        }
    }
}

namespace app\common\util {
    class AiProvider
    {
        public static $calls = [];
        public static $response = [
            'code' => 1,
            'text' => '{"douban_id":"222","confidence":96,"reason":"候选别名与本地信息一致"}',
        ];

        public static function chat($config, $systemPrompt, $userPrompt)
        {
            self::$calls[] = [$config, $systemPrompt, $userPrompt];

            return self::$response;
        }
    }
}

namespace addons\vodops\service {
    class DoubanGateway
    {
        public static $subjectCalls = [];
        public static $subjectResponses = [];
        public static $searchCalls = [];
        public static $searchResponses = [];

        public static function subject(string $doubanId): array
        {
            self::$subjectCalls[] = $doubanId;
            if (isset(self::$subjectResponses[$doubanId])) {
                return self::$subjectResponses[$doubanId];
            }
            return [
                'vod_douban_id' => $doubanId,
                'vod_douban_score' => '9.4',
                'vod_score' => '9.4',
                'vod_pic' => 'https://img.example/douban.jpg',
            ];
        }

        public static function search(string $query, int $limit = 5): array
        {
            self::$searchCalls[] = [$query, $limit];
            if (isset(self::$searchResponses[$query])) {
                return self::$searchResponses[$query];
            }
            return [[
                'douban_id' => '1292052',
                'title' => $query,
                'year' => '1994',
            ]];
        }
    }
}

namespace {
    use addons\vodops\service\DoubanData;
    use addons\vodops\service\DoubanGateway;
    use app\common\util\AiProvider;
    use think\Db;

    function cache($key, $value = null, $ttl = null)
    {
        return null;
    }

    function config($name)
    {
        if ($name === 'maccms.ai_search') {
            return [
                'enabled' => '1',
                'provider' => 'openai',
                'model' => 'deepseek-chat',
                'api_base' => 'https://api.example.test/v1',
                'api_key' => 'test-key',
                'timeout' => '12',
            ];
        }

        return null;
    }

    require dirname(__DIR__) . '/addons/vodops/service/DoubanMatcher.php';
    require dirname(__DIR__) . '/addons/vodops/service/DoubanAiReviewer.php';
    require dirname(__DIR__) . '/addons/vodops/service/DoubanActionException.php';
    require dirname(__DIR__) . '/addons/vodops/service/DoubanData.php';

    $fail = static function ($message) {
        fwrite(STDERR, $message . PHP_EOL);
        exit(1);
    };
    $assertSame = static function ($expected, $actual, $message) use ($fail) {
        if ($expected !== $actual) {
            $fail($message . ': expected ' . var_export($expected, true) . ', got ' . var_export($actual, true));
        }
    };
    $task = static function ($taskId) {
        foreach (Db::$tables['douban_task'] as $row) {
            if ((int) $row['task_id'] === $taskId) {
                return $row;
            }
        }
        return [];
    };

    Db::$tables = [
        'douban_config' => [
            ['config_key' => 'request_per_minute', 'config_value' => '30'],
            ['config_key' => 'max_attempts', 'config_value' => '5'],
            ['config_key' => 'rate_limit_next_at', 'config_value' => '0', 'updated_at' => 0],
        ],
        'douban_task' => [[
            'task_id' => 1,
            'vod_id' => 100,
            'task_type' => 'SYNC_DOUBAN',
            'status' => 'PENDING',
            'priority' => 10,
            'run_after' => 0,
            'attempts' => 4,
            'last_error' => '',
            'payload' => '{}',
            'created_at' => 1,
            'updated_at' => 1,
        ]],
        'douban_vod_meta' => [[
            'vod_id' => 100,
            'douban_next_sync_at' => 0,
            'updated_at' => 0,
        ]],
        'douban_log' => [],
        'vod' => [],
    ];

    $failed = DoubanData::runPending(1);
    $assertSame(1, $failed['failed'], 'The fifth failed attempt should be terminal');
    $assertSame(0, $failed['retrying'], 'A terminal failure should not remain retrying');
    $assertSame('FAILED', $task(1)['status'] ?? '', 'The task should enter FAILED');
    $assertSame(5, $task(1)['attempts'] ?? 0, 'The claim should increment the attempt counter');
    $assertSame(0, $task(1)['run_after'] ?? -1, 'A terminal task should not retain a retry time');
    $assertSame(2147483647, Db::$tables['douban_vod_meta'][0]['douban_next_sync_at'] ?? 0, 'Terminal failures should leave the due queue');

    Db::$tables['douban_task'][] = [
        'task_id' => 2,
        'vod_id' => 200,
        'task_type' => 'UNKNOWN',
        'status' => 'RUNNING',
        'priority' => 1,
        'run_after' => 0,
        'attempts' => 1,
        'last_error' => '',
        'payload' => '{}',
        'created_at' => 1,
        'updated_at' => time() - 3600,
    ];
    $recovered = DoubanData::runPending(1);
    $assertSame(1, $recovered['recovered'], 'Expired RUNNING tasks should be recovered');
    $assertSame(1, $recovered['skipped'], 'The recovered unknown task should be safely skipped');
    $assertSame('SKIP', $task(2)['status'] ?? '', 'Recovered tasks should continue through the normal state machine');

    $retried = DoubanData::retryFailed(10, 9);
    $assertSame(1, $retried['requeued'], 'The failed task should be manually requeued');
    $assertSame('PENDING', $task(1)['status'] ?? '', 'Manual retry should restore PENDING');
    $assertSame(0, $task(1)['attempts'] ?? -1, 'Manual retry should reset attempts');

    Db::$tables['douban_task'][] = array_merge($task(1), [
        'task_id' => 3,
        'status' => 'FAILED',
        'attempts' => 5,
    ]);
    $duplicateRetry = DoubanData::retryFailed(10, 9);
    $assertSame(0, $duplicateRetry['requeued'], 'A failed duplicate should not be requeued beside an active task');
    $assertSame(1, $duplicateRetry['skipped'], 'The active task conflict should be reported as skipped');
    $assertSame('FAILED', $task(3)['status'] ?? '', 'Skipped duplicate failures should stay inspectable');

    Db::$tables['vodops_lock'] = [['lock_name' => 'douban_enqueue']];
    $emptyEnqueue = DoubanData::enqueueDue(1, 9);
    $assertSame(0, $emptyEnqueue['created'] ?? -1, 'An empty due queue should still pass through the enqueue mutex');
    Db::$tables['vodops_lock'] = [];
    $missingEnqueueLockRejected = false;
    try {
        DoubanData::enqueueDue(1, 9);
    } catch (\addons\vodops\service\DoubanActionException $e) {
        $missingEnqueueLockRejected = $e->getMessage() === '任务队列协调锁未初始化，请重新执行插件 install.sql';
    }
    $assertSame(true, $missingEnqueueLockRejected, 'Task generation should stop when its transactional mutex is unavailable');

    $reserveMethod = new \ReflectionMethod(DoubanData::class, 'reserveRequestSlot');
    $reserveMethod->setAccessible(true);
    $firstSlot = $reserveMethod->invoke(null, 2.0);
    $secondSlot = $reserveMethod->invoke(null, 2.0);
    if ($secondSlot < $firstSlot + 1.999) {
        $fail('Shared rate-limit reservations should not overlap');
    }
    $failureMessageMethod = new \ReflectionMethod(DoubanData::class, 'failureMessage');
    $failureMessageMethod->setAccessible(true);
    $assertSame(
        '任务执行失败，请查看服务端日志',
        $failureMessageMethod->invoke(null, new \RuntimeException('SQLSTATE[42S02] private table name'), '任务执行失败，请查看服务端日志'),
        'Unexpected worker failures must not expose database details in task state'
    );
    $assertSame(
        '影片不存在',
        $failureMessageMethod->invoke(null, new \addons\vodops\service\DoubanActionException('影片不存在'), '任务执行失败，请查看服务端日志'),
        'Expected worker failures should remain actionable'
    );

    Db::$tables = [
        'douban_config' => [
            ['config_key' => 'request_per_minute', 'config_value' => '30'],
            ['config_key' => 'max_attempts', 'config_value' => '5'],
            ['config_key' => 'rate_limit_next_at', 'config_value' => '0', 'updated_at' => 0],
        ],
        'douban_task' => [[
            'task_id' => 4,
            'vod_id' => 300,
            'task_type' => 'SYNC_DOUBAN',
            'status' => 'PENDING',
            'priority' => 10,
            'run_after' => 0,
            'attempts' => 0,
            'last_error' => '',
            'payload' => '{}',
            'created_at' => 1,
            'updated_at' => 1,
        ]],
        'douban_vod_meta' => [[
            'vod_id' => 300,
            'douban_ignore_until' => time() + 86400,
            'updated_at' => 1,
        ]],
        'douban_log' => [],
        'vod' => [[
            'vod_id' => 300,
            'vod_name' => '已忽略影片',
            'vod_douban_id' => '1295644',
        ]],
    ];

    $ignored = DoubanData::runPending(1);
    $assertSame(1, $ignored['skipped'], 'Workers should skip tasks whose video is currently ignored');
    $assertSame(0, $ignored['retrying'], 'Ignored tasks should not fail and enter retry backoff');
    $assertSame('SKIP', $task(4)['status'] ?? '', 'Ignored tasks should reach the SKIP terminal state');

    Db::$tables['douban_task'][] = [
        'task_id' => 5,
        'vod_id' => 400,
        'task_type' => 'MATCH_DOUBAN_ID',
        'status' => 'PENDING',
        'priority' => 5,
        'run_after' => 0,
        'attempts' => 0,
        'last_error' => '',
        'payload' => '{}',
        'created_at' => 1,
        'updated_at' => 1,
    ];
    Db::$tables['vod'][] = [
        'vod_id' => 400,
        'vod_name' => '刚刚忽略的影片',
    ];

    DoubanData::ignore(400, 30, 9);
    $assertSame('SKIP', $task(5)['status'] ?? '', 'Ignoring a video should immediately skip its pending tasks');

    Db::$tables['vodops_lock'] = [['lock_name' => 'douban_enqueue']];
    $restored = DoubanData::restoreIgnored(400, 9);
    $restoredTasks = array_values(array_filter(Db::$tables['douban_task'], static function ($row) {
        return (int) ($row['vod_id'] ?? 0) === 400;
    }));
    $restoredPending = array_values(array_filter($restoredTasks, static function ($row) {
        return ($row['status'] ?? '') === 'PENDING';
    }));
    $assertSame(1, $restored['created_task'] ?? 0, 'Restoring an ignored video should enqueue one fresh task');
    $assertSame('SKIP', $task(5)['status'] ?? '', 'Restoring must preserve the ignored task as audit history');
    $assertSame(1, count($restoredPending), 'Restoring should create exactly one pending replacement task');
    $assertSame('MATCH_DOUBAN_ID', $restoredPending[0]['task_type'] ?? '', 'A restored video without an ID should enqueue matching');

    DoubanData::ignore(400, 30, 9);
    Db::$tables['douban_task'][] = [
        'task_id' => 6,
        'vod_id' => 400,
        'task_type' => 'MATCH_DOUBAN_ID',
        'status' => 'RUNNING',
        'priority' => 5,
        'run_after' => 0,
        'attempts' => 1,
        'last_error' => '',
        'payload' => '{}',
        'created_at' => 1,
        'updated_at' => time(),
    ];
    $deduplicatedRestore = DoubanData::restoreIgnored(400, 9);
    $assertSame(0, $deduplicatedRestore['created_task'] ?? -1, 'Restoring must not duplicate an active task for the same video and type');

    Db::$tables = [
        'douban_config' => [
            ['config_key' => 'request_per_minute', 'config_value' => '300'],
            ['config_key' => 'max_attempts', 'config_value' => '5'],
            ['config_key' => 'rate_limit_next_at', 'config_value' => '0', 'updated_at' => 0],
        ],
        'douban_task' => [],
        'douban_vod_meta' => [[
            'vod_id' => 500,
            'douban_id' => '1295644',
            'douban_id_locked' => 0,
            'intro_locked' => 0,
            'douban_id_source' => 'manual',
        ]],
        'douban_review_candidate' => [],
        'douban_log' => [],
        'vod' => [
            ['vod_id' => 500, 'vod_name' => '已有豆瓣ID影片', 'vod_year' => '1994', 'vod_pic' => '/upload/existing-500.jpg'],
            ['vod_id' => 501, 'vod_name' => '待匹配影片', 'vod_year' => '1994', 'vod_pic' => '/upload/existing-501.jpg'],
        ],
    ];
    Db::$columns = [
        'vod' => ['vod_pic', 'vod_douban_id', 'vod_douban_score', 'vod_score', 'vod_area', 'vod_lang'],
    ];
    DoubanGateway::$subjectCalls = [];
    DoubanGateway::$subjectResponses = [];
    DoubanGateway::$searchCalls = [];
    DoubanGateway::$searchResponses = [];
    AiProvider::$calls = [];

    $syncedVod = DoubanData::fetchVod(500, 9);
    $assertSame(1, $syncedVod['code'] ?? 0, 'A specified video with a Douban ID should sync immediately');
    $assertSame(['1295644'], DoubanGateway::$subjectCalls, 'Existing Douban IDs should use the subject endpoint');
    $assertSame([], DoubanGateway::$searchCalls, 'Existing Douban IDs should not trigger candidate search');
    $assertSame('/upload/existing-500.jpg', Db::$tables['vod'][0]['vod_pic'] ?? '', 'Direct sync should preserve the existing picture');
    $assertSame(false, in_array('vod_pic', $syncedVod['updated_fields'] ?? [], true), 'Direct sync should not report a picture update');
    $assertSame(false, in_array('vod_pic', array_column($syncedVod['changes'] ?? [], 'field'), true), 'Direct sync changes should not contain a picture');
    $syncLogs = array_values(array_filter(Db::$tables['douban_log'], static function ($row) {
        return (int) ($row['vod_id'] ?? 0) === 500;
    }));
    $assertSame('AUTO_SYNC', end($syncLogs)['action'] ?? '', 'A successful source write should finalize its pre-write audit record');

    Db::$tables['douban_vod_meta'][] = [
        'vod_id' => 506,
        'douban_id' => '1290506',
        'douban_id_locked' => 0,
        'intro_locked' => 0,
        'douban_id_source' => 'manual',
    ];
    Db::$tables['vod'][] = [
        'vod_id' => 506,
        'vod_name' => '同步状态异常影片',
        'vod_douban_score' => '0.0',
        'vod_score' => '0.0',
    ];
    DoubanGateway::$subjectResponses['1290506'] = [
        'vod_douban_id' => '1290506',
        'vod_douban_score' => '8.2',
        'vod_score' => '8.2',
    ];
    Db::$beforeUpdate = static function ($table) {
        if ($table !== 'douban_vod_meta') {
            return false;
        }
        Db::$beforeUpdate = null;
        throw new \RuntimeException('SQLSTATE metadata write failed');
    };
    try {
        DoubanData::fetchVod(506, 9);
    } catch (\RuntimeException $e) {
    }
    $partialSyncLogs = array_values(array_filter(Db::$tables['douban_log'], static function ($row) {
        return (int) ($row['vod_id'] ?? 0) === 506;
    }));
    $assertSame('AUTO_SYNC_PENDING', end($partialSyncLogs)['action'] ?? '', 'A sync must not be marked successful before its metadata state is saved');

    Db::$tables['douban_vod_meta'][] = [
        'vod_id' => 505,
        'douban_id' => '1290505',
        'douban_id_locked' => 0,
        'intro_locked' => 0,
        'douban_id_source' => 'manual',
    ];
    Db::$tables['vod'][] = [
        'vod_id' => 505,
        'vod_name' => '并发编辑影片',
        'vod_douban_score' => '0.0',
        'vod_score' => '0.0',
    ];
    DoubanGateway::$subjectResponses['1290505'] = [
        'vod_douban_id' => '1290505',
        'vod_douban_score' => '8.6',
        'vod_score' => '8.6',
    ];
    Db::$beforeUpdate = static function ($table) {
        if ($table !== 'vod') {
            return false;
        }
        foreach (Db::$tables['vod'] as $index => $row) {
            if ((int) ($row['vod_id'] ?? 0) === 505) {
                Db::$tables['vod'][$index]['vod_score'] = '7.7';
            }
        }
        return true;
    };
    $concurrentSyncRejected = false;
    try {
        DoubanData::fetchVod(505, 9);
    } catch (\addons\vodops\service\DoubanActionException $e) {
        $concurrentSyncRejected = $e->getMessage() === '视频数据已变化，本次同步已停止，请刷新后重试。';
    }
    $assertSame(true, $concurrentSyncRejected, 'A sync must reject stale source values instead of overwriting a native edit');
    $concurrentVod = array_values(array_filter(Db::$tables['vod'], static function ($row) {
        return (int) ($row['vod_id'] ?? 0) === 505;
    }))[0] ?? [];
    $assertSame('7.7', $concurrentVod['vod_score'] ?? '', 'A concurrent native score edit must be preserved');
    $conflictLogs = array_values(array_filter(Db::$tables['douban_log'], static function ($row) {
        return (int) ($row['vod_id'] ?? 0) === 505;
    }));
    $assertSame('AUTO_SYNC_CONFLICT', end($conflictLogs)['action'] ?? '', 'A rejected stale sync should retain an explicit conflict audit');
    $assertSame('1290505', end(DoubanGateway::$subjectCalls), 'A rejected stale sync may fetch data but must not overwrite the source row');
    DoubanGateway::$subjectCalls = ['1295644'];

    $matchedVod = DoubanData::fetchVod(501, 9);
    $assertSame(1, $matchedVod['code'] ?? 0, 'A unique specified video match should continue to sync');
    $assertSame('1292052', $matchedVod['matched_douban_id'] ?? '', 'The matched Douban ID should be returned');
    $assertSame([['待匹配影片', 5]], DoubanGateway::$searchCalls, 'Videos without a Douban ID should search by title');
    $assertSame(['1295644', '1292052'], DoubanGateway::$subjectCalls, 'A confirmed match should fetch subject data');
    $assertSame('/upload/existing-501.jpg', Db::$tables['vod'][1]['vod_pic'] ?? '', 'Match-and-sync should preserve the existing picture');
    $assertSame(false, in_array('vod_pic', $matchedVod['updated_fields'] ?? [], true), 'Match-and-sync should not report a picture update');

    Db::$tables['vod'][] = [
        'vod_id' => 503,
        'vod_name' => '同名影片',
        'vod_year' => '2025',
        'vod_actor' => '演员甲',
    ];
    DoubanGateway::$searchResponses['同名影片'] = [
        ['douban_id' => '111', 'title' => '同名影片', 'subtitle' => '第一版', 'year' => '2025'],
        ['douban_id' => '222', 'title' => '同名影片', 'subtitle' => '第二版', 'year' => '2025'],
    ];
    $aiMatchedVod = DoubanData::fetchVod(503, 9);
    $assertSame('222', $aiMatchedVod['matched_douban_id'] ?? '', 'Manual ambiguous matching should accept a safe AI tie-break');
    $assertSame('selected', $aiMatchedVod['ai_review']['status'] ?? '', 'Manual matching should return visible AI review feedback');
    $assertSame(1, count(AiProvider::$calls), 'Manual ambiguous matching should make one AI review call');
    $aiMeta = [];
    foreach (Db::$tables['douban_vod_meta'] as $row) {
        if ((int) ($row['vod_id'] ?? 0) === 503) {
            $aiMeta = $row;
            break;
        }
    }
    $assertSame('ai', $aiMeta['douban_id_source'] ?? '', 'AI-confirmed IDs should be auditable by source');

    Db::$tables['vod'][] = [
        'vod_id' => 504,
        'vod_name' => '批量歧义影片',
        'vod_year' => '2025',
    ];
    Db::$tables['douban_task'][] = [
        'task_id' => 6,
        'vod_id' => 504,
        'task_type' => 'MATCH_DOUBAN_ID',
        'status' => 'PENDING',
        'priority' => 5,
        'run_after' => 0,
        'attempts' => 0,
        'last_error' => '',
        'payload' => '{}',
        'created_at' => 1,
        'updated_at' => 1,
    ];
    DoubanGateway::$searchResponses['批量歧义影片'] = [
        ['douban_id' => '333', 'title' => '批量歧义影片', 'year' => '2025'],
        ['douban_id' => '444', 'title' => '批量歧义影片', 'year' => '2025'],
    ];
    DoubanData::runPending(1, 9);
    $assertSame(1, count(AiProvider::$calls), 'Background workers must not add AI calls or affect normal batch usage');

    Db::$tables['douban_vod_meta'][] = [
        'vod_id' => 502,
        'douban_id' => '1290001',
        'douban_id_locked' => 0,
        'intro_locked' => 0,
        'douban_id_source' => 'manual',
    ];
    Db::$tables['vod'][] = [
        'vod_id' => 502,
        'vod_name' => '字段边界影片',
        'vod_area' => '中国',
        'vod_lang' => '国语',
        'vod_douban_score' => '0.0',
        'vod_score' => '0.0',
    ];
    DoubanGateway::$subjectResponses['1290001'] = [
        'vod_douban_id' => '1290001',
        'vod_area' => '美国,英国,法国,德国,意大利,西班牙,澳大利亚,加拿大',
        'vod_lang' => '英语,法语,德语,意大利语',
        'vod_douban_score' => '8.8',
        'vod_score' => '8.8',
    ];
    $boundedVod = DoubanData::fetchVod(502, 9);
    $boundedStoredVod = [];
    foreach (Db::$tables['vod'] as $row) {
        if ((int) ($row['vod_id'] ?? 0) === 502) {
            $boundedStoredVod = $row;
            break;
        }
    }
    $assertSame('中国', $boundedStoredVod['vod_area'] ?? '', 'An oversized area should preserve the local value');
    $assertSame('国语', $boundedStoredVod['vod_lang'] ?? '', 'An oversized language should preserve the local value');
    $assertSame('8.8', $boundedStoredVod['vod_douban_score'] ?? '', 'Compatible fields should still sync when another field is oversized');
    $assertSame(['vod_area', 'vod_lang'], array_column($boundedVod['warnings'] ?? [], 'field'), 'Skipped oversized fields should be returned as visible warnings');

    $invalidVodRejected = false;
    try {
        DoubanData::fetchVod(0, 9);
    } catch (InvalidArgumentException $e) {
        $invalidVodRejected = $e->getMessage() === 'vod_id missing';
    }
    $assertSame(true, $invalidVodRejected, 'Specified video fetch should reject invalid vod IDs');

    $missingVodRejected = false;
    try {
        DoubanData::fetchVod(999, 9);
    } catch (RuntimeException $e) {
        $missingVodRejected = $e->getMessage() === '影片不存在';
    }
    $assertSame(true, $missingVodRejected, 'Specified video fetch should reject missing vod records');

    $recentNonPictureLogs = [];
    for ($logId = 100; $logId >= 41; $logId--) {
        $recentNonPictureLogs[] = [
            'log_id' => $logId,
            'vod_id' => 600,
            'action' => 'AUTO_SYNC',
            'old_values' => json_encode(['vod_score' => '8.0']),
            'new_values' => json_encode(['vod_score' => '9.0']),
            'created_at' => 1000 + $logId,
        ];
    }
    Db::$tables = [
        'vod' => [[
            'vod_id' => 600,
            'vod_name' => '海报待回退影片',
            'vod_pic' => 'https://img.example/broken.jpg',
        ]],
        'douban_log' => array_merge($recentNonPictureLogs, [[
            'log_id' => 31,
            'vod_id' => 600,
            'action' => 'AUTO_SYNC',
            'old_values' => json_encode(['vod_pic' => '/upload/working.jpg']),
            'new_values' => json_encode(['vod_pic' => 'https://img.example/broken.jpg']),
            'created_at' => 1000,
        ]]),
    ];
    $rolledBackPicture = DoubanData::rollbackPicture(600, 9);
    $assertSame('/upload/working.jpg', Db::$tables['vod'][0]['vod_pic'] ?? '', 'Picture rollback should restore only the previous image');
    $assertSame(31, $rolledBackPicture['source_log_id'] ?? 0, 'Picture rollback should report its source sync log');
    $latestRollbackLog = end(Db::$tables['douban_log']);
    $assertSame('ROLLBACK_PIC', $latestRollbackLog['action'] ?? '', 'Picture rollback should write an audit log');

    Db::$tables = [
        'douban_config' => [
            ['config_key' => 'request_per_minute', 'config_value' => '30'],
            ['config_key' => 'max_attempts', 'config_value' => '5'],
            ['config_key' => 'rate_limit_next_at', 'config_value' => '0', 'updated_at' => 0],
        ],
        'douban_task' => [[
            'task_id' => 7,
            'vod_id' => 700,
            'task_type' => 'CALIBRATE_SCORE',
            'status' => 'PENDING',
            'priority' => 1,
            'run_after' => 0,
            'attempts' => 0,
            'last_error' => '',
            'payload' => '{}',
            'created_at' => 1,
            'updated_at' => 1,
        ]],
        'douban_vod_meta' => [],
        'douban_log' => [],
        'vod' => [[
            'vod_id' => 700,
            'vod_name' => '待校准影片',
            'vod_douban_score' => '8.8',
            'vod_score' => '7.0',
        ]],
    ];
    $calibrated = DoubanData::runPending(1, 9);
    $assertSame(1, $calibrated['success'] ?? 0, 'Score calibration should run as one bounded queue task');
    $assertSame('8.8', Db::$tables['vod'][0]['vod_score'] ?? '', 'A calibration task should mirror one video score');
    $assertSame('SUCCESS', $task(7)['status'] ?? '', 'A calibration task should use the normal resumable worker state machine');
    $assertSame('CALIBRATE_SCORE', Db::$tables['douban_log'][0]['action'] ?? '', 'A calibration task should retain a per-video audit record');

    Db::$tables = [
        'vod' => [
            [
                'vod_id' => 1,
                'vod_name' => '已完成影片',
                'type_id' => 1,
                'vod_year' => '1994',
                'vod_area' => '法国',
                'vod_lang' => '法语',
                'vod_douban_id' => '1295644',
                'vod_douban_score' => '9.4',
                'vod_score' => '9.4',
                'vod_status' => 1,
            ],
            [
                'vod_id' => 3,
                'vod_name' => '待补充影片',
                'type_id' => 1,
                'vod_year' => '',
                'vod_area' => '中国',
                'vod_lang' => '国语',
                'vod_douban_id' => '',
                'vod_douban_score' => '0.0',
                'vod_score' => '0.0',
                'vod_status' => 1,
            ],
            [
                'vod_id' => 8,
                'vod_name' => '字段异常影片',
                'type_id' => 2,
                'vod_year' => '2025',
                'vod_area' => '美国,英国,法国,德国,意大利,西班牙,澳大利亚,加拿大',
                'vod_lang' => '英语,法语,德语,意大利语',
                'vod_douban_id' => '1290001',
                'vod_douban_score' => '8.8',
                'vod_score' => '7.0',
                'vod_status' => 0,
            ],
        ],
        'douban_vod_meta' => [
            ['vod_id' => 1, 'douban_id' => '1295644', 'douban_sync_fail_count' => 0, 'douban_review_status' => 'CONFIRMED'],
            ['vod_id' => 8, 'douban_id' => '1290002', 'douban_sync_fail_count' => 2, 'douban_review_status' => 'REVIEW'],
        ],
        'douban_config' => [[
            'config_key' => 'audit_start_lock',
            'config_value' => '0',
            'updated_at' => 0,
        ]],
        'douban_scan' => [],
        'douban_scan_issue' => [],
    ];
    Db::$columns = [
        'vod' => ['vod_douban_id', 'vod_douban_score', 'vod_score'],
    ];
    DoubanGateway::$subjectCalls = [];
    DoubanGateway::$searchCalls = [];
    $vodBeforeAudit = Db::$tables['vod'];

    $audit = DoubanData::startAudit(2, 9);
    $assertSame(1, $audit['scan_id'] ?? 0, 'A full-library audit should create a scan record');
    $assertSame(8, $audit['high_water_vod_id'] ?? 0, 'An audit should snapshot the highest video ID');
    $assertSame(3, $audit['total_videos'] ?? 0, 'An audit should snapshot the current video count');
    $concurrentAuditRejected = false;
    try {
        DoubanData::startAudit(2, 9);
    } catch (RuntimeException $e) {
        $concurrentAuditRejected = $e->getMessage() === '已有未完成的全库体检，请继续或暂停后恢复该任务';
    }
    $assertSame(true, $concurrentAuditRejected, 'A second full-library audit must not start concurrently');

    $firstAuditBatch = DoubanData::runAuditBatch(1);
    $assertSame(2, $firstAuditBatch['scanned_videos'] ?? 0, 'The first audit batch should honor its small cursor batch');
    $assertSame(3, $firstAuditBatch['cursor_vod_id'] ?? 0, 'The first audit batch should advance by video ID, not offset');
    $assertSame('RUNNING', $firstAuditBatch['status'] ?? '', 'A partial audit should remain resumable');

    $pausedAudit = DoubanData::pauseAudit(1);
    $assertSame('PAUSED', $pausedAudit['status'] ?? '', 'An audit should be pausable between batches');
    $pausedBatch = DoubanData::runAuditBatch(1);
    $assertSame(true, $pausedBatch['paused'] ?? false, 'A paused audit should not scan another batch');
    $assertSame(2, $pausedBatch['scanned_videos'] ?? 0, 'A paused audit should preserve its cursor progress');

    $resumedAudit = DoubanData::resumeAudit(1);
    $assertSame('RUNNING', $resumedAudit['status'] ?? '', 'A paused audit should resume without starting over');
    $finishedAudit = DoubanData::runAuditBatch(1);
    $assertSame('DONE', $finishedAudit['status'] ?? '', 'The final keyset batch should complete the audit');
    $assertSame(3, $finishedAudit['scanned_videos'] ?? 0, 'The completed audit should report every snapshotted video');
    $assertSame($vodBeforeAudit, Db::$tables['vod'], 'A full-library audit must not modify video data');
    $assertSame([], DoubanGateway::$subjectCalls, 'A database audit must not request Douban subjects');
    $assertSame([], DoubanGateway::$searchCalls, 'A database audit must not search Douban');
    $auditCodes = array_values(array_unique(array_column(Db::$tables['douban_scan_issue'], 'issue_code')));
    foreach (['MISSING_DOUBAN_ID', 'MISSING_DOUBAN_SCORE', 'YEAR_MISSING', 'FIELD_TOO_LONG', 'DOUBAN_ID_CONFLICT', 'SCORE_MISMATCH', 'SYNC_FAILED', 'NEEDS_REVIEW', 'STATUS_DISABLED'] as $expectedCode) {
        $assertSame(true, in_array($expectedCode, $auditCodes, true), 'The audit report should include ' . $expectedCode);
    }
    $firstExportBatch = DoubanData::auditIssueExportBatch(1, 0, 2);
    $assertSame(2, count($firstExportBatch), 'Audit export should honor its bounded batch size');
    $lastExportIssueId = (int) ($firstExportBatch[1]['issue_id'] ?? 0);
    $secondExportBatch = DoubanData::auditIssueExportBatch(1, $lastExportIssueId, 2);
    $assertSame(true, !empty($secondExportBatch) && (int) $secondExportBatch[0]['issue_id'] > $lastExportIssueId, 'Audit export should continue by issue ID cursor');

    echo "Douban worker tests passed\n";
}
