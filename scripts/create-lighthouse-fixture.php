<?php
declare(strict_types=1);

if ($argc !== 3) {
    fwrite(STDERR, "Usage: php scripts/create-lighthouse-fixture.php <input-json> <output-json>\n");
    exit(64);
}

$input = file_get_contents($argv[1]);
if ($input === false) {
    throw new RuntimeException('Unable to read the Lighthouse source fixture.');
}

$data = json_decode($input, true, 512, JSON_THROW_ON_ERROR);
if (!is_array($data) || !isset($data['videos']) || !is_array($data['videos'])) {
    throw new RuntimeException('The Lighthouse source fixture has no video catalog.');
}

$localAsset = '/template/pingfangvideo/images/brand/lazyload.png';
foreach ($data['videos'] as &$video) {
    if (!is_array($video)) {
        throw new RuntimeException('The Lighthouse source fixture contains an invalid video.');
    }

    $video['poster'] = $localAsset;
    $video['backdrop'] = $localAsset;

    if (isset($video['episodes']) && is_array($video['episodes'])) {
        foreach ($video['episodes'] as &$episode) {
            if (is_array($episode) && array_key_exists('src', $episode)) {
                $episode['src'] = $localAsset;
            }
        }
        unset($episode);
    }
}
unset($video);

$output = json_encode($data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
if (preg_match('~https?://~i', $output) === 1) {
    throw new RuntimeException('The Lighthouse fixture still contains an external URL.');
}

if (file_put_contents($argv[2], $output) === false) {
    throw new RuntimeException('Unable to write the Lighthouse fixture.');
}
