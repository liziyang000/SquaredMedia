<?php

namespace addons\vodops\service;

use think\Db;

class VodQualityExportException extends \RuntimeException
{
}

class VodQualityActionException extends \RuntimeException
{
}

class VodQualityScanner
{
    private const LOCK_TABLE = 'vodops_lock';
    private const SCAN_TABLE = 'vodops_scan';
    private const ISSUE_TABLE = 'vodops_issue';
    private const FINGERPRINT_TABLE = 'vodops_fingerprint';
    private const VOD_FIELDS = 'vod_id,vod_name,type_id,type_id_1,vod_year,vod_area,vod_lang,vod_pic,vod_play_from,vod_play_url';
    private const DEFAULT_BATCH_SIZE = 500;
    private const MIN_BATCH_SIZE = 100;
    private const MAX_BATCH_SIZE = 1000;
    private const EXPORT_LIMIT = 50000;
    private const WORKER_LEASE_SECONDS = 180;
    private const WORKER_RETRY_SECONDS = 30;
    private const PUBLIC_SCAN_ERROR = '本批扫描失败，请查看服务端日志后重试。';

    public static function issueTypes()
    {
        return VodQualityAnalyzer::issueTypes();
    }

    public static function categoryOptions()
    {
        return self::categoryOptionsFromMap(self::typeMap());
    }

    public static function startScan($adminId, $batchSize = self::DEFAULT_BATCH_SIZE, $scopeTypeId = 0, $workerMode = false)
    {
        $batchSize = max(self::MIN_BATCH_SIZE, min(self::MAX_BATCH_SIZE, intval($batchSize)));
        $scope = self::categoryScope($scopeTypeId, self::typeMap());
        $executionMode = $workerMode ? 'worker' : 'manual';
        Db::startTrans();
        try {
            $lock = self::rowToArray(Db::name(self::LOCK_TABLE)
                ->where('lock_name', 'scan_start')
                ->lock(true)
                ->find());
            if (empty($lock)) {
                throw new \RuntimeException('VodOps 安装不完整：缺少扫描锁。');
            }

            $active = self::rowToArray(Db::name(self::SCAN_TABLE)
                ->where('status', 'running')
                ->order('run_id desc')
                ->find());
            if (!empty($active)) {
                $activeScope = self::scopeFromScan($active, true);
                if (intval($activeScope['type_id']) !== intval($scope['type_id'])) {
                    throw new VodQualityActionException(
                        '已有“' . self::scopeDisplayLabel($activeScope) . '”扫描正在进行，请先继续或结束该任务。'
                    );
                }
                if (self::normalizeExecutionMode($active['execution_mode'] ?? '') !== $executionMode) {
                    Db::name(self::SCAN_TABLE)->where('run_id', intval($active['run_id'] ?? 0))->update([
                        'execution_mode' => $executionMode,
                        'lease_until' => 0,
                        'next_run_at' => 0,
                    ]);
                    $active['execution_mode'] = $executionMode;
                    $active['lease_until'] = 0;
                    $active['next_run_at'] = 0;
                }
                Db::commit();
                $active = self::decorateScan($active);
                $active['reused'] = true;
                return $active;
            }

            $runId = self::createScanLocked($adminId, $batchSize, $scope, $executionMode);
            Db::commit();
        } catch (VodQualityActionException $e) {
            Db::rollback();
            throw $e;
        } catch (\Throwable $e) {
            Db::rollback();
            self::logFailure('start scan', $e);
            throw $e;
        }

        return self::getScan($runId);
    }

    public static function ensureScheduledScan($intervalSeconds, $scopeTypeId = 0, $batchSize = self::DEFAULT_BATCH_SIZE)
    {
        $intervalSeconds = max(3600, min(720 * 3600, intval($intervalSeconds)));
        $batchSize = max(self::MIN_BATCH_SIZE, min(self::MAX_BATCH_SIZE, intval($batchSize)));
        $scope = self::categoryScope($scopeTypeId, self::typeMap());

        Db::startTrans();
        try {
            $lock = self::rowToArray(Db::name(self::LOCK_TABLE)
                ->where('lock_name', 'scan_start')
                ->lock(true)
                ->find());
            if (empty($lock)) {
                throw new \RuntimeException('VodOps 安装不完整：缺少扫描锁。');
            }

            $active = self::rowToArray(Db::name(self::SCAN_TABLE)
                ->where('status', 'running')
                ->order('run_id desc')
                ->find());
            if (!empty($active)) {
                Db::commit();
                return [
                    'created' => false,
                    'reason' => 'active',
                    'scan' => self::decorateScan($active),
                ];
            }

            $latest = self::rowToArray(Db::name(self::SCAN_TABLE)
                ->where('status', 'in', ['completed', 'cancelled'])
                ->where('execution_mode', 'in', ['traffic', 'worker'])
                ->order('run_id desc')
                ->find());
            $now = time();
            if (!empty($latest) && $now - intval($latest['started_at'] ?? 0) < $intervalSeconds) {
                Db::commit();
                return [
                    'created' => false,
                    'reason' => 'not_due',
                    'scan' => self::decorateScan($latest),
                ];
            }

            $runId = self::createScanLocked(0, $batchSize, $scope, 'worker');
            Db::commit();
        } catch (\Throwable $e) {
            Db::rollback();
            self::logFailure('schedule scan', $e);
            throw $e;
        }

        return [
            'created' => true,
            'reason' => 'due',
            'scan' => self::getScan($runId),
        ];
    }

    public static function runWorker($maxChunks = 20, $maxSeconds = 50)
    {
        $maxChunks = max(1, min(100, intval($maxChunks)));
        $maxSeconds = max(1, min(300, intval($maxSeconds)));
        $startedAt = microtime(true);
        $chunks = 0;
        $scan = [];

        while ($chunks < $maxChunks && microtime(true) - $startedAt < $maxSeconds) {
            $scan = self::runWorkerChunk();
            if (empty($scan)) {
                break;
            }
            $chunks++;
            if (($scan['status'] ?? '') !== 'running') {
                break;
            }
        }

        return [
            'chunks' => $chunks,
            'idle' => $chunks === 0,
            'scan' => $scan,
        ];
    }

    public static function runWorkerChunk()
    {
        $now = time();
        $candidate = self::rowToArray(Db::name(self::SCAN_TABLE)
            ->where('status', 'running')
            ->where('execution_mode', 'in', ['traffic', 'worker'])
            ->where('lease_until', '<=', $now)
            ->where('next_run_at', '<=', $now)
            ->order('run_id desc')
            ->find());
        if (empty($candidate)) {
            return [];
        }

        $runId = intval($candidate['run_id'] ?? 0);
        $claimedUntil = $now + self::WORKER_LEASE_SECONDS;
        $claimed = intval(Db::name(self::SCAN_TABLE)
            ->where('run_id', $runId)
            ->where('status', 'running')
            ->where('execution_mode', 'in', ['traffic', 'worker'])
            ->where('lease_until', '<=', $now)
            ->where('next_run_at', '<=', $now)
            ->update([
                'lease_until' => $claimedUntil,
                'updated_at' => $now,
            ]));
        if ($claimed !== 1) {
            return [];
        }

        try {
            $scan = self::runChunk($runId);
        } catch (\Throwable $e) {
            self::releaseWorkerLease($runId, $claimedUntil, time() + self::WORKER_RETRY_SECONDS);
            throw $e;
        }

        self::releaseWorkerLease($runId, $claimedUntil, 0);
        return self::getScan($runId);
    }

    public static function runChunk($runId)
    {
        $runId = intval($runId);
        if ($runId < 1) {
            throw new \InvalidArgumentException('扫描任务 ID 无效。');
        }

        Db::startTrans();
        try {
            $scan = self::rowToArray(Db::name(self::SCAN_TABLE)
                ->where('run_id', $runId)
                ->lock(true)
                ->find());
            if (empty($scan)) {
                throw new \RuntimeException('扫描任务不存在。');
            }
            if (($scan['status'] ?? '') !== 'running') {
                if (in_array(($scan['status'] ?? ''), ['completed', 'cancelled'], true)) {
                    self::cleanupFingerprints($runId);
                }
                Db::commit();
                return self::decorateScan($scan);
            }

            $scope = self::scopeFromScan($scan, true);
            $scopeTypeIds = $scope['type_ids'];
            $rows = self::rowsToArray(self::vodQuery($scopeTypeIds)
                ->where('vod_id', '>', intval($scan['last_vod_id'] ?? 0))
                ->where('vod_id', '<=', intval($scan['max_vod_id'] ?? 0))
                ->field(self::VOD_FIELDS)
                ->order('vod_id asc')
                ->limit(max(self::MIN_BATCH_SIZE, min(self::MAX_BATCH_SIZE, intval($scan['batch_size'] ?? self::DEFAULT_BATCH_SIZE))))
                ->select());

            if (empty($rows)) {
                self::finishScan($scan);
                Db::commit();
                return self::getScan($runId);
            }

            $typeMap = self::typeMap();
            $context = self::siteContext();
            $issueRows = [];
            $fingerprintRows = [];
            $fingerprints = [];
            foreach ($rows as $vod) {
                foreach (VodQualityAnalyzer::analyze($vod, $typeMap, $context) as $issue) {
                    $issueRows[] = self::issueRow($runId, $vod, $issue);
                }
                $fingerprint = VodQualityAnalyzer::strictFingerprint($vod);
                if ($fingerprint !== null) {
                    $vodId = intval($vod['vod_id'] ?? 0);
                    $fingerprints[$vodId] = $fingerprint;
                    $fingerprintRows[] = [
                        'run_id' => $runId,
                        'vod_id' => $vodId,
                        'fingerprint' => $fingerprint,
                    ];
                }
            }

            $existingFingerprints = self::existingFingerprints($runId, array_values($fingerprints));
            if (!empty($issueRows) && Db::name(self::ISSUE_TABLE)->insertAll($issueRows) === false) {
                throw new \RuntimeException('异常明细写入失败。');
            }
            if (!empty($fingerprintRows) && Db::name(self::FINGERPRINT_TABLE)->insertAll($fingerprintRows) === false) {
                throw new \RuntimeException('重复指纹写入失败。');
            }
            $newIssueCount = count($issueRows)
                + self::recordDuplicateIssues($runId, $rows, $fingerprints, $existingFingerprints);

            $lastRow = $rows[count($rows) - 1];
            $lastVodId = intval($lastRow['vod_id'] ?? 0);
            $processedCount = intval($scan['processed_count'] ?? 0) + count($rows);
            $completed = $lastVodId >= intval($scan['max_vod_id'] ?? 0);
            $update = [
                'last_vod_id' => $lastVodId,
                'processed_count' => $processedCount,
                'issue_count' => intval($scan['issue_count'] ?? 0) + $newIssueCount,
                'updated_at' => time(),
                'error_message' => '',
            ];
            if ($completed) {
                $update['status'] = 'completed';
                $update['finished_by'] = intval($scan['started_by'] ?? 0);
                $update['finished_at'] = time();
                $update['lease_until'] = 0;
                $update['next_run_at'] = 0;
            }
            Db::name(self::SCAN_TABLE)->where('run_id', $runId)->update($update);
            if ($completed) {
                self::cleanupFingerprints($runId);
            }
            Db::commit();

            return self::getScan($runId);
        } catch (\Throwable $e) {
            Db::rollback();
            try {
                Db::name(self::SCAN_TABLE)->where('run_id', $runId)->update([
                    'updated_at' => time(),
                    'error_message' => self::PUBLIC_SCAN_ERROR,
                ]);
            } catch (\Throwable $ignored) {
            }
            self::logFailure('run scan chunk', $e);
            throw $e;
        }
    }

    public static function cancelScan($runId, $adminId)
    {
        $runId = intval($runId);
        if ($runId < 1) {
            throw new \InvalidArgumentException('扫描任务 ID 无效。');
        }

        Db::startTrans();
        try {
            $scan = self::rowToArray(Db::name(self::SCAN_TABLE)
                ->where('run_id', $runId)
                ->lock(true)
                ->find());
            if (empty($scan)) {
                throw new \RuntimeException('扫描任务不存在。');
            }
            if (($scan['status'] ?? '') === 'running') {
                Db::name(self::SCAN_TABLE)->where('run_id', $runId)->update([
                    'status' => 'cancelled',
                    'finished_by' => max(0, intval($adminId)),
                    'finished_at' => time(),
                    'updated_at' => time(),
                    'issue_count' => intval($scan['issue_count'] ?? 0),
                    'error_message' => '',
                    'lease_until' => 0,
                    'next_run_at' => 0,
                ]);
                $scan['status'] = 'cancelled';
            }
            if (in_array(($scan['status'] ?? ''), ['completed', 'cancelled'], true)) {
                self::cleanupFingerprints($runId);
            }
            Db::commit();
        } catch (\Throwable $e) {
            Db::rollback();
            self::logFailure('cancel scan', $e);
            throw $e;
        }

        return self::getScan($runId);
    }

    public static function deleteScan($runId, $adminId)
    {
        $runId = intval($runId);
        if ($runId < 1) {
            throw new \InvalidArgumentException('扫描任务 ID 无效。');
        }

        Db::startTrans();
        try {
            $scan = self::rowToArray(Db::name(self::SCAN_TABLE)
                ->where('run_id', $runId)
                ->lock(true)
                ->find());
            if (empty($scan)) {
                throw new \RuntimeException('扫描任务不存在。');
            }
            if (($scan['status'] ?? '') === 'running') {
                throw new \RuntimeException('进行中的扫描不能删除，请先结束任务。');
            }

            Db::name(self::ISSUE_TABLE)->where('run_id', $runId)->delete();
            Db::name(self::FINGERPRINT_TABLE)->where('run_id', $runId)->delete();
            Db::name(self::SCAN_TABLE)->where('run_id', $runId)->delete();
            Db::commit();
        } catch (\Throwable $e) {
            Db::rollback();
            self::logFailure('delete scan', $e);
            throw $e;
        }

        if (function_exists('trace')) {
            try {
                trace(
                    '[vodops] admin #' . max(0, intval($adminId)) . ' deleted scan #' . $runId
                    . ' (' . ($scan['status'] ?? 'unknown') . ', ' . intval($scan['issue_count'] ?? 0) . ' issues)',
                    'info'
                );
            } catch (\Throwable $ignored) {
            }
        }

        return ['run_id' => $runId, 'deleted' => true];
    }

    public static function listScans($limit = 20)
    {
        $rows = self::rowsToArray(Db::name(self::SCAN_TABLE)
            ->order('run_id desc')
            ->limit(max(1, min(50, intval($limit))))
            ->select());
        return array_map([self::class, 'decorateScan'], $rows);
    }

    public static function getScan($runId = 0)
    {
        $query = Db::name(self::SCAN_TABLE);
        if (intval($runId) > 0) {
            $query->where('run_id', intval($runId));
        } else {
            $query->order('run_id desc');
        }
        $scan = self::rowToArray($query->find());
        return empty($scan) ? [] : self::decorateScan($scan);
    }

    public static function issueSummary($runId)
    {
        $rows = self::rowsToArray(Db::name(self::ISSUE_TABLE)
            ->where('run_id', intval($runId))
            ->field('issue_type,count(*) as total')
            ->group('issue_type')
            ->order('total desc')
            ->select());
        $summary = [];
        foreach ($rows as $row) {
            $type = (string) ($row['issue_type'] ?? '');
            if (isset(self::issueTypes()[$type])) {
                $summary[$type] = intval($row['total'] ?? 0);
            }
        }
        return $summary;
    }

    public static function listIssues($runId, $issueType = '', $query = '', $page = 1, $limit = 30)
    {
        $runId = intval($runId);
        $page = max(1, intval($page));
        $limit = max(10, min(100, intval($limit)));
        $issueType = self::normalizeIssueType($issueType);
        $query = self::normalizeQuery($query);

        $total = intval(self::issueQuery($runId, $issueType, $query)->count());
        $rows = self::rowsToArray(self::issueQuery($runId, $issueType, $query)
            ->order('issue_id desc')
            ->page($page, $limit)
            ->select());
        foreach ($rows as &$row) {
            $row = self::decorateIssue($row);
        }
        unset($row);

        return [
            'list' => $rows,
            'page' => $page,
            'pagecount' => intval(ceil($total / $limit)),
            'total' => $total,
            'limit' => $limit,
        ];
    }

    public static function exportIssues($runId, $issueType = '', $query = '')
    {
        $runId = intval($runId);
        $scan = self::getScan($runId);
        if (empty($scan)) {
            throw new VodQualityExportException('扫描任务不存在。');
        }
        if (($scan['status'] ?? '') === 'running') {
            throw new VodQualityExportException('扫描仍在进行，请等待完成或先结束任务后再导出。');
        }
        $issueType = self::normalizeIssueType($issueType);
        $query = self::normalizeQuery($query);
        $total = intval(self::issueQuery($runId, $issueType, $query)->count());
        if ($total > self::EXPORT_LIMIT) {
            throw new VodQualityExportException('导出结果超过 50000 条，请先选择异常类型或搜索条件。');
        }

        $rows = self::rowsToArray(self::issueQuery($runId, $issueType, $query)
            ->order('issue_id asc')
            ->limit(self::EXPORT_LIMIT)
            ->select());
        $handle = fopen('php://temp', 'w+b');
        if ($handle === false) {
            throw new \RuntimeException('无法创建导出文件。');
        }
        fwrite($handle, "\xEF\xBB\xBF");
        self::writeCsvRow($handle, [
            'issue_id', 'run_id', 'vod_id', 'vod_name', 'type_id', 'issue_type',
            'issue_label', 'field_name', 'current_value', 'message', 'detail_json', 'created_at',
        ]);
        foreach ($rows as $row) {
            self::writeCsvRow($handle, [
                intval($row['issue_id'] ?? 0),
                intval($row['run_id'] ?? 0),
                intval($row['vod_id'] ?? 0),
                self::csvCell($row['vod_name'] ?? ''),
                intval($row['type_id'] ?? 0),
                (string) ($row['issue_type'] ?? ''),
                (string) (self::issueTypes()[$row['issue_type'] ?? ''] ?? '未知异常'),
                (string) ($row['field_name'] ?? ''),
                self::csvCell($row['current_value'] ?? ''),
                self::csvCell($row['message'] ?? ''),
                self::csvCell($row['detail_json'] ?? ''),
                date('Y-m-d H:i:s', intval($row['created_at'] ?? 0)),
            ]);
        }
        rewind($handle);
        $content = stream_get_contents($handle);
        fclose($handle);

        $scopeSuffix = intval($scan['scope_type_id'] ?? 0) > 0 ? '-type-' . intval($scan['scope_type_id']) : '';
        $suffix = $issueType === '' ? '' : '-' . preg_replace('/[^a-z0-9_]/', '', $issueType);
        return [
            'filename' => 'vodops-run-' . $runId . $scopeSuffix . $suffix . '.csv',
            'content' => (string) $content,
        ];
    }

    private static function createScanLocked($adminId, $batchSize, array $scope, $executionMode)
    {
        $maxVodId = intval(self::vodQuery($scope['type_ids'])->max('vod_id'));
        $totalCount = $maxVodId > 0
            ? intval(self::vodQuery($scope['type_ids'])->where('vod_id', '<=', $maxVodId)->count())
            : 0;
        $now = time();
        return Db::name(self::SCAN_TABLE)->insertGetId([
            'status' => 'running',
            'total_count' => $totalCount,
            'max_vod_id' => $maxVodId,
            'last_vod_id' => 0,
            'processed_count' => 0,
            'issue_count' => 0,
            'batch_size' => max(self::MIN_BATCH_SIZE, min(self::MAX_BATCH_SIZE, intval($batchSize))),
            'started_by' => max(0, intval($adminId)),
            'finished_by' => 0,
            'started_at' => $now,
            'finished_at' => 0,
            'updated_at' => $now,
            'error_message' => '',
            'scope_json' => self::jsonEncode($scope),
            'execution_mode' => self::normalizeExecutionMode($executionMode),
            'lease_until' => 0,
            'next_run_at' => 0,
        ]);
    }

    private static function finishScan(array $scan)
    {
        $runId = intval($scan['run_id'] ?? 0);
        Db::name(self::SCAN_TABLE)->where('run_id', $runId)->update([
            'status' => 'completed',
            'processed_count' => intval($scan['processed_count'] ?? 0),
            'issue_count' => intval($scan['issue_count'] ?? 0),
            'finished_by' => intval($scan['started_by'] ?? 0),
            'finished_at' => time(),
            'updated_at' => time(),
            'error_message' => '',
            'lease_until' => 0,
            'next_run_at' => 0,
        ]);
        self::cleanupFingerprints($runId);
    }

    private static function releaseWorkerLease($runId, $claimedUntil, $nextRunAt)
    {
        Db::name(self::SCAN_TABLE)
            ->where('run_id', intval($runId))
            ->where('lease_until', $claimedUntil)
            ->update([
                'lease_until' => 0,
                'next_run_at' => max(0, intval($nextRunAt)),
            ]);
    }

    private static function cleanupFingerprints($runId)
    {
        Db::name(self::FINGERPRINT_TABLE)
            ->where('run_id', intval($runId))
            ->delete();
    }

    private static function existingFingerprints($runId, array $fingerprints)
    {
        $fingerprints = array_values(array_unique(array_filter($fingerprints)));
        if (empty($fingerprints)) {
            return [];
        }
        return self::rowsToArray(Db::name(self::FINGERPRINT_TABLE)
            ->where('run_id', intval($runId))
            ->where('fingerprint', 'in', $fingerprints)
            ->field('vod_id,fingerprint')
            ->select());
    }

    private static function recordDuplicateIssues($runId, array $currentRows, array $fingerprints, array $existingFingerprints)
    {
        $groups = [];
        foreach ($existingFingerprints as $row) {
            $fingerprint = (string) ($row['fingerprint'] ?? '');
            $vodId = intval($row['vod_id'] ?? 0);
            if ($fingerprint !== '' && $vodId > 0) {
                $groups[$fingerprint][$vodId] = $vodId;
            }
        }
        foreach ($fingerprints as $vodId => $fingerprint) {
            $groups[$fingerprint][intval($vodId)] = intval($vodId);
        }
        $groups = array_filter($groups, static function ($ids) {
            return count($ids) > 1;
        });
        if (empty($groups)) {
            return 0;
        }

        $groupByVodId = [];
        foreach ($groups as $fingerprint => $ids) {
            $sortedIds = array_values($ids);
            sort($sortedIds, SORT_NUMERIC);
            foreach ($sortedIds as $vodId) {
                $groupByVodId[$vodId] = [
                    'fingerprint' => $fingerprint,
                    'vod_ids' => $sortedIds,
                ];
            }
        }

        $vodRows = [];
        foreach ($currentRows as $row) {
            $vodRows[intval($row['vod_id'] ?? 0)] = $row;
        }
        $missingIds = array_values(array_diff(array_keys($groupByVodId), array_keys($vodRows)));
        if (!empty($missingIds)) {
            foreach (self::rowsToArray(Db::name('vod')->where('vod_id', 'in', $missingIds)->field(self::VOD_FIELDS)->select()) as $row) {
                $vodRows[intval($row['vod_id'] ?? 0)] = $row;
            }
        }

        $existingIssues = [];
        foreach (self::rowsToArray(Db::name(self::ISSUE_TABLE)
            ->where('run_id', intval($runId))
            ->where('issue_type', 'exact_duplicate')
            ->where('vod_id', 'in', array_keys($groupByVodId))
            ->field('issue_id,vod_id')
            ->select()) as $row) {
            $existingIssues[intval($row['vod_id'] ?? 0)] = intval($row['issue_id'] ?? 0);
        }

        $insertedCount = 0;
        foreach ($groupByVodId as $vodId => $group) {
            if (empty($vodRows[$vodId])) {
                continue;
            }
            $peerIds = array_values(array_diff($group['vod_ids'], [$vodId]));
            $detailJson = self::jsonEncode([
                'fingerprint' => $group['fingerprint'],
                'vod_ids' => $group['vod_ids'],
            ]);
            $message = '与视频 #' . implode('、#', $peerIds) . ' 的分类、年份和完整播放载荷完全一致，请人工复核。';
            if (!empty($existingIssues[$vodId])) {
                Db::name(self::ISSUE_TABLE)->where('issue_id', $existingIssues[$vodId])->update([
                    'message' => VodQualityAnalyzer::sanitizeValue($message),
                    'detail_json' => $detailJson,
                ]);
                continue;
            }
            $inserted = Db::name(self::ISSUE_TABLE)->insert(self::issueRow($runId, $vodRows[$vodId], [
                'issue_type' => 'exact_duplicate',
                'field_name' => 'vod_play_url',
                'current_value' => '',
                'message' => $message,
                'detail' => [
                    'fingerprint' => $group['fingerprint'],
                    'vod_ids' => $group['vod_ids'],
                ],
            ]));
            if ($inserted === false) {
                throw new \RuntimeException('重复候选异常写入失败。');
            }
            $insertedCount++;
        }

        return $insertedCount;
    }

    private static function issueRow($runId, array $vod, array $issue)
    {
        return [
            'run_id' => intval($runId),
            'vod_id' => intval($vod['vod_id'] ?? 0),
            'vod_name' => VodQualityAnalyzer::sanitizeValue($vod['vod_name'] ?? '', 250),
            'type_id' => intval($vod['type_id'] ?? 0),
            'issue_type' => (string) ($issue['issue_type'] ?? ''),
            'field_name' => VodQualityAnalyzer::sanitizeValue($issue['field_name'] ?? '', 40),
            'current_value' => VodQualityAnalyzer::sanitizeValue($issue['current_value'] ?? ''),
            'message' => VodQualityAnalyzer::sanitizeValue($issue['message'] ?? ''),
            'detail_json' => self::jsonEncode($issue['detail'] ?? []),
            'created_at' => time(),
        ];
    }

    private static function typeMap()
    {
        $map = [];
        foreach (self::rowsToArray(Db::name('type')->field('type_id,type_pid,type_name,type_sort')->select()) as $row) {
            $typeId = intval($row['type_id'] ?? 0);
            if ($typeId > 0) {
                $map[$typeId] = $row;
            }
        }
        return $map;
    }

    private static function categoryScope($scopeTypeId, array $typeMap)
    {
        $scopeTypeId = intval($scopeTypeId);
        if ($scopeTypeId < 0) {
            throw new VodQualityActionException('所选分类无效，请重新选择。');
        }
        if ($scopeTypeId === 0) {
            return ['type_id' => 0, 'type_ids' => [], 'label' => '全部分类'];
        }
        if (empty($typeMap[$scopeTypeId])) {
            throw new VodQualityActionException('所选分类不存在或已被删除，请重新选择。');
        }

        $children = [];
        foreach ($typeMap as $typeId => $type) {
            $children[intval($type['type_pid'] ?? 0)][] = intval($typeId);
        }
        $pending = [$scopeTypeId];
        $visited = [];
        while (!empty($pending)) {
            $typeId = intval(array_pop($pending));
            if ($typeId < 1 || isset($visited[$typeId])) {
                continue;
            }
            $visited[$typeId] = true;
            foreach ($children[$typeId] ?? [] as $childId) {
                $pending[] = intval($childId);
            }
        }
        $typeIds = array_map('intval', array_keys($visited));
        sort($typeIds, SORT_NUMERIC);
        $label = VodQualityAnalyzer::sanitizeValue($typeMap[$scopeTypeId]['type_name'] ?? '', 100);
        if ($label === '') {
            $label = '分类 #' . $scopeTypeId;
        }

        return ['type_id' => $scopeTypeId, 'type_ids' => $typeIds, 'label' => $label];
    }

    private static function categoryOptionsFromMap(array $typeMap)
    {
        $children = [];
        foreach ($typeMap as $typeId => $type) {
            $children[intval($type['type_pid'] ?? 0)][] = intval($typeId);
        }
        $sortIds = static function (array &$typeIds) use ($typeMap) {
            usort($typeIds, static function ($left, $right) use ($typeMap) {
                $sort = intval($typeMap[$right]['type_sort'] ?? 0) <=> intval($typeMap[$left]['type_sort'] ?? 0);
                return $sort !== 0 ? $sort : intval($left) <=> intval($right);
            });
        };
        foreach ($children as &$typeIds) {
            $sortIds($typeIds);
        }
        unset($typeIds);

        $rootIds = [];
        foreach ($typeMap as $typeId => $type) {
            $parentId = intval($type['type_pid'] ?? 0);
            if ($parentId < 1 || empty($typeMap[$parentId])) {
                $rootIds[] = intval($typeId);
            }
        }
        $sortIds($rootIds);

        $options = [];
        $visited = [];
        $walk = static function ($typeId, $depth) use (&$walk, &$options, &$visited, $children, $typeMap) {
            $typeId = intval($typeId);
            if ($typeId < 1 || isset($visited[$typeId]) || empty($typeMap[$typeId])) {
                return;
            }
            $visited[$typeId] = true;
            $typeName = VodQualityAnalyzer::sanitizeValue($typeMap[$typeId]['type_name'] ?? '', 100);
            if ($typeName === '') {
                $typeName = '分类 #' . $typeId;
            }
            $options[] = [
                'type_id' => $typeId,
                'type_pid' => intval($typeMap[$typeId]['type_pid'] ?? 0),
                'type_name' => $typeName,
                'depth' => intval($depth),
                'label' => ($depth > 0 ? str_repeat('—', intval($depth)) . ' ' : '') . $typeName,
            ];
            foreach ($children[$typeId] ?? [] as $childId) {
                $walk($childId, intval($depth) + 1);
            }
        };
        foreach ($rootIds as $rootId) {
            $walk($rootId, 0);
        }
        foreach (array_keys($typeMap) as $typeId) {
            $walk($typeId, 0);
        }
        return $options;
    }

    private static function scopeFromScan(array $scan, $strict = false)
    {
        $raw = trim((string) ($scan['scope_json'] ?? ''));
        if ($raw === '') {
            return ['type_id' => 0, 'type_ids' => [], 'label' => '全部分类', 'valid' => true];
        }
        $scope = json_decode($raw, true);
        $typeId = is_array($scope) ? intval($scope['type_id'] ?? -1) : -1;
        $typeIds = is_array($scope['type_ids'] ?? null) ? array_values(array_unique(array_filter(
            array_map('intval', $scope['type_ids']),
            static function ($value) {
                return $value > 0;
            }
        ))) : [];
        sort($typeIds, SORT_NUMERIC);
        $label = is_array($scope) ? VodQualityAnalyzer::sanitizeValue($scope['label'] ?? '', 100) : '';
        $valid = is_array($scope)
            && array_key_exists('type_id', $scope)
            && array_key_exists('type_ids', $scope)
            && $typeId >= 0
            && (($typeId === 0 && empty($typeIds))
                || ($typeId > 0 && $label !== '' && in_array($typeId, $typeIds, true)));
        if (!$valid) {
            if ($strict) {
                throw new \RuntimeException('扫描分类范围数据无效，请结束该任务后重新创建。');
            }
            return ['type_id' => 0, 'type_ids' => [], 'label' => '范围数据无效', 'valid' => false];
        }
        if ($typeId === 0) {
            $label = '全部分类';
        }
        return ['type_id' => $typeId, 'type_ids' => $typeIds, 'label' => $label, 'valid' => true];
    }

    private static function scopeDisplayLabel(array $scope)
    {
        if (empty($scope['valid']) && array_key_exists('valid', $scope)) {
            return '范围数据无效';
        }
        if (intval($scope['type_id'] ?? 0) < 1) {
            return '全部分类';
        }
        $count = count($scope['type_ids'] ?? []);
        return (string) ($scope['label'] ?? ('分类 #' . intval($scope['type_id'])))
            . ($count > 1 ? '（含 ' . $count . ' 个分类）' : '');
    }

    private static function vodQuery(array $scopeTypeIds)
    {
        $query = Db::name('vod');
        if (!empty($scopeTypeIds)) {
            $query->where('type_id', 'in', $scopeTypeIds);
        }
        return $query;
    }

    private static function siteContext()
    {
        $siteRoot = '';
        if (defined('ROOT_PATH')) {
            $siteRoot = rtrim((string) ROOT_PATH, '/');
        } elseif (defined('APP_PATH')) {
            $siteRoot = dirname(rtrim((string) APP_PATH, '/'));
        }

        $remoteUpload = true;
        try {
            $maccms = config('maccms');
            $mode = is_array($maccms) ? ($maccms['upload']['mode'] ?? '') : config('maccms.upload.mode');
            $remoteUpload = strtolower(trim((string) $mode)) !== 'local';
        } catch (\Throwable $e) {
        }

        return [
            'site_root' => $siteRoot,
            'remote_upload' => $remoteUpload,
        ];
    }

    private static function issueQuery($runId, $issueType, $query)
    {
        $builder = Db::name(self::ISSUE_TABLE)->where('run_id', intval($runId));
        if ($issueType !== '') {
            $builder->where('issue_type', $issueType);
        }
        if ($query !== '') {
            if (ctype_digit($query)) {
                $builder->where('vod_id', intval($query));
            } else {
                $builder->whereLike('vod_name', '%' . $query . '%');
            }
        }
        return $builder;
    }

    private static function normalizeIssueType($issueType)
    {
        $issueType = trim((string) $issueType);
        return isset(self::issueTypes()[$issueType]) ? $issueType : '';
    }

    private static function normalizeExecutionMode($executionMode)
    {
        return in_array(trim((string) $executionMode), ['traffic', 'worker'], true) ? 'worker' : 'manual';
    }

    private static function normalizeQuery($query)
    {
        return VodQualityAnalyzer::sanitizeValue($query, 80);
    }

    private static function decorateScan(array $scan)
    {
        $total = intval($scan['total_count'] ?? 0);
        $processed = intval($scan['processed_count'] ?? 0);
        $status = (string) ($scan['status'] ?? '');
        $scan['error_message'] = trim((string) ($scan['error_message'] ?? '')) === ''
            ? ''
            : self::PUBLIC_SCAN_ERROR;
        $scan['remaining_count'] = max(0, $total - $processed);
        $scan['source_missing_count'] = $status === 'completed' ? $scan['remaining_count'] : 0;
        $scan['progress_percent'] = $status === 'completed'
            ? 100
            : ($total > 0
            ? min(100, round(($processed / $total) * 100, 1))
            : 0);
        $scan['status_label'] = [
            'running' => '扫描中',
            'completed' => '已完成',
            'cancelled' => '已结束',
            'failed' => '失败',
        ][$status] ?? '未知';
        $scan['started_at_label'] = self::formatTime($scan['started_at'] ?? 0);
        $scan['finished_at_label'] = self::formatTime($scan['finished_at'] ?? 0);
        $scan['updated_at_label'] = self::formatTime($scan['updated_at'] ?? 0);
        $startedAt = intval($scan['started_at'] ?? 0);
        $endedAt = $status === 'running'
            ? time()
            : intval(($scan['finished_at'] ?? 0) ?: ($scan['updated_at'] ?? 0));
        $scan['duration_seconds'] = $startedAt > 0 ? max(0, $endedAt - $startedAt) : 0;
        $scan['duration_label'] = self::formatDuration($scan['duration_seconds']);
        $now = time();
        $scan['execution_mode'] = self::normalizeExecutionMode($scan['execution_mode'] ?? '');
        $scan['execution_mode_label'] = $scan['execution_mode'] === 'worker' ? '后台任务' : '仅页面';
        $scan['lease_until'] = max(0, intval($scan['lease_until'] ?? 0));
        $scan['next_run_at'] = max(0, intval($scan['next_run_at'] ?? 0));
        $scan['lease_active'] = $status === 'running' && $scan['lease_until'] > $now;
        $scan['lease_expired'] = $status === 'running'
            && $scan['lease_until'] > 0
            && $scan['lease_until'] <= $now;
        $scan['heartbeat_age_seconds'] = max(0, $now - intval($scan['updated_at'] ?? 0));
        if ($status !== 'running') {
            $scan['runner_state_label'] = '已停止';
        } elseif ($scan['execution_mode'] !== 'worker') {
            $scan['runner_state_label'] = '仅页面驱动';
        } elseif ($scan['lease_active']) {
            $scan['runner_state_label'] = '正在处理';
        } elseif ($scan['lease_expired']) {
            $scan['runner_state_label'] = '租约已过期，等待 Worker 恢复';
        } elseif ($scan['next_run_at'] > $now) {
            $scan['runner_state_label'] = '等待 Worker 重试';
        } else {
            $scan['runner_state_label'] = '等待 Worker';
        }
        $scope = self::scopeFromScan($scan);
        $scan['scope_type_id'] = intval($scope['type_id']);
        $scan['scope_type_ids'] = $scope['type_ids'];
        $scan['scope_type_count'] = count($scope['type_ids']);
        $scan['scope_valid'] = $scope['valid'];
        $scan['scope_label'] = self::scopeDisplayLabel($scope);
        return $scan;
    }

    private static function decorateIssue(array $issue)
    {
        $issue['issue_label'] = self::issueTypes()[$issue['issue_type'] ?? ''] ?? '未知异常';
        $issue['created_at_label'] = self::formatTime($issue['created_at'] ?? 0);
        $detail = json_decode((string) ($issue['detail_json'] ?? ''), true);
        $issue['detail'] = is_array($detail) ? $detail : [];
        $issue['detail_label'] = self::formatIssueDetail((string) ($issue['issue_type'] ?? ''), $issue['detail']);
        return $issue;
    }

    private static function formatIssueDetail($issueType, array $detail)
    {
        if ($issueType === 'type_parent_mismatch' && array_key_exists('expected_type_id_1', $detail)) {
            return '预期父分类 ID：#' . intval($detail['expected_type_id_1']);
        }
        if ($issueType !== 'play_group_mismatch') {
            return '';
        }

        $parts = [];
        if (isset($detail['source_group_count'])) {
            $parts[] = '来源 ' . intval($detail['source_group_count']) . ' 组';
        }
        if (isset($detail['url_group_count'])) {
            $parts[] = '地址 ' . intval($detail['url_group_count']) . ' 组';
        }
        foreach (['empty_source_groups' => '空来源组', 'empty_url_groups' => '空地址组'] as $key => $label) {
            if (!is_array($detail[$key] ?? null)) {
                continue;
            }
            $positions = array_values(array_filter(array_map('intval', $detail[$key]), static function ($position) {
                return $position > 0;
            }));
            if (!empty($positions)) {
                $parts[] = $label . '：' . implode('、', $positions);
            }
        }
        return implode('；', $parts);
    }

    private static function formatTime($timestamp)
    {
        $timestamp = intval($timestamp);
        return $timestamp > 0 ? date('Y-m-d H:i:s', $timestamp) : '-';
    }

    private static function formatDuration($seconds)
    {
        $seconds = max(0, intval($seconds));
        $hours = intdiv($seconds, 3600);
        $minutes = intdiv($seconds % 3600, 60);
        $remainingSeconds = $seconds % 60;
        if ($hours > 0) {
            return $hours . '小时' . $minutes . '分';
        }
        if ($minutes > 0) {
            return $minutes . '分' . $remainingSeconds . '秒';
        }
        return $remainingSeconds . '秒';
    }

    private static function jsonEncode($value)
    {
        $encoded = json_encode($value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE);
        return $encoded === false ? '{}' : $encoded;
    }

    private static function csvCell($value)
    {
        $value = VodQualityAnalyzer::sanitizeValue($value, 5000);
        if ($value !== '' && preg_match('/^[=+\-@]/', $value)) {
            return "'" . $value;
        }
        return $value;
    }

    private static function writeCsvRow($handle, array $row)
    {
        fputcsv($handle, $row, ',', '"', '', "\n");
    }

    private static function rowsToArray($rows)
    {
        if (is_object($rows) && method_exists($rows, 'toArray')) {
            $rows = $rows->toArray();
        }
        return is_array($rows) ? $rows : [];
    }

    private static function rowToArray($row)
    {
        if (is_object($row) && method_exists($row, 'toArray')) {
            $row = $row->toArray();
        }
        return is_array($row) ? $row : [];
    }

    private static function logFailure($action, \Throwable $error)
    {
        if (function_exists('trace')) {
            trace('[vodops] Failed to ' . $action . ': ' . $error->getMessage(), 'error');
        }
    }
}
