<?php

require dirname(__DIR__) . '/addons/vodmerge/bootstrap.php';

use addons\vodmerge\service\Jev;
use addons\vodmerge\service\Payload;
use addons\vodmerge\service\Playlist;
use addons\vodmerge\service\Service;

$checks = 0;
function check($condition, string $message): void
{
    global $checks;
    $checks++;
    if (!$condition) {
        throw new RuntimeException($message);
    }
}
function fails(callable $action, string $message): void
{
    try {
        $action();
    } catch (Throwable $error) {
        check(true, $message);
        return;
    }
    check(false, $message);
}
function video(string $name = '示例剧 第一季', string $url = '第01集$https://b.example/1.m3u8#第02集$https://b.example/2.m3u8'): array
{
    return ['vod_name' => $name, 'vod_year' => '2026', 'type_id' => 2, 'vod_douban_id' => 10001,
        'vod_play_from' => 'hls', 'vod_play_url' => $url, 'vod_play_server' => 'no', 'vod_play_note' => ''];
}
function envelope(array $video, string $source = 'provider-b', string $id = '501'): array
{
    return ['source' => $source, 'source_id' => $id, 'video' => $video];
}
function seed(PDO $db, int $id, array $video): void
{
    $row = array_merge(Payload::envelope(envelope($video))['video'], [
        'vod_id' => $id, 'vod_lock' => 0, 'vod_time' => 1234, 'vod_time_add' => 1000, 'vod_status' => 1,
        'vod_hits' => 999, 'vod_pwd_play' => 'protected', 'type_id_1' => 0,
    ]);
    $fields = array_keys($row);
    $sql = 'INSERT INTO mac_vod (`' . implode('`,`', $fields) . '`) VALUES (' . implode(',', array_fill(0, count($fields), '?')) . ')';
    $db->prepare($sql)->execute(array_values($row));
}
function stored(PDO $db, int $id): array
{
    return $db->query('SELECT * FROM mac_vod WHERE vod_id=' . $id)->fetch(PDO::FETCH_ASSOC);
}
function ready(Service $service, array $input, int $target): array
{
    $job = $service->submit($input);
    return $service->preview((int) $job['job_id'], $target);
}

$body = Payload::json(envelope(video()));
$timestamp = '1800000000';
$secret = str_repeat('s', 32);
$signature = hash_hmac('sha256', $timestamp . "\n" . $body, $secret);
check(Payload::authenticate($body, $timestamp, $signature, $secret, (int) $timestamp), 'Valid intake signature');
check(!Payload::authenticate($body . ' ', $timestamp, $signature, $secret, (int) $timestamp), 'Body tampering must fail');
check(!Payload::authenticate($body, $timestamp, $signature, $secret, (int) $timestamp + 301), 'Expired replay must fail');
check(!Payload::authenticate($body, $timestamp, $signature, '', (int) $timestamp), 'Unconfigured API must stay closed');
check(!Payload::authenticate(str_repeat('x', Payload::MAX_BYTES + 1), $timestamp, $signature, $secret, (int) $timestamp), 'Oversized request rejected');
fails(static function () { Payload::envelope(['source' => '../bad', 'source_id' => '1', 'video' => video()]); }, 'Invalid source rejected');
fails(static function () { Payload::envelope(envelope(array_merge(video(), ['type_id' => []]))); }, 'Array ID rejected');
fails(static function () { Payload::envelope(envelope(array_merge(video(), ['vod_pic' => 'javascript:alert(1)']))); }, 'Unsafe poster scheme rejected');
fails(static function () { Payload::envelope(envelope(array_merge(video(), ['vod_pic' => 'https://img.example/' . str_repeat('a', 250)]))); }, 'Poster must fit native short field');
fails(static function () { Playlist::groups(video('X', '第一集$javascript:alert(1)'), true); }, 'Unsafe playback scheme rejected');
fails(static function () { Playlist::groups(video('X', '第一集$https://b.example/1?token=a$b'), true); }, 'Literal dollar delimiter in URLs must not be truncated by MacCMS');
fails(static function () { Playlist::groups(video('X', '第一集" onclick="x$https://b.example/1'), true); }, 'Episode labels cannot escape native HTML attributes');
fails(static function () { Playlist::groups(array_merge(video(), ['vod_play_from' => 'hls$$$hls']), true); }, 'Malformed group alignment rejected');
fails(static function () { Playlist::groups(array_merge(video(), ['vod_play_note' => '<img onerror=alert(1)>']), true); }, 'Untrusted route markup rejected');
fails(static function () { Playlist::groups(video('X', '第1集$https://b.example/1#EP01$https://b.example/other'), true); }, 'Conflicting duplicate episode rejected');
check(Payload::season('X 第十二季') === '12', 'Chinese season parsing');
check(Payload::season('X S02') === '2', 'English season parsing');
check(in_array('季数冲突', Payload::conflicts(video(), video('示例剧 第二季')), true), 'Different seasons must not merge');
check(Payload::conflicts(video(), array_merge(video(), ['vod_douban_id' => 20000])) !== [], 'Trusted ID conflict must not merge');

$first = Playlist::merge([], video());
$next = Playlist::merge($first['fields'], video('示例剧 第一季', 'EP01$https://b.example/1.m3u8#第02集$https://b.example/2.m3u8#第03集$https://b.example/3.m3u8'), $first['routes']);
check($next['added_episodes'] === 1 && $next['added_groups'] === 0, 'Append only one new episode, preserve old labels');
check(strpos($next['fields']['vod_play_url'], '第01集$') === 0, 'Existing episode order/labels preserved');
check(Playlist::merge($next['fields'], video('示例剧 第一季', $next['fields']['vod_play_url']), $next['routes'])['added_episodes'] === 0, 'Repeated merge idempotent');
$differentSource = Playlist::merge($first['fields'], video('示例剧 第一季', '第01集$https://c.example/1'));
check($differentSource['fields']['vod_play_from'] === 'hls$$$hls', 'Providers sharing a player retain separate groups');
check(Playlist::merge([], video('X', '第01集$https://c.example/1#EP01$https://c.example/1'))['added_episodes'] === 1, 'Incoming duplicate URLs removed');
$full = Playlist::merge([], video('X', implode('#', array_map(static function ($i) { return $i . '$https://b.example/' . $i; }, range(1, 5000)))));
fails(static function () use ($full) { Playlist::merge($full['fields'], video('X', '5001$https://b.example/5001'), $full['routes']); }, 'Merged route must respect the episode count limit too');
fails(static function () use ($first) {
    Playlist::merge($first['fields'], video('示例剧 第一季', '第1集$https://b.example/1.m3u8?token=new'), $first['routes']);
}, 'Signed URL change must be treated as conflict, never silently overwritten');
fails(static function () use ($first) {
    Playlist::merge(array_merge($first['fields'], ['vod_play_url' => '第1集$https://manual.example/1']), video(), $first['routes']);
}, 'Externally edited source route rejected');
$legacy = array_merge(video('X', '第14集$https://old.example/a#第14集$https://old.example/b'), ['vod_play_note' => '']);
check(strpos(Playlist::merge($legacy, video())['fields']['vod_play_url'], $legacy['vod_play_url']) === 0, 'Existing internal conflicts remain byte-for-byte intact');

$request = Jev::request(array_merge(video(), ['api_key' => 'never-send', 'vod_pwd_play' => 'private', 'vod_content' => '<b>剧情</b>']), [array_merge(video(), ['vod_id' => 10])]);
$requestText = Payload::json($request);
check(strpos($requestText, 'https://b.example') === false && strpos($requestText, 'never-send') === false && strpos($requestText, 'private') === false, 'Jev payload contains only permitted metadata');
check(isset($request['questions']['vod_10']['criteria']['uncertain']), 'Unknown evidence remains an explicit option');
$answer = ['model' => 'fixture', 'answers' => ['vod_10' => ['type' => 'choice', 'choice' => 'same', 'confidence' => .9, 'probabilities' => ['same' => .95, 'different' => .01, 'uncertain' => .04]]]];
check(Jev::parse($answer, $request)['answers'][10]['choice'] === 'same', 'Structured Jev answer parsed');
fails(static function () use ($request) { Jev::parse(['answers' => []], $request); }, 'Missing model answers rejected');
$bad = $answer; $bad['answers']['vod_10']['choice'] = 'arbitrary_id';
fails(static function () use ($bad, $request) { Jev::parse($bad, $request); }, 'Out-of-contract choice rejected');
$bad = $answer; $bad['answers']['vod_10']['probabilities']['same'] = .05;
fails(static function () use ($bad, $request) { Jev::parse($bad, $request); }, 'Invalid probability total rejected');

$db = new PDO('sqlite::memory:');
$db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
$db->exec("CREATE TABLE mac_vodmerge_job (job_id INTEGER PRIMARY KEY AUTOINCREMENT, source_key TEXT, source_id TEXT, payload_hash TEXT, video_json TEXT, status TEXT DEFAULT 'pending', review_json TEXT, plan_json TEXT, creation_json TEXT, preview_token TEXT DEFAULT '', preview_until INTEGER DEFAULT 0, vod_id INTEGER DEFAULT 0, operator_id INTEGER DEFAULT 0, message TEXT DEFAULT '', created_at INTEGER, updated_at INTEGER, UNIQUE(source_key,source_id,payload_hash))");
$db->exec('CREATE TABLE mac_vodmerge_binding (source_key TEXT, source_id TEXT, vod_id INTEGER, routes_json TEXT, identity_json TEXT, last_job_id INTEGER, PRIMARY KEY(source_key,source_id))');
$columns = ['vod_id INTEGER PRIMARY KEY AUTOINCREMENT'];
foreach (array_keys(Payload::TEXT_FIELDS) as $field) {
    $columns[] = $field . " TEXT NOT NULL DEFAULT ''";
}
foreach (Playlist::FIELDS as $field) {
    $columns[] = $field . " TEXT NOT NULL DEFAULT ''";
}
foreach (['vod_down_url', 'vod_plot_name', 'vod_plot_detail'] as $field) {
    $columns[] = $field . " TEXT NOT NULL DEFAULT ''";
}
foreach (['type_id', 'type_id_1', 'vod_douban_id', 'vod_lock', 'vod_time', 'vod_time_add', 'vod_status', 'vod_hits'] as $field) {
    $columns[] = $field . ' INTEGER NOT NULL DEFAULT 0';
}
$columns[] = "vod_pwd_play TEXT NOT NULL DEFAULT ''";
$db->exec('CREATE TABLE mac_vod (' . implode(',', $columns) . ')');
$db->exec('CREATE TABLE mac_type (type_id INTEGER PRIMARY KEY, type_pid INTEGER, type_mid INTEGER)');
$db->exec('INSERT INTO mac_type VALUES (2,0,1)');
$judgeCalls = 0;
$judge = static function ($incoming, $candidates) use (&$judgeCalls) {
    $judgeCalls++;
    $answers = [];
    foreach ($candidates as $candidate) {
        $answers[(int) $candidate['vod_id']] = ['choice' => 'same', 'confidence' => 1, 'probabilities' => ['same' => 1, 'different' => 0, 'uncertain' => 0]];
    }
    return ['status' => 'ok', 'answers' => $answers, 'model' => 'fixture'];
};
$service = new Service($db, 'mac_', ['hls' => []], $judge);
$original = video('示例剧 第一季', '第01集$https://a.example/1#第02集$https://a.example/2');
seed($db, 100, $original);
$intake = $service->submit(envelope(video()));
$id = (int) $intake['job_id'];
check((int) $service->submit(envelope(video()))['job_id'] === $id, 'Duplicate intake reuses durable job');
$service->run(1, true);
check($service->detail($id)['status'] === 'review' && $judgeCalls === 1, 'Even 100% Jev confidence cannot authorize first binding');
check(stored($db, 100)['vod_play_url'] === $original['vod_play_url'], 'Jev review does not mutate video');
check(strpos(Payload::json($service->detail($id)), 'https://a.example') === false, 'Admin detail excludes stored playback URLs');
$preview = $service->preview($id, 100);
check($preview['plan']['added_groups'] === 1, 'First binding appends source group');
check($preview['actions']['review'] && $preview['actions']['preview'] && $preview['actions']['create']
    && $preview['actions']['apply'] && $preview['actions']['reject'] && !$preview['actions']['requeue']
    && !$preview['actions']['recover'] && !$preview['actions']['rollback'], 'A ready unbound task exposes only its available actions');
check(is_int($preview['preview_until']) && $preview['preview_until'] >= time(), 'Ready detail exposes the preview expiration time');
$db->exec('UPDATE mac_vodmerge_job SET preview_until=' . (time() - 1) . ' WHERE job_id=' . $id);
check(!$service->detail($id)['actions']['apply'], 'An expired ready preview does not offer confirmation');
$db->exec('UPDATE mac_vodmerge_job SET preview_until=' . $preview['preview_until'] . ' WHERE job_id=' . $id);
$db->exec("UPDATE mac_vodmerge_job SET preview_token='' WHERE job_id=" . $id);
check(!$service->detail($id)['actions']['apply'], 'A ready task without a preview token does not offer confirmation');
$db->prepare('UPDATE mac_vodmerge_job SET preview_token=? WHERE job_id=?')->execute([$preview['preview_token'], $id]);
fails(static function () use ($service, $id) { $service->apply($id, str_repeat('x', 64), 1); }, 'Forged preview rejected');
$service->apply($id, $preview['preview_token'], 1);
$appliedActions = $service->detail($id)['actions'];
check($appliedActions['rollback'] && count(array_filter($appliedActions)) === 1, 'An applied merge offers rollback rather than write or review actions');
$merged = stored($db, 100);
check($merged['vod_play_from'] === 'hls$$$hls', 'Service retains both providers');
check((int) $merged['vod_hits'] === 999 && $merged['vod_pwd_play'] === 'protected' && (int) $merged['vod_status'] === 1, 'Counters and playback permissions untouched');
$service->apply($id, $preview['preview_token'], 1);
check(stored($db, 100)['vod_play_url'] === $merged['vod_play_url'], 'Repeated confirmation has no effect');

$updated = video('示例剧 第一季', '第01集$https://b.example/1.m3u8#第02集$https://b.example/2.m3u8#第03集$https://b.example/3.m3u8');
$job2 = (int) $service->submit(envelope($updated))['job_id'];
check(!$service->detail($job2)['actions']['create'], 'An already bound source cannot offer new-video creation');
$service->run(1, true);
check($service->detail($job2)['status'] === 'applied', 'Confirmed binding updates automatically');
check($judgeCalls === 1, 'Known binding does not call Jev again');
check(substr_count(stored($db, 100)['vod_play_url'], 'https://b.example/3.m3u8') === 1, 'Exactly one appended episode');
$service->rollback($job2, 1);
check(stored($db, 100)['vod_play_url'] === $merged['vod_play_url'], 'Conditional rollback restores old playback');
check($service->detail($job2)['status'] === 'rolled_back', 'Rollback retains audit history');
check(!array_filter($service->detail($job2)['actions']), 'A rolled-back task offers no mutation actions');
check($service->submit(envelope($updated))['status'] === 'rolled_back', 'Retry does not undo a deliberate rollback');

$changedTarget = (int) $service->submit(envelope(video('示例剧 第一季', $updated['vod_play_url'] . '#第4集$https://b.example/4')))['job_id'];
$db->exec("UPDATE mac_vod SET vod_name='不同作品 第一季' WHERE vod_id=100");
$service->run(1, true);
check($service->detail($changedTarget)['status'] === 'review', 'Changed target identity suspends automatic binding updates');
$db->exec("UPDATE mac_vod SET vod_name='示例剧 第一季' WHERE vod_id=100");
$service->reject($changedTarget);

$conflicting = video('示例剧 第一季', '第01集$https://b.example/replaced.m3u8');
$conflict = (int) $service->submit(envelope($conflicting))['job_id'];
$service->run(1, true);
check($service->detail($conflict)['status'] === 'review', 'Episode conflict is held for review');
check(stored($db, 100)['vod_play_url'] === $merged['vod_play_url'], 'Conflicting URL never overwrites stored URL');
$independent = $service->preview($conflict, 100, true);
check($independent['plan']['added_groups'] === 1, 'Explicit independent route can resolve an address conflict without destruction');
$service->reject($conflict);

$season = (int) $service->submit(envelope(video('示例剧 第二季'), 'season-two'))['job_id'];
fails(static function () use ($service, $season) { $service->preview($season, 100); }, 'Season conflict vetoes a manual merge too');
$service->reject($season);
$stale = ready($service, envelope(video(), 'provider-c'), 100);
$db->exec("UPDATE mac_vod SET vod_name='人工更名 第一季' WHERE vod_id=100");
fails(static function () use ($service, $stale) { $service->apply($stale['job_id'], $stale['preview_token'], 1); }, 'Concurrent metadata edit blocks apply');
$db->exec("UPDATE mac_vod SET vod_name='示例剧 第一季',vod_lock=1 WHERE vod_id=100");
fails(static function () use ($service, $stale) { $service->preview($stale['job_id'], 100); }, 'Locked target protected');
$db->exec('UPDATE mac_vod SET vod_lock=0 WHERE vod_id=100');
$service->reject($stale['job_id']);

$recovery = ready($service, envelope(video('示例剧 第一季', '第1集$https://recovery.example/1'), 'recovery'), 100);
$rid = $recovery['job_id'];
$db->exec("CREATE TRIGGER fail_finish BEFORE UPDATE ON mac_vodmerge_job WHEN NEW.status='applied' AND NEW.job_id=$rid BEGIN SELECT RAISE(ABORT,'simulated audit failure'); END");
fails(static function () use ($service, $recovery) { $service->apply($recovery['job_id'], $recovery['preview_token'], 1); }, 'Simulate interruption after video write');
$afterInterrupted = stored($db, 100)['vod_play_url'];
check($service->detail($rid)['status'] === 'applying', 'Write-ahead intent survives partial failure');
check($service->detail($rid)['actions']['recover'] && count(array_filter($service->detail($rid)['actions'])) === 1, 'An unfinished merge offers only recovery');
foreach (['creating', 'rolling_back'] as $unfinishedStatus) {
    $db->prepare('UPDATE mac_vodmerge_job SET status=? WHERE job_id=?')->execute([$unfinishedStatus, $rid]);
    $unfinishedActions = $service->detail($rid)['actions'];
    check($unfinishedActions['recover'] && count(array_filter($unfinishedActions)) === 1, 'An unfinished write with a recorded target offers only recovery: ' . $unfinishedStatus);
}
$db->exec("UPDATE mac_vodmerge_job SET status='applying' WHERE job_id=" . $rid);
$db->exec('DROP TRIGGER fail_finish');
$service->recover($rid);
check($service->detail($rid)['status'] === 'applied' && stored($db, 100)['vod_play_url'] === $afterInterrupted, 'Recovery finalizes without duplicate append');
$db->exec("UPDATE mac_vod SET vod_play_url=vod_play_url || '#第99集\$https://manual.example/99' WHERE vod_id=100");
fails(static function () use ($service, $rid) { $service->rollback($rid, 1); }, 'Rollback protects later manual playback edits');

$new = video('新作品', '正片$https://new.example/movie');
$new['vod_douban_id'] = 0;
$created = ready($service, envelope($new, 'new-source'), 0);
$result = $service->apply($created['job_id'], $created['preview_token'], 1);
check($result['vod_id'] > 100 && (int) stored($db, $result['vod_id'])['vod_status'] === 0, 'Explicit new video is created as unreviewed');
check(!array_filter($result['actions']), 'An applied newly created video does not offer merge rollback');
fails(static function () use ($service, $created) { $service->rollback($created['job_id'], 1); }, 'No automatic deletion of newly created video');

$uncertain = ready($service, envelope(array_merge($new, ['vod_name' => '不确定新增']), 'uncertain-source'), 0);
$uid = $uncertain['job_id'];
$beforeCount = (int) $db->query('SELECT COUNT(*) FROM mac_vod')->fetchColumn();
$db->exec("CREATE TRIGGER fail_new_id BEFORE UPDATE ON mac_vodmerge_job WHEN NEW.job_id=$uid AND NEW.vod_id>0 BEGIN SELECT RAISE(ABORT,'simulated post-insert crash'); END");
fails(static function () use ($service, $uncertain) { $service->apply($uncertain['job_id'], $uncertain['preview_token'], 1); }, 'Simulate creation crash before recording the ID');
$db->exec('DROP TRIGGER fail_new_id');
$uncertainActions = $service->detail($uid)['actions'];
check($uncertainActions['preview'] && count(array_filter($uncertainActions)) === 1, 'An uncertain creation without a recorded ID only offers verified existing-ID preview');
$db->exec("UPDATE mac_vodmerge_job SET status='review' WHERE job_id=" . $uid);
check(!$service->detail($uid)['actions']['requeue'] && !$service->detail($uid)['actions']['create'], 'A review task retaining an uncertain creation cannot requeue or create');
$db->exec("UPDATE mac_vodmerge_job SET status='creating' WHERE job_id=" . $uid);
fails(static function () use ($service, $uid) { $service->recover($uid); }, 'Unknown insert result never auto-retries');
fails(static function () use ($service, $uid) { $service->preview($uid, 0); }, 'Operator cannot accidentally re-create uncertain insert');
check((int) $db->query('SELECT COUNT(*) FROM mac_vod')->fetchColumn() === $beforeCount + 1, 'Only one row despite recovery attempts');
$foundId = (int) $db->query("SELECT vod_id FROM mac_vod WHERE vod_name='不确定新增'")->fetchColumn();
$resolved = $service->preview($uid, $foundId);
check(!$resolved['actions']['create'] && !$resolved['actions']['requeue'], 'Resolving an uncertain creation never offers duplicate creation or requeue');
$service->apply($uid, $resolved['preview_token'], 1);
check($service->detail($uid)['status'] === 'applied', 'Operator can resolve uncertain creation by binding verified existing ID');

$unavailable = new Service($db, 'mac_', ['hls' => []], static function () { return ['status' => 'failed', 'answers' => []]; });
$failed = (int) $unavailable->submit(envelope(video(), 'jev-failure'))['job_id'];
$unavailable->review($failed);
check($unavailable->detail($failed)['status'] === 'review' && $unavailable->detail($failed)['review']['status'] === 'failed', 'Jev outage stays in human review');

seed($db, 900, video());
$bound = ready($service, envelope(video(), 'malformed-target'), 900);
$service->apply($bound['job_id'], $bound['preview_token'], 1);
$db->exec("UPDATE mac_vod SET vod_play_url='' WHERE vod_id=900");
$badJob = (int) $service->submit(envelope($updated, 'malformed-target'))['job_id'];
$followingJob = (int) $service->submit(envelope(video(), 'following-job'))['job_id'];
$service->run(2, true);
check($service->detail($badJob)['status'] === 'review', 'Malformed legacy playback moves the affected job to review');
check(!$service->detail($badJob)['actions']['create'] && $service->detail($badJob)['actions']['requeue'], 'An ordinary bound review task may retry but cannot create a second video');
check($service->detail($followingJob)['status'] === 'review', 'A malformed legacy record cannot block the queue');

require __DIR__ . '/vodmerge-matching.test.php';
require __DIR__ . '/vodmerge-safety.test.php';
require __DIR__ . '/vodmerge-candidates.test.php';
require __DIR__ . '/vodmerge-automatic.test.php';
require __DIR__ . '/vodmerge-review.test.php';

echo "VodMerge tests passed: $checks assertions (SQLite persistence, deterministic playlists, API contract and crash recovery).\n";
