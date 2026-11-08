<?php

namespace addons\vodmerge\service;

class Payload
{
    public const MAX_BYTES = 2097152;
    private const SEASON_PATTERN = '/(?:第\s*([0-9０-９一二三四五六七八九十两零〇]+)\s*季|(?<![a-z0-9０-９])(?:season\s*|s\s*)([0-9０-９]{1,3})(?![a-z0-9０-９]))/iu';
    public const TEXT_FIELDS = [
        'vod_name' => 255, 'vod_sub' => 255, 'vod_en' => 255,
        'vod_year' => 10, 'vod_area' => 20, 'vod_lang' => 10,
        'vod_actor' => 255, 'vod_director' => 255, 'vod_class' => 255,
        'vod_version' => 30, 'vod_remarks' => 100, 'vod_content' => 12000,
        'vod_pic' => 255,
    ];

    public static function envelope(array $data): array
    {
        $source = $data['source'] ?? '';
        $sourceId = $data['source_id'] ?? '';
        if (!is_string($source) || !preg_match('/^[a-z0-9][a-z0-9_.-]{0,63}$/D', $source)
            || (!is_string($sourceId) && !is_int($sourceId))
            || !preg_match('/^[^\x00-\x20\x7f]{1,128}$/uD', (string) $sourceId)
            || !is_array($data['video'] ?? null)) {
            throw new \InvalidArgumentException('需要合法的 source、source_id 和 video 对象。');
        }
        $input = $data['video'];
        $video = [];
        foreach (self::TEXT_FIELDS as $field => $limit) {
            if (isset($input[$field]) && !is_scalar($input[$field])) {
                throw new \InvalidArgumentException('视频字段必须为文本。');
            }
            $value = trim(strip_tags((string) ($input[$field] ?? '')));
            if (function_exists('mac_filter_xss')) {
                $value = mac_filter_xss($value);
            }
            if (mb_strlen($value, 'UTF-8') > $limit || strpos($value, "\0") !== false) {
                throw new \InvalidArgumentException($field . ' 超出长度限制或包含无效字符。');
            }
            $video[$field] = $value;
        }
        if ($video['vod_name'] === '') {
            throw new \InvalidArgumentException('片名不能为空。');
        }
        foreach (['type_id', 'vod_douban_id'] as $field) {
            if (isset($input[$field]) && !is_scalar($input[$field])) {
                throw new \InvalidArgumentException($field . ' 必须为非负整数。');
            }
            $value = (string) ($input[$field] ?? '0');
            if (!preg_match('/^[0-9]{1,10}$/D', $value) || (float) $value > 2147483647) {
                throw new \InvalidArgumentException($field . ' 必须为非负整数。');
            }
            $video[$field] = (int) $value;
        }
        if ($video['vod_pic'] !== '' && !preg_match('~^https?://[^\s<>"\x00-\x1f]+$~iD', $video['vod_pic'])) {
            throw new \InvalidArgumentException('采集海报须为 HTTP(S) URL。');
        }
        foreach (Playlist::FIELDS as $field) {
            if (isset($input[$field]) && !is_string($input[$field])) {
                throw new \InvalidArgumentException('播放字段必须为字符串。');
            }
            $video[$field] = (string) ($input[$field] ?? '');
        }
        if (strlen(self::json($video)) > self::MAX_BYTES) {
            throw new \InvalidArgumentException('单条资源不能超过 2 MiB。');
        }
        Playlist::groups($video, true);
        return ['source' => $source, 'source_id' => (string) $sourceId, 'video' => $video];
    }

    public static function authenticate(string $body, string $timestamp, string $signature, string $secret, int $now): bool
    {
        return strlen($secret) >= 32 && strlen($body) <= self::MAX_BYTES
            && preg_match('/^[0-9]{10}$/D', $timestamp)
            && abs($now - (int) $timestamp) <= 300
            && preg_match('/^[a-f0-9]{64}$/D', $signature)
            && hash_equals(hash_hmac('sha256', $timestamp . "\n" . $body, $secret), $signature);
    }

    public static function metadata(array $video): array
    {
        $metadata = [];
        foreach (['vod_name', 'vod_sub', 'vod_en', 'vod_year', 'vod_area', 'vod_lang',
            'vod_actor', 'vod_director', 'vod_class', 'vod_version', 'vod_douban_id', 'type_id'] as $field) {
            $metadata[$field] = mb_substr(trim(strip_tags((string) ($video[$field] ?? ''))), 0, 255, 'UTF-8');
        }
        $metadata['vod_content'] = mb_substr(trim(strip_tags((string) ($video['vod_content'] ?? ''))), 0, 800, 'UTF-8');
        return $metadata;
    }

    public static function key(string $value): string
    {
        return mb_strtolower(preg_replace('/[\s\p{P}]+/u', '', $value), 'UTF-8');
    }

    public static function identity(array $video): array
    {
        $result = [];
        foreach (['vod_name', 'vod_year', 'vod_version', 'vod_douban_id', 'type_id'] as $field) {
            $result[$field] = trim((string) ($video[$field] ?? ''));
        }
        $result['vod_name'] = self::key($result['vod_name']);
        $result['seasons'] = self::seasons($video);
        return $result;
    }

    private static function titles(array $video): array
    {
        return array_values(array_filter(array_map('trim', array_merge(
            [(string) ($video['vod_name'] ?? '')],
            preg_split('/[\/|,，、;；\r\n]+/u', (string) ($video['vod_sub'] ?? ''))
        )), static function ($title) { return $title !== ''; }));
    }

    public static function searchTitles(array $video, bool $includeStems = true): array
    {
        $titles = array_merge([(string) ($video['vod_name'] ?? ''), (string) ($video['vod_en'] ?? '')], self::titles($video));
        $result = [];
        foreach ($titles as $title) {
            $title = trim($title);
            $key = self::key($title);
            if ($key !== '' && !isset($result[$key])) {
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
                $key = self::key($stem);
                if (mb_strlen($key, 'UTF-8') >= 2 && !isset($result[$key]) && !isset($stems[$key])) {
                    $stems[$key] = $stem;
                }
            }
        }
        return array_merge(array_values($result), array_values($stems));
    }

    private static function seasonNumber(string $value): string
    {
        $value = mb_convert_kana($value, 'n', 'UTF-8');
        $numbers = ['零' => 0, '〇' => 0, '一' => 1, '二' => 2, '两' => 2, '三' => 3, '四' => 4,
            '五' => 5, '六' => 6, '七' => 7, '八' => 8, '九' => 9, '十' => 10];
        if (ctype_digit($value)) {
            return (string) (int) $value;
        }
        if (isset($numbers[$value])) {
            return (string) $numbers[$value];
        }
        if (preg_match('/^([一二三四五六七八九])?十([一二三四五六七八九])?$/u', $value, $parts)) {
            return (string) (($numbers[$parts[1] ?? ''] ?? 1) * 10 + ($numbers[$parts[2] ?? ''] ?? 0));
        }
        return '';
    }

    public static function seasons(array $video): array
    {
        $result = [];
        foreach (['vod_name', 'vod_sub'] as $field) {
            $title = mb_convert_kana((string) ($video[$field] ?? ''), 'n', 'UTF-8');
            preg_match_all(self::SEASON_PATTERN, $title, $matches, PREG_SET_ORDER);
            foreach ($matches as $match) {
                $number = self::seasonNumber($match[1] !== '' ? $match[1] : $match[2]);
                if ($number !== '') {
                    $result[] = $number;
                }
            }
        }
        foreach ($video['seasons'] ?? [] as $number) {
            if (is_string($number) && preg_match('/^[0-9]{1,3}$/D', $number)) {
                $result[] = (string) (int) $number;
            }
        }
        $result = array_values(array_unique($result));
        sort($result, SORT_NUMERIC);
        return $result;
    }

    public static function season(string $name): string
    {
        $seasons = self::seasons(['vod_name' => $name]);
        return count($seasons) === 1 ? $seasons[0] : '';
    }

    public static function conflicts(array $left, array $right): array
    {
        $issues = [];
        foreach (['vod_douban_id', 'type_id'] as $field) {
            if ((int) ($left[$field] ?? 0) > 0 && (int) ($right[$field] ?? 0) > 0
                && (int) $left[$field] !== (int) $right[$field]) {
                $issues[] = $field . ' 冲突';
            }
        }
        foreach (['vod_year', 'vod_version'] as $field) {
            $a = trim((string) ($left[$field] ?? ''));
            $b = trim((string) ($right[$field] ?? ''));
            if ($a !== '' && $b !== '' && $a !== $b) {
                $issues[] = $field . ' 冲突';
            }
        }
        $a = self::seasons($left);
        $b = self::seasons($right);
        if (count($a) > 1 || count($b) > 1) {
            $issues[] = '片名或别名包含多个季数，须先核对资料';
        } elseif ($a && $b && $a !== $b) {
            $issues[] = '季数冲突';
        }
        return $issues;
    }

    private static function people(string $value): array
    {
        $result = [];
        foreach (preg_split('/[\/|,，、;；&\r\n]+/u', $value) as $name) {
            $name = self::key(trim($name));
            if (mb_strlen($name, 'UTF-8') >= 2 && !preg_match('/^[0-9]+$/D', $name)
                && !in_array($name, ['unknown', 'none', 'null', 'na', 'anonymous', 'tba', 'tbd', '暂无', '未知', '不详', '内详', '待定',
                    '佚名', '未填写', '未知演员', '未知导演', '未知主演', '暂无资料', '暂未公布', '不明', '未公布', '待更新', '暂无演员', '暂无导演'], true)) {
                $result[] = $name;
            }
        }
        return array_unique($result);
    }

    private static function titleKey(string $title): string
    {
        $title = mb_convert_kana($title, 'n', 'UTF-8');
        if (self::key(preg_replace(self::SEASON_PATTERN, '', $title)) === '') {
            return '';
        }
        return self::key(preg_replace_callback(self::SEASON_PATTERN, static function ($match) {
            $number = self::seasonNumber($match[1] !== '' ? $match[1] : $match[2]);
            return $number !== '' ? ' season' . $number . ' ' : $match[0];
        }, $title));
    }

    public static function automaticIssues(array $incoming, array $target): array
    {
        $issues = self::conflicts($incoming, $target);
        foreach (['vod_douban_id', 'type_id'] as $field) {
            if ((int) ($incoming[$field] ?? 0) <= 0 || (int) ($target[$field] ?? 0) <= 0
                || (int) $incoming[$field] !== (int) $target[$field]) {
                $issues[] = $field . ' 必须为相同的正整数';
            }
        }
        $year = trim((string) ($incoming['vod_year'] ?? ''));
        if (!preg_match('/^[12][0-9]{3}$/D', $year) || $year !== trim((string) ($target['vod_year'] ?? ''))) {
            $issues[] = '年份必须为相同的有效四位年份';
        }
        if (self::seasons($incoming) !== self::seasons($target)) {
            $issues[] = '季数证据不对称或不一致';
        }
        if (trim((string) ($incoming['vod_version'] ?? '')) !== trim((string) ($target['vod_version'] ?? ''))) {
            $issues[] = '版本证据不对称或不一致';
        }
        $names = array_filter(array_map([self::class, 'titleKey'], self::titles($incoming)), 'strlen');
        $targetNames = array_filter(array_map([self::class, 'titleKey'], self::titles($target)), 'strlen');
        if (!array_intersect($names, $targetNames)) {
            $issues[] = '缺少一致的完整片名或别名';
        }
        $people = false;
        foreach (['vod_actor', 'vod_director'] as $field) {
            if (array_intersect(self::people((string) ($incoming[$field] ?? '')), self::people((string) ($target[$field] ?? '')))) {
                $people = true;
            }
        }
        if (!$people) {
            $issues[] = '缺少相同的明确演员或导演';
        }
        return array_values(array_unique($issues));
    }

    public static function json($value): string
    {
        $json = json_encode($value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        if ($json === false) {
            throw new \InvalidArgumentException('输入不是有效 UTF-8 JSON。');
        }
        return $json;
    }
}
