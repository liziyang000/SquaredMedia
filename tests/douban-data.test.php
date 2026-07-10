<?php

require __DIR__ . '/../addons/douban/service/DoubanData.php';

use addons\douban\service\DoubanData;

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

echo "Douban data tests passed\n";
