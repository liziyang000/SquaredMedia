<?php

namespace think {
    class Db
    {
        public static $tables = [];
        public static $columns = [];

        public static function name($name)
        {
            return new DoubanDataQuery((string) $name);
        }

        public static function query($sql, $bind = [])
        {
            if (strpos((string) $sql, 'information_schema.COLUMNS') !== false) {
                $table = (string) ($bind[0] ?? '');
                $column = (string) ($bind[1] ?? '');
                return in_array($column, self::$columns[$table] ?? [], true)
                    ? [['COLUMN_NAME' => $column]]
                    : [];
            }

            return [];
        }

        public static function execute($sql, $bind = [])
        {
            return 1;
        }

        public static function startTrans()
        {
        }

        public static function commit()
        {
        }

        public static function rollback()
        {
        }
    }

    class DoubanDataQuery
    {
        private $table;
        private $where = [];

        public function __construct(string $table)
        {
            $this->table = $table;
        }

        public function getTable()
        {
            return $this->table;
        }

        public function where($field, $operator = null, $value = null)
        {
            $this->where[] = func_num_args() === 2
                ? [(string) $field, '=', $operator]
                : [(string) $field, (string) $operator, $value];

            return $this;
        }

        public function field($fields)
        {
            return $this;
        }

        public function alias($alias)
        {
            return $this;
        }

        public function join($table, $condition, $type = '')
        {
            return $this;
        }

        public function whereIn($field, array $values)
        {
            $this->where[] = [(string) $field, 'IN', $values];

            return $this;
        }

        public function whereLike($field, $value)
        {
            $this->where[] = [(string) $field, 'LIKE', (string) $value];

            return $this;
        }

        public function order($order)
        {
            return $this;
        }

        public function group($fields)
        {
            return $this;
        }

        public function limit($limit)
        {
            return $this;
        }

        public function count()
        {
            return count($this->rows());
        }

        public function page($page, $limit)
        {
            return $this;
        }

        public function lock($lock)
        {
            return $this;
        }

        public function select()
        {
            return $this->rows();
        }

        public function find()
        {
            $rows = $this->rows();

            return $rows[0] ?? null;
        }

        public function update(array $data)
        {
            $updated = 0;
            foreach (Db::$tables[$this->table] ?? [] as $index => $row) {
                if (!$this->matches($row)) {
                    continue;
                }
                Db::$tables[$this->table][$index] = array_merge($row, $data);
                $updated++;
            }

            return $updated;
        }

        private function rows()
        {
            return array_values(array_filter(Db::$tables[$this->table] ?? [], function ($row) {
                return $this->matches($row);
            }));
        }

        private function matches(array $row)
        {
            foreach ($this->where as [$field, $operator, $expected]) {
                $field = preg_replace('/^.*\./', '', $field);
                $actual = $row[$field] ?? null;
                if ($operator === 'IN' && !in_array($actual, $expected, true)) {
                    return false;
                }
                if ($operator === 'LIKE' && strpos((string) $actual, trim((string) $expected, '%')) === false) {
                    return false;
                }
                if ($operator === '=' && (string) $actual !== (string) $expected) {
                    return false;
                }
            }

            return true;
        }
    }
}

namespace addons\vodops\service {
    class DoubanGateway
    {
        public static $subjectCalls = [];
        public static $subjectResponses = [];
        public static $searchCalls = [];
        public static $searchResponses = [];

        public static function subject(string $doubanId): array
        {
            self::$subjectCalls[] = $doubanId;
            $response = self::$subjectResponses[$doubanId] ?? [];
            if ($response instanceof \Throwable) {
                throw $response;
            }

            return $response;
        }

        public static function search(string $query, int $limit = 5): array
        {
            self::$searchCalls[] = [$query, $limit];
            $response = self::$searchResponses[$query] ?? [];
            if ($response instanceof \Throwable) {
                throw $response;
            }

            return $response;
        }
    }
}

namespace {

require __DIR__ . '/../addons/vodops/service/DoubanActionException.php';
require __DIR__ . '/../addons/vodops/service/DoubanMatcher.php';
require __DIR__ . '/../addons/vodops/service/DoubanData.php';

use addons\vodops\service\DoubanData;
use addons\vodops\service\DoubanGateway;
use think\Db;

$defaults = DoubanData::configDefaults();
if (($defaults['douban_endpoint'] ?? '') !== 'internal') {
    fwrite(STDERR, "The default Douban endpoint should use the internal gateway\n");
    exit(1);
}
if (($defaults['max_attempts'] ?? 0) !== 5) {
    fwrite(STDERR, "The default task retry limit should be five attempts\n");
    exit(1);
}

$listVideosMethod = new ReflectionMethod(DoubanData::class, 'listVideos');
$listVideoParameters = array_map(static function (ReflectionParameter $parameter): string {
    return $parameter->getName();
}, $listVideosMethod->getParameters());
if ($listVideoParameters !== ['status', 'page', 'limit', 'q', 'typeId', 'year']) {
    fwrite(STDERR, "Video listing should accept name, category, and year filters\n");
    exit(1);
}

$videoQueryMethod = new ReflectionMethod(DoubanData::class, 'videoQuery');
$videoQueryParameters = array_map(static function (ReflectionParameter $parameter): string {
    return $parameter->getName();
}, $videoQueryMethod->getParameters());
if ($videoQueryParameters !== ['status', 'q', 'typeId', 'year']) {
    fwrite(STDERR, "Video query should receive category and year filters\n");
    exit(1);
}

function assertResolvedId(string $expected, array $meta, array $vod, string $message): void
{
    $method = new ReflectionMethod(DoubanData::class, 'resolveDoubanId');
    $method->setAccessible(true);
    $actual = $method->invoke(null, $meta, $vod);
    if ($expected !== $actual) {
        fwrite(STDERR, $message . ': expected ' . var_export($expected, true) . ', got ' . var_export($actual, true) . PHP_EOL);
        exit(1);
    }
}

assertResolvedId('', [], ['vod_douban_id' => 0], 'Numeric zero should be treated as a missing Douban ID');
assertResolvedId('', ['douban_id' => '000'], [], 'All-zero metadata should be treated as a missing Douban ID');
assertResolvedId('1295644', [], ['vod_douban_id' => '1295644'], 'A valid video Douban ID should be preserved');
assertResolvedId('1292052', ['douban_id' => '1292052'], ['vod_douban_id' => '1295644'], 'Metadata should take precedence');

$validateMethod = new ReflectionMethod(DoubanData::class, 'validateDoubanData');
$validateMethod->setAccessible(true);
$validated = $validateMethod->invoke(null, [
    'id' => '1295644',
    'score' => '9.4',
    'vod_name' => '这个杀手不太冷',
], '1295644');
if (($validated['vod_douban_score'] ?? '') !== '9.4' || ($validated['vod_score'] ?? '') !== '9.4') {
    fwrite(STDERR, "Custom endpoint score should be normalized\n");
    exit(1);
}

$missingScoreRejected = false;
try {
    $validateMethod->invoke(null, ['id' => '1295644'], '1295644');
} catch (RuntimeException $e) {
    $missingScoreRejected = $e->getMessage() === '豆瓣数据源未返回有效评分';
}
if (!$missingScoreRejected) {
    fwrite(STDERR, "Custom endpoint responses without a score should be rejected\n");
    exit(1);
}

$mismatchedIdRejected = false;
try {
    $validateMethod->invoke(null, ['id' => '1292052', 'score' => '9.7'], '1295644');
} catch (RuntimeException $e) {
    $mismatchedIdRejected = $e->getMessage() === '豆瓣数据源ID与请求不一致';
}
if (!$mismatchedIdRejected) {
    fwrite(STDERR, "Custom endpoint responses for another subject should be rejected\n");
    exit(1);
}

$syncChangesMethod = new ReflectionMethod(DoubanData::class, 'syncChangesForView');
$syncChangesMethod->setAccessible(true);
$syncChanges = $syncChangesMethod->invoke(null, [
    'vod_douban_score' => '0.0',
    'vod_content' => '旧简介',
], [
    'vod_douban_score' => '9.4',
    'vod_content' => '新简介',
]);
if (($syncChanges[0]['label'] ?? '') !== '豆瓣评分'
    || ($syncChanges[0]['before'] ?? '') !== '0.0'
    || ($syncChanges[0]['after'] ?? '') !== '9.4'
    || ($syncChanges[1]['label'] ?? '') !== '简介'
    || ($syncChanges[1]['before'] ?? '') !== '旧简介'
    || ($syncChanges[1]['after'] ?? '') !== '新简介') {
    fwrite(STDERR, "Sync responses should expose readable before and after values\n");
    exit(1);
}

$rollbackPictureMethod = new ReflectionMethod(DoubanData::class, 'rollbackPictureSnapshot');
$rollbackPictureMethod->setAccessible(true);
$pictureSnapshot = $rollbackPictureMethod->invoke(null, [
    [
        'log_id' => 12,
        'old_values' => json_encode(['vod_score' => '8.0']),
        'new_values' => json_encode(['vod_score' => '9.4']),
    ],
    [
        'log_id' => 11,
        'old_values' => json_encode(['vod_pic' => '/upload/old.jpg']),
        'new_values' => json_encode(['vod_pic' => 'https://img.example/new.jpg']),
    ],
], 'https://img.example/new.jpg');
if (($pictureSnapshot['log_id'] ?? 0) !== 11
    || ($pictureSnapshot['before'] ?? '') !== 'https://img.example/new.jpg'
    || ($pictureSnapshot['after'] ?? '') !== '/upload/old.jpg') {
    fwrite(STDERR, "Picture rollback should select the latest image-changing sync snapshot\n");
    exit(1);
}

$changedPictureRejected = false;
try {
    $rollbackPictureMethod->invoke(null, [[
        'log_id' => 11,
        'old_values' => json_encode(['vod_pic' => '/upload/old.jpg']),
        'new_values' => json_encode(['vod_pic' => 'https://img.example/new.jpg']),
    ]], '/upload/manually-edited.jpg');
} catch (RuntimeException $e) {
    $changedPictureRejected = $e->getMessage() === '当前图片已被再次修改，未执行回退';
}
if (!$changedPictureRejected) {
    fwrite(STDERR, "Picture rollback should not overwrite a later manual edit\n");
    exit(1);
}

$emptyPreviousPictureRejected = false;
try {
    $rollbackPictureMethod->invoke(null, [[
        'log_id' => 11,
        'old_values' => json_encode(['vod_pic' => '']),
        'new_values' => json_encode(['vod_pic' => 'https://img.example/new.jpg']),
    ]], 'https://img.example/new.jpg');
} catch (RuntimeException $e) {
    $emptyPreviousPictureRejected = $e->getMessage() === '该次同步前没有可回退的图片';
}
if (!$emptyPreviousPictureRejected) {
    fwrite(STDERR, "Picture rollback should reject an empty previous image\n");
    exit(1);
}

$normalizeConfigMethod = new ReflectionMethod(DoubanData::class, 'normalizeConfig');
$normalizeConfigMethod->setAccessible(true);
$boundedConfig = $normalizeConfigMethod->invoke(null, ['max_attempts' => 99]);
if (($boundedConfig['max_attempts'] ?? 0) !== 10) {
    fwrite(STDERR, "Task retry limits should be capped at ten attempts\n");
    exit(1);
}

$endpointTargetMethod = new ReflectionMethod(DoubanData::class, 'endpointTarget');
$endpointTargetMethod->setAccessible(true);
$publicEndpoint = $endpointTargetMethod->invoke(null, 'https://8.8.8.8/douban');
if (($publicEndpoint['host'] ?? '') !== '8.8.8.8'
    || ($publicEndpoint['address'] ?? '') !== '8.8.8.8'
    || ($publicEndpoint['port'] ?? 0) !== 443) {
    fwrite(STDERR, "A public custom endpoint should retain a pinned public target\n");
    exit(1);
}
foreach ([
    'http://127.0.0.1/douban',
    'http://169.254.169.254/latest/meta-data',
    'http://10.0.0.8/douban',
] as $privateEndpoint) {
    $privateEndpointRejected = false;
    try {
        $endpointTargetMethod->invoke(null, $privateEndpoint);
    } catch (RuntimeException $e) {
        $privateEndpointRejected = $e->getMessage() === '豆瓣数据接口禁止访问私网或保留地址';
    }
    if (!$privateEndpointRejected) {
        fwrite(STDERR, "Custom endpoints should reject private target: {$privateEndpoint}\n");
        exit(1);
    }
}
$credentialEndpointRejected = false;
try {
    $endpointTargetMethod->invoke(null, 'https://user:pass@8.8.8.8/douban');
} catch (RuntimeException $e) {
    $credentialEndpointRejected = $e->getMessage() === '豆瓣数据接口地址不能包含账号、密码或片段';
}
if (!$credentialEndpointRejected) {
    fwrite(STDERR, "Custom endpoints should reject URL credentials\n");
    exit(1);
}
$nonstandardPortRejected = false;
try {
    $endpointTargetMethod->invoke(null, 'https://8.8.8.8:8443/douban');
} catch (RuntimeException $e) {
    $nonstandardPortRejected = $e->getMessage() === '豆瓣数据接口只允许标准 HTTP/HTTPS 端口';
}
if (!$nonstandardPortRejected) {
    fwrite(STDERR, "Custom endpoints should reject nonstandard ports\n");
    exit(1);
}

$applyAiReviewMethod = new ReflectionMethod(DoubanData::class, 'applyAiReview');
$applyAiReviewMethod->setAccessible(true);
$aiRanked = $applyAiReviewMethod->invoke(null, [
    'auto_confirm' => false,
    'candidates' => [
        ['douban_id' => '111', 'score_total' => 100, 'score_detail' => [], 'conflicts' => []],
        ['douban_id' => '222', 'score_total' => 100, 'score_detail' => [], 'conflicts' => []],
    ],
], [
    'status' => 'selected',
    'douban_id' => '222',
    'confidence' => 96,
    'reason' => '别名与演员信息一致',
]);
if (($aiRanked['candidates'][0]['douban_id'] ?? '') !== '222'
    || empty($aiRanked['ai_auto_confirm'])
    || (int) ($aiRanked['candidates'][0]['score_detail']['ai_recommended'] ?? 0) !== 1) {
    fwrite(STDERR, "AI review should only break a safe exact-match tie inside the candidate set\n");
    exit(1);
}

$unsafeAiRanked = $applyAiReviewMethod->invoke(null, [
    'auto_confirm' => false,
    'candidates' => [
        ['douban_id' => '333', 'score_total' => 75, 'score_detail' => [], 'conflicts' => []],
    ],
], [
    'status' => 'selected',
    'douban_id' => '333',
    'confidence' => 99,
    'reason' => '模型推荐但规则证据不足',
]);
if (!empty($unsafeAiRanked['ai_auto_confirm'])) {
    fwrite(STDERR, "AI confidence alone must not auto-confirm a weak deterministic match\n");
    exit(1);
}

$failureUpdateMethod = new ReflectionMethod(DoubanData::class, 'taskFailureUpdate');
$failureUpdateMethod->setAccessible(true);
$retryingUpdate = $failureUpdateMethod->invoke(null, 2, 5, 1000);
if (($retryingUpdate['status'] ?? '') !== 'PENDING' || ($retryingUpdate['run_after'] ?? 0) !== 2800) {
    fwrite(STDERR, "A retryable second failure should be delayed for thirty minutes\n");
    exit(1);
}
$terminalUpdate = $failureUpdateMethod->invoke(null, 5, 5, 1000);
if (($terminalUpdate['status'] ?? '') !== 'FAILED' || ($terminalUpdate['run_after'] ?? -1) !== 0) {
    fwrite(STDERR, "The final allowed attempt should move the task to FAILED\n");
    exit(1);
}

$reservationMethod = new ReflectionMethod(DoubanData::class, 'requestReservation');
$reservationMethod->setAccessible(true);
$immediateReservation = $reservationMethod->invoke(null, 100.0, 90.0, 2.0);
if (($immediateReservation['reserved_at'] ?? 0.0) !== 100.0 || ($immediateReservation['next_available_at'] ?? 0.0) !== 102.0) {
    fwrite(STDERR, "An idle global rate limiter should reserve the current slot\n");
    exit(1);
}
$queuedReservation = $reservationMethod->invoke(null, 100.0, 105.0, 2.0);
if (($queuedReservation['reserved_at'] ?? 0.0) !== 105.0 || ($queuedReservation['next_available_at'] ?? 0.0) !== 107.0) {
    fwrite(STDERR, "Concurrent workers should reserve non-overlapping request slots\n");
    exit(1);
}

$candidateMethod = new ReflectionMethod(DoubanData::class, 'candidateForView');
$candidateMethod->setAccessible(true);
$candidate = $candidateMethod->invoke(null, [
    'douban_id' => '1295644',
    'score_total' => 100,
    'score_detail' => json_encode([
        'title' => 75,
        'year' => 25,
        'candidate_title' => '这个杀手不太冷',
        'candidate_year' => '1994',
    ], JSON_UNESCAPED_UNICODE),
]);
if (($candidate['candidate_title'] ?? '') !== '这个杀手不太冷' || ($candidate['candidate_year'] ?? '') !== '1994') {
    fwrite(STDERR, "Saved candidates should expose title and year to the review page\n");
    exit(1);
}

$normalizeCandidatesMethod = new ReflectionMethod(DoubanData::class, 'normalizeCandidateRows');
$normalizeCandidatesMethod->setAccessible(true);
$normalizedCandidates = $normalizeCandidatesMethod->invoke(null, [
    ['douban_id' => 'subject/1292052/', 'title' => '非数字 ID'],
    ['id' => '0000', 'title' => '全零 ID'],
    ['id' => '1292052', 'title' => '<b>肖申克的救赎</b>', 'year' => '1994'],
    ['douban_id' => '1295644', 'title' => '', 'year' => '1994'],
], 5);
if (count($normalizedCandidates) !== 1
    || ($normalizedCandidates[0]['douban_id'] ?? '') !== '1292052'
    || ($normalizedCandidates[0]['title'] ?? '') !== '肖申克的救赎'
    || ($normalizedCandidates[0]['year'] ?? '') !== '1994') {
    fwrite(STDERR, "Custom candidate rows must reject malformed IDs and normalize trusted display fields\n");
    exit(1);
}

$categoryRows = [
    ['type_id' => 1, 'type_pid' => 0, 'type_mid' => 1, 'type_name' => '电影', 'type_sort' => 1],
    ['type_id' => 2, 'type_pid' => 1, 'type_mid' => 1, 'type_name' => '动作片', 'type_sort' => 1],
    ['type_id' => 3, 'type_pid' => 2, 'type_mid' => 1, 'type_name' => '功夫片', 'type_sort' => 1],
    ['type_id' => 4, 'type_pid' => 0, 'type_mid' => 1, 'type_name' => '剧集', 'type_sort' => 2],
    ['type_id' => 5, 'type_pid' => 1, 'type_mid' => 2, 'type_name' => '影评', 'type_sort' => 1],
];
$resolveTypesMethod = new ReflectionMethod(DoubanData::class, 'resolveCalibrationTypeIds');
$resolveTypesMethod->setAccessible(true);
$typeScope = $resolveTypesMethod->invoke(null, [1], true, $categoryRows);
if ($typeScope !== [1, 2, 3]) {
    fwrite(STDERR, "Category calibration should recursively include descendants\n");
    exit(1);
}
$exactTypeScope = $resolveTypesMethod->invoke(null, [2], false, $categoryRows);
if ($exactTypeScope !== [2]) {
    fwrite(STDERR, "Exact category calibration should not include descendants\n");
    exit(1);
}

$emptyTypeScopeRejected = false;
try {
    $resolveTypesMethod->invoke(null, [], true, $categoryRows);
} catch (InvalidArgumentException $e) {
    $emptyTypeScopeRejected = $e->getMessage() === '请至少选择一个分类';
}
if (!$emptyTypeScopeRejected) {
    fwrite(STDERR, "Category calibration should reject an empty scope\n");
    exit(1);
}

$unknownTypeRejected = false;
try {
    $resolveTypesMethod->invoke(null, [999], true, $categoryRows);
} catch (InvalidArgumentException $e) {
    $unknownTypeRejected = $e->getMessage() === '所选分类不存在';
}
if (!$unknownTypeRejected) {
    fwrite(STDERR, "Category calibration should reject unknown category IDs\n");
    exit(1);
}

$categoryOptionsMethod = new ReflectionMethod(DoubanData::class, 'categoryOptionsFromRows');
$categoryOptionsMethod->setAccessible(true);
$categoryOptions = $categoryOptionsMethod->invoke(null, $categoryRows);
$optionLabels = array_column($categoryOptions, 'display_name', 'type_id');
if (($optionLabels[3] ?? '') !== '电影 / 动作片 / 功夫片') {
    fwrite(STDERR, "Category options should expose a readable hierarchy path\n");
    exit(1);
}
if (isset($optionLabels[5])) {
    fwrite(STDERR, "Category calibration should not expose non-video categories\n");
    exit(1);
}

$auditIssuesMethod = new ReflectionMethod(DoubanData::class, 'auditVodIssues');
$auditIssuesMethod->setAccessible(true);
$auditIssues = $auditIssuesMethod->invoke(null, [
    'vod_id' => 99,
    'vod_name' => '边界影片',
    'type_id' => 1,
    'vod_year' => '',
    'vod_area' => str_repeat('中', 21),
    'vod_lang' => str_repeat('语', 11),
    'vod_douban_id' => '1290001',
    'vod_douban_score' => '8.8',
    'vod_score' => '7.0',
    'vod_status' => 0,
], [
    'vod_id' => 99,
    'douban_id' => '1290002',
    'douban_sync_fail_count' => 2,
    'douban_review_status' => 'REVIEW',
]);
$auditIssueCodes = array_column($auditIssues, 'issue_code');
foreach (['YEAR_MISSING', 'FIELD_TOO_LONG', 'DOUBAN_ID_CONFLICT', 'SCORE_MISMATCH', 'SYNC_FAILED', 'NEEDS_REVIEW', 'STATUS_DISABLED'] as $expectedCode) {
    if (!in_array($expectedCode, $auditIssueCodes, true)) {
        fwrite(STDERR, "Audit rules should report {$expectedCode}\n");
        exit(1);
    }
}

$scopeSqlMethod = new ReflectionMethod(DoubanData::class, 'scoreCalibrationScopeSql');
$scopeSqlMethod->setAccessible(true);
[$scopeSql, $scopeBind] = $scopeSqlMethod->invoke(null, [3, 1, 3]);
if ($scopeSql !== 'type_id IN (?,?)' || $scopeBind !== [3, 1]) {
    fwrite(STDERR, "Category calibration SQL should deduplicate IDs and bind placeholders\n");
    exit(1);
}

$calibrationUpdatesMethod = new ReflectionMethod(DoubanData::class, 'calibrationUpdates');
$calibrationUpdatesMethod->setAccessible(true);
$invalidCalibration = $calibrationUpdatesMethod->invoke(null, [
    'vod_douban_score' => '12.0',
    'vod_score' => '7.0',
]);
if ($invalidCalibration !== ['vod_douban_score' => 0, 'vod_score' => 0]) {
    fwrite(STDERR, "Invalid Douban scores should be reset by one bounded video task\n");
    exit(1);
}
$mirroredCalibration = $calibrationUpdatesMethod->invoke(null, [
    'vod_douban_score' => '8.8',
    'vod_score' => '7.0',
]);
if ($mirroredCalibration !== ['vod_score' => '8.8']) {
    fwrite(STDERR, "Valid Douban scores should be mirrored without changing the source score\n");
    exit(1);
}
$resetCalibration = $calibrationUpdatesMethod->invoke(null, [
    'vod_douban_score' => '0.0',
    'vod_score' => '7.0',
]);
if ($resetCalibration !== ['vod_score' => 0]) {
    fwrite(STDERR, "Missing Douban scores should clear only the mirrored score\n");
    exit(1);
}
$noopCalibration = $calibrationUpdatesMethod->invoke(null, [
    'vod_douban_score' => '9.4',
    'vod_score' => '9.4',
]);
if ($noopCalibration !== []) {
    fwrite(STDERR, "Already calibrated videos should not produce a write\n");
    exit(1);
}

$targetedFiltersMethod = new ReflectionMethod(DoubanData::class, 'normalizeTargetedFilters');
$targetedFiltersMethod->setAccessible(true);
$targetedFilters = $targetedFiltersMethod->invoke(null, [
    'type_ids' => [2],
    'include_children' => 1,
    'target' => 'missing_score',
    'year_from' => '2024',
    'year_to' => '2026',
    'q' => '喜剧片',
    'limit' => 999,
], $categoryRows);
if (($targetedFilters['type_ids'] ?? []) !== [2, 3]
    || ($targetedFilters['target'] ?? '') !== 'missing_score'
    || ($targetedFilters['year_from'] ?? 0) !== 2024
    || ($targetedFilters['year_to'] ?? 0) !== 2026
    || ($targetedFilters['q'] ?? '') !== '喜剧片'
    || ($targetedFilters['limit'] ?? 0) !== 500) {
    fwrite(STDERR, "Targeted task filters should normalize category, year, keyword, and limit inputs\n");
    exit(1);
}

$emptyTargetedScopeRejected = false;
try {
    $targetedFiltersMethod->invoke(null, ['type_ids' => []], $categoryRows);
} catch (InvalidArgumentException $e) {
    $emptyTargetedScopeRejected = $e->getMessage() === '请至少选择一个分类';
}
if (!$emptyTargetedScopeRejected) {
    fwrite(STDERR, "Targeted task generation should reject an empty category scope\n");
    exit(1);
}

$invalidTargetRejected = false;
try {
    $targetedFiltersMethod->invoke(null, ['type_ids' => [1], 'target' => 'unknown'], $categoryRows);
} catch (InvalidArgumentException $e) {
    $invalidTargetRejected = $e->getMessage() === '数据范围无效';
}
if (!$invalidTargetRejected) {
    fwrite(STDERR, "Targeted task generation should reject unknown data scopes\n");
    exit(1);
}

$invalidYearRejected = false;
try {
    $targetedFiltersMethod->invoke(null, [
        'type_ids' => [1],
        'year_from' => 2026,
        'year_to' => 2024,
    ], $categoryRows);
} catch (InvalidArgumentException $e) {
    $invalidYearRejected = $e->getMessage() === '起始年份不能大于结束年份';
}
if (!$invalidYearRejected) {
    fwrite(STDERR, "Targeted task generation should reject reversed year ranges\n");
    exit(1);
}

$malformedYearRejected = false;
try {
    $targetedFiltersMethod->invoke(null, [
        'type_ids' => [1],
        'year_from' => 'not-a-year',
    ], $categoryRows);
} catch (InvalidArgumentException $e) {
    $malformedYearRejected = $e->getMessage() === '年份范围无效';
}
if (!$malformedYearRejected) {
    fwrite(STDERR, "Targeted task generation should reject malformed year inputs\n");
    exit(1);
}

$targetedWhereMethod = new ReflectionMethod(DoubanData::class, 'targetedWhere');
$targetedWhereMethod->setAccessible(true);
[$targetedWhere, $targetedBind] = $targetedWhereMethod->invoke(
    null,
    $targetedFilters,
    [42, 47],
    'resolved_douban_id',
    1000
);
if (!str_contains($targetedWhere, 'v.type_id IN (?,?)')
    || !str_contains($targetedWhere, 'v.type_id NOT IN (?,?)')
    || !str_contains($targetedWhere, 'IFNULL(v.vod_douban_score, 0) = 0')
    || str_contains($targetedWhere, '喜剧片')
    || !in_array('%喜剧片%', $targetedBind, true)) {
    fwrite(STDERR, "Targeted task SQL should bind filters and keep user input out of the SQL string\n");
    exit(1);
}

$prepareTaskRowsMethod = new ReflectionMethod(DoubanData::class, 'prepareTaskRows');
$prepareTaskRowsMethod->setAccessible(true);
$preparedTasks = $prepareTaskRowsMethod->invoke(null, [
    ['vod_id' => 1, 'vod_name' => '待匹配影片', 'vod_year' => '2026'],
    ['vod_id' => 2, 'vod_name' => '待同步影片', 'vod_year' => '2025', 'meta_douban_id' => '1295644'],
    ['vod_id' => 3, 'vod_name' => '已有匹配任务', 'vod_year' => '2024'],
    ['vod_id' => 4, 'vod_name' => '已有同步任务', 'vod_year' => '2023', 'vod_douban_id' => '1292052'],
], [
    '3:MATCH_DOUBAN_ID' => true,
    '4:SYNC_DOUBAN' => true,
], 1000);
if (count($preparedTasks['task_rows'] ?? []) !== 2
    || ($preparedTasks['match_created'] ?? 0) !== 1
    || ($preparedTasks['sync_created'] ?? 0) !== 1
    || ($preparedTasks['match_vod_ids'] ?? []) !== [1]) {
    fwrite(STDERR, "Targeted task preparation should split task types and deduplicate active tasks\n");
    exit(1);
}

Db::$columns = [
    'vod' => ['vod_douban_id'],
];
Db::$tables = [
    'douban_config' => [
        ['config_key' => 'request_per_minute', 'config_value' => '300'],
        ['config_key' => 'candidate_topn', 'config_value' => '5'],
        ['config_key' => 'rate_limit_next_at', 'config_value' => '0', 'updated_at' => 0],
    ],
    'vod' => [
        ['vod_id' => 501, 'vod_name' => '绑定影片', 'vod_year' => '2024', 'vod_douban_id' => 0],
        ['vod_id' => 502, 'vod_name' => '精确标题影片', 'vod_year' => '2023', 'vod_douban_id' => 0],
        ['vod_id' => 503, 'vod_name' => '', 'vod_year' => '', 'vod_douban_id' => 0],
        ['vod_id' => 504, 'vod_name' => '无可用字段', 'vod_year' => '', 'vod_douban_id' => '1290004'],
        ['vod_id' => 505, 'vod_name' => '接口错误', 'vod_year' => '', 'vod_douban_id' => 0],
    ],
    'douban_vod_meta' => [
        ['vod_id' => 501, 'douban_id' => '1290001'],
        ['vod_id' => 502, 'douban_id' => ''],
        ['vod_id' => 503, 'douban_id' => ''],
        ['vod_id' => 504, 'douban_id' => ''],
        ['vod_id' => 505, 'douban_id' => ''],
    ],
    'douban_log' => [],
];
DoubanGateway::$subjectResponses = [
    '1290001' => [
        'id' => '1290001',
        'score' => '8.8',
        'title' => '绑定影片',
        'year' => '2024',
        'pic' => 'https://img.example/bound.jpg',
        'area' => ['中国大陆', '中国香港'],
        'language' => '汉语普通话',
    ],
    '1290004' => [
        'id' => '1290004',
        'score' => '7.0',
    ],
];
DoubanGateway::$searchResponses = [
    '精确标题影片' => [
        [
            'douban_id' => '1290002',
            'title' => '精确标题影片',
            'year' => '2023',
            'pic' => 'https://img.example/search.jpg',
            'country' => '中国大陆',
            'lang' => '汉语普通话',
        ],
        [
            'douban_id' => '1290003',
            'title' => '精确标题影片续集',
            'year' => '2023',
            'pic' => 'https://img.example/partial.jpg',
        ],
    ],
    '接口错误' => new RuntimeException('搜索接口暂时不可用'),
];

$vodBeforeCandidates = Db::$tables['vod'];
$metaBeforeCandidates = Db::$tables['douban_vod_meta'];
$boundCandidates = DoubanData::repairCandidates(501);
if (count($boundCandidates) !== 1
    || ($boundCandidates[0]['match_status'] ?? '') !== 'douban_id'
    || ($boundCandidates[0]['match_score'] ?? 0) !== 100
    || ($boundCandidates[0]['values'] ?? []) !== [
        'vod_pic' => 'https://img.example/bound.jpg',
        'vod_year' => '2024',
        'vod_area' => '中国大陆/中国香港',
        'vod_lang' => '汉语普通话',
    ]) {
    fwrite(STDERR, "A bound Douban ID should return read-only picture, year, area, and language candidates\n");
    exit(1);
}
if (DoubanGateway::$subjectCalls !== ['1290001'] || DoubanGateway::$searchCalls !== []) {
    fwrite(STDERR, "A bound Douban ID should fetch that subject without running title search\n");
    exit(1);
}
if (Db::$tables['vod'] !== $vodBeforeCandidates || Db::$tables['douban_vod_meta'] !== $metaBeforeCandidates || Db::$tables['douban_log'] !== []) {
    fwrite(STDERR, "Candidate lookup must not synchronize or mutate video and Douban metadata\n");
    exit(1);
}

$posterCandidate = DoubanData::posterCandidate(501);
if (($posterCandidate['pic_url'] ?? '') !== 'https://img.example/bound.jpg'
    || ($posterCandidate['provider_name'] ?? '') !== '豆瓣'
    || ($posterCandidate['match_status'] ?? '') !== 'douban_id') {
    fwrite(STDERR, "posterCandidate should remain compatible with the generic repair candidate result\n");
    exit(1);
}
if (Db::$tables['vod'] !== $vodBeforeCandidates || Db::$tables['douban_vod_meta'] !== $metaBeforeCandidates || Db::$tables['douban_log'] !== []) {
    fwrite(STDERR, "The compatible poster candidate lookup must remain read-only\n");
    exit(1);
}

DoubanGateway::$subjectCalls = [];
DoubanGateway::$searchCalls = [];
$searchCandidates = DoubanData::repairCandidates(502);
if (count($searchCandidates) !== 1
    || ($searchCandidates[0]['match_status'] ?? '') !== 'douban_search'
    || ($searchCandidates[0]['match_score'] ?? 0) !== 99
    || ($searchCandidates[0]['title'] ?? '') !== '精确标题影片'
    || ($searchCandidates[0]['values']['vod_pic'] ?? '') !== 'https://img.example/search.jpg'
    || ($searchCandidates[0]['values']['vod_year'] ?? '') !== '2023'
    || ($searchCandidates[0]['values']['vod_area'] ?? '') !== '中国大陆'
    || ($searchCandidates[0]['values']['vod_lang'] ?? '') !== '汉语普通话') {
    fwrite(STDERR, "An unbound video should expose exact-title search results as review candidates\n");
    exit(1);
}
if (DoubanGateway::$searchCalls !== [['精确标题影片', 5]] || DoubanGateway::$subjectCalls !== []) {
    fwrite(STDERR, "Unbound candidate lookup should search once without fetching or synchronizing a subject\n");
    exit(1);
}
if (Db::$tables['vod'] !== $vodBeforeCandidates || Db::$tables['douban_vod_meta'] !== $metaBeforeCandidates || Db::$tables['douban_log'] !== []) {
    fwrite(STDERR, "Title candidate lookup must not mutate video, metadata, or synchronization logs\n");
    exit(1);
}

$searchCallsBeforeEmptyTitle = DoubanGateway::$searchCalls;
if (DoubanData::repairCandidates(503) !== [] || DoubanGateway::$searchCalls !== $searchCallsBeforeEmptyTitle) {
    fwrite(STDERR, "A video without a title should return no candidates without calling Douban search\n");
    exit(1);
}
if (DoubanData::repairCandidates(504) !== []) {
    fwrite(STDERR, "A valid Douban response without repairable fields should return no candidates\n");
    exit(1);
}

foreach (Db::$tables['douban_config'] as $index => $row) {
    if (($row['config_key'] ?? '') === 'rate_limit_next_at') {
        Db::$tables['douban_config'][$index]['config_value'] = sprintf('%.6F', microtime(true) + 30);
    }
}
$searchCallsBeforeRateQueue = DoubanGateway::$searchCalls;
$rateQueueRejected = false;
try {
    DoubanData::repairCandidates(502);
} catch (RuntimeException $e) {
    $rateQueueRejected = strpos($e->getMessage(), '排队较长') !== false;
}
if (!$rateQueueRejected || DoubanGateway::$searchCalls !== $searchCallsBeforeRateQueue) {
    fwrite(STDERR, "Interactive candidate lookup must not wait behind a long shared Douban rate-limit queue\n");
    exit(1);
}
foreach (Db::$tables['douban_config'] as $index => $row) {
    if (($row['config_key'] ?? '') === 'rate_limit_next_at') {
        Db::$tables['douban_config'][$index]['config_value'] = '0';
    }
}

$invalidCandidateVodRejected = false;
try {
    DoubanData::repairCandidates(0);
} catch (InvalidArgumentException $e) {
    $invalidCandidateVodRejected = $e->getMessage() === 'vod_id missing';
}
if (!$invalidCandidateVodRejected) {
    fwrite(STDERR, "Candidate lookup should reject an invalid video ID\n");
    exit(1);
}

$missingCandidateVodRejected = false;
try {
    DoubanData::repairCandidates(999);
} catch (RuntimeException $e) {
    $missingCandidateVodRejected = $e->getMessage() === '影片不存在';
}
if (!$missingCandidateVodRejected) {
    fwrite(STDERR, "Candidate lookup should reject a missing video\n");
    exit(1);
}

$candidateSearchErrorPreserved = false;
try {
    DoubanData::repairCandidates(505);
} catch (RuntimeException $e) {
    $candidateSearchErrorPreserved = $e->getMessage() === '搜索接口暂时不可用';
}
if (!$candidateSearchErrorPreserved) {
    fwrite(STDERR, "Candidate lookup should preserve a search-provider failure for the caller to isolate\n");
    exit(1);
}
if (Db::$tables['vod'] !== $vodBeforeCandidates || Db::$tables['douban_vod_meta'] !== $metaBeforeCandidates || Db::$tables['douban_log'] !== []) {
    fwrite(STDERR, "Failed candidate lookup must not mutate video or metadata state\n");
    exit(1);
}

Db::$tables['vod'][0] = array_merge(Db::$tables['vod'][0], [
    'type_id' => 1,
    'type_name' => '电影',
    'douban_id' => '1290001',
    'douban_review_status' => 'REVIEW',
    'douban_review_reason' => '需要人工核查',
    'douban_last_sync_at' => 1700000000,
    'douban_id_locked' => 1,
    'intro_locked' => 1,
    'douban_ignore_until' => time() + 3600,
    'vod_pic' => 'https://img.example/new.jpg',
]);
Db::$tables['douban_review_candidate'] = [[
    'vod_id' => 501,
    'douban_id' => '1290001',
    'score_total' => 98,
    'score_detail' => json_encode(['candidate_title' => '绑定影片', 'candidate_year' => '2024'], JSON_UNESCAPED_UNICODE),
    'conflicts' => '[]',
    'rank' => 1,
]];
Db::$tables['douban_log'] = [[
    'log_id' => 21,
    'vod_id' => 501,
    'action' => 'AUTO_SYNC',
    'old_values' => json_encode(['vod_pic' => '/upload/old.jpg']),
    'new_values' => json_encode(['vod_pic' => 'https://img.example/new.jpg']),
]];
$videoState = DoubanData::videoState(501);
if (($videoState['vod_name'] ?? '') !== '绑定影片'
    || ($videoState['type_id'] ?? 0) !== 1
    || ($videoState['type_name'] ?? '') !== '电影'
    || ($videoState['vod_year'] ?? '') !== '2024'
    || ($videoState['display_douban_id'] ?? '') !== '1290001'
    || ($videoState['douban_review_status'] ?? '') !== 'REVIEW'
    || ($videoState['douban_last_sync_label'] ?? '-') === '-'
    || ($videoState['douban_id_locked'] ?? 0) !== 1
    || ($videoState['intro_locked'] ?? 0) !== 1
    || ($videoState['douban_ignore_until'] ?? 0) <= time()
    || ($videoState['is_ignored'] ?? 0) !== 1
    || ($videoState['can_rollback_pic'] ?? 0) !== 1
    || ($videoState['candidates'][0]['candidate_title'] ?? '') !== '绑定影片') {
    fwrite(STDERR, "Single-video responses should expose fresh row state for in-place rendering\n");
    exit(1);
}
$videoList = DoubanData::listVideos('all', 1, 20, '501');
$listedVideo = $videoList['data'][0] ?? [];
if (($listedVideo['is_ignored'] ?? 0) !== 1
    || ($listedVideo['douban_ignore_until_label'] ?? '-') === '-'
    || ($listedVideo['candidates'][0]['douban_id'] ?? '') !== '1290001') {
    fwrite(STDERR, "Initial video rows should expose ignore state and review candidates in the default listing\n");
    exit(1);
}
$reviewCollection = DoubanData::collectionState(501, 'review', '501', 0, '2024', 'PENDING');
if (($reviewCollection['row_matches'] ?? 0) !== 1
    || ($reviewCollection['total'] ?? 0) !== 1
    || !array_key_exists('stats', $reviewCollection)
    || !array_key_exists('task_stats', $reviewCollection)
    || !array_key_exists('tasks', $reviewCollection)) {
    fwrite(STDERR, "Single-video responses should expose the current filtered collection and dashboard state\n");
    exit(1);
}
Db::$tables['vod'][0]['douban_review_status'] = 'CONFIRMED';
if ((DoubanData::videoState(501)['candidates'] ?? null) !== []) {
    fwrite(STDERR, "Confirmed videos must not keep stale review candidates in the refreshed row\n");
    exit(1);
}
$updatedReviewCollection = DoubanData::collectionState(501, 'review', '501', 0, '2024', 'PENDING');
if (($updatedReviewCollection['row_matches'] ?? 1) !== 0 || ($updatedReviewCollection['total'] ?? 1) !== 0) {
    fwrite(STDERR, "Collection state must remove a row that no longer matches the active review filter\n");
    exit(1);
}

echo "Douban data tests passed\n";
}
