<?php

namespace addons\pingfangdevice\service;

use think\Db;

class VodFilterOptions
{
    const VOD_TABLE = 'vod';
    const CACHE_VERSION = 'v6';
    const CACHE_SECONDS = 120;
    const MAX_OPTIONS = 1000;
    const MAX_ALIASES = 12;
    const MAX_QUERY_LENGTH = 180;

    public static function filters(array $input)
    {
        $params = self::normalizeInput($input);
        $priorities = [
            'area' => self::configuredPriority('area'),
            'lang' => self::configuredPriority('lang'),
        ];
        $cacheContext = [
            'limit' => $params['limit'],
            'priorities' => $priorities,
        ];
        $cacheKey = 'pingfang_vod_filter_options_' . self::CACHE_VERSION . '_' . md5(json_encode($cacheContext, JSON_UNESCAPED_UNICODE));
        $filters = null;

        if (function_exists('cache')) {
            $cached = cache($cacheKey);
            if (is_array($cached)) {
                $filters = $cached;
            }
        }

        if (!is_array($filters)) {
            $filters = [
                'area' => self::dimensionOptions('area', $params['limit'], $priorities['area']),
                'year' => self::dimensionOptions('year', $params['limit'], []),
                'lang' => self::dimensionOptions('lang', $params['limit'], $priorities['lang']),
            ];
            if (function_exists('cache')) {
                cache($cacheKey, $filters, self::CACHE_SECONDS);
            }
        }

        return [
            'code' => 1,
            'msg' => 'ok',
            'data' => [
                'filters' => $filters,
                'params' => self::responseParams($params),
            ],
        ];
    }

    private static function dimensionOptions($dimension, $limit, array $priority)
    {
        $fields = self::filterFields();
        if (empty($fields[$dimension])) {
            return [];
        }

        $field = $fields[$dimension];
        // Keep this query on the single-column vod_* index. Adding status or type
        // conditions makes MySQL scan and aggregate the full visible catalogue.
        $rows = self::rowsToArray(Db::name(self::VOD_TABLE)
            ->where($field, '<>', '')
            ->distinct(true)
            ->field($field . ' as value')
            ->order($field . ($dimension === 'year' ? ' desc' : ' asc'))
            ->limit(self::MAX_OPTIONS)
            ->select());

        if ($dimension === 'year') {
            return self::yearOptions($rows, $limit);
        }

        return self::namedOptions($dimension, $rows, $limit, $priority);
    }

    private static function yearOptions(array $rows, $limit)
    {
        $years = [];
        foreach ($rows as $row) {
            $year = trim((string) ($row['value'] ?? ''));
            if (self::isValidYearValue($year)) {
                $years[$year] = [
                    'value' => $year,
                    'label' => $year,
                    'query' => $year,
                ];
            }
        }

        krsort($years, SORT_NUMERIC);
        return array_slice(array_values($years), 0, $limit);
    }

    private static function namedOptions($dimension, array $rows, $limit, array $priority)
    {
        $groups = [];
        foreach ($rows as $row) {
            $raw = trim((string) ($row['value'] ?? ''));
            if ($raw === '' || self::charLength($raw) > 40 || strpos($raw, ',') !== false) {
                continue;
            }

            foreach (self::labelsForRawValue($dimension, $raw) as $label) {
                if (!isset($groups[$label])) {
                    $groups[$label] = [];
                }
                $groups[$label][$raw] = $raw;
            }
        }

        $options = [];
        foreach ($groups as $label => $aliases) {
            $query = self::aliasQuery($label, array_values($aliases));
            if ($query === '') {
                continue;
            }
            $options[] = [
                'value' => $label,
                'label' => $label,
                'query' => $query,
            ];
        }

        $priorityOrder = array_flip(array_values(array_unique($priority)));
        usort($options, static function ($left, $right) use ($priorityOrder) {
            $leftOrder = $priorityOrder[$left['value']] ?? PHP_INT_MAX;
            $rightOrder = $priorityOrder[$right['value']] ?? PHP_INT_MAX;
            if ($leftOrder !== $rightOrder) {
                return $leftOrder <=> $rightOrder;
            }
            return strcmp((string) $left['value'], (string) $right['value']);
        });

        return array_slice($options, 0, $limit);
    }

    private static function labelsForRawValue($dimension, $raw)
    {
        $parts = preg_split('/\s*(?:\/|，|、|\||;|；)\s*/u', $raw);
        if (!is_array($parts)) {
            return [];
        }

        $labels = [];
        foreach ($parts as $part) {
            $label = $dimension === 'area'
                ? self::normalizeAreaLabel($part)
                : self::normalizeLanguageLabel($part);
            if ($label !== '') {
                $labels[$label] = $label;
            }
        }
        return array_values($labels);
    }

    private static function normalizeAreaLabel($value)
    {
        $value = self::stripTrailingEnglish(trim((string) $value));
        $aliases = [
            '内地' => '大陆',
            '中国' => '大陆',
            '中国内地' => '大陆',
            '中国大陆' => '大陆',
            '中内地地' => '大陆',
            '中国香港' => '香港',
            '中国台湾' => '台湾',
            '中国澳门' => '澳门',
            '其它' => '其他',
            '印尼' => '印度尼西亚',
            '俄国' => '俄罗斯',
            '俄羅斯' => '俄罗斯',
            '台灣' => '台湾',
            '蘇聯' => '苏联',
            '前苏联' => '苏联',
            '这个内地' => '大陆',
            '克罗地亚版' => '克罗地亚',
            '北马其' => '北马其顿',
            '马其顿' => '北马其顿',
            '塞尔维' => '塞尔维亚',
            '塞尔维亚共和国' => '塞尔维亚',
            '印地' => '印度',
            '孟加拉' => '孟加拉国',
            '沙特阿' => '沙特阿拉伯',
            '沙特阿拉' => '沙特阿拉伯',
            '法' => '法国',
            '芬' => '芬兰',
            '希' => '希腊',
            '菲利兵' => '菲律宾',
            '马拉西亚' => '马来西亚',
            '泰剧' => '泰国',
            '迪拜' => '阿联酋',
            '欧美其他' => '欧美',
            '欧美地区' => '欧美',
            'USA' => '美国',
            'US' => '美国',
            'U.S.A.' => '美国',
            'UK' => '英国',
            'U.K.' => '英国',
        ];
        if (isset($aliases[$value])) {
            return $aliases[$value];
        }

        $value = preg_replace('/\s+/u', '', $value);
        if ($value === '' || preg_match('/(?:语|话|方言|文)$/u', $value)) {
            return '';
        }
        $invalid = [
            '北京', '卡', '大力', '大理', '大罗', '我', '找打了', '皆可', '知道了', '题本',
            '斯洛', '瑞', '伊朗黎巴嫩', '法国美国德国', '斯洛伐克捷克',
        ];
        if (in_array($value, $invalid, true)) {
            return '';
        }
        if (preg_match('/(?:暂无|未知|完结|全集|高清|字幕|中字|广告|动漫|核动力|电科)/u', $value)) {
            return '';
        }
        return preg_match('/^[\p{Han}·]{1,12}$/u', $value) ? $value : '';
    }

    private static function normalizeLanguageLabel($value)
    {
        $value = trim((string) $value);
        $englishAliases = [
            'german' => '德语',
            'hindi' => '印地语',
            'serbian' => '塞尔维亚语',
            'tagalog' => '菲律宾语',
            'telugu' => '泰卢固语',
        ];
        $lower = strtolower($value);
        if (isset($englishAliases[$lower])) {
            return $englishAliases[$lower];
        }

        $value = self::stripTrailingEnglish($value);
        $value = preg_replace('/\s+/u', '', $value);
        $value = self::collapseRepeatedValue($value);
        $aliases = [
            '中文' => '国语',
            '华语' => '国语',
            '普通话' => '国语',
            '其它' => '其他',
            '外语' => '其他',
            '印度尼西亚语' => '印尼语',
            '他加禄语' => '菲律宾语',
            '他家禄语' => '菲律宾语',
            '塔加洛语' => '菲律宾语',
            '塔加拉族语' => '菲律宾语',
            '菲利宾语' => '菲律宾语',
            '菲律賓语' => '菲律宾语',
            '俄罗斯语' => '俄语',
            '北印地语' => '印地语',
            '北印度语' => '印地语',
            '印度语' => '印地语',
            '马来西亚语' => '马来语',
            '墨西哥语' => '西班牙语',
            '阿根廷语' => '西班牙语',
            '多米尼加语' => '西班牙语',
            '巴西班牙语' => '葡萄牙语',
            '萄牙语' => '葡萄牙语',
            '澳大利亚语' => '英语',
            '新西兰语' => '英语',
            '以色列语' => '希伯来语',
            '现代希伯来语' => '希伯来语',
            '伊朗语' => '波斯语',
            '哈萨克斯坦语' => '哈萨克语',
            '黎巴嫩语' => '阿拉伯语',
            '朝鲜语' => '韩语',
            '汉语普通话' => '国语',
            '语国语' => '国语',
            '越语' => '越南语',
            '坦米尔语' => '泰米尔语',
            '塔米尔语' => '泰米尔语',
            '坎纳达语' => '卡纳达语',
            '坎那达语' => '卡纳达语',
            '马拉亚兰语' => '马拉雅拉姆语',
            '马来亚拉姆语' => '马拉雅拉姆语',
            '尼德兰语' => '荷兰语',
            '闽南话' => '闽南语',
            '南非语' => '南非荷兰语',
            '阿非利卡语' => '南非荷兰语',
            '弗拉芒语' => '佛兰芒语',
            '加里西亚语' => '加利西亚语',
            '奇楚亚语' => '克丘亚语',
            '宗喀语' => '宗卡语',
        ];
        if (isset($aliases[$value])) {
            $value = $aliases[$value];
        }

        if (in_array($value, ['加拿大语', '尼日利亚语', '新加坡语', '瑞士语', '新马语'], true)) {
            return '';
        }
        if (substr_count($value, '语') > 1) {
            return '';
        }
        if (in_array($value, ['无对白', '手语', '其他'], true)) {
            return $value;
        }
        if (self::charLength($value) > 15) {
            return '';
        }
        return preg_match('/^[\p{Han}·]+(?:语|话|方言)$/u', $value) ? $value : '';
    }

    private static function stripTrailingEnglish($value)
    {
        if (!preg_match('/\p{Han}/u', $value)) {
            return $value;
        }
        return trim((string) preg_replace('/\s*[A-Za-z][A-Za-z ._-]*$/u', '', $value));
    }

    private static function collapseRepeatedValue($value)
    {
        $length = self::charLength($value);
        if ($length < 2 || $length % 2 !== 0) {
            return $value;
        }
        $half = function_exists('mb_substr')
            ? mb_substr($value, 0, intval($length / 2), 'UTF-8')
            : substr($value, 0, intval(strlen($value) / 2));
        return $half . $half === $value ? $half : $value;
    }

    private static function aliasQuery($label, array $aliases)
    {
        usort($aliases, static function ($left, $right) use ($label) {
            if ($left === $label) {
                return -1;
            }
            if ($right === $label) {
                return 1;
            }
            $lengthOrder = self::charLength($left) <=> self::charLength($right);
            return $lengthOrder !== 0 ? $lengthOrder : strcmp($left, $right);
        });

        $selected = [];
        $length = 0;
        foreach ($aliases as $alias) {
            $nextLength = $length + ($selected ? 1 : 0) + self::charLength($alias);
            if (count($selected) >= self::MAX_ALIASES || $nextLength > self::MAX_QUERY_LENGTH) {
                continue;
            }
            $selected[] = $alias;
            $length = $nextLength;
        }
        return implode(',', $selected);
    }

    private static function configuredPriority($dimension)
    {
        if (!function_exists('config')) {
            return [];
        }

        $value = '';
        $maccms = config('maccms');
        if (is_array($maccms) && isset($maccms['app']['vod_extend_' . $dimension])) {
            $value = (string) $maccms['app']['vod_extend_' . $dimension];
        } else {
            $value = (string) config('maccms.app.vod_extend_' . $dimension);
        }

        $priority = [];
        foreach (explode(',', $value) as $item) {
            $label = $dimension === 'area'
                ? self::normalizeAreaLabel($item)
                : self::normalizeLanguageLabel($item);
            if ($label !== '') {
                $priority[$label] = $label;
            }
        }
        return array_values($priority);
    }

    private static function isValidYearValue($value)
    {
        if (!preg_match('/^[0-9]{4}$/', (string) $value)) {
            return false;
        }

        $year = intval($value);
        return $year >= 1900 && $year <= intval(date('Y'));
    }

    private static function filterFields()
    {
        return [
            'area' => 'vod_area',
            'year' => 'vod_year',
            'lang' => 'vod_lang',
        ];
    }

    private static function normalizeInput(array $input)
    {
        return [
            'type_id' => max(0, intval($input['type_id'] ?? $input['type'] ?? 0)),
            'area' => self::cleanValue($input['area'] ?? ''),
            'year' => self::cleanValue($input['year'] ?? ''),
            'lang' => self::cleanValue($input['lang'] ?? ''),
            'class' => self::cleanValue($input['class'] ?? ''),
            'letter' => self::cleanValue($input['letter'] ?? ''),
            'limit' => max(1, min(self::MAX_OPTIONS, intval($input['limit'] ?? self::MAX_OPTIONS))),
        ];
    }

    private static function responseParams(array $params)
    {
        return $params;
    }

    private static function cleanValue($value)
    {
        $value = trim(strip_tags((string) $value));
        $value = str_replace(["\r", "\n", "\t"], '', $value);
        if (function_exists('mb_substr')) {
            return mb_substr($value, 0, 40, 'UTF-8');
        }
        return substr($value, 0, 120);
    }

    private static function charLength($value)
    {
        return function_exists('mb_strlen') ? mb_strlen((string) $value, 'UTF-8') : strlen((string) $value);
    }

    private static function rowsToArray($rows)
    {
        if (is_object($rows) && method_exists($rows, 'toArray')) {
            $rows = $rows->toArray();
        }
        return is_array($rows) ? $rows : [];
    }
}
