<?php

declare(strict_types=1);

require dirname(__DIR__) . '/addons/vodops/service/VodQualityAnalyzer.php';
require dirname(__DIR__) . '/addons/vodops/service/VodQualityScanner.php';

use addons\vodops\service\VodQualityAnalyzer;
use addons\vodops\service\VodQualityActionException;
use addons\vodops\service\VodQualityScanner;

function vodops_fail(string $message): void
{
    fwrite(STDERR, $message . "\n");
    exit(1);
}

function vodops_assert_same($expected, $actual, string $message): void
{
    if ($expected !== $actual) {
        vodops_fail($message . "\nExpected: " . var_export($expected, true) . "\nActual: " . var_export($actual, true));
    }
}

function vodops_issue_types(array $issues): array
{
    $types = array_column($issues, 'issue_type');
    sort($types);
    return $types;
}

$typeMap = [
    10 => ['type_id' => 10, 'type_pid' => 0, 'type_name' => '电影'],
    11 => ['type_id' => 11, 'type_pid' => 10, 'type_name' => '动作片'],
];

$categoryMap = [
    10 => ['type_id' => 10, 'type_pid' => 0, 'type_name' => '电影', 'type_sort' => 100],
    11 => ['type_id' => 11, 'type_pid' => 10, 'type_name' => '动作片', 'type_sort' => 90],
    12 => ['type_id' => 12, 'type_pid' => 10, 'type_name' => '喜剧片', 'type_sort' => 80],
    13 => ['type_id' => 13, 'type_pid' => 11, 'type_name' => '功夫片', 'type_sort' => 70],
    20 => ['type_id' => 20, 'type_pid' => 0, 'type_name' => '电视剧', 'type_sort' => 60],
];
$categoryScopeMethod = new ReflectionMethod(VodQualityScanner::class, 'categoryScope');
$categoryScopeMethod->setAccessible(true);
$movieScope = $categoryScopeMethod->invoke(null, 10, $categoryMap);
vodops_assert_same([10, 11, 12, 13], $movieScope['type_ids'] ?? null, 'A parent-category scan should freeze every current descendant ID.');
vodops_assert_same('电影', $movieScope['label'] ?? null, 'A category scan should retain a stable history label.');
$leafScope = $categoryScopeMethod->invoke(null, 13, $categoryMap);
vodops_assert_same([13], $leafScope['type_ids'] ?? null, 'A leaf-category scan should only include that exact category.');
try {
    $categoryScopeMethod->invoke(null, 999, $categoryMap);
    vodops_fail('Unknown category scopes must be rejected before a scan is created.');
} catch (ReflectionException $e) {
    throw $e;
} catch (Throwable $e) {
    $cause = $e instanceof ReflectionException ? $e : ($e->getPrevious() ?: $e);
    if (!$cause instanceof VodQualityActionException) {
        vodops_fail('Unknown category scopes should use an actionable public exception.');
    }
}
try {
    $categoryScopeMethod->invoke(null, -1, $categoryMap);
    vodops_fail('Negative category scopes must not expand silently into an all-category scan.');
} catch (Throwable $e) {
    $cause = $e->getPrevious() ?: $e;
    if (!$cause instanceof VodQualityActionException) {
        vodops_fail('Negative category scopes should use an actionable public exception.');
    }
}
$categoryOptionsMethod = new ReflectionMethod(VodQualityScanner::class, 'categoryOptionsFromMap');
$categoryOptionsMethod->setAccessible(true);
$categoryOptions = $categoryOptionsMethod->invoke(null, $categoryMap);
vodops_assert_same([10, 11, 13, 12, 20], array_column($categoryOptions, 'type_id'), 'Category choices should follow the hierarchy and configured sort order.');
vodops_assert_same('—— 功夫片', $categoryOptions[2]['label'] ?? null, 'Nested category choices should expose their hierarchy.');

$validVod = [
    'vod_id' => 100,
    'vod_name' => '测试影片',
    'type_id' => 11,
    'type_id_1' => 10,
    'vod_year' => '2026',
    'vod_area' => '中国大陆',
    'vod_lang' => '国语',
    'vod_pic' => 'https://img.example.com/poster.jpg',
    'vod_play_from' => 'line1',
    'vod_play_url' => '第1集$https://media.example.com/one.m3u8',
];

vodops_assert_same([], VodQualityAnalyzer::analyze($validVod, $typeMap), 'A complete row should not produce issues.');

$missingName = $validVod;
$missingName['vod_name'] = " \t";
vodops_assert_same(
    ['name_missing'],
    vodops_issue_types(VodQualityAnalyzer::analyze($missingName, $typeMap)),
    'A blank video title should be reported.'
);

$topLevelVod = $validVod;
$topLevelVod['type_id'] = 10;
$topLevelVod['type_id_1'] = 0;
vodops_assert_same(
    [],
    VodQualityAnalyzer::analyze($topLevelVod, $typeMap),
    'A top-level category should keep the native zero parent ID.'
);

$missing = $validVod;
$missing['vod_year'] = '0';
$missing['vod_area'] = '';
$missing['vod_lang'] = " \t";
$missing['vod_pic'] = '';
$missing['vod_play_from'] = '';
$missing['vod_play_url'] = '';
vodops_assert_same(
    ['area_missing', 'lang_missing', 'play_source_missing', 'poster_missing', 'year_missing'],
    vodops_issue_types(VodQualityAnalyzer::analyze($missing, $typeMap)),
    'Missing metadata should be classified deterministically.'
);

$mismatchedPlayGroups = $validVod;
$mismatchedPlayGroups['vod_play_from'] = 'line1$$$line2';
$playIssues = VodQualityAnalyzer::analyze($mismatchedPlayGroups, $typeMap);
vodops_assert_same(
    ['play_group_mismatch'],
    vodops_issue_types($playIssues),
    'Playback source and payload group counts should remain aligned.'
);
vodops_assert_same(2, $playIssues[0]['detail']['source_group_count'] ?? null, 'The source group count should be auditable.');
vodops_assert_same(1, $playIssues[0]['detail']['url_group_count'] ?? null, 'The payload group count should be auditable.');
if (strpos((string) ($playIssues[0]['current_value'] ?? ''), 'media.example.com') !== false) {
    vodops_fail('Playback consistency issues must not expose source URLs.');
}

$emptyPlayGroup = $validVod;
$emptyPlayGroup['vod_play_from'] = 'line1$$$$$$line3';
$emptyPlayGroup['vod_play_url'] = '第1集$one$$$第1集$two$$$第1集$three';
$emptyGroupIssues = VodQualityAnalyzer::analyze($emptyPlayGroup, $typeMap);
vodops_assert_same(
    ['play_group_mismatch'],
    vodops_issue_types($emptyGroupIssues),
    'Empty playback groups should be reported even when both sides have the same group count.'
);
vodops_assert_same([2], $emptyGroupIssues[0]['detail']['empty_source_groups'] ?? null, 'Empty source group positions should use one-based indexes.');

$emptyPlayGroup['vod_play_from'] = 'line1$$$line2$$$line3';
$emptyPlayGroup['vod_play_url'] = '第1集$one$$$$$$第1集$three';
$emptyGroupIssues = VodQualityAnalyzer::analyze($emptyPlayGroup, $typeMap);
vodops_assert_same([2], $emptyGroupIssues[0]['detail']['empty_url_groups'] ?? null, 'Empty payload group positions should be auditable without exposing URLs.');

$invalidYear = $validVod;
$invalidYear['vod_year'] = '20X6';
vodops_assert_same(
    ['year_invalid'],
    vodops_issue_types(VodQualityAnalyzer::analyze($invalidYear, $typeMap)),
    'Malformed years should be distinguished from missing years.'
);

$wrongParent = $validVod;
$wrongParent['type_id_1'] = 99;
$issues = VodQualityAnalyzer::analyze($wrongParent, $typeMap);
vodops_assert_same(['type_parent_mismatch'], vodops_issue_types($issues), 'A wrong primary category should be reported.');
vodops_assert_same(10, $issues[0]['detail']['expected_type_id_1'] ?? null, 'The expected primary category must be recorded.');

$unknownType = $validVod;
$unknownType['type_id'] = 999;
vodops_assert_same(
    ['type_unknown'],
    vodops_issue_types(VodQualityAnalyzer::analyze($unknownType, $typeMap)),
    'Unknown category IDs should not be guessed.'
);

$siteRoot = sys_get_temp_dir() . '/vodops-analyzer-' . bin2hex(random_bytes(6));
if (!mkdir($siteRoot . '/upload/vod', 0777, true)) {
    vodops_fail('Unable to create analyzer fixture.');
}
file_put_contents($siteRoot . '/upload/vod/existing.jpg', 'poster');

$localPoster = $validVod;
$localPoster['vod_pic'] = 'upload/vod/existing.jpg';
vodops_assert_same(
    [],
    VodQualityAnalyzer::analyze($localPoster, $typeMap, ['site_root' => $siteRoot, 'remote_upload' => false]),
    'An existing local poster should remain valid.'
);

$localPoster['vod_pic'] = '/upload/vod/missing.jpg';
vodops_assert_same(
    ['poster_file_missing'],
    vodops_issue_types(VodQualityAnalyzer::analyze($localPoster, $typeMap, ['site_root' => $siteRoot, 'remote_upload' => false])),
    'A missing local poster file should be reported.'
);
vodops_assert_same(
    [],
    VodQualityAnalyzer::analyze($localPoster, $typeMap, ['site_root' => $siteRoot, 'remote_upload' => true]),
    'Remote-storage keys must not be checked against the local filesystem.'
);

$sameVod = $validVod;
$sameVod['vod_id'] = 101;
$fingerprint = VodQualityAnalyzer::strictFingerprint($validVod);
vodops_assert_same($fingerprint, VodQualityAnalyzer::strictFingerprint($sameVod), 'Strict duplicates should share a fingerprint.');

$otherSource = $sameVod;
$otherSource['vod_play_url'] = '第1集$https://media.example.com/two.m3u8';
if ($fingerprint === VodQualityAnalyzer::strictFingerprint($otherSource)) {
    vodops_fail('Different playback payloads must not share a strict fingerprint.');
}
if (strpos((string) $fingerprint, 'media.example.com') !== false) {
    vodops_fail('Fingerprints must not expose playback URLs.');
}

$incomplete = $validVod;
$incomplete['vod_play_url'] = '';
vodops_assert_same(null, VodQualityAnalyzer::strictFingerprint($incomplete), 'Rows without playback data are not duplicate candidates.');

$labels = VodQualityAnalyzer::issueTypes();
foreach (['name_missing', 'type_parent_mismatch', 'poster_file_missing', 'play_group_mismatch', 'exact_duplicate'] as $type) {
    if (!isset($labels[$type])) {
        vodops_fail('Issue label is missing: ' . $type);
    }
}

$vodopsMaccmsConfig = ['upload' => ['mode' => 'local']];
if (!function_exists('config')) {
    function config($name)
    {
        global $vodopsMaccmsConfig;
        return $name === 'maccms' ? $vodopsMaccmsConfig : null;
    }
}
$siteContextMethod = new ReflectionMethod(VodQualityScanner::class, 'siteContext');
$siteContextMethod->setAccessible(true);
vodops_assert_same(false, $siteContextMethod->invoke(null)['remote_upload'] ?? null, 'Local uploads should check local poster files.');
$vodopsMaccmsConfig['upload']['mode'] = 'remote';
vodops_assert_same(true, $siteContextMethod->invoke(null)['remote_upload'] ?? null, 'Remote URL mode should skip local poster checks.');
$vodopsMaccmsConfig['upload']['mode'] = 'S3';
vodops_assert_same(true, $siteContextMethod->invoke(null)['remote_upload'] ?? null, 'Third-party object storage should skip local poster checks.');

$decorateScanMethod = new ReflectionMethod(VodQualityScanner::class, 'decorateScan');
$decorateScanMethod->setAccessible(true);
$decoratedScan = $decorateScanMethod->invoke(null, [
    'status' => 'completed',
    'total_count' => 100,
    'processed_count' => 100,
    'started_at' => 100,
    'finished_at' => 225,
    'updated_at' => 225,
]);
vodops_assert_same('2分5秒', $decoratedScan['duration_label'] ?? null, 'Completed scans should expose an exact human-readable duration.');
vodops_assert_same(date('Y-m-d H:i:s', 225), $decoratedScan['updated_at_label'] ?? null, 'Scan records should expose their latest update time.');

$scopedScan = $decorateScanMethod->invoke(null, [
    'status' => 'completed',
    'total_count' => 20,
    'processed_count' => 20,
    'started_at' => 100,
    'finished_at' => 225,
    'updated_at' => 225,
    'scope_json' => '{"type_id":10,"type_ids":[10,11,12,13],"label":"电影"}',
]);
vodops_assert_same(10, $scopedScan['scope_type_id'] ?? null, 'Scan history should retain the selected root category.');
vodops_assert_same([10, 11, 12, 13], $scopedScan['scope_type_ids'] ?? null, 'Scan history should retain its frozen category IDs.');
vodops_assert_same('电影（含 4 个分类）', $scopedScan['scope_label'] ?? null, 'Scan history should explain descendant coverage.');

$now = time();
$trafficScan = $decorateScanMethod->invoke(null, [
    'status' => 'running',
    'total_count' => 100,
    'processed_count' => 20,
    'started_at' => $now - 30,
    'updated_at' => $now - 2,
    'execution_mode' => 'traffic',
    'lease_until' => $now + 120,
    'next_run_at' => 0,
]);
vodops_assert_same('worker', $trafficScan['execution_mode'] ?? null, 'Legacy traffic-driven scans should migrate logically to the CLI worker.');
vodops_assert_same('后台任务', $trafficScan['execution_mode_label'] ?? null, 'Worker scans should identify their execution mode.');
vodops_assert_same('正在处理', $trafficScan['runner_state_label'] ?? null, 'An active worker lease should be visible as a heartbeat.');
vodops_assert_same(true, $trafficScan['lease_active'] ?? null, 'A future worker lease should be marked active.');

$staleTrafficScan = $decorateScanMethod->invoke(null, [
    'status' => 'running',
    'total_count' => 100,
    'processed_count' => 20,
    'started_at' => $now - 600,
    'updated_at' => $now - 300,
    'execution_mode' => 'traffic',
    'lease_until' => $now - 1,
    'next_run_at' => 0,
]);
vodops_assert_same(true, $staleTrafficScan['lease_expired'] ?? null, 'An abandoned worker lease should be detected.');
vodops_assert_same('租约已过期，等待 Worker 恢复', $staleTrafficScan['runner_state_label'] ?? null, 'Expired work should advertise automatic recovery.');

$legacyManualScan = $decorateScanMethod->invoke(null, [
    'status' => 'running',
    'total_count' => 10,
    'processed_count' => 0,
    'started_at' => $now,
    'updated_at' => $now,
]);
vodops_assert_same('manual', $legacyManualScan['execution_mode'] ?? null, 'Existing scan rows should remain manual after the additive upgrade.');
vodops_assert_same('仅页面驱动', $legacyManualScan['runner_state_label'] ?? null, 'Legacy scans should not become background work implicitly.');

$completedWithMissingRows = $decorateScanMethod->invoke(null, [
    'status' => 'completed',
    'total_count' => 100,
    'processed_count' => 97,
    'started_at' => 100,
    'finished_at' => 225,
    'updated_at' => 225,
]);
vodops_assert_same(100, $completedWithMissingRows['progress_percent'] ?? null, 'A terminal scan should still render as complete.');
vodops_assert_same(3, $completedWithMissingRows['source_missing_count'] ?? null, 'Rows removed during the bounded scan should remain visible as a count difference.');

$failedScan = $decorateScanMethod->invoke(null, [
    'status' => 'running',
    'total_count' => 100,
    'processed_count' => 20,
    'started_at' => 100,
    'updated_at' => 225,
    'error_message' => 'SQLSTATE sensitive table path',
]);
vodops_assert_same(
    '本批扫描失败，请查看服务端日志后重试。',
    $failedScan['error_message'] ?? null,
    'Scan responses should replace internal errors with a stable public message.'
);
if (strpos((string) ($failedScan['error_message'] ?? ''), 'SQLSTATE') !== false) {
    vodops_fail('Decorated scan errors must not expose internal database details.');
}

$decorateIssueMethod = new ReflectionMethod(VodQualityScanner::class, 'decorateIssue');
$decorateIssueMethod->setAccessible(true);
$parentIssue = $decorateIssueMethod->invoke(null, [
    'issue_type' => 'type_parent_mismatch',
    'detail_json' => '{"expected_type_id_1":10}',
    'created_at' => 225,
]);
vodops_assert_same('预期父分类 ID：#10', $parentIssue['detail_label'] ?? null, 'Parent mismatch details should be visible without opening the CSV.');
$groupIssue = $decorateIssueMethod->invoke(null, [
    'issue_type' => 'play_group_mismatch',
    'detail_json' => '{"source_group_count":3,"url_group_count":3,"empty_source_groups":[2],"empty_url_groups":[3]}',
    'created_at' => 225,
]);
vodops_assert_same(
    '来源 3 组；地址 3 组；空来源组：2；空地址组：3',
    $groupIssue['detail_label'] ?? null,
    'Playback group positions should be readable without exposing playback URLs.'
);

unlink($siteRoot . '/upload/vod/existing.jpg');
rmdir($siteRoot . '/upload/vod');
rmdir($siteRoot . '/upload');
rmdir($siteRoot);

echo "Vodops analyzer tests passed\n";
