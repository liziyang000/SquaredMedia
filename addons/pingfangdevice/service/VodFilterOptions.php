<?php

namespace addons\pingfangdevice\service;

use think\Db;

class VodFilterOptions
{
    const VOD_TABLE = 'vod';
    const CACHE_VERSION = 'v3';
    const CACHE_SECONDS = 120;

    public static function filters(array $input)
    {
        $params = self::normalizeInput($input);
        $params['type_ids'] = self::typeScope($params['type_id']);
        $cacheKey = 'pingfang_vod_filter_options_' . self::CACHE_VERSION . '_' . md5(json_encode($params, JSON_UNESCAPED_UNICODE));

        if (function_exists('cache')) {
            $cached = cache($cacheKey);
            if (is_array($cached)) {
                return ['code' => 1, 'msg' => 'ok', 'data' => $cached];
            }
        }

        $data = [
            'filters' => [
                'area' => self::dimensionOptions('area', $params),
                'year' => self::dimensionOptions('year', $params),
                'lang' => self::dimensionOptions('lang', $params),
            ],
            'params' => self::responseParams($params),
        ];

        if (function_exists('cache')) {
            cache($cacheKey, $data, self::CACHE_SECONDS);
        }

        return ['code' => 1, 'msg' => 'ok', 'data' => $data];
    }

    private static function dimensionOptions($dimension, array $params)
    {
        $fields = self::filterFields();
        if (empty($fields[$dimension])) {
            return [];
        }

        $candidates = self::dimensionCandidates($dimension, $params['type_id']);
        if (!empty($candidates)) {
            return self::candidateOptions($dimension, $params, $candidates);
        }

        return self::queryDimensionOptions($dimension, $params);
    }

    private static function candidateOptions($dimension, array $params, array $candidates)
    {
        $options = [];
        foreach ($candidates as $value) {
            $value = trim((string) $value);
            if ($value === '') {
                continue;
            }
            if ($dimension === 'year' && !self::isValidYearValue($value)) {
                continue;
            }
            if (!self::optionExists($dimension, $value, $params)) {
                continue;
            }

            $options[] = [
                'value' => $value,
                'total' => 0,
            ];
            if (count($options) >= $params['limit']) {
                break;
            }
        }

        return $options;
    }

    private static function queryDimensionOptions($dimension, array $params)
    {
        $fields = self::filterFields();
        $field = $fields[$dimension];
        $query = self::baseQuery($params, $dimension)
            ->field($field . ' as value, count(*) as total')
            ->where($field, '<>', '');

        $queryLimit = $dimension === 'year' ? max($params['limit'] * 4, 120) : $params['limit'];
        $query = $query->group($field)
            ->order($dimension === 'year' ? $field . ' desc' : 'total desc')
            ->limit($queryLimit);

        $rows = self::rowsToArray($query->select());
        $options = [];
        foreach ($rows as $row) {
            $value = trim((string) ($row['value'] ?? ''));
            if ($value === '') {
                continue;
            }
            if ($dimension === 'year' && !self::isValidYearValue($value)) {
                continue;
            }
            $options[] = [
                'value' => $value,
                'total' => intval($row['total'] ?? 0),
            ];
            if (count($options) >= $params['limit']) {
                break;
            }
        }

        return $options;
    }

    private static function optionExists($dimension, $value, array $params)
    {
        $fields = self::filterFields();
        if (empty($fields[$dimension])) {
            return false;
        }

        $row = self::baseQuery($params, $dimension)
            ->where($fields[$dimension], $value)
            ->field('vod_id')->find();

        return !empty($row);
    }

    private static function baseQuery(array $params, $withoutDimension)
    {
        $query = Db::name(self::VOD_TABLE)->where('vod_status', 1);
        $typeIds = $params['type_ids'] ?? self::typeScope($params['type_id']);
        if (!empty($typeIds)) {
            $query = $query->where('type_id', 'in', $typeIds);
        }

        foreach (self::filterFields() as $dimension => $field) {
            if ($dimension === $withoutDimension || $params[$dimension] === '') {
                continue;
            }
            $query = $query->where($field, 'in', self::csvValues($params[$dimension]));
        }

        if ($params['class'] !== '') {
            if (function_exists('mac_like_arr')) {
                $query = $query->where(['vod_class' => ['like', mac_like_arr($params['class']), 'OR']]);
            } else {
                $query = $query->whereLike('vod_class', '%' . $params['class'] . '%');
            }
        }

        if ($params['letter'] !== '') {
            $letters = $params['letter'] === '0~9' ? ['0','1','2','3','4','5','6','7','8','9'] : self::csvValues($params['letter']);
            $query = $query->where('vod_letter', 'in', $letters);
        }

        return $query;
    }

    private static function isValidYearValue($value)
    {
        if (!preg_match('/^[0-9]{4}$/', (string) $value)) {
            return false;
        }

        $year = intval($value);
        return $year >= 1900 && $year <= intval(date('Y'));
    }

    private static function dimensionCandidates($dimension, $typeId)
    {
        $value = '';
        $type = self::typeInfo($typeId);
        if (!empty($type)) {
            $value = self::typeExtendValue($type, $dimension);
        }

        if ($value === '' && !empty($type['type_pid'])) {
            $parent = self::typeInfo($type['type_pid']);
            if (!empty($parent)) {
                $value = self::typeExtendValue($parent, $dimension);
            }
        }

        if ($value === '') {
            $value = self::globalExtendValue($dimension);
        }

        return self::csvValues($value);
    }

    private static function globalExtendValue($dimension)
    {
        if (!function_exists('config')) {
            return '';
        }

        $maccms = config('maccms');
        if (is_array($maccms) && isset($maccms['app']['vod_extend_' . $dimension])) {
            return trim((string) $maccms['app']['vod_extend_' . $dimension]);
        }

        return trim((string) config('maccms.app.vod_extend_' . $dimension));
    }

    private static function typeInfo($typeId)
    {
        $typeId = intval($typeId);
        if ($typeId < 1) {
            return [];
        }

        try {
            $typeList = model('Type')->getCache('type_list');
            if (is_array($typeList)) {
                if (!empty($typeList[$typeId]) && is_array($typeList[$typeId])) {
                    return $typeList[$typeId];
                }
                foreach ($typeList as $type) {
                    if (intval($type['type_id'] ?? 0) === $typeId) {
                        return is_array($type) ? $type : [];
                    }
                }
            }
        } catch (\Throwable $e) {
        }

        try {
            return self::rowToArray(Db::name('type')
                ->where('type_id', $typeId)
                ->field('type_id,type_pid,type_extend')
                ->find());
        } catch (\Throwable $e) {
            return [];
        }
    }

    private static function typeExtendValue(array $type, $dimension)
    {
        $extend = $type['type_extend'] ?? '';
        if (is_string($extend)) {
            $extend = trim($extend);
            if ($extend === '') {
                return '';
            }

            $decoded = json_decode($extend, true);
            if (is_array($decoded)) {
                $extend = $decoded;
            } else {
                $decoded = @unserialize($extend);
                $extend = is_array($decoded) ? $decoded : [];
            }
        }

        if (!is_array($extend)) {
            return '';
        }

        return trim((string) ($extend[$dimension] ?? ''));
    }

    private static function typeScope($typeId)
    {
        $typeId = intval($typeId);
        if ($typeId < 1) {
            return [];
        }

        $ids = [$typeId];
        try {
            $typeList = model('Type')->getCache('type_list');
            if (is_array($typeList)) {
                foreach ($typeList as $type) {
                    if (intval($type['type_id'] ?? 0) === $typeId || intval($type['type_pid'] ?? 0) === $typeId) {
                        $ids[] = intval($type['type_id']);
                    }
                }
            }
        } catch (\Throwable $e) {
            return [$typeId];
        }

        return array_values(array_unique(array_filter($ids)));
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
            'limit' => max(1, min(80, intval($input['limit'] ?? 60))),
        ];
    }

    private static function responseParams(array $params)
    {
        unset($params['type_ids']);
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

    private static function csvValues($value)
    {
        return array_values(array_filter(array_map('trim', explode(',', (string) $value)), static function ($item) {
            return $item !== '';
        }));
    }

    private static function rowsToArray($rows)
    {
        if (is_object($rows) && method_exists($rows, 'toArray')) {
            $rows = $rows->toArray();
        }
        return is_array($rows) ? $rows : [];
    }

    private static function rowToArray($row)
    {
        if (is_object($row) && method_exists($row, 'toArray')) {
            $row = $row->toArray();
        }
        return is_array($row) ? $row : [];
    }
}
