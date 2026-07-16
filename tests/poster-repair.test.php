<?php

declare(strict_types=1);

require __DIR__ . '/../scripts/repair-vod-posters.php';

function assert_same($expected, $actual, string $message): void
{
    if ($expected !== $actual) {
        fwrite(STDERR, $message . "\nExpected: " . var_export($expected, true) . "\nActual: " . var_export($actual, true) . "\n");
        exit(1);
    }
}

$testRoot = sys_get_temp_dir() . '/poster-repair-test-' . bin2hex(random_bytes(6));
$existingRelativePic = 'upload/vod/20260714-1/a.jpg';
if (!mkdir($testRoot . '/upload/vod/20260714-1', 0777, true) || file_put_contents($testRoot . '/' . $existingRelativePic, 'poster') === false) {
    fwrite(STDERR, "Unable to create poster repair test fixture.\n");
    exit(1);
}
if (!mkdir($testRoot . '/application/extra', 0777, true)) {
    fwrite(STDERR, "Unable to create MacCMS config test fixture.\n");
    exit(1);
}
$configPath = $testRoot . '/application/extra/maccms.php';
file_put_contents($configPath, "<?php return ['upload' => ['mode' => 'remote']];\n");
assert_same(true, poster_repair_uses_remote_upload($testRoot), 'Remote upload mode should preserve relative storage keys.');
file_put_contents($configPath, "<?php return ['upload' => ['mode' => 'local']];\n");
assert_same(false, poster_repair_uses_remote_upload($testRoot), 'Local upload mode should check relative files on disk.');

assert_same(false, poster_repair_is_target_pic($existingRelativePic, $testRoot), 'Existing local posters should not be repair targets.');
assert_same(false, poster_repair_is_target_pic('/' . $existingRelativePic, $testRoot), 'Existing root-relative posters should not be repair targets.');
assert_same(true, poster_repair_is_target_pic('upload/vod/20260714-1/missing.jpg', $testRoot), 'Missing local posters should be repair targets.');
assert_same(false, poster_repair_is_target_pic('upload/vod/20260714-1/remote.jpg', $testRoot, true), 'Relative remote-storage posters should not be checked on the local filesystem.');
assert_same(true, poster_repair_is_target_pic('data:image/jpeg;base64,broken', $testRoot, true), 'Unsupported schemes should remain repair targets in remote mode.');
assert_same(true, poster_repair_is_target_pic(''), 'Empty poster paths should be repair targets.');
assert_same(false, poster_repair_is_target_pic('https://img.example.com/a.jpg'), 'HTTPS posters should not be repair targets.');
assert_same(false, poster_repair_is_target_pic(' HTTP://img.example.com/a.jpg '), 'HTTP posters should not be repair targets.');
assert_same(false, poster_repair_is_target_pic('//img.example.com/a.jpg'), 'Protocol-relative posters should not be repair targets.');
assert_same(false, poster_repair_is_target_pic('mac://img.example.com/a.jpg'), 'MacCMS protocol posters should not be repair targets.');

assert_same(
    "UPDATE `mac_vod` SET vod_pic=? WHERE vod_id=? AND BINARY COALESCE(vod_pic,'')=BINARY ?",
    poster_repair_update_sql('`mac_vod`'),
    'Updates should only apply when the original poster value still matches.'
);

assert_same('庆余年第二季', poster_repair_normalize_title(' 庆余年：第二季 '), 'Title normalization should ignore spacing and punctuation.');
assert_same(
    ['NACT-142 エロティックDANCE', 'NACT-142'],
    poster_repair_search_terms('NACT-142 エロティックDANCE'),
    'Catalog codes should be used as a fallback search term.'
);

$candidate = poster_repair_pick_candidate('庆余年 第二季', '2024', [[
    'vod_name' => '庆余年：第二季',
    'vod_year' => '2024',
    'vod_pic' => 'https://img.example.com/poster.jpg',
]]);
assert_same('https://img.example.com/poster.jpg', $candidate['vod_pic'] ?? null, 'Exact normalized title and year should match.');

$candidate = poster_repair_pick_candidate('庆余年 第二季', '2024', [[
    'vod_name' => '庆余年：第二季',
    'vod_year' => '2023',
    'vod_pic' => 'https://img.example.com/wrong.jpg',
]]);
assert_same(null, $candidate, 'Conflicting years should not match.');

$candidate = poster_repair_pick_candidate('同名影片', '', [
    ['vod_name' => '同名影片', 'vod_year' => '2023', 'vod_pic' => 'https://img.example.com/one.jpg'],
    ['vod_name' => '同名影片', 'vod_year' => '2024', 'vod_pic' => 'https://img.example.com/two.jpg'],
]);
assert_same(null, $candidate, 'Ambiguous candidates should not match without a year.');

$candidate = poster_repair_pick_candidate('重复影片', '2026', [
    ['vod_name' => '重复影片', 'vod_year' => '2026', 'vod_pic' => 'https://img.example.com/same.jpg'],
    ['vod_name' => '重复影片', 'vod_year' => '2026', 'vod_pic' => 'https://img.example.com/same.jpg'],
]);
assert_same('https://img.example.com/same.jpg', $candidate['vod_pic'] ?? null, 'Equivalent duplicate candidates should not be treated as ambiguous.');

$candidate = poster_repair_pick_candidate('影片', '2026', [[
    'vod_name' => '影片',
    'vod_year' => '2026',
    'vod_pic' => '//img.example.com/poster.jpg',
]]);
assert_same('https://img.example.com/poster.jpg', $candidate['vod_pic'] ?? null, 'Protocol-relative posters should normalize to HTTPS.');

$candidate = poster_repair_douban_candidate('1295644', [
    'id' => '1295644',
    'cover_url' => 'https://img.example.com/douban.jpg',
]);
assert_same('https://img.example.com/douban.jpg', $candidate['vod_pic'] ?? null, 'Matching Douban IDs should return the poster.');

$candidate = poster_repair_douban_candidate('1295644', [
    'id' => '1295645',
    'cover_url' => 'https://img.example.com/wrong.jpg',
]);
assert_same(null, $candidate, 'Mismatched Douban IDs should be rejected.');

$bangumiItems = poster_repair_bangumi_items([
    'data' => [[
        'id' => 12,
        'name' => 'ちょびっツ',
        'name_cn' => '人形电脑天使心',
        'date' => '2002-04-02',
        'images' => ['large' => 'https://lain.bgm.tv/poster.jpg'],
    ]],
]);
$candidate = poster_repair_pick_candidate('人形电脑天使心', '2002', $bangumiItems);
assert_same('https://lain.bgm.tv/poster.jpg', $candidate['vod_pic'] ?? null, 'Bangumi Chinese titles and dates should map to exact candidates.');
assert_same(true, poster_repair_is_bangumi_type(['type_id' => 57, 'type_pid' => 0], 57), 'The configured Bangumi root type should match.');
assert_same(true, poster_repair_is_bangumi_type(['type_id' => 25, 'type_pid' => 57], 57), 'Direct children of the configured Bangumi type should match.');
assert_same(false, poster_repair_is_bangumi_type(['type_id' => 121, 'type_pid' => 112], 57), 'Unrelated animation-like categories should not be queried.');

$reportMatch = poster_repair_report_match([
    'vod_id' => 123,
    'status' => 'would_update',
    'new_pic' => 'https://img.example.com/report.jpg',
    'provider_name' => '测试源',
]);
assert_same('https://img.example.com/report.jpg', $reportMatch['vod_pic'] ?? null, 'Verified dry-run matches should be reusable.');
assert_same(null, poster_repair_report_match([
    'vod_id' => 123,
    'status' => 'would_update',
    'old_pic' => $existingRelativePic,
    'new_pic' => 'https://img.example.com/report.jpg',
], $testRoot), 'Reports should not replace a local poster that now exists.');
assert_same(null, poster_repair_report_match([
    'vod_id' => 123,
    'status' => 'unmatched',
    'new_pic' => 'https://img.example.com/report.jpg',
]), 'Unmatched report rows should not be applied.');
assert_same(null, poster_repair_report_match([
    'vod_id' => 123,
    'status' => 'would_update',
    'new_pic' => 'upload/vod/local.jpg',
]), 'Non-HTTP report posters should not be applied.');

$newReportPath = $testRoot . '/new-report.jsonl';
$reportHandle = poster_repair_open_report($newReportPath);
fclose($reportHandle);
assert_same(true, is_file($newReportPath), 'A new report path should be created.');
$existingReportRejected = false;
try {
    poster_repair_open_report($newReportPath);
} catch (RuntimeException $error) {
    $existingReportRejected = true;
}
assert_same(true, $existingReportRejected, 'Existing report files should not be appended or overwritten.');

$encoded = poster_repair_encode_json(['name' => "broken-\xB1"]);
$decoded = json_decode($encoded, true, 512, JSON_THROW_ON_ERROR);
assert_same("broken-\u{FFFD}", $decoded['name'] ?? null, 'Report JSON should safely substitute invalid UTF-8.');

$memoryReport = fopen('php://memory', 'w+b');
poster_repair_write_report($memoryReport, ['vod_id' => 123, 'status' => 'updated']);
rewind($memoryReport);
assert_same(
    poster_repair_encode_json(['vod_id' => 123, 'status' => 'updated']) . "\n",
    stream_get_contents($memoryReport),
    'Report rows should be written as complete JSONL records.'
);
fclose($memoryReport);

$invalidReportPath = $testRoot . '/invalid-report.jsonl';
file_put_contents($invalidReportPath, "{invalid json}\n");
$invalidReportRejected = false;
try {
    poster_repair_load_report($invalidReportPath, $testRoot);
} catch (RuntimeException $error) {
    $invalidReportRejected = true;
}
assert_same(true, $invalidReportRejected, 'Malformed dry-run report rows should be rejected.');

$conflictingReportPath = $testRoot . '/conflicting-report.jsonl';
file_put_contents($conflictingReportPath,
    poster_repair_encode_json([
        'vod_id' => 123,
        'status' => 'would_update',
        'old_pic' => '',
        'new_pic' => 'https://img.example.com/one.jpg',
    ]) . "\n" .
    poster_repair_encode_json([
        'vod_id' => 123,
        'status' => 'would_update',
        'old_pic' => '',
        'new_pic' => 'https://img.example.com/two.jpg',
    ]) . "\n"
);
$conflictingReportRejected = false;
try {
    poster_repair_load_report($conflictingReportPath, $testRoot);
} catch (RuntimeException $error) {
    $conflictingReportRejected = true;
}
assert_same(true, $conflictingReportRejected, 'Conflicting mappings for the same vod_id should be rejected.');

$blockedFetch = poster_repair_multi_fetch(['local' => 'file:///etc/passwd'], 1, 3);
assert_same('', $blockedFetch['local']['body'] ?? null, 'Poster source requests should reject non-HTTP protocols.');
$blockedPostFetch = poster_repair_multi_fetch(['local' => [
    'url' => 'file:///etc/passwd',
    'headers' => ['Content-Type: application/json'],
    'body' => '{}',
]], 1, 3);
assert_same('', $blockedPostFetch['local']['body'] ?? null, 'JSON poster source requests should reject non-HTTP protocols.');

unlink($testRoot . '/' . $existingRelativePic);
unlink($newReportPath);
unlink($invalidReportPath);
unlink($conflictingReportPath);
unlink($configPath);
rmdir($testRoot . '/upload/vod/20260714-1');
rmdir($testRoot . '/upload/vod');
rmdir($testRoot . '/upload');
rmdir($testRoot . '/application/extra');
rmdir($testRoot . '/application');
rmdir($testRoot);

echo "poster repair tests passed\n";
