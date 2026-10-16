<?php

// Included by vodmerge.test.php; each case gets its own database and judge calls.
use addons\vodmerge\service\Payload;

$reviewVideo = array_merge(video('山海航线 第一季'), ['vod_year' => '2026', 'vod_douban_id' => 90001,
    'vod_actor' => '林山,江海', 'vod_director' => '陈川']);
$reviewCalls = 0;
$reviewJudge = static function ($incoming, $candidates) use (&$reviewCalls) {
    $reviewCalls++;
    $answers = [];
    foreach ($candidates as $candidate) {
        $choice = (int) $candidate['vod_douban_id'] === 90001 ? 'same' : 'different';
        $answers[(int) $candidate['vod_id']] = ['choice' => $choice, 'confidence' => 1,
            'probabilities' => ['same' => $choice === 'same' ? 1 : 0, 'different' => $choice === 'different' ? 1 : 0, 'uncertain' => 0]];
    }
    return ['status' => 'ok', 'answers' => $answers, 'model' => 'fixture'];
};
$reviewFixture = static function (?callable $judge = null) use ($autoFixture, $reviewVideo, $reviewJudge, &$reviewCalls): array {
    $reviewCalls = 0;
    [$db, $service] = $autoFixture([100 => $reviewVideo], $judge ?? $reviewJudge);
    $id = (int) $service->submit(envelope($reviewVideo, 'review-cache'))['job_id'];
    return [$db, $service, $id];
};

[$reviewDb, $reviewService, $reviewId] = $reviewFixture();
$freshReview = $reviewService->review($reviewId)['review'];
check($reviewCalls === 1 && empty($freshReview['cached']), 'The first review performs one real judge call');
$cachedReview = $reviewService->review($reviewId)['review'];
check($reviewCalls === 1 && $cachedReview['cached'], 'An unchanged second review reuses the successful judgment');
check(isset($freshReview['request_hash']) && strlen($freshReview['request_hash']) === 64 && ctype_xdigit($freshReview['request_hash'])
    && is_int($freshReview['checked_at'] ?? null), 'A successful review records the request fingerprint and actual judgment time');
check($cachedReview['checked_at'] === $freshReview['checked_at'] && $cachedReview['request_hash'] === $freshReview['request_hash'], 'Cache reuse preserves the original judgment time and fingerprint');
$reviewService->review($reviewId, true);
check($reviewCalls === 2 && !$reviewService->detail($reviewId)['review']['cached'], 'Force refresh bypasses a valid successful cache');

foreach (['metadata', 'candidate-id'] as $change) {
    [$reviewDb, $reviewService, $reviewId] = $reviewFixture();
    $reviewService->review($reviewId);
    if ($change === 'metadata') {
        $reviewDb->exec("UPDATE mac_vod SET vod_actor='林山,江海,新增演员' WHERE vod_id=100");
    } else {
        $reviewDb->exec('DELETE FROM mac_vod WHERE vod_id=100');
        seed($reviewDb, 200, $reviewVideo);
    }
    $changedReview = $reviewService->review($reviewId)['review'];
    check($reviewCalls === 2 && !$changedReview['cached'], 'Changed model metadata or candidate identity requires a new judgment: ' . $change);
    check($changedReview['candidates'][0]['vod_id'] === ($change === 'metadata' ? 100 : 200), 'Review rows are rebuilt from current candidates after cache invalidation');
}

foreach (['expired', 'future', 'fingerprint', 'answer'] as $tamper) {
    [$reviewDb, $reviewService, $reviewId] = $reviewFixture();
    $savedReview = $reviewService->review($reviewId)['review'];
    if ($tamper === 'expired' || $tamper === 'future') {
        $savedReview['checked_at'] = time() + ($tamper === 'expired' ? -601 : 60);
    } elseif ($tamper === 'fingerprint') {
        $savedReview['request_hash'] = str_repeat('0', 64);
    } else {
        $savedReview['candidates'][0]['judgment']['choice'] = 'outside-contract';
    }
    $reviewDb->prepare('UPDATE mac_vodmerge_job SET review_json=? WHERE job_id=?')->execute([Payload::json($savedReview), $reviewId]);
    $refreshedReview = $reviewService->review($reviewId)['review'];
    check($reviewCalls === 2 && !$refreshedReview['cached'], 'Expired, future-dated, mismatched or invalid cached judgments are refreshed: ' . $tamper);
    check($refreshedReview['status'] === 'ok' && $refreshedReview['candidates'][0]['judgment']['choice'] === 'same', 'An invalid cache does not poison the fresh result');
}

foreach (['failed', 'invalid', 'unavailable'] as $failure) {
    $failureJudge = static function ($incoming, $candidates) use (&$reviewCalls, $reviewJudge, $failure) {
        if ($reviewCalls === 0) {
            $reviewCalls++;
            return ['status' => $failure, 'answers' => []];
        }
        return $reviewJudge($incoming, $candidates);
    };
    [$reviewDb, $reviewService, $reviewId] = $reviewFixture($failureJudge);
    $reviewService->review($reviewId);
    check($reviewCalls === 1 && $reviewService->detail($reviewId)['review']['status'] === $failure, 'Model failures remain reviewable: ' . $failure);
    $retriedReview = $reviewService->review($reviewId)['review'];
    check($reviewCalls === 2 && !$retriedReview['cached'] && $retriedReview['status'] === 'ok', 'Failed model reviews are retried rather than cached: ' . $failure);
    $reviewService->review($reviewId);
    check($reviewCalls === 2 && $reviewService->detail($reviewId)['review']['cached'], 'A successful retry becomes reusable');
}

[$reviewDb, $reviewService, $reviewId] = $reviewFixture();
$reviewService->review($reviewId);
$reviewService->review($reviewId);
$reviewDb->exec("UPDATE mac_vod SET vod_year='2025' WHERE vod_id=100");
$conflictedReview = $reviewService->review($reviewId)['review'];
check($reviewCalls === 1 && !$conflictedReview['cached'] && $conflictedReview['status'] === 'blocked', 'Fresh hard conflicts block a previously cached match without an unnecessary API call');
safetyFailsWith(static function () use ($reviewService, $reviewId) { $reviewService->preview($reviewId, 100, false, false, true); }, '冲突', 'A cached match cannot bypass a new hard identity conflict');
check(stored($reviewDb, 100)['vod_play_url'] === $reviewVideo['vod_play_url'], 'Fresh conflict rejection leaves playback unchanged');

[$reviewDb, $reviewService, $reviewId] = $reviewFixture();
$reviewService->review($reviewId);
seed($reviewDb, 101, array_merge($reviewVideo, ['type_id' => 3]));
$duplicateReview = $reviewService->review($reviewId)['review'];
check($reviewCalls === 1 && $duplicateReview['cached'], 'An added hard-conflicting duplicate may reuse the unchanged eligible model request');
check(count($duplicateReview['candidates']) === 2 && $duplicateReview['candidates'][1]['conflicts'] !== [], 'Cached review still exposes fresh conflicting candidate rows');
check(!$duplicateReview['automatic']['eligible'], 'Fresh duplicate external IDs veto automatic matching despite model cache reuse');
safetyFailsWith(static function () use ($reviewService, $reviewId) { $reviewService->preview($reviewId, 100, false, false, true); }, '不是唯一', 'Duplicate IDs discovered during cache reuse cannot reach a write preview');
check(stored($reviewDb, 100)['vod_play_url'] === $reviewVideo['vod_play_url'], 'Duplicate rejection leaves playback unchanged');

[$reviewDb, $reviewService, $reviewId] = $reviewFixture();
$reviewService->review($reviewId);
foreach (range(101, 110) as $candidateId) {
    seed($reviewDb, $candidateId, array_merge($reviewVideo, ['type_id' => 3]));
}
$truncatedReview = $reviewService->review($reviewId)['review'];
check($reviewCalls === 1 && $truncatedReview['cached'], 'New hard-conflicting rows may reuse the original eligible model judgment');
check($truncatedReview['truncated'] && count($truncatedReview['candidates']) === 10, 'Fresh candidate overflow remains visible when the eligible request is cached');
check(!$truncatedReview['automatic']['eligible'], 'Incomplete fresh candidate coverage vetoes automatic matching despite cache reuse');
safetyFailsWith(static function () use ($reviewService, $reviewId) { $reviewService->preview($reviewId, 100, false, false, true); }, '覆盖不完整', 'A cached result cannot authorize a write when new candidates exceed the review limit');
check(stored($reviewDb, 100)['vod_play_url'] === $reviewVideo['vod_play_url'], 'Candidate overflow rejection leaves playback unchanged');

[$reviewDb, $reviewService, $reviewId] = $reviewFixture();
$reviewService->review($reviewId);
$reviewService->review($reviewId);
$cachedPreview = $reviewService->preview($reviewId, 100, false, false, true);
seed($reviewDb, 101, $reviewVideo);
safetyFailsWith(static function () use ($reviewService, $cachedPreview) { $reviewService->apply($cachedPreview['job_id'], $cachedPreview['preview_token'], 0); }, '不是唯一', 'A new duplicate after a cached preview is checked again before writing');
check($reviewCalls === 1 && stored($reviewDb, 100)['vod_play_url'] === $reviewVideo['vod_play_url'], 'Final write checks retain the cache speed benefit without changing playback');

class ReviewRacePDO extends PDO
{
    public $jobReads = 0;
    public $hook;

    #[\ReturnTypeWillChange]
    public function prepare($query, $options = [])
    {
        if (strpos($query, 'SELECT * FROM `mac_vodmerge_job` WHERE job_id=') === 0 && ++$this->jobReads === 2 && $this->hook) {
            $hook = $this->hook;
            $this->hook = null;
            $hook();
        }
        return parent::prepare($query, $options);
    }
}

$raceDb = new ReviewRacePDO('sqlite::memory:');
foreach ($autoSchema as $schema) {
    $raceDb->exec($schema);
}
$raceDb->exec('INSERT INTO mac_type VALUES (2,0,1)');
seed($raceDb, 100, $reviewVideo);
$raceCalls = 0;
$raceChoice = 'same';
$raceService = new \addons\vodmerge\service\Service($raceDb, 'mac_', ['hls' => []], static function ($incoming, $candidates) use (&$raceCalls, &$raceChoice) {
    $raceCalls++;
    return ['status' => 'ok', 'model' => 'fixture', 'answers' => [100 => [
        'choice' => $raceChoice, 'confidence' => 1,
        'probabilities' => ['same' => $raceChoice === 'same' ? 1 : 0, 'different' => 0, 'uncertain' => $raceChoice === 'uncertain' ? 1 : 0],
    ]]];
});
$raceId = (int) $raceService->submit(envelope($reviewVideo, 'cache-race'))['job_id'];
$initialRaceReview = $raceService->review($raceId)['review'];
check($raceCalls === 1 && $initialRaceReview['automatic']['eligible'], 'The race begins with a reusable successful same judgment');
$raceDb->jobReads = 0;
$forcedRaceReview = [];
$raceDb->hook = static function () use (&$raceChoice, &$forcedRaceReview, $raceService, $raceId) {
    $raceChoice = 'uncertain';
    $forcedRaceReview = $raceService->review($raceId, true)['review'];
};
safetyFailsWith(static function () use ($raceService, $raceId) { $raceService->review($raceId); }, '任务状态已变化', 'An older cached review cannot overwrite a force refresh completed before its locked write');
check($raceCalls === 2 && $raceDb->hook === null && !$forcedRaceReview['automatic']['eligible'], 'The interleaved force refresh makes one new judgment and rejects automatic matching');
$preservedRaceReview = $raceService->detail($raceId)['review'];
check($preservedRaceReview['candidates'][0]['judgment']['choice'] === 'uncertain' && !$preservedRaceReview['automatic']['eligible'] && !$preservedRaceReview['cached'], 'Rejecting the older request preserves the fresh uncertain judgment in storage');
check(stored($raceDb, 100)['vod_play_url'] === $reviewVideo['vod_play_url'], 'The concurrent review race leaves playback unchanged');
