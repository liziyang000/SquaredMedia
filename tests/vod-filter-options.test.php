<?php

namespace think {
    class Db
    {
        public static $tables = [];

        public static function name($name)
        {
            return new VodFilterQuery($name);
        }
    }

    class VodFilterQuery
    {
        private $table;
        private $where = [];
        private $field = '';
        private $group = '';
        private $order = '';
        private $limit = 0;
        private $distinct = false;

        public function __construct($table)
        {
            $this->table = $table;
        }

        public function where($field, $operator = null, $value = null)
        {
            if (is_array($field)) {
                foreach ($field as $key => $condition) {
                    $this->where[] = [$key, $condition];
                }
            } elseif (func_num_args() === 2) {
                $this->where[] = [$field, ['=', $operator]];
            } else {
                $this->where[] = [$field, [$operator, $value]];
            }
            return $this;
        }

        public function whereLike($field, $value)
        {
            $this->where[] = [$field, ['like', $value]];
            return $this;
        }

        public function field($field)
        {
            $this->field = $field;
            return $this;
        }

        public function distinct($distinct)
        {
            $this->distinct = (bool) $distinct;
            return $this;
        }

        public function group($field)
        {
            $this->group = $field;
            return $this;
        }

        public function order($order)
        {
            $this->order = $order;
            return $this;
        }

        public function limit($limit)
        {
            $this->limit = intval($limit);
            return $this;
        }

        public function find()
        {
            $rows = $this->filteredRows();
            return $rows[0] ?? null;
        }

        public function select()
        {
            $rows = $this->filteredRows();
            if ($this->group !== '') {
                $grouped = [];
                foreach ($rows as $row) {
                    $value = (string) ($row[$this->group] ?? '');
                    if (!isset($grouped[$value])) {
                        $grouped[$value] = ['value' => $value, 'total' => 0];
                    }
                    $grouped[$value]['total']++;
                }
                $rows = array_values($grouped);
            } elseif ($this->distinct && preg_match('/^([a-z_]+) as value$/', $this->field, $matches)) {
                $distinct = [];
                foreach ($rows as $row) {
                    $value = (string) ($row[$matches[1]] ?? '');
                    $distinct[$value] = ['value' => $value];
                }
                $rows = array_values($distinct);
            }

            if ($this->order !== '') {
                $order = $this->order;
                usort($rows, static function ($left, $right) use ($order) {
                    if (strpos($order, 'total desc') !== false) {
                        return intval($right['total'] ?? 0) <=> intval($left['total'] ?? 0);
                    }
                    return strcmp((string) ($right['value'] ?? ''), (string) ($left['value'] ?? ''));
                });
            }

            if ($this->limit > 0) {
                $rows = array_slice($rows, 0, $this->limit);
            }
            return $rows;
        }

        private function filteredRows()
        {
            return array_values(array_filter(Db::$tables[$this->table] ?? [], function ($row) {
                foreach ($this->where as [$field, $condition]) {
                    $actual = (string) ($row[$field] ?? '');
                    $operator = $condition[0] ?? '=';
                    $expected = $condition[1] ?? '';
                    if ($operator === '=' && $actual !== (string) $expected) {
                        return false;
                    }
                    if ($operator === '<>' && $actual === (string) $expected) {
                        return false;
                    }
                    if ($operator === 'in' && !in_array($actual, array_map('strval', (array) $expected), true)) {
                        return false;
                    }
                    if ($operator === 'like') {
                        $needle = trim((string) $expected, '%');
                        if ($needle !== '' && strpos($actual, $needle) === false) {
                            return false;
                        }
                    }
                }
                return true;
            }));
        }
    }
}

namespace {
    use addons\pingfangdevice\service\VodFilterOptions;
    use think\Db;

    $filterCache = [];
    $typeModel = new class {
        public function getCache($name)
        {
            return [
                47 => ['type_id' => 47, 'type_pid' => 0, 'type_extend' => ''],
                99 => ['type_id' => 99, 'type_pid' => 47, 'type_extend' => ''],
                57 => ['type_id' => 57, 'type_pid' => 0, 'type_extend' => ''],
            ];
        }
    };

    function cache($key, $value = null, $seconds = null)
    {
        global $filterCache;
        if (func_num_args() === 1) {
            return $filterCache[$key] ?? null;
        }
        $filterCache[$key] = $value;
        return $value;
    }

    function config($name)
    {
        $app = [
            'vod_extend_area' => '大陆,香港,美国,火星',
            'vod_extend_year' => '2021,2020,2019,2018,2017,2016,2015,2014,2013,2012,2011,2010,2009,2008,2007,2006,2005,2004,2003,2002,2001,2000',
            'vod_extend_lang' => '国语,英语,粤语',
        ];
        return $name === 'maccms' ? ['app' => $app] : ($app[str_replace('maccms.app.', '', $name)] ?? null);
    }

    function model($name)
    {
        global $typeModel;
        return $typeModel;
    }

    $fail = static function ($message) {
        fwrite(STDERR, $message . "\n");
        exit(1);
    };
    $assertSame = static function ($expected, $actual, $message) use ($fail) {
        if ($expected !== $actual) {
            $fail($message . "\nExpected: " . var_export($expected, true) . "\nActual: " . var_export($actual, true));
        }
    };
    $assertSet = static function ($expected, $actual, $message) use ($assertSame) {
        sort($expected);
        sort($actual);
        $assertSame($expected, $actual, $message);
    };
    $values = static function ($options) {
        return array_column($options, 'value');
    };
    $aliases = static function ($options, $value) use ($fail) {
        foreach ($options as $option) {
            if (($option['value'] ?? '') === $value) {
                return array_values(array_filter(array_map('trim', explode(',', (string) ($option['query'] ?? '')))));
            }
        }
        $fail('Missing filter option: ' . $value);
    };

    require_once dirname(__DIR__) . '/addons/pingfangdevice/service/VodFilterOptions.php';

    Db::$tables['vod'] = [
        ['vod_status' => 1, 'type_id' => 47, 'vod_area' => '德国', 'vod_year' => '2026', 'vod_lang' => '泰语', 'vod_class' => '', 'vod_letter' => 'D'],
        ['vod_status' => 1, 'type_id' => 47, 'vod_area' => '澳大利亚', 'vod_year' => '1999', 'vod_lang' => '英语', 'vod_class' => '', 'vod_letter' => 'A'],
        ['vod_status' => 1, 'type_id' => 99, 'vod_area' => '大陆', 'vod_year' => '1902', 'vod_lang' => '国语', 'vod_class' => '', 'vod_letter' => 'L'],
        ['vod_status' => 1, 'type_id' => 47, 'vod_area' => '内地', 'vod_year' => '2025', 'vod_lang' => '国语', 'vod_class' => '', 'vod_letter' => 'N'],
        ['vod_status' => 1, 'type_id' => 47, 'vod_area' => '中内地地', 'vod_year' => '2024', 'vod_lang' => '国语国语', 'vod_class' => '', 'vod_letter' => 'Z'],
        ['vod_status' => 1, 'type_id' => 47, 'vod_area' => '香港 / 中内地地', 'vod_year' => '2023', 'vod_lang' => '中国大陆', 'vod_class' => '', 'vod_letter' => 'X'],
        ['vod_status' => 1, 'type_id' => 47, 'vod_area' => 'USA', 'vod_year' => '2022', 'vod_lang' => '印尼语 Indone', 'vod_class' => '', 'vod_letter' => 'U'],
        ['vod_status' => 1, 'type_id' => 47, 'vod_area' => 'UK', 'vod_year' => '2021', 'vod_lang' => 'German', 'vod_class' => '', 'vod_letter' => 'U'],
        ['vod_status' => 1, 'type_id' => 57, 'vod_area' => '日本', 'vod_year' => '2020', 'vod_lang' => '日语', 'vod_class' => '', 'vod_letter' => 'J'],
        ['vod_status' => 1, 'type_id' => 47, 'vod_area' => '国语', 'vod_year' => '2020', 'vod_lang' => '全集完结', 'vod_class' => '', 'vod_letter' => 'G'],
        ['vod_status' => 1, 'type_id' => 47, 'vod_area' => '香港,大陆', 'vod_year' => '2020', 'vod_lang' => '英语,法语', 'vod_class' => '', 'vod_letter' => 'H'],
        ['vod_status' => 1, 'type_id' => 47, 'vod_area' => '中国动漫', 'vod_year' => '2020', 'vod_lang' => '加拿大语', 'vod_class' => '', 'vod_letter' => 'C'],
        ['vod_status' => 1, 'type_id' => 47, 'vod_area' => '没广告', 'vod_year' => '2020', 'vod_lang' => '阿拉伯语波斯语', 'vod_class' => '', 'vod_letter' => 'M'],
        ['vod_status' => 1, 'type_id' => 47, 'vod_area' => '法国美国德国', 'vod_year' => '2020', 'vod_lang' => '澳大利亚语', 'vod_class' => '', 'vod_letter' => 'F'],
        ['vod_status' => 1, 'type_id' => 47, 'vod_area' => '希', 'vod_year' => '2020', 'vod_lang' => '南非语', 'vod_class' => '', 'vod_letter' => 'X'],
        ['vod_status' => 1, 'type_id' => 47, 'vod_area' => '德国', 'vod_year' => '20258', 'vod_lang' => '泰语', 'vod_class' => '', 'vod_letter' => 'B'],
    ];

    $result = VodFilterOptions::filters(['type_id' => 47, 'limit' => 200]);
    $areaOptions = $result['data']['filters']['area'];
    $languageOptions = $result['data']['filters']['lang'];
    $assertSet(['大陆', '香港', '美国', '英国', '德国', '日本', '澳大利亚', '希腊'], $values($areaOptions), 'Areas must be derived from meaningful values stored on the server, across all video types.');
    $assertSet(['大陆', '内地', '中内地地', '香港 / 中内地地'], $aliases($areaOptions, '大陆'), 'Area aliases must collapse to one usable filter option.');
    $assertSame(['USA'], $aliases($areaOptions, '美国'), 'Configured values must not appear unless a matching server value exists.');
    $assertSame(false, in_array('火星', $values($areaOptions), true), 'Configuration may order dynamic options but must not add missing values.');
    $assertSame(false, in_array('国语', $values($areaOptions), true), 'Language values stored in the area column must be rejected.');
    $assertSame(false, in_array('中国动漫', $values($areaOptions), true), 'Content labels stored in the area column must be rejected.');
    $assertSame(false, in_array('没广告', $values($areaOptions), true), 'Advertising text stored in the area column must be rejected.');
    $assertSame(false, in_array('法国美国德国', $values($areaOptions), true), 'Unseparated multi-area values must not become one filter label.');
    $assertSame(['2026', '2025', '2024', '2023', '2022', '2021', '2020', '1999', '1902'], $values($result['data']['filters']['year']), 'Years must include all valid server values and reject malformed values.');
    $assertSet(['国语', '英语', '日语', '德语', '印尼语', '泰语', '南非荷兰语'], $values($languageOptions), 'Languages must be normalized from meaningful values stored on the server.');
    $assertSet(['国语', '国语国语'], $aliases($languageOptions, '国语'), 'Repeated language variants must collapse to one usable option.');
    $assertSet(['英语', '澳大利亚语'], $aliases($languageOptions, '英语'), 'Clear country-language aliases must collapse to the actual language option.');
    $assertSame(['印尼语 Indone'], $aliases($languageOptions, '印尼语'), 'Truncated English suffixes must not leak into the displayed language label.');
    $assertSame(false, in_array('中国大陆', $values($languageOptions), true), 'Area values stored in the language column must be rejected.');
    $assertSame(false, in_array('加拿大语', $values($languageOptions), true), 'Ambiguous country names must not be presented as languages.');
    $assertSame(false, in_array('阿拉伯语波斯语', $values($languageOptions), true), 'Unseparated multi-language values must not become one filter label.');

    $filterCache = [];
    $filtered = VodFilterOptions::filters(['type_id' => 47, 'area' => '德国', 'limit' => 200]);
    $assertSame($values($result['data']['filters']['year']), $values($filtered['data']['filters']['year']), 'Server-derived filter options must remain complete instead of shrinking with the current selection.');

    $filterCache = [];
    Db::$tables['vod'] = [];
    foreach (range(intval(date('Y')), intval(date('Y')) - 99) as $year) {
        Db::$tables['vod'][] = [
            'vod_status' => 1,
            'type_id' => 47,
            'vod_area' => '大陆',
            'vod_year' => (string) $year,
            'vod_lang' => '国语',
            'vod_class' => '',
            'vod_letter' => 'A',
        ];
    }
    $manyYears = VodFilterOptions::filters(['type_id' => 47, 'limit' => 200]);
    $assertSame(100, count($manyYears['data']['filters']['year']), 'Dynamic years must not be truncated at the old 80-option limit.');

    echo "Vod filter option tests passed.\n";
}
