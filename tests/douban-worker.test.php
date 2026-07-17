<?php

namespace think {
    class Db
    {
        public static $tables = [];

        public static function name($name)
        {
            return new DoubanWorkerQuery($name);
        }

        public static function query($sql, $bind = [])
        {
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
                if ($operator === '<' && !($actual < $expected)) {
                    return false;
                }
                if ($operator === '<=' && !($actual <= $expected)) {
                    return false;
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

namespace {
    use addons\douban\service\DoubanData;
    use think\Db;

    function cache($key, $value = null, $ttl = null)
    {
        return null;
    }

    require dirname(__DIR__) . '/addons/douban/service/DoubanData.php';

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

    $reserveMethod = new \ReflectionMethod(DoubanData::class, 'reserveRequestSlot');
    $reserveMethod->setAccessible(true);
    $firstSlot = $reserveMethod->invoke(null, 2.0);
    $secondSlot = $reserveMethod->invoke(null, 2.0);
    if ($secondSlot < $firstSlot + 1.999) {
        $fail('Shared rate-limit reservations should not overlap');
    }

    echo "Douban worker tests passed\n";
}
