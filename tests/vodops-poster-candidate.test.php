<?php

declare(strict_types=1);

namespace think {
    class Db
    {
        public static $tables = [];

        public static function name($table)
        {
            return new \VodopsPosterCandidateFakeQuery((string) $table);
        }
    }
}

namespace {
    class VodopsPosterCandidateFakeQuery
    {
        private $table;
        private $where = [];
        private $limit = 0;
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

        public function limit($limit)
        {
            $this->limit = max(0, (int) $limit);
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

        private function matchingRows(): array
        {
            $rows = [];
            foreach (\think\Db::$tables[$this->table] ?? [] as $index => $row) {
                if ($this->matches($row)) {
                    $rows[$index] = $row;
                }
            }
            if (stripos($this->order, 'collect_id asc') !== false) {
                uasort($rows, static function ($left, $right) {
                    return intval($left['collect_id'] ?? 0) <=> intval($right['collect_id'] ?? 0);
                });
            }
            if ($this->limit > 0) {
                $rows = array_slice($rows, 0, $this->limit, true);
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
            }
            return true;
        }
    }

    function config($name)
    {
        if ($name === 'maccms') {
            return ['upload' => ['mode' => 'remote']];
        }
        if ($name === 'maccms.app') {
            return [];
        }
        return null;
    }

    function get_addon_config($name)
    {
        if ($name === 'vodops') {
            return $GLOBALS['vodopsPosterCandidateAddonConfig'] ?? [];
        }
        return [];
    }

    function vodops_poster_candidate_fail(string $message): void
    {
        fwrite(STDERR, $message . "\n");
        exit(1);
    }

    function vodops_poster_candidate_assert_same($expected, $actual, string $message): void
    {
        if ($expected !== $actual) {
            vodops_poster_candidate_fail($message . "\nExpected: " . var_export($expected, true) . "\nActual: " . var_export($actual, true));
        }
    }

    function vodops_poster_candidate_expect_error(callable $callback, string $contains, string $message): void
    {
        try {
            $callback();
        } catch (\addons\vodops\service\VodQualityRepairException $error) {
            if (strpos($error->getMessage(), $contains) === false) {
                vodops_poster_candidate_fail($message . "\nUnexpected message: " . $error->getMessage());
            }
            return;
        }
        vodops_poster_candidate_fail($message . '\nExpected a validation error.');
    }

    $root = dirname(__DIR__);
    require $root . '/addons/vodops/service/VodQualityAnalyzer.php';
    require $root . '/addons/vodops/service/VodQualityRepair.php';
    require $root . '/addons/vodops/service/VodPosterCandidate.php';

    use addons\vodops\service\VodPosterCandidate;

    $baseVod = [
        'vod_id' => 100,
        'vod_name' => '测试影片',
        'vod_en' => '',
        'type_id' => 11,
        'type_id_1' => 10,
        'vod_year' => '2024',
        'vod_area' => '中国大陆',
        'vod_lang' => '国语',
        'vod_pic' => '',
        'vod_play_from' => 'line1',
        'vod_play_url' => '第1集$https://media.example.com/one.m3u8',
    ];
    \think\Db::$tables = [
        'vodops_scan' => [['run_id' => 12, 'status' => 'completed']],
        'vodops_issue' => [
            [
                'issue_id' => 1,
                'run_id' => 12,
                'vod_id' => 100,
                'issue_type' => 'poster_missing',
            ],
            [
                'issue_id' => 2,
                'run_id' => 12,
                'vod_id' => 101,
                'issue_type' => 'year_missing',
            ],
            [
                'issue_id' => 3,
                'run_id' => 12,
                'vod_id' => 102,
                'issue_type' => 'year_invalid',
            ],
            [
                'issue_id' => 4,
                'run_id' => 12,
                'vod_id' => 103,
                'issue_type' => 'area_missing',
            ],
            [
                'issue_id' => 5,
                'run_id' => 12,
                'vod_id' => 104,
                'issue_type' => 'lang_missing',
            ],
            [
                'issue_id' => 6,
                'run_id' => 12,
                'vod_id' => 105,
                'issue_type' => 'type_parent_mismatch',
            ],
            [
                'issue_id' => 7,
                'run_id' => 12,
                'vod_id' => 106,
                'issue_type' => 'poster_file_missing',
            ],
            [
                'issue_id' => 8,
                'run_id' => 12,
                'vod_id' => 107,
                'issue_type' => 'poster_missing',
            ],
            [
                'issue_id' => 9,
                'run_id' => 12,
                'vod_id' => 108,
                'issue_type' => 'poster_missing',
            ],
        ],
        'vod' => [
            $baseVod,
            array_merge($baseVod, ['vod_id' => 101, 'vod_year' => '0', 'vod_pic' => 'https://img.example.com/existing.jpg']),
            array_merge($baseVod, ['vod_id' => 102, 'vod_year' => '2023/2024', 'vod_pic' => 'https://img.example.com/existing.jpg']),
            array_merge($baseVod, ['vod_id' => 103, 'vod_area' => '', 'vod_pic' => 'https://img.example.com/existing.jpg']),
            array_merge($baseVod, ['vod_id' => 104, 'vod_lang' => '', 'vod_pic' => 'https://img.example.com/existing.jpg']),
            array_merge($baseVod, ['vod_id' => 105, 'type_id_1' => 99, 'vod_pic' => 'https://img.example.com/existing.jpg']),
            array_merge($baseVod, ['vod_id' => 106, 'vod_pic' => 'upload/vod/does-not-exist.jpg']),
            array_merge($baseVod, ['vod_id' => 107, 'vod_play_from' => '未匹配线路']),
            array_merge($baseVod, ['vod_id' => 108, 'vod_play_from' => 'jav']),
        ],
        'type' => [
            ['type_id' => 10, 'type_pid' => 0, 'type_name' => '电影'],
            ['type_id' => 11, 'type_pid' => 10, 'type_name' => '动作片'],
        ],
        'collect' => [
            ['collect_id' => 1, 'collect_name' => '无效来源1', 'collect_url' => 'http://127.0.0.1/a', 'collect_type' => 2, 'collect_mid' => 1],
            ['collect_id' => 2, 'collect_name' => '无效来源2', 'collect_url' => 'http://127.0.0.1/b', 'collect_type' => 2, 'collect_mid' => 1],
            ['collect_id' => 3, 'collect_name' => '无效来源3', 'collect_url' => 'http://127.0.0.1/c', 'collect_type' => 2, 'collect_mid' => 1],
            ['collect_id' => 4, 'collect_name' => '无效来源4', 'collect_url' => 'http://127.0.0.1/d', 'collect_type' => 2, 'collect_mid' => 1],
            ['collect_id' => 5, 'collect_name' => '无效来源5', 'collect_url' => 'http://127.0.0.1/e', 'collect_type' => 2, 'collect_mid' => 1],
            ['collect_id' => 6, 'collect_name' => '无效来源6', 'collect_url' => 'http://127.0.0.1/f', 'collect_type' => 2, 'collect_mid' => 1],
            ['collect_id' => 7, 'collect_name' => '无效来源7', 'collect_url' => 'http://127.0.0.1/g', 'collect_type' => 2, 'collect_mid' => 1],
            ['collect_id' => 8, 'collect_name' => '无效来源8', 'collect_url' => 'http://127.0.0.1/h', 'collect_type' => 2, 'collect_mid' => 1],
            ['collect_id' => 21, 'collect_name' => '来源甲', 'collect_url' => 'https://1.1.1.1/api?token=secret-a', 'collect_type' => 2, 'collect_mid' => 1],
            ['collect_id' => 22, 'collect_name' => '来源乙', 'collect_url' => 'https://8.8.8.8/api?token=secret-b', 'collect_type' => 2, 'collect_mid' => 1],
            ['collect_id' => 23, 'collect_name' => '故障来源', 'collect_url' => 'https://9.9.9.9/api?token=secret-c', 'collect_type' => 2, 'collect_mid' => 1],
            ['collect_id' => 25, 'collect_name' => '待选择域名来源', 'collect_url' => 'https://source-does-not-resolve.invalid/api?token=secret-d', 'collect_type' => 2, 'collect_mid' => 1],
            ['collect_id' => 26, 'collect_name' => 'line1 高清源', 'collect_url' => 'https://1.0.0.1/api?token=secret-e', 'collect_type' => 2, 'collect_mid' => 1],
            ['collect_id' => 27, 'collect_name' => '备用可信源 A', 'collect_url' => 'https://8.26.56.26/api?token=secret-f', 'collect_type' => 2, 'collect_mid' => 1],
            ['collect_id' => 28, 'collect_name' => '备用可信源 B', 'collect_url' => 'https://8.20.247.20/api?token=secret-g', 'collect_type' => 2, 'collect_mid' => 1],
            ['collect_id' => 29, 'collect_name' => '备用可信源 C', 'collect_url' => 'https://64.6.64.6/api?token=secret-h', 'collect_type' => 2, 'collect_mid' => 1],
            ['collect_id' => 30, 'collect_name' => '备用可信源 D', 'collect_url' => 'https://64.6.65.6/api?token=secret-i', 'collect_type' => 2, 'collect_mid' => 1],
            ['collect_id' => 31, 'collect_name' => '备用可信源 E', 'collect_url' => 'https://208.67.220.220/api?token=secret-j', 'collect_type' => 2, 'collect_mid' => 1],
            ['collect_id' => 39, 'collect_name' => '成人视频采集', 'collect_url' => 'https://4.2.2.1/api?token=secret-sensitive', 'collect_type' => 2, 'collect_mid' => 1],
            ['collect_id' => 40, 'collect_name' => '黄色资源', 'collect_url' => 'https://4.2.2.2/api?token=secret-yellow', 'collect_type' => 2, 'collect_mid' => 1],
            ['collect_id' => 41, 'collect_name' => '搜AV资源', 'collect_url' => 'https://4.2.2.3/api?token=secret-av', 'collect_type' => 2, 'collect_mid' => 1],
            ['collect_id' => 42, 'collect_name' => '伦理资源', 'collect_url' => 'https://4.2.2.4/api?token=secret-ethics', 'collect_type' => 2, 'collect_mid' => 1],
            ['collect_id' => 43, 'collect_name' => '情色资源', 'collect_url' => 'https://4.2.2.5/api?token=secret-erotic', 'collect_type' => 2, 'collect_mid' => 1],
            ['collect_id' => 44, 'collect_name' => '福利资源', 'collect_url' => 'https://4.2.2.6/api?token=secret-benefits', 'collect_type' => 2, 'collect_mid' => 1],
            ['collect_id' => 45, 'collect_name' => '18禁资源', 'collect_url' => 'https://4.2.2.7/api?token=secret-18', 'collect_type' => 2, 'collect_mid' => 1],
            ['collect_id' => 46, 'collect_name' => '色情资源', 'collect_url' => 'https://4.2.2.8/api?token=secret-porn', 'collect_type' => 2, 'collect_mid' => 1],
            ['collect_id' => 47, 'collect_name' => 'JAV高清源', 'collect_url' => 'https://4.2.2.9/api?token=secret-opaque', 'collect_type' => 2, 'collect_mid' => 1],
            ['collect_id' => 24, 'collect_name' => '非视频来源', 'collect_url' => 'https://208.67.222.222/api', 'collect_type' => 1, 'collect_mid' => 1],
        ],
        'vodops_repair_log' => [],
    ];

    $seenProviders = [];
    $seenProbeUrls = [];
    $providerFetcher = static function (array $providers, string $query) use (&$seenProviders): array {
        $seenProviders = $providers;
        vodops_poster_candidate_assert_same('测试影片', $query, 'Provider search must use the current video title.');
        return [
            [
                'provider_id' => 21,
                'provider_name' => '来源甲',
                'ok' => true,
                'items' => [
                    ['vod_name' => '测试 影片', 'vod_year' => '2024', 'vod_area' => '中国大陆', 'vod_lang' => '国语', 'vod_pic' => 'https://img.example.com/shared.jpg'],
                    ['vod_name' => '测试影片', 'vod_year' => '2024', 'vod_area' => '中国大陆', 'vod_lang' => '国语', 'vod_pic' => 'https://img.example.com/source-a-2.jpg'],
                    ['vod_name' => '测试影片', 'vod_year' => '2024', 'vod_area' => str_repeat('地', 21), 'vod_lang' => str_repeat('语', 11), 'vod_pic' => 'https://img.example.com/source-a-3.jpg'],
                    ['vod_name' => '测试影片', 'vod_year' => '2024', 'vod_area' => '中国大陆', 'vod_lang' => '普通话', 'vod_pic' => 'https://img.example.com/source-a-4.jpg'],
                    ['vod_name' => '测试影片', 'vod_year' => '2023', 'vod_pic' => 'https://img.example.com/wrong-year.jpg'],
                    ['vod_name' => '其他影片', 'vod_year' => '2024', 'vod_pic' => 'https://img.example.com/wrong-title.jpg'],
                ],
            ],
            [
                'provider_id' => 22,
                'provider_name' => '来源乙',
                'ok' => true,
                'items' => [
                    ['vod_name' => '测试影片', 'vod_year' => '2024', 'vod_area' => '中国大陆', 'vod_lang' => '国语', 'vod_pic' => 'https://img.example.com/shared.jpg'],
                    ['vod_name' => '测试影片', 'vod_year' => '', 'vod_area' => '美国', 'vod_lang' => '英语', 'vod_pic' => 'https://img.example.com/unverified.jpg'],
                    ['vod_name' => '测试影片', 'vod_year' => '2024', 'vod_area' => '0', 'vod_lang' => '0', 'vod_pic' => 'http://127.0.0.1/private.jpg'],
                    ['vod_name' => '测试影片', 'vod_year' => '2024', 'vod_pic' => 'file:///tmp/private.jpg'],
                ],
            ],
            [
                'provider_id' => 23,
                'provider_name' => '故障来源',
                'ok' => false,
                'items' => [],
            ],
        ];
    };
    $imageProbe = static function (array $urls) use (&$seenProbeUrls): array {
        $seenProbeUrls = $urls;
        return [
            'https://img.example.com/shared.jpg' => ['ok' => true, 'http_code' => 206, 'content_type' => 'image/jpeg'],
            'https://img.example.com/source-a-2.jpg' => ['ok' => true, 'http_code' => 206, 'content_type' => 'image/jpeg'],
            'https://img.example.com/source-a-3.jpg' => ['ok' => true, 'http_code' => 206, 'content_type' => 'image/jpeg'],
            'https://img.example.com/source-a-4.jpg' => ['ok' => true, 'http_code' => 206, 'content_type' => 'image/jpeg'],
            'https://img.example.com/unverified.jpg' => ['ok' => false, 'http_code' => 200, 'content_type' => 'text/html'],
            'https://img.example.com/douban.jpg' => ['ok' => true, 'http_code' => 200, 'content_type' => 'image/webp'],
        ];
    };
    $doubanFetcher = static function ($vodId): array {
        return [[
            'source' => 'douban',
            'provider_id' => 0,
            'provider_name' => '豆瓣',
            'title' => '测试影片',
            'year' => '2024',
            'values' => [
                'vod_pic' => 'https://img.example.com/douban.jpg',
                'vod_year' => '2024',
                'vod_area' => '中国大陆',
                'vod_lang' => '国语',
            ],
            'match_status' => 'douban_id',
            'match_label' => '已绑定豆瓣 ID',
            'match_score' => 100,
        ]];
    };

    $result = VodPosterCandidate::search(1, [21, 22, 23], $providerFetcher, $imageProbe, $doubanFetcher, ['remote_upload' => true, 'site_root' => '']);
    vodops_poster_candidate_assert_same(3, count($seenProviders), 'Only enabled video collection providers should be queried.');
    vodops_poster_candidate_assert_same(3, $result['providers_total'] ?? null, 'The response should report the bounded provider count.');
    vodops_poster_candidate_assert_same(3, $result['providers_checked'] ?? null, 'Every returned provider result should be counted.');
    vodops_poster_candidate_assert_same(1, $result['providers_failed'] ?? null, 'One provider failure should not discard other candidates.');
    vodops_poster_candidate_assert_same(0, $result['douban_failed'] ?? null, 'A successful Douban lookup should be distinguishable from a provider outage.');
    vodops_poster_candidate_assert_same(4, count($result['candidates'] ?? []), 'Verified collector and Douban posters should both remain available.');
    vodops_poster_candidate_assert_same('vod_pic', $result['field_name'] ?? null, 'Poster searches should identify their single repair field.');
    vodops_poster_candidate_assert_same(19, count($result['provider_options'] ?? []), 'Source options should use bounded syntax checks without serial DNS lookups.');

    $candidateContext = \addons\vodops\service\VodQualityRepair::candidateContext(1, ['remote_upload' => true, 'site_root' => '']);
    vodops_poster_candidate_assert_same('line1', $candidateContext['vod']['vod_play_from'] ?? null, 'The internal candidate context should expose the playback group used for safe source defaults.');

    $trustedProviderNames = '来源甲,来源乙,故障来源,待选择域名来源,line1 高清源,备用可信源 A,备用可信源 B,备用可信源 C';
    $GLOBALS['vodopsPosterCandidateAddonConfig'] = [
        'candidate_default_providers' => $trustedProviderNames,
    ];
    $playGroupDefault = VodPosterCandidate::search(1, [], $providerFetcher, $imageProbe, $doubanFetcher, [
        'remote_upload' => true,
        'site_root' => '',
        'provider_selection_initialized' => false,
    ]);
    vodops_poster_candidate_assert_same([26], array_column($seenProviders, 'provider_id'), 'The absent follow-play-group setting should default to following a matching safe playback group.');
    vodops_poster_candidate_assert_same([26], $playGroupDefault['provider_ids'] ?? null, 'The response should echo the safe playback-group source selected by the default setting.');
    vodops_poster_candidate_assert_same('play_group', $playGroupDefault['provider_selection_mode'] ?? null, 'The UI should identify playback-group inference as a heuristic selection mode.');
    if (array_key_exists('vod', $playGroupDefault)
        || array_key_exists('vod_play_from', $playGroupDefault)
        || array_key_exists('vod_play_url', $playGroupDefault)
        || strpos((string) json_encode($playGroupDefault), '"vod_play_from"') !== false
        || strpos((string) json_encode($playGroupDefault), '"vod_play_url"') !== false) {
        vodops_poster_candidate_fail('Candidate responses must not expose internal playback fields used only for server-side source selection.');
    }

    $GLOBALS['vodopsPosterCandidateAddonConfig'] = [
        'candidate_follow_play_group' => '0',
        'candidate_default_providers' => '来源乙,来源甲',
    ];
    $followDisabled = VodPosterCandidate::search(1, [], $providerFetcher, $imageProbe, $doubanFetcher, [
        'remote_upload' => true,
        'site_root' => '',
        'provider_selection_initialized' => false,
    ]);
    $followDisabledProviderIds = array_column($seenProviders, 'provider_id');
    sort($followDisabledProviderIds);
    vodops_poster_candidate_assert_same([21, 22], $followDisabledProviderIds, 'Disabling playback-group following should use the configured provider names instead of a matching playback source.');
    if (in_array(26, $followDisabled['provider_ids'] ?? [], true)) {
        vodops_poster_candidate_fail('A disabled playback-group setting must not automatically select a matching playback source.');
    }

    $GLOBALS['vodopsPosterCandidateAddonConfig'] = [
        'candidate_follow_play_group' => '1',
        'candidate_default_providers' => $trustedProviderNames,
    ];
    $fallbackDefault = VodPosterCandidate::search(8, [], $providerFetcher, $imageProbe, $doubanFetcher, [
        'remote_upload' => true,
        'site_root' => '',
        'provider_selection_initialized' => false,
    ]);
    $fallbackProviderIds = [21, 22, 23, 25, 26, 27, 28, 29];
    vodops_poster_candidate_assert_same($fallbackProviderIds, array_column($seenProviders, 'provider_id'), 'A first search without a playback-group match should use configured provider names.');
    vodops_poster_candidate_assert_same($fallbackProviderIds, $fallbackDefault['provider_ids'] ?? null, 'Configured fallback providers should remain bounded to eight trusted sources.');
    vodops_poster_candidate_assert_same('default', $fallbackDefault['provider_selection_mode'] ?? null, 'The UI should distinguish configured trusted defaults from playback-group inference.');

    $sensitiveGroupDefault = VodPosterCandidate::search(9, [], $providerFetcher, $imageProbe, $doubanFetcher, [
        'remote_upload' => true,
        'site_root' => '',
        'provider_selection_initialized' => false,
    ]);
    vodops_poster_candidate_assert_same($fallbackProviderIds, array_column($seenProviders, 'provider_id'), 'A sensitive playback group must fall back to trusted sources instead of matching a sensitive source.');
    if (in_array(39, $sensitiveGroupDefault['provider_ids'] ?? [], true)
        || in_array(47, $sensitiveGroupDefault['provider_ids'] ?? [], true)) {
        vodops_poster_candidate_fail('Automatic playback-group matching must stay inside the configured trusted-source list, even when an opaque provider name hides sensitive content.');
    }

    $GLOBALS['vodopsPosterCandidateAddonConfig'] = [
        'candidate_follow_play_group' => '1',
        'candidate_default_providers' => '',
    ];
    $blankDefaultSelection = VodPosterCandidate::search(8, [], static function (): array {
        vodops_poster_candidate_fail('A blank configured default-provider list must not query collection sources.');
    }, $imageProbe, $doubanFetcher, [
        'remote_upload' => true,
        'site_root' => '',
        'provider_selection_initialized' => false,
    ]);
    vodops_poster_candidate_assert_same([], $blankDefaultSelection['provider_ids'] ?? null, 'A blank default-provider setting should leave collection sources disabled when no playback group matches.');

    $GLOBALS['vodopsPosterCandidateAddonConfig'] = [
        'candidate_follow_play_group' => '0',
        'candidate_default_providers' => '黄色资源,搜AV资源,成人视频采集,伦理资源,情色资源,福利资源,18禁资源,色情资源,来源甲',
    ];
    $filteredConfiguredDefaults = VodPosterCandidate::search(8, [], $providerFetcher, $imageProbe, $doubanFetcher, [
        'remote_upload' => true,
        'site_root' => '',
        'provider_selection_initialized' => false,
    ]);
    vodops_poster_candidate_assert_same([21], array_column($seenProviders, 'provider_id'), 'Sensitive providers must be removed even when their names are present in the configured default list.');
    foreach (range(39, 46) as $sensitiveProviderId) {
        if (in_array($sensitiveProviderId, $filteredConfiguredDefaults['provider_ids'] ?? [], true)) {
            vodops_poster_candidate_fail('Configured automatic providers must reject adult and sensitive-content sources.');
        }
    }

    $emptyManualSelection = VodPosterCandidate::search(1, [], static function (): array {
        vodops_poster_candidate_fail('An explicitly initialized empty source selection must remain empty.');
    }, $imageProbe, $doubanFetcher, [
        'remote_upload' => true,
        'site_root' => '',
        'provider_selection_initialized' => true,
    ]);
    vodops_poster_candidate_assert_same(0, $emptyManualSelection['providers_total'] ?? null, 'Clearing every source after initialization should disable collection lookups.');
    vodops_poster_candidate_assert_same([], $emptyManualSelection['provider_ids'] ?? null, 'An explicitly initialized empty selection must not be repopulated by defaults.');
    vodops_poster_candidate_assert_same('manual', $emptyManualSelection['provider_selection_mode'] ?? null, 'An initialized empty selection should stay in manual mode.');

    $manualSensitiveSelection = VodPosterCandidate::search(9, [39], $providerFetcher, $imageProbe, $doubanFetcher, [
        'remote_upload' => true,
        'site_root' => '',
        'provider_selection_initialized' => true,
    ]);
    vodops_poster_candidate_assert_same([39], array_column($seenProviders, 'provider_id'), 'An administrator may explicitly query a sensitive source for manual review.');
    vodops_poster_candidate_assert_same([39], $manualSensitiveSelection['provider_ids'] ?? null, 'Manual sensitive-source selection should remain explicit in the response.');
    vodops_poster_candidate_assert_same(64, strlen((string) ($result['context_token'] ?? '')), 'Candidates should carry a stable context token for stale-data protection.');

    $GLOBALS['vodopsPosterCandidateAddonConfig'] = [
        'candidate_follow_play_group' => '1',
        'candidate_default_providers' => $trustedProviderNames,
    ];

    $doubanFailure = VodPosterCandidate::search(4, [22], $providerFetcher, $imageProbe, static function (): array {
        throw new \RuntimeException('sensitive Douban endpoint failure');
    }, ['remote_upload' => true, 'site_root' => '', 'provider_selection_initialized' => true]);
    vodops_poster_candidate_assert_same(1, $doubanFailure['douban_failed'] ?? null, 'A Douban outage should be reported without exposing its internal error.');
    if (empty($doubanFailure['candidates'])) {
        vodops_poster_candidate_fail('A Douban outage must not discard candidates from an explicitly selected collection source.');
    }
    if (strpos((string) json_encode($doubanFailure), 'sensitive Douban endpoint failure') !== false) {
        vodops_poster_candidate_fail('Candidate responses must not expose Douban endpoint errors.');
    }

    $byUrl = [];
    foreach ($result['candidates'] as $candidate) {
        $byUrl[$candidate['value']] = $candidate;
        if (array_key_exists('selected', $candidate)) {
            vodops_poster_candidate_fail('The server must never preselect a poster candidate.');
        }
    }
    vodops_poster_candidate_assert_same('来源甲、来源乙', $byUrl['https://img.example.com/shared.jpg']['provider_name'] ?? null, 'The same poster URL should be deduplicated while retaining every source label.');
    vodops_poster_candidate_assert_same('collector', $byUrl['https://img.example.com/shared.jpg']['source'] ?? null, 'Collector candidates should set the existing repair source option.');
    vodops_poster_candidate_assert_same('douban', $byUrl['https://img.example.com/douban.jpg']['source'] ?? null, 'A bound Douban poster should remain distinguishable.');
    if (in_array('http://127.0.0.1/private.jpg', $seenProbeUrls, true) || in_array('file:///tmp/private.jpg', $seenProbeUrls, true)) {
        vodops_poster_candidate_fail('Unsafe poster URLs must be rejected before any network probe.');
    }
    if (in_array('https://img.example.com/source-a-4.jpg', $seenProbeUrls, true)) {
        vodops_poster_candidate_fail('One collection provider must not crowd out candidates from other providers.');
    }
    $encoded = json_encode($result, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    foreach (['secret-a', 'secret-b', 'secret-c', 'secret-d', 'secret-e', 'secret-f', 'secret-g', 'secret-h', 'secret-i', 'secret-j', 'secret-sensitive', 'secret-yellow', 'secret-av', 'secret-ethics', 'secret-erotic', 'secret-benefits', 'secret-18', 'secret-porn', 'secret-opaque', 'secret-private', 'collect_url'] as $secret) {
        if (strpos((string) $encoded, $secret) !== false) {
            vodops_poster_candidate_fail('Candidate responses must not expose provider endpoints or credentials.');
        }
    }

    \think\Db::$tables['vod'][0]['vod_year'] = '0';
    $yearless = VodPosterCandidate::search(1, [21, 22, 23], $providerFetcher, $imageProbe, static function () {
        return [];
    }, ['remote_upload' => true, 'site_root' => '']);
    vodops_poster_candidate_assert_same('local_year_missing', $yearless['candidates'][0]['match_status'] ?? null, 'A missing local year must remain visible as an explicit manual-review limitation.');

    \think\Db::$tables['vod'][0]['vod_year'] = '2024';
    $seenProbeUrls = [];
    $yearCandidates = VodPosterCandidate::search(2, [21, 22, 23], $providerFetcher, $imageProbe, $doubanFetcher, ['remote_upload' => true, 'site_root' => '']);
    vodops_poster_candidate_assert_same('vod_year', $yearCandidates['field_name'] ?? null, 'Missing-year repairs should search scalar year candidates.');
    vodops_poster_candidate_assert_same([], $seenProbeUrls, 'Scalar candidates must not perform poster image probes.');
    vodops_poster_candidate_assert_same('2024', $yearCandidates['candidates'][0]['value'] ?? null, 'A valid four-digit year should be selectable.');
    vodops_poster_candidate_assert_same(2, count($yearCandidates['candidates'] ?? []), 'Per-source limits must count distinct values so repeated rows cannot hide a later candidate.');
    vodops_poster_candidate_assert_same('豆瓣、来源甲、来源乙', $yearCandidates['candidates'][0]['provider_name'] ?? null, 'Scalar deduplication should retain every confirming source.');
    $yearValues = array_column($yearCandidates['candidates'] ?? [], 'value');
    sort($yearValues);
    vodops_poster_candidate_assert_same(['2023', '2024'], $yearValues, 'A distinct later year should survive duplicate rows from the same source for manual review.');

    $invalidYearCandidates = VodPosterCandidate::search(3, [21, 22, 23], $providerFetcher, $imageProbe, $doubanFetcher, ['remote_upload' => true, 'site_root' => '']);
    vodops_poster_candidate_assert_same('vod_year', $invalidYearCandidates['field_name'] ?? null, 'Invalid-year repairs should share the reviewed year-candidate path.');
    vodops_poster_candidate_assert_same('2024', $invalidYearCandidates['candidates'][0]['value'] ?? null, 'Invalid local year text must not block a valid external year candidate.');
    $invalidYearValues = array_column($invalidYearCandidates['candidates'] ?? [], 'value');
    sort($invalidYearValues);
    vodops_poster_candidate_assert_same(['2023', '2024'], $invalidYearValues, 'An ambiguous local value must not treat its first embedded year as trusted conflict evidence.');

    $areaCandidates = VodPosterCandidate::search(4, [22], $providerFetcher, $imageProbe, $doubanFetcher, ['remote_upload' => true, 'site_root' => '']);
    vodops_poster_candidate_assert_same([22], array_column($seenProviders, 'provider_id'), 'Administrators should be able to query a selected standard source, including one added by MyCJ.');
    vodops_poster_candidate_assert_same([22], $areaCandidates['provider_ids'] ?? null, 'The response should echo only the accepted provider selection.');
    vodops_poster_candidate_assert_same('vod_area', $areaCandidates['field_name'] ?? null, 'Missing-area repairs should search area candidates.');
    $areaValues = array_column($areaCandidates['candidates'] ?? [], 'value');
    sort($areaValues);
    vodops_poster_candidate_assert_same(['中国大陆', '美国'], $areaValues, 'Area candidates should include valid distinct values from selected sources and Douban.');

    $unsafeDoubanMatches = VodPosterCandidate::search(4, [], $providerFetcher, $imageProbe, static function (): array {
        return [
            [
                'source' => 'douban',
                'provider_name' => '豆瓣',
                'title' => '另一部影片',
                'year' => '2024',
                'values' => ['vod_area' => '日本'],
                'match_status' => 'douban_id',
                'match_label' => '错误绑定不应绕过片名校验',
                'match_score' => 100,
            ],
            [
                'source' => 'douban',
                'provider_name' => '豆瓣',
                'title' => '测试影片',
                'year' => '2023',
                'values' => ['vod_area' => '韩国'],
                'match_status' => 'douban_search',
                'match_label' => '有效本地年份冲突',
                'match_score' => 99,
            ],
        ];
    }, [
        'remote_upload' => true,
        'site_root' => '',
        'provider_selection_initialized' => true,
    ]);
    vodops_poster_candidate_assert_same([], $unsafeDoubanMatches['candidates'] ?? null, 'Douban candidates must satisfy both normalized-title and valid-local-year matching, including bound IDs.');

    $langCandidates = VodPosterCandidate::search(5, [21, 22, 23], $providerFetcher, $imageProbe, $doubanFetcher, ['remote_upload' => true, 'site_root' => '']);
    $langValues = array_column($langCandidates['candidates'] ?? [], 'value');
    sort($langValues);
    vodops_poster_candidate_assert_same(['国语', '普通话', '英语'], $langValues, 'Language candidates should retain valid reviewed values while rejecting overlong metadata.');

    $missingFileCandidates = VodPosterCandidate::search(7, [21], $providerFetcher, $imageProbe, $doubanFetcher, [
        'remote_upload' => false,
        'site_root' => '/definitely-not-a-real-vodops-site-root',
    ]);
    vodops_poster_candidate_assert_same('poster', $missingFileCandidates['candidate_kind'] ?? null, 'Missing local poster files should use the same reviewed poster-candidate path.');
    vodops_poster_candidate_assert_same('vod_pic', $missingFileCandidates['field_name'] ?? null, 'Missing local poster files should only propose vod_pic values.');

    vodops_poster_candidate_expect_error(
        static function () use ($providerFetcher, $imageProbe) {
            VodPosterCandidate::search(6, [], $providerFetcher, $imageProbe, static function () {
                return [];
            }, ['remote_upload' => true, 'site_root' => '']);
        },
        '不支持搜索外部候选',
        'Deterministic category repairs must never trigger external source searches.'
    );

    echo "Vodops poster candidate tests passed\n";
}
