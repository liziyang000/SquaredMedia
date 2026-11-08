<?php

// Included by vodmerge.test.php; reuse its schema without sharing test records.
use addons\vodmerge\service\Payload;
use addons\vodmerge\service\Service;

$autoSchema = $db->query("SELECT sql FROM sqlite_master WHERE type='table' AND name IN ('mac_vod','mac_type','mac_vodmerge_job','mac_vodmerge_binding')")->fetchAll(PDO::FETCH_COLUMN);
$autoFixture = static function (array $videos, ?callable $judge = null) use ($autoSchema): array {
    $db = new PDO('sqlite::memory:');
    $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    foreach ($autoSchema as $sql) {
        $db->exec($sql);
    }
    $db->exec('INSERT INTO mac_type VALUES (2,0,1)');
    foreach ($videos as $id => $video) {
        seed($db, $id, $video);
    }
    return [$db, new Service($db, 'mac_', ['hls' => []], $judge ?? static function ($incoming, $candidates) {
        $answers = [];
        foreach ($candidates as $candidate) {
            $choice = (int) $candidate['vod_id'] === 100 ? 'same' : 'different';
            $answers[(int) $candidate['vod_id']] = ['choice' => $choice, 'confidence' => 1,
                'probabilities' => ['same' => $choice === 'same' ? 1 : 0, 'different' => $choice === 'different' ? 1 : 0, 'uncertain' => 0]];
        }
        return ['status' => 'ok', 'answers' => $answers, 'model' => 'fixture'];
    })];
};
$autoIncoming = array_merge(video('山海航线 第一季'), ['vod_douban_id' => 90001, 'vod_actor' => '林山,江海', 'vod_director' => '陈川']);
$autoExisting = array_merge($autoIncoming, ['vod_play_url' => '第1集$https://existing.example/1']);
[$autoDb, $autoService] = $autoFixture([100 => $autoExisting]);
$autoId = (int) $autoService->submit(envelope($autoIncoming, 'strict-first'))['job_id'];
$autoService->run(1, false);
check($autoService->detail($autoId)['status'] === 'review' && $autoService->detail($autoId)['review']['automatic']['eligible'], 'Default-off policy does not write even when all matching evidence passes');
check(stored($autoDb, 100)['vod_play_url'] === $autoExisting['vod_play_url'], 'Default-off first match leaves playback intact');
$autoService->requeue($autoId);
$autoService->run(1, false, true);
check($autoService->detail($autoId)['status'] === 'applied' && $autoService->detail($autoId)['vod_id'] === 100, 'Explicit automatic-first mode binds a unique fully supported existing video');
check(strpos($autoService->detail($autoId)['message'], '严格自动首绑') !== false, 'Automatic first binding records how it was applied');
check((int) stored($autoDb, 100)['vod_hits'] === 999 && stored($autoDb, 100)['vod_pwd_play'] === 'protected', 'Automatic matching preserves existing membership controls and counters');
check($autoService->submit(envelope($autoIncoming, 'strict-first'))['status'] === 'applied', 'Automatic first-binding retries reuse the applied job');
fails(static function () use ($autoService, $autoId) { $autoService->requeue($autoId); }, 'Applied first binding cannot be requeued');
$autoNext = array_merge($autoIncoming, ['vod_play_url' => $autoIncoming['vod_play_url'] . '#第3集$https://b.example/3.m3u8']);
$autoNextId = (int) $autoService->submit(envelope($autoNext, 'strict-first'))['job_id'];
$autoService->run(1, true, true);
check($autoService->detail($autoNextId)['status'] === 'applied', 'An automatically established source binding supports subsequent deterministic updates');
$autoService->rollback($autoNextId, 1);
check(substr_count(stored($autoDb, 100)['vod_play_url'], '/3.m3u8') === 0, 'Automatic updates still support conditional rollback');

foreach (['low-confidence', 'uncertain', 'different', 'failed'] as $mode) {
    $judge = static function () use ($mode) {
        if ($mode === 'failed') return ['status' => 'failed', 'answers' => []];
        $choice = $mode === 'low-confidence' ? 'same' : $mode;
        return ['status' => 'ok', 'answers' => [100 => ['choice' => $choice, 'confidence' => $mode === 'low-confidence' ? .90 : 1,
            'probabilities' => ['same' => $choice === 'same' ? .95 : 0, 'different' => $choice === 'different' ? 1 : 0, 'uncertain' => $choice === 'uncertain' ? 1 : ($choice === 'same' ? .05 : 0)]]]];
    };
    [$caseDb, $caseService] = $autoFixture([100 => $autoExisting], $judge);
    $caseId = (int) $caseService->submit(envelope($autoIncoming, $mode))['job_id'];
    $caseService->run(1, false, true);
    check($caseService->detail($caseId)['status'] === 'review' && stored($caseDb, 100)['vod_play_url'] === $autoExisting['vod_play_url'], 'Jev ' . $mode . ' cannot cause an automatic write');
}

foreach (['vod_year' => '', 'vod_actor' => '未知', 'vod_name' => '山海航线', 'vod_douban_id' => 0] as $field => $value) {
    $incomplete = array_merge($autoIncoming, [$field => $value]);
    if ($field === 'vod_actor') $incomplete['vod_director'] = '不详';
    [$caseDb, $caseService] = $autoFixture([100 => $autoExisting]);
    $caseId = (int) $caseService->submit(envelope($incomplete, 'incomplete-' . $field))['job_id'];
    $caseService->run(1, false, true);
    check($caseService->detail($caseId)['status'] === 'review', 'Jev agreement cannot bypass missing required evidence: ' . $field);
}

[$duplicateDb, $duplicateService] = $autoFixture([100 => $autoExisting, 101 => array_merge($autoExisting, ['vod_name' => '另一译名'])]);
$duplicateId = (int) $duplicateService->submit(envelope($autoIncoming, 'duplicate-id'))['job_id'];
$duplicateService->run(1, false, true);
check($duplicateService->detail($duplicateId)['status'] === 'review' && strpos($duplicateService->detail($duplicateId)['message'], '不是唯一') !== false, 'Duplicate external IDs block automatic first binding even if Jev selects only one');

foreach (['same', 'uncertain', 'weak-different'] as $otherChoice) {
    $judge = static function () use ($otherChoice) {
        $choice = $otherChoice === 'weak-different' ? 'different' : $otherChoice;
        return ['status' => 'ok', 'answers' => [
            100 => ['choice' => 'same', 'confidence' => 1, 'probabilities' => ['same' => 1, 'different' => 0, 'uncertain' => 0]],
            101 => ['choice' => $choice, 'confidence' => 1, 'probabilities' => ['same' => $choice === 'same' ? 1 : 0,
                'different' => $choice === 'different' ? .90 : 0, 'uncertain' => $choice === 'uncertain' ? 1 : ($choice === 'different' ? .10 : 0)]],
        ]];
    };
    [$caseDb, $caseService] = $autoFixture([100 => $autoExisting, 101 => array_merge($autoExisting, ['vod_douban_id' => 0])], $judge);
    $caseId = (int) $caseService->submit(envelope($autoIncoming, 'ambiguous-' . $otherChoice))['job_id'];
    $caseService->run(1, false, true);
    check($caseService->detail($caseId)['status'] === 'review', 'Another ' . $otherChoice . ' candidate prevents automatic selection');
}

$crowded = [100 => $autoExisting];
foreach (range(1, 11) as $id) $crowded[$id] = array_merge($autoExisting, ['vod_douban_id' => 91000 + $id]);
[$crowdDb, $crowdService] = $autoFixture($crowded);
$crowdId = (int) $crowdService->submit(envelope($autoIncoming, 'truncated'))['job_id'];
$crowdService->run(1, false, true);
check($crowdService->detail($crowdId)['review']['truncated'] && $crowdService->detail($crowdId)['status'] === 'review', 'Incomplete candidate coverage blocks automatic matching');
check($crowdService->detail($crowdId)['review']['candidates'][0]['vod_id'] === 100, 'Exact ID and strong matching evidence remains first in the review list');

$blockedCalls = 0;
[$blockedDb, $blockedService] = $autoFixture([100 => array_merge($autoExisting, ['vod_sub' => '第二季'])], static function () use (&$blockedCalls) {
    $blockedCalls++;
    return ['status' => 'ok', 'answers' => []];
});
$blockedId = (int) $blockedService->submit(envelope($autoIncoming, 'hard-conflict'))['job_id'];
$blockedService->run(1, false, true);
check($blockedCalls === 0 && $blockedService->detail($blockedId)['review']['status'] === 'blocked', 'Known identity conflicts bypass unnecessary Jev calls and stay blocked');

[$raceDb, $raceService] = $autoFixture([100 => $autoExisting]);
$raceId = (int) $raceService->submit(envelope($autoIncoming, 'race'))['job_id'];
$raceService->review($raceId);
$raceDb->exec("UPDATE mac_vod SET vod_actor='不同演员' WHERE vod_id=100");
safetyFailsWith(static function () use ($raceService, $raceId) { $raceService->preview($raceId, 100, false, false, true); }, '身份资料', 'Changed candidate metadata invalidates the model decision before preview');
$raceDb->exec("UPDATE mac_vod SET vod_actor='林山,江海' WHERE vod_id=100");
$raceService->review($raceId);
$racePreview = $raceService->preview($raceId, 100, false, false, true);
seed($raceDb, 101, $autoExisting);
safetyFailsWith(static function () use ($raceService, $racePreview) { $raceService->apply($racePreview['job_id'], $racePreview['preview_token'], 0); }, '不是唯一', 'A new duplicate ID after preview vetoes the actual automatic write');
check(stored($raceDb, 100)['vod_play_url'] === $autoExisting['vod_play_url'], 'Stale automatic preview cannot change playback');
$raceDb->exec('DELETE FROM mac_vod WHERE vod_id=101');
$raceService->review($raceId);
$racePreview = $raceService->preview($raceId, 100, false, false, true);
$raceDb->exec("UPDATE mac_vod SET vod_sub='第二季' WHERE vod_id=100");
fails(static function () use ($raceService, $racePreview) { $raceService->apply($racePreview['job_id'], $racePreview['preview_token'], 0); }, 'Alias season edits after preview block the write');

[$crashDb, $crashService] = $autoFixture([100 => $autoExisting]);
$crashId = (int) $crashService->submit(envelope($autoIncoming, 'automatic-crash'))['job_id'];
$crashService->review($crashId);
$crashPreview = $crashService->preview($crashId, 100, false, false, true);
$crashDb->exec("CREATE TRIGGER auto_fail_finish BEFORE UPDATE ON mac_vodmerge_job WHEN NEW.status='applied' BEGIN SELECT RAISE(ABORT,'simulated crash'); END");
fails(static function () use ($crashService, $crashPreview) { $crashService->apply($crashPreview['job_id'], $crashPreview['preview_token'], 0); }, 'Automatic first binding retains write-ahead state after an audit failure');
$crashPlayback = stored($crashDb, 100)['vod_play_url'];
$crashDb->exec('DROP TRIGGER auto_fail_finish');
$crashService->recover($crashId);
check($crashService->detail($crashId)['status'] === 'applied' && stored($crashDb, 100)['vod_play_url'] === $crashPlayback, 'Recovery completes an interrupted automatic binding without a second append');

[$legacyDb, $legacyService] = $autoFixture([100 => $autoExisting]);
$legacyFirst = ready($legacyService, envelope($autoIncoming, 'legacy-evidence'), 100);
$legacyService->apply($legacyFirst['job_id'], $legacyFirst['preview_token'], 1);
$legacyBinding = json_decode($legacyDb->query('SELECT identity_json FROM mac_vodmerge_binding')->fetchColumn(), true);
unset($legacyBinding['incoming']['seasons'], $legacyBinding['target']['seasons']);
$legacyDb->prepare('UPDATE mac_vodmerge_binding SET identity_json=?')->execute([Payload::json($legacyBinding)]);
$legacyNext = (int) $legacyService->submit(envelope($autoNext, 'legacy-evidence'))['job_id'];
$legacyService->run(1, true, true);
check($legacyService->detail($legacyNext)['status'] === 'review', 'Old bindings without season evidence require manual reconfirmation');
$legacyPreview = $legacyService->preview($legacyNext, 100);
$legacyService->apply($legacyNext, $legacyPreview['preview_token'], 1);
$legacyBinding = json_decode($legacyDb->query('SELECT identity_json FROM mac_vodmerge_binding')->fetchColumn(), true);
check($legacyBinding['incoming']['seasons'] === ['1'] && $legacyBinding['target']['seasons'] === ['1'], 'Manual reconfirmation refreshes legacy season evidence');
$legacyAliasChange = (int) $legacyService->submit(envelope(array_merge($autoNext, ['vod_sub' => '第二季']), 'legacy-evidence'))['job_id'];
$legacyService->run(1, true, true);
check($legacyService->detail($legacyAliasChange)['status'] === 'review', 'A changed alias season cannot bypass a confirmed source mapping');

[$emptyDb, $emptyService] = $autoFixture([]);
$emptyId = (int) $emptyService->submit(envelope($autoIncoming, 'empty-library'))['job_id'];
$emptyService->run(1, true, true);
check($emptyService->detail($emptyId)['status'] === 'review' && (int) $emptyDb->query('SELECT COUNT(*) FROM mac_vod')->fetchColumn() === 0, 'Automatic matching never creates a new video when no target exists');

$seasonOnlyIncoming = array_merge($autoIncoming, ['vod_sub' => '第一季/Season 1/S01']);
$seasonOnlyTarget = array_merge($seasonOnlyIncoming, ['vod_name' => '完全不同作品 第一季']);
[$seasonOnlyDb, $seasonOnlyService] = $autoFixture([100 => $seasonOnlyTarget]);
$seasonOnlyId = (int) $seasonOnlyService->submit(envelope($seasonOnlyIncoming, 'season-only-alias'))['job_id'];
$seasonOnlyService->run(1, false, true);
check($seasonOnlyService->detail($seasonOnlyId)['status'] === 'review', 'Even a confident same answer cannot authorize unrelated titles sharing only season aliases');
check(stored($seasonOnlyDb, 100)['vod_play_url'] === $seasonOnlyTarget['vod_play_url'], 'Rejecting season-only title evidence leaves playback unchanged');
