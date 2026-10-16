<?php

namespace addons\vodmerge\service {
    function disk_free_space($path)
    {
        return array_key_exists('audit_disk_free', $GLOBALS) ? $GLOBALS['audit_disk_free'] : 2147483648;
    }
}

namespace {
require dirname(__DIR__) . '/addons/vodmerge/bootstrap.php';

use addons\vodmerge\service\AuditMatch;
use addons\vodmerge\service\LibraryAudit;
use addons\vodmerge\service\Payload;

$auditChecks = 0;
function auditCheck($condition, string $message): void
{
    global $auditChecks;
    $auditChecks++;
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

class AuditConcurrentStatement extends PDOStatement
{
    protected function __construct() {}

    public function execute(?array $params = null): bool
    {
        if (isset($GLOBALS['audit_assessment_before_update']) && strpos($this->queryString, ' SET assessment=') !== false) {
            $beforeUpdate = $GLOBALS['audit_assessment_before_update'];
            unset($GLOBALS['audit_assessment_before_update']);
            $beforeUpdate();
        }
        return parent::execute($params);
    }
}

function auditFixture(array $videos = [], ?callable $reviewer = null): array
{
    $db = new PDO('sqlite::memory:');
    $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $db->exec('CREATE TABLE mac_vodmerge_audit_state (state_id INTEGER PRIMARY KEY, weekly_enabled INTEGER NOT NULL DEFAULT 0, watermark INTEGER NOT NULL DEFAULT 0, last_completed_at INTEGER NOT NULL DEFAULT 0, next_run_at INTEGER NOT NULL DEFAULT 0, active_run_id INTEGER NOT NULL DEFAULT 0)');
    $db->exec('INSERT INTO mac_vodmerge_audit_state (state_id) VALUES (1)');
    $db->exec("CREATE TABLE mac_vodmerge_audit_run (run_id INTEGER PRIMARY KEY AUTOINCREMENT, status TEXT NOT NULL, mode TEXT NOT NULL, lower_id INTEGER NOT NULL, upper_id INTEGER NOT NULL, cursor_id INTEGER NOT NULL DEFAULT 0, total_count INTEGER NOT NULL DEFAULT 0, processed_count INTEGER NOT NULL DEFAULT 0, issue_count INTEGER NOT NULL DEFAULT 0, truncated_count INTEGER NOT NULL DEFAULT 0, started_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, finished_at INTEGER NOT NULL DEFAULT 0, error_message TEXT NOT NULL DEFAULT '')");
    $db->exec('CREATE TABLE mac_vodmerge_audit_key (key_hash TEXT NOT NULL, vod_id INTEGER NOT NULL, PRIMARY KEY (key_hash, vod_id))');
    $db->exec("CREATE TABLE mac_vodmerge_audit_issue (issue_id INTEGER PRIMARY KEY AUTOINCREMENT, run_id INTEGER NOT NULL, left_id INTEGER NOT NULL, right_id INTEGER NOT NULL, kind TEXT NOT NULL, detail_json TEXT NOT NULL, created_at INTEGER NOT NULL, assessment TEXT NOT NULL DEFAULT 'unrated', priority INTEGER NOT NULL DEFAULT 0, assessment_version INTEGER NOT NULL DEFAULT 0, UNIQUE(run_id,left_id,right_id))");
    $columns = ['vod_id INTEGER PRIMARY KEY'];
    foreach (array_keys(Payload::metadata([])) as $field) {
        $columns[] = $field . " TEXT NOT NULL DEFAULT ''";
    }
    $columns[] = "vod_play_url TEXT NOT NULL DEFAULT ''";
    $columns[] = "vod_pwd_play TEXT NOT NULL DEFAULT ''";
    $db->exec('CREATE TABLE mac_vod (' . implode(',', $columns) . ')');
    foreach ($videos as $id => $video) {
        auditSeed($db, $id, $video);
    }
    return [$db, new LibraryAudit($db, 'mac_', $reviewer)];
}

function auditVideo(string $name, array $fields = []): array
{
    return array_merge(Payload::metadata([]), ['vod_name' => $name, 'vod_year' => '2026', 'type_id' => 2,
        'vod_actor' => '演员甲', 'vod_director' => '导演乙', 'vod_douban_id' => 0], $fields);
}

function auditSeed(PDO $db, int $id, array $video): void
{
    $row = array_merge($video, ['vod_id' => $id, 'vod_play_url' => '正片$https://never-display.example/' . $id . '?token=private', 'vod_pwd_play' => 'private-play-password']);
    $fields = array_keys($row);
    $db->prepare('INSERT INTO mac_vod (' . implode(',', $fields) . ') VALUES (' . implode(',', array_fill(0, count($fields), '?')) . ')')->execute(array_values($row));
}

function auditFinish(LibraryAudit $audit, int $batch = 2): array
{
    for ($ticks = 0; $ticks < 200; $ticks++) {
        $summary = $audit->tick($batch);
        if (!$summary['active_run_id']) {
            return $summary;
        }
        auditCheck($summary['run']['status'] !== 'error', 'The fixture must finish without an unexpected batch error');
    }
    throw new RuntimeException('The scan did not finish in its bounded fixture tick budget');
}

function auditAllIssues(LibraryAudit $audit, int $runId, string $kind = ''): array
{
    $items = [];
    $before = 0;
    do {
        $page = $audit->issues($runId, $before, $kind);
        $items = array_merge($items, $page['items']);
        $before = $page['next_before'];
    } while ($page['has_more']);
    return $items;
}

function auditPair(array $items, int $a, int $b): ?array
{
    foreach ($items as $item) {
        if ([(int) $item['left_id'], (int) $item['right_id']] === [min($a, $b), max($a, $b)]) {
            return $item;
        }
    }
    return null;
}

function auditDue(PDO $db): void
{
    $db->exec('UPDATE mac_vodmerge_audit_state SET next_run_at=' . (time() - 1));
}

function auditReviewResult(int $candidateId, string $choice = 'same'): array
{
    $probabilities = ['same' => 0.05, 'different' => 0.05, 'uncertain' => 0.05];
    $probabilities[$choice] = 0.9;
    return ['status' => 'ok', 'model' => 'jev-fixture', 'answers' => [$candidateId => [
        'choice' => $choice, 'confidence' => 0.83, 'probabilities' => $probabilities,
    ]]];
}

function auditReviewReject(callable $action, string $message): void
{
    try {
        $action();
    } catch (RuntimeException $error) {
        auditCheck($error->getMessage() !== '', $message);
        return;
    }
    throw new RuntimeException($message);
}

function auditScanSnapshot(PDO $db): array
{
    return [
        $db->query('SELECT * FROM mac_vod ORDER BY vod_id')->fetchAll(PDO::FETCH_ASSOC),
        $db->query('SELECT * FROM mac_vodmerge_audit_state')->fetchAll(PDO::FETCH_ASSOC),
        $db->query('SELECT * FROM mac_vodmerge_audit_run ORDER BY run_id')->fetchAll(PDO::FETCH_ASSOC),
        $db->query('SELECT * FROM mac_vodmerge_audit_key ORDER BY key_hash,vod_id')->fetchAll(PDO::FETCH_ASSOC),
    ];
}

$reliable = auditVideo('山海之间', ['vod_year' => '2024', 'vod_version' => '正片', 'vod_douban_id' => 12345,
    'vod_director' => '陈可辛', 'vod_actor' => '周迅,胡歌']);
$high = AuditMatch::assess($reliable, $reliable);
auditCheck($high['level'] === 'high' && $high['priority'] === 4 && $high['conflicts'] === [], 'Matching positive Douban, full title, valid year, category, symmetric season data, explicit version and real people form high-quality evidence');
auditCheck($high['label'] !== '' && is_array($high['evidence']) && $high['evidence'] !== [] && is_array($high['missing']) && is_array($high['risks']), 'A rule assessment explains its evidence, missing data and risks rather than presenting a made-up probability');
auditCheck(!isset($high['probability'], $high['confidence'], $high['score']), 'Rule priority is not exposed as a model probability or confidence score');
$missingVersion = array_merge($reliable, ['vod_version' => '']);
auditCheck(AuditMatch::assess($missingVersion, $missingVersion)['level'] === 'probable', 'Unspecified versions keep otherwise strong duplicate evidence below the high-quality group');
foreach (['未知', '0000', '2024年', 'N/A'] as $placeholderYear) {
    $invalidYear = array_merge($reliable, ['vod_year' => $placeholderYear]);
    $assessment = AuditMatch::assess($invalidYear, $reliable);
    auditCheck($assessment['level'] === 'insufficient' && $assessment['missing'] !== [] && $assessment['conflicts'] === [], 'An invalid or placeholder year is missing evidence, not a verified disagreement with a real year: ' . $placeholderYear);
}
foreach (['未知', '暂无', '0', 'N/A'] as $placeholderVersion) {
    $invalidVersion = array_merge($reliable, ['vod_version' => $placeholderVersion]);
    $assessment = AuditMatch::assess($invalidVersion, $invalidVersion);
    auditCheck($assessment['level'] === 'probable' && $assessment['missing'] !== [], 'Matching placeholder version strings cannot certify a real edition for high-quality evidence: ' . $placeholderVersion);
}
$probableLeft = array_merge($reliable, ['vod_douban_id' => 0]);
$probableRight = array_merge($probableLeft, ['vod_name' => '别名译作', 'vod_sub' => '山海之间']);
auditCheck(AuditMatch::assess($probableLeft, $probableRight)['level'] === 'probable', 'A complete exact alias, valid year/category and shared real director can support probable evidence without a Douban ID');
$actorLeft = array_merge($probableLeft, ['vod_director' => '', 'vod_actor' => '周迅/胡歌/张译']);
$actorRight = array_merge($actorLeft, ['vod_actor' => '胡歌,周迅,黄渤']);
auditCheck(AuditMatch::assess($actorLeft, $actorRight)['level'] === 'probable', 'Two shared real actors independently support probable identity evidence');
$oneActor = array_merge($actorRight, ['vod_actor' => '胡歌,黄渤']);
auditCheck(AuditMatch::assess($actorLeft, $oneActor)['level'] === 'insufficient', 'One actor alone without an ID or director is insufficient to claim probable identity');
foreach (['未知', '不详', '暂无', 'N/A', 'null', '0', '-'] as $placeholder) {
    $placeholderPeople = array_merge($probableLeft, ['vod_director' => $placeholder, 'vod_actor' => $placeholder]);
    $assessment = AuditMatch::assess($placeholderPeople, $placeholderPeople);
    auditCheck($assessment['level'] === 'insufficient' && $assessment['missing'] !== [], 'Identical placeholder names cannot count as real people evidence: ' . $placeholder);
}
foreach ([['vod_year' => ''], ['vod_year' => '未知'], ['vod_year' => '0000'], ['type_id' => 0], ['vod_director' => '', 'vod_actor' => '']] as $missing) {
    $incomplete = array_merge($reliable, $missing);
    auditCheck(AuditMatch::assess($incomplete, $incomplete)['level'] === 'insufficient', 'A positive Douban ID does not manufacture missing year, category or personnel evidence');
}
$seasonLeft = array_merge($reliable, ['vod_name' => '山海之间 第一季']);
$seasonRight = array_merge($reliable, ['vod_name' => '山海之间 第二季']);
auditCheck(AuditMatch::assess($seasonLeft, $seasonRight)['level'] === 'conflict', 'A same positive Douban ID with conflicting seasons must remain a data conflict, never a related-season dismissal');
$englishSeasonLeft = array_merge($reliable, ['vod_en' => 'Mountain Sea Season 1']);
$englishSeasonRight = array_merge($reliable, ['vod_en' => 'Mountain Sea S02']);
auditCheck(AuditMatch::assess($englishSeasonLeft, $englishSeasonRight)['level'] === 'conflict', 'Different seasons in English-name metadata remain a real conflict even when the Chinese primary title and positive ID match');
auditCheck(AuditMatch::assess(array_merge($englishSeasonLeft, ['vod_douban_id' => 101]), array_merge($englishSeasonRight, ['vod_douban_id' => 102]))['level'] === 'related', 'English season metadata distinguishes related series entries with separate positive IDs');
auditCheck(AuditMatch::assess($englishSeasonLeft, $reliable)['level'] === 'insufficient', 'English season metadata present on only one side cannot certify symmetric season evidence');
auditCheck(AuditMatch::assess(array_merge($englishSeasonLeft, ['vod_douban_id' => 0]), array_merge($englishSeasonRight, ['vod_douban_id' => 0]))['level'] === 'related', 'Explicit different English seasons are related entries even when neither row supplies a positive ID');
$matchedSeasonLeft = array_merge($reliable, ['vod_name' => '山海之间 第一季', 'vod_en' => 'Mountain Sea Season 1']);
$matchedSeasonRight = array_merge($reliable, ['vod_name' => '山海之间第1季', 'vod_en' => 'Mountain Sea S01']);
auditCheck(AuditMatch::assess($matchedSeasonLeft, $matchedSeasonRight)['level'] === 'high', 'Consistent Chinese and English season numbers support high-quality evidence after numeral normalization');
$contradictoryEnglish = array_merge($seasonLeft, ['vod_en' => 'Mountain Sea Season 2']);
auditCheck(AuditMatch::assess($contradictoryEnglish, $contradictoryEnglish)['level'] === 'conflict', 'Contradictory Chinese and English season metadata is surfaced for correction rather than accepted as matching season evidence');
$differentYear = array_merge($reliable, ['vod_year' => '2025']);
auditCheck(AuditMatch::assess($reliable, $differentYear)['level'] === 'conflict', 'A same positive Douban ID with different valid years is a real data conflict');
$relatedLeft = array_merge($seasonLeft, ['vod_douban_id' => 0]);
$relatedRight = array_merge($seasonRight, ['vod_douban_id' => 0]);
$related = AuditMatch::assess($relatedLeft, $relatedRight);
auditCheck($related['level'] === 'related' && $related['priority'] === 0, 'Shared series stems with explicit different seasons are related works rather than duplicate review candidates');
auditCheck(AuditMatch::assess(array_merge($seasonLeft, ['vod_douban_id' => 101]), array_merge($seasonRight, ['vod_douban_id' => 102]))['level'] === 'related', 'Distinct positive IDs together with distinct explicit seasons remain related series entries');
$asymmetricSeason = array_merge($seasonLeft, ['vod_sub' => '山海之间']);
auditCheck(AuditMatch::assess($asymmetricSeason, $reliable)['level'] !== 'high', 'A same positive ID does not bypass asymmetric season metadata for high-quality evidence');
$distinctId = array_merge($reliable, ['vod_douban_id' => 54321]);
auditCheck(AuditMatch::assess($reliable, $distinctId)['level'] === 'conflict', 'A full-title match with distinct positive IDs and the same year remains an identity conflict');
$distinctCategory = array_merge($reliable, ['type_id' => 3]);
auditCheck(AuditMatch::assess($reliable, $distinctCategory)['level'] === 'conflict', 'A full-title and ID match cannot hide a real category conflict');
$cinema = array_merge($reliable, ['vod_version' => '影院版']);
$directorCut = array_merge($reliable, ['vod_version' => '导演剪辑版']);
auditCheck(AuditMatch::assess($cinema, $directorCut)['level'] === 'conflict', 'Different explicit versions are surfaced as conflicts instead of merging theatrical and director cuts');
$languageRisk = AuditMatch::assess(array_merge($reliable, ['vod_lang' => '国语']), array_merge($reliable, ['vod_lang' => '粤语']));
auditCheck((bool) preg_grep('/语言标注不同|音轨与配音/u', $languageRisk['risks']), 'Language differences are visible in the rule assessment for human route review');
$encodedTitle = array_merge($probableLeft, ['vod_name' => '星河&amp;海岸', 'vod_sub' => '第一译名&#47;山海之间']);
auditCheck(AuditMatch::assess($encodedTitle, $probableLeft)['level'] === 'probable', 'HTML-encoded alias separators are decoded before exact title evidence is compared');
$formatTitle = array_merge($probableLeft, ['vod_name' => "山\u{200B}海之间"]);
auditCheck(AuditMatch::assess($formatTitle, $probableLeft)['level'] === 'probable', 'Invisible format characters do not split an otherwise complete exact title');
foreach (['未知', '暂无', 'N/A'] as $placeholder) {
    $placeholderTitle = array_merge($probableLeft, ['vod_name' => $placeholder]);
    auditCheck(AuditMatch::assess($placeholderTitle, $placeholderTitle)['level'] !== 'probable', 'Placeholder titles do not become complete-title evidence: ' . $placeholder);
}

$batchVideos = [1 => auditVideo('同一作品'), 21 => auditVideo('同一作品')];
foreach (range(2, 20) as $id) {
    $batchVideos[$id] = auditVideo('跨批无关作品' . $id);
}
[$db, $audit] = auditFixture($batchVideos);
$sourceBefore = $db->query('SELECT * FROM mac_vod ORDER BY vod_id')->fetchAll(PDO::FETCH_ASSOC);
$startedBefore = time();
$summary = $audit->start();
$runId = $summary['active_run_id'];
auditCheck($summary['weekly_enabled'] && $summary['run']['mode'] === 'full', 'The first scan is full and opts into weekly incremental scans');
auditCheck($summary['run']['lower_id'] === 0 && $summary['run']['upper_id'] === 21 && $summary['run']['total_count'] === 21, 'A full run captures a fixed ID range and starting count');
auditCheck($summary['run']['started_at'] >= $startedBefore && $summary['run']['started_at'] <= time(), 'The persisted run records its actual start time');
$summary = $audit->tick(20);
auditCheck($summary['run']['processed_count'] === 20 && $summary['run']['cursor_id'] === 20, 'A batch advances only to the last record actually processed');
auditCheck($audit->issues($runId)['items'] === [], 'One indexed record cannot report itself as a duplicate');
$summary = auditFinish($audit, 1);
$items = auditAllIssues($audit, $runId);
auditCheck(count($items) === 1 && auditPair($items, 1, 21)['kind'] === 'possible_duplicate', 'A duplicate discovered in a later batch is recorded exactly once');
auditCheck($summary['watermark'] === 21 && $summary['last_completed_at'] === $summary['latest_run']['finished_at'], 'Only successful completion advances the incremental watermark and completion time');
auditCheck($summary['next_run_at'] === $summary['last_completed_at'] + 7 * 86400, 'The next incremental scan is scheduled seven days after successful completion');
auditCheck($summary['latest_run']['elapsed_seconds'] >= 0 && $summary['latest_run']['processed_count'] === 21, 'Completion records elapsed time and real processed count');
auditCheck($sourceBefore === $db->query('SELECT * FROM mac_vod ORDER BY vod_id')->fetchAll(PDO::FETCH_ASSOC), 'Scanning never changes source video rows or playback fields');

[$recallDb, $recallAudit] = auditFixture([
    10 => auditVideo('正式片名', ['vod_sub' => '第一译名/目标译名|Third Name']), 11 => auditVideo('目标译名'),
    20 => auditVideo('输入中文名', ['vod_en' => 'Secret Valley']), 21 => auditVideo('目标中文名', ['vod_en' => 'Secret Valley']),
    22 => auditVideo('夜路', ['vod_en' => 'Night Road']), 23 => auditVideo('Night Road'),
    30 => auditVideo('星河 第二季'), 31 => auditVideo('星河第2季'),
    40 => auditVideo('上'), 41 => auditVideo('另一中文片名', ['vod_sub' => '上/不同别名']),
    50 => auditVideo('家'), 51 => auditVideo('家园'), 52 => auditVideo('家'),
    60 => auditVideo('晴空之下', ['vod_sub' => '第一季']), 61 => auditVideo('陌生街道', ['vod_sub' => '第一季']),
    62 => auditVideo('第一季'), 63 => auditVideo('第一季'),
    70 => auditVideo('完全无关作品'),
]);
$recallRun = $recallAudit->start(false)['active_run_id'];
auditFinish($recallAudit, 1);
$items = auditAllIssues($recallAudit, $recallRun);
foreach ([[10, 11], [20, 21], [22, 23], [30, 31], [40, 41], [50, 52]] as $pair) {
    auditCheck(auditPair($items, $pair[0], $pair[1]) !== null, 'Full titles, exact aliases, English names, and normalized season stems recall their real counterpart');
}
auditCheck(auditPair($items, 50, 51) === null, 'A single-character title does not expand into a longer unrelated title');
auditCheck(auditPair($items, 60, 61) === null && auditPair($items, 62, 63) === null, 'Season-only aliases or primary names cannot become shared film evidence');
auditCheck(count($items) === 6, 'Unrelated titles are not reported merely because year, category, or people match');
auditCheck((int) $recallDb->query('SELECT COUNT(*) FROM mac_vodmerge_audit_issue WHERE left_id=right_id')->fetchColumn() === 0, 'No issue compares a video with itself');

[$conflictDb, $conflictAudit] = auditFixture([
    100 => auditVideo('蓝海 第一季'), 101 => auditVideo('蓝海 第二季'),
    110 => auditVideo('年代谜案', ['vod_year' => '2025']), 111 => auditVideo('年代谜案', ['vod_year' => '2026']),
    120 => auditVideo('霜河电影', ['vod_version' => '影院版']), 121 => auditVideo('霜河电影', ['vod_version' => '导演剪辑版']),
    130 => auditVideo('身份冲突', ['vod_douban_id' => 101]), 131 => auditVideo('身份冲突', ['vod_douban_id' => 102]),
]);
[$normalDb, $normalAudit] = auditFixture([
    201 => auditVideo('星河&amp;海岸'), 202 => auditVideo('星河&海岸'),
    203 => auditVideo('实体别名原片', ['vod_sub' => '第一译名&#47;目标译名']), 204 => auditVideo('目标译名'),
    205 => auditVideo("格式\u{200B}字符作品"), 206 => auditVideo('格式字符作品'),
    207 => auditVideo('未知'), 208 => auditVideo('未知'),
    209 => auditVideo('N/A'), 210 => auditVideo('N/A'),
    211 => auditVideo('上'), 212 => auditVideo('上'),
]);
$normalRun = $normalAudit->start(false)['active_run_id'];
auditFinish($normalAudit, 2);
$normalItems = auditAllIssues($normalAudit, $normalRun);
auditCheck(count($normalItems) === 4 && auditPair($normalItems, 201, 202) !== null && auditPair($normalItems, 203, 204) !== null && auditPair($normalItems, 205, 206) !== null, 'Candidate indexing recalls decoded title entities, encoded alias separators and invisible format characters');
auditCheck(auditPair($normalItems, 207, 208) === null && auditPair($normalItems, 209, 210) === null && auditPair($normalItems, 211, 212) !== null, 'Candidate indexing rejects placeholder-title collisions while preserving legitimate single-character titles');

[$placeholderDb, $placeholderAudit] = auditFixture([
    301 => array_merge($reliable, ['vod_year' => '未知']), 302 => $reliable,
]);
$placeholderRun = $placeholderAudit->start(false)['active_run_id'];
auditFinish($placeholderAudit, 2);
$placeholderIssue = $placeholderAudit->issues($placeholderRun)['items'][0];
auditCheck($placeholderIssue['kind'] === 'conflict' && $placeholderIssue['assessment'] === 'insufficient'
    && $placeholderIssue['detail']['left']['vod_year'] === '未知' && in_array('vod_year 冲突', $placeholderIssue['detail']['conflicts'], true)
    && $placeholderIssue['detail']['rule_assessment']['conflicts'] === [], 'Quality grouping interprets placeholder years as missing evidence while preserving the original raw scan metadata, kind and merge-conflict guards');

$conflictRun = $conflictAudit->start(false)['active_run_id'];
auditFinish($conflictAudit, 2);
$items = auditAllIssues($conflictAudit, $conflictRun);
foreach ([[100, 101, '季数冲突'], [110, 111, 'vod_year 冲突'], [120, 121, 'vod_version 冲突'], [130, 131, 'vod_douban_id 冲突']] as $case) {
    $issue = auditPair($items, $case[0], $case[1]);
    auditCheck($issue !== null && $issue['kind'] === 'conflict' && in_array($case[2], $issue['detail']['conflicts'], true), 'Identity disagreements are recorded as reviewable conflicts, never as matching duplicates');
}

$failureVideos = [1 => auditVideo('失败续跑'), 21 => auditVideo('失败续跑')];
foreach (range(2, 20) as $id) {
    $failureVideos[$id] = auditVideo('失败场景无关作品' . $id);
}
[$failureDb, $failureAudit] = auditFixture($failureVideos);
$failureRun = $failureAudit->start()['active_run_id'];
$failureAudit->tick(20);
$keysBefore = $failureDb->query('SELECT * FROM mac_vodmerge_audit_key ORDER BY key_hash,vod_id')->fetchAll(PDO::FETCH_ASSOC);
$failureDb->exec("CREATE TRIGGER audit_fixture_failure BEFORE UPDATE OF cursor_id ON mac_vodmerge_audit_run WHEN NEW.cursor_id>OLD.cursor_id BEGIN SELECT RAISE(ABORT,'fixture batch error https://never-display.example/?token=private'); END");
$failed = $failureAudit->tick(20);
auditCheck($failed['active_run_id'] === $failureRun && $failed['run']['status'] === 'error', 'A failed batch persists an error and keeps the resumable active run');
auditCheck($failed['run']['cursor_id'] === 20 && $failed['run']['processed_count'] === 20, 'Batch failure rolls back both cursor and processed count');
auditCheck($failed['watermark'] === 0 && $failed['last_completed_at'] === 0 && $failed['next_run_at'] === 0, 'Failure never advances the success watermark or schedules a false completion');
auditCheck($keysBefore === $failureDb->query('SELECT * FROM mac_vodmerge_audit_key ORDER BY key_hash,vod_id')->fetchAll(PDO::FETCH_ASSOC) && $failureAudit->issues($failureRun)['items'] === [], 'Batch failure rolls back newly indexed keys and newly found issues together');
auditCheck($failed['run']['error_message'] !== '' && strpos($failed['run']['error_message'], 'never-display') === false, 'User-visible failure summaries do not leak raw storage error details');
$failureDb->exec('DROP TRIGGER audit_fixture_failure');
$resumed = auditFinish(new LibraryAudit($failureDb, 'mac_'), 1);
auditCheck($resumed['watermark'] === 21 && count(auditAllIssues($failureAudit, $failureRun)) === 1, 'A fresh service resumes a failed durable run without missing or duplicating its pair');
auditSeed($failureDb, 22, auditVideo('失败续跑'));
auditDue($failureDb);
$failureDb->exec("CREATE TRIGGER audit_fixture_weekly_failure BEFORE UPDATE OF cursor_id ON mac_vodmerge_audit_run WHEN NEW.mode='incremental' AND NEW.cursor_id>OLD.cursor_id BEGIN SELECT RAISE(ABORT,'fixture first weekly batch error'); END");
$weeklyFailure = $failureAudit->tick(20);
auditCheck($weeklyFailure['active_run_id'] > $failureRun && $weeklyFailure['run']['mode'] === 'incremental' && $weeklyFailure['run']['status'] === 'error', 'The first failing weekly batch still leaves a durable failed incremental run instead of displaying the old successful run');
$weeklyFailureRun = $weeklyFailure['active_run_id'];
auditCheck($weeklyFailure['watermark'] === 21 && $weeklyFailure['run']['cursor_id'] === 21 && $weeklyFailure['run']['processed_count'] === 0 && $failureAudit->issues($weeklyFailureRun)['items'] === [], 'The first weekly batch failure preserves the successful watermark and rolls back its own work');
$failureDb->exec('DROP TRIGGER audit_fixture_weekly_failure');
$weeklyResumed = auditFinish(new LibraryAudit($failureDb, 'mac_'), 20);
auditCheck($weeklyResumed['latest_run']['run_id'] === $weeklyFailureRun && $weeklyResumed['watermark'] === 22 && count(auditAllIssues($failureAudit, $weeklyFailureRun)) === 2, 'A failed first weekly batch resumes the same persisted run and records each old-library counterpart once');

$weeklyVideos = [1 => auditVideo('旧库作品'), 2 => auditVideo('旧库另一作品')];
foreach (range(3, 20) as $id) {
    $weeklyVideos[$id] = auditVideo('旧库无关作品' . $id);
}
[$weeklyDb, $weeklyAudit] = auditFixture($weeklyVideos);
$fullRun = $weeklyAudit->start()['active_run_id'];
$complete = auditFinish($weeklyAudit, 1);
$runsBefore = (int) $weeklyDb->query('SELECT COUNT(*) FROM mac_vodmerge_audit_run')->fetchColumn();
$weeklyAudit->tick(1);
auditCheck((int) $weeklyDb->query('SELECT COUNT(*) FROM mac_vodmerge_audit_run')->fetchColumn() === $runsBefore, 'The worker does not launch the weekly run before it is due');
auditSeed($weeklyDb, 21, auditVideo('旧库作品'));
foreach (range(22, 40) as $id) {
    auditSeed($weeklyDb, $id, auditVideo('新增无关作品' . $id));
}
auditSeed($weeklyDb, 41, auditVideo('本周无重复作品'));
auditDue($weeklyDb);
$weekly = $weeklyAudit->tick(20);
$weeklyRun = $weekly['active_run_id'];
auditCheck($weekly['run']['mode'] === 'incremental' && $weekly['run']['lower_id'] === 20 && $weekly['run']['upper_id'] === 41 && $weekly['run']['total_count'] === 21, 'The due weekly run captures only IDs beyond the last successful upper bound');
auditCheck(auditPair(auditAllIssues($weeklyAudit, $weeklyRun), 1, 21) !== null, 'New videos are compared against the persistent index of the old full library');
auditSeed($weeklyDb, 42, auditVideo('旧库另一作品'));
$weekly = auditFinish($weeklyAudit, 1);
auditCheck($weekly['watermark'] === 41 && $weekly['latest_run']['processed_count'] === 21, 'Arrivals after a run captures its upper bound stay outside that run');
auditCheck((int) $weeklyDb->query('SELECT COUNT(*) FROM mac_vodmerge_audit_key WHERE vod_id=42')->fetchColumn() === 0, 'A post-start arrival is not accidentally indexed by the current run');
auditDue($weeklyDb);
$next = auditFinish($weeklyAudit, 1);
$nextRun = $next['latest_run']['run_id'];
auditCheck($next['latest_run']['lower_id'] === 41 && $next['latest_run']['upper_id'] === 42 && $next['latest_run']['processed_count'] === 1 && auditPair(auditAllIssues($weeklyAudit, $nextRun), 2, 42) !== null, 'The following due run processes the deferred arrival against the old library');
auditDue($weeklyDb);
$empty = auditFinish($weeklyAudit, 1);
auditCheck($empty['latest_run']['mode'] === 'incremental' && $empty['latest_run']['processed_count'] === 0 && $empty['latest_run']['total_count'] === 0 && $empty['watermark'] === 42, 'An empty incremental run completes with zero work without losing the successful watermark');
auditCheck($empty['next_run_at'] === $empty['last_completed_at'] + 7 * 86400, 'An empty week still records completion and waits a full week before the next run');

[$deleteDb, $deleteAudit] = auditFixture([1 => auditVideo('仍存在'), 2 => auditVideo('扫描前删除'), 3 => auditVideo('仍然存在')]);
$deleteAudit->start(false);
$deleteDb->exec('DELETE FROM mac_vod WHERE vod_id=2');
$deleted = auditFinish($deleteAudit, 1);
auditCheck($deleted['latest_run']['total_count'] === 3 && $deleted['latest_run']['processed_count'] === 2, 'A captured count is not presented as processed work when a source row disappears');
auditCheck((int) $deleteDb->query('SELECT COUNT(*) FROM mac_vodmerge_audit_key WHERE vod_id=2')->fetchColumn() === 0, 'A deleted source row is never indexed from a nonexistent record');

[$refreshDb, $refreshAudit] = auditFixture([1 => auditVideo('曾经同名'), 2 => auditVideo('曾经同名')]);
$oldRun = $refreshAudit->start(false)['active_run_id'];
auditFinish($refreshAudit, 1);
$refreshDb->exec("UPDATE mac_vod SET vod_name='修正后的不同作品' WHERE vod_id=1");
$newRun = $refreshAudit->start(false)['active_run_id'];
auditFinish($refreshAudit, 1);
auditCheck($newRun !== $oldRun && $refreshAudit->issues($newRun)['items'] === [], 'A manual full rescan refreshes old metadata keys rather than preserving a false old match');
auditCheck(count(auditAllIssues($refreshAudit, $oldRun)) === 1, 'A full rescan preserves the historical evidence of an earlier run');
auditSeed($refreshDb, 3, auditVideo('曾经同名'));
$thirdRun = $refreshAudit->start(false)['active_run_id'];
auditFinish($refreshAudit, 1);
$refreshedItems = auditAllIssues($refreshAudit, $thirdRun);
auditCheck(auditPair($refreshedItems, 2, 3) !== null && auditPair($refreshedItems, 1, 3) === null, 'A later video is compared with the refreshed old keys after a manual full scan');

[$scheduleDb, $scheduleAudit] = auditFixture([1 => auditVideo('调度甲'), 2 => auditVideo('调度乙')]);
$active = $scheduleAudit->start()['active_run_id'];
$same = $scheduleAudit->start();
auditCheck($same['active_run_id'] === $active && (int) $scheduleDb->query('SELECT COUNT(*) FROM mac_vodmerge_audit_run')->fetchColumn() === 1, 'Repeated starts cannot create concurrent active runs');
$disabled = $scheduleAudit->schedule(false);
auditCheck(!$disabled['weekly_enabled'] && $disabled['active_run_id'] === $active && $disabled['next_run_at'] === 0, 'Disabling future weekly scans does not cancel an active full scan');
$enabled = $scheduleAudit->schedule(true);
auditCheck($enabled['weekly_enabled'] && $enabled['active_run_id'] === $active, 'Enabling weekly scans reuses the current run');
auditFinish($scheduleAudit, 1);
$disabled = $scheduleAudit->schedule(false);
auditDue($scheduleDb);
auditCheck($scheduleAudit->tick(1)['active_run_id'] === 0 && (int) $scheduleDb->query('SELECT COUNT(*) FROM mac_vodmerge_audit_run')->fetchColumn() === 1, 'A disabled weekly schedule does not launch a due background run');

$crowdedVideos = [];
foreach (range(1, 53) as $id) {
    $crowdedVideos[$id] = auditVideo('同名密集作品');
}
[$crowdedDb, $crowdedAudit] = auditFixture($crowdedVideos);
$crowdedRun = $crowdedAudit->start(false)['active_run_id'];
$crowded = auditFinish($crowdedAudit, 10);
auditCheck($crowded['latest_run']['truncated_count'] > 0, 'A saturated candidate lookup explicitly records incomplete comparison coverage');
$firstPage = $crowdedAudit->issues($crowdedRun);
auditCheck(count($firstPage['items']) === 30 && $firstPage['has_more'] && $firstPage['next_before'] > 0, 'Issue results use a bounded first page with an explicit continuation');
$secondPage = $crowdedAudit->issues($crowdedRun, $firstPage['next_before']);
auditCheck(array_intersect(array_column($firstPage['items'], 'issue_id'), array_column($secondPage['items'], 'issue_id')) === [], 'Issue cursor pagination never repeats a result');
$public = json_encode($firstPage, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
auditCheck(strpos($public, 'never-display') === false && strpos($public, 'private-play-password') === false && strpos($public, 'key_hash') === false, 'Issue responses expose neither playback secrets nor private lookup-key storage');
foreach ($firstPage['items'] as $issue) {
    auditCheck($issue['left_id'] < $issue['right_id'], 'Every returned comparison has a stable ordered pair and excludes itself');
    auditCheck(isset($issue['detail']['left']['vod_name'], $issue['detail']['right']['vod_name'], $issue['detail']['conflicts']), 'Issue evidence provides human-readable video metadata and conflict reasons');
}
auditCheck($crowdedAudit->issues($crowdedRun, 0, 'conflict')['items'] === [], 'Issue filtering excludes other kinds rather than ignoring the requested kind');
$filtered = $conflictAudit->issues($conflictRun, 0, 'conflict');
auditCheck(count($filtered['items']) === 4 && array_unique(array_column($filtered['items'], 'kind')) === ['conflict'], 'Conflict filtering retains only recorded identity conflicts');
auditCheck($conflictAudit->issues($conflictRun, 0, 'possible_duplicate')['items'] === [], 'Possible-duplicate filtering does not relabel hard conflicts');

$qualityVideos = [];
$qualityExpected = [];
$qualityId = 1000;
foreach (['high', 'probable', 'conflict', 'insufficient', 'related'] as $level) {
    foreach (range(1, 9) as $number) {
        $leftId = $qualityId++;
        $rightId = $qualityId++;
        $name = '独立质量样本' . $leftId;
        $left = auditVideo($name, ['vod_year' => '2024', 'vod_version' => '正片', 'vod_director' => '陈可辛', 'vod_actor' => '周迅,胡歌']);
        $right = $left;
        if ($level === 'high') {
            $left['vod_douban_id'] = $right['vod_douban_id'] = $leftId;
        } elseif ($level === 'conflict') {
            $left['vod_douban_id'] = $leftId;
            $right['vod_douban_id'] = $rightId;
        } elseif ($level === 'insufficient') {
            $left['vod_director'] = $right['vod_director'] = '';
            $left['vod_actor'] = $right['vod_actor'] = '';
        } elseif ($level === 'related') {
            $left['vod_name'] .= ' 第一季';
            $right['vod_name'] .= ' 第二季';
        }
        $qualityVideos[$leftId] = $left;
        $qualityVideos[$rightId] = $right;
        $qualityExpected[$leftId . ':' . $rightId] = $level;
    }
}
$automaticReviews = 0;
[$qualityDb, $qualityAudit] = auditFixture($qualityVideos, static function () use (&$automaticReviews) {
    $automaticReviews++;
    throw new RuntimeException('Quality scans and reads must never request AI evidence');
});
$qualityRun = $qualityAudit->start(false)['active_run_id'];
auditFinish($qualityAudit, 20);
$qualitySource = auditScanSnapshot($qualityDb);
$qualityRaw = auditAllIssues($qualityAudit, $qualityRun);
auditCheck(count($qualityRaw) === 45, 'Independent quality sample pairs produce exactly one stored issue each without unrelated cross-pair matches');
foreach ($qualityRaw as $issue) {
    $expectedLevel = $qualityExpected[$issue['left_id'] . ':' . $issue['right_id']];
    auditCheck($issue['assessment'] === $expectedLevel && $issue['detail']['rule_assessment']['level'] === $expectedLevel && $issue['assessment_version'] === AuditMatch::VERSION, 'Fresh scans persist the selected rule quality and assessment version with each saved metadata snapshot');
    auditCheck(!$issue['detail']['rule_stale'] && !$issue['detail']['current_missing'], 'Unchanged current film metadata leaves new rule evidence fresh');
}
$legacyIssue = (int) $qualityDb->query('SELECT MIN(issue_id) FROM mac_vodmerge_audit_issue')->fetchColumn();
$expectedOrder = array_map('intval', $qualityDb->query('SELECT issue_id FROM mac_vodmerge_audit_issue ORDER BY priority DESC,issue_id DESC')->fetchAll(PDO::FETCH_COLUMN));
$qualityIds = [];
$qualityBefore = 0;
$qualityPriority = -1;
$pageCount = 0;
do {
    $page = $qualityAudit->issues($qualityRun, $qualityBefore, '', 'all', $qualityPriority);
    $pageCount++;
    auditCheck(count($page['items']) <= 30, 'A quality-sorted result page remains bounded');
    foreach ($page['items'] as $issue) {
        $qualityIds[] = $issue['issue_id'];
    }
    if ($page['has_more']) {
        $last = end($page['items']);
        auditCheck($page['next_before'] === $last['issue_id'] && $page['next_priority'] === $last['priority'], 'A quality continuation carries both values of its final composite sort key');
    }
    $qualityBefore = $page['next_before'];
    $qualityPriority = $page['next_priority'];
} while ($page['has_more']);
auditCheck($pageCount === 2 && $qualityIds === $expectedOrder && count(array_unique($qualityIds)) === 45, 'Quality cursor pagination preserves global priority order across page boundaries without duplicate or omitted issues');
$reviewPage = $qualityAudit->issues($qualityRun, 0, '', 'review');
$reviewNext = $qualityAudit->issues($qualityRun, $reviewPage['next_before'], '', 'review', $reviewPage['next_priority']);
$reviewItems = array_merge($reviewPage['items'], $reviewNext['items']);
auditCheck(count($reviewItems) === 36 && !in_array('related', array_column($reviewItems, 'assessment'), true), 'The actionable review filter excludes related works but retains all other quality levels across pages');
foreach (['high' => 9, 'probable' => 9, 'conflict' => 9, 'insufficient' => 9, 'related' => 9, 'unrated' => 0] as $level => $count) {
    $page = $qualityAudit->issues($qualityRun, 0, '', $level);
    auditCheck(count($page['items']) === $count && array_unique(array_column($page['items'], 'assessment')) === ($count ? [$level] : []), 'An explicit quality filter returns only its selected stored level: ' . $level);
}
foreach ([[0, 0, '', 'all', -1], [$qualityRun, 1, '', 'all', -1], [$qualityRun, 0, '', 'all', 0],
    [$qualityRun, 1, '', 'all', 5], [$qualityRun, 1, '', 'all', -2], [$qualityRun, 0, '', 'probability', -1],
    [$qualityRun, 0, 'duplicate', 'all', -1], [$qualityRun, -1, '', 'all', -1]] as $arguments) {
    try {
        $qualityAudit->issues(...$arguments);
        throw new RuntimeException('An invalid quality filter or composite cursor was accepted');
    } catch (InvalidArgumentException $error) {
        auditCheck($error->getMessage() !== '', 'Malformed quality requests reject before performing result reads');
    }
}
auditCheck($qualityAudit->issues($qualityRun, 0, 'conflict', 'high')['items'] === [] && $qualityAudit->issues($qualityRun, 0, 'possible_duplicate', 'related')['items'] === [], 'Legacy kind and quality filters are combined without rewriting historical conflict classifications');
$legacyOrder = array_map('intval', $qualityDb->query('SELECT issue_id FROM mac_vodmerge_audit_issue ORDER BY issue_id DESC')->fetchAll(PDO::FETCH_COLUMN));
auditCheck(array_column(auditAllIssues($qualityAudit, $qualityRun), 'issue_id') === $legacyOrder, 'The omitted quality argument preserves the existing issue-ID cursor contract');
$qualityCounts = $qualityAudit->summary()['assessment_counts'];
auditCheck($qualityCounts['high'] === 9 && $qualityCounts['probable'] === 9 && $qualityCounts['conflict'] === 9 && $qualityCounts['insufficient'] === 9 && $qualityCounts['related'] === 9 && $qualityCounts['unrated'] === 0, 'The latest-run quality summary counts stored assessment groups rather than mislabeling all conflicts as duplicate risk');
auditCheck($automaticReviews === 0 && $qualitySource === auditScanSnapshot($qualityDb), 'Quality sorting, filtering and summary reads neither call AI nor change films, scan state or lookup keys');
$qualityDb->exec("UPDATE mac_vod SET vod_actor='已更正的新演员' WHERE vod_id=1000");
$staleRule = auditPair($qualityAudit->issues($qualityRun, 0, '', 'high')['items'], 1000, 1001);
auditCheck($staleRule['detail']['rule_stale'] && !$staleRule['detail']['current_missing'] && !isset($staleRule['detail']['ai_review']), 'Current metadata changes mark historical rules stale even for issues without any AI review');
$staleStored = $qualityDb->query('SELECT detail_json FROM mac_vodmerge_audit_issue WHERE issue_id=' . $legacyIssue)->fetchColumn();
$qualityAudit->issues($qualityRun, 0, '', 'high');
auditCheck($qualityDb->query('SELECT detail_json FROM mac_vodmerge_audit_issue WHERE issue_id=' . $legacyIssue)->fetchColumn() === $staleStored, 'Marking a stale rule during a list read does not rewrite its historical evidence');
$qualityDb->exec('DELETE FROM mac_vod WHERE vod_id=1001');
$missingRule = auditPair($qualityAudit->issues($qualityRun, 0, '', 'high')['items'], 1000, 1001);
auditCheck($missingRule['detail']['current_missing'] && $missingRule['detail']['rule_stale'], 'A missing current counterpart cannot be presented as fresh rule evidence');
auditCheck($automaticReviews === 0, 'Stale and missing film checks remain local and do not automatically issue model calls');

$movingVideos = [];
foreach (range(1, 32) as $number) {
    $leftId = $number * 2 - 1;
    $rightId = $number * 2;
    $video = auditVideo('分页更新样本' . $number, ['vod_year' => '2024', 'vod_version' => '正片', 'vod_director' => '陈可辛', 'vod_actor' => '周迅,胡歌']);
    if ($number === 1) {
        $video['vod_douban_id'] = 91919;
    }
    $movingVideos[$leftId] = $movingVideos[$rightId] = $video;
}
$movingReviews = 0;
[$movingDb, $movingAudit] = auditFixture($movingVideos, static function () use (&$movingReviews) {
    $movingReviews++;
    throw new RuntimeException('Assessment pagination must not call AI');
});
$movingRun = $movingAudit->start(false)['active_run_id'];
auditFinish($movingAudit, 20);
foreach ($movingDb->query('SELECT issue_id,detail_json FROM mac_vodmerge_audit_issue')->fetchAll(PDO::FETCH_ASSOC) as $row) {
    $detail = json_decode($row['detail_json'], true);
    unset($detail['rule_assessment']);
    $movingDb->prepare("UPDATE mac_vodmerge_audit_issue SET detail_json=?,assessment='unrated',priority=0,assessment_version=0 WHERE issue_id=?")
        ->execute([Payload::json($detail), $row['issue_id']]);
}
$movingSnapshot = auditScanSnapshot($movingDb);
$pendingPage = $movingAudit->issues($movingRun, 0, '', 'all');
auditCheck($pendingPage['assessment_updating'] && $pendingPage['has_more'] && count($pendingPage['items']) === 30 && $pendingPage['next_before'] === 3 && $pendingPage['next_priority'] === 0, 'An unclassified 32-pair result page reports that global priority classification is still moving');
$movingBatch = $movingAudit->assessBatch(1);
auditCheck($movingBatch['processed'] === 1 && $movingBatch['remaining'] === 31 && $movingDb->query('SELECT assessment FROM mac_vodmerge_audit_issue WHERE issue_id=1')->fetchColumn() === 'high', 'Backfill can move an older unseen pair from below the saved cursor to the front of the priority order');
try {
    $movingAudit->issues($movingRun, $pendingPage['next_before'], '', 'all', $pendingPage['next_priority']);
    throw new RuntimeException('A moving priority cursor silently omitted its newly promoted pair');
} catch (InvalidArgumentException $error) {
    auditCheck($error->getMessage() === '规则分级仍在更新，请刷新首页；完成后再翻页。', 'A continuation during moving priority classification is rejected with an explicit refresh instruction');
}
$pendingRefresh = $movingAudit->issues($movingRun, 0, '', 'all');
auditCheck($pendingRefresh['assessment_updating'] && $pendingRefresh['items'][0]['issue_id'] === 1 && $pendingRefresh['items'][0]['assessment'] === 'high', 'A first-page refresh shows the newly promoted strong pair while remaining classification is still pending');
$legacyPending = $movingAudit->issues($movingRun, $pendingPage['next_before']);
auditCheck(!$legacyPending['assessment_updating'] && array_column($legacyPending['items'], 'issue_id') === [2, 1], 'The legacy ID-only continuation remains stable and readable while new priority classification is moving');
$movingComplete = $movingAudit->assessBatch(500);
auditCheck($movingComplete['processed'] === 31 && $movingComplete['remaining'] === 0, 'Completing the bounded remaining classification removes the moving-order condition');
$stableFirst = $movingAudit->issues($movingRun, 0, '', 'all');
$stableSecond = $movingAudit->issues($movingRun, $stableFirst['next_before'], '', 'all', $stableFirst['next_priority']);
$stableIds = array_merge(array_column($stableFirst['items'], 'issue_id'), array_column($stableSecond['items'], 'issue_id'));
$stableExpected = array_map('intval', $movingDb->query('SELECT issue_id FROM mac_vodmerge_audit_issue ORDER BY priority DESC,issue_id DESC')->fetchAll(PDO::FETCH_COLUMN));
auditCheck(!$stableFirst['assessment_updating'] && !$stableSecond['assessment_updating'] && $stableFirst['items'][0]['issue_id'] === 1 && $stableIds === $stableExpected && count(array_unique($stableIds)) === 32, 'After classification completes, refreshing the first page and following its composite cursor returns every pair once including the promoted older pair');
auditCheck($movingSnapshot === auditScanSnapshot($movingDb) && $movingReviews === 0, 'Moving-cursor rejection, first-page refresh and completion never alter videos, scan state or call AI');

$backfillCalls = 0;
[$backfillDb, $backfillAudit] = auditFixture([
    1 => $reliable, 2 => $reliable,
    3 => auditVideo('回填独立作品', ['vod_director' => '陈可辛', 'vod_actor' => '周迅,胡歌']),
    4 => auditVideo('回填独立作品', ['vod_director' => '陈可辛', 'vod_actor' => '周迅,胡歌']),
    5 => auditVideo('回填剧集 第一季'), 6 => auditVideo('回填剧集 第二季'),
], static function () use (&$backfillCalls) {
    $backfillCalls++;
    throw new RuntimeException('Assessment backfill cannot call AI');
});
$backfillRun = $backfillAudit->start(false)['active_run_id'];
auditFinish($backfillAudit, 20);
$backfillRows = $backfillDb->query('SELECT * FROM mac_vodmerge_audit_issue ORDER BY issue_id')->fetchAll(PDO::FETCH_ASSOC);
$oldEvidence = [];
$priorAi = ['status' => 'ok', 'model' => 'saved-fixture-review', 'reviewed_at' => time(),
    'judgment' => auditReviewResult(1)['answers'][1]];
foreach ($backfillRows as $index => $row) {
    $detail = json_decode($row['detail_json'], true);
    unset($detail['rule_assessment']);
    if ($index === 0) {
        $detail['ai_review'] = $priorAi;
    }
    $oldEvidence[$row['issue_id']] = $detail;
    $backfillDb->prepare("UPDATE mac_vodmerge_audit_issue SET detail_json=?,assessment='unrated',priority=0,assessment_version=0 WHERE issue_id=?")
        ->execute([Payload::json($detail), $row['issue_id']]);
}
$backfillDb->exec("UPDATE mac_vod SET vod_name='当前资料已经修正' WHERE vod_id=1");
$beforeBackfill = auditScanSnapshot($backfillDb);
$batch = $backfillAudit->assessBatch(2);
auditCheck($batch['processed'] === 2 && $batch['remaining'] === 1, 'A bounded assessment batch classifies only the requested number of existing issues and reports remaining work');
$batch = $backfillAudit->assessBatch(2);
auditCheck($batch['processed'] === 1 && $batch['remaining'] === 0, 'A later assessment batch continues through only the remaining unclassified issues');
$afterBackfill = $backfillDb->query('SELECT * FROM mac_vodmerge_audit_issue ORDER BY issue_id')->fetchAll(PDO::FETCH_ASSOC);
foreach ($afterBackfill as $row) {
    $detail = json_decode($row['detail_json'], true);
    $old = $oldEvidence[$row['issue_id']];
    auditCheck($row['assessment_version'] == AuditMatch::VERSION && $detail['rule_assessment']['level'] === $row['assessment'], 'Each successful backfill persists one current-version quality assessment');
    auditCheck($detail['left'] === $old['left'] && $detail['right'] === $old['right'] && $detail['matched_keys'] === $old['matched_keys'] && $detail['conflicts'] === $old['conflicts'], 'Quality backfill preserves the exact historical metadata, matched keys and conflict evidence');
    if (isset($old['ai_review'])) {
        auditCheck($detail['ai_review'] === $priorAi && $row['assessment'] === 'high', 'Backfill preserves saved AI probabilities and classifies historical scan metadata despite current-film edits');
    }
}
auditCheck($beforeBackfill === auditScanSnapshot($backfillDb) && $backfillCalls === 0, 'Backfill writes only issue classification; films, scan state, run counts, lookup keys and AI calls remain unchanged');
$noWork = $backfillAudit->assessBatch(2);
auditCheck($noWork['processed'] === 0 && $noWork['remaining'] === 0 && $afterBackfill === $backfillDb->query('SELECT * FROM mac_vodmerge_audit_issue ORDER BY issue_id')->fetchAll(PDO::FETCH_ASSOC), 'Repeated backfill is idempotent and does not recompute completed-version issues');
$casRow = $afterBackfill[0];
$casDetail = json_decode($casRow['detail_json'], true);
unset($casDetail['rule_assessment']);
$backfillDb->prepare("UPDATE mac_vodmerge_audit_issue SET detail_json=?,assessment='unrated',priority=0,assessment_version=0 WHERE issue_id=?")
    ->execute([Payload::json($casDetail), $casRow['issue_id']]);
$casDetail['ai_review']['model'] = 'concurrent-successful-review';
$casJson = Payload::json($casDetail);
$backfillDb->setAttribute(PDO::ATTR_STATEMENT_CLASS, [AuditConcurrentStatement::class, []]);
$GLOBALS['audit_assessment_before_update'] = static function () use ($backfillDb, $casJson, $casRow) {
    $backfillDb->prepare('UPDATE mac_vodmerge_audit_issue SET detail_json=? WHERE issue_id=?')->execute([$casJson, $casRow['issue_id']]);
};
$casBatch = $backfillAudit->assessBatch(1);
auditCheck($casBatch['processed'] === 0 && $casBatch['remaining'] === 1 && $casBatch['skipped'] === 1, 'A concurrent evidence change causes a skipped CAS update rather than a false completed classification');
$casSaved = $backfillDb->query('SELECT * FROM mac_vodmerge_audit_issue WHERE issue_id=' . $casRow['issue_id'])->fetch(PDO::FETCH_ASSOC);
auditCheck($casSaved['detail_json'] === $casJson && $casSaved['assessment_version'] == 0 && $casSaved['assessment'] === 'unrated', 'A competing successful AI review survives the quality backfill compare-and-swap boundary intact');
auditCheck(!isset($GLOBALS['audit_assessment_before_update']), 'The fixture injects the competing review after the backfill selects its snapshot and before its actual update executes');
$casRetry = $backfillAudit->assessBatch(1);
$casRetried = json_decode($backfillDb->query('SELECT detail_json FROM mac_vodmerge_audit_issue WHERE issue_id=' . $casRow['issue_id'])->fetchColumn(), true);
auditCheck($casRetry['processed'] === 1 && $casRetry['remaining'] === 0 && $casRetried['ai_review']['model'] === 'concurrent-successful-review', 'A later bounded retry incorporates the new saved evidence without losing its successful AI review');
auditCheck($beforeBackfill === auditScanSnapshot($backfillDb) && $backfillCalls === 0, 'Concurrent-safe classification and retry never write video or scan state or invoke AI');

foreach ($backfillDb->query('SELECT issue_id,detail_json FROM mac_vodmerge_audit_issue ORDER BY issue_id')->fetchAll(PDO::FETCH_ASSOC) as $row) {
    $detail = json_decode($row['detail_json'], true);
    unset($detail['rule_assessment']);
    $backfillDb->prepare("UPDATE mac_vodmerge_audit_issue SET detail_json=?,assessment='unrated',priority=0,assessment_version=0 WHERE issue_id=?")
        ->execute([Payload::json($detail), $row['issue_id']]);
}
$beforeFailedAssessment = $backfillDb->query('SELECT * FROM mac_vodmerge_audit_issue ORDER BY issue_id')->fetchAll(PDO::FETCH_ASSOC);
$observedPartialAssessment = 0;
$GLOBALS['audit_assessment_before_update'] = static function () use ($backfillDb, &$observedPartialAssessment) {
    $GLOBALS['audit_assessment_before_update'] = static function () use ($backfillDb, &$observedPartialAssessment) {
        $observedPartialAssessment = (int) $backfillDb->query('SELECT COUNT(*) FROM mac_vodmerge_audit_issue WHERE assessment_version=1')->fetchColumn();
    };
};
$backfillDb->exec('CREATE TRIGGER audit_assessment_batch_failure BEFORE UPDATE OF assessment_version ON mac_vodmerge_audit_issue WHEN OLD.issue_id=' . $beforeFailedAssessment[1]['issue_id'] . " BEGIN SELECT RAISE(ABORT,'fixture classification batch error'); END");
try {
    $backfillAudit->assessBatch(3);
    throw new RuntimeException('A mid-batch classification database failure was swallowed');
} catch (PDOException $error) {
    auditCheck(strpos($error->getMessage(), 'fixture classification batch error') !== false, 'The second classification update produces the fixture database failure for atomicity testing');
}
auditCheck($observedPartialAssessment === 1 && !isset($GLOBALS['audit_assessment_before_update']), 'The database failure occurs only after the first issue classification has already been written within the batch');
auditCheck(!$backfillDb->inTransaction() && $beforeFailedAssessment === $backfillDb->query('SELECT * FROM mac_vodmerge_audit_issue ORDER BY issue_id')->fetchAll(PDO::FETCH_ASSOC), 'A second-update failure rolls back the first issue classification and closes the failed transaction without losing any saved AI evidence');
auditCheck($beforeBackfill === auditScanSnapshot($backfillDb) && $backfillCalls === 0, 'A failed classification batch changes no films, scan state, counts, lookup keys or AI calls');
$backfillDb->exec('DROP TRIGGER audit_assessment_batch_failure');
$resumedAssessment = $backfillAudit->assessBatch(3);
$resumedDetail = json_decode($backfillDb->query('SELECT detail_json FROM mac_vodmerge_audit_issue WHERE issue_id=' . $casRow['issue_id'])->fetchColumn(), true);
auditCheck($resumedAssessment['processed'] === 3 && $resumedAssessment['remaining'] === 0 && $resumedAssessment['skipped'] === 0 && $resumedDetail['ai_review']['model'] === 'concurrent-successful-review', 'After removing a batch database failure, all rolled-back issues resume successfully with saved AI evidence intact');
auditCheck(!$backfillDb->inTransaction() && $beforeBackfill === auditScanSnapshot($backfillDb) && $backfillCalls === 0, 'Successful classification retry commits only issue evidence and leaves no open transaction or source-data side effects');

$priorityVideos = [];
foreach (range(1, 51) as $id) {
    $priorityVideos[$id] = auditVideo('共同系列 第' . ($id + 10) . '季');
}
$priorityVideos[80] = auditVideo('另一个可靠片名', ['vod_douban_id' => 555]);
$priorityVideos[81] = auditVideo('共同系列第2季');
$priorityVideos[100] = auditVideo('共同系列 第二季', ['vod_douban_id' => 555]);
[$priorityDb, $priorityAudit] = auditFixture($priorityVideos);
$priorityRun = $priorityAudit->start(false)['active_run_id'];
$prioritySummary = auditFinish($priorityAudit, 20);
$priorityItems = auditAllIssues($priorityAudit, $priorityRun);
auditCheck($prioritySummary['latest_run']['truncated_count'] > 0, 'Weak shared season stems can saturate a bounded candidate lookup');
auditCheck(auditPair($priorityItems, 80, 100) !== null && auditPair($priorityItems, 81, 100) !== null, 'Higher-ID reliable Douban and full-title matches survive more than fifty lower-ID weak season-stem matches');

[$spaceDb, $spaceAudit] = auditFixture([1 => auditVideo('容量恢复测试'), 2 => auditVideo('容量恢复测试')]);
$spaceRun = $spaceAudit->start(false)['active_run_id'];
$GLOBALS['audit_disk_free'] = 1073741823;
$spacePaused = $spaceAudit->tick(1);
auditCheck($spacePaused['active_run_id'] === $spaceRun && $spacePaused['run']['status'] === 'error', 'Insufficient free space pauses the same durable active run');
auditCheck($spacePaused['run']['processed_count'] === 0 && $spacePaused['run']['cursor_id'] === 0 && $spacePaused['watermark'] === 0 && $spacePaused['last_completed_at'] === 0, 'The free-space guard cannot advance processed work, cursor, or successful watermark');
auditCheck((int) $spaceDb->query('SELECT COUNT(*) FROM mac_vodmerge_audit_key')->fetchColumn() === 0 && $spaceAudit->issues($spaceRun)['items'] === [], 'An insufficient-space batch writes no lookup keys or issue evidence');
auditCheck($spacePaused['run']['error_message'] === '服务器可用空间不足 1 GB，排查已暂停；此前进度保留，请清理空间后重试。', 'The capacity pause exposes a fixed actionable message without raw exception details');
$GLOBALS['audit_disk_free'] = 1073741824;
$spaceRestored = $spaceAudit->tick(1);
auditCheck($spaceRestored['active_run_id'] === $spaceRun && $spaceRestored['run']['status'] === 'running' && $spaceRestored['run']['processed_count'] === 1, 'The exact one-GiB boundary permits the paused run to resume');
$spaceComplete = auditFinish(new LibraryAudit($spaceDb, 'mac_'), 20);
auditCheck($spaceComplete['latest_run']['run_id'] === $spaceRun && $spaceComplete['watermark'] === 2 && count(auditAllIssues($spaceAudit, $spaceRun)) === 1, 'Capacity recovery completes the same run and records its pair exactly once');
$GLOBALS['audit_disk_free'] = false;
[$unknownSpaceDb, $unknownSpaceAudit] = auditFixture([1 => auditVideo('容量读取不可用')]);
$unknownSpaceAudit->start(false);
$unknownSpace = $unknownSpaceAudit->tick(20);
auditCheck($unknownSpace['active_run_id'] === 0 && $unknownSpace['watermark'] === 1, 'Unavailable disk information is not interpreted as zero free space');
unset($GLOBALS['audit_disk_free']);

$reviewCalls = [];
$reviewChoice = 'same';
[$reviewDb, $reviewAudit] = auditFixture([
    1 => auditVideo('按需复核', ['vod_content' => 'private-full-description']),
    2 => auditVideo('按需复核'), 3 => auditVideo('其它候选作品'),
], static function ($incoming, $candidates) use (&$reviewCalls, &$reviewChoice) {
    $reviewCalls[] = [$incoming, $candidates];
    return auditReviewResult((int) $candidates[0]['vod_id'], $reviewChoice);
});
$reviewRun = $reviewAudit->start()['active_run_id'];
auditFinish($reviewAudit, 2);
$reviewIssue = auditPair(auditAllIssues($reviewAudit, $reviewRun), 1, 2);
$reviewId = $reviewIssue['issue_id'];
$reviewAudit->summary();
auditCheck($reviewCalls === [] && !isset($reviewIssue['detail']['ai_review']), 'Scanning and result reads never call the AI reviewer or manufacture probabilities');
$beforeReview = auditScanSnapshot($reviewDb);
$reviewed = $reviewAudit->reviewIssue($reviewId);
$ai = $reviewed['detail']['ai_review'];
auditCheck(count($reviewCalls) === 1 && count($reviewCalls[0][1]) === 1, 'An explicit review calls the reviewer once with only the selected counterpart');
auditCheck((int) $reviewCalls[0][0]['vod_id'] === 2 && (int) $reviewCalls[0][1][0]['vod_id'] === 1, 'AI review compares only the selected incoming video and its older counterpart');
$identityFields = explode(',', 'vod_id,vod_name,vod_sub,vod_en,vod_year,vod_area,vod_lang,vod_actor,vod_director,vod_class,vod_version,vod_douban_id,type_id');
sort($identityFields);
foreach ([$reviewCalls[0][0], $reviewCalls[0][1][0]] as $metadata) {
    $fields = array_keys($metadata);
    sort($fields);
    auditCheck($fields === $identityFields, 'The reviewer receives only the thirteen identity fields, excluding descriptions and playback data');
}
auditCheck($ai['status'] === 'ok' && $ai['model'] === 'jev-fixture' && $ai['judgment'] === auditReviewResult(1)['answers'][1], 'A successful review exposes the actual choice, probability distribution, confidence and model');
auditCheck($ai['reviewed_at'] >= $startedBefore && $ai['reviewed_at'] <= time() && $ai['elapsed_ms'] >= 0 && strlen($ai['request_hash']) === 64 && !$ai['stale'] && !$ai['reused'], 'Review evidence records time, duration, request identity and fresh result state');
auditCheck($reviewed['kind'] === $reviewIssue['kind'] && $reviewed['detail']['matched_keys'] === $reviewIssue['detail']['matched_keys'] && $reviewed['detail']['conflicts'] === $reviewIssue['detail']['conflicts'], 'AI probabilities do not rewrite the rule classification or original matching evidence');
auditCheck($beforeReview === auditScanSnapshot($reviewDb), 'A review writes no source video, scan cursor, run counts, schedule or lookup index');
$persisted = json_decode($reviewDb->query('SELECT detail_json FROM mac_vodmerge_audit_issue WHERE issue_id=' . $reviewId)->fetchColumn(), true);
auditCheck($persisted['ai_review']['judgment'] === $ai['judgment'], 'Successful probabilities persist with their issue for later result reads');
$cached = $reviewAudit->reviewIssue($reviewId);
auditCheck(count($reviewCalls) === 1 && $cached['detail']['ai_review']['reused'], 'An unchanged review within ten minutes reuses its saved probabilities without another AI call');
$reviewChoice = 'different';
$forced = $reviewAudit->reviewIssue($reviewId, true);
auditCheck(count($reviewCalls) === 2 && !$forced['detail']['ai_review']['reused'] && $forced['detail']['ai_review']['judgment']['choice'] === 'different', 'A forced review obtains a new valid different judgment even while the prior review is cached');
auditCheck($forced['kind'] === $reviewIssue['kind'] && $forced['detail']['matched_keys'] === $reviewIssue['detail']['matched_keys'], 'A different AI judgment does not override the rule classification or original match evidence');
$expiredDetail = json_decode($reviewDb->query('SELECT detail_json FROM mac_vodmerge_audit_issue WHERE issue_id=' . $reviewId)->fetchColumn(), true);
$expiredDetail['ai_review']['reviewed_at'] = time() - 601;
$reviewDb->prepare('UPDATE mac_vodmerge_audit_issue SET detail_json=? WHERE issue_id=?')->execute([Payload::json($expiredDetail), $reviewId]);
$reviewChoice = 'uncertain';
$expired = $reviewAudit->reviewIssue($reviewId);
auditCheck(count($reviewCalls) === 3 && $expired['detail']['ai_review']['judgment']['choice'] === 'uncertain' && !$expired['detail']['ai_review']['reused'], 'An expired ten-minute review is refreshed and can record an uncertain judgment');
$reviewDb->exec("UPDATE mac_vod SET vod_year='2025' WHERE vod_id=1");
$stale = auditPair($reviewAudit->issues($reviewRun)['items'], 1, 2);
auditCheck($stale['detail']['ai_review']['stale'] && count($reviewCalls) === 3, 'Identity changes mark saved AI evidence stale without issuing AI calls during list reads');
$liveSource = auditScanSnapshot($reviewDb);
$refreshed = $reviewAudit->reviewIssue($reviewId);
auditCheck(count($reviewCalls) === 4 && !$refreshed['detail']['ai_review']['stale'] && !$refreshed['detail']['ai_review']['reused'], 'Reviewing a stale issue obtains current identity metadata despite an unexpired prior result');
auditCheck($refreshed['detail']['ai_review']['left']['vod_year'] === '2025' && $refreshed['detail']['ai_review']['right']['vod_year'] === '2026', 'Saved review evidence identifies the actual current left and right metadata used by the model');
auditCheck($refreshed['detail']['left']['vod_year'] === '2026' && $liveSource === auditScanSnapshot($reviewDb), 'Refreshing AI evidence preserves historical rule metadata and does not change the current library or scan state');
$reviewDb->exec("UPDATE mac_vod SET vod_play_url='changed-private-playback',vod_content='changed-private-description' WHERE vod_id=2");
$noIdentityChange = $reviewAudit->reviewIssue($reviewId);
auditCheck(count($reviewCalls) === 4 && $noIdentityChange['detail']['ai_review']['reused'], 'Playback or description changes are not part of the identity request and do not cause an AI call');

$numericCalls = 0;
$numericAudit = new LibraryAudit($reviewDb, 'mac_', static function ($incoming, $candidates) use (&$numericCalls) {
    $numericCalls++;
    $result = auditReviewResult((int) $candidates[0]['vod_id']);
    $result['answers'][(int) $candidates[0]['vod_id']]['probabilities'] = ['same' => '0.9', 'different' => '0.05', 'uncertain' => '0.05'];
    return $result;
});
$numericReview = $numericAudit->reviewIssue($reviewId, true);
$floatProbabilities = ['same' => 0.9, 'different' => 0.05, 'uncertain' => 0.05];
auditCheck($numericReview['detail']['ai_review']['judgment']['probabilities'] === $floatProbabilities, 'Valid numeric-string model probabilities are normalized to floats in the review API response');
$legacyDetail = json_decode($reviewDb->query('SELECT detail_json FROM mac_vodmerge_audit_issue WHERE issue_id=' . $reviewId)->fetchColumn(), true);
$legacyDetail['ai_review']['judgment']['probabilities'] = ['same' => '0.9', 'different' => '0.05', 'uncertain' => '0.05'];
$legacyJson = Payload::json($legacyDetail);
$reviewDb->prepare('UPDATE mac_vodmerge_audit_issue SET detail_json=? WHERE issue_id=?')->execute([$legacyJson, $reviewId]);
$legacyListed = auditPair($numericAudit->issues($reviewRun)['items'], 1, 2);
auditCheck($legacyListed['detail']['ai_review']['judgment']['probabilities'] === $floatProbabilities, 'Saved numeric-string probabilities are normalized to floats when listing earlier reviews');
$legacyCached = $numericAudit->reviewIssue($reviewId);
auditCheck($legacyCached['detail']['ai_review']['judgment']['probabilities'] === $floatProbabilities && $legacyCached['detail']['ai_review']['reused'] && $numericCalls === 1, 'Cached earlier reviews return normalized float probabilities without calling the model again');
auditCheck($reviewDb->query('SELECT detail_json FROM mac_vodmerge_audit_issue WHERE issue_id=' . $reviewId)->fetchColumn() === $legacyJson, 'Normalizing earlier review responses does not mutate saved scan evidence during reads');

$savedReview = $reviewDb->query('SELECT detail_json FROM mac_vodmerge_audit_issue WHERE issue_id=' . $reviewId)->fetchColumn();
foreach ([['status' => 'unavailable'], ['status' => 'failed', 'http_status' => 429], ['status' => 'invalid'],
    ['status' => 'ok', 'model' => 'jev-fixture', 'answers' => []],
    ['status' => 'ok', 'model' => 'jev-fixture', 'answers' => [1 => ['choice' => 'same', 'confidence' => 0.8, 'probabilities' => ['same' => 0.4, 'different' => 0.5, 'uncertain' => 0.1]]]],
    ['status' => 'ok', 'model' => 'jev-fixture', 'answers' => [1 => ['choice' => 'same', 'confidence' => 1.1, 'probabilities' => ['same' => 0.9, 'different' => 0.05, 'uncertain' => 0.05]]]],
    ['status' => 'ok', 'model' => 'jev-fixture', 'answers' => [1 => ['choice' => 'same', 'confidence' => 0.8, 'probabilities' => ['same' => 0.9, 'different' => 0.2, 'uncertain' => 0.05]]]],
] as $invalidResult) {
    $invalidAudit = new LibraryAudit($reviewDb, 'mac_', static function ($incoming, $candidates) use ($invalidResult) {
        if (isset($invalidResult['answers'][1])) {
            $invalidResult['answers'] = [(int) $candidates[0]['vod_id'] => $invalidResult['answers'][1]];
        }
        return $invalidResult;
    });
    auditReviewReject(static function () use ($invalidAudit, $reviewId) { $invalidAudit->reviewIssue($reviewId, true); }, 'Unavailable, failed, missing or inconsistent model evidence must reject review');
    auditCheck($reviewDb->query('SELECT detail_json FROM mac_vodmerge_audit_issue WHERE issue_id=' . $reviewId)->fetchColumn() === $savedReview, 'A failed review never replaces the previous successful saved probabilities');
}
$throwingAudit = new LibraryAudit($reviewDb, 'mac_', static function () {
    throw new RuntimeException('private-transport-error https://never-display.example/?token=secret');
});
try {
    $throwingAudit->reviewIssue($reviewId, true);
    throw new LogicException('An unexpected reviewer exception must reject the review');
} catch (RuntimeException $error) {
    auditCheck(strpos($error->getMessage(), 'private-transport') === false && strpos($error->getMessage(), 'never-display') === false, 'Unexpected reviewer errors expose an actionable fixed message rather than raw transport details');
}
auditCheck($reviewDb->query('SELECT detail_json FROM mac_vodmerge_audit_issue WHERE issue_id=' . $reviewId)->fetchColumn() === $savedReview, 'A thrown reviewer exception preserves previously saved successful probabilities');

$changingAudit = new LibraryAudit($reviewDb, 'mac_', static function ($incoming, $candidates) use ($reviewDb) {
    $reviewDb->exec("UPDATE mac_vod SET vod_name='复核期间身份变化' WHERE vod_id=2");
    return auditReviewResult((int) $candidates[0]['vod_id']);
});
auditReviewReject(static function () use ($changingAudit, $reviewId) { $changingAudit->reviewIssue($reviewId, true); }, 'An identity change while the model runs rejects stale probabilities before saving');
auditCheck($reviewDb->query('SELECT detail_json FROM mac_vodmerge_audit_issue WHERE issue_id=' . $reviewId)->fetchColumn() === $savedReview, 'An identity change during review keeps the preceding successful evidence intact');
$concurrentSaved = $savedReview;
$concurrentAudit = new LibraryAudit($reviewDb, 'mac_', static function ($incoming, $candidates) use ($reviewDb, $reviewId, &$concurrentSaved) {
    $detail = json_decode($reviewDb->query('SELECT detail_json FROM mac_vodmerge_audit_issue WHERE issue_id=' . $reviewId)->fetchColumn(), true);
    $detail['ai_review']['reviewed_at'] += 1;
    $detail['ai_review']['model'] = 'other-successful-review';
    $concurrentSaved = Payload::json($detail);
    $reviewDb->prepare('UPDATE mac_vodmerge_audit_issue SET detail_json=? WHERE issue_id=?')->execute([$concurrentSaved, $reviewId]);
    return auditReviewResult((int) $candidates[0]['vod_id']);
});
auditReviewReject(static function () use ($concurrentAudit, $reviewId) { $concurrentAudit->reviewIssue($reviewId, true); }, 'A competing saved review is detected rather than overwritten by the slower request');
auditCheck($reviewDb->query('SELECT detail_json FROM mac_vodmerge_audit_issue WHERE issue_id=' . $reviewId)->fetchColumn() === $concurrentSaved, 'Compare-and-swap preserves evidence saved by a concurrent review');
$deletingAudit = new LibraryAudit($reviewDb, 'mac_', static function ($incoming, $candidates) use ($reviewDb) {
    $reviewDb->exec('DELETE FROM mac_vod WHERE vod_id=2');
    return auditReviewResult((int) $candidates[0]['vod_id']);
});
auditReviewReject(static function () use ($deletingAudit, $reviewId) { $deletingAudit->reviewIssue($reviewId, true); }, 'A video deleted while the model runs prevents saving obsolete review probabilities');
auditCheck($reviewDb->query('SELECT detail_json FROM mac_vodmerge_audit_issue WHERE issue_id=' . $reviewId)->fetchColumn() === $concurrentSaved, 'Deletion during review preserves the previous successful evidence');
$beforeDeletedCalls = count($reviewCalls);
auditCheck(auditPair($reviewAudit->issues($reviewRun)['items'], 1, 2)['detail']['ai_review']['stale'], 'Deleting a video makes its saved AI evidence stale');
auditReviewReject(static function () use ($reviewAudit, $reviewId) { $reviewAudit->reviewIssue($reviewId, true); }, 'A deleted source record cannot be reviewed using old snapshots');
auditReviewReject(static function () use ($reviewAudit) { $reviewAudit->reviewIssue(999999); }, 'An unknown issue cannot call the AI reviewer');
auditCheck(count($reviewCalls) === $beforeDeletedCalls, 'Missing source videos or issues are rejected before any model call');

echo "VodMerge library audit: $auditChecks checks passed\n";
}
