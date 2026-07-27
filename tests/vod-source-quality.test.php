<?php

require_once dirname(__DIR__) . '/addons/pingfangdevice/service/VodSourceQuality.php';

use addons\pingfangdevice\service\VodSourceQuality;

$fail = static function ($message) {
    fwrite(STDERR, $message . "\n");
    exit(1);
};
$assertSame = static function ($expected, $actual, $message) use ($fail) {
    if ($expected !== $actual) {
        $fail($message . "\nExpected: " . var_export($expected, true) . "\nActual: " . var_export($actual, true));
    }
};
$assertTrue = static function ($actual, $message) use ($fail) {
    if ($actual !== true) {
        $fail($message . "\nActual: " . var_export($actual, true));
    }
};

$vod = [
    'vod_id' => 42,
    'vod_name' => '线路检测示例',
    'vod_play_from' => 'fast$$$slow$$$broken$$$resolver$$$missing',
    'vod_play_url' => implode('$$$', [
        '第1集$https://fast.example/one.m3u8#第2集$https://fast.example/two.m3u8',
        '第1集$https://slow.example/one.mp4#第2集$https://slow.example/two.mp4',
        '第1集$https://broken.example/one.mp4#第2集$https://broken.example/two.mp4',
        '第1集$opaque-1#第2集$opaque-2',
        '第1集$https://missing.example/only-one.mp4',
    ]),
];

$requests = [];
$fetcher = static function ($url, $byteLimit, $byteOffset = 0, $timeoutSeconds = null) use (&$requests) {
    $requests[] = [$url, $byteLimit, $byteOffset, $timeoutSeconds];

    if ($url === 'https://fast.example/two.m3u8') {
        $body = "#EXTM3U\n#EXT-X-TARGETDURATION:6\n"
            . "#EXTINF:6,\nsegments/two-a.ts\n"
            . "#EXTINF:6,\nsegments/two-b.ts\n"
            . "#EXTINF:6,\nsegments/two-c.ts\n";
        return [
            'ok' => true,
            'http_code' => 200,
            'content_type' => 'application/vnd.apple.mpegurl',
            'body' => $body,
            'bytes' => strlen($body),
            'duration_ms' => 40,
        ];
    }
    if ($url === 'https://fast.example/segments/two-a.ts') {
        return [
            'ok' => true,
            'http_code' => 206,
            'content_type' => 'video/mp2t',
            'body' => '',
            'bytes' => 262144,
            'duration_ms' => 400,
            'ttfb_ms' => 80,
        ];
    }
    if ($url === 'https://fast.example/segments/two-b.ts') {
        return [
            'ok' => true,
            'http_code' => 206,
            'content_type' => 'video/mp2t',
            'body' => '',
            'bytes' => 262144,
            'duration_ms' => 40,
            'ttfb_ms' => 60,
        ];
    }
    if ($url === 'https://fast.example/segments/two-c.ts') {
        return [
            'ok' => true,
            'http_code' => 206,
            'content_type' => 'video/mp2t',
            'body' => '',
            'bytes' => 262144,
            'duration_ms' => 420,
            'ttfb_ms' => 70,
        ];
    }
    if ($url === 'https://slow.example/two.mp4') {
        return [
            'ok' => true,
            'http_code' => 206,
            'content_type' => 'video/mp4',
            'body' => '',
            'bytes' => 65536,
            'duration_ms' => 2200,
            'ttfb_ms' => 150,
        ];
    }
    if ($url === 'https://broken.example/two.mp4') {
        return [
            'ok' => false,
            'http_code' => 503,
            'content_type' => 'text/plain',
            'body' => '',
            'bytes' => 0,
            'duration_ms' => 180,
            'error' => 'HTTP 503',
        ];
    }

    throw new RuntimeException('Unexpected probe URL: ' . $url);
};

$result = VodSourceQuality::inspectVod($vod, 2, $fetcher);
$assertSame(1, $result['code'], 'A valid video source check should succeed.');
$assertSame(42, $result['data']['vod_id'], 'The response should identify the checked video.');
$assertSame(2, $result['data']['nid'], 'The response should identify the requested episode ordinal.');
$assertSame(5, count($result['data']['sources']), 'Every playback source should have a result.');
$assertSame(1, $result['data']['recommended_sid'], 'The fastest reliable source should be recommended.');

$sources = [];
foreach ($result['data']['sources'] as $source) {
    $sources[$source['sid']] = $source;
}

$assertSame('available', $sources[1]['status'], 'A responsive HLS segment should be available.');
$assertSame('第2集', $sources[1]['episode_name'], 'The selected episode must be checked instead of the first episode.');
$assertTrue($sources[1]['available'], 'A responsive HLS segment should set available=true.');
$assertSame(5243, $sources[1]['speed_kbps'], 'HLS speed should use the median instead of an outlier sample.');
$assertSame(3, $sources[1]['sample_count'], 'HLS speed should be based on multiple media segments.');
$assertSame(70, $sources[1]['latency_ms'], 'HLS latency should use the median time to first byte.');
$assertSame(1, $sources[1]['quality_rank'], 'The best healthy source should rank first.');
$assertSame(true, $sources[1]['recommended'], 'The best healthy source should be marked as recommended.');
$assertSame('slow', $sources[2]['status'], 'A responsive but low-throughput direct stream should be marked slow.');
$assertSame(3, $sources[2]['sample_count'], 'Direct streams should use independent byte ranges.');
$assertSame(2, $sources[2]['quality_rank'], 'A slower but playable source should remain a ranked fallback.');
$assertSame(false, $sources[2]['recommended'], 'Only one source should be recommended.');
$assertSame(null, $sources[2]['tested_width'], 'Direct streams must not guess resolution from source names or URLs.');
$assertSame('unknown', $sources[2]['resolution_basis'], 'Direct stream resolution should remain explicitly unknown.');
$assertSame('failed', $sources[3]['status'], 'An upstream HTTP failure should be unavailable.');
$assertSame(null, $sources[3]['quality_rank'], 'Unavailable sources must not receive a healthy rank.');
$assertSame('unsupported', $sources[4]['status'], 'A non-HTTP parser token should not be reported as playable.');
$assertSame('missing', $sources[5]['status'], 'A source without the requested episode should be explicit.');
$assertSame('https://fast.example/segments/two-a.ts', $requests[1][0], 'Relative HLS segment URLs should resolve against the playlist URL.');

$directOffsets = [];
foreach ($requests as $request) {
    if ($request[0] === 'https://slow.example/two.mp4') {
        $directOffsets[] = $request[2];
    }
}
$assertSame([0, 262144, 524288], $directOffsets, 'Direct samples should not repeatedly request the same byte range.');

$encoded = json_encode($result, JSON_UNESCAPED_UNICODE);
$assertSame(false, strpos($encoded, 'fast.example'), 'The response must not expose source URLs.');
$assertSame(false, strpos($encoded, 'opaque-2'), 'The response must not expose parser tokens.');

$privateResult = VodSourceQuality::inspectVod([
    'vod_id' => 43,
    'vod_play_from' => 'private',
    'vod_play_url' => '第1集$http://127.0.0.1/internal.m3u8',
], 1);
$assertSame('unsupported', $privateResult['data']['sources'][0]['status'], 'Private network targets must be rejected before probing.');

$staleSegmentRequests = [];
$staleSegmentResult = VodSourceQuality::inspectVod([
    'vod_id' => 44,
    'vod_play_from' => 'live',
    'vod_play_url' => '第1集$https://live.example/index.m3u8',
], 1, static function ($url, $byteLimit, $byteOffset = 0) use (&$staleSegmentRequests) {
    $staleSegmentRequests[] = $url;
    if ($url === 'https://live.example/index.m3u8') {
        $body = "#EXTM3U\n#EXT-X-TARGETDURATION:4\n"
            . "#EXTINF:4,\nstale.ts\n"
            . "#EXTINF:4,\ncurrent-a.ts\n"
            . "#EXTINF:4,\ncurrent-b.ts\n";
        return [
            'ok' => true,
            'http_code' => 200,
            'content_type' => 'application/vnd.apple.mpegurl',
            'body' => $body,
            'bytes' => strlen($body),
            'duration_ms' => 30,
        ];
    }
    if ($url === 'https://live.example/stale.ts') {
        return [
            'ok' => false,
            'http_code' => 404,
            'content_type' => 'text/plain',
            'body' => '',
            'bytes' => 0,
            'duration_ms' => 40,
        ];
    }
    return [
        'ok' => true,
        'http_code' => 206,
        'content_type' => 'video/mp2t',
        'body' => '',
        'bytes' => 262144,
        'duration_ms' => $url === 'https://live.example/current-a.ts' ? 500 : 600,
        'ttfb_ms' => 90,
    ];
});
$staleSource = $staleSegmentResult['data']['sources'][0];
$assertSame('available', $staleSource['status'], 'One stale live segment must not make the entire HLS source unavailable.');
$assertSame(2, $staleSource['sample_count'], 'Only successful media samples should count toward the speed result.');
$assertSame(3845, $staleSource['speed_kbps'], 'Two valid HLS samples should produce a stable median speed.');
$assertSame(4, count($staleSegmentRequests), 'The probe should continue after one stale HLS segment.');

$singleSampleResult = VodSourceQuality::inspectVod([
    'vod_id' => 45,
    'vod_play_from' => 'short',
    'vod_play_url' => '第1集$https://short.example/index.m3u8',
], 1, static function ($url) {
    if ($url === 'https://short.example/index.m3u8') {
        $body = "#EXTM3U\n#EXTINF:4,\nonly.ts\n";
        return [
            'ok' => true,
            'http_code' => 200,
            'content_type' => 'application/vnd.apple.mpegurl',
            'body' => $body,
            'bytes' => strlen($body),
            'duration_ms' => 20,
        ];
    }
    return [
        'ok' => true,
        'http_code' => 206,
        'content_type' => 'video/mp2t',
        'body' => '',
        'bytes' => 262144,
        'duration_ms' => 300,
        'ttfb_ms' => 50,
    ];
});
$singleSample = $singleSampleResult['data']['sources'][0];
$assertSame('available', $singleSample['status'], 'One real media sample is enough to prove availability.');
$assertSame(null, $singleSample['speed_kbps'], 'One sample is not enough to report a reliable speed.');
$assertSame(1, $singleSample['sample_count'], 'A single media segment should be reported transparently.');
$assertSame(null, $singleSample['tested_width'], 'A media-only HLS playlist must not invent a resolution.');
$assertSame('unknown', $singleSample['resolution_basis'], 'A media-only HLS playlist should report unknown resolution.');

$jsonResult = VodSourceQuality::inspectVod([
    'vod_id' => 46,
    'vod_play_from' => 'json-error',
    'vod_play_url' => '第1集$https://json.example/video.mp4',
], 1, static function () {
    return [
        'ok' => true,
        'http_code' => 200,
        'content_type' => 'application/json',
        'body' => '{"code":403,"message":"expired"}',
        'bytes' => 32,
        'duration_ms' => 25,
    ];
});
$assertSame('unsupported', $jsonResult['data']['sources'][0]['status'], 'A JSON error response must not be reported as playable media.');
$assertSame(null, $jsonResult['data']['recommended_sid'], 'A video with no healthy sources must not invent a recommendation.');

$timeoutResult = VodSourceQuality::inspectVod([
    'vod_id' => 47,
    'vod_play_from' => 'timeout',
    'vod_play_url' => '第1集$https://timeout.example/video.mp4',
], 1, static function () {
    return [
        'ok' => false,
        'timed_out' => true,
        'http_code' => 0,
        'content_type' => '',
        'body' => '',
        'bytes' => 0,
        'duration_ms' => 3000,
    ];
});
$assertSame('timeout', $timeoutResult['data']['sources'][0]['status'], 'Timeouts should not be conflated with confirmed upstream failures.');

$variantRequests = [];
$variantResult = VodSourceQuality::inspectVod([
    'vod_id' => 48,
    'vod_play_from' => 'adaptive',
    'vod_play_url' => '第1集$https://adaptive.example/master.m3u8',
], 1, static function ($url) use (&$variantRequests) {
    $variantRequests[] = $url;
    if ($url === 'https://adaptive.example/master.m3u8') {
        $body = "#EXTM3U\n"
            . "#EXT-X-STREAM-INF:BANDWIDTH=900000,RESOLUTION=640x360,CODECS=\"avc1.4d401e,mp4a.40.2\"\nlow/index.m3u8\n"
            . "#EXT-X-STREAM-INF:BANDWIDTH=12000000,RESOLUTION=3840x2160,CODECS=\"hvc1.1.6.L120.90,mp4a.40.2\"\nultra/index.m3u8\n"
            . "#EXT-X-STREAM-INF:BANDWIDTH=4200000,AVERAGE-BANDWIDTH=3500000,RESOLUTION=1920x1080,CODECS=\"avc1.640028,mp4a.40.2\"\nhd/index.m3u8\n";
        return [
            'ok' => true,
            'http_code' => 200,
            'content_type' => 'application/vnd.apple.mpegurl',
            'body' => $body,
            'bytes' => strlen($body),
            'duration_ms' => 20,
        ];
    }
    if ($url === 'https://adaptive.example/ultra/index.m3u8') {
        return [
            'ok' => false,
            'http_code' => 404,
            'content_type' => 'text/plain',
            'body' => '',
            'bytes' => 0,
            'duration_ms' => 50,
        ];
    }
    if ($url === 'https://adaptive.example/hd/index.m3u8') {
        $body = "#EXTM3U\n#EXTINF:4,\na.ts\n#EXTINF:4,\nb.ts\n#EXTINF:4,\nc.ts\n";
        return [
            'ok' => true,
            'http_code' => 200,
            'content_type' => 'application/vnd.apple.mpegurl',
            'body' => $body,
            'bytes' => strlen($body),
            'duration_ms' => 25,
        ];
    }
    if (strpos($url, 'https://adaptive.example/hd/') === 0) {
        return [
            'ok' => true,
            'http_code' => 206,
            'content_type' => 'video/mp2t',
            'body' => '',
            'bytes' => 262144,
            'duration_ms' => 400,
            'ttfb_ms' => 60,
        ];
    }
    throw new RuntimeException('Unexpected adaptive probe URL: ' . $url);
});
$variantSource = $variantResult['data']['sources'][0];
$assertSame('available', $variantSource['status'], 'A lower HLS variant should be tried when the highest resolution is unavailable.');
$assertSame(1920, $variantSource['tested_width'], 'The result should identify the successfully sampled variant width.');
$assertSame(1080, $variantSource['tested_height'], 'The result should identify the successfully sampled variant height.');
$assertSame(3840, $variantSource['max_width'], 'The result should retain the maximum declared source width.');
$assertSame(2160, $variantSource['max_height'], 'The result should retain the maximum declared source height.');
$assertSame('manifest', $variantSource['resolution_basis'], 'HLS master resolution must be labeled as manifest metadata.');
$assertSame(3500, $variantSource['variant_bandwidth_kbps'], 'Average bandwidth should be preferred for the tested variant.');
$assertSame('avc1.640028,mp4a.40.2', $variantSource['variant_codecs'], 'Quoted CODECS values containing commas should remain intact.');
$assertSame(true, $variantSource['fallback_used'], 'The response should disclose that a lower variant was used.');
$assertSame([
    'https://adaptive.example/master.m3u8',
    'https://adaptive.example/ultra/index.m3u8',
    'https://adaptive.example/hd/index.m3u8',
    'https://adaptive.example/hd/a.ts',
    'https://adaptive.example/hd/b.ts',
    'https://adaptive.example/hd/c.ts',
], $variantRequests, 'Variants should be tried by declared resolution instead of playlist order.');
$variantEncoded = json_encode($variantResult, JSON_UNESCAPED_UNICODE);
$assertSame(false, strpos($variantEncoded, 'adaptive.example'), 'Variant and segment URLs must not be exposed in the response.');

$invalidResolutionResult = VodSourceQuality::inspectVod([
    'vod_id' => 49,
    'vod_play_from' => 'named-1080p',
    'vod_play_url' => '第1集$https://invalid-resolution.example/master.m3u8',
], 1, static function ($url) {
    if ($url === 'https://invalid-resolution.example/master.m3u8') {
        $body = "#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=9000000,RESOLUTION=unknown\nmedia.m3u8\n";
        return [
            'ok' => true,
            'http_code' => 200,
            'content_type' => 'application/vnd.apple.mpegurl',
            'body' => $body,
            'bytes' => strlen($body),
            'duration_ms' => 20,
        ];
    }
    if ($url === 'https://invalid-resolution.example/media.m3u8') {
        $body = "#EXTM3U\n#EXTINF:4,\na.ts\n#EXTINF:4,\nb.ts\n";
        return [
            'ok' => true,
            'http_code' => 200,
            'content_type' => 'application/vnd.apple.mpegurl',
            'body' => $body,
            'bytes' => strlen($body),
            'duration_ms' => 20,
        ];
    }
    return [
        'ok' => true,
        'http_code' => 206,
        'content_type' => 'video/mp2t',
        'body' => '',
        'bytes' => 262144,
        'duration_ms' => 500,
        'ttfb_ms' => 70,
    ];
});
$invalidResolutionSource = $invalidResolutionResult['data']['sources'][0];
$assertSame('available', $invalidResolutionSource['status'], 'Invalid resolution metadata should not block media availability checks.');
$assertSame(null, $invalidResolutionSource['tested_width'], 'Malformed RESOLUTION metadata must be ignored.');
$assertSame(null, $invalidResolutionSource['max_width'], 'Malformed RESOLUTION metadata must not become a maximum resolution.');
$assertSame('unknown', $invalidResolutionSource['resolution_basis'], 'Malformed RESOLUTION metadata should remain unknown.');

echo "Video source quality behavior tests passed.\n";
