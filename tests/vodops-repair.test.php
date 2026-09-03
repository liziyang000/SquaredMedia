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
    vodops_repair_expect_error(
        static function () use ($areaVod, $typeMap) {
            VodQualityRepair::previewUpdate('area_missing', str_repeat('地', 21), $areaVod, $typeMap);
        },
        '20',
        'Area repairs must respect the production database field limit.'
    );
    $langVod = $baseVod;
    $langVod['vod_lang'] = '';
    vodops_repair_expect_error(
        static function () use ($langVod, $typeMap) {
            VodQualityRepair::previewUpdate('lang_missing', str_repeat('语', 11), $langVod, $typeMap);
        },
        '10',
        'Language repairs must respect the production database field limit.'
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
            [
                'issue_id' => 3,
                'run_id' => 12,
                'vod_id' => 102,
                'vod_name' => '年份异常影片',
                'type_id' => 11,
                'issue_type' => 'year_invalid',
                'field_name' => 'vod_year',
                'current_value' => '2026年',
                'message' => '视频年份必须为四位数字。',
                'detail_json' => '[]',
                'created_at' => time(),
            ],
            [
                'issue_id' => 4,
                'run_id' => 12,
                'vod_id' => 103,
                'vod_name' => '地区影片',
                'type_id' => 11,
                'issue_type' => 'area_missing',
                'field_name' => 'vod_area',
                'current_value' => '',
                'message' => '视频地区为空。',
                'detail_json' => '[]',
                'created_at' => time(),
            ],
            [
                'issue_id' => 5,
                'run_id' => 12,
                'vod_id' => 104,
                'vod_name' => '语言影片',
                'type_id' => 11,
                'issue_type' => 'lang_missing',
                'field_name' => 'vod_lang',
                'current_value' => '',
                'message' => '视频语言为空。',
                'detail_json' => '[]',
                'created_at' => time(),
            ],
            [
                'issue_id' => 6,
                'run_id' => 12,
                'vod_id' => 105,
                'vod_name' => '海报缺失影片',
                'type_id' => 11,
                'issue_type' => 'poster_missing',
                'field_name' => 'vod_pic',
                'current_value' => '',
                'message' => '视频海报为空。',
                'detail_json' => '[]',
                'created_at' => time(),
            ],
        ],
        'vod' => [
            array_merge($baseVod, ['vod_year' => '0']),
            array_merge($baseVod, ['vod_id' => 101, 'vod_name' => '海报影片', 'vod_pic' => 'upload/vod/restored.jpg']),
            array_merge($baseVod, ['vod_id' => 102, 'vod_name' => '年份异常影片', 'vod_year' => '2026年']),
            array_merge($baseVod, ['vod_id' => 103, 'vod_name' => '地区影片', 'vod_area' => '']),
            array_merge($baseVod, ['vod_id' => 104, 'vod_name' => '语言影片', 'vod_lang' => '']),
            array_merge($baseVod, ['vod_id' => 105, 'vod_name' => '海报缺失影片', 'vod_pic' => '']),
        ],
        'type' => array_values($typeMap),
        'vodops_repair_log' => [],
    ];
    \think\Db::$events = [];

    $result = VodQualityRepair::apply(1, '2024', 'manual', 7, ['site_root' => $siteRoot, 'remote_upload' => false]);
    vodops_repair_assert_same('2024', \think\Db::$tables['vod'][0]['vod_year'], 'Applying a reviewed repair should update only the target row.');
    vodops_repair_assert_same('fixed', $result['result_status'] ?? null, 'A successful repair should be rechecked immediately.');
    vodops_repair_assert_same('vod_year', $result['field_name'] ?? null, 'Repair responses should identify the field that can be updated in place.');
    vodops_repair_assert_same('2024', $result['current_value'] ?? null, 'Repair responses should return the fresh field value without a page reload.');
    vodops_repair_assert_same('pending', \think\Db::$events[0][2]['operation_status'] ?? null, 'The original value must be persisted before touching MyISAM source data.');
    vodops_repair_assert_same('vodops_repair_log', \think\Db::$events[0][1] ?? null, 'The first write must target the repair audit table.');
    vodops_repair_assert_same('vod', \think\Db::$events[1][1] ?? null, 'The source update may run only after the audit insert succeeds.');

    $repairId = intval($result['repair_id'] ?? 0);
    $rolledBack = VodQualityRepair::rollback($repairId, 7, ['site_root' => $siteRoot, 'remote_upload' => false]);
    vodops_repair_assert_same('0', \think\Db::$tables['vod'][0]['vod_year'], 'Rollback should restore the exact audited original value.');
    vodops_repair_assert_same('open', $rolledBack['result_status'] ?? null, 'Rollback should reopen an issue when the original value is still invalid.');
    vodops_repair_assert_same('0', $rolledBack['current_value'] ?? null, 'Rollback responses should return the restored value for the current row.');

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

    \think\Db::$tables['vod'][0]['vod_year'] = '0';
    $candidateFields = [
        1 => ['year_missing', 'vod_year'],
        2 => ['poster_file_missing', 'vod_pic'],
        3 => ['year_invalid', 'vod_year'],
        4 => ['area_missing', 'vod_area'],
        5 => ['lang_missing', 'vod_lang'],
        6 => ['poster_missing', 'vod_pic'],
    ];
    foreach ($candidateFields as $issueId => [$issueType, $fieldName]) {
        $candidate = VodQualityRepair::candidateContext($issueId, ['site_root' => $siteRoot, 'remote_upload' => false]);
        vodops_repair_assert_same($issueType, $candidate['issue_type'] ?? null, 'Every supported external candidate issue should expose its exact issue type.');
        vodops_repair_assert_same($fieldName, $candidate['field_name'] ?? null, 'Every supported external candidate issue should expose only its writable target field.');
        vodops_repair_assert_same(64, strlen((string) ($candidate['context_token'] ?? '')), 'Every external candidate issue should receive a stale-data context token.');
    }

    $yearContext = VodQualityRepair::candidateContext(1, ['site_root' => $siteRoot, 'remote_upload' => false]);
    vodops_repair_assert_same('year_missing', $yearContext['issue_type'] ?? null, 'External candidate context should identify the scalar issue type.');
    vodops_repair_assert_same('vod_year', $yearContext['field_name'] ?? null, 'External year candidates should stay scoped to vod_year.');
    \think\Db::$tables['vod'][0]['vod_name'] = '已被其他管理员修改';
    vodops_repair_expect_error(
        static function () use ($siteRoot, $yearContext) {
            VodQualityRepair::apply(
                1,
                '2024',
                'collector',
                7,
                ['site_root' => $siteRoot, 'remote_upload' => false],
                (string) $yearContext['context_token']
            );
        },
        '重新搜索候选',
        'A scalar external candidate must expire when its title or target value changes.'
    );
    \think\Db::$tables['vod'][0]['vod_name'] = '测试影片';

    $areaContext = VodQualityRepair::candidateContext(4, ['site_root' => $siteRoot, 'remote_upload' => false]);
    \think\Db::$tables['vod'][3]['vod_year'] = '2025';
    vodops_repair_expect_error(
        static function () use ($siteRoot, $areaContext) {
            VodQualityRepair::apply(
                4,
                '美国',
                'collector',
                7,
                ['site_root' => $siteRoot, 'remote_upload' => false],
                (string) $areaContext['context_token']
            );
        },
        '重新搜索候选',
        'An external candidate must expire when the release year used for matching changes.'
    );
    \think\Db::$tables['vod'][3]['vod_year'] = '2026';

    $langContext = VodQualityRepair::candidateContext(5, ['site_root' => $siteRoot, 'remote_upload' => false]);
    \think\Db::$tables['vod'][4]['vod_lang'] = '英语';
    vodops_repair_expect_error(
        static function () use ($siteRoot, $langContext) {
            VodQualityRepair::apply(
                5,
                '国语',
                'collector',
                7,
                ['site_root' => $siteRoot, 'remote_upload' => false],
                (string) $langContext['context_token']
            );
        },
        '重新搜索候选',
        'An external candidate must expire when its current target field changes.'
    );
    \think\Db::$tables['vod'][4]['vod_lang'] = '';

    $yearContext = VodQualityRepair::candidateContext(1, ['site_root' => $siteRoot, 'remote_upload' => false]);
    $yearRepair = VodQualityRepair::apply(
        1,
        '2024',
        'collector',
        7,
        ['site_root' => $siteRoot, 'remote_upload' => false],
        (string) $yearContext['context_token']
    );
    vodops_repair_assert_same('2024', \think\Db::$tables['vod'][0]['vod_year'], 'Selecting a year candidate should still update only vod_year.');
    $yearLog = end(\think\Db::$tables['vodops_repair_log']);
    $yearGuards = json_decode((string) ($yearLog['guard_json'] ?? ''), true);
    vodops_repair_assert_same(['vod_name' => '测试影片'], $yearGuards, 'A year candidate should guard the title used for matching.');
    VodQualityRepair::rollback(intval($yearRepair['repair_id'] ?? 0), 7, ['site_root' => $siteRoot, 'remote_upload' => false]);
    vodops_repair_assert_same('0', \think\Db::$tables['vod'][0]['vod_year'], 'Scalar candidate rollback should restore the exact prior value.');

    $posterContext = VodQualityRepair::posterCandidateContext(2, ['site_root' => $siteRoot, 'remote_upload' => false]);
    vodops_repair_assert_same(64, strlen((string) ($posterContext['context_token'] ?? '')), 'Poster searches should receive a stable context token.');
    \think\Db::$tables['vod'][1]['vod_year'] = '2025';
    vodops_repair_expect_error(
        static function () use ($siteRoot, $posterContext) {
            VodQualityRepair::apply(
                2,
                'https://img.example.com/candidate.jpg',
                'collector',
                7,
                ['site_root' => $siteRoot, 'remote_upload' => false],
                (string) $posterContext['context_token']
            );
        },
        '重新搜索候选',
        'A poster candidate must expire when the video title, year, or current poster changes.'
    );
    \think\Db::$tables['vod'][1]['vod_year'] = '2026';
    $posterContext = VodQualityRepair::posterCandidateContext(2, ['site_root' => $siteRoot, 'remote_upload' => false]);
    $posterRepair = VodQualityRepair::apply(
        2,
        'https://img.example.com/candidate.jpg',
        'collector',
        7,
        ['site_root' => $siteRoot, 'remote_upload' => false],
        (string) $posterContext['context_token']
    );
    vodops_repair_assert_same('https://img.example.com/candidate.jpg', \think\Db::$tables['vod'][1]['vod_pic'], 'Selecting a verified candidate should still change only vod_pic.');
    $posterLog = end(\think\Db::$tables['vodops_repair_log']);
    $posterGuards = json_decode((string) ($posterLog['guard_json'] ?? ''), true);
    vodops_repair_assert_same(
        ['vod_name' => '海报影片', 'vod_year' => '2026'],
        $posterGuards,
        'A selected candidate must guard the matching title and year through the source update.'
    );
    VodQualityRepair::rollback(intval($posterRepair['repair_id'] ?? 0), 7, ['site_root' => $siteRoot, 'remote_upload' => false]);
    vodops_repair_assert_same('upload/vod/restored.jpg', \think\Db::$tables['vod'][1]['vod_pic'], 'Candidate rollback should restore the exact prior poster path.');

    file_put_contents($siteRoot . '/upload/vod/restored.jpg', 'poster');
    $rechecked = VodQualityRepair::recheck(2, 7, ['site_root' => $siteRoot, 'remote_upload' => false]);
    vodops_repair_assert_same('fixed', $rechecked['result_status'] ?? null, 'Restoring the original local file should resolve the issue without changing vod_pic.');
    vodops_repair_assert_same('upload/vod/restored.jpg', \think\Db::$tables['vod'][1]['vod_pic'], 'A file-only repair must not rewrite the source field.');
    vodops_repair_assert_same('upload/vod/restored.jpg', $rechecked['current_value'] ?? null, 'Recheck responses should return the current value for an in-place row refresh.');

    @unlink($siteRoot . '/upload/vod/restored.jpg');
    @rmdir($siteRoot . '/upload/vod');
    @rmdir($siteRoot . '/upload');
    @rmdir($siteRoot);

    echo "Vodops repair tests passed\n";
}
