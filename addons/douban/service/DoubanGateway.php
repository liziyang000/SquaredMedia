<?php

namespace addons\douban\service;

class DoubanGateway
{
    private const SUBJECT_URL = 'https://m.douban.com/rexxar/api/v2/movie/%s';
    private const SEARCH_URL = 'https://movie.douban.com/j/subject_suggest?q=%s';

    public static function subject(string $doubanId): array
    {
        $doubanId = preg_replace('/\D+/', '', $doubanId);
        if ($doubanId === '') {
            throw new \InvalidArgumentException('豆瓣ID无效');
        }

        return self::normalizeSubject(self::requestJson(sprintf(self::SUBJECT_URL, $doubanId)));
    }

    public static function search(string $query, int $limit = 5): array
    {
        $query = trim($query);
        if ($query === '') {
            return [];
        }
        $limit = max(1, min(10, $limit));
        $rows = self::requestJson(sprintf(self::SEARCH_URL, rawurlencode($query)));

        return array_slice(self::normalizeCandidates($rows), 0, $limit);
    }

    public static function normalizeSubject(array $data): array
    {
        $rating = is_array($data['rating'] ?? null) ? $data['rating'] : [];
        $ratingValue = max(0, min(10, (float) ($rating['value'] ?? 0)));
        $ratingCount = max(0, (int) ($rating['count'] ?? 0));
        $score = number_format($ratingValue, 1, '.', '');
        $pic = is_array($data['pic'] ?? null) ? $data['pic'] : [];
        $episodeCount = max(
            0,
            (int) ($data['episodes_count'] ?? 0),
            (int) ($data['last_episode_number'] ?? 0),
            (int) ($data['webisode_count'] ?? 0)
        );

        return [
            'vod_douban_id' => preg_replace('/\D+/', '', (string) ($data['id'] ?? '')),
            'vod_name' => self::text($data['title'] ?? ''),
            'vod_pic' => self::text($data['cover_url'] ?? ($pic['large'] ?? ($pic['normal'] ?? ''))),
            'vod_year' => self::text($data['year'] ?? ''),
            'vod_area' => self::joinValues($data['countries'] ?? []),
            'vod_lang' => self::joinValues($data['languages'] ?? []),
            'vod_class' => self::joinValues($data['genres'] ?? []),
            'vod_director' => self::joinValues($data['directors'] ?? []),
            'vod_actor' => self::joinValues($data['actors'] ?? []),
            'vod_content' => self::text($data['intro'] ?? ''),
            'vod_douban_score' => $score,
            'vod_score' => $score,
            'vod_score_num' => (string) $ratingCount,
            'rating_count' => $ratingCount,
            'vod_total' => $episodeCount > 0 ? (string) $episodeCount : '',
        ];
    }

    public static function normalizeCandidates(array $rows): array
    {
        $candidates = [];
        foreach ($rows as $row) {
            if (!is_array($row)) {
                continue;
            }
            $id = preg_replace('/\D+/', '', (string) ($row['id'] ?? ''));
            $title = self::text($row['title'] ?? '');
            if ($id === '' || $title === '') {
                continue;
            }
            $candidates[] = [
                'douban_id' => $id,
                'title' => $title,
                'subtitle' => self::text($row['sub_title'] ?? ''),
                'year' => self::text($row['year'] ?? ''),
                'pic' => self::text($row['img'] ?? ($row['cover'] ?? '')),
                'url' => self::text($row['url'] ?? ('https://movie.douban.com/subject/' . $id . '/')),
            ];
        }

        return $candidates;
    }

    private static function requestJson(string $url): array
    {
        if (!function_exists('curl_init')) {
            throw new \RuntimeException('服务器未启用 cURL 扩展');
        }
        $curl = curl_init($url);
        curl_setopt_array($curl, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_MAXREDIRS => 3,
            CURLOPT_CONNECTTIMEOUT => 5,
            CURLOPT_TIMEOUT => 15,
            CURLOPT_HTTPHEADER => [
                'Accept: application/json',
                'Referer: https://movie.douban.com/',
                'User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/126 Safari/537.36',
            ],
        ]);
        $raw = curl_exec($curl);
        $status = (int) curl_getinfo($curl, CURLINFO_HTTP_CODE);
        $failed = $raw === false || curl_errno($curl) !== 0;
        curl_close($curl);

        if ($failed || $status < 200 || $status >= 300 || trim((string) $raw) === '') {
            throw new \RuntimeException('豆瓣数据源请求失败');
        }
        $decoded = json_decode((string) $raw, true);
        if (!is_array($decoded)) {
            throw new \RuntimeException('豆瓣数据源返回格式错误');
        }

        return $decoded;
    }

    private static function joinValues($values): string
    {
        if (!is_array($values)) {
            return self::text($values);
        }
        $result = [];
        foreach ($values as $value) {
            if (is_array($value)) {
                $value = $value['name'] ?? '';
            }
            $value = self::text($value);
            if ($value !== '') {
                $result[] = $value;
            }
        }

        return implode(',', array_values(array_unique($result)));
    }

    private static function text($value): string
    {
        return trim(strip_tags((string) $value));
    }
}
