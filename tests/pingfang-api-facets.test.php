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
        return new PingfangFacetQuery();
    }
}

final class PingfangFacetQuery
{
    private array $where = [];
    private string $group = '';
    private string $order = '';
    private int $limit = 200;

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

    public function field($field) { return $this; }
    public function force($index) { return $this; }
    public function group($field) { $this->group = $field; return $this; }
    public function order($order) { $this->order = $order; return $this; }
    public function limit($limit) { $this->limit = $limit; return $this; }

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
            return $rows;
        }
        $counts = [];
        foreach ($rows as $row) {
            $value = (string) $row[$this->group];
            $counts[$value] = ($counts[$value] ?? 0) + 1;
        }
        $rows = [];
        foreach ($counts as $value => $total) {
            $rows[] = ['value' => (string) $value, 'total' => $total];
        }
        $key = $this->order === 'total desc' ? 'total' : 'value';
        usort($rows, static function (array $left, array $right) use ($key): int { return $right[$key] <=> $left[$key]; });
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

echo "Pingfangapi available facet tests passed.\n";
