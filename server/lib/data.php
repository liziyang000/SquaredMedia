<?php
declare(strict_types=1);

function load_data(): array
{
    $path = dirname(__DIR__, 2) . '/preview/data.json';
    $json = file_get_contents($path);
    if ($json === false) {
        throw new RuntimeException('Unable to read preview data.');
    }

    $data = json_decode($json, true, 512, JSON_THROW_ON_ERROR);
    if (!is_array($data)) {
        throw new RuntimeException('Preview data is invalid.');
    }

    return $data;
}

function find_video(array $data, int $id): array
{
    foreach ($data['videos'] as $video) {
        if ((int) $video['id'] === $id) {
            return $video;
        }
    }

    return $data['videos'][0];
}

function filter_videos(array $data, ?string $category = null, ?string $keyword = null): array
{
    return array_values(array_filter($data['videos'], static function (array $video) use ($category, $keyword): bool {
        if ($category !== null && $category !== '' && $video['category'] !== $category) {
            return false;
        }

        if ($keyword !== null && $keyword !== '') {
            $haystack = $video['title'] . ' ' . $video['actor'] . ' ' . $video['category'];
            return mb_strpos($haystack, $keyword) !== false;
        }

        return true;
    }));
}

function sort_videos(array $videos, string $sort = 'latest'): array
{
    usort($videos, static function (array $a, array $b) use ($sort): int {
        if ($sort === 'hot') {
            return ((int) $b['hits']) <=> ((int) $a['hits']);
        }

        if ($sort === 'score') {
            return ((float) $b['score']) <=> ((float) $a['score']);
        }

        return strcmp((string) $b['updated'], (string) $a['updated']);
    });

    return $videos;
}
