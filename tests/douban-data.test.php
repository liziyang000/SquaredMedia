<?php

require __DIR__ . '/../addons/douban/service/DoubanData.php';

use addons\douban\service\DoubanData;

$defaults = DoubanData::configDefaults();
if (($defaults['douban_endpoint'] ?? '') !== 'internal') {
    fwrite(STDERR, "The default Douban endpoint should use the internal gateway\n");
    exit(1);
}
if (($defaults['max_attempts'] ?? 0) !== 5) {
    fwrite(STDERR, "The default task retry limit should be five attempts\n");
    exit(1);
}

function assertResolvedId(string $expected, array $meta, array $vod, string $message): void
{
    $method = new ReflectionMethod(DoubanData::class, 'resolveDoubanId');
    $method->setAccessible(true);
    $actual = $method->invoke(null, $meta, $vod);
    if ($expected !== $actual) {
        fwrite(STDERR, $message . ': expected ' . var_export($expected, true) . ', got ' . var_export($actual, true) . PHP_EOL);
        exit(1);
    }
}

assertResolvedId('', [], ['vod_douban_id' => 0], 'Numeric zero should be treated as a missing Douban ID');
assertResolvedId('', ['douban_id' => '000'], [], 'All-zero metadata should be treated as a missing Douban ID');
assertResolvedId('1295644', [], ['vod_douban_id' => '1295644'], 'A valid video Douban ID should be preserved');
assertResolvedId('1292052', ['douban_id' => '1292052'], ['vod_douban_id' => '1295644'], 'Metadata should take precedence');

$validateMethod = new ReflectionMethod(DoubanData::class, 'validateDoubanData');
$validateMethod->setAccessible(true);
$validated = $validateMethod->invoke(null, [
    'id' => '1295644',
    'score' => '9.4',
    'vod_name' => '这个杀手不太冷',
], '1295644');
if (($validated['vod_douban_score'] ?? '') !== '9.4' || ($validated['vod_score'] ?? '') !== '9.4') {
    fwrite(STDERR, "Custom endpoint score should be normalized\n");
    exit(1);
}

$missingScoreRejected = false;
try {
    $validateMethod->invoke(null, ['id' => '1295644'], '1295644');
} catch (RuntimeException $e) {
    $missingScoreRejected = $e->getMessage() === '豆瓣数据源未返回有效评分';
}
if (!$missingScoreRejected) {
    fwrite(STDERR, "Custom endpoint responses without a score should be rejected\n");
    exit(1);
}

$mismatchedIdRejected = false;
try {
    $validateMethod->invoke(null, ['id' => '1292052', 'score' => '9.7'], '1295644');
} catch (RuntimeException $e) {
    $mismatchedIdRejected = $e->getMessage() === '豆瓣数据源ID与请求不一致';
}
if (!$mismatchedIdRejected) {
    fwrite(STDERR, "Custom endpoint responses for another subject should be rejected\n");
    exit(1);
}

$normalizeConfigMethod = new ReflectionMethod(DoubanData::class, 'normalizeConfig');
$normalizeConfigMethod->setAccessible(true);
$boundedConfig = $normalizeConfigMethod->invoke(null, ['max_attempts' => 99]);
if (($boundedConfig['max_attempts'] ?? 0) !== 10) {
    fwrite(STDERR, "Task retry limits should be capped at ten attempts\n");
    exit(1);
}

$failureUpdateMethod = new ReflectionMethod(DoubanData::class, 'taskFailureUpdate');
$failureUpdateMethod->setAccessible(true);
$retryingUpdate = $failureUpdateMethod->invoke(null, 2, 5, 1000);
if (($retryingUpdate['status'] ?? '') !== 'PENDING' || ($retryingUpdate['run_after'] ?? 0) !== 2800) {
    fwrite(STDERR, "A retryable second failure should be delayed for thirty minutes\n");
    exit(1);
}
$terminalUpdate = $failureUpdateMethod->invoke(null, 5, 5, 1000);
if (($terminalUpdate['status'] ?? '') !== 'FAILED' || ($terminalUpdate['run_after'] ?? -1) !== 0) {
    fwrite(STDERR, "The final allowed attempt should move the task to FAILED\n");
    exit(1);
}

$reservationMethod = new ReflectionMethod(DoubanData::class, 'requestReservation');
$reservationMethod->setAccessible(true);
$immediateReservation = $reservationMethod->invoke(null, 100.0, 90.0, 2.0);
if (($immediateReservation['reserved_at'] ?? 0.0) !== 100.0 || ($immediateReservation['next_available_at'] ?? 0.0) !== 102.0) {
    fwrite(STDERR, "An idle global rate limiter should reserve the current slot\n");
    exit(1);
}
$queuedReservation = $reservationMethod->invoke(null, 100.0, 105.0, 2.0);
if (($queuedReservation['reserved_at'] ?? 0.0) !== 105.0 || ($queuedReservation['next_available_at'] ?? 0.0) !== 107.0) {
    fwrite(STDERR, "Concurrent workers should reserve non-overlapping request slots\n");
    exit(1);
}

$candidateMethod = new ReflectionMethod(DoubanData::class, 'candidateForView');
$candidateMethod->setAccessible(true);
$candidate = $candidateMethod->invoke(null, [
    'douban_id' => '1295644',
    'score_total' => 100,
    'score_detail' => json_encode([
        'title' => 75,
        'year' => 25,
        'candidate_title' => '这个杀手不太冷',
        'candidate_year' => '1994',
    ], JSON_UNESCAPED_UNICODE),
]);
if (($candidate['candidate_title'] ?? '') !== '这个杀手不太冷' || ($candidate['candidate_year'] ?? '') !== '1994') {
    fwrite(STDERR, "Saved candidates should expose title and year to the review page\n");
    exit(1);
}

$categoryRows = [
    ['type_id' => 1, 'type_pid' => 0, 'type_mid' => 1, 'type_name' => '电影', 'type_sort' => 1],
    ['type_id' => 2, 'type_pid' => 1, 'type_mid' => 1, 'type_name' => '动作片', 'type_sort' => 1],
    ['type_id' => 3, 'type_pid' => 2, 'type_mid' => 1, 'type_name' => '功夫片', 'type_sort' => 1],
    ['type_id' => 4, 'type_pid' => 0, 'type_mid' => 1, 'type_name' => '剧集', 'type_sort' => 2],
    ['type_id' => 5, 'type_pid' => 1, 'type_mid' => 2, 'type_name' => '影评', 'type_sort' => 1],
];
$resolveTypesMethod = new ReflectionMethod(DoubanData::class, 'resolveCalibrationTypeIds');
$resolveTypesMethod->setAccessible(true);
$typeScope = $resolveTypesMethod->invoke(null, [1], true, $categoryRows);
if ($typeScope !== [1, 2, 3]) {
    fwrite(STDERR, "Category calibration should recursively include descendants\n");
    exit(1);
}
$exactTypeScope = $resolveTypesMethod->invoke(null, [2], false, $categoryRows);
if ($exactTypeScope !== [2]) {
    fwrite(STDERR, "Exact category calibration should not include descendants\n");
    exit(1);
}

$emptyTypeScopeRejected = false;
try {
    $resolveTypesMethod->invoke(null, [], true, $categoryRows);
} catch (InvalidArgumentException $e) {
    $emptyTypeScopeRejected = $e->getMessage() === '请至少选择一个分类';
}
if (!$emptyTypeScopeRejected) {
    fwrite(STDERR, "Category calibration should reject an empty scope\n");
    exit(1);
}

$unknownTypeRejected = false;
try {
    $resolveTypesMethod->invoke(null, [999], true, $categoryRows);
} catch (InvalidArgumentException $e) {
    $unknownTypeRejected = $e->getMessage() === '所选分类不存在';
}
if (!$unknownTypeRejected) {
    fwrite(STDERR, "Category calibration should reject unknown category IDs\n");
    exit(1);
}

$categoryOptionsMethod = new ReflectionMethod(DoubanData::class, 'categoryOptionsFromRows');
$categoryOptionsMethod->setAccessible(true);
$categoryOptions = $categoryOptionsMethod->invoke(null, $categoryRows);
$optionLabels = array_column($categoryOptions, 'display_name', 'type_id');
if (($optionLabels[3] ?? '') !== '电影 / 动作片 / 功夫片') {
    fwrite(STDERR, "Category options should expose a readable hierarchy path\n");
    exit(1);
}
if (isset($optionLabels[5])) {
    fwrite(STDERR, "Category calibration should not expose non-video categories\n");
    exit(1);
}

$scopeSqlMethod = new ReflectionMethod(DoubanData::class, 'scoreCalibrationScopeSql');
$scopeSqlMethod->setAccessible(true);
[$scopeSql, $scopeBind] = $scopeSqlMethod->invoke(null, [3, 1, 3]);
if ($scopeSql !== 'type_id IN (?,?)' || $scopeBind !== [3, 1]) {
    fwrite(STDERR, "Category calibration SQL should deduplicate IDs and bind placeholders\n");
    exit(1);
}

$targetedFiltersMethod = new ReflectionMethod(DoubanData::class, 'normalizeTargetedFilters');
$targetedFiltersMethod->setAccessible(true);
$targetedFilters = $targetedFiltersMethod->invoke(null, [
    'type_ids' => [2],
    'include_children' => 1,
    'target' => 'missing_score',
    'year_from' => '2024',
    'year_to' => '2026',
    'q' => '喜剧片',
    'limit' => 999,
], $categoryRows);
if (($targetedFilters['type_ids'] ?? []) !== [2, 3]
    || ($targetedFilters['target'] ?? '') !== 'missing_score'
    || ($targetedFilters['year_from'] ?? 0) !== 2024
    || ($targetedFilters['year_to'] ?? 0) !== 2026
    || ($targetedFilters['q'] ?? '') !== '喜剧片'
    || ($targetedFilters['limit'] ?? 0) !== 500) {
    fwrite(STDERR, "Targeted task filters should normalize category, year, keyword, and limit inputs\n");
    exit(1);
}

$emptyTargetedScopeRejected = false;
try {
    $targetedFiltersMethod->invoke(null, ['type_ids' => []], $categoryRows);
} catch (InvalidArgumentException $e) {
    $emptyTargetedScopeRejected = $e->getMessage() === '请至少选择一个分类';
}
if (!$emptyTargetedScopeRejected) {
    fwrite(STDERR, "Targeted task generation should reject an empty category scope\n");
    exit(1);
}

$invalidTargetRejected = false;
try {
    $targetedFiltersMethod->invoke(null, ['type_ids' => [1], 'target' => 'unknown'], $categoryRows);
} catch (InvalidArgumentException $e) {
    $invalidTargetRejected = $e->getMessage() === '数据范围无效';
}
if (!$invalidTargetRejected) {
    fwrite(STDERR, "Targeted task generation should reject unknown data scopes\n");
    exit(1);
}

$invalidYearRejected = false;
try {
    $targetedFiltersMethod->invoke(null, [
        'type_ids' => [1],
        'year_from' => 2026,
        'year_to' => 2024,
    ], $categoryRows);
} catch (InvalidArgumentException $e) {
    $invalidYearRejected = $e->getMessage() === '起始年份不能大于结束年份';
}
if (!$invalidYearRejected) {
    fwrite(STDERR, "Targeted task generation should reject reversed year ranges\n");
    exit(1);
}

$malformedYearRejected = false;
try {
    $targetedFiltersMethod->invoke(null, [
        'type_ids' => [1],
        'year_from' => 'not-a-year',
    ], $categoryRows);
} catch (InvalidArgumentException $e) {
    $malformedYearRejected = $e->getMessage() === '年份范围无效';
}
if (!$malformedYearRejected) {
    fwrite(STDERR, "Targeted task generation should reject malformed year inputs\n");
    exit(1);
}

$targetedWhereMethod = new ReflectionMethod(DoubanData::class, 'targetedWhere');
$targetedWhereMethod->setAccessible(true);
[$targetedWhere, $targetedBind] = $targetedWhereMethod->invoke(
    null,
    $targetedFilters,
    [42, 47],
    'resolved_douban_id',
    1000
);
if (!str_contains($targetedWhere, 'v.type_id IN (?,?)')
    || !str_contains($targetedWhere, 'v.type_id NOT IN (?,?)')
    || !str_contains($targetedWhere, 'IFNULL(v.vod_douban_score, 0) = 0')
    || str_contains($targetedWhere, '喜剧片')
    || !in_array('%喜剧片%', $targetedBind, true)) {
    fwrite(STDERR, "Targeted task SQL should bind filters and keep user input out of the SQL string\n");
    exit(1);
}

$prepareTaskRowsMethod = new ReflectionMethod(DoubanData::class, 'prepareTaskRows');
$prepareTaskRowsMethod->setAccessible(true);
$preparedTasks = $prepareTaskRowsMethod->invoke(null, [
    ['vod_id' => 1, 'vod_name' => '待匹配影片', 'vod_year' => '2026'],
    ['vod_id' => 2, 'vod_name' => '待同步影片', 'vod_year' => '2025', 'meta_douban_id' => '1295644'],
    ['vod_id' => 3, 'vod_name' => '已有匹配任务', 'vod_year' => '2024'],
    ['vod_id' => 4, 'vod_name' => '已有同步任务', 'vod_year' => '2023', 'vod_douban_id' => '1292052'],
], [
    '3:MATCH_DOUBAN_ID' => true,
    '4:SYNC_DOUBAN' => true,
], 1000);
if (count($preparedTasks['task_rows'] ?? []) !== 2
    || ($preparedTasks['match_created'] ?? 0) !== 1
    || ($preparedTasks['sync_created'] ?? 0) !== 1
    || ($preparedTasks['match_vod_ids'] ?? []) !== [1]) {
    fwrite(STDERR, "Targeted task preparation should split task types and deduplicate active tasks\n");
    exit(1);
}

echo "Douban data tests passed\n";
