<?php

require __DIR__ . '/vodmerge-library-merge.test.php';

use addons\vodmerge\service\Workbench;
use addons\vodmerge\service\Payload;

$workbenchChecks = 0;
function workbenchCheck($condition, string $message): void
{
    global $workbenchChecks;
    $workbenchChecks++;
    if (!$condition) {
        throw new RuntimeException($message);
    }
}
function workbenchFixture(): array
{
    [$db, $service] = libraryFixture();
    $db->exec("ALTER TABLE mac_vodmerge_audit_issue ADD COLUMN assessment TEXT DEFAULT 'high'");
    $db->exec('ALTER TABLE mac_vodmerge_audit_issue ADD COLUMN priority INTEGER DEFAULT 4');
    $db->exec("CREATE TABLE mac_vodmerge_case (left_id INTEGER,right_id INTEGER,issue_id INTEGER,assessment TEXT,priority INTEGER,discovered_at INTEGER,search_text TEXT,decision TEXT DEFAULT 'pending',identity_signature TEXT DEFAULT '',resource_signature TEXT DEFAULT '',resolution TEXT DEFAULT '',reason TEXT DEFAULT '',actor_id INTEGER DEFAULT 0,reviewed_at INTEGER DEFAULT 0,snoozed_until INTEGER DEFAULT 0,job_id INTEGER DEFAULT 0,PRIMARY KEY(left_id,right_id))");
    $db->exec('CREATE TABLE mac_vodmerge_event (event_id INTEGER PRIMARY KEY AUTOINCREMENT,left_id INTEGER,right_id INTEGER,kind TEXT,actor_id INTEGER,job_id INTEGER,detail_json TEXT,event_key TEXT UNIQUE,created_at INTEGER)');
    $w = new Workbench($db, 'mac_', $service);
    $w->importIssues();
    return [$db, $service, $w];
}

[$db, $service, $w] = workbenchFixture();
$before = $db->query('SELECT * FROM mac_vod ORDER BY vod_id')->fetchAll(PDO::FETCH_ASSOC);
workbenchCheck($w->cases()['total'] === 2, 'Only valid canonical candidate pairs are imported');
$d = $w->detail(1);
workbenchCheck($d['queue'] === 'pending' && !$d['missing'] && $d['job'] === null, 'A new review is pending without creating a resource task');
workbenchCheck($d['left_lines'][0]['count'] === 2 && $d['right_lines'][0]['names'] === ['第01集', '第02集'], 'Safe resource summaries retain episode labels');
workbenchCheck(strpos(Payload::json($d), '.example/') === false && strpos(Payload::json($d), 'private-play-password') === false, 'Review detail contains neither playback addresses nor access secrets');
libraryReject(function () use ($w) { $w->resourceAction(1, 'merge_preview', 1, 100); }, 'Preview requires an explicit current human same-film decision');
libraryReject(function () use ($w) { $w->decide(1, 'same', str_repeat('a', 64), '', 1); }, 'A stale or forged review fingerprint cannot be saved');
$d = $w->decide(1, 'different', $d['fingerprint'], '年份已核对，属于不同作品', 1);
workbenchCheck($w->cases()['total'] === 1 && $w->cases('', 'different')['total'] === 1, 'A different-film conclusion is persisted and leaves pending');
workbenchCheck($w->detail(1)['decision'] === 'different', 'A fresh read preserves the decision');
$db->exec("INSERT INTO mac_vodmerge_audit_issue (issue_id,run_id,left_id,right_id,kind,detail_json,created_at,assessment,priority) VALUES (9,2,100,200,'possible_duplicate','{}',2000,'high',4)");
$w->importIssues();
workbenchCheck($w->detail(1)['issue_id'] === 9 && $w->cases('', 'different')['total'] === 1 && $w->cases()['total'] === 1, 'New scan discoveries reuse decisions and preserve other older-run pending work');
libraryEdit($db, 100, 'vod_year', '2027');
workbenchCheck($w->cases()['total'] === 2 && !$w->detail(9)['identity_fresh'], 'Changed identity reopens an archived pair without deleting history');
libraryEdit($db, 100, 'vod_year', '2026');
$d = $w->detail(9);
$d = $w->decide(9, 'needs_info', $d['fingerprint'], '请补充版本', 1);
workbenchCheck($w->cases('', 'needs_info')['total'] === 1, 'Needs-information decisions have their own persisted queue');
$d = $w->decide(9, 'restore', $d['fingerprint'], '', 1);
workbenchCheck($d['decision'] === 'pending', 'Restore reopens a needs-information item');
$d = $w->decide(9, 'snooze', $d['fingerprint'], '', 1);
workbenchCheck($w->cases('', 'snoozed')['total'] === 1 && $w->cases()['total'] === 1, 'Snoozing hides only this pair until its reminder time');
$db->exec('UPDATE mac_vodmerge_case SET snoozed_until=1 WHERE right_id=200');
workbenchCheck($w->cases()['total'] === 2, 'Expired snoozes return without a worker or page mutation');
$d = $w->decide(9, 'same', $d['fingerprint'], '', 1);
workbenchCheck($d['decision'] === 'same' && $d['queue'] === 'pending', 'Saving same-film without preview remains pending across navigation');
workbenchCheck($db->query('SELECT * FROM mac_vod ORDER BY vod_id')->fetchAll(PDO::FETCH_ASSOC) === $before, 'Review decisions and reads never modify videos');
$d = $w->resourceAction(9, 'merge_preview', 1, 100);
$job = $d['job'];
workbenchCheck($job['plan']['line_changes'][1]['entries'][0] === ['name' => '第01集', 'action' => 'added'], 'Preview exposes per-entry action without its address');
workbenchCheck($db->query('SELECT * FROM mac_vod ORDER BY vod_id')->fetchAll(PDO::FETCH_ASSOC) === $before, 'A preview only saves a plugin task');
$eventsBeforeApply = $w->history()['total'];
$d = $w->resourceAction(9, 'merge_apply', 1, 0, false, $job['job_id'], $job['preview_token']);
workbenchCheck($d['queue'] === 'done' && $w->cases('', 'done')['total'] === 1, 'Explicit fixture confirmation archives the completed resource operation');
$after = libraryRow($db, 100);
$w->resourceAction(9, 'merge_apply', 1, 0, false, $job['job_id'], $job['preview_token']);
workbenchCheck(libraryRow($db, 100) === $after && $w->history()['total'] === $eventsBeforeApply + 1, 'Repeated confirmation changes neither resources nor event count');
libraryReject(function () use ($w, $d) { $w->decide(9, 'different', $d['fingerprint'], '', 1); }, 'A different-film decision cannot silently contradict applied resources');
libraryEdit($db, 200, 'vod_play_url', libraryRow($db, 200)['vod_play_url'] . '#第03集$https://source.example/3');
workbenchCheck($w->detail(9)['queue'] === 'pending' && $w->detail(9)['identity_fresh'], 'Resource changes reopen work while retaining the same-film identity conclusion');
$w->resourceAction(9, 'merge_apply', 1, 0, false, $job['job_id'], $job['preview_token']);
workbenchCheck($w->detail(9)['queue'] === 'pending', 'An idempotent old confirmation cannot certify newer unprocessed resources');
$d = $w->resourceAction(9, 'merge_preview', 1, 100);
workbenchCheck($d['job']['job_id'] !== $job['job_id'] && $d['job']['plan']['added_episodes'] === 1, 'A new resource update receives its own guarded incremental preview');
$newJob = $d['job'];
libraryEdit($db, 200, 'vod_actor', '已修改演员');
libraryReject(function () use ($w, $newJob) { $w->resourceAction(9, 'merge_apply', 1, 0, false, $newJob['job_id'], $newJob['preview_token']); }, 'Changed identity prevents confirmation of an older preview');
workbenchCheck($w->history()['items'][0]['actor_id'] == 1 && count($w->history()['jobs']) === 2, 'History distinguishes identity events from actual resource jobs');

[$db, $service, $w] = workbenchFixture();
$d = $w->decide(1, 'same', $w->detail(1)['fingerprint'], '', 1);
$d = $w->resourceAction(1, 'merge_preview', 1, 100);
$job = $d['job'];
$w->resourceAction(1, 'merge_apply', 1, 0, false, $job['job_id'], $job['preview_token']);
$w->resourceAction(1, 'merge_rollback', 1, 0, false, $job['job_id']);
workbenchCheck($w->detail(1)['queue'] === 'pending' && $w->detail(1)['job']['status'] === 'rolled_back', 'Rollback preserves history and returns the pair to work');
workbenchCheck(libraryRow($db, 100)['vod_play_url'] === libraryVideo('target')['vod_play_url'], 'Rollback restores the isolated target original playlist');

[$db, $service, $w] = workbenchFixture();
$job = $service->libraryPreview(1, 100)['job'];
$service->libraryApply(1, $job['job_id'], $job['preview_token'], 1);
$w->importJobs();
workbenchCheck($w->detail(1)['queue'] === 'done' && $w->detail(1)['decision'] === 'pending' && $w->history()['total'] === 0, 'Legacy applied jobs are shown truthfully without fabricating human decision events');
$db->exec("INSERT INTO mac_vodmerge_audit_issue (issue_id,run_id,left_id,right_id,kind,detail_json,created_at) VALUES (10,2,100,200,'possible_duplicate','{}',2000)");
$w->importIssues();
workbenchCheck($service->libraryStatus(10)['job']['job_id'] === $job['job_id'] && $w->detail(10)['queue'] === 'done', 'Resource history is associated across scan rounds');
libraryReject(function () use ($service, $job) { $service->libraryApply(2, $job['job_id'], $job['preview_token'], 1); }, 'Cross-round support still rejects a task from another film pair');

[$db, $service, $w] = workbenchFixture();
for ($i = 400; $i < 440; $i++) {
    $row = libraryRow($db, 200);
    $row['vod_id'] = $i;
    $row['vod_name'] = '搜索影片' . $i;
    $row['vod_sub'] = $i === 400 ? '跨页别名' : '';
    $db->prepare('INSERT INTO mac_vod (`' . implode('`,`', array_keys($row)) . '`) VALUES (' . implode(',', array_fill(0, count($row), '?')) . ')')->execute(array_values($row));
    $db->prepare("INSERT INTO mac_vodmerge_audit_issue (issue_id,run_id,left_id,right_id,kind,detail_json,created_at) VALUES (?,3,100,?,'possible_duplicate','{}',2000)")->execute([$i, $i]);
}
$w->importIssues();
workbenchCheck(count($w->cases()['items']) === 30 && $w->cases()['has_more'], 'Whole-queue search has bounded server pagination');
workbenchCheck($w->cases('跨页别名')['total'] === 1 && $w->cases('400')['items'][0]['right_id'] == 400, 'Search finds an alias and exact ID outside the currently loaded page');
workbenchCheck($w->cases('%')['total'] === 0 && $w->cases("' OR 1=1 --")['total'] === 0, 'Wildcard and SQL-like search text is literal and parameterized');
$db->exec('DELETE FROM mac_vod WHERE vod_id=400');
workbenchCheck($w->detail(400)['missing'] && $w->cases('400')['total'] === 0 && $w->cases('400', 'all')['total'] === 1, 'Missing records remain in history but leave actionable pending work');
workbenchCheck($GLOBALS['library_judge_calls'] === 0, 'No rule, review decision, preview or history operation calls the model');

[$db, $service, $w] = workbenchFixture();
libraryEdit($db, 200, 'vod_play_url', libraryRow($db, 100)['vod_play_url']);
$d = $w->decide(1, 'same', $w->detail(1)['fingerprint'], '', 1);
$d = $w->resourceAction(1, 'merge_preview', 1, 100);
$job = $d['job'];
workbenchCheck($job['plan']['added_groups'] === 0 && $job['plan']['skipped_entries'] === 2, 'An entirely repeated source reports skipped entries and no writes');
$unchanged = $db->query('SELECT * FROM mac_vod ORDER BY vod_id')->fetchAll(PDO::FETCH_ASSOC);
$d = $w->resourceAction(1, 'no_change', 1, 0, false, $job['job_id'], $job['preview_token']);
workbenchCheck($d['queue'] === 'done' && $d['job']['status'] === 'review', 'No-change review archives without applying a resource task');
workbenchCheck($db->query('SELECT * FROM mac_vod ORDER BY vod_id')->fetchAll(PDO::FETCH_ASSOC) === $unchanged, 'No-change acknowledgement preserves every video column');

[$db, $service, $w] = workbenchFixture();
$d = $w->decide(1, 'same', $w->detail(1)['fingerprint'], '', 1);
$d = $w->resourceAction(1, 'merge_preview', 1, 100);
$job = $d['job'];
$db->exec('UPDATE mac_vodmerge_job SET preview_until=1');
libraryReject(function () use ($w, $job) { $w->resourceAction(1, 'merge_apply', 1, 0, false, $job['job_id'], $job['preview_token']); }, 'An expired preview cannot be confirmed');
workbenchCheck(libraryRow($db, 100)['vod_play_url'] === libraryVideo('target')['vod_play_url'], 'Expired confirmation performs no target write');
$d = $w->resourceAction(1, 'merge_preview', 1, 100);
$job = $d['job'];
$db->exec("CREATE TRIGGER event_failure BEFORE INSERT ON mac_vodmerge_event WHEN NEW.kind='merge_apply' BEGIN SELECT RAISE(ABORT,'fixture event failure'); END");
libraryReject(function () use ($w, $job) { $w->resourceAction(1, 'merge_apply', 1, 0, false, $job['job_id'], $job['preview_token']); }, 'A bookkeeping failure is reported after the actual fixture write');
workbenchCheck($w->detail(1)['queue'] === 'done' && $w->detail(1)['job']['status'] === 'applied', 'State is recovered from the guarded preview expectation and live job even if final event recording fails');
$db->exec('DROP TRIGGER event_failure');
libraryEdit($db, 100, 'vod_play_url', libraryRow($db, 100)['vod_play_url'] . '#第09集$https://later.example/9');
libraryReject(function () use ($w, $job) { $w->resourceAction(1, 'merge_rollback', 1, 0, false, $job['job_id']); }, 'Rollback cannot overwrite subsequent changes');
workbenchCheck(strpos(libraryRow($db, 100)['vod_play_url'], 'later.example') !== false, 'Blocked rollback leaves subsequent resources intact');

[$db, $service, $w] = workbenchFixture();
$db->exec('DELETE FROM mac_vodmerge_audit_issue');
$db->exec('DELETE FROM mac_vodmerge_case');
$db->exec('CREATE TABLE mac_vodmerge_audit_state (state_id INTEGER PRIMARY KEY,weekly_enabled INTEGER DEFAULT 0,watermark INTEGER DEFAULT 0,last_completed_at INTEGER DEFAULT 0,next_run_at INTEGER DEFAULT 0,active_run_id INTEGER DEFAULT 0)');
$db->exec('INSERT INTO mac_vodmerge_audit_state (state_id) VALUES (1)');
$db->exec("CREATE TABLE mac_vodmerge_audit_run (run_id INTEGER PRIMARY KEY AUTOINCREMENT,status TEXT,mode TEXT,lower_id INTEGER,upper_id INTEGER,cursor_id INTEGER,total_count INTEGER,processed_count INTEGER DEFAULT 0,issue_count INTEGER DEFAULT 0,truncated_count INTEGER DEFAULT 0,started_at INTEGER,updated_at INTEGER,finished_at INTEGER DEFAULT 0,error_message TEXT DEFAULT '')");
$db->exec('CREATE TABLE mac_vodmerge_audit_key (key_hash TEXT,vod_id INTEGER,PRIMARY KEY(key_hash,vod_id))');
$db->exec('ALTER TABLE mac_vodmerge_audit_issue ADD COLUMN assessment_version INTEGER DEFAULT 0');
$audit = new \addons\vodmerge\service\LibraryAudit($db, 'mac_', null, [$w, 'discover']);
$audit->start(false);
for ($tick = 0; $tick < 10; $tick++) {
    if (!$audit->tick(2)['active_run_id']) {
        break;
    }
}
workbenchCheck((int) $db->query('SELECT COUNT(*) FROM mac_vodmerge_case')->fetchColumn() === 3, 'Real audit discoveries populate the cross-run workbench in the same database');
$case = $db->query('SELECT * FROM mac_vodmerge_case LIMIT 1')->fetch(PDO::FETCH_ASSOC);
$d = $w->detail((int) $case['issue_id']);
$w->decide((int) $case['issue_id'], 'different', $d['fingerprint'], '隔离结论', 1);
$w->discover((int) $case['issue_id'] + 100, (int) $case['left_id'], (int) $case['right_id'], 'probable', 3, time());
workbenchCheck($db->query('SELECT decision FROM mac_vodmerge_case WHERE left_id=' . $case['left_id'] . ' AND right_id=' . $case['right_id'])->fetchColumn() === 'different', 'A newly discovered issue updates evidence without overwriting the persisted decision');
for ($i = 0; $i < 35; $i++) {
    $service->submit(['source' => 'collector', 'source_id' => (string) $i, 'video' => libraryVideo('collector', ['vod_name' => '采集样本' . $i, 'vod_sub' => $i === 0 ? '跨页采集别名' : ''])]);
}
workbenchCheck(count($service->jobs()) === 30 && count($service->jobs(0, '跨页采集别名')) === 1, 'Collection alias search covers tasks outside the loaded page');
workbenchCheck($service->jobs(0, '%') === [] && $service->jobs(0, '', 'done') === [], 'Collection wildcard search is literal and status filtering is server-side');
[$db, $service, $w] = workbenchFixture();
libraryEdit($db, 100, 'vod_name', '变更后的当前片名');
$d = $w->detail(1);
workbenchCheck($d['left']['vod_name'] === '变更后的当前片名', 'Review detail reads the live identity even when the discovery name index is older');
$w->decide(1, 'same', $d['fingerprint'], '', 1);
$w->importIssues();
workbenchCheck($w->cases('变更后的当前片名')['total'] === 1, 'Human review refreshes that pair name index and a repeated import cannot revert it');
$insert = $db->prepare("INSERT INTO mac_vodmerge_case (left_id,right_id,issue_id,assessment,priority,discovered_at,search_text) VALUES (1,?,?,'high',4,1,'宽泛匹配词')");
$db->beginTransaction();
for ($i = 1000; $i < 6001; $i++) {
    $insert->execute([$i, $i + 10000]);
}
$db->commit();
try {
    $w->cases('宽泛匹配词');
    throw new RuntimeException('An over-broad search was silently truncated');
} catch (InvalidArgumentException $error) {
    workbenchCheck(strpos($error->getMessage(), '5000') !== false, 'Over-broad search explicitly asks for a narrower name instead of showing an incomplete result');
}
echo "VodMerge workbench: $workbenchChecks checks passed\n";
