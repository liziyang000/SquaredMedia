<?php

namespace think {
    class Db
    {
        public static $queries = [];

        public static function name($table)
        {
            $query = new FakeVodLibraryQuery((string) $table);
            self::$queries[] = $query;
            return $query;
        }
    }

    class FakeVodLibraryQuery
    {
        public $table;
        public $calls = [];

        public function __construct($table)
        {
            $this->table = $table;
        }

        public function getTable()
        {
            return 'mac_' . strtolower($this->table);
        }

        public function __call($name, $arguments)
        {
            $this->calls[] = [$name, $arguments];
            return $this;
        }

        public function select()
        {
            $this->calls[] = ['select', []];
            if ($this->table === 'seo_ai_result') {
                return [
                    ['seo_obj_id' => 120, 'seo_status' => 1],
                    ['seo_obj_id' => 119, 'seo_status' => 2],
                ];
            }

            $rows = [];
            for ($index = 0; $index < 21; $index++) {
                $rows[] = [
                    'vod_id' => 120 - $index,
                    'type_id' => 10,
                    'type_name' => '电影',
                    'vod_name' => '影片' . $index,
                    'vod_status' => $index === 1 ? 0 : 1,
                    'vod_lock' => 0,
                    'vod_isend' => 1,
                    'vod_serial' => '',
                    'vod_remarks' => '',
                    'vod_hits' => 100,
                    'vod_score' => '8.0',
                    'vod_level' => 0,
                    'vod_pic' => $index === 2 ? '' : '/poster.jpg',
                    'vod_play_from' => $index === 0 ? 'source_a$$$source_b' : '',
                    'vod_time' => 1788200000 - $index,
                    'vod_time_make' => 0,
                ];
            }
            return $rows;
        }
    }
}

namespace {
    function config($name)
    {
        if ($name === 'database' || $name === 'database.prefix') {
            return $name === 'database' ? ['prefix' => 'mac_'] : 'mac_';
        }
        return [];
    }

    function vod_library_fail($message)
    {
        fwrite(STDERR, $message . "\n");
        exit(1);
    }

    function vod_library_assert($condition, $message)
    {
        if (!$condition) {
            vod_library_fail($message);
        }
    }

    require dirname(__DIR__) . '/addons/vodops/service/VodLibrary.php';

    vod_library_assert(
        array_keys(\addons\vodops\service\VodLibrary::statusOptions()) === ['all', 0, 1],
        'MacCMS video audit status should expose only the native pending and approved values.'
    );

    $result = \addons\vodops\service\VodLibrary::listVideos([
        'q' => '霸王',
        'type_id' => 10,
        'status' => '1',
        'isend' => '0',
        'source' => 'source_a',
        'seo' => 'none',
        'pic' => 'missing',
        'page' => 2,
        'limit' => 20,
    ]);

    vod_library_assert(count($result['data']) === 20, 'The compact list should trim the look-ahead row.');
    vod_library_assert($result['has_next'] === true, 'The look-ahead row should mark the next page without COUNT(*).');
    vod_library_assert($result['has_prev'] === true, 'Page two should expose a previous page.');
    vod_library_assert(($result['data'][0]['source_count'] ?? null) === 2, 'Playback sources should collapse into a count.');
    vod_library_assert(($result['data'][0]['seo_status'] ?? null) === 1, 'SEO state should be decorated in one page-level query.');
    vod_library_assert(($result['data'][1]['seo_status'] ?? null) === 2, 'Fallback SEO state should remain distinct.');
    vod_library_assert(($result['data'][2]['seo_status'] ?? null) === 0, 'Missing SEO state should default to none.');

    $vodQuery = null;
    foreach (\think\Db::$queries as $query) {
        if ($query->table === 'vod') {
            $vodQuery = $query;
            break;
        }
    }
    vod_library_assert($vodQuery !== null, 'The manager should query the native Vod table.');

    $field = '';
    $limit = [];
    $whereCalls = [];
    $whereLikeCalls = [];
    foreach ($vodQuery->calls as $call) {
        if ($call[0] === 'field') {
            $field = (string) ($call[1][0] ?? '');
        } elseif ($call[0] === 'limit') {
            $limit = $call[1];
        } elseif ($call[0] === 'where') {
            $whereCalls[] = $call[1];
        } elseif ($call[0] === 'whereLike') {
            $whereLikeCalls[] = $call[1];
        } elseif ($call[0] === 'count') {
            vod_library_fail('The manager must not run an exact count for every page.');
        }
    }

    vod_library_assert(
        $field === 'v.vod_id,v.vod_name,v.vod_status,v.vod_isend,v.vod_serial,v.vod_remarks,v.vod_play_from,v.vod_time,ty.type_name',
        'The manager must read only fields rendered by the compact table.'
    );
    vod_library_assert(strpos($field, 'vod_play_url') === false, 'The manager must not read large playback payloads.');
    vod_library_assert($limit === [20, 21], 'Page two should read only one look-ahead row after the first 20 records.');
    vod_library_assert(in_array(['v.vod_recycle_time', 0], $whereCalls, true), 'Recycled videos should stay outside the normal manager.');
    vod_library_assert(in_array(['v.type_id|v.type_id_1', 10], $whereCalls, true), 'Category filters should include native parent category matching.');
    vod_library_assert(in_array(['v.vod_status', 1], $whereCalls, true), 'Audit status should use an indexed equality filter.');
    vod_library_assert(in_array(['v.vod_isend', 0], $whereCalls, true), 'Completion status should retain the explicit zero value.');
    vod_library_assert(in_array(['v.vod_pic', ''], $whereCalls, true), 'Missing-poster filtering should use an exact empty value.');
    vod_library_assert(in_array(['v.vod_name', '霸王%'], $whereLikeCalls, true), 'Text search should use an index-friendly title prefix.');
    vod_library_assert(in_array(['v.vod_play_from', '%source\\_a%'], $whereLikeCalls, true), 'Source filtering should only run when explicitly selected and escape wildcard characters.');

    echo "Vod library tests passed\n";
}
