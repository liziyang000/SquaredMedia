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

echo "Douban data tests passed\n";
