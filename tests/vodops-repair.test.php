<?php

declare(strict_types=1);

namespace think {
    class Db
    {
        public static $tables = [];
        public static $events = [];
        public static $beforeVodUpdate;

        public static function name($table)
        {
            return new \VodopsRepairFakeQuery((string) $table);
        }
    }

    class Cache
    {
        public static $removed = [];

        public static function rm($key)
        {
            self::$removed[] = (string) $key;
            return true;
        }
    }
}

namespace {
    class VodopsRepairFakeQuery
    {
        private $table;
        private $where = [];
        private $order = '';

        public function __construct(string $table)
        {
            $this->table = $table;
        }

        public function where($field, $operator = null, $value = null)
        {
            if (func_num_args() === 2) {
                $value = $operator;
                $operator = '=';
            }
            $this->where[] = [(string) $field, (string) $operator, $value];
            return $this;
        }

        public function field($fields)
        {
            return $this;
        }

        public function order($order)
        {
            $this->order = (string) $order;
            return $this;
        }

        public function find()
        {
            $rows = $this->matchingRows();
            return empty($rows) ? null : reset($rows);
        }

        public function select()
        {
            return array_values($this->matchingRows());
        }

        public function insertGetId(array $row)
        {
            $idField = $this->table === 'vodops_repair_log' ? 'repair_id' : 'id';
            $ids = array_column(\think\Db::$tables[$this->table] ?? [], $idField);
            $row[$idField] = empty($ids) ? 1 : max(array_map('intval', $ids)) + 1;
            \think\Db::$tables[$this->table][] = $row;
            \think\Db::$events[] = ['insert', $this->table, $row];
            return $row[$idField];
        }

        public function update(array $updates)
        {
            if ($this->table === 'vod' && is_callable(\think\Db::$beforeVodUpdate)) {
                $callback = \think\Db::$beforeVodUpdate;
                \think\Db::$beforeVodUpdate = null;
                $callback();
            }
            $count = 0;
            foreach (\think\Db::$tables[$this->table] as &$row) {
                if (!$this->matches($row)) {
                    continue;
                }
                foreach ($updates as $field => $value) {
                    $row[$field] = $value;
                }
                $count++;
            }
            unset($row);
            \think\Db::$events[] = ['update', $this->table, $updates, $count];
            return $count;
        }

        private function matchingRows(): array
        {
            $rows = [];
            foreach (\think\Db::$tables[$this->table] ?? [] as $index => $row) {
                if ($this->matches($row)) {
                    $rows[$index] = $row;
                }
            }
            if ($this->order !== '' && stripos($this->order, 'repair_id desc') !== false) {
                uasort($rows, static function ($left, $right) {
                    return intval($right['repair_id'] ?? 0) <=> intval($left['repair_id'] ?? 0);
                });
            }
            return $rows;
        }

        private function matches(array $row): bool
        {
            foreach ($this->where as [$field, $operator, $value]) {
                $actual = $row[$field] ?? null;
                if ($operator === '=' && $actual != $value) {
                    return false;
                }
                if (strtolower($operator) === 'in' && !in_array($actual, (array) $value, true)) {
                    return false;
                }
            }
            return true;
        }
    }

    function config($name)
    {
        if ($name === 'maccms') {
            return ['upload' => ['mode' => 'local'], 'app' => ['vod_area' => '中国大陆,美国', 'vod_lang' => '国语,英语']];
        }
        if ($name === 'maccms.app') {
            return ['vod_area' => '中国大陆,美国', 'vod_lang' => '国语,英语'];
        }
        if ($name === 'database.prefix') {
            return 'mac_';
        }
        return null;
    }

    function vodops_repair_fail(string $message): void
    {
        fwrite(STDERR, $message . "\n");
        exit(1);
    }

    function vodops_repair_assert_same($expected, $actual, string $message): void
    {
        if ($expected !== $actual) {
            vodops_repair_fail($message . "\nExpected: " . var_export($expected, true) . "\nActual: " . var_export($actual, true));
        }
    }

    function vodops_repair_expect_error(callable $callback, string $contains, string $message): void
    {
        try {
            $callback();
        } catch (\addons\vodops\service\VodQualityRepairException $error) {
            if (strpos($error->getMessage(), $contains) === false) {
                vodops_repair_fail($message . "\nUnexpected message: " . $error->getMessage());
            }
            return;
        }
        vodops_repair_fail($message . '\nExpected a repair validation error.');
    }

    $root = dirname(__DIR__);
    require $root . '/addons/vodops/service/VodQualityAnalyzer.php';
    require $root . '/addons/vodops/service/VodQualityRepair.php';

    use addons\vodops\service\VodQualityRepair;

    $siteRoot = sys_get_temp_dir() . '/vodops-repair-' . bin2hex(random_bytes(6));
    if (!mkdir($siteRoot . '/upload/vod', 0777, true)) {
        vodops_repair_fail('Unable to create repair fixture.');
    }

    $typeMap = [
        10 => ['type_id' => 10, 'type_pid' => 0, 'type_name' => '电影'],
        11 => ['type_id' => 11, 'type_pid' => 10, 'type_name' => '动作片'],
    ];
    $baseVod = [
        'vod_id' => 100,
        'vod_name' => '测试影片',
        'vod_en' => 'ceshiyingpian',
        'type_id' => 11,
        'type_id_1' => 10,
        'vod_year' => '2026',
        'vod_area' => '中国大陆',
        'vod_lang' => '国语',
        'vod_pic' => 'https://img.example.com/poster.jpg',
        'vod_play_from' => 'line1',
        'vod_play_url' => '第1集$https://media.example.com/one.m3u8',
    ];

    vodops_repair_assert_same(
        ['type_parent_mismatch', 'year_missing', 'year_invalid', 'area_missing', 'lang_missing', 'poster_missing', 'poster_file_missing'],
        array_keys(VodQualityRepair::supportedIssueTypes()),
        'The first repair release must expose only the reviewed, narrow field repairs.'
    );

    $yearVod = $baseVod;
    $yearVod['vod_year'] = '0';
    $preview = VodQualityRepair::previewUpdate('year_missing', ' 2024 ', $yearVod, $typeMap, ['site_root' => $siteRoot, 'remote_upload' => false]);
    vodops_repair_assert_same(['vod_year' => '2024'], $preview['updates'], 'Year repair should normalize a valid four-digit year.');
    vodops_repair_expect_error(
        static function () use ($yearVod, $typeMap, $siteRoot) {
            VodQualityRepair::previewUpdate('year_missing', '2024年', $yearVod, $typeMap, ['site_root' => $siteRoot, 'remote_upload' => false]);
        },
        '四位数字',
        'Year writes must reject display text that the scanner would still classify as invalid.'
    );

    $parentVod = $baseVod;
    $parentVod['type_id_1'] = 99;
    $preview = VodQualityRepair::previewUpdate('type_parent_mismatch', '', $parentVod, $typeMap);
    vodops_repair_assert_same(['type_id_1' => 10], $preview['updates'], 'Parent repair must derive the value from the selected category.');
    vodops_repair_assert_same(['type_id' => 11], $preview['guards'], 'Parent repair must also guard the category used to derive its parent.');

    $areaVod = $baseVod;
    $areaVod['vod_area'] = '';
    $preview = VodQualityRepair::previewUpdate('area_missing', ' 美国 ', $areaVod, $typeMap);
    vodops_repair_assert_same(['vod_area' => '美国'], $preview['updates'], 'Area repair should trim a reviewed value.');
    vodops_repair_expect_error(
        static function () use ($areaVod, $typeMap) {
            VodQualityRepair::previewUpdate('area_missing', '0', $areaVod, $typeMap);
        },
        '不能为空',
        'Metadata repairs must not replace one scanner blank sentinel with another.'
    );

    $posterVod = $baseVod;
    $posterVod['vod_pic'] = '/upload/vod/missing.jpg';
    vodops_repair_expect_error(
        static function () use ($posterVod, $typeMap, $siteRoot) {
            VodQualityRepair::previewUpdate('poster_file_missing', 'upload/vod/still-missing.jpg', $posterVod, $typeMap, ['site_root' => $siteRoot, 'remote_upload' => false]);
        },
        '文件不存在',
        'A local poster replacement must exist before its path is stored.'
    );
    $preview = VodQualityRepair::previewUpdate('poster_file_missing', 'https://img.example.com/new.jpg', $posterVod, $typeMap, ['site_root' => $siteRoot, 'remote_upload' => false]);
    vodops_repair_assert_same(['vod_pic' => 'https://img.example.com/new.jpg'], $preview['updates'], 'An HTTPS remote poster URL should replace a missing local file path.');
    vodops_repair_expect_error(
        static function () use ($posterVod, $typeMap, $siteRoot) {
            VodQualityRepair::previewUpdate('poster_file_missing', 'http://img.example.com/insecure.jpg', $posterVod, $typeMap, ['site_root' => $siteRoot, 'remote_upload' => false]);
        },
        'HTTPS',
        'New remote poster values should not introduce mixed-content HTTP URLs.'
    );

    vodops_repair_expect_error(
        static function () use ($baseVod, $typeMap) {
            VodQualityRepair::previewUpdate('play_group_mismatch', 'anything', $baseVod, $typeMap);
        },
        '暂不支持',
        'Playback repairs must remain outside the first safe write release.'
    );

    \think\Db::$tables = [
        'vodops_scan' => [[
            'run_id' => 12,
            'status' => 'completed',
        ]],
        'vodops_issue' => [
            [
                'issue_id' => 1,
                'run_id' => 12,
                'vod_id' => 100,
                'vod_name' => '测试影片',
                'type_id' => 11,
                'issue_type' => 'year_missing',
                'field_name' => 'vod_year',
                'current_value' => '0',
                'message' => '视频年份为空或为 0。',
                'detail_json' => '[]',
                'created_at' => time(),
            ],
            [
                'issue_id' => 2,
                'run_id' => 12,
                'vod_id' => 101,
                'vod_name' => '海报影片',
                'type_id' => 11,
                'issue_type' => 'poster_file_missing',
                'field_name' => 'vod_pic',
                'current_value' => 'upload/vod/restored.jpg',
                'message' => '本地海报路径存在于数据中，但站点文件已丢失。',
                'detail_json' => '[]',
                'created_at' => time(),
            ],
        ],
        'vod' => [
            array_merge($baseVod, ['vod_year' => '0']),
            array_merge($baseVod, ['vod_id' => 101, 'vod_name' => '海报影片', 'vod_pic' => 'upload/vod/restored.jpg']),
        ],
        'type' => array_values($typeMap),
        'vodops_repair_log' => [],
    ];
    \think\Db::$events = [];

    $result = VodQualityRepair::apply(1, '2024', 'manual', 7, ['site_root' => $siteRoot, 'remote_upload' => false]);
    vodops_repair_assert_same('2024', \think\Db::$tables['vod'][0]['vod_year'], 'Applying a reviewed repair should update only the target row.');
    vodops_repair_assert_same('fixed', $result['result_status'] ?? null, 'A successful repair should be rechecked immediately.');
    vodops_repair_assert_same('pending', \think\Db::$events[0][2]['operation_status'] ?? null, 'The original value must be persisted before touching MyISAM source data.');
    vodops_repair_assert_same('vodops_repair_log', \think\Db::$events[0][1] ?? null, 'The first write must target the repair audit table.');
    vodops_repair_assert_same('vod', \think\Db::$events[1][1] ?? null, 'The source update may run only after the audit insert succeeds.');

    $repairId = intval($result['repair_id'] ?? 0);
    $rolledBack = VodQualityRepair::rollback($repairId, 7, ['site_root' => $siteRoot, 'remote_upload' => false]);
    vodops_repair_assert_same('0', \think\Db::$tables['vod'][0]['vod_year'], 'Rollback should restore the exact audited original value.');
    vodops_repair_assert_same('open', $rolledBack['result_status'] ?? null, 'Rollback should reopen an issue when the original value is still invalid.');

    \think\Db::$tables['vod'][0]['vod_year'] = '0';
    \think\Db::$beforeVodUpdate = static function () {
        \think\Db::$tables['vod'][0]['vod_year'] = '2025';
    };
    vodops_repair_expect_error(
        static function () use ($siteRoot) {
            VodQualityRepair::apply(1, '2024', 'manual', 7, ['site_root' => $siteRoot, 'remote_upload' => false]);
        },
        '数据已变化',
        'The old-value condition must stop a repair that races with another editor.'
    );
    vodops_repair_assert_same('2025', \think\Db::$tables['vod'][0]['vod_year'], 'A conflict must preserve the newer external edit.');

    file_put_contents($siteRoot . '/upload/vod/restored.jpg', 'poster');
    $rechecked = VodQualityRepair::recheck(2, 7, ['site_root' => $siteRoot, 'remote_upload' => false]);
    vodops_repair_assert_same('fixed', $rechecked['result_status'] ?? null, 'Restoring the original local file should resolve the issue without changing vod_pic.');
    vodops_repair_assert_same('upload/vod/restored.jpg', \think\Db::$tables['vod'][1]['vod_pic'], 'A file-only repair must not rewrite the source field.');

    @unlink($siteRoot . '/upload/vod/restored.jpg');
    @rmdir($siteRoot . '/upload/vod');
    @rmdir($siteRoot . '/upload');
    @rmdir($siteRoot);

    echo "Vodops repair tests passed\n";
}
