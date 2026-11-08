<?php

// Loaded after vodmerge.test.php so the SQLite schema and shared assertions stay in one place.
$safetyDb = new PDO('sqlite::memory:');
$safetyDb->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
foreach ($db->query("SELECT sql FROM sqlite_master WHERE type='table' AND name IN ('mac_vod','mac_type','mac_vodmerge_job','mac_vodmerge_binding')")->fetchAll(PDO::FETCH_COLUMN) as $schema) {
    $safetyDb->exec($schema);
}
$safetyDb->exec('INSERT INTO mac_type VALUES (2,0,1)');
$safetyService = new \addons\vodmerge\service\Service($safetyDb, 'mac_', ['hls' => []], static function () {
    return ['status' => 'no_candidates', 'answers' => []];
});

function safetyFailsWith(callable $action, string $expected, string $message): void
{
    try {
        $action();
    } catch (Throwable $error) {
        check(strpos($error->getMessage(), $expected) !== false, $message . ': ' . $error->getMessage());
        return;
    }
    check(false, $message);
}

$safetyOriginal = video('示例剧 第一季', '第01集$https://safety-original.example/1');
$safetyUpdated = video('示例剧 第一季', '第01集$https://b.example/1.m3u8#第02集$https://b.example/2.m3u8#第03集$https://b.example/3.m3u8');
seed($safetyDb, 10000, $safetyOriginal);
$safetyA = ready($safetyService, envelope(video(), 'safety-a'), 10000);
$safetyService->apply($safetyA['job_id'], $safetyA['preview_token'], 1);
$safetyB = ready($safetyService, envelope(video(), 'safety-b'), 10000);
check($safetyB['plan']['added_groups'] === 1, 'A second provider cannot take ownership of an already bound identical group');
$safetyService->apply($safetyB['job_id'], $safetyB['preview_token'], 1);
$safetyA2 = (int) $safetyService->submit(envelope($safetyUpdated, 'safety-a'))['job_id'];
$safetyB2 = (int) $safetyService->submit(envelope($safetyUpdated, 'safety-b'))['job_id'];
$safetyService->run(2, true);
check($safetyService->detail($safetyA2)['status'] === 'applied' && $safetyService->detail($safetyB2)['status'] === 'applied', 'Identical starting groups from separate providers can both update automatically');
$safetyGroups = \addons\vodmerge\service\Playlist::groups(stored($safetyDb, 10000));
check(count($safetyGroups) === 3 && strpos($safetyGroups[1]['vod_play_url'], '/3.m3u8') !== false && strpos($safetyGroups[2]['vod_play_url'], '/3.m3u8') !== false, 'Each source appends to its own route without changing the original route');

seed($safetyDb, 10001, $safetyOriginal);
$safetyLegacy = ready($safetyService, envelope(video(), 'safety-legacy-a'), 10001);
$safetyService->apply($safetyLegacy['job_id'], $safetyLegacy['preview_token'], 1);
// Represent the shared ownership permitted by the previous plugin version.
$safetyDb->exec("INSERT INTO mac_vodmerge_binding SELECT 'safety-legacy-b',source_id,vod_id,routes_json,identity_json,last_job_id FROM mac_vodmerge_binding WHERE source_key='safety-legacy-a'");
$safetyLegacyPlayback = stored($safetyDb, 10001)['vod_play_url'];
safetyFailsWith(static function () use ($safetyService, $safetyLegacy) {
    $safetyService->rollback($safetyLegacy['job_id'], 1);
}, '其他来源仍依赖', 'Legacy shared ownership prevents destructive rollback');
check($safetyService->detail($safetyLegacy['job_id'])['status'] === 'applied' && stored($safetyDb, 10001)['vod_play_url'] === $safetyLegacyPlayback, 'Rejected dependent rollback keeps the video and job state intact');
$safetyDb->exec("DELETE FROM mac_vodmerge_binding WHERE source_key='safety-legacy-b'");
$safetyUnchanged = ready($safetyService, envelope($safetyOriginal, 'safety-original'), 10001);
check($safetyUnchanged['plan']['added_groups'] === 0, 'An identical group with no other owner may still be reused');
$safetyService->apply($safetyUnchanged['job_id'], $safetyUnchanged['preview_token'], 1);
$safetyService->rollback($safetyLegacy['job_id'], 1);
check(stored($safetyDb, 10001)['vod_play_url'] === $safetyOriginal['vod_play_url'], 'An unrelated binding to an unchanged route does not prevent rollback');

seed($safetyDb, 10002, $safetyOriginal);
seed($safetyDb, 10003, $safetyOriginal);
$safetyPrior = ready($safetyService, envelope(video(), 'safety-prior'), 10002);
$safetyService->apply($safetyPrior['job_id'], $safetyPrior['preview_token'], 1);
$safetyWaiting = ready($safetyService, envelope(video('示例剧 第一季', '第01集$https://waiting.example/1'), 'safety-waiting'), 10002);
$safetyCrash = ready($safetyService, envelope(video('示例剧 第一季', '第01集$https://crash.example/1'), 'safety-crash'), 10002);
$safetyCrashId = $safetyCrash['job_id'];
$safetyDb->exec("CREATE TRIGGER safety_fail_finish BEFORE UPDATE ON mac_vodmerge_job WHEN NEW.status='applied' AND NEW.job_id=$safetyCrashId BEGIN SELECT RAISE(ABORT,'simulated audit failure'); END");
fails(static function () use ($safetyService, $safetyCrash) {
    $safetyService->apply($safetyCrash['job_id'], $safetyCrash['preview_token'], 1);
}, 'Simulate an interrupted write on a video shared by multiple providers');
$safetyDb->exec('DROP TRIGGER safety_fail_finish');
check($safetyService->detail($safetyCrashId)['status'] === 'applying', 'The interrupted target has a durable unfinished job');
$safetyCrashPlayback = stored($safetyDb, 10002)['vod_play_url'];
safetyFailsWith(static function () use ($safetyService, $safetyWaiting) {
    $safetyService->preview($safetyWaiting['job_id'], 10002);
}, '目标视频须先恢复任务', 'Another source cannot preview a mutation of an unfinished target');
safetyFailsWith(static function () use ($safetyService, $safetyWaiting) {
    $safetyService->apply($safetyWaiting['job_id'], $safetyWaiting['preview_token'], 1);
}, '目标视频须先恢复任务', 'A previously generated preview cannot bypass the target recovery barrier');
safetyFailsWith(static function () use ($safetyService, $safetyPrior) {
    $safetyService->rollback($safetyPrior['job_id'], 1);
}, '目标视频须先恢复任务', 'Rollback from a different source cannot mutate an unfinished target');
$safetyDb->exec("UPDATE mac_vodmerge_job SET status='applying' WHERE job_id=" . $safetyWaiting['job_id']);
safetyFailsWith(static function () use ($safetyService, $safetyWaiting) {
    $safetyService->recover($safetyWaiting['job_id']);
}, '目标视频须先恢复任务', 'A second unfinished job cannot recover over a different unfinished write');
$safetyDb->exec("UPDATE mac_vodmerge_job SET status='ready' WHERE job_id=" . $safetyWaiting['job_id']);
$safetyOtherTarget = ready($safetyService, envelope(video(), 'safety-other-target'), 10003);
$safetyService->apply($safetyOtherTarget['job_id'], $safetyOtherTarget['preview_token'], 1);
check($safetyService->detail($safetyOtherTarget['job_id'])['status'] === 'applied', 'An unfinished video does not block unrelated targets');
$safetyService->recover($safetyCrashId);
check($safetyService->detail($safetyCrashId)['status'] === 'applied' && stored($safetyDb, 10002)['vod_play_url'] === $safetyCrashPlayback, 'Recovery remains possible without duplicate append after competing operations were blocked');
$safetyWaiting = $safetyService->preview($safetyWaiting['job_id'], 10002);
$safetyService->apply($safetyWaiting['job_id'], $safetyWaiting['preview_token'], 1);
check($safetyService->detail($safetyWaiting['job_id'])['status'] === 'applied', 'The other provider can resume after target recovery');
