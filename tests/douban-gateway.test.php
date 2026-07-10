<?php

require __DIR__ . '/../addons/douban/service/DoubanGateway.php';

use addons\douban\service\DoubanGateway;

function assertSameValue($expected, $actual, string $message): void
{
    if ($expected !== $actual) {
        fwrite(STDERR, $message . ': expected ' . var_export($expected, true) . ', got ' . var_export($actual, true) . PHP_EOL);
        exit(1);
    }
}

$subject = DoubanGateway::normalizeSubject([
    'id' => '1295644',
    'title' => '这个杀手不太冷',
    'year' => '1994',
    'intro' => '里昂是一名职业杀手。',
    'countries' => ['法国', '美国'],
    'languages' => ['英语', '法语'],
    'genres' => ['剧情', '动作'],
    'directors' => [['name' => '吕克·贝松']],
    'actors' => [['name' => '让·雷诺'], ['name' => '娜塔莉·波特曼']],
    'pic' => ['large' => 'https://img.example/poster.jpg'],
    'rating' => ['value' => 9.4, 'count' => 2562776],
    'episodes_count' => 0,
]);

assertSameValue('1295644', $subject['vod_douban_id'], 'Douban ID should be normalized');
assertSameValue('9.4', $subject['vod_douban_score'], 'Canonical Douban score should be normalized');
assertSameValue('9.4', $subject['vod_score'], 'MacCMS score mirror should match Douban score');
assertSameValue('2562776', $subject['vod_score_num'], 'Douban rating count should be normalized');
assertSameValue(false, array_key_exists('vod_score_all', $subject), 'Local score total should not carry Douban aggregates');
assertSameValue('法国,美国', $subject['vod_area'], 'Countries should be joined');
assertSameValue('吕克·贝松', $subject['vod_director'], 'Directors should be joined');
assertSameValue('让·雷诺,娜塔莉·波特曼', $subject['vod_actor'], 'Actors should be joined');

$candidates = DoubanGateway::normalizeCandidates([
    [
        'id' => '1292052',
        'title' => '肖申克的救赎',
        'sub_title' => 'The Shawshank Redemption',
        'year' => '1994',
        'img' => 'https://img.example/shawshank.jpg',
        'url' => 'https://movie.douban.com/subject/1292052/',
    ],
]);

assertSameValue('1292052', $candidates[0]['douban_id'], 'Candidate ID should be normalized');
assertSameValue('肖申克的救赎', $candidates[0]['title'], 'Candidate title should be normalized');
assertSameValue('1994', $candidates[0]['year'], 'Candidate year should be normalized');

echo "Douban gateway tests passed\n";
