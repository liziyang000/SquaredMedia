<?php

require __DIR__ . '/../addons/douban/service/DoubanMatcher.php';

use addons\douban\service\DoubanMatcher;

function assertMatcherValue($expected, $actual, string $message): void
{
    if ($expected !== $actual) {
        fwrite(STDERR, $message . ': expected ' . var_export($expected, true) . ', got ' . var_export($actual, true) . PHP_EOL);
        exit(1);
    }
}

$exact = DoubanMatcher::rank(
    ['vod_name' => '肖申克的救赎', 'vod_year' => '1994'],
    [['douban_id' => '1292052', 'title' => '肖申克的救赎', 'year' => '1994']],
    85
);
assertMatcherValue(100, $exact['candidates'][0]['score_total'], 'Exact title and year should score 100');
assertMatcherValue(true, $exact['auto_confirm'], 'A unique exact match should auto confirm');

$ambiguous = DoubanMatcher::rank(
    ['vod_name' => '无名', 'vod_year' => '2025'],
    [
        ['douban_id' => '1', 'title' => '无名', 'year' => '2025'],
        ['douban_id' => '2', 'title' => '无名', 'year' => '2025'],
    ],
    85
);
assertMatcherValue(false, $ambiguous['auto_confirm'], 'Tied matches should require review');

$partial = DoubanMatcher::rank(
    ['vod_name' => '流浪地球', 'vod_year' => '2019'],
    [['douban_id' => '3', 'title' => '流浪地球特别版', 'year' => '2019']],
    85
);
assertMatcherValue(75, $partial['candidates'][0]['score_total'], 'Partial title plus year should stay below auto-confirm threshold');
assertMatcherValue(false, $partial['auto_confirm'], 'Partial title match should require review');

echo "Douban matcher tests passed\n";
