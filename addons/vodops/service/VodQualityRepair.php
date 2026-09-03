<?php

namespace addons\vodops\service;

use think\Cache;
use think\Db;

class VodQualityRepairException extends \RuntimeException
{
}

class VodQualityRepair
{
    private const SCAN_TABLE = 'vodops_scan';
    private const ISSUE_TABLE = 'vodops_issue';
    private const REPAIR_TABLE = 'vodops_repair_log';
    private const VOD_FIELDS = 'vod_id,vod_name,vod_en,type_id,type_id_1,vod_year,vod_area,vod_lang,vod_pic,vod_play_from,vod_play_url';

    private const SUPPORTED_ISSUES = [
        'type_parent_mismatch' => '修正父分类',
        'year_missing' => '补充年份',
        'year_invalid' => '修正年份',
        'area_missing' => '补充地区',
        'lang_missing' => '补充语言',
        'poster_missing' => '补充海报',
        'poster_file_missing' => '更换或复检海报',
    ];

    private const EXTERNAL_CANDIDATE_ISSUES = [
        'year_missing' => 'vod_year',
        'year_invalid' => 'vod_year',
        'area_missing' => 'vod_area',
        'lang_missing' => 'vod_lang',
        'poster_missing' => 'vod_pic',
        'poster_file_missing' => 'vod_pic',
    ];

    private const SOURCES = [
        'manual' => '人工核验',
        'douban' => '豆瓣资料',
        'collector' => '采集来源',
        'backup' => '备份恢复',
    ];

    public static function supportedIssueTypes()
    {
        return self::SUPPORTED_ISSUES;
    }

    public static function sourceOptions()
    {
        return self::SOURCES;
    }

    public static function previewUpdate($issueType, $newValue, array $vod, array $typeMap, array $context = [])
    {
        $issueType = trim((string) $issueType);
        if (!isset(self::SUPPORTED_ISSUES[$issueType])) {
            throw new VodQualityRepairException('该异常暂不支持在插件内修改，请使用原生编辑页人工处理。');
        }
        if (!self::hasIssue($issueType, $vod, $typeMap, $context)) {
            throw new VodQualityRepairException('当前数据已变化，该异常已不存在，请先复检。');
        }

        $guards = [];
        switch ($issueType) {
            case 'type_parent_mismatch':
                $typeId = intval($vod['type_id'] ?? 0);
                if ($typeId < 1 || empty($typeMap[$typeId])) {
                    throw new VodQualityRepairException('当前分类不存在，请先在原生编辑页选择有效分类。');
                }
                $updates = ['type_id_1' => intval($typeMap[$typeId]['type_pid'] ?? 0)];
                $guards = ['type_id' => $typeId];
                break;
            case 'year_missing':
            case 'year_invalid':
                $value = trim((string) $newValue);
                if (!preg_match('/^(18|19|20)[0-9]{2}$/D', $value)) {
                    throw new VodQualityRepairException('年份必须是 1800～2099 的四位数字。');
                }
                $updates = ['vod_year' => $value];
                break;
            case 'area_missing':
                $updates = ['vod_area' => self::metadataValue($newValue, '地区', 20)];
                break;
            case 'lang_missing':
                $updates = ['vod_lang' => self::metadataValue($newValue, '语言', 10)];
                break;
            case 'poster_missing':
            case 'poster_file_missing':
                $updates = ['vod_pic' => self::posterValue($newValue, $context)];
                break;
            default:
                throw new VodQualityRepairException('该异常暂不支持在插件内修改，请使用原生编辑页人工处理。');
        }

        $before = [];
        foreach ($updates as $field => $value) {
            $before[$field] = $vod[$field] ?? '';
            if ((string) $before[$field] === (string) $value) {
                throw new VodQualityRepairException('新值与当前值相同，无需写入；如果文件已恢复，请使用“仅复检”。');
            }
        }

        $afterVod = array_merge($vod, $updates);
        if (self::hasIssue($issueType, $afterVod, $typeMap, $context)) {
            throw new VodQualityRepairException('该值保存后仍无法通过当前异常规则，请重新检查。');
        }

        return [
            'updates' => $updates,
            'before' => $before,
            'after' => $updates,
            'guards' => $guards,
        ];
    }

    public static function repairInfo($issueId, array $context = [])
    {
        $record = self::loadIssueRecord($issueId, true, $context);
        $issue = $record['issue'];
        $vod = $record['vod'];
        $issueType = (string) ($issue['issue_type'] ?? '');
        $supported = isset(self::SUPPORTED_ISSUES[$issueType]);
        $field = self::fieldForIssue($issueType);
        $suggestedValue = '';
        if ($issueType === 'type_parent_mismatch') {
            $typeId = intval($vod['type_id'] ?? 0);
            if (!empty($record['type_map'][$typeId])) {
                $suggestedValue = (string) intval($record['type_map'][$typeId]['type_pid'] ?? 0);
            }
        } elseif ($issueType === 'year_invalid') {
            $suggestedValue = self::yearSuggestion((string) ($vod['vod_year'] ?? ''));
        } elseif ($issueType === 'poster_file_missing') {
            $suggestedValue = (string) ($vod[$field] ?? '');
        }

        $latestMutation = self::latestMutationForIssue(intval($issue['issue_id'] ?? 0));
        return [
            'issue_id' => intval($issue['issue_id'] ?? 0),
            'run_id' => intval($issue['run_id'] ?? 0),
            'vod_id' => intval($vod['vod_id'] ?? 0),
            'vod_name' => VodQualityAnalyzer::sanitizeValue($vod['vod_name'] ?? '', 250),
            'issue_type' => $issueType,
            'issue_label' => VodQualityAnalyzer::issueTypes()[$issueType] ?? '未知异常',
            'field_name' => $field,
            'current_value' => $field === '' ? '' : (string) ($vod[$field] ?? ''),
            'suggested_value' => $suggestedValue,
            'supported' => $supported,
            'issue_present' => self::hasIssue($issueType, $vod, $record['type_map'], $record['context']),
            'input_required' => $supported && $issueType !== 'type_parent_mismatch',
            'instructions' => self::instructions($issueType),
            'value_options' => self::valueOptions($issueType),
            'source_options' => self::SOURCES,
            'external_candidates_supported' => $supported && isset(self::EXTERNAL_CANDIDATE_ISSUES[$issueType]),
            'candidate_title' => (VodQualityAnalyzer::issueTypes()[$issueType] ?? '数据') . '候选',
            'poster_candidates_supported' => $supported
                && in_array($issueType, ['poster_missing', 'poster_file_missing'], true),
            'can_rollback' => !empty($latestMutation)
                && ($latestMutation['action'] ?? '') === 'update'
                && ($latestMutation['result_status'] ?? '') === 'fixed',
            'repair_id' => intval($latestMutation['repair_id'] ?? 0),
        ];
    }

    public static function posterCandidateContext($issueId, array $context = [])
    {
        $candidate = self::candidateContext($issueId, $context);
        $issueType = (string) ($candidate['issue_type'] ?? '');
        if (!in_array($issueType, ['poster_missing', 'poster_file_missing'], true)) {
            throw new VodQualityRepairException('仅海报异常支持搜索外部候选。');
        }
        return $candidate;
    }

    public static function candidateContext($issueId, array $context = [])
    {
        $record = self::loadIssueRecord($issueId, true, $context);
        $issueType = (string) ($record['issue']['issue_type'] ?? '');
        if (!isset(self::EXTERNAL_CANDIDATE_ISSUES[$issueType])) {
            throw new VodQualityRepairException('该异常不支持搜索外部候选。');
        }
        if (!self::hasIssue($issueType, $record['vod'], $record['type_map'], $record['context'])) {
            throw new VodQualityRepairException('当前数据已变化，该异常已不存在，请先复检。');
        }

        $vod = $record['vod'];
        return [
            'issue_id' => intval($record['issue']['issue_id'] ?? 0),
            'issue_type' => $issueType,
            'field_name' => self::EXTERNAL_CANDIDATE_ISSUES[$issueType],
            'vod' => [
                'vod_id' => intval($vod['vod_id'] ?? 0),
                'vod_name' => (string) ($vod['vod_name'] ?? ''),
                'vod_year' => (string) ($vod['vod_year'] ?? ''),
                'vod_area' => (string) ($vod['vod_area'] ?? ''),
                'vod_lang' => (string) ($vod['vod_lang'] ?? ''),
                'vod_pic' => (string) ($vod['vod_pic'] ?? ''),
                'vod_play_from' => (string) ($vod['vod_play_from'] ?? ''),
            ],
            'context_token' => self::candidateContextToken($issueType, $vod),
        ];
    }

    public static function decorateIssues(array $issues, $scanStatus = '')
    {
        $issueIds = [];
        foreach ($issues as $issue) {
            $issueId = intval($issue['issue_id'] ?? 0);
            if ($issueId > 0) {
                $issueIds[] = $issueId;
            }
        }
        try {
            $latest = self::latestAppliedLogs($issueIds);
        } catch (\Throwable $e) {
            self::logFailure('load repair status', $e);
            $latest = [];
        }
        foreach ($issues as &$issue) {
            $issueId = intval($issue['issue_id'] ?? 0);
            $log = $latest[$issueId] ?? [];
            $issueType = (string) ($issue['issue_type'] ?? '');
            $resultStatus = (string) ($log['result_status'] ?? 'open');
            $issue['repair_supported'] = isset(self::SUPPORTED_ISSUES[$issueType]);
            $issue['repair_allowed'] = $issue['repair_supported'] && $scanStatus !== 'running';
            $issue['repair_status'] = $resultStatus;
            $issue['repair_status_label'] = $resultStatus === 'fixed' ? '已复检通过' : '待处理';
            $issue['repair_id'] = intval($log['repair_id'] ?? 0);
        }
        unset($issue);
        return $issues;
    }

    public static function apply($issueId, $newValue, $source, $adminId, array $context = [], $candidateContext = '')
    {
        self::assertAdmin($adminId);
        $record = self::loadIssueRecord($issueId, true, $context);
        $issue = $record['issue'];
        $vod = $record['vod'];
        $issueType = (string) ($issue['issue_type'] ?? '');
        $candidateContext = trim((string) $candidateContext);
        if ($candidateContext !== '') {
            if (!isset(self::EXTERNAL_CANDIDATE_ISSUES[$issueType])) {
                throw new VodQualityRepairException('候选上下文不能用于该异常。');
            }
            if (!hash_equals(self::candidateContextToken($issueType, $vod), $candidateContext)) {
                throw new VodQualityRepairException('候选生成后视频数据已变化，请重新搜索候选。');
            }
        }
        $preview = self::previewUpdate($issueType, $newValue, $vod, $record['type_map'], $record['context']);
        if ($candidateContext !== '') {
            $preview['guards'] = array_merge($preview['guards'], self::candidateGuards($issueType, $vod));
        }
        $source = $issueType === 'type_parent_mismatch' ? 'category_tree' : self::normalizeSource($source);

        $repairId = self::createAudit($issue, 'update', $preview['before'], $preview['after'], $preview['guards'], $source, $adminId, 0);
        try {
            $affected = self::conditionalVodUpdate(
                intval($vod['vod_id'] ?? 0),
                array_merge($preview['before'], $preview['guards']),
                $preview['updates']
            );
            if ($affected !== 1) {
                self::finishAudit($repairId, 'conflict', 'open');
                throw new VodQualityRepairException('视频数据已变化，本次修改已停止，请刷新后重新检查。');
            }

            $freshVod = self::loadVod(intval($vod['vod_id'] ?? 0));
            $freshTypeMap = self::typeMap();
            $freshContext = self::context($context);
            if (self::hasIssue($issueType, $freshVod, $freshTypeMap, $freshContext)) {
                self::conditionalVodUpdate(
                    intval($vod['vod_id'] ?? 0),
                    array_merge($preview['after'], $preview['guards']),
                    $preview['before']
                );
                self::finishAudit($repairId, 'failed', 'open');
                throw new VodQualityRepairException('写入后的即时复检未通过，系统已尝试恢复原值。');
            }

            self::finishAudit($repairId, 'applied', 'fixed');
            self::clearVodCaches($vod, $freshVod);
            self::syncSearch(intval($vod['vod_id'] ?? 0));
            return self::result($repairId, $issue, 'fixed', $freshVod);
        } catch (VodQualityRepairException $e) {
            throw $e;
        } catch (\Throwable $e) {
            self::finishAuditSafely($repairId, 'failed', 'open');
            self::logFailure('apply repair', $e);
            throw new VodQualityRepairException('修复失败，请查看服务端日志后重试。');
        }
    }

    public static function recheck($issueId, $adminId, array $context = [])
    {
        self::assertAdmin($adminId);
        $record = self::loadIssueRecord($issueId, true, $context);
        $issue = $record['issue'];
        $issueType = (string) ($issue['issue_type'] ?? '');
        if (!isset(self::SUPPORTED_ISSUES[$issueType])) {
            throw new VodQualityRepairException('该异常暂不支持插件内复检，请重新扫描或使用原生编辑页。');
        }
        $field = self::fieldForIssue($issueType);
        $snapshot = $field === '' ? [] : [$field => $record['vod'][$field] ?? ''];
        $resultStatus = self::hasIssue($issueType, $record['vod'], $record['type_map'], $record['context']) ? 'open' : 'fixed';
        $repairId = self::createAudit($issue, 'recheck', $snapshot, $snapshot, [], 'recheck', $adminId, 0);
        self::finishAudit($repairId, 'applied', $resultStatus);
        return self::result($repairId, $issue, $resultStatus, $record['vod']);
    }

    public static function rollback($repairId, $adminId, array $context = [])
    {
        self::assertAdmin($adminId);
        $repairId = intval($repairId);
        $repair = self::rowToArray(Db::name(self::REPAIR_TABLE)->where('repair_id', $repairId)->find());
        if (empty($repair)
            || ($repair['operation_status'] ?? '') !== 'applied'
            || ($repair['action'] ?? '') !== 'update'
            || ($repair['result_status'] ?? '') !== 'fixed') {
            throw new VodQualityRepairException('该修复记录不存在或不可回滚。');
        }
        $latestMutation = self::latestMutationForIssue(intval($repair['issue_id'] ?? 0));
        if (intval($latestMutation['repair_id'] ?? 0) !== $repairId) {
            throw new VodQualityRepairException('该记录之后已有新的修改，不能覆盖后续结果。');
        }

        $before = self::jsonMap($repair['before_json'] ?? '');
        $after = self::jsonMap($repair['after_json'] ?? '');
        $guards = self::jsonMap($repair['guard_json'] ?? '');
        if (empty($before) || array_keys($before) !== array_keys($after)) {
            throw new VodQualityRepairException('修复记录缺少完整原值，不能自动回滚。');
        }
        self::assertRepairFields((string) ($repair['issue_type'] ?? ''), array_keys($before));
        self::assertGuardFields((string) ($repair['issue_type'] ?? ''), array_keys($guards));
        $vodId = intval($repair['vod_id'] ?? 0);
        $vod = self::loadVod($vodId);
        $issue = [
            'issue_id' => intval($repair['issue_id'] ?? 0),
            'run_id' => intval($repair['run_id'] ?? 0),
            'vod_id' => $vodId,
            'issue_type' => (string) ($repair['issue_type'] ?? ''),
        ];
        $rollbackId = self::createAudit($issue, 'rollback', $after, $before, $guards, 'rollback', $adminId, $repairId);
        try {
            $affected = self::conditionalVodUpdate($vodId, array_merge($after, $guards), $before);
            if ($affected !== 1) {
                self::finishAudit($rollbackId, 'conflict', 'fixed');
                throw new VodQualityRepairException('视频数据已变化，不能用旧记录覆盖当前值。');
            }
            $freshVod = self::loadVod($vodId);
            $typeMap = self::typeMap();
            $actualContext = self::context($context);
            $resultStatus = self::hasIssue((string) $repair['issue_type'], $freshVod, $typeMap, $actualContext) ? 'open' : 'fixed';
            self::finishAudit($rollbackId, 'applied', $resultStatus);
            self::clearVodCaches($vod, $freshVod);
            self::syncSearch($vodId);
            return self::result($rollbackId, $issue, $resultStatus, $freshVod);
        } catch (VodQualityRepairException $e) {
            throw $e;
        } catch (\Throwable $e) {
            self::finishAuditSafely($rollbackId, 'failed', 'fixed');
            self::logFailure('rollback repair', $e);
            throw new VodQualityRepairException('回滚失败，请查看服务端日志后重试。');
        }
    }

    private static function loadIssueRecord($issueId, $requireTerminalScan, array $context)
    {
        $issueId = intval($issueId);
        if ($issueId < 1) {
            throw new VodQualityRepairException('异常记录 ID 无效。');
        }
        $issue = self::rowToArray(Db::name(self::ISSUE_TABLE)->where('issue_id', $issueId)->find());
        if (empty($issue)) {
            throw new VodQualityRepairException('异常记录不存在或已被删除。');
        }
        if ($requireTerminalScan) {
            $scan = self::rowToArray(Db::name(self::SCAN_TABLE)->where('run_id', intval($issue['run_id'] ?? 0))->find());
            if (empty($scan)) {
                throw new VodQualityRepairException('扫描记录不存在或已被删除。');
            }
            if (($scan['status'] ?? '') === 'running') {
                throw new VodQualityRepairException('扫描进行中不能修改数据，请等待完成或先结束任务。');
            }
        }
        $vod = self::loadVod(intval($issue['vod_id'] ?? 0));
        return [
            'issue' => $issue,
            'vod' => $vod,
            'type_map' => self::typeMap(),
            'context' => self::context($context),
        ];
    }

    private static function loadVod($vodId)
    {
        $vod = self::rowToArray(Db::name('vod')->where('vod_id', intval($vodId))->field(self::VOD_FIELDS)->find());
        if (empty($vod)) {
            throw new VodQualityRepairException('视频记录不存在或已被删除。');
        }
        return $vod;
    }

    private static function typeMap()
    {
        $map = [];
        foreach (self::rowsToArray(Db::name('type')->field('type_id,type_pid,type_name')->select()) as $type) {
            $typeId = intval($type['type_id'] ?? 0);
            if ($typeId > 0) {
                $map[$typeId] = $type;
            }
        }
        return $map;
    }

    private static function createAudit(array $issue, $action, array $before, array $after, array $guards, $source, $adminId, $relatedRepairId)
    {
        $repairId = intval(Db::name(self::REPAIR_TABLE)->insertGetId([
            'issue_id' => intval($issue['issue_id'] ?? 0),
            'run_id' => intval($issue['run_id'] ?? 0),
            'vod_id' => intval($issue['vod_id'] ?? 0),
            'issue_type' => VodQualityAnalyzer::sanitizeValue($issue['issue_type'] ?? '', 40),
            'action' => VodQualityAnalyzer::sanitizeValue($action, 16),
            'operation_status' => 'pending',
            'result_status' => 'pending',
            'before_json' => self::jsonEncode($before),
            'after_json' => self::jsonEncode($after),
            'guard_json' => self::jsonEncode($guards),
            'source' => VodQualityAnalyzer::sanitizeValue($source, 32),
            'admin_id' => max(0, intval($adminId)),
            'related_repair_id' => max(0, intval($relatedRepairId)),
            'created_at' => time(),
            'finished_at' => 0,
        ]));
        if ($repairId < 1) {
            throw new \RuntimeException('修复审计记录写入失败。');
        }
        return $repairId;
    }

    private static function finishAudit($repairId, $operationStatus, $resultStatus)
    {
        $updated = Db::name(self::REPAIR_TABLE)->where('repair_id', intval($repairId))->where('operation_status', 'pending')->update([
            'operation_status' => (string) $operationStatus,
            'result_status' => (string) $resultStatus,
            'finished_at' => time(),
        ]);
        if ($updated !== 1) {
            throw new \RuntimeException('修复审计状态更新失败。');
        }
    }

    private static function finishAuditSafely($repairId, $operationStatus, $resultStatus)
    {
        try {
            self::finishAudit($repairId, $operationStatus, $resultStatus);
        } catch (\Throwable $ignored) {
        }
    }

    private static function conditionalVodUpdate($vodId, array $expected, array $updates)
    {
        $query = Db::name('vod')->where('vod_id', intval($vodId));
        foreach ($expected as $field => $value) {
            $query->where($field, $value);
        }
        return intval($query->update($updates));
    }

    private static function hasIssue($issueType, array $vod, array $typeMap, array $context)
    {
        foreach (VodQualityAnalyzer::analyze($vod, $typeMap, $context) as $issue) {
            if (($issue['issue_type'] ?? '') === $issueType) {
                return true;
            }
        }
        return false;
    }

    private static function fieldForIssue($issueType)
    {
        $map = [
            'type_parent_mismatch' => 'type_id_1',
            'year_missing' => 'vod_year',
            'year_invalid' => 'vod_year',
            'area_missing' => 'vod_area',
            'lang_missing' => 'vod_lang',
            'poster_missing' => 'vod_pic',
            'poster_file_missing' => 'vod_pic',
        ];
        return $map[$issueType] ?? '';
    }

    private static function assertRepairFields($issueType, array $fields)
    {
        $expected = self::fieldForIssue($issueType);
        if ($expected === '' || $fields !== [$expected]) {
            throw new VodQualityRepairException('修复记录字段超出允许范围，已停止操作。');
        }
    }

    private static function assertGuardFields($issueType, array $fields)
    {
        $expected = $issueType === 'type_parent_mismatch' ? ['type_id'] : [];
        $candidateGuard = isset(self::EXTERNAL_CANDIDATE_ISSUES[$issueType])
            && $fields === array_keys(self::candidateGuards($issueType, []));
        if ($fields !== $expected && !$candidateGuard) {
            throw new VodQualityRepairException('修复记录依赖字段不完整，已停止操作。');
        }
    }

    private static function candidateContextToken($issueType, array $vod)
    {
        $field = self::EXTERNAL_CANDIDATE_ISSUES[$issueType] ?? '';
        $snapshot = [
            'vod_id' => intval($vod['vod_id'] ?? 0),
            'issue_type' => (string) $issueType,
            'field_name' => $field,
            'vod_name' => (string) ($vod['vod_name'] ?? ''),
            'vod_year' => (string) ($vod['vod_year'] ?? ''),
        ];
        if ($field !== '' && $field !== 'vod_year') {
            $snapshot[$field] = (string) ($vod[$field] ?? '');
        }
        return hash('sha256', self::jsonEncode($snapshot));
    }

    private static function candidateGuards($issueType, array $vod)
    {
        if (in_array($issueType, ['year_missing', 'year_invalid'], true)) {
            return ['vod_name' => (string) ($vod['vod_name'] ?? '')];
        }
        if (isset(self::EXTERNAL_CANDIDATE_ISSUES[$issueType])) {
            return [
                'vod_name' => (string) ($vod['vod_name'] ?? ''),
                'vod_year' => (string) ($vod['vod_year'] ?? ''),
            ];
        }
        return [];
    }

    private static function metadataValue($value, $label, $limit)
    {
        $value = self::singleLine($value);
        if ($value === '' || $value === '0') {
            throw new VodQualityRepairException($label . '不能为空或为 0。');
        }
        if (self::length($value) > intval($limit)) {
            throw new VodQualityRepairException($label . '长度不能超过 ' . intval($limit) . ' 个字符。');
        }
        return $value;
    }

    private static function posterValue($value, array $context)
    {
        $value = trim((string) $value);
        if ($value === '' || $value === '0' || self::length($value) > 255 || preg_match('/[\x00-\x1F\x7F]/', $value)) {
            throw new VodQualityRepairException('海报地址不能为空，且长度不能超过 255 个字符。');
        }
        if (preg_match('#^[a-z][a-z0-9+.-]*://#i', $value)) {
            $parts = parse_url($value);
            if (!is_array($parts) || empty($parts['host']) || strtolower((string) ($parts['scheme'] ?? '')) !== 'https') {
                throw new VodQualityRepairException('远程海报必须使用有效的 HTTPS URL。');
            }
            return $value;
        }

        $relative = ltrim(str_replace('\\', '/', $value), '/');
        if (strpos($relative, 'upload/') !== 0 || strpos($relative, '../') !== false) {
            throw new VodQualityRepairException('本地海报必须使用 upload/ 下的安全相对路径。');
        }
        $actualContext = self::context($context);
        if (empty($actualContext['remote_upload'])) {
            $siteRoot = rtrim((string) ($actualContext['site_root'] ?? ''), '/');
            if ($siteRoot === '' || !is_file($siteRoot . '/' . $relative)) {
                throw new VodQualityRepairException('新的本地海报文件不存在，请先上传或恢复文件。');
            }
        }
        return $relative;
    }

    private static function yearSuggestion($value)
    {
        preg_match_all('/(?<![0-9])(18|19|20)[0-9]{2}(?![0-9])/', (string) $value, $matches);
        $years = array_values(array_unique($matches[0] ?? []));
        return count($years) === 1 ? (string) $years[0] : '';
    }

    private static function valueOptions($issueType)
    {
        $key = $issueType === 'area_missing' ? 'vod_area' : ($issueType === 'lang_missing' ? 'vod_lang' : '');
        if ($key === '') {
            return [];
        }
        try {
            $app = config('maccms.app');
            $value = is_array($app) ? ($app[$key] ?? '') : '';
            return array_values(array_filter(array_map('trim', explode(',', (string) $value)), static function ($item) {
                return $item !== '';
            }));
        } catch (\Throwable $e) {
            return [];
        }
    }

    private static function instructions($issueType)
    {
        $map = [
            'type_parent_mismatch' => '父分类将按当前分类树自动计算，不需要手工填写。',
            'year_missing' => '填写影片首次发行年份，只允许四位数字。',
            'year_invalid' => '确认真实发行年份后填写四位数字，系统不会直接截取含糊值。',
            'area_missing' => '按可信资料填写地区，不要根据语言推测。',
            'lang_missing' => '按实际音轨填写语言，不要根据地区推测。',
            'poster_missing' => '填写 HTTPS 图片地址，或已存在于 upload/ 下的本地文件路径。',
            'poster_file_missing' => '如果原文件已经恢复可仅复检；否则填写新的 HTTPS 地址或已存在的本地路径。',
        ];
        return $map[$issueType] ?? '请在原生编辑页人工处理。';
    }

    private static function latestAppliedLogs(array $issueIds)
    {
        $issueIds = array_values(array_unique(array_filter(array_map('intval', $issueIds))));
        if (empty($issueIds)) {
            return [];
        }
        $logs = self::rowsToArray(Db::name(self::REPAIR_TABLE)
            ->where('issue_id', 'in', $issueIds)
            ->where('operation_status', 'applied')
            ->order('repair_id desc')
            ->select());
        $latest = [];
        foreach ($logs as $log) {
            $issueId = intval($log['issue_id'] ?? 0);
            if ($issueId > 0 && !isset($latest[$issueId])) {
                $latest[$issueId] = $log;
            }
        }
        return $latest;
    }

    private static function latestMutationForIssue($issueId)
    {
        return self::rowToArray(Db::name(self::REPAIR_TABLE)
            ->where('issue_id', intval($issueId))
            ->where('operation_status', 'applied')
            ->where('action', 'in', ['update', 'rollback'])
            ->order('repair_id desc')
            ->find());
    }

    private static function normalizeSource($source)
    {
        $source = trim((string) $source);
        if (!isset(self::SOURCES[$source])) {
            throw new VodQualityRepairException('请选择有效的数据来源。');
        }
        return $source;
    }

    private static function assertAdmin($adminId)
    {
        if (intval($adminId) < 1) {
            throw new VodQualityRepairException('无法识别当前管理员，已停止写入。');
        }
    }

    private static function context(array $context)
    {
        if (array_key_exists('site_root', $context) && array_key_exists('remote_upload', $context)) {
            return $context;
        }
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
        return ['site_root' => $siteRoot, 'remote_upload' => $remoteUpload];
    }

    private static function clearVodCaches(array $before, array $after)
    {
        try {
            $ids = array_unique([intval($before['vod_id'] ?? 0), intval($after['vod_id'] ?? 0)]);
            $ens = array_unique([(string) ($before['vod_en'] ?? ''), (string) ($after['vod_en'] ?? '')]);
            $prefix = '';
            if (!empty($GLOBALS['config']['app']['cache_flag'])) {
                $prefix = (string) $GLOBALS['config']['app']['cache_flag'] . '_';
            }
            $keys = [];
            foreach ($ids as $vodId) {
                if ($vodId < 1) {
                    continue;
                }
                $keys[] = 'vod_detail_' . $vodId;
                foreach ($ens as $vodEn) {
                    if ($vodEn !== '') {
                        $keys[] = 'vod_detail_' . $vodId . '_' . $vodEn;
                    }
                }
            }
            foreach ($ens as $vodEn) {
                if ($vodEn !== '') {
                    $keys[] = 'vod_detail_' . $vodEn;
                }
            }
            foreach (array_unique($keys) as $key) {
                Cache::rm($key);
                if ($prefix !== '') {
                    Cache::rm($prefix . $key);
                }
            }
        } catch (\Throwable $e) {
            self::logFailure('clear repair cache', $e);
        }
    }

    private static function syncSearch($vodId)
    {
        try {
            $class = '\\app\\common\\util\\MeilisearchSync';
            if (class_exists($class) && is_callable([$class, 'afterVodSave'])) {
                call_user_func([$class, 'afterVodSave'], intval($vodId));
            }
        } catch (\Throwable $e) {
            self::logFailure('sync repaired vod', $e);
        }
    }

    private static function result($repairId, array $issue, $resultStatus, array $vod)
    {
        $field = self::fieldForIssue((string) ($issue['issue_type'] ?? ''));
        return [
            'repair_id' => intval($repairId),
            'issue_id' => intval($issue['issue_id'] ?? 0),
            'vod_id' => intval($vod['vod_id'] ?? 0),
            'field_name' => $field,
            'current_value' => $field === '' ? '' : (string) ($vod[$field] ?? ''),
            'result_status' => (string) $resultStatus,
            'status_label' => $resultStatus === 'fixed' ? '已复检通过' : '异常仍存在',
        ];
    }

    private static function singleLine($value)
    {
        $value = str_replace(["\0", "\r", "\n", "\t"], [' ', ' ', ' ', ' '], (string) $value);
        return trim(preg_replace('/\s+/u', ' ', $value));
    }

    private static function length($value)
    {
        return function_exists('mb_strlen') ? mb_strlen((string) $value, 'UTF-8') : strlen((string) $value);
    }

    private static function jsonEncode($value)
    {
        $options = JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES;
        if (defined('JSON_INVALID_UTF8_SUBSTITUTE')) {
            $options |= JSON_INVALID_UTF8_SUBSTITUTE;
        }
        $json = json_encode($value, $options);
        if ($json === false) {
            throw new \RuntimeException('修复审计数据编码失败。');
        }
        return $json;
    }

    private static function jsonMap($value)
    {
        $decoded = json_decode((string) $value, true);
        return is_array($decoded) ? $decoded : [];
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
            try {
                trace('[vodops] ' . $action . ' failed: ' . $error->getMessage(), 'error');
            } catch (\Throwable $ignored) {
            }
        }
    }
}
