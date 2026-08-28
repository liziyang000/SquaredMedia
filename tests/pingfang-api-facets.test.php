<?php
declare(strict_types=1);

use addons\pingfangapi\service\ContentService;

require_once dirname(__DIR__) . '/addons/pingfangapi/service/ApiException.php';
require_once dirname(__DIR__) . '/addons/pingfangapi/service/ContentService.php';

final class PingfangFacetDatabase
{
    public static function name($table)
    {
        if ($table !== 'Vod') {
            throw new RuntimeException('Facets must read only Vod.');
        }
        $query = new PingfangFacetQuery();
        $GLOBALS['pingfangFacetQueries'][] = $query;
        return $query;
    }

    public static function query($sql, $bind = [])
    {
        if ($sql !== 'SHOW INDEX FROM `mac_vod` WHERE Key_name = :name' || $bind !== ['name' => 'idx_pfapi_catalog']) {
            throw new RuntimeException('Catalog index discovery must use the actual table and a bound index name.');
        }
        $GLOBALS['pingfangFacetIndexReads'] = ($GLOBALS['pingfangFacetIndexReads'] ?? 0) + 1;
        return $GLOBALS['pingfangFacetIndexes'] ?? [];
    }
}

final class PingfangFacetQuery
{
    public array $where = [];
    public string $fields = '';
    public string $forcedIndex = '';
    private string $group = '';
    private string $order = '';
    private int $limit = PHP_INT_MAX;
    private int $offset = 0;

    public function where($field, $operator = null, $value = null)
    {
        if (is_array($field)) {
            foreach ($field as $name => $expected) {
                $this->where[] = [$name, '=', $expected];
            }
        } else {
            $this->where[] = func_num_args() === 2 ? [$field, '=', $operator] : [$field, $operator, $value];
        }
        return $this;
    }

    public function field($field) { $this->fields = $field; return $this; }
    public function getTable() { return $GLOBALS['pingfangFacetTable'] ?? 'mac_vod'; }
    public function force($index)
    {
        if ($index !== 'idx_pfapi_catalog') { throw new RuntimeException('Catalog queries must not force the non-covering index ' . $index . '.'); }
        $this->forcedIndex = $index;
        return $this;
    }
    public function group($field) { $this->group = $field; return $this; }
    public function order($order) { $this->order = $order; return $this; }
    public function limit($limit) { $this->limit = $limit; return $this; }
    public function page($page, $limit) { $this->offset = ($page - 1) * $limit; $this->limit = $limit; return $this; }
    public function count() { return count($this->select()); }

    public function select()
    {
        $GLOBALS['pingfangFacetReads']++;
        $rows = array_values(array_filter($GLOBALS['pingfangFacetRows'], function (array $row): bool {
            foreach ($this->where as [$field, $operator, $value]) {
                $actual = $row[$field] ?? null;
                if ($operator === 'in' && !in_array($actual, $value)) { return false; }
                if ($operator === 'not in' && in_array($actual, $value)) { return false; }
                if ($operator === '<>' && $actual == $value) { return false; }
                if ($operator === '=' && $actual != $value) { return false; }
                if ($operator === 'like' && strpos((string) $actual, trim((string) $value, '%')) === false) { return false; }
            }
            return true;
        }));
        if ($this->group === '') {
            if ($this->order !== '') {
                usort($rows, function (array $left, array $right): int {
                    foreach (explode(',', $this->order) as $order) {
                        [$field, $direction] = explode(' ', trim($order));
                        $difference = ($left[$field] ?? 0) <=> ($right[$field] ?? 0);
                        if ($difference !== 0) {
                            return $direction === 'desc' ? -$difference : $difference;
                        }
                    }
                    return 0;
                });
            }
            return array_slice($rows, $this->offset, $this->limit);
        }
        $counts = [];
        foreach ($rows as $row) {
            $value = (string) $row[$this->group];
            $counts[$value] = ($counts[$value] ?? 0) + 1;
        }
        $rows = [];
        foreach ($counts as $value => $total) {
            $key = strpos($this->fields, ' as value') !== false ? 'value' : $this->group;
            $rows[] = [$key => (string) $value, 'total' => $total];
        }
        if ($this->order !== '') {
            $key = $this->order === 'total desc' ? 'total' : 'value';
            usort($rows, static function (array $left, array $right) use ($key): int { return $right[$key] <=> $left[$key]; });
        }
        return array_slice($rows, 0, $this->limit);
    }
}

class_alias(PingfangFacetDatabase::class, 'think\\Db');
function cache($key, $value = null, $seconds = null)
{
    if (func_num_args() > 1) {
        $GLOBALS['pingfangFacetCache'][$key] = $value;
        return true;
    }
    return $GLOBALS['pingfangFacetCache'][$key] ?? null;
}
function get_addon_config($name) { return ['summary_cache_seconds' => 1800]; }
function mac_get_popedom_filter($group) { return $GLOBALS['pingfangFacetBlocked'] ?? ''; }

$assertSame = static function ($expected, $actual, string $message): void {
    if ($expected !== $actual) {
        throw new RuntimeException($message . '\nExpected: ' . var_export($expected, true) . '\nActual: ' . var_export($actual, true));
    }
};
$year = intval(date('Y'));
$types = [42 => ['type_pid' => 0], 420 => ['type_pid' => 42], 47 => ['type_pid' => 0], 999 => ['type_pid' => 0]];
$row = static function ($id, $area, $year, $lang, array $overrides = []): array {
    return array_merge(['vod_id' => $id, 'type_id' => 42, 'vod_status' => 1, 'vod_recycle_time' => 0, 'vod_area' => $area, 'vod_year' => (string) $year, 'vod_lang' => $lang, 'vod_class' => '剧情'], $overrides);
};
$GLOBALS['config']['app'] = [
    'popedom_filter' => 0,
    'vod_extend_area' => '美国,中国大陆,法国,日本',
    'vod_extend_lang' => '英语,国语,法语,日语',
    'vod_extend_year' => '未知,1899,' . ($year + 1) . ',' . ($year - 2) . ',' . $year . ',' . ($year - 1),
];
$GLOBALS['pingfangFacetRows'] = [
    $row(1, '中国大陆', $year, '国语'),
    $row(2, '美国', $year - 1, '英语'),
    $row(3, '中国大陆', $year - 2, '国语', ['type_id' => 420]),
    $row(4, '日本', $year, '日语', ['type_id' => 47]),
    $row(5, '法国', $year, '法语', ['vod_status' => 0]),
    $row(6, '法国', $year, '法语', ['vod_recycle_time' => 100]),
    $row(7, '日本', $year, '日语', ['type_id' => 999]),
];
$GLOBALS['pingfangFacetReads'] = 0;
$method = new ReflectionMethod(ContentService::class, 'facetOptions');
$method->setAccessible(true);
$facet = static function ($name, array $query, ?array $typeList = null) use ($method, &$types): array {
    return $method->invoke(new ContentService(static function () { return ['code' => 1]; }), $name, $query, $typeList ?? $types);
};

$assertSame(['美国', '中国大陆'], $facet('area', ['typeId' => 42]), 'Configured areas must intersect visible category data and preserve configuration order.');
$assertSame(['英语', '国语'], $facet('lang', ['typeId' => 42]), 'Configured languages must not expose disabled, recycled or out-of-category choices.');
$assertSame([(string) $year, (string) ($year - 1), (string) ($year - 2)], $facet('year', ['typeId' => 42]), 'Configured years must be available, valid and sorted newest first.');
$assertSame(['中国大陆'], $facet('area', ['typeId' => 42, 'year' => (string) $year]), 'Area options must retain the selected year.');
$assertSame(['英语'], $facet('lang', ['typeId' => 42, 'area' => '美国']), 'Language options must retain the selected area.');
$reads = $GLOBALS['pingfangFacetReads'];
$assertSame(['美国', '中国大陆'], $facet('area', ['typeId' => 42, 'area' => '美国']), 'A facet must ignore only its own selected value.');
$assertSame($reads, $GLOBALS['pingfangFacetReads'], 'Repeated configured facets must use the cached available values.');
$assertSame([], $facet('area', ['typeId' => 42, 'year' => '1900']), 'Empty intersections must not fall back to the unfiltered configuration.');
$assertSame([], $facet('area', ['typeId' => 999, 'scope' => 'library']), 'Facet options must never escape the fixed library scope.');

$types[42]['type_extend'] = ['area' => '日本,中国大陆'];
$assertSame(['中国大陆'], $facet('area', ['typeId' => 420]), 'Child categories must inherit the parent configuration before intersecting data.');
$types[42]['type_extend']['area'] = '美国';
$assertSame([], $facet('area', ['typeId' => 420]), 'Changing inherited configuration must invalidate the available-options cache.');
unset($types[42]['type_extend']);
$GLOBALS['config']['app']['popedom_filter'] = 1;
$GLOBALS['pingfangFacetBlocked'] = '42,420';
$assertSame([], $facet('area', ['typeId' => 42]), 'Cached options must not leak values from blocked categories.');
$GLOBALS['config']['app']['popedom_filter'] = 0;
$GLOBALS['pingfangFacetBlocked'] = '';

$GLOBALS['config']['app']['vod_extend_area'] = '';
$GLOBALS['config']['app']['vod_extend_lang'] = '';
$GLOBALS['pingfangFacetRows'] = [
    $row(8, '中国大陆,美国', $year, '国语,英语'),
    $row(9, str_repeat('区', 41), $year, str_repeat('语', 41)),
    $row(10, "非法\t地区", $year, "非法\n语言"),
    $row(11, ' 未整理地区 ', $year, '<b>未整理语言</b>'),
];
$assertSame(['中国大陆,美国'], $facet('area', ['typeId' => 42]), 'Exact-match area filters must preserve compound database values instead of producing unselectable fragments.');
$assertSame(['国语,英语'], $facet('lang', ['typeId' => 42]), 'Exact-match language filters must preserve compound database values.');
$queryMethod = new ReflectionMethod(ContentService::class, 'baseVodQuery');
$queryMethod->setAccessible(true);
$builder = $queryMethod->invoke(new ContentService(static function () { return ['code' => 1]; }), ['typeId' => 42, 'area' => '中国大陆,美国', 'lang' => '国语,英语'], $types);
$assertSame(1, count($builder->select()), 'Every emitted compound value must remain selectable with the real equality-filter builder.');
$GLOBALS['pingfangFacetRows'] = [$row(12, '中国大陆', $year + 1, '国语'), $row(13, '中国大陆', 1899, '国语'), $row(14, '中国大陆', $year, '国语')];
$assertSame([(string) $year], $facet('year', ['typeId' => 42, 'scope' => 'library']), 'Available but invalid or future configured years must still be excluded.');

$GLOBALS['pingfangFacetCache'] = [];
$GLOBALS['pingfangFacetRows'] = [
    $row(1, '中国大陆', $year, '国语', ['vod_time' => 200, 'vod_hits' => 10, 'vod_score' => 8]),
    $row(2, '美国', $year - 1, '英语', ['vod_time' => 100, 'vod_hits' => 20, 'vod_score' => 9]),
    $row(3, '中国大陆', $year, '国语', ['vod_time' => 200, 'vod_hits' => 10, 'vod_score' => 8, 'type_id' => 420]),
    $row(4, '日本', $year, '日语', ['type_id' => 47]),
    $row(5, '法国', $year, '法语', ['vod_status' => 0]),
    $row(6, '法国', $year, '法语', ['vod_recycle_time' => 100]),
    $row(7, '日本', $year, '日语', ['type_id' => 999]),
];
$GLOBALS['config']['app']['popedom_filter'] = 1;
$GLOBALS['pingfangFacetBlocked'] = '47';
$service = new ContentService(static function () { return ['code' => 1]; });
$invoke = static function (string $name, ...$args) use (&$service) {
    $method = new ReflectionMethod(ContentService::class, $name);
    $method->setAccessible(true);
    return $method->invoke($service, ...$args);
};
$GLOBALS['pingfangFacetQueries'] = [];
$assertSame(3, $invoke('queryTotal', ['scope' => 'library'], $types), 'Exact totals must exclude blocked, disabled, recycled and out-of-scope rows without forcing a full scan.');
$assertSame(['vod_status', '=', 1], $GLOBALS['pingfangFacetQueries'][0]->where[0], 'Exact totals must retain the enabled predicate.');
$assertSame(['vod_recycle_time', '=', 0], $GLOBALS['pingfangFacetQueries'][0]->where[1], 'Exact totals must retain the recycle predicate.');
$assertSame(['type_id', 'not in', [47]], $GLOBALS['pingfangFacetQueries'][0]->where[2], 'Exact totals must retain the permission predicate.');
$reads = $GLOBALS['pingfangFacetReads'];
$assertSame(3, $invoke('queryTotal', ['scope' => 'library', 'page' => 2], $types), 'Pagination must reuse the same exact total cache.');
$assertSame($reads, $GLOBALS['pingfangFacetReads'], 'Repeated totals must not read the database.');
$assertSame(2, $invoke('queryTotal', ['scope' => 'library', 'year' => (string) $year], $types), 'Filtered totals must keep their exact conditions and separate cache.');
foreach (['latest' => [3, 1, 2], 'hot' => [2, 3, 1], 'score' => [2, 3, 1]] as $sort => $expected) {
    foreach ([1, 2] as $page) {
        $GLOBALS['pingfangFacetQueries'] = [];
        $rows = $invoke('pageRows', ['scope' => 'library'], $types, $sort, $page, 2, 0, false);
        $assertSame(array_slice($expected, ($page - 1) * 2, 2), array_column($rows, 'vod_id'), 'Paging must preserve ' . $sort . ' order and descending ID ties on page ' . $page . '.');
        $assertSame('vod_id', $GLOBALS['pingfangFacetQueries'][0]->fields, 'Paging must still select IDs before fetching display fields.');
        $assertSame(false, strpos($GLOBALS['pingfangFacetQueries'][1]->fields, 'vod_play_') !== false, 'Catalog rows must not load playback source fields.');
    }
}
$categoryCounts = array_column($invoke('categories', $types), 'total', 'id');
$assertSame([42 => 3, 999 => 1], $categoryCounts, 'Category totals must remain exact and permission-scoped without forcing the time index.');
$assertSame(['剧情'], $invoke('classOptions', ['scope' => 'library'], $types), 'Class aggregation must preserve available values without forcing a primary scan.');
$assertSame(0, $invoke('queryTotal', ['scope' => 'library', 'typeId' => 999], $types), 'Out-of-scope categories must still produce an exact empty result.');

$catalogIndex = [];
foreach (['vod_status', 'vod_recycle_time', 'type_id', 'vod_area', 'vod_year', 'vod_lang', 'vod_class'] as $offset => $column) {
    $catalogIndex[] = ['Seq_in_index' => $offset + 1, 'Column_name' => $column, 'Sub_part' => null, 'Index_type' => 'BTREE', 'Visible' => 'YES'];
}
$GLOBALS['pingfangFacetIndexes'] = $catalogIndex;
$GLOBALS['pingfangFacetCache'] = [];
$GLOBALS['pingfangFacetQueries'] = [];
$GLOBALS['pingfangFacetIndexReads'] = 0;
$service = new ContentService(static function () { return ['code' => 1]; });
$assertSame(3, $invoke('queryTotal', ['scope' => 'library'], $types), 'A covering index must preserve the exact permission-scoped total.');
$assertSame('idx_pfapi_catalog', $GLOBALS['pingfangFacetQueries'][0]->forcedIndex, 'Available covering indexes must keep summary queries away from the non-covering time index.');
$invoke('facetOptions', 'area', ['scope' => 'library'], $types);
$invoke('classOptions', ['scope' => 'library'], $types);
$assertSame(1, $GLOBALS['pingfangFacetIndexReads'], 'One request must inspect the covering index only once for totals and all facets.');
foreach ($GLOBALS['pingfangFacetQueries'] as $builder) {
    $assertSame('idx_pfapi_catalog', $builder->forcedIndex, 'Exact totals and every facet must use the verified covering index.');
}
$prefixIndex = $catalogIndex;
$prefixIndex[6]['Sub_part'] = 32;
$wrongIndex = $catalogIndex;
$wrongIndex[2]['Column_name'] = 'vod_time';
$invisibleIndex = $catalogIndex;
$invisibleIndex[0]['Visible'] = 'NO';
foreach (['missing' => [], 'prefix' => $prefixIndex, 'wrong columns' => $wrongIndex, 'invisible' => $invisibleIndex] as $case => $indexes) {
    $GLOBALS['pingfangFacetIndexes'] = $indexes;
    $GLOBALS['pingfangFacetCache'] = [];
    $GLOBALS['pingfangFacetQueries'] = [];
    $service = new ContentService(static function () { return ['code' => 1]; });
    $assertSame(3, $invoke('queryTotal', ['scope' => 'library'], $types), 'A ' . $case . ' index must not prevent older installations from querying.');
    $assertSame('', $GLOBALS['pingfangFacetQueries'][0]->forcedIndex, 'A ' . $case . ' index must never be forced.');
}
$GLOBALS['pingfangFacetIndexes'] = $catalogIndex;
foreach ([['keyword' => ''], ['letter' => '0'], ['playableOnly' => true], ['typeId' => 999]] as $filter) {
    $GLOBALS['pingfangFacetIndexReads'] = 0;
    $service = new ContentService(static function () { return ['code' => 1]; });
    $builder = $invoke('summaryVodQuery', $filter + ['scope' => 'library'], $types);
    $assertSame('', $builder->forcedIndex, 'Queries with non-covered or impossible predicates must keep their selective plan.');
    $assertSame(0, $GLOBALS['pingfangFacetIndexReads'], 'Non-covered queries must not inspect the summary index.');
}
$GLOBALS['pingfangFacetTable'] = 'mac_vod; unexpected';
$GLOBALS['pingfangFacetIndexReads'] = 0;
$service = new ContentService(static function () { return ['code' => 1]; });
$builder = $invoke('summaryVodQuery', ['scope' => 'library'], $types);
$assertSame('', $builder->forcedIndex, 'Unsafe table identifiers must disable optional index discovery.');
$assertSame(0, $GLOBALS['pingfangFacetIndexReads'], 'Index discovery must never interpolate an unsafe table identifier.');
unset($GLOBALS['pingfangFacetTable']);

echo "Pingfangapi available facet tests passed.\n";
