<?php

namespace addons\vodops\backend;

use addons\vodops\service\DoubanActionException;
use addons\vodops\service\DoubanData;
use app\admin\controller\Base;

class DoubanController extends Base
{
    public function index()
    {
        return redirect(url('vodops/douban'));
    }

    public function saveConfig()
    {
        return $this->postAction(function () {
            return json([
                'code' => 1,
                'msg' => '配置已保存',
                'data' => DoubanData::saveConfig(input()),
            ]);
        });
    }

    public function enqueue()
    {
        return $this->postAction(function () {
            $limit = (int) input('limit/d', 100);
            return json([
                'code' => 1,
                'msg' => '任务已生成',
                'data' => DoubanData::enqueueDue($limit, $this->adminId()),
            ]);
        });
    }

    public function previewTargeted()
    {
        return $this->postAction(function () {
            return json([
                'code' => 1,
                'msg' => '定向任务预览完成',
                'data' => DoubanData::previewTargetedTasks(input()),
            ]);
        });
    }

    public function enqueueTargeted()
    {
        return $this->postAction(function () {
            return json([
                'code' => 1,
                'msg' => '定向任务已生成',
                'data' => DoubanData::enqueueTargeted(input(), $this->adminId()),
            ]);
        }, '请先预览并确认定向任务');
    }

    public function run()
    {
        return $this->postAction(function () {
            $limit = (int) input('limit/d', 20);
            return json([
                'code' => 1,
                'msg' => 'Worker 执行完成',
                'data' => DoubanData::runPending($limit, $this->adminId()),
            ]);
        });
    }

    public function retryFailed()
    {
        return $this->postAction(function () {
            $limit = (int) input('limit/d', 100);
            return json([
                'code' => 1,
                'msg' => '失败任务已重新入队',
                'data' => DoubanData::retryFailed($limit, $this->adminId()),
            ]);
        });
    }

    public function fetchVod()
    {
        return $this->postAction(function () {
            $vodId = (int) input('vod_id/d', 0);
            $result = DoubanData::fetchVod($vodId, $this->adminId());
            $result = $this->appendWorkspaceState($result, $vodId);
            return json([
                'code' => 1,
                'msg' => (string) ($result['msg'] ?? '豆瓣数据获取完成'),
                'data' => $result,
            ]);
        });
    }

    public function sync()
    {
        return $this->postAction(function () {
            $vodId = (int) input('vod_id/d', 0);
            $result = DoubanData::syncVod($vodId, $this->adminId());
            $result = $this->appendWorkspaceState($result, $vodId);
            return json([
                'code' => 1,
                'msg' => '同步完成',
                'data' => $result,
            ]);
        });
    }

    public function previewManualSync()
    {
        return $this->postAction(function () {
            return json([
                'code' => 1,
                'msg' => '字段更新预览已生成',
                'data' => DoubanData::previewManualSync((int) input('vod_id/d', 0)),
            ]);
        });
    }

    public function applyManualSync()
    {
        return $this->postAction(function () {
            $vodId = (int) input('vod_id/d', 0);
            $result = DoubanData::applyManualSync(
                $vodId,
                (array) input('fields/a', []),
                (string) input('context_token/s', ''),
                $this->adminId()
            );
            $result = $this->appendWorkspaceState($result, $vodId);
            return json([
                'code' => 1,
                'msg' => '所选字段已更新',
                'data' => $result,
            ]);
        }, '请确认更新所选字段');
    }

    public function rollbackPic()
    {
        return $this->postAction(function () {
            $vodId = (int) input('vod_id/d', 0);
            $result = DoubanData::rollbackPicture($vodId, $this->adminId());
            $result = $this->appendWorkspaceState($result, $vodId);
            return json([
                'code' => 1,
                'msg' => '图片已回退',
                'data' => $result,
            ]);
        }, '请确认回退图片');
    }

    public function calibrate()
    {
        return $this->postAction(function () {
            return json([
                'code' => 1,
                'msg' => '豆瓣评分校准完成',
                'data' => DoubanData::calibrateScores($this->adminId()),
            ]);
        }, '请确认执行全量评分校准');
    }

    public function previewCalibration()
    {
        return $this->postAction(function () {
            return json([
                'code' => 1,
                'msg' => '分类校准预览完成',
                'data' => DoubanData::previewScoreCalibration(
                    (array) input('type_ids/a', []),
                    (int) input('include_children/d', 1)
                ),
            ]);
        });
    }

    public function calibrateByType()
    {
        return $this->postAction(function () {
            return json([
                'code' => 1,
                'msg' => '所选分类的评分校准任务已生成',
                'data' => DoubanData::calibrateScoresByType(
                    (array) input('type_ids/a', []),
                    (int) input('include_children/d', 1),
                    $this->adminId()
                ),
            ]);
        }, '请先预览并确认分类校准');
    }

    public function setDoubanId()
    {
        return $this->postAction(function () {
            $vodId = (int) input('vod_id/d', 0);
            $result = DoubanData::setDoubanId(
                $vodId,
                (string) input('douban_id', ''),
                (int) input('lock/d', 0),
                $this->adminId()
            );
            $result = $this->appendWorkspaceState($result, $vodId);
            return json([
                'code' => 1,
                'msg' => '豆瓣ID已保存',
                'data' => $result,
            ]);
        });
    }

    public function lock()
    {
        return $this->postAction(function () {
            $vodId = (int) input('vod_id/d', 0);
            $result = DoubanData::setLock(
                $vodId,
                (string) input('field', 'id'),
                (int) input('locked/d', 1),
                $this->adminId()
            );
            $result = $this->appendWorkspaceState($result, $vodId);
            return json([
                'code' => 1,
                'msg' => '锁定状态已更新',
                'data' => $result,
            ]);
        });
    }

    public function ignore()
    {
        return $this->postAction(function () {
            $vodId = (int) input('vod_id/d', 0);
            $result = DoubanData::ignore($vodId, (int) input('days/d', 30), $this->adminId());
            $result = $this->appendWorkspaceState($result, $vodId);
            return json([
                'code' => 1,
                'msg' => '已忽略',
                'data' => $result,
            ]);
        }, '请确认忽略该影片30天');
    }

    public function restore()
    {
        return $this->postAction(function () {
            $vodId = (int) input('vod_id/d', 0);
            $result = DoubanData::restoreIgnored($vodId, $this->adminId());
            $result = $this->appendWorkspaceState($result, $vodId);
            return json([
                'code' => 1,
                'msg' => !empty($result['created_task']) ? '已恢复处理并生成任务' : '已恢复处理，已有任务未重复生成',
                'data' => $result,
            ]);
        });
    }

    public function startAudit()
    {
        return $this->postAction(function () {
            return json([
                'code' => 1,
                'msg' => '全库体检已开始',
                'data' => DoubanData::startAudit((int) input('batch_size/d', 100), $this->adminId()),
            ]);
        }, '请确认开始全库体检');
    }

    public function runAuditBatch()
    {
        return $this->postAction(function () {
            return json([
                'code' => 1,
                'msg' => '本批体检完成',
                'data' => DoubanData::runAuditBatch((int) input('scan_id/d', 0)),
            ]);
        });
    }

    public function pauseAudit()
    {
        return $this->postAction(function () {
            return json([
                'code' => 1,
                'msg' => '全库体检已暂停',
                'data' => DoubanData::pauseAudit((int) input('scan_id/d', 0)),
            ]);
        });
    }

    public function resumeAudit()
    {
        return $this->postAction(function () {
            return json([
                'code' => 1,
                'msg' => '全库体检已恢复',
                'data' => DoubanData::resumeAudit((int) input('scan_id/d', 0)),
            ]);
        });
    }

    public function exportAudit()
    {
        $scanId = max(0, (int) input('scan_id/d', 0));
        if ($scanId < 1) {
            return '体检任务ID无效。';
        }
        $code = trim((string) input('code', ''));

        try {
            $afterId = 0;
            $rows = DoubanData::auditIssueExportBatch($scanId, $afterId, 1000, $code);
            header('Content-Type: text/csv; charset=UTF-8');
            header('Content-Disposition: attachment; filename="douban-audit-' . $scanId . '-' . date('Ymd-His') . '.csv"');
            header('X-Content-Type-Options: nosniff');
            $output = fopen('php://output', 'wb');
            fwrite($output, "\xEF\xBB\xBF");
            fputcsv($output, ['问题ID', '扫描ID', '视频ID', '分类ID', '视频名称', '级别', '问题代码', '字段', '说明', '记录时间']);
            while (true) {
                foreach ($rows as $row) {
                    $afterId = max($afterId, (int) ($row['issue_id'] ?? 0));
                    fputcsv($output, [
                        (int) ($row['issue_id'] ?? 0),
                        (int) ($row['scan_id'] ?? 0),
                        (int) ($row['vod_id'] ?? 0),
                        (int) ($row['type_id'] ?? 0),
                        $this->csvCell($row['vod_name'] ?? ''),
                        $this->csvCell($row['issue_level'] ?? ''),
                        $this->csvCell($row['issue_code'] ?? ''),
                        $this->csvCell($row['field_name'] ?? ''),
                        $this->csvCell($row['message'] ?? ''),
                        date('Y-m-d H:i:s', (int) ($row['created_at'] ?? 0)),
                    ]);
                }
                if (count($rows) < 1000) {
                    break;
                }
                $rows = DoubanData::auditIssueExportBatch($scanId, $afterId, 1000, $code);
            }
            fclose($output);

            return '';
        } catch (\Throwable $e) {
            $this->logFailure('导出体检报告', $e);
            return '导出失败，请查看服务端日志。';
        }
    }

    private function csvCell($value)
    {
        $value = (string) $value;
        return preg_match('/^[\s]*[=+\-@]/u', $value) ? ("'" . $value) : $value;
    }

    private function appendWorkspaceState(array $result, int $vodId)
    {
        try {
            $result['video_state'] = DoubanData::videoState($vodId);
            $result['collection_state'] = DoubanData::collectionState(
                $vodId,
                (string) input('status', 'all'),
                (string) input('q', ''),
                (int) input('type_id/d', 0),
                (string) input('year', ''),
                (string) input('task_status', 'PENDING')
            );
        } catch (\Throwable $e) {
            $this->logFailure('刷新豆瓣工作区状态', $e);
            $result['state_warning'] = '操作已完成，但局部状态获取失败，请手动刷新后确认。';
        }

        return $result;
    }

    private function postAction(callable $action, $confirmationMessage = null)
    {
        if (!Request()->isPost()) {
            return json(['code' => 1001, 'msg' => '请求方式错误'], 405);
        }
        if (!Request()->isAjax()) {
            return json(['code' => 1004, 'msg' => '请求来源校验失败'], 405);
        }
        if ($confirmationMessage !== null && (int) input('confirm/d', 0) !== 1) {
            return json(['code' => 1001, 'msg' => $confirmationMessage]);
        }

        try {
            return $action();
        } catch (\Throwable $e) {
            return $this->errorJson($e);
        }
    }

    private function errorJson(\Throwable $e)
    {
        if ($e instanceof DoubanActionException || $e instanceof \InvalidArgumentException) {
            return json([
                'code' => 1003,
                'msg' => $e->getMessage(),
                'data' => null,
            ], 409);
        }

        $this->logFailure('豆瓣操作', $e);
        return json([
            'code' => 1002,
            'msg' => '豆瓣操作失败，请查看服务端日志。',
            'data' => null,
        ], 500);
    }

    private function adminId()
    {
        return (int) ($this->_admin['admin_id'] ?? 0);
    }

    private function logFailure(string $action, \Throwable $error)
    {
        if (function_exists('trace')) {
            trace('[vodops] ' . $action . '失败：' . $error->getMessage(), 'error');
        }
    }
}
