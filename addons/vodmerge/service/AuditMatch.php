<?php

namespace addons\vodmerge\service;

class AuditMatch
{
    public const VERSION = 1;
    private const SEASON_PATTERN = '/(?:第\s*[0-9０-９一二三四五六七八九十两零〇]+\s*季|(?<![a-z0-9０-９])(?:season\s*|s\s*)[0-9０-９]{1,3}(?![a-z0-9０-９]))/iu';

    private static function clean(string $value): string
    {
        return trim(preg_replace('/[\p{Cf}\x{00AD}]/u', '', strip_tags(html_entity_decode($value, ENT_QUOTES | ENT_HTML5, 'UTF-8'))));
    }

    private static function placeholder(string $value): bool
    {
        return in_array(Payload::key($value), ['', '0', '无', '未知', '暂无', '不详', '内详', '待定', '未填写',
            '暂无资料', '待更新', '未公布', '暂未公布', '未知演员', '未知导演', '未知主演', '暂无演员', '暂无导演',
            'unknown', 'none', 'null', 'na', 'anonymous', 'tba', 'tbd', '佚名', '不明'], true);
    }

    private static function titleVideo(array $video): array
    {
        foreach (['vod_name', 'vod_sub', 'vod_en'] as $field) {
            $video[$field] = self::clean((string) ($video[$field] ?? ''));
        }
        return $video;
    }

    private static function seasonVideo(array $video): array
    {
        $video = self::titleVideo($video);
        $video['vod_sub'] .= "\n" . $video['vod_en'];
        return $video;
    }

    public static function searchTitles(array $video, bool $includeStems = true): array
    {
        $video = self::titleVideo($video);
        $titles = array_merge([(string) $video['vod_name'], (string) $video['vod_en']],
            preg_split('/[\/|,，、;；\r\n]+/u', (string) $video['vod_sub']));
        $result = [];
        foreach ($titles as $title) {
            $title = trim($title);
            $key = self::titleKey($title);
            if ($key !== '' && !self::placeholder($title) && !isset($result[$key])) {
                $result[$key] = $title;
            }
        }
        $result = array_slice($result, 0, 8, true);
        if (!$includeStems) {
            return array_values($result);
        }
        $stems = [];
        foreach ($result as $title) {
            $title = mb_convert_kana($title, 'n', 'UTF-8');
            if (preg_match(self::SEASON_PATTERN, $title, $match, PREG_OFFSET_CAPTURE)) {
                $stem = preg_replace('/[\s\p{P}]+$/u', '', substr($title, 0, $match[0][1]));
                $key = self::titleKey($stem);
                if (mb_strlen($key, 'UTF-8') >= 2 && !self::placeholder($stem) && !isset($result[$key]) && !isset($stems[$key])) {
                    $stems[$key] = $stem;
                }
            }
        }
        return array_merge(array_values($result), array_values($stems));
    }

    public static function titleKey(string $title): string
    {
        $title = mb_convert_kana(self::clean($title), 'n', 'UTF-8');
        if (self::placeholder($title) || Payload::key(preg_replace(self::SEASON_PATTERN, '', $title)) === '') {
            return '';
        }
        return Payload::key(preg_replace_callback(self::SEASON_PATTERN, static function ($match) {
            $season = Payload::season($match[0]);
            return $season !== '' ? ' season' . $season . ' ' : $match[0];
        }, $title));
    }

    private static function people(string $value): array
    {
        $result = [];
        foreach (preg_split('/[\/|,，、;；&\r\n]+/u', self::clean($value)) as $name) {
            $name = trim($name);
            $key = Payload::key($name);
            if (mb_strlen($key, 'UTF-8') >= 2 && !ctype_digit($key) && !self::placeholder($name)) {
                $result[$key] = $name;
            }
        }
        return $result;
    }

    private static function validYear(array $video): string
    {
        $year = trim((string) ($video['vod_year'] ?? ''));
        return preg_match('/^[12][0-9]{3}$/D', $year) ? $year : '';
    }

    public static function assess(array $left, array $right): array
    {
        $evidence = [];
        $missing = [];
        $risks = [];
        $comparisonLeft = self::seasonVideo($left);
        $comparisonRight = self::seasonVideo($right);
        $comparisonLeft['vod_year'] = self::validYear($left);
        $comparisonRight['vod_year'] = self::validYear($right);
        $comparisonLeft['vod_version'] = trim((string) ($left['vod_version'] ?? ''));
        $comparisonRight['vod_version'] = trim((string) ($right['vod_version'] ?? ''));
        if (self::placeholder($comparisonLeft['vod_version'])) {
            $comparisonLeft['vod_version'] = '';
        }
        if (self::placeholder($comparisonRight['vod_version'])) {
            $comparisonRight['vod_version'] = '';
        }
        $conflicts = Payload::conflicts($comparisonLeft, $comparisonRight);
        $leftTitles = array_filter(array_map([self::class, 'titleKey'], self::searchTitles($left, false)), 'strlen');
        $rightTitles = array_filter(array_map([self::class, 'titleKey'], self::searchTitles($right, false)), 'strlen');
        $fullTitle = (bool) array_intersect($leftTitles, $rightTitles);
        if ($fullTitle) {
            $evidence[] = '完整片名或别名一致';
        } elseif (!$leftTitles || !$rightTitles) {
            $missing[] = '一方缺少有效的完整片名或别名';
        } else {
            $risks[] = '完整片名或别名未找到明确交集';
        }
        $allLeft = array_filter(array_map([self::class, 'titleKey'], self::searchTitles($left)), 'strlen');
        $allRight = array_filter(array_map([self::class, 'titleKey'], self::searchTitles($right)), 'strlen');
        $sharedTitle = (bool) array_intersect($allLeft, $allRight);
        if ($sharedTitle && !$fullTitle) {
            $evidence[] = '仅片名季数主干相同';
        }
        $leftId = (int) ($left['vod_douban_id'] ?? 0);
        $rightId = (int) ($right['vod_douban_id'] ?? 0);
        $sameId = $leftId > 0 && $leftId === $rightId;
        $differentId = $leftId > 0 && $rightId > 0 && $leftId !== $rightId;
        if ($sameId) {
            $evidence[] = '豆瓣编号相同';
        } elseif ($leftId <= 0 || $rightId <= 0) {
            $missing[] = '一方或双方未提供有效豆瓣编号';
        }
        $leftYear = self::validYear($left);
        $rightYear = self::validYear($right);
        $sameYear = $leftYear !== '' && $leftYear === $rightYear;
        $differentYear = $leftYear !== '' && $rightYear !== '' && $leftYear !== $rightYear;
        if ($sameYear) {
            $evidence[] = '有效年份一致';
        } elseif ($leftYear === '' || $rightYear === '') {
            $missing[] = '一方或双方缺少有效四位年份';
        }
        $leftType = (int) ($left['type_id'] ?? 0);
        $rightType = (int) ($right['type_id'] ?? 0);
        $sameType = $leftType > 0 && $leftType === $rightType;
        if ($sameType) {
            $evidence[] = '影片分类一致';
        } elseif ($leftType <= 0 || $rightType <= 0) {
            $missing[] = '一方或双方缺少有效影片分类';
        }
        $leftSeasons = Payload::seasons($comparisonLeft);
        $rightSeasons = Payload::seasons($comparisonRight);
        $seasonSymmetric = $leftSeasons === $rightSeasons && count($leftSeasons) <= 1;
        $differentSeason = count($leftSeasons) === 1 && count($rightSeasons) === 1 && $leftSeasons !== $rightSeasons;
        if ($leftSeasons && $seasonSymmetric) {
            $evidence[] = '明确季数一致';
        } elseif (!$leftSeasons && !$rightSeasons) {
            $risks[] = '双方未标注季数，不能作为季数一致证据';
        } elseif (!$leftSeasons || !$rightSeasons) {
            $missing[] = '季数仅一方明确，需核对另一方';
        }
        if ($differentSeason && !in_array('季数冲突', $conflicts, true)) {
            $conflicts[] = '季数冲突';
        }
        if ((count($leftSeasons) > 1 || count($rightSeasons) > 1) && !in_array('片名或别名包含多个季数，须先核对资料', $conflicts, true)) {
            $conflicts[] = '片名或别名包含多个季数，须先核对资料';
        }
        $leftVersion = $comparisonLeft['vod_version'];
        $rightVersion = $comparisonRight['vod_version'];
        $sameVersion = $leftVersion !== '' && $leftVersion === $rightVersion;
        if ($sameVersion) {
            $evidence[] = '标注版本一致';
            $risks[] = '版本标注一致，仍需核对实际剪辑版本';
        } else {
            if ($leftVersion === '' || $rightVersion === '') {
                $missing[] = '一方或双方缺少明确版本资料';
            }
            $risks[] = '版本未确认，需人工核对影院版、剪辑版等区别';
        }
        $leftLanguage = self::clean((string) ($left['vod_lang'] ?? ''));
        $rightLanguage = self::clean((string) ($right['vod_lang'] ?? ''));
        if ($leftLanguage !== '' && $rightLanguage !== '' && !self::placeholder($leftLanguage) && !self::placeholder($rightLanguage)) {
            $risks[] = $leftLanguage === $rightLanguage ? '语言标注一致仍不能确认各线路音轨' : '语言标注不同，需核对音轨与配音版本';
        } else {
            $risks[] = '音轨未确认，资料未完整标注语言';
        }
        $intersections = [];
        foreach (['vod_director' => '导演', 'vod_actor' => '演员'] as $field => $label) {
            $a = self::people((string) ($left[$field] ?? ''));
            $b = self::people((string) ($right[$field] ?? ''));
            $intersections[$field] = array_intersect_key($a, $b);
            if ($intersections[$field]) {
                $names = array_values($intersections[$field]);
                $evidence[] = $label . '交集：' . implode('、', array_slice($names, 0, 5))
                    . (count($names) > 5 ? '等 ' . count($names) . ' 人' : '');
            } elseif (!$a || !$b) {
                $missing[] = '一方或双方缺少明确' . $label . '资料';
            } else {
                $risks[] = $label . '名单未找到明确交集';
            }
        }
        if ($sameId && $conflicts) {
            $level = 'conflict';
        } elseif (($sharedTitle && $differentSeason) || ($differentId && ($differentYear || $differentSeason))) {
            $level = 'related';
            $risks[] = '现有依据更像不同作品或季数，仍需人工判断';
        } elseif ($conflicts) {
            $level = 'conflict';
        } elseif ($sameId && $fullTitle && $sameYear && $sameType && $seasonSymmetric && $sameVersion
            && ($intersections['vod_director'] || $intersections['vod_actor'])) {
            $level = 'high';
        } elseif ($fullTitle && $sameYear && $sameType && $seasonSymmetric
            && ($intersections['vod_director'] || count($intersections['vod_actor']) >= 2)) {
            $level = 'probable';
        } else {
            $level = 'insufficient';
        }
        $levels = ['high' => ['强同片依据', 4], 'probable' => ['较多同片依据', 3], 'conflict' => ['资料冲突', 2],
            'insufficient' => ['资料不足', 1], 'related' => ['更像不同作品或季数', 0]];
        return ['level' => $level, 'label' => $levels[$level][0], 'priority' => $levels[$level][1],
            'evidence' => array_values(array_unique($evidence)), 'missing' => array_values(array_unique($missing)),
            'risks' => array_values(array_unique($risks)), 'conflicts' => array_values(array_unique($conflicts))];
    }
}
