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
    private array $where = [];
    private array $orWhere = [];
    private string $order = '';
    private string $fields = '';
    private bool $joinVod = false;
    private int $offset = 0;
    private ?int $limit = null;

    public function __construct(string $table)
    {
        $this->table = strtolower($table);
    }

    public function field($fields)
    {
        $this->fields = (string) $fields;
        return $this;
    }

    public function alias($alias)
    {
        return $this;
    }

    public function join($table, $condition)
    {
        if ($this->table === 'ulog' && stripos((string) $table, 'vod') !== false) {
            $this->joinVod = true;
        }
        return $this;
    }

    public function where(...$arguments)
    {
        $GLOBALS['pingfangApiAccountHistoryWhere'][$this->table][] = $arguments;
        if (($arguments[0] ?? null) instanceof Closure) {
            $nested = new self($this->table);
            $arguments[0]($nested);
            $arguments = [$nested];
        }
        $this->where[] = $arguments;
        return $this;
    }

    public function whereOr(...$arguments)
    {
        $this->orWhere[] = $arguments;
        return $this;
    }

    public function order($order)
    {
        $this->order = (string) $order;
        return $this;
    }

    public function limit(...$arguments)
    {
        if (count($arguments) > 1) {
            $this->offset = max(0, (int) $arguments[0]);
            $this->limit = max(0, (int) $arguments[1]);
        } else {
            $this->limit = max(0, (int) ($arguments[0] ?? 0));
        }
        $GLOBALS['pingfangApiAccountHistoryLimits'][$this->table][] = [$this->offset, $this->limit];
        return $this;
    }

    public function select()
    {
        if ($this->table === 'vod' && !empty($GLOBALS['pingfangApiAccountHistoryPlaybackBytes'])) {
            $GLOBALS['pingfangApiAccountHistoryMemory'][] = memory_get_usage();
        }
        $rows = $GLOBALS['pingfangApiAccountHistoryRows'][$this->table] ?? [];
        if ($this->joinVod) {
            $videos = [];
            foreach ($GLOBALS['pingfangApiAccountHistoryRows']['vod'] ?? [] as $video) {
                $videos[(int) ($video['vod_id'] ?? 0)] = $video;
            }
            $rows = array_values(array_filter(array_map(static function (array $row) use ($videos): ?array {
                $video = $videos[(int) ($row['ulog_rid'] ?? 0)] ?? null;
                return $video === null ? null : array_merge($row, $video);
            }, $rows)));
        }
        $rows = array_values(array_filter($rows, [$this, 'matchesWhere']));
        if ($this->order !== '') {
            usort($rows, function (array $left, array $right): int {
                foreach (explode(',', $this->order) as $part) {
                    [$field, $direction] = explode(' ', trim($part));
                    $field = preg_replace('/^\w+\./', '', $field);
                    $comparison = ($left[$field] ?? 0) <=> ($right[$field] ?? 0);
                    if ($comparison !== 0) {
                        return $direction === 'desc' ? -$comparison : $comparison;
                    }
                }
                return 0;
            });
        }
        if ($this->limit !== null) {
            $rows = array_slice($rows, $this->offset, $this->limit);
        }
        if ($this->table === 'vod' && strpos($this->fields, 'vod_play_url') !== false && !empty($GLOBALS['pingfangApiAccountHistoryPlaybackBytes'])) {
            foreach ($rows as &$row) {
                $row['vod_play_url'] = str_repeat('x', $GLOBALS['pingfangApiAccountHistoryPlaybackBytes']) . $row['vod_id'];
            }
            unset($row);
        }
        return $rows;
    }

    public function matchesWhere(array $row): bool
    {
        $matches = true;
        foreach ($this->where as $arguments) {
            if (!$this->matchesArguments($row, $arguments)) {
                $matches = false;
                break;
            }
        }
        foreach ($this->orWhere as $arguments) {
            $matches = $matches || $this->matchesArguments($row, $arguments);
        }
        return $matches;
    }

    private function matchesArguments(array $row, array $arguments): bool
    {
        if ($arguments[0] instanceof self) {
            return $arguments[0]->matchesWhere($row);
        }
        if (count($arguments) === 1 && is_array($arguments[0])) {
            foreach ($arguments[0] as $field => $expected) {
                if (!$this->matches($row, (string) $field, '=', $expected)) {
                    return false;
                }
            }
            return true;
        }
        return count($arguments) === 2
            ? $this->matches($row, (string) $arguments[0], '=', $arguments[1])
            : $this->matches($row, (string) $arguments[0], (string) $arguments[1], $arguments[2]);
    }

    public function count($field = '*')
    {
        $GLOBALS['pingfangApiAccountHistoryCounts'][$this->table][] = (string) $field;
        return count($this->select());
    }

    public function find()
    {
        $rows = $this->select();
        return $rows[0] ?? null;
    }

    private function matches(array $row, string $field, string $operator, $expected): bool
    {
        if (strpos($field, '.') !== false) {
            $parts = explode('.', $field);
            $field = (string) end($parts);
        }
        if (!array_key_exists($field, $row)) {
            return true;
        }
        $actual = $row[$field];
        if (is_array($expected) && count($expected) === 2) {
            return $this->matches($row, $field, (string) $expected[0], $expected[1]);
        }
        if ($operator === 'in') {
            return in_array($actual, (array) $expected);
        }
        if ($operator === 'not in') {
            return !in_array($actual, (array) $expected);
        }
        if ($operator === 'gt') {
            return $actual > $expected;
        }
        if ($operator === 'lt') {
            return $actual < $expected;
        }
        if ($operator === 'elt') {
            return $actual <= $expected;
        }
        return $actual == $expected;
    }

    public function update($data)
    {
        $GLOBALS['pingfangApiAccountHistoryUpdates'][$this->table][] = $data;
        return $GLOBALS['pingfangApiAccountHistoryUpdateResult'] ?? 1;
    }

    public function insert($data)
    {
        $GLOBALS['pingfangApiAccountHistoryInserts'][$this->table][] = $data;
        return $GLOBALS['pingfangApiAccountHistoryInsertResult'] ?? 1;
    }

    public function delete()
    {
        $GLOBALS['pingfangApiAccountHistoryDeletes'][$this->table][] = $this->where;
        return $GLOBALS['pingfangApiAccountHistoryDeleteResult'] ?? count($this->select());
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

$GLOBALS['pingfangApiAccountHistoryRows'] = [
    'ulog' => [
        ['ulog_id' => 84, 'user_id' => 42, 'ulog_mid' => 1, 'ulog_type' => 4, 'ulog_rid' => 7, 'ulog_sid' => 1, 'ulog_nid' => 2, 'ulog_points' => 0, 'ulog_point' => 12, 'ulog_duration' => 120, 'ulog_time' => 1721621000],
        ['ulog_id' => 82, 'user_id' => 42, 'ulog_mid' => 1, 'ulog_type' => 4, 'ulog_rid' => 8, 'ulog_sid' => 1, 'ulog_nid' => 1, 'ulog_points' => 25, 'ulog_point' => 95, 'ulog_duration' => 100, 'ulog_time' => 1721620950],
        ['ulog_id' => 81, 'user_id' => 42, 'ulog_mid' => 1, 'ulog_type' => 4, 'ulog_rid' => 7, 'ulog_sid' => 1, 'ulog_nid' => 1, 'ulog_points' => 0, 'ulog_point' => 37, 'ulog_duration' => 120, 'ulog_time' => 1721620900],
        ['ulog_id' => 85, 'user_id' => 42, 'ulog_mid' => 1, 'ulog_type' => 4, 'ulog_rid' => 10, 'ulog_sid' => 1, 'ulog_nid' => 1, 'ulog_points' => 0, 'ulog_point' => 18, 'ulog_duration' => 100, 'ulog_time' => 1721620700],
        ['ulog_id' => 83, 'user_id' => 42, 'ulog_mid' => 1, 'ulog_type' => 4, 'ulog_rid' => 9, 'ulog_sid' => 1, 'ulog_nid' => 1, 'ulog_points' => 0, 'ulog_point' => 42, 'ulog_duration' => 100, 'ulog_time' => 1721620600],
        ['ulog_id' => 86, 'user_id' => 99, 'ulog_mid' => 1, 'ulog_type' => 4, 'ulog_rid' => 11, 'ulog_sid' => 1, 'ulog_nid' => 1, 'ulog_points' => 0, 'ulog_point' => 33, 'ulog_duration' => 100, 'ulog_time' => 1721621100],
        ['ulog_id' => 71, 'user_id' => 42, 'ulog_mid' => 1, 'ulog_type' => 2, 'ulog_rid' => 7, 'ulog_time' => 1721621000],
        ['ulog_id' => 72, 'user_id' => 42, 'ulog_mid' => 1, 'ulog_type' => 2, 'ulog_rid' => 8, 'ulog_time' => 1721620900],
        ['ulog_id' => 73, 'user_id' => 42, 'ulog_mid' => 1, 'ulog_type' => 2, 'ulog_rid' => 9, 'ulog_time' => 1721620800],
        ['ulog_id' => 74, 'user_id' => 99, 'ulog_mid' => 1, 'ulog_type' => 2, 'ulog_rid' => 10, 'ulog_time' => 1721621100],
    ],
    'vod' => array_map(static function (int $vodId): array {
        return [
            'vod_id' => $vodId,
            'vod_status' => 1,
            'vod_recycle_time' => 0,
            'vod_name' => '测试影片 ' . $vodId,
            'vod_pic' => '/upload/' . $vodId . '.jpg',
            'vod_remarks' => '正片',
            'vod_play_from' => 'local',
            'vod_play_url' => '第1集$https://media.example/' . $vodId . '.m3u8',
            'vod_play_server' => '',
            'vod_play_note' => '',
        ];
    }, [7, 8, 10, 11]),
];

$paginationService = new AccountService(['user_id' => 42, 'user_name' => 'alice']);
$GLOBALS['pingfangApiAccountHistoryLimits'] = [];
$historyPage = $paginationService->historyPage(42, 1, 1);
$assertSame(
    ['items', 'page', 'pageSize', 'total', 'totalPages'],
    array_keys($historyPage),
    'Paginated history must expose the complete page envelope.'
);
$assertSame([1, 1, 3, 3], [$historyPage['page'], $historyPage['pageSize'], $historyPage['total'], $historyPage['totalPages']], 'History totals must be computed after validity filtering and folding by video.');
$assertSame('8', $historyPage['items'][0]['vodId'], 'History order must use the newest valid episode instead of a newer removed episode.');
$assertSame([[0, 100]], $GLOBALS['pingfangApiAccountHistoryLimits']['ulog'] ?? [], 'History must scan Ulog in bounded batches instead of one unbounded result set.');
$paidHistoryPage = $paginationService->historyPage(42, 2, 1);
$assertSame('7', $paidHistoryPage['items'][0]['vodId'], 'Paginated history must retain the next valid video after folding.');
$assertSame('1', $paidHistoryPage['items'][0]['episodeId'], 'History must use the first valid episode when a newer row points to a removed episode.');
$assertSame(['84', '81'], $paidHistoryPage['items'][0]['recordIds'], 'History must collect every folded record ID before pagination.');
$lastHistoryPage = $paginationService->historyPage(42, 99, 1);
$assertSame([3, '10'], [$lastHistoryPage['page'], $lastHistoryPage['items'][0]['vodId']], 'History pages beyond the end must clamp to the last page.');
$emptyHistoryPage = $paginationService->historyPage(123, 4, 10);
$assertSame([[], 1, 10, 0, 0], array_values($emptyHistoryPage), 'Empty history pagination must normalize to page one with zero pages.');

$GLOBALS['pingfangApiAccountHistoryLimits'] = [];
$GLOBALS['pingfangApiAccountHistoryCounts'] = [];
$favoritePage = $paginationService->favoritesPage(42, 2, 1);
$assertSame([2, 1, 2, 2, '8'], [$favoritePage['page'], $favoritePage['pageSize'], $favoritePage['total'], $favoritePage['totalPages'], $favoritePage['items'][0]['vodId']], 'Favorites must paginate only visible records for the current user.');
$assertSame(['u.ulog_id'], $GLOBALS['pingfangApiAccountHistoryCounts']['ulog'] ?? [], 'Favorites must count only the joined visible result set.');
$assertSame([[1, 1]], $GLOBALS['pingfangApiAccountHistoryLimits']['ulog'] ?? [], 'Favorites must fetch only the requested database page.');
$assertSame(['7', true], array_values($paginationService->favoriteStatus(42, 7)), 'Favorite status must query the exact user and video.');
$assertSame(['10', false], array_values($paginationService->favoriteStatus(42, 10)), 'Favorite status must not match another user or an absent favorite.');
$lastFavoritePage = $paginationService->favoritesPage(42, 99, 1);
$assertSame(2, $lastFavoritePage['page'], 'Favorite pages beyond the end must clamp to the last page.');
$emptyFavoritePage = $paginationService->favoritesPage(123, 4, 10);
$assertSame([[], 1, 10, 0, 0], array_values($emptyFavoritePage), 'Empty favorite pagination must normalize to page one with zero pages.');

foreach ([true, false] as $favorite) {
    $GLOBALS['pingfangApiAccountHistoryUpdateResult'] = false;
    $GLOBALS['pingfangApiAccountHistoryDeleteResult'] = false;
    try {
        $paginationService->setFavorite(42, 7, $favorite);
        $fail('A failed favorite database write must not report success.');
    } catch (\addons\pingfangapi\service\ApiException $error) {
        $assertSame(500, $error->status(), 'Favorite write failures must return a controlled API failure.');
    }
    $assertSame(['7', true], array_values($paginationService->favoriteStatus(42, 7)), 'A failed favorite write must leave the stored favorite unchanged.');
}

$GLOBALS['pingfangApiAccountHistoryUpdateResult'] = 0;
$assertSame(['vodId' => '7', 'favorited' => true], $paginationService->setFavorite(42, 7, true), 'An unchanged favorite timestamp must remain an idempotent success.');
$GLOBALS['pingfangApiAccountHistoryDeleteResult'] = 0;
$GLOBALS['pingfangApiAccountHistoryDeletes'] = [];
$assertSame(['vodId' => '7', 'favorited' => false], $paginationService->setFavorite(42, 7, false), 'A concurrent deletion returning zero affected rows must remain an idempotent success.');
$assertSame(
    [[[['user_id' => 42, 'ulog_mid' => 1, 'ulog_type' => 2, 'ulog_rid' => 7]]]],
    $GLOBALS['pingfangApiAccountHistoryDeletes']['ulog'],
    'Cancelling a favorite must remain scoped to the current user, video, and favorite record type.'
);
$GLOBALS['pingfangApiAccountHistoryDeletes'] = [];
$assertSame(['vodId' => '10', 'favorited' => false], $paginationService->setFavorite(42, 10, false), 'Cancelling an absent favorite must not touch another user favorite.');
$assertSame([], $GLOBALS['pingfangApiAccountHistoryDeletes'], 'An absent favorite must not issue a delete.');
$GLOBALS['pingfangApiAccountHistoryInsertResult'] = false;
try {
    $paginationService->setFavorite(42, 10, true);
    $fail('A failed favorite insert must not report success.');
} catch (\addons\pingfangapi\service\ApiException $error) {
    $assertSame(500, $error->status(), 'Favorite insertion failures must remain controlled API failures.');
}
unset($GLOBALS['pingfangApiAccountHistoryUpdateResult'], $GLOBALS['pingfangApiAccountHistoryDeleteResult'], $GLOBALS['pingfangApiAccountHistoryInsertResult']);

$batchedHistoryRows = [];
for ($index = 0; $index < 100; $index++) {
    $batchedHistoryRows[] = [
        'ulog_id' => 1000 + $index,
        'user_id' => 42,
        'ulog_mid' => 1,
        'ulog_type' => 4,
        'ulog_rid' => 7,
        'ulog_sid' => 1,
        'ulog_nid' => 1,
        'ulog_point' => 10,
        'ulog_duration' => 100,
        'ulog_time' => 1721622000 - $index,
    ];
}
$batchedHistoryRows[] = [
    'ulog_id' => 2000,
    'user_id' => 42,
    'ulog_mid' => 1,
    'ulog_type' => 4,
    'ulog_rid' => 8,
    'ulog_sid' => 1,
    'ulog_nid' => 1,
    'ulog_point' => 20,
    'ulog_duration' => 100,
    'ulog_time' => 1721621800,
];
$GLOBALS['pingfangApiAccountHistoryRows']['ulog'] = $batchedHistoryRows;
$GLOBALS['pingfangApiAccountHistoryLimits'] = [];
$batchedHistoryPage = $paginationService->historyPage(42, 2, 1);
$assertSame('8', $batchedHistoryPage['items'][0]['vodId'], 'History pagination must continue across bounded Ulog batches.');
$assertSame([[0, 100], [0, 100]], $GLOBALS['pingfangApiAccountHistoryLimits']['ulog'] ?? [], 'History batches must use a seek cursor without growing offsets.');

$invalidBatch = array_map(static function (array $row): array {
    return array_merge($row, ['ulog_nid' => 99]);
}, array_slice($batchedHistoryRows, 0, 100));
$invalidBatch[] = $batchedHistoryRows[100];
$invalidBatch[] = array_merge($batchedHistoryRows[0], ['ulog_id' => 3000, 'ulog_time' => 1721621700]);
$GLOBALS['pingfangApiAccountHistoryRows']['ulog'] = $invalidBatch;
$recoveredPage = $paginationService->historyPage(42, 2, 1);
$assertSame([2, '7', '1', 101], [$recoveredPage['total'], $recoveredPage['items'][0]['vodId'], $recoveredPage['items'][0]['episodeId'], count($recoveredPage['items'][0]['recordIds'])], 'A later batch must still recover an older valid episode and all IDs after a full batch of removed episodes.');

$largeHistory = [];
for ($index = 1; $index <= 10000; $index++) {
    $largeHistory[] = array_merge($batchedHistoryRows[0], [
        'ulog_id' => $index,
        'ulog_rid' => $index === 1 ? 8 : 7,
        'ulog_time' => 1721622000,
    ]);
}
$GLOBALS['pingfangApiAccountHistoryRows']['ulog'] = $largeHistory;
$GLOBALS['pingfangApiAccountHistoryLimits'] = [];
$largePage = $paginationService->historyPage(42, 2, 1);
$assertSame([2, '8', ['1']], [$largePage['total'], $largePage['items'][0]['vodId'], $largePage['items'][0]['recordIds']], 'Ten thousand equal-time records must not skip the final video at a batch boundary.');
$assertSame([[0, 100]], array_values(array_unique($GLOBALS['pingfangApiAccountHistoryLimits']['ulog'], SORT_REGULAR)), 'Large histories must never fall back to deep OFFSET reads.');

$largeVideos = [];
$largeHistory = [];
for ($index = 1; $index <= 1000; $index++) {
    $largeVideos[] = array_merge($GLOBALS['pingfangApiAccountHistoryRows']['vod'][0], ['vod_id' => $index]);
    $largeHistory[] = array_merge($batchedHistoryRows[0], ['ulog_id' => $index, 'ulog_rid' => $index, 'ulog_time' => 1721622000 + $index]);
}
$GLOBALS['pingfangApiAccountHistoryRows'] = ['ulog' => $largeHistory, 'vod' => $largeVideos];
$GLOBALS['pingfangApiAccountHistoryPlaybackBytes'] = 32768;
$GLOBALS['pingfangApiAccountHistoryMemory'] = [];
$largePage = $paginationService->historyPage(42, 99, 24);
$assertSame([1000, 42, 16], [$largePage['total'], $largePage['page'], count($largePage['items'])], 'Large distinct histories must retain exact totals and last-page clamping.');
$memorySamples = $GLOBALS['pingfangApiAccountHistoryMemory'];
$assertSame(true, max($memorySamples) - min($memorySamples) < 8 * 1048576, 'Resolved videos must release large playback fields instead of retaining every playlist until pagination ends.');
unset($GLOBALS['pingfangApiAccountHistoryPlaybackBytes'], $GLOBALS['pingfangApiAccountHistoryMemory']);

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
