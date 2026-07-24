<?php
declare(strict_types=1);

use addons\pingfangapi\service\AccountService;

final class PingfangApiAccountHistoryDb
{
    public static function name($name)
    {
        return new PingfangApiAccountHistoryQuery((string) $name);
    }
}

final class PingfangApiAccountHistoryQuery
{
    private string $table;

    public function __construct(string $table)
    {
        $this->table = strtolower($table);
    }

    public function field($fields)
    {
        return $this;
    }

    public function where(...$arguments)
    {
        $GLOBALS['pingfangApiAccountHistoryWhere'][$this->table][] = $arguments;
        return $this;
    }

    public function order($order)
    {
        return $this;
    }

    public function limit($limit)
    {
        return $this;
    }

    public function select()
    {
        return $GLOBALS['pingfangApiAccountHistoryRows'][$this->table] ?? [];
    }

    public function find()
    {
        $rows = $GLOBALS['pingfangApiAccountHistoryRows'][$this->table] ?? [];
        return $rows[0] ?? null;
    }

    public function update($data)
    {
        $GLOBALS['pingfangApiAccountHistoryUpdates'][$this->table][] = $data;
        return $GLOBALS['pingfangApiAccountHistoryUpdateResult'] ?? 1;
    }

    public function insert($data)
    {
        $GLOBALS['pingfangApiAccountHistoryInserts'][$this->table][] = $data;
        return 1;
    }
}

class_alias(PingfangApiAccountHistoryDb::class, 'think\\Db');

require_once dirname(__DIR__) . '/addons/pingfangapi/service/ApiException.php';
require_once dirname(__DIR__) . '/addons/pingfangapi/service/AccountService.php';

if (!function_exists('mac_url_img')) {
    function mac_url_img($value)
    {
        return (string) $value;
    }
}

if (!function_exists('mac_play_list')) {
    function mac_play_list()
    {
        return [1 => ['urls' => [1 => ['name' => '第1集']]]];
    }
}

if (!function_exists('session')) {
    function session($key, $value = null)
    {
        if (func_num_args() > 1) {
            $GLOBALS['pingfangApiAccountHistorySession'][$key] = $value;
            return null;
        }
        return $GLOBALS['pingfangApiAccountHistorySession'][$key] ?? null;
    }
}

$fail = static function (string $message): never {
    fwrite(STDERR, $message . "\n");
    exit(1);
};
$assertSame = static function ($expected, $actual, string $message) use ($fail): void {
    if ($expected !== $actual) {
        $fail($message . "\nExpected: " . var_export($expected, true) . "\nActual: " . var_export($actual, true));
    }
};

$GLOBALS['config']['app']['popedom_filter'] = 0;
$GLOBALS['pingfangApiAccountHistoryRows'] = [
    'ulog' => [
        ['ulog_id' => 81, 'ulog_rid' => 7, 'ulog_sid' => 1, 'ulog_nid' => 1, 'ulog_point' => 37, 'ulog_duration' => 120, 'ulog_time' => 1721620800],
        ['ulog_id' => 82, 'ulog_rid' => 8, 'ulog_sid' => 1, 'ulog_nid' => 1, 'ulog_point' => 95, 'ulog_duration' => 100, 'ulog_time' => 1721620700],
        ['ulog_id' => 83, 'ulog_rid' => 9, 'ulog_sid' => 1, 'ulog_nid' => 1, 'ulog_point' => 42, 'ulog_duration' => 0, 'ulog_time' => 1721620600],
    ],
    'vod' => array_map(static function (int $vodId): array {
        return [
            'vod_id' => $vodId,
            'vod_name' => '测试影片 ' . $vodId,
            'vod_pic' => '/upload/' . $vodId . '.jpg',
            'vod_remarks' => '正片',
            'vod_play_from' => 'local',
            'vod_play_url' => '第1集$https://media.example/' . $vodId . '.m3u8',
            'vod_play_server' => '',
            'vod_play_note' => '',
        ];
    }, [7, 8, 9]),
];

$items = (new AccountService(['user_id' => 42, 'user_name' => 'alice']))->history(42, 10);

$assertSame(
    ['recordIds', 'vodId', 'sourceId', 'episodeId', 'title', 'episodeName', 'poster', 'positionSeconds', 'durationSeconds', 'completed', 'progress', 'watchedAt'],
    array_keys($items[0]),
    'History entries must expose structured cloud-resume fields without removing the existing DTO.'
);
$assertSame(37, $items[0]['positionSeconds'], 'History must expose the stored playback position in integer seconds.');
$assertSame(120, $items[0]['durationSeconds'], 'History must expose a known stored duration in integer seconds.');
$assertSame(false, $items[0]['completed'], 'History below the native 95% threshold must remain incomplete.');
$assertSame(true, $items[1]['completed'], 'History at the native 95% threshold must be complete.');
$assertSame(42, $items[2]['positionSeconds'], 'Legacy history must retain a known position when duration is unavailable.');
$assertSame(null, $items[2]['durationSeconds'], 'Legacy zero durations must be exposed as unknown rather than a zero-length video.');
$assertSame(false, $items[2]['completed'], 'History with an unknown duration must not be marked complete.');

$GLOBALS['pingfangApiAccountHistoryWhere'] = [];
$GLOBALS['pingfangApiAccountHistoryRows']['ulog'] = [
    ['ulog_point' => '31', 'ulog_duration' => '100'],
];
$resumeService = new AccountService(['user_id' => 42, 'user_name' => 'alice']);
$assertSame(31, $resumeService->resumePosition(42, 7, 2, 3), 'Resume lookup must return an exact eligible position.');
$assertSame(
    [[[
        'user_id' => 42,
        'ulog_mid' => 1,
        'ulog_type' => 4,
        'ulog_rid' => 7,
        'ulog_sid' => 2,
        'ulog_nid' => 3,
    ]]],
    $GLOBALS['pingfangApiAccountHistoryWhere']['ulog'],
    'Resume lookup must query the current user and exact native Ulog episode key.'
);

$GLOBALS['pingfangApiAccountHistoryRows']['ulog'] = [['ulog_point' => 30, 'ulog_duration' => 100]];
$assertSame(null, $resumeService->resumePosition(42, 7, 2, 3), 'Positions at 30 seconds must not trigger resume.');
$GLOBALS['pingfangApiAccountHistoryRows']['ulog'] = [['ulog_point' => 94, 'ulog_duration' => 100]];
$assertSame(94, $resumeService->resumePosition(42, 7, 2, 3), 'Positions below 95 percent must remain resumable.');
$GLOBALS['pingfangApiAccountHistoryRows']['ulog'] = [['ulog_point' => 95, 'ulog_duration' => 100]];
$assertSame(null, $resumeService->resumePosition(42, 7, 2, 3), 'Positions at 95 percent must be treated as complete.');
$GLOBALS['pingfangApiAccountHistoryRows']['ulog'] = [['ulog_point' => 47, 'ulog_duration' => 0]];
$assertSame(null, $resumeService->resumePosition(42, 7, 2, 3), 'Unknown durations must not produce a resume position.');
$GLOBALS['pingfangApiAccountHistoryRows']['ulog'] = [];
$assertSame(null, $resumeService->resumePosition(42, 7, 2, 3), 'Missing history must not produce a resume position.');

$GLOBALS['pingfangApiAccountHistoryRows']['ulog'] = [['ulog_id' => 91]];
$GLOBALS['pingfangApiAccountHistoryUpdates'] = [];
$GLOBALS['pingfangApiAccountHistorySession'] = [];
$resumeService->saveHistory(42, 7, 2, 3, 48, 120, 1784846400200);
$resumeService->saveHistory(42, 7, 2, 3, 41, 120, 1784846400100);
$resumeService->saveHistory(42, 7, 2, 3, 39, 120);
$assertSame(
    [['ulog_point' => 48, 'ulog_time' => $GLOBALS['pingfangApiAccountHistoryUpdates']['ulog'][0]['ulog_time'], 'ulog_duration' => 120]],
    $GLOBALS['pingfangApiAccountHistoryUpdates']['ulog'],
    'Older or legacy concurrent checkpoints must not overwrite a newer checkpoint from the same session.'
);

$GLOBALS['pingfangApiAccountHistoryUpdates'] = [];
$GLOBALS['pingfangApiAccountHistorySession'] = [];
$GLOBALS['pingfangApiAccountHistoryUpdateResult'] = false;
$saveFailed = false;
try {
    $resumeService->saveHistory(42, 7, 2, 3, 52, 120, 1784846400300);
} catch (\addons\pingfangapi\service\ApiException $error) {
    $saveFailed = true;
}
$assertSame(true, $saveFailed, 'A failed checkpoint database write must remain observable as an API failure.');
$assertSame([], $GLOBALS['pingfangApiAccountHistorySession'], 'A failed database write must not advance the session checkpoint watermark.');
$GLOBALS['pingfangApiAccountHistoryUpdateResult'] = 1;
$resumeService->saveHistory(42, 7, 2, 3, 49, 120);
$assertSame(2, count($GLOBALS['pingfangApiAccountHistoryUpdates']['ulog']), 'A legacy fallback must remain writable after a newer database write fails.');

echo "Pingfang production API account history tests passed.\n";
