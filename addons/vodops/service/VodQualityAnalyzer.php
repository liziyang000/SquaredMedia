<?php

namespace addons\vodops\service;

class VodQualityAnalyzer
{
    private const ISSUE_TYPES = [
        'name_missing' => '标题缺失',
        'type_unknown' => '分类不存在',
        'type_parent_mismatch' => '父分类不一致',
        'year_missing' => '年份缺失',
        'year_invalid' => '年份格式异常',
        'area_missing' => '地区缺失',
        'lang_missing' => '语言缺失',
        'poster_missing' => '海报缺失',
        'poster_file_missing' => '本地海报文件丢失',
        'play_source_missing' => '播放源不完整',
        'play_group_mismatch' => '播放组不匹配',
        'exact_duplicate' => '严格重复候选',
    ];

    public static function issueTypes()
    {
        return self::ISSUE_TYPES;
    }

    public static function analyze(array $vod, array $typeMap, array $context = [])
    {
        $issues = [];
        $name = trim((string) ($vod['vod_name'] ?? ''));
        if (self::isBlank($name)) {
            $issues[] = self::issue('name_missing', 'vod_name', $name, '视频标题为空或为 0。');
        }

        $typeId = intval($vod['type_id'] ?? 0);
        $typeId1 = intval($vod['type_id_1'] ?? 0);

        if ($typeId < 1 || empty($typeMap[$typeId])) {
            $issues[] = self::issue(
                'type_unknown',
                'type_id',
                $typeId,
                '当前分类 ID 在分类表中不存在，不自动猜测目标分类。'
            );
        } else {
            $type = $typeMap[$typeId];
            $expectedTypeId1 = intval($type['type_pid'] ?? 0);
            if ($typeId1 !== $expectedTypeId1) {
                $issues[] = self::issue(
                    'type_parent_mismatch',
                    'type_id_1',
                    $typeId1,
                    '父分类字段与当前分类的 type_pid 不一致。',
                    [
                        'expected_type_id_1' => $expectedTypeId1,
                        'type_id' => $typeId,
                        'type_name' => self::sanitizeValue($type['type_name'] ?? ''),
                    ]
                );
            }
        }

        $year = trim((string) ($vod['vod_year'] ?? ''));
        if (self::isBlank($year)) {
            $issues[] = self::issue('year_missing', 'vod_year', $year, '视频年份为空或为 0。');
        } elseif (!preg_match('/^(18|19|20)[0-9]{2}$/D', $year)) {
            $issues[] = self::issue('year_invalid', 'vod_year', $year, '年份应为 1800～2099 的四位数字。');
        }

        $area = trim((string) ($vod['vod_area'] ?? ''));
        if (self::isBlank($area)) {
            $issues[] = self::issue('area_missing', 'vod_area', $area, '视频地区为空或为 0。');
        }

        $lang = trim((string) ($vod['vod_lang'] ?? ''));
        if (self::isBlank($lang)) {
            $issues[] = self::issue('lang_missing', 'vod_lang', $lang, '视频语言为空或为 0。');
        }

        $poster = trim((string) ($vod['vod_pic'] ?? ''));
        if (self::isBlank($poster)) {
            $issues[] = self::issue('poster_missing', 'vod_pic', $poster, '视频海报为空。');
        } elseif (self::localPosterMissing($poster, $context)) {
            $issues[] = self::issue('poster_file_missing', 'vod_pic', $poster, '本地海报路径存在于数据中，但站点文件已丢失。');
        }

        $playFrom = trim((string) ($vod['vod_play_from'] ?? ''));
        $playUrl = trim((string) ($vod['vod_play_url'] ?? ''));
        if (self::isBlank($playFrom) || self::isBlank($playUrl)) {
            $missingFields = [];
            if (self::isBlank($playFrom)) {
                $missingFields[] = 'vod_play_from';
            }
            if (self::isBlank($playUrl)) {
                $missingFields[] = 'vod_play_url';
            }
            $issues[] = self::issue(
                'play_source_missing',
                implode(',', $missingFields),
                $playFrom,
                '播放来源名称或播放地址为空。',
                ['missing_fields' => $missingFields]
            );
        } else {
            $sourceGroups = explode('$$$', $playFrom);
            $urlGroups = explode('$$$', $playUrl);
            $sourceGroupCount = count($sourceGroups);
            $urlGroupCount = count($urlGroups);
            $emptySourceGroups = self::emptyGroupPositions($sourceGroups);
            $emptyUrlGroups = self::emptyGroupPositions($urlGroups);
            if ($sourceGroupCount !== $urlGroupCount || !empty($emptySourceGroups) || !empty($emptyUrlGroups)) {
                $issues[] = self::issue(
                    'play_group_mismatch',
                    'vod_play_from,vod_play_url',
                    '来源 ' . $sourceGroupCount . ' 组 / 地址 ' . $urlGroupCount . ' 组',
                    '播放来源与播放地址的组数或非空位置不一致，可能导致线路和播放载荷错位。',
                    [
                        'source_group_count' => $sourceGroupCount,
                        'url_group_count' => $urlGroupCount,
                        'empty_source_groups' => $emptySourceGroups,
                        'empty_url_groups' => $emptyUrlGroups,
                    ]
                );
            }
        }

        return $issues;
    }

    public static function strictFingerprint(array $vod)
    {
        $name = trim((string) ($vod['vod_name'] ?? ''));
        $typeId = intval($vod['type_id'] ?? 0);
        $year = trim((string) ($vod['vod_year'] ?? ''));
        $playFrom = trim((string) ($vod['vod_play_from'] ?? ''));
        $playUrl = trim((string) ($vod['vod_play_url'] ?? ''));
        if ($name === '' || $typeId < 1 || !preg_match('/^(18|19|20)[0-9]{2}$/D', $year)
            || $playFrom === '' || $playUrl === '') {
            return null;
        }

        $payload = json_encode([
            $name,
            $typeId,
            intval($vod['type_id_1'] ?? 0),
            $year,
            $playFrom,
            $playUrl,
        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE);

        return hash('sha256', (string) $payload);
    }

    public static function sanitizeValue($value, $limit = 220)
    {
        $value = (string) $value;
        if (function_exists('mb_scrub')) {
            $value = mb_scrub($value, 'UTF-8');
        }
        $value = str_replace(["\0", "\r", "\n", "\t"], [' ', ' ', ' ', ' '], $value);
        $value = trim($value);
        if (function_exists('mb_substr')) {
            return mb_substr($value, 0, intval($limit), 'UTF-8');
        }

        return substr($value, 0, intval($limit));
    }

    private static function issue($type, $field, $value, $message, array $detail = [])
    {
        return [
            'issue_type' => $type,
            'field_name' => self::sanitizeValue($field, 40),
            'current_value' => self::sanitizeValue($value),
            'message' => self::sanitizeValue($message),
            'detail' => $detail,
        ];
    }

    private static function isBlank($value)
    {
        $value = trim((string) $value);
        return $value === '' || $value === '0';
    }

    private static function emptyGroupPositions(array $groups)
    {
        $positions = [];
        foreach ($groups as $index => $group) {
            if (trim((string) $group) === '') {
                $positions[] = $index + 1;
            }
        }
        return $positions;
    }

    private static function localPosterMissing($poster, array $context)
    {
        if (!empty($context['remote_upload'])) {
            return false;
        }

        $siteRoot = rtrim((string) ($context['site_root'] ?? ''), '/');
        if ($siteRoot === '') {
            return false;
        }

        $relative = ltrim((string) $poster, '/');
        if (strpos($relative, 'upload/') !== 0 || strpos($relative, '../') !== false) {
            return false;
        }

        return !is_file($siteRoot . '/' . $relative);
    }
}
