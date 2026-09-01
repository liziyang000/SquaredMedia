<?php

namespace addons\vodops\service;

use think\Db;

class VodLibrary
{
    private const VOD_TABLE = 'vod';
    private const TYPE_TABLE = 'type';
    private const SEO_TABLE = 'seo_ai_result';

    public static function statusOptions()
    {
        return [
            'all' => '全部状态',
            '0' => '待审核',
            '1' => '已审核',
        ];
    }

    public static function listVideos(array $input = [])
    {
        $filters = self::normalizeFilters($input);
        $query = Db::name(self::VOD_TABLE)
            ->alias('v')
            ->join(self::tableName(self::TYPE_TABLE) . ' ty', 'ty.type_id = v.type_id', 'LEFT')
            ->field(
                'v.vod_id,v.vod_name,v.vod_status,v.vod_isend,v.vod_serial,v.vod_remarks,' .
                'v.vod_play_from,v.vod_time,ty.type_name'
            )
            ->where('v.vod_recycle_time', 0);

        if ($filters['q'] !== '') {
            if (ctype_digit($filters['q'])) {
                $query = $query->where('v.vod_id', intval($filters['q']));
            } else {
                $query = $query->whereLike('v.vod_name', self::likeValue($filters['q']) . '%');
            }
        }
        if ($filters['type_id'] > 0) {
            $query = $query->where('v.type_id|v.type_id_1', $filters['type_id']);
        }
        if ($filters['status'] !== 'all') {
            $query = $query->where('v.vod_status', intval($filters['status']));
        }
        if ($filters['isend'] !== 'all') {
            $query = $query->where('v.vod_isend', intval($filters['isend']));
        }
        if ($filters['pic'] === 'missing') {
            $query = $query->where('v.vod_pic', '');
        } elseif ($filters['pic'] === 'remote') {
            $query = $query->whereLike('v.vod_pic', 'http%');
        }
        if ($filters['source'] !== '') {
            $query = $query->whereLike('v.vod_play_from', '%' . self::likeValue($filters['source']) . '%');
        }

        $seoPredicate = self::seoPredicate($filters['seo']);
        if ($seoPredicate !== '') {
            $query = $query->where('_string', $seoPredicate);
        }

        $offset = ($filters['page'] - 1) * $filters['limit'];
        $limit = $filters['limit'];
        $rows = self::toArray($query
            ->order('v.vod_time desc,v.vod_id desc')
            ->limit($offset, $limit + 1)
            ->select());
        $hasNext = count($rows) > $limit;
        if ($hasNext) {
            $rows = array_slice($rows, 0, $limit);
        }

        return [
            'data' => self::decorateRows($rows),
            'filters' => $filters,
            'page' => $filters['page'],
            'limit' => $limit,
            'has_prev' => $filters['page'] > 1,
            'has_next' => $hasNext,
        ];
    }

    private static function normalizeFilters(array $input)
    {
        $status = (string) ($input['status'] ?? 'all');
        if (!array_key_exists($status, self::statusOptions())) {
            $status = 'all';
        }
        $isend = (string) ($input['isend'] ?? 'all');
        if (!in_array($isend, ['all', '0', '1'], true)) {
            $isend = 'all';
        }
        $seo = strtolower(trim((string) ($input['seo'] ?? 'all')));
        if (!in_array($seo, ['all', 'none', 'optimized', 'fallback'], true)) {
            $seo = 'all';
        }
        $pic = strtolower(trim((string) ($input['pic'] ?? 'all')));
        if (!in_array($pic, ['all', 'missing', 'remote'], true)) {
            $pic = 'all';
        }
        $limit = intval($input['limit'] ?? 30);
        if (!in_array($limit, [20, 30, 50], true)) {
            $limit = 30;
        }

        return [
            'q' => self::cleanText($input['q'] ?? '', 80),
            'type_id' => max(0, intval($input['type_id'] ?? 0)),
            'status' => $status,
            'isend' => $isend,
            'source' => self::cleanSource($input['source'] ?? ''),
            'seo' => $seo,
            'pic' => $pic,
            'limit' => $limit,
            'page' => max(1, min(10000, intval($input['page'] ?? 1))),
        ];
    }

    private static function decorateRows(array $rows)
    {
        $seoByVodId = self::seoStatuses(array_column($rows, 'vod_id'));
        $statusOptions = self::statusOptions();
        foreach ($rows as &$row) {
            $vodId = max(0, intval($row['vod_id'] ?? 0));
            $sources = array_values(array_unique(array_filter(array_map('trim', explode('$$$', (string) ($row['vod_play_from'] ?? ''))))));
            $seoStatus = intval($seoByVodId[$vodId] ?? 0);
            $row['vod_id'] = $vodId;
            $row['source_count'] = count($sources);
            $row['source_preview'] = implode('、', array_slice($sources, 0, 3));
            $row['status_label'] = $statusOptions[(string) intval($row['vod_status'] ?? 0)] ?? '未知状态';
            $row['seo_status'] = $seoStatus;
            $row['seo_status_label'] = $seoStatus === 1 ? '已优化' : ($seoStatus === 2 ? '已降级' : '未生成');
            $row['updated_at_label'] = intval($row['vod_time'] ?? 0) > 0
                ? date('Y-m-d H:i', intval($row['vod_time']))
                : '-';
        }
        unset($row);
        return $rows;
    }

    private static function seoStatuses(array $vodIds)
    {
        $vodIds = array_values(array_filter(array_unique(array_map('intval', $vodIds))));
        if (empty($vodIds)) {
            return [];
        }

        try {
            $rows = self::toArray(Db::name(self::SEO_TABLE)
                ->field('seo_obj_id,seo_status')
                ->where('seo_mid', 1)
                ->whereIn('seo_obj_id', $vodIds)
                ->whereIn('seo_status', [1, 2])
                ->select());
        } catch (\Throwable $e) {
            return [];
        }

        $statuses = [];
        foreach ($rows as $row) {
            $vodId = intval($row['seo_obj_id'] ?? 0);
            if ($vodId > 0) {
                $statuses[$vodId] = intval($row['seo_status'] ?? 0);
            }
        }
        return $statuses;
    }

    private static function seoPredicate($seo)
    {
        if ($seo === 'all') {
            return '';
        }
        $table = self::quoteTable(self::tableName(self::SEO_TABLE));
        if ($seo === 'none') {
            return "NOT EXISTS (SELECT 1 FROM {$table} seo WHERE seo.seo_mid = 1 " .
                'AND seo.seo_obj_id = v.vod_id AND seo.seo_status IN (1,2))';
        }
        $status = $seo === 'optimized' ? 1 : 2;
        return "EXISTS (SELECT 1 FROM {$table} seo WHERE seo.seo_mid = 1 " .
            "AND seo.seo_obj_id = v.vod_id AND seo.seo_status = {$status})";
    }

    private static function cleanText($value, $maxLength)
    {
        $value = trim(strip_tags((string) $value));
        $value = str_replace(["\0", "\r", "\n", "\t"], '', $value);
        if (function_exists('mb_substr')) {
            return mb_substr($value, 0, $maxLength, 'UTF-8');
        }
        return substr($value, 0, $maxLength * 3);
    }

    private static function cleanSource($value)
    {
        $value = trim((string) $value);
        return preg_match('/^[A-Za-z0-9_-]{1,64}$/D', $value) ? $value : '';
    }

    private static function likeValue($value)
    {
        return addcslashes((string) $value, "\\%_");
    }

    private static function tableName($table)
    {
        try {
            $query = Db::name($table);
            if (is_object($query) && method_exists($query, 'getTable')) {
                return $query->getTable();
            }
        } catch (\Throwable $e) {
        }

        $database = function_exists('config') ? config('database') : [];
        $prefix = is_array($database) ? (string) ($database['prefix'] ?? '') : '';
        return $prefix . $table;
    }

    private static function quoteTable($table)
    {
        return '`' . str_replace('`', '``', (string) $table) . '`';
    }

    private static function toArray($value)
    {
        if (is_object($value) && method_exists($value, 'toArray')) {
            $value = $value->toArray();
        }
        return is_array($value) ? $value : [];
    }
}
