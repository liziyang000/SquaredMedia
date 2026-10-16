<?php

require dirname(__DIR__) . '/addons/vodmerge/bootstrap.php';

use addons\vodmerge\service\Payload;
use addons\vodmerge\service\Playlist;
use addons\vodmerge\service\Service;

$libraryChecks = 0;
function libraryCheck($condition, string $message): void
{
    global $libraryChecks;
    $libraryChecks++;
    if (!$condition) {
        throw new RuntimeException($message);
    }
}
function libraryReject(callable $action, string $message): void
{
    try {
        $action();
    } catch (RuntimeException | InvalidArgumentException $error) {
        libraryCheck($error->getMessage() !== '', $message);
        return;
    }
    throw new RuntimeException($message);
}
function libraryVideo(string $provider, array $fields = []): array
{
    return array_merge([
        'vod_name' => '人工合并示例 第一季', 'vod_year' => '2026', 'vod_version' => 'TV版', 'type_id' => 2,
        'vod_douban_id' => 10001, 'vod_actor' => '演员甲', 'vod_director' => '导演乙',
        'vod_play_from' => 'hls', 'vod_play_server' => 'no', 'vod_play_note' => '',
        'vod_play_url' => '第01集$https://' . $provider . '.example/1#第02集$https://' . $provider . '.example/2',
    ], $fields);
}
function libraryRow(PDO $db, int $id): array
{
    return $db->query('SELECT * FROM mac_vod WHERE vod_id=' . $id)->fetch(PDO::FETCH_ASSOC);
}
function libraryJob(PDO $db, int $id): array
{
    return $db->query('SELECT * FROM mac_vodmerge_job WHERE job_id=' . $id)->fetch(PDO::FETCH_ASSOC);
}
function libraryEdit(PDO $db, int $id, string $field, $value): void
{
    $db->prepare('UPDATE mac_vod SET `' . $field . '`=? WHERE vod_id=?')->execute([$value, $id]);
}
function libraryFixture(array $source = [], array $target = []): array
{
    $db = new PDO('sqlite::memory:');
    $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $db->exec("CREATE TABLE mac_vodmerge_job (job_id INTEGER PRIMARY KEY AUTOINCREMENT, source_key TEXT, source_id TEXT, payload_hash TEXT, video_json TEXT, status TEXT DEFAULT 'pending', review_json TEXT, plan_json TEXT, creation_json TEXT, preview_token TEXT DEFAULT '', preview_until INTEGER DEFAULT 0, vod_id INTEGER DEFAULT 0, operator_id INTEGER DEFAULT 0, message TEXT DEFAULT '', created_at INTEGER, updated_at INTEGER, UNIQUE(source_key,source_id,payload_hash))");
    $db->exec('CREATE TABLE mac_vodmerge_binding (source_key TEXT, source_id TEXT, vod_id INTEGER, routes_json TEXT, identity_json TEXT, last_job_id INTEGER, PRIMARY KEY(source_key,source_id))');
    $db->exec('CREATE TABLE mac_vodmerge_audit_issue (issue_id INTEGER PRIMARY KEY, run_id INTEGER NOT NULL, left_id INTEGER NOT NULL, right_id INTEGER NOT NULL, kind TEXT NOT NULL, detail_json TEXT NOT NULL, created_at INTEGER NOT NULL, UNIQUE(run_id,left_id,right_id))');
    $columns = ['vod_id INTEGER PRIMARY KEY AUTOINCREMENT'];
    foreach (array_merge(array_keys(Payload::TEXT_FIELDS), Playlist::FIELDS, ['vod_down_url', 'vod_plot_name', 'vod_plot_detail', 'vod_pwd', 'vod_pwd_play', 'vod_pwd_down']) as $field) {
        $columns[] = $field . " TEXT NOT NULL DEFAULT ''";
    }
    foreach (['type_id', 'type_id_1', 'vod_douban_id', 'vod_lock', 'vod_time', 'vod_time_add', 'vod_status', 'vod_hits', 'vod_level', 'vod_points', 'vod_points_play', 'vod_points_down', 'vod_trysee'] as $field) {
        $columns[] = $field . ' INTEGER NOT NULL DEFAULT 0';
    }
    $db->exec('CREATE TABLE mac_vod (' . implode(',', $columns) . ')');
    foreach ([100 => libraryVideo('target', $target), 200 => libraryVideo('source', $source), 300 => libraryVideo('third')] as $id => $video) {
        $row = array_merge(Payload::envelope(['source' => 'fixture', 'source_id' => (string) $id, 'video' => libraryVideo('fixture')])['video'], $video, [
            'vod_id' => $id, 'vod_time' => 1234, 'vod_time_add' => 1000, 'vod_status' => 1,
            'vod_hits' => $id, 'vod_pwd_play' => 'private-play-password',
        ], array_intersect_key($video, array_flip(['vod_lock', 'vod_status', 'vod_level', 'vod_points', 'vod_points_play', 'vod_points_down', 'vod_trysee', 'vod_pwd', 'vod_pwd_play', 'vod_pwd_down'])));
        $db->prepare('INSERT INTO mac_vod (`' . implode('`,`', array_keys($row)) . '`) VALUES (' . implode(',', array_fill(0, count($row), '?')) . ')')->execute(array_values($row));
    }
    $db->exec("INSERT INTO mac_vodmerge_audit_issue VALUES (1,1,100,200,'possible_duplicate','{}',1000),(2,1,100,300,'possible_duplicate','{}',1000),(3,1,100,100,'possible_duplicate','{}',1000)");
    $judge = static function () {
        $GLOBALS['library_judge_calls']++;
        throw new RuntimeException('A manual merge must not call AI');
    };
    return [$db, new Service($db, 'mac_', ['hls' => []], $judge)];
}
function libraryUnchanged(PDO $db, array $source, array $target): void
{
    libraryCheck(libraryRow($db, 200) === $source && libraryRow($db, 100) === $target, 'An unsuccessful or read-only operation preserves both complete video rows');
}

$GLOBALS['library_judge_calls'] = 0;
[$db, $service] = libraryFixture();
$source = libraryRow($db, 200);
$target = libraryRow($db, 100);
$issues = $db->query('SELECT * FROM mac_vodmerge_audit_issue ORDER BY issue_id')->fetchAll(PDO::FETCH_ASSOC);
libraryCheck($service->libraryStatus(1) === ['issue_id' => 1, 'job' => null], 'A pair without manual history has no merge task');
libraryCheck((int) $db->query('SELECT COUNT(*) FROM mac_vodmerge_job')->fetchColumn() === 0, 'Reading merge status cannot create a task');
$preview = $service->libraryPreview(1, 100);
$job = $preview['job'];
$jobId = (int) $job['job_id'];
libraryCheck($preview['issue_id'] === 1 && $job['status'] === 'ready' && $job['library']['source_vod_id'] === 200 && $job['library']['target_vod_id'] === 100, 'A preview explicitly records which existing ID will receive the other video routes');
libraryCheck($job['library']['source_metadata']['vod_name'] === $source['vod_name'] && $job['library']['target_metadata']['vod_name'] === $target['vod_name'], 'The review shows safe current identity metadata for both videos');
libraryCheck($job['plan']['mode'] === 'merge' && $job['plan']['added_groups'] === 1 && $job['plan']['added_episodes'] === 2, 'A different provider appends its own route and two episodes');
$changes = $job['plan']['line_changes'];
libraryCheck(count($changes) === 2 && $changes[0]['slot'] === 0 && $changes[0]['before_episodes'] === 2 && $changes[0]['after_episodes'] === 2 && $changes[0]['added_episodes'] === 0 && !$changes[0]['is_new'], 'The existing route is shown with unchanged episode count');
libraryCheck($changes[1]['slot'] === 1 && $changes[1]['player'] === 'hls' && $changes[1]['before_episodes'] === 0 && $changes[1]['after_episodes'] === 2 && $changes[1]['added_episodes'] === 2 && $changes[1]['is_new'], 'The new route is shown with before/after counts and player');
libraryCheck($job['actions']['apply'] && !$job['actions']['create'] && !$job['actions']['review'] && !$job['actions']['requeue'], 'A library task exposes manual confirmation without collection or creation actions');
libraryCheck($job['preview_until'] >= time() + 590 && $job['preview_until'] <= time() + 600, 'The confirmation expires after ten minutes');
libraryCheck(strpos(Payload::json($preview), '.example/') === false && strpos(Payload::json($preview), 'private-play-password') === false, 'Library API responses disclose no playback URLs or permission secrets');
libraryUnchanged($db, $source, $target);
libraryCheck($service->jobs() === [], 'Library history does not appear among collection tasks');
libraryReject(static function () use ($service, $jobId) { $service->libraryApply(2, $jobId, str_repeat('a', 64), 1); }, 'A task cannot be applied under another issue');
libraryReject(static function () use ($service, $jobId) { $service->libraryApply(1, $jobId, str_repeat('a', 64), 1); }, 'A forged confirmation token is rejected');
libraryUnchanged($db, $source, $target);
$applied = $service->libraryApply(1, $jobId, $job['preview_token'], 1);
$after = libraryRow($db, 100);
libraryCheck($applied['job']['status'] === 'applied' && $applied['job']['actions']['rollback'], 'Confirmation writes the target and exposes rollback');
libraryCheck($after['vod_play_from'] === 'hls$$$hls' && strpos($after['vod_play_url'], $target['vod_play_url'] . '$$$' . $source['vod_play_url']) === 0, 'Target route order and existing episode labels remain intact');
$preserved = array_diff_key($target, array_flip(array_merge(Playlist::FIELDS, ['vod_time'])));
libraryCheck(array_intersect_key($after, $preserved) === $preserved && libraryRow($db, 200) === $source, 'Apply changes only target playback fields/time and preserves the source, identity, counters and access policy');
libraryCheck((int) $db->query('SELECT COUNT(*) FROM mac_vod')->fetchColumn() === 3 && $db->query('SELECT * FROM mac_vodmerge_audit_issue ORDER BY issue_id')->fetchAll(PDO::FETCH_ASSOC) === $issues, 'A merge never inserts/deletes videos or edits scan results');
$service->libraryApply(1, $jobId, $job['preview_token'], 1);
libraryCheck(libraryRow($db, 100) === $after, 'Repeated confirmation cannot append routes twice');
$rolledBack = $service->libraryRollback(1, $jobId, 1);
libraryCheck($rolledBack['job']['status'] === 'rolled_back', 'Rollback persists the manual audit history');
libraryUnchanged($db, $source, $target);
$again = $service->libraryPreview(1, 100);
libraryCheck($again['job']['job_id'] !== $jobId && $again['job']['status'] === 'ready', 'A pair may be previewed again after a deliberate rollback, with a new task');
libraryReject(static function () use ($service, $jobId) { $service->libraryApply(1, $jobId, '', 1); }, 'The rolled-back task cannot be applied again');

[$db, $service] = libraryFixture();
$source = libraryRow($db, 200);
$target = libraryRow($db, 100);
$reverse = $service->libraryPreview(1, 200);
libraryCheck($reverse['job']['library']['source_vod_id'] === 100 && $reverse['job']['library']['target_vod_id'] === 200, 'Either member can be selected as the retained target');
$service->libraryApply(1, $reverse['job']['job_id'], $reverse['job']['preview_token'], 1);
libraryCheck(libraryRow($db, 100) === $target && libraryRow($db, 200)['vod_play_from'] === 'hls$$$hls', 'Reverse selection modifies only the explicitly chosen target');

// A previously merged video may itself contain independent routes using the same player.
$multiSource = libraryVideo('source');
$multiSource['vod_play_from'] = 'hls$$$hls';
$multiSource['vod_play_server'] = 'no$$$no';
$multiSource['vod_play_note'] = '$$$';
$multiSource['vod_play_url'] .= '$$$' . libraryVideo('second')['vod_play_url'];
[$db, $service] = libraryFixture($multiSource);
$source = libraryRow($db, 200);
$target = libraryRow($db, 100);
$preview = $service->libraryPreview(1, 100)['job'];
libraryCheck($preview['plan']['added_groups'] === 2 && $preview['plan']['added_episodes'] === 4 && count($preview['plan']['line_changes']) === 3, 'All independent source routes contribute to the per-line preview, even when player codes repeat');
$service->libraryApply(1, $preview['job_id'], $preview['preview_token'], 1);
libraryCheck(libraryRow($db, 100)['vod_play_url'] === $target['vod_play_url'] . '$$$' . $source['vod_play_url'] && libraryRow($db, 200) === $source, 'A multi-route source never loses a provider group during merge');
$service->libraryRollback(1, $preview['job_id'], 1);
libraryUnchanged($db, $source, $target);
libraryReject(static function () use ($multiSource) { Payload::envelope(['source' => 'external', 'source_id' => '1', 'video' => $multiSource]); }, 'External collection payloads continue to reject repeated player codes');

foreach ([[99, 100], [1, 0], [1, 300], [3, 100]] as $case) {
    [$db, $service] = libraryFixture();
    $before = [$source = libraryRow($db, 200), $target = libraryRow($db, 100)];
    libraryReject(static function () use ($service, $case) { $service->libraryPreview($case[0], $case[1]); }, 'Unknown issues, creation, third targets and self-merges are forbidden');
    libraryUnchanged($db, $before[0], $before[1]);
}
[$db, $service] = libraryFixture();
$external = $service->submit(['source' => 'external', 'source_id' => '1', 'video' => libraryVideo('external')]);
libraryReject(static function () use ($service, $external) { $service->libraryApply(1, $external['job_id'], '', 1); }, 'An external collection task cannot impersonate a library merge');
libraryReject(static function () use ($service) { $service->submit(['source' => 'vodmerge-library', 'source_id' => '200', 'video' => libraryVideo('external')]); }, 'The signed external intake cannot reserve the internal source identity');

foreach ([['vod_year' => '2025'], ['vod_name' => '人工合并示例 第二季'], ['type_id' => 3], ['vod_douban_id' => 999], ['vod_version' => '导演剪辑版'], ['vod_play_from' => 'missing'], ['vod_play_url' => 'broken'], ['vod_lock' => 1]] as $sourceFields) {
    [$db, $service] = libraryFixture($sourceFields);
    $source = libraryRow($db, 200);
    $target = libraryRow($db, 100);
    libraryReject(static function () use ($service) { $service->libraryPreview(1, 100); }, 'A conflicting, unplayable or locked source cannot be merged: ' . Payload::json($sourceFields));
    libraryUnchanged($db, $source, $target);
}
foreach (['vod_level', 'vod_points', 'vod_points_play', 'vod_points_down', 'vod_trysee', 'vod_pwd', 'vod_pwd_play', 'vod_pwd_down'] as $field) {
    [$db, $service] = libraryFixture([$field => strpos($field, 'pwd') !== false ? 'different-password' : 1]);
    libraryReject(static function () use ($service) { $service->libraryPreview(1, 100); }, 'Different source/target access policies cannot be bypassed: ' . $field);
}
[$db, $service] = libraryFixture([], ['vod_lock' => 1]);
libraryReject(static function () use ($service) { $service->libraryPreview(1, 100); }, 'A locked target cannot be merged');
[$db, $service] = libraryFixture([], ['vod_play_from' => 'missing']);
libraryReject(static function () use ($service) { $service->libraryPreview(1, 100); }, 'An unknown existing target player cannot silently survive a new merge');
[$db, $service] = libraryFixture(['vod_status' => 0]);
$source = libraryRow($db, 200);
$target = libraryRow($db, 100);
libraryReject(static function () use ($service) { $service->libraryPreview(1, 100); }, 'An unapproved source cannot publish its routes through an approved target');
libraryUnchanged($db, $source, $target);

foreach ([100, 200] as $changedId) {
    foreach (['vod_name' => '并发修改 第一季', 'vod_play_url' => '正片$https://manual.example/edit', 'vod_lock' => 1, 'vod_status' => 0, 'vod_points_play' => 5, 'vod_pwd_play' => 'changed-private-password'] as $field => $value) {
        [$db, $service] = libraryFixture();
        $preview = $service->libraryPreview(1, 100)['job'];
        libraryEdit($db, $changedId, $field, $value);
        $source = libraryRow($db, 200);
        $target = libraryRow($db, 100);
        libraryReject(static function () use ($service, $preview) { $service->libraryApply(1, $preview['job_id'], $preview['preview_token'], 1); }, 'Confirmation rechecks both live rows and permissions: ' . $changedId . '/' . $field);
        libraryUnchanged($db, $source, $target);
    }
}
[$db, $service] = libraryFixture();
$old = $service->libraryPreview(1, 100)['job'];
$fresh = $service->libraryPreview(1, 200)['job'];
libraryReject(static function () use ($service, $old) { $service->libraryApply(1, $old['job_id'], $old['preview_token'], 1); }, 'Changing the retained target invalidates the prior confirmation');
libraryCheck($fresh['library']['target_vod_id'] === 200, 'The replacement preview records the new direction');
[$db, $service] = libraryFixture();
$old = $service->libraryPreview(1, 100)['job'];
libraryEdit($db, 200, 'vod_year', '2025');
libraryReject(static function () use ($service) { $service->libraryPreview(1, 100); }, 'A failed replacement preview cannot retain a ready task');
libraryEdit($db, 200, 'vod_year', '2026');
libraryReject(static function () use ($service, $old) { $service->libraryApply(1, $old['job_id'], $old['preview_token'], 1); }, 'A prior token remains invalid after a failed replacement preview even when the source is restored');
[$db, $service] = libraryFixture();
$preview = $service->libraryPreview(1, 100)['job'];
$db->exec('UPDATE mac_vodmerge_job SET preview_until=' . (time() - 1) . ' WHERE job_id=' . $preview['job_id']);
libraryReject(static function () use ($service, $preview) { $service->libraryApply(1, $preview['job_id'], $preview['preview_token'], 1); }, 'Expired previews cannot be confirmed');
$source = libraryRow($db, 200);
$target = libraryRow($db, 100);
$serviceWithoutPlayers = new Service($db, 'mac_', []);
$preview = $service->libraryPreview(1, 100)['job'];
libraryReject(static function () use ($serviceWithoutPlayers, $preview) { $serviceWithoutPlayers->libraryApply(1, $preview['job_id'], $preview['preview_token'], 1); }, 'Removing the player after preview prevents confirmation');
libraryUnchanged($db, $source, $target);

[$db, $service] = libraryFixture();
$preview = $service->libraryPreview(1, 100)['job'];
$id = $preview['job_id'];
$db->exec("UPDATE mac_vodmerge_job SET status='review' WHERE job_id=$id");
$beforeJob = libraryJob($db, $id);
foreach (['review', 'requeue', 'reject'] as $method) {
    libraryReject(static function () use ($service, $method, $id) { $service->$method($id); }, 'Generic collection actions cannot erase or reinterpret a library task: ' . $method);
    libraryCheck(libraryJob($db, $id) === $beforeJob, 'A rejected generic action preserves the internal source and pair marker');
}
foreach (['preview', 'apply', 'rollback', 'recover'] as $method) {
    $arguments = ['preview' => [$id, 100], 'apply' => [$id, $preview['preview_token'], 1], 'rollback' => [$id, 1], 'recover' => [$id]][$method];
    libraryReject(static function () use ($service, $method, $arguments) { $service->$method(...$arguments); }, 'Generic collection write routes cannot bypass the selected library pair: ' . $method);
    libraryCheck(libraryJob($db, $id) === $beforeJob, 'A rejected generic write cannot alter library history');
}
$db->exec("UPDATE mac_vodmerge_job SET status='pending' WHERE job_id=$id");
$beforeJob = libraryJob($db, $id);
libraryCheck($service->run(10, true, true) === [] && libraryJob($db, $id) === $beforeJob, 'Even all automation flags enabled cannot process a library merge');
libraryCheck($GLOBALS['library_judge_calls'] === 0, 'Manual merge and its worker exclusion make no AI calls');

foreach ([100, 200] as $blockedId) {
    [$db, $service] = libraryFixture();
    $external = $service->submit(['source' => 'unfinished', 'source_id' => '1', 'video' => libraryVideo('unfinished')]);
    $db->exec("UPDATE mac_vodmerge_job SET status='applying',vod_id=$blockedId WHERE job_id=" . $external['job_id']);
    libraryReject(static function () use ($service) { $service->libraryPreview(1, 100); }, 'Unfinished writers to either source or target must be recovered before preview');
}
foreach ([100, 200] as $blockedId) {
    [$db, $service] = libraryFixture();
    $preview = $service->libraryPreview(1, 100)['job'];
    $external = $service->submit(['source' => 'unfinished', 'source_id' => '1', 'video' => libraryVideo('unfinished')]);
    $db->exec("UPDATE mac_vodmerge_job SET status='applying',vod_id=$blockedId WHERE job_id=" . $external['job_id']);
    $source = libraryRow($db, 200);
    $target = libraryRow($db, 100);
    libraryReject(static function () use ($service, $preview) { $service->libraryApply(1, $preview['job_id'], $preview['preview_token'], 1); }, 'An unfinished writer appearing after preview blocks confirmation on either video');
    libraryUnchanged($db, $source, $target);
}

[$db, $service] = libraryFixture();
$preview = $service->libraryPreview(1, 100)['job'];
$id = $preview['job_id'];
$db->exec("UPDATE mac_vodmerge_job SET status='applying' WHERE job_id=$id");
$source = libraryRow($db, 200);
$target = libraryRow($db, 100);
$serviceWithoutPlayers = new Service($db, 'mac_', []);
libraryReject(static function () use ($serviceWithoutPlayers, $id) { $serviceWithoutPlayers->libraryRecover(1, $id); }, 'Recovery that still needs to write cannot use a player removed after preview');
libraryUnchanged($db, $source, $target);

foreach (['before', 'after'] as $crashPoint) {
    [$db, $service] = libraryFixture();
    $source = libraryRow($db, 200);
    $target = libraryRow($db, 100);
    $preview = $service->libraryPreview(1, 100)['job'];
    $id = $preview['job_id'];
    if ($crashPoint === 'before') {
        $db->exec("CREATE TRIGGER fail_library_write BEFORE UPDATE ON mac_vod WHEN OLD.vod_id=100 BEGIN SELECT RAISE(ABORT,'simulated write failure'); END");
    } else {
        $db->exec("CREATE TRIGGER fail_library_write BEFORE UPDATE ON mac_vodmerge_job WHEN NEW.status='applied' AND NEW.job_id=$id BEGIN SELECT RAISE(ABORT,'simulated finish failure'); END");
    }
    libraryReject(static function () use ($service, $preview) { $service->libraryApply(1, $preview['job_id'], $preview['preview_token'], 1); }, 'A simulated interruption leaves a recoverable write intent: ' . $crashPoint);
    libraryCheck(libraryJob($db, $id)['status'] === 'applying' && libraryRow($db, 200) === $source, 'Durable intent survives failure without writing the source');
    $db->exec('DROP TRIGGER fail_library_write');
    $recovered = $service->libraryRecover(1, $id);
    libraryCheck($recovered['job']['status'] === 'applied' && substr_count(libraryRow($db, 100)['vod_play_url'], 'source.example/1') === 1, 'Recovery recognizes exact before/after snapshots without duplicate routes: ' . $crashPoint);
    $service->libraryRollback(1, $id, 1);
    libraryUnchanged($db, $source, $target);
}
[$db, $service] = libraryFixture();
$preview = $service->libraryPreview(1, 100)['job'];
$id = $preview['job_id'];
$db->exec("UPDATE mac_vodmerge_job SET status='applying' WHERE job_id=$id");
libraryEdit($db, 100, 'vod_play_url', '正片$https://manual.example/outside-both-snapshots');
$edited = libraryRow($db, 100);
libraryReject(static function () use ($service, $id) { $service->libraryRecover(1, $id); }, 'Recovery never overwrites a target outside both recorded snapshots');
libraryCheck(libraryRow($db, 100) === $edited, 'Failed recovery preserves the concurrent edit');

foreach (['before', 'after'] as $crashPoint) {
    [$db, $service] = libraryFixture();
    $source = libraryRow($db, 200);
    $target = libraryRow($db, 100);
    $preview = $service->libraryPreview(1, 100)['job'];
    $id = $preview['job_id'];
    $service->libraryApply(1, $id, $preview['preview_token'], 1);
    if ($crashPoint === 'before') {
        $db->exec("CREATE TRIGGER fail_library_rollback BEFORE UPDATE ON mac_vod WHEN OLD.vod_id=100 BEGIN SELECT RAISE(ABORT,'simulated rollback write failure'); END");
    } else {
        $db->exec("CREATE TRIGGER fail_library_rollback BEFORE UPDATE ON mac_vodmerge_job WHEN NEW.status='rolled_back' AND NEW.job_id=$id BEGIN SELECT RAISE(ABORT,'simulated rollback finish failure'); END");
    }
    libraryReject(static function () use ($service, $id) { $service->libraryRollback(1, $id, 1); }, 'A simulated rollback interruption preserves its durable intent: ' . $crashPoint);
    libraryCheck(libraryJob($db, $id)['status'] === 'rolling_back', 'An unfinished rollback exposes recoverable history');
    $db->exec('DROP TRIGGER fail_library_rollback');
    $result = $service->libraryRecover(1, $id);
    libraryCheck($result['job']['status'] === 'rolled_back', 'Recovery completes an interrupted rollback from an exact snapshot: ' . $crashPoint);
    libraryUnchanged($db, $source, $target);
    $service->libraryRollback(1, $id, 1);
    libraryUnchanged($db, $source, $target);
}

[$db, $service] = libraryFixture();
$preview = $service->libraryPreview(1, 100)['job'];
$id = $preview['job_id'];
$service->libraryApply(1, $id, $preview['preview_token'], 1);
libraryEdit($db, 100, 'vod_pwd_play', 'later-permission-edit');
$edited = libraryRow($db, 100);
libraryReject(static function () use ($service, $id) { $service->libraryRollback(1, $id, 1); }, 'Rollback cannot overwrite later access-policy changes');
libraryCheck(libraryRow($db, 100) === $edited, 'An unavailable rollback preserves the later access policy');
[$db, $service] = libraryFixture();
$preview = $service->libraryPreview(1, 100)['job'];
$id = $preview['job_id'];
$service->libraryApply(1, $id, $preview['preview_token'], 1);
$binding = $db->query("SELECT * FROM mac_vodmerge_binding WHERE source_key='vodmerge-library'")->fetch(PDO::FETCH_ASSOC);
$routes = json_decode($binding['routes_json'], true);
$db->prepare('INSERT INTO mac_vodmerge_binding VALUES (?,?,?,?,?,?)')->execute(['dependent-source', '1', 100, Payload::json($routes), '{}', 999]);
$after = libraryRow($db, 100);
libraryReject(static function () use ($service, $id) { $service->libraryRollback(1, $id, 1); }, 'Rollback protects routes already used by another source binding');
libraryCheck(libraryRow($db, 100) === $after, 'A blocked dependent rollback never removes shared routes');

libraryCheck($GLOBALS['library_judge_calls'] === 0, 'All deterministic library merge regressions run without model calls');
echo "VodMerge library merge: $libraryChecks checks passed\n";
