<?php

namespace addons\vodmerge\service;

class Playlist
{
    public const FIELDS = ['vod_play_from', 'vod_play_url', 'vod_play_server', 'vod_play_note'];

    public static function groups(array $video, bool $incoming = false, bool $allowRepeatedPlayers = false): array
    {
        if (empty($video['vod_play_from']) && empty($video['vod_play_url'])) {
            if ($incoming) {
                throw new \InvalidArgumentException('采集资源缺少播放地址。');
            }
            return [];
        }
        $parts = [];
        foreach (self::FIELDS as $field) {
            $parts[$field] = explode('$$$', (string) ($video[$field] ?? ''));
        }
        $count = count($parts['vod_play_from']);
        if ($count > 64 || count($parts['vod_play_url']) !== $count) {
            throw new \InvalidArgumentException('播放组数不匹配或超过 64 组。');
        }
        foreach (['vod_play_server', 'vod_play_note'] as $field) {
            if (empty($video[$field])) {
                $parts[$field] = array_fill(0, $count, $field === 'vod_play_server' ? 'no' : '');
            } elseif (count($parts[$field]) !== $count) {
                throw new \InvalidArgumentException('播放服务器或备注组数不匹配。');
            }
        }
        $groups = [];
        foreach ($parts['vod_play_from'] as $i => $player) {
            if (!preg_match('/^[a-zA-Z0-9_]{1,64}$/D', $player)) {
                throw new \InvalidArgumentException('播放器代码无效。');
            }
            $group = [];
            foreach (self::FIELDS as $field) {
                $group[$field] = $parts[$field][$i];
            }
            if ($incoming && (!preg_match('/^[a-zA-Z0-9_-]{1,64}$/D', $group['vod_play_server'])
                || preg_match('/[<>"\x00-\x1f]/', $group['vod_play_note']))) {
                throw new \InvalidArgumentException('播放服务器代码或线路备注无效。');
            }
            $episodes = self::episodes($group['vod_play_url'], $incoming);
            if ($incoming) {
                $unique = [];
                foreach ($episodes as $episode) {
                    if (!isset($unique[$episode['url']])) {
                        $unique[$episode['url']] = $episode['raw'];
                    }
                }
                $group['vod_play_url'] = implode('#', $unique);
            }
            $groups[] = $group;
        }
        if ($incoming && !$allowRepeatedPlayers && count(array_unique($parts['vod_play_from'])) !== $count) {
            throw new \InvalidArgumentException('同一采集条目不能有重复播放器代码。');
        }
        return $groups;
    }

    private static function episodeKey(string $name): string
    {
        $name = trim($name);
        if (preg_match('/^(?:第\s*|ep(?:isode)?\s*)?0*([0-9]+)\s*(?:集|话)?$/iuD', $name, $m)) {
            return 'episode:' . (int) $m[1];
        }
        return 'label:' . Payload::key($name);
    }

    private static function episodes(string $value, bool $strict): array
    {
        $rows = explode('#', rtrim($value, '#'));
        if (count($rows) > 5000 || $value === '') {
            throw new \InvalidArgumentException('单线路集数为空或超过 5000 集。');
        }
        $result = [];
        $names = [];
        foreach ($rows as $row) {
            $parts = explode('$', $row, 2);
            $url = count($parts) === 2 ? $parts[1] : $parts[0];
            $name = count($parts) === 2 ? $parts[0] : '';
            if ($strict && (!preg_match('~^https?://[^\s<>"\x00-\x1f]+$~iD', $url)
                || strpos($url, '$') !== false || !parse_url($url, PHP_URL_HOST)
                || $name === '' || preg_match('/[<>"\x27\x00-\x1f]/', $name))) {
                throw new \InvalidArgumentException('新资源须使用“集名$HTTP(S)地址”；集名不能含标签、引号或控制字符，地址不能含未编码的 $ 分隔符。');
            }
            $key = self::episodeKey($name);
            if ($strict && isset($names[$key]) && $names[$key] !== $url) {
                throw new \InvalidArgumentException('同一条采集线路存在同集不同地址。');
            }
            $names[$key] = $url;
            $result[] = ['key' => $key, 'url' => $url, 'raw' => $row];
        }
        return $result;
    }

    public static function merge(array $target, array $incoming, array $routes = [], array $reservedSlots = [], bool $library = false): array
    {
        $groups = self::groups($target);
        $addedGroups = 0;
        $addedEpisodes = 0;
        foreach (self::groups($incoming, true, $library) as $sourceSlot => $group) {
            $player = $group['vod_play_from'];
            $routeKey = $library ? $sourceSlot . ':' . $player : $player;
            if (isset($routes[$routeKey])) {
                $slot = (int) $routes[$routeKey]['slot'];
                if (!isset($groups[$slot]) || !hash_equals((string) $routes[$routeKey]['hash'], self::hash($groups[$slot]))) {
                    throw new \RuntimeException('已绑定线路被外部修改或重排，请检查后选择追加独立线路。');
                }
                $known = self::episodes($groups[$slot]['vod_play_url'], false);
                $urls = array_column($known, 'url');
                $names = [];
                foreach ($known as $episode) {
                    $names[$episode['key']][] = $episode['url'];
                }
                foreach (self::episodes($group['vod_play_url'], true) as $episode) {
                    if (in_array($episode['url'], $urls, true)) {
                        continue;
                    }
                    if (isset($names[$episode['key']])) {
                        throw new \RuntimeException('同集地址发生变化，已保留旧地址；请审核或追加独立线路。');
                    }
                    $groups[$slot]['vod_play_url'] = rtrim($groups[$slot]['vod_play_url'], '#') . '#' . $episode['raw'];
                    $urls[] = $episode['url'];
                    $names[$episode['key']][] = $episode['url'];
                    $addedEpisodes++;
                    if (count($urls) > 5000) {
                        throw new \RuntimeException('合并后单线路超过 5000 集，已停止写入。');
                    }
                }
            } else {
                // Equal player codes across providers are not evidence of equal sources.
                $slot = count($groups);
                foreach ($groups as $i => $old) {
                    if (!in_array($i, $reservedSlots, true) && $old === $group) {
                        $slot = $i;
                        break;
                    }
                }
                if ($slot === count($groups)) {
                    $groups[] = $group;
                    $addedGroups++;
                    $addedEpisodes += count(self::episodes($group['vod_play_url'], true));
                }
            }
            $routes[$routeKey] = ['slot' => $slot, 'hash' => self::hash($groups[$slot])];
        }
        $fields = [];
        foreach (self::FIELDS as $field) {
            $fields[$field] = implode('$$$', array_column($groups, $field));
            if ($field !== 'vod_play_url' && mb_strlen($fields[$field], 'UTF-8') > 255) {
                throw new \RuntimeException('播放组字段超过 MacCMS 的 255 字符限制，已停止合并。');
            }
        }
        if (strlen($fields['vod_play_url']) > Payload::MAX_BYTES) {
            throw new \RuntimeException('合并后播放地址超过 2 MiB，已停止写入。');
        }
        return ['fields' => $fields, 'routes' => $routes, 'added_groups' => $addedGroups, 'added_episodes' => $addedEpisodes];
    }

    public static function hash(array $group): string
    {
        return hash('sha256', Payload::json($group));
    }
}
