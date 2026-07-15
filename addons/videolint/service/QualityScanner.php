<?php

namespace addons\videolint\service;

use think\Db;

class QualityScanner
{
    private const SCAN_TABLE = 'squared_media_video_lint_scan';
    private const ISSUE_TABLE = 'squared_media_video_lint_issue';
    private const VOD_TABLE = 'vod';
    private const LEVEL_CRITICAL = 'critical';
    private const LEVEL_WARNING = 'warning';
    private const LEVEL_INFO = 'info';
    private const BATCH_MAX_INSERT = 500;

    public static function configDefaults()
    {
        return [
            'batch_size' => 200,
            'max_items_per_scan' => 0,
            'check_cover_head' => false,
            'cover_head_timeout' => 3,
            'duplicate_group_limit' => 200,
        ];
    }

    public static function run(array $options = [])
    {
        $options = array_merge(self::configDefaults(), self::normalizeConfig($options));
        $runBy = isset($options['run_by']) ? max(0, (int) $options['run_by']) : 0;

        $scanId = Db::name(self::SCAN_TABLE)->insertGetId([
            'run_by' => $runBy,
            'status' => 'running',
            'started_at' => time(),
            'created_at' => time(),
            'options_json' => json_encode($options, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
        ]);

        $buffer = [];
        $issueCount = 0;
        $scanned = 0;
        $scanError = '';

        try {
            if (function_exists('set_time_limit')) {
                @set_time_limit(0);
            }

            Db::name(self::ISSUE_TABLE)->where('scan_id', $scanId)->delete();

            $totalVideos = (int) Db::name(self::VOD_TABLE)->count();
            $limit = max(1, min(2000, (int) $options['batch_size']));
            $maxItems = (int) $options['max_items_per_scan'];
            if ($maxItems > 0) {
                $totalVideos = min($totalVideos, $maxItems);
            }

            for ($offset = 0; $offset < $totalVideos; $offset += $limit) {
                $rows = Db::name(self::VOD_TABLE)
                    ->field('vod_id,vod_name,vod_pic,vod_class,vod_area,vod_year,vod_content,vod_play_url,vod_score,vod_status')
                    ->order('vod_id asc')
                    ->limit($offset, $limit)
                    ->select();
                if (is_object($rows) && method_exists($rows, 'toArray')) {
                    $rows = $rows->toArray();
                }
                if (!is_array($rows) || empty($rows)) {
                    break;
                }

                $rowsCount = count($rows);
                foreach ($rows as $row) {
                    $items = self::scanVodItem((array) $row, $options);
                    if (!empty($items)) {
                        $buffer = array_merge($buffer, $items);
                    }
                }

                $scanned += $rowsCount;
                $inserted = self::flushIssueBuffer($scanId, $buffer);
                $issueCount += $inserted;
                $buffer = [];

                Db::name(self::SCAN_TABLE)->where('scan_id', $scanId)->update([
                    'scanned_videos' => $scanned,
                    'issue_count' => $issueCount,
                    'total_videos' => $totalVideos,
                ]);
            }

            if (!empty($buffer)) {
                $inserted = self::flushIssueBuffer($scanId, $buffer);
                $issueCount += $inserted;
                $buffer = [];
            }

            $duplicateRows = self::scanDuplicates((int) $options['duplicate_group_limit']);
            if (!empty($duplicateRows)) {
                $duplicateInsert = [];
                foreach ($duplicateRows as $item) {
                    $duplicateInsert[] = [
                        'scan_id' => $scanId,
                        'vod_id' => (int) $item['vod_id'],
                        'vod_name' => (string) $item['vod_name'],
                        'issue_level' => self::LEVEL_WARNING,
                        'issue_code' => 'DUPLICATE_BY_NAME_YEAR',
                        'field_name' => 'vod_name',
                        'message' => sprintf('重复片名：存在 %d 条同名%s记录', (int) $item['total_count'], $item['vod_year'] !== '' ? ('（年份 ' . $item['vod_year'] . '）') : ''),
                        'snapshot' => json_encode([
                            'vod_id' => (int) $item['vod_id'],
                            'vod_year' => (string) $item['vod_year'],
                            'duplicate_count' => (int) $item['total_count'],
                        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
                        'created_at' => time(),
                    ];
                }
                $issueCount += self::flushIssueBuffer($scanId, $duplicateInsert);
            }

            Db::name(self::SCAN_TABLE)->where('scan_id', $scanId)->update([
                'status' => 'done',
                'finished_at' => time(),
                'total_videos' => $totalVideos,
                'scanned_videos' => $scanned,
                'issue_count' => $issueCount,
            ]);
        } catch (\Throwable $e) {
            $scanError = $e->getMessage();
            Db::name(self::SCAN_TABLE)->where('scan_id', $scanId)->update([
                'status' => 'failed',
                'finished_at' => time(),
                'error_message' => mb_substr($scanError, 0, 255, 'UTF-8'),
                'total_videos' => $totalVideos ?? 0,
                'scanned_videos' => $scanned ?? 0,
                'issue_count' => $issueCount ?? 0,
            ]);
            throw new \Exception($scanError);
        }

        return [
            'scan_id' => $scanId,
            'status' => 'done',
            'total_videos' => $totalVideos,
            'scanned_videos' => $scanned,
            'issue_count' => $issueCount,
        ];
    }

    public static function listScans($page = 1, $limit = 20)
    {
        $page = max(1, (int) $page);
        $limit = max(1, min(50, (int) $limit));
        return Db::name(self::SCAN_TABLE)->order('scan_id desc')->page($page, $limit)->select();
    }

    public static function getScan($scanId)
    {
        $scanId = (int) $scanId;
        if ($scanId < 1) {
            return null;
        }

        return Db::name(self::SCAN_TABLE)->where('scan_id', $scanId)->find();
    }

    public static function getLatestScan()
    {
        return Db::name(self::SCAN_TABLE)->order('scan_id desc')->find();
    }

    public static function listIssues(int $scanId, string $level = '', int $page = 1, int $limit = 20, string $vodName = '')
    {
        $scanId = (int) $scanId;
        if ($scanId < 1) {
            return ['data' => [], 'page' => 1, 'total' => 0, 'limit' => $limit];
        }

        $query = Db::name(self::ISSUE_TABLE)->where('scan_id', $scanId);
        if ($level !== '') {
            $query = $query->where('issue_level', $level);
        }
        $vodName = trim($vodName);
        if ($vodName !== '') {
            $query = $query->whereLike('vod_name', '%' . $vodName . '%');
        }
        $total = (int) $query->count();
        $rows = $query->order('issue_id desc')->page(max(1, $page), max(1, min(100, $limit)))->select();
        if (is_object($rows) && method_exists($rows, 'toArray')) {
            $rows = $rows->toArray();
        }
        if (!is_array($rows)) {
            $rows = [];
        }

        return [
            'data' => $rows,
            'page' => max(1, (int) $page),
            'total' => $total,
            'limit' => max(1, min(100, (int) $limit)),
        ];
    }

    public static function listIssuesExport(int $scanId, string $level = '')
    {
        $scanId = (int) $scanId;
        if ($scanId < 1) {
            return [];
        }

        $query = Db::name(self::ISSUE_TABLE)->where('scan_id', $scanId);
        if ($level !== '') {
            $query = $query->where('issue_level', $level);
        }

        return $query->order('issue_id asc')->select();
    }

    public static function getIssueStats(int $scanId)
    {
        $scanId = (int) $scanId;
        if ($scanId < 1) {
            return [self::LEVEL_CRITICAL => 0, self::LEVEL_WARNING => 0, self::LEVEL_INFO => 0];
        }

        $rows = Db::name(self::ISSUE_TABLE)
            ->where('scan_id', $scanId)
            ->field('issue_level, count(*) as total')
            ->group('issue_level')
            ->select();
        if (is_object($rows) && method_exists($rows, 'toArray')) {
            $rows = $rows->toArray();
        }
        if (!is_array($rows)) {
            $rows = [];
        }

        $result = [self::LEVEL_CRITICAL => 0, self::LEVEL_WARNING => 0, self::LEVEL_INFO => 0];
        foreach ($rows as $row) {
            $lvl = (string) ($row['issue_level'] ?? '');
            $result[$lvl] = (int) ($row['total'] ?? 0);
        }

        return $result;
    }

    public static function markResolved(int $issueId, int $adminId = 0)
    {
        $issueId = (int) $issueId;
        if ($issueId < 1) {
            return 0;
        }
        $adminId = max(0, (int) $adminId);

        return Db::name(self::ISSUE_TABLE)->where([
            'issue_id' => $issueId,
            'resolved_at' => 0,
        ])->update([
            'resolved_at' => time(),
            'resolved_by' => $adminId,
        ]);
    }

    private static function scanVodItem(array $vod, array $options)
    {
        $issues = [];
        $vodId = (int) ($vod['vod_id'] ?? 0);
        if ($vodId < 1) {
            return $issues;
        }
        $vodName = trim((string) ($vod['vod_name'] ?? ''));
        $vodClass = trim((string) ($vod['vod_class'] ?? ''));
        $vodArea = trim((string) ($vod['vod_area'] ?? ''));
        $vodYear = trim((string) ($vod['vod_year'] ?? ''));
        $vodPic = trim((string) ($vod['vod_pic'] ?? ''));
        $vodContent = trim((string) ($vod['vod_content'] ?? ''));
        $vodPlay = trim((string) ($vod['vod_play_url'] ?? ''));
        $vodStatus = (int) ($vod['vod_status'] ?? 1);

        if ($vodName === '') {
            $issues[] = self::buildIssue($vodId, $vodName, self::LEVEL_CRITICAL, 'FIELD_MISSING', 'vod_name', '影片标题不能为空');
        }
        if ($vodPic === '') {
            $issues[] = self::buildIssue($vodId, $vodName, self::LEVEL_CRITICAL, 'FIELD_MISSING', 'vod_pic', '海报地址不能为空');
        } else {
            if (!self::isLikelyImageUrl($vodPic)) {
                $issues[] = self::buildIssue($vodId, $vodName, self::LEVEL_WARNING, 'PIC_URL_FORMAT', 'vod_pic', '海报地址格式异常');
            } elseif (!self::isAllowedLocalImage($vodPic) && $options['check_cover_head']) {
                $reachable = self::checkHttpUrlReachable($vodPic, (int) $options['cover_head_timeout']);
                if (!$reachable) {
                    $issues[] = self::buildIssue($vodId, $vodName, self::LEVEL_WARNING, 'PIC_URL_UNREACHABLE', 'vod_pic', '海报链接不可达');
                }
            }
        }
        if ($vodClass === '') {
            $issues[] = self::buildIssue($vodId, $vodName, self::LEVEL_WARNING, 'FIELD_MISSING', 'vod_class', '分类信息为空');
        }
        if ($vodArea === '') {
            $issues[] = self::buildIssue($vodId, $vodName, self::LEVEL_INFO, 'FIELD_MISSING', 'vod_area', '地区信息为空');
        }
        if ($vodYear === '') {
            $issues[] = self::buildIssue($vodId, $vodName, self::LEVEL_CRITICAL, 'FIELD_MISSING', 'vod_year', '上映年份不能为空');
        } else {
            $year = (int) $vodYear;
            $currentYear = (int) date('Y');
            if ($year < 1900 || $year > $currentYear + 1) {
                $issues[] = self::buildIssue($vodId, $vodName, self::LEVEL_WARNING, 'YEAR_INVALID', 'vod_year', "上映年份超出范围: {$vodYear}");
            }
        }
        if (mb_strlen($vodContent, 'UTF-8') < 20) {
            $issues[] = self::buildIssue($vodId, $vodName, self::LEVEL_INFO, 'CONTENT_SHORT', 'vod_content', '简介内容较短');
        }
        if ($vodPlay === '') {
            $issues[] = self::buildIssue($vodId, $vodName, self::LEVEL_CRITICAL, 'FIELD_MISSING', 'vod_play_url', '播放源不能为空');
        } elseif (!self::hasPlayableSource($vodPlay)) {
            $issues[] = self::buildIssue($vodId, $vodName, self::LEVEL_WARNING, 'PLAY_URL_FORMAT', 'vod_play_url', '播放源格式或内容可能异常');
        }
        if ($vodStatus !== 1) {
            $issues[] = self::buildIssue($vodId, $vodName, self::LEVEL_INFO, 'STATUS_DISABLED', 'vod_status', '影片状态未启用');
        }

        return $issues;
    }

    private static function scanDuplicates(int $groupLimit)
    {
        $limit = max(1, min(2000, $groupLimit));
        $rows = Db::name(self::VOD_TABLE)
            ->field('vod_name,vod_year,COUNT(*) AS total_count')
            ->where('vod_name', '<>', '')
            ->group('vod_name,vod_year')
            ->having('total_count>1')
            ->order('total_count desc')
            ->limit($limit)
            ->select();
        if (is_object($rows) && method_exists($rows, 'toArray')) {
            $rows = $rows->toArray();
        }
        if (!is_array($rows)) {
            return [];
        }

        if (empty($rows)) {
            return [];
        }

        $ids = [];
        foreach ($rows as $row) {
            $name = (string) ($row['vod_name'] ?? '');
            $year = (string) ($row['vod_year'] ?? '');
            if ($name === '') {
                continue;
            }

            $items = Db::name(self::VOD_TABLE)
                ->field('vod_id,vod_name,vod_year')
                ->where('vod_name', $name)
                ->where('vod_year', $year)
                ->select();
            if (is_object($items) && method_exists($items, 'toArray')) {
                $items = $items->toArray();
            }
            if (!is_array($items)) {
                continue;
            }
            foreach ($items as $vod) {
                $ids[] = [
                    'vod_id' => (int) ($vod['vod_id'] ?? 0),
                    'vod_name' => (string) ($vod['vod_name'] ?? ''),
                    'vod_year' => (string) ($vod['vod_year'] ?? ''),
                    'total_count' => (int) ($row['total_count'] ?? 0),
                ];
            }
        }

        return $ids;
    }

    private static function isLikelyImageUrl(string $url)
    {
        return filter_var($url, FILTER_VALIDATE_URL) !== false || str_starts_with($url, '/');
    }

    private static function isAllowedLocalImage(string $url)
    {
        $lower = strtolower($url);
        return str_starts_with($lower, '/')
            || str_starts_with($lower, 'upload/')
            || str_starts_with($lower, 'static/');
    }

    private static function hasPlayableSource(string $playUrl)
    {
        if (strpos($playUrl, '$') === false) {
            return false;
        }

        if (preg_match('/https?:\\/\\//i', $playUrl)) {
            return true;
        }

        return strpos($playUrl, '#') !== false || strpos($playUrl, '$$') !== false;
    }

    private static function checkHttpUrlReachable(string $url, int $timeoutSeconds = 3)
    {
        if (!str_starts_with(strtolower($url), 'http://') && !str_starts_with(strtolower($url), 'https://')) {
            return true;
        }

        $timeout = max(1, min(10, $timeoutSeconds));
        $context = stream_context_create([
            'http' => [
                'method' => 'HEAD',
                'timeout' => $timeout,
                'ignore_errors' => true,
                'follow_location' => 1,
                'max_redirects' => 3,
            ],
            'ssl' => [
                'verify_peer' => false,
                'verify_peer_name' => false,
            ],
        ]);

        $headers = @get_headers($url, 1, $context);
        if (!is_array($headers) || empty($headers)) {
            return false;
        }
        $status = (string) $headers[0];
        if (preg_match('/HTTP\\/\\S+\\s(\\d{3})/i', $status, $matches)) {
            $code = (int) $matches[1];
            return $code >= 200 && $code < 400;
        }

        return false;
    }

    private static function buildIssue($vodId, string $vodName, string $level, string $code, string $field, string $message)
    {
        return [
            'vod_id' => (int) $vodId,
            'vod_name' => $vodName,
            'issue_level' => $level,
            'issue_code' => $code,
            'field_name' => $field,
            'message' => $message,
            'snapshot' => '',
            'created_at' => time(),
        ];
    }

    private static function flushIssueBuffer(int $scanId, array &$issues)
    {
        if (empty($issues)) {
            return 0;
        }

        $prepared = [];
        $now = time();
        foreach ($issues as $issue) {
            if (!is_array($issue)) {
                continue;
            }
            $prepared[] = array_merge($issue, [
                'scan_id' => $scanId,
                'created_at' => $now,
            ]);
        }

        $inserted = 0;
        if (!empty($prepared)) {
            $chunks = array_chunk($prepared, self::BATCH_MAX_INSERT);
            foreach ($chunks as $chunk) {
                Db::name(self::ISSUE_TABLE)->insertAll($chunk);
                $inserted += count($chunk);
            }
        }

        return $inserted;
    }

    private static function normalizeConfig(array $options)
    {
        $cfg = [];
        $cfg['batch_size'] = max(50, min(2000, (int) ($options['batch_size'] ?? 200)));
        $cfg['max_items_per_scan'] = max(0, (int) ($options['max_items_per_scan'] ?? 0));
        $cfg['check_cover_head'] = !empty($options['check_cover_head']);
        $cfg['cover_head_timeout'] = max(1, min(10, (int) ($options['cover_head_timeout'] ?? 3)));
        $cfg['duplicate_group_limit'] = max(1, min(2000, (int) ($options['duplicate_group_limit'] ?? 200)));

        return $cfg;
    }
}
