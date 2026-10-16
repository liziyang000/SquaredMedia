<?php

function candidateLookup(array $incoming, array $videos): array
{
    global $db;
    $candidateDb = new PDO('sqlite::memory:');
    $candidateDb->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    foreach ($db->query("SELECT sql FROM sqlite_master WHERE type='table' AND name IN ('mac_vod','mac_type','mac_vodmerge_job','mac_vodmerge_binding')")->fetchAll(PDO::FETCH_COLUMN) as $schema) {
        $candidateDb->exec($schema);
    }
    foreach ($videos as $id => $item) {
        seed($candidateDb, $id, $item);
    }
    $candidateService = new \addons\vodmerge\service\Service($candidateDb, 'mac_', ['hls' => []], static function () {
        return ['status' => 'ok', 'answers' => [], 'model' => 'fixture'];
    });
    // Test retrieval before review() independently ranks the rows using Jev judgments.
    $lookup = new ReflectionMethod($candidateService, 'candidates');
    $lookup->setAccessible(true);
    $rows = $lookup->invoke($candidateService, $incoming);
    check(count($rows) <= 11, 'Candidate lookup always returns a bounded set');
    return ['candidates' => array_slice($rows, 0, 10), 'truncated' => count($rows) > 10];
}

$candidateIncoming = array_merge(video('共同系列 第一季'), ['vod_douban_id' => 55555]);
$candidateVideos = [];
foreach (range(1, 12) as $i) {
    $candidateVideos[$i] = array_merge(video('共同系列 第一季 特辑' . $i), ['vod_douban_id' => 0]);
}
$candidateVideos[90000] = array_merge(video('另一正式译名'), ['vod_douban_id' => 55555]);
$candidateResult = candidateLookup($candidateIncoming, $candidateVideos);
check($candidateResult['candidates'][0]['vod_id'] === 90000, 'Exact positive Douban ID precedes low-ID broad title matches');
check(count($candidateResult['candidates']) === 10 && $candidateResult['truncated'], 'A retained exact ID still reports candidates beyond the ten-row review limit');

$candidateResult = candidateLookup(array_merge(video('目标译名'), ['vod_douban_id' => 0]), [
    101 => array_merge(video('正式片名'), ['vod_douban_id' => 0, 'vod_sub' => '另一译名/目标译名|Third Name']),
]);
check(array_column($candidateResult['candidates'], 'vod_id') === [101], 'A title is recalled from the middle of an existing alias list');

$candidateResult = candidateLookup(array_merge(video('输入中文名'), ['vod_douban_id' => 0, 'vod_en' => 'Secret Valley']), [
    102 => array_merge(video('目标中文名'), ['vod_douban_id' => 0, 'vod_en' => 'Secret Valley']),
    103 => array_merge(video('Secret Valley'), ['vod_douban_id' => 0]),
]);
check(array_column($candidateResult['candidates'], 'vod_id') === [102, 103], 'Incoming English name matches both the stored English field and primary title');
$candidateResult = candidateLookup(array_merge(video('Secret Valley'), ['vod_douban_id' => 0]), [
    104 => array_merge(video('本地中文片名'), ['vod_douban_id' => 0, 'vod_en' => 'Secret Valley']),
]);
check(array_column($candidateResult['candidates'], 'vod_id') === [104], 'An incoming primary English title matches the stored English field');

$candidateResult = candidateLookup(array_merge(video('原始片名'), ['vod_douban_id' => 0, 'vod_sub' => '第一译名|第二译名/第三译名;第四译名']), [
    105 => array_merge(video('第二译名'), ['vod_douban_id' => 0]),
    106 => array_merge(video('第三译名'), ['vod_douban_id' => 0]),
    107 => array_merge(video('第四译名'), ['vod_douban_id' => 0]),
]);
check(array_column($candidateResult['candidates'], 'vod_id') === [105, 106, 107], 'Each incoming alias is searched independently');

$candidateResult = candidateLookup(array_merge(video('星河 第二季'), ['vod_douban_id' => 0]), [
    108 => array_merge(video('星河第2季'), ['vod_douban_id' => 0]),
]);
check(array_column($candidateResult['candidates'], 'vod_id') === [108], 'A season-stripped stem recalls a different season-label format');
$candidateVideos = [];
foreach (range(1, 12) as $i) {
    $candidateVideos[$i] = array_merge(video('星河 外传' . $i), ['vod_douban_id' => 0]);
}
$candidateVideos[90001] = array_merge(video('星河 第二季'), ['vod_douban_id' => 0]);
$candidateResult = candidateLookup(array_merge(video('星河 第二季'), ['vod_douban_id' => 0]), $candidateVideos);
check($candidateResult['candidates'][0]['vod_id'] === 90001 && $candidateResult['truncated'], 'A complete title precedes lower-ID matches from the season stem');

$candidateVideos = [];
foreach (range(1, 12) as $i) {
    $candidateVideos[$i] = array_merge(video('同名作品'), ['vod_douban_id' => 0, 'vod_year' => (string) (2000 + $i)]);
}
$candidateVideos[90002] = array_merge(video('同名作品'), ['vod_douban_id' => 0, 'vod_year' => '2026']);
$candidateResult = candidateLookup(array_merge(video('同名作品'), ['vod_douban_id' => 0, 'vod_year' => '2026']), $candidateVideos);
check($candidateResult['candidates'][0]['vod_id'] === 90002, 'Matching release year ranks first among otherwise identical titles');

$candidateResult = candidateLookup(array_merge(video('100%_!作品'), ['vod_douban_id' => 0]), [
    109 => array_merge(video('100任意X!作品'), ['vod_douban_id' => 0]),
]);
check($candidateResult['candidates'] === [], 'Literal percent, underscore, and escape characters cannot widen LIKE queries');

$candidateResult = candidateLookup(array_merge(video('上'), ['vod_douban_id' => 0]), [
    1 => array_merge(video('上海'), ['vod_douban_id' => 0]),
    2 => array_merge(video('其他作品'), ['vod_douban_id' => 0, 'vod_sub' => '上/别名']),
    200 => array_merge(video('上'), ['vod_douban_id' => 0]),
]);
check(array_column($candidateResult['candidates'], 'vod_id') === [200], 'Single-character titles use exact lookup without prefix or alias-substring expansion');

$saturatedAliases = array_merge(video('山海· 第二季'), ['vod_douban_id' => 0, 'vod_en' => 'Star Voyage Season 2',
    'vod_sub' => implode('/', array_map(static function ($n) { return '别名' . $n . ' 第二季'; }, range(1, 20)))]);
$candidateResult = candidateLookup($saturatedAliases, [
    201 => array_merge(video('中文正式片名'), ['vod_douban_id' => 0, 'vod_en' => 'Star Voyage Season 2']),
    202 => array_merge(video('山海第2季'), ['vod_douban_id' => 0]),
]);
check(array_column($candidateResult['candidates'], 'vod_id') === [201, 202], 'English title and punctuated primary season stem both survive many aliases');

$largeVideo = array_merge(video('投影测试', '正片$https://stream.example/movie?token=' . str_repeat('x', 100000)), ['vod_douban_id' => 0]);
$candidateResult = candidateLookup($largeVideo, [203 => $largeVideo]);
$projected = $candidateResult['candidates'][0];
check(!isset($projected['vod_play_url']) && !isset($projected['vod_play_from']) && !isset($projected['vod_pwd_play']) && !isset($projected['vod_hits']), 'Actual candidate rows exclude large playback fields and unrelated private state');
check($projected['vod_id'] === 203 && $projected['vod_name'] === '投影测试' && array_diff(array_keys(\addons\vodmerge\service\Payload::metadata([])), array_keys($projected)) === [], 'Projection preserves every field needed for model metadata and candidate identity');
check(strlen(json_encode($projected)) < 2000, 'Candidate transfer size stays small despite a 100 KB signed playback URL');
