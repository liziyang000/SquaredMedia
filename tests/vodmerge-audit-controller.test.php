<?php

namespace app\admin\controller {
    class Base
    {
        public $_admin = ['admin_id' => 1];
        public $view;

        public function __construct()
        {
            $this->_admin['admin_id'] = $GLOBALS['audit_admin_id'] ?? 1;
            $this->view = new class {
                public function config($name, $value) {}
            };
        }
    }
}

namespace think\exception {
    class HttpException extends \RuntimeException
    {
        public function __construct($status, $message)
        {
            parent::__construct($message, $status);
        }
    }
}

namespace think {
    class Cache
    {
        public static function clear()
        {
            $GLOBALS['audit_cache_clears']++;
        }
    }
}

namespace addons\vodmerge\service {
    class Runtime
    {
        public static function service()
        {
            $GLOBALS['library_service_calls']++;
            if (!empty($GLOBALS['library_service_failure'])) {
                throw new \PDOException('PRIVATE_DB_ERROR');
            }
            return new class {
                private function result($method, array $arguments)
                {
                    $GLOBALS['library_method_calls'][] = [$method, $arguments];
                    if (isset($GLOBALS['library_service_error'])) {
                        throw $GLOBALS['library_service_error'];
                    }
                    return ['issue_id' => $arguments[0], 'job' => ['status' => 'fixture']];
                }
                public function libraryStatus($id) { return $this->result('status', [$id]); }
                public function libraryPreview($id, $target, $separate = false) { return $this->result('preview', [$id, $target, $separate]); }
                public function libraryApply($id, $job, $token, $operator) { return $this->result('apply', [$id, $job, $token, $operator]); }
                public function libraryRollback($id, $job, $operator) { return $this->result('rollback', [$id, $job, $operator]); }
                public function libraryRecover($id, $job) { return $this->result('recover', [$id, $job]); }
            };
        }
        public static function invalidate()
        {
            \think\Cache::clear();
        }
        public static function audit()
        {
            $GLOBALS['audit_runtime_calls']++;
            if ($GLOBALS['audit_runtime_failure']) {
                throw new \PDOException('PRIVATE_DB_ERROR');
            }
            return new class {
                public function summary()
                {
                    $GLOBALS['audit_summary_calls']++;
                    return ['assessment_counts' => ['high' => 2, 'probable' => 3, 'related' => 4]];
                }
                public function issues($runId, $before = 0, $kind = '', $quality = '', $beforePriority = -1)
                {
                    $GLOBALS['audit_issue_calls'][] = [$runId, $before, $kind, $quality, $beforePriority];
                    if (isset($GLOBALS['audit_listing_error'])) {
                        throw $GLOBALS['audit_listing_error'];
                    }
                    return ['items' => [], 'has_more' => false, 'next_before' => 0, 'next_priority' => -1,
                        'assessment_updating' => !empty($GLOBALS['audit_assessment_updating'])];
                }
                public function reviewIssue($id, $force = false)
                {
                    $GLOBALS['audit_review_calls'][] = [$id, $force];
                    if (isset($GLOBALS['audit_review_error'])) {
                        throw $GLOBALS['audit_review_error'];
                    }
                    return ['issue_id' => $id, 'detail' => ['ai_review' => ['status' => 'ok']]];
                }
            };
        }
    }
}

namespace {
    $checks = 0;
    function auditControllerCheck($condition, string $message): void
    {
        global $checks;
        $checks++;
        if (!$condition) {
            throw new RuntimeException($message);
        }
    }
    function request()
    {
        return new class {
            public function isPost() { return $GLOBALS['audit_post']; }
            public function isAjax() { return $GLOBALS['audit_ajax']; }
        };
    }
    function session($name)
    {
        return $GLOBALS['audit_session'][$name] ?? null;
    }
    function input($name, $default = null)
    {
        $name = explode('/', $name)[0];
        return $GLOBALS['audit_input'][strpos($name, 'post.') === 0 ? substr($name, 5) : $name] ?? $default;
    }
    function json($data, $status = 200)
    {
        return ['status' => $status, 'body' => $data];
    }

    if (($argv[1] ?? '') === '--child') {
        define('APP_PATH', $argv[2] . '/application/');
        require APP_PATH . 'admin/controller/Vodmerge.php';
        $controller = new \app\admin\controller\Vodmerge();
        $GLOBALS['audit_runtime_calls'] = 0;
        $GLOBALS['audit_runtime_failure'] = true;
        $GLOBALS['audit_review_calls'] = [];
        $GLOBALS['audit_issue_calls'] = [];
        $GLOBALS['audit_summary_calls'] = 0;
        $GLOBALS['library_service_calls'] = 0;
        $GLOBALS['library_method_calls'] = [];
        $GLOBALS['audit_cache_clears'] = 0;
        foreach ([[false, true, 'valid', 'valid', 405], [true, false, 'valid', 'valid', 405],
            [true, true, 'valid', 'wrong', 403], [true, true, 'valid', '', 403], [true, true, '', '', 403]] as $case) {
            [$GLOBALS['audit_post'], $GLOBALS['audit_ajax'], $sessionToken, $sentToken, $expected] = $case;
            $GLOBALS['audit_session'] = ['vodmerge_csrf' => $sessionToken];
            $GLOBALS['audit_input'] = ['operation' => 'start', 'csrf' => $sentToken, 'weekly' => 1];
            $response = $controller->auditAction();
            auditControllerCheck($response['status'] === $expected, 'A rejected method, Ajax header, or CSRF token must receive its expected HTTP status');
            auditControllerCheck($GLOBALS['audit_runtime_calls'] === 0, 'Rejected audit mutations must never reach the database dependency');
            $GLOBALS['audit_input']['operation'] = 'review';
            $GLOBALS['audit_input']['issue_id'] = 7;
            $GLOBALS['audit_input']['force'] = 1;
            $response = $controller->auditAction();
            auditControllerCheck($response['status'] === $expected && $GLOBALS['audit_runtime_calls'] === 0 && $GLOBALS['audit_review_calls'] === [], 'Rejected on-demand reviews cannot reach storage or AI calls');
            foreach (['merge_preview', 'merge_apply', 'merge_rollback', 'merge_recover'] as $operation) {
                $GLOBALS['audit_input']['operation'] = $operation;
                $GLOBALS['audit_input'] += ['target_id' => 100, 'job_id' => 8, 'preview_token' => str_repeat('a', 64), 'confirmed' => 1];
                $response = $controller->auditAction();
                auditControllerCheck($response['status'] === $expected && $GLOBALS['library_service_calls'] === 0, 'All library mutations enforce method, Ajax and CSRF before reaching the merge service');
            }
        }
        $GLOBALS['audit_post'] = $GLOBALS['audit_ajax'] = true;
        $GLOBALS['audit_session'] = ['vodmerge_csrf' => 'valid'];
        foreach (['start', 'schedule'] as $operation) {
            $GLOBALS['audit_input'] = ['operation' => $operation, 'csrf' => 'valid', 'weekly' => 1, 'enabled' => 1];
            $response = $controller->auditAction();
            auditControllerCheck($response['status'] === 503, 'A PDO failure must be reported as an unavailable audit operation');
            auditControllerCheck($response['body']['code'] !== 1 && $response['body']['msg'] !== '', 'A database failure must provide a clear unsuccessful response');
            auditControllerCheck(strpos(json_encode($response), 'PRIVATE_DB_ERROR') === false, 'A database failure must not expose its raw private exception message');
        }
        auditControllerCheck($GLOBALS['audit_runtime_calls'] === 2, 'Authorized audit operations really exercise the failing database boundary');
        $GLOBALS['audit_input'] = ['operation' => 'review', 'csrf' => 'valid', 'issue_id' => 7, 'force' => 0];
        $response = $controller->auditAction();
        auditControllerCheck($response['status'] === 503 && strpos(json_encode($response), 'PRIVATE_DB_ERROR') === false, 'A review database failure uses the same safe unavailable response');
        $GLOBALS['audit_runtime_failure'] = false;
        foreach ([[7, 0, false], ['7', '1', true]] as $case) {
            $GLOBALS['audit_input'] = ['operation' => 'review', 'csrf' => 'valid', 'issue_id' => $case[0], 'force' => $case[1]];
            $response = $controller->auditAction();
            auditControllerCheck($response['status'] === 200 && $response['body']['code'] === 1 && $response['body']['data']['issue_id'] === 7, 'An authorized review returns one selected issue rather than triggering a scan');
            auditControllerCheck(end($GLOBALS['audit_review_calls']) === [7, $case[2]], 'The controller passes the validated issue ID and force flag to on-demand review');
        }
        foreach ([[0, 0], [-1, 0], ['1.5', 0], ['7tail', 0], ['9223372036854775808', 0], [[], 0], [7, 2], [7, -1], [7, 'true'], [7, []]] as $case) {
            $beforeCalls = count($GLOBALS['audit_review_calls']);
            $GLOBALS['audit_input'] = ['operation' => 'review', 'csrf' => 'valid', 'issue_id' => $case[0], 'force' => $case[1]];
            $response = $controller->auditAction();
            auditControllerCheck($response['status'] === 400 && $response['body']['code'] !== 1, 'Invalid issue IDs and force values must receive an invalid-input response');
            auditControllerCheck(count($GLOBALS['audit_review_calls']) === $beforeCalls, 'Invalid review parameters never issue a model review');
        }
        $GLOBALS['audit_input'] = ['operation' => 'review', 'csrf' => 'valid', 'issue_id' => 7];
        $response = $controller->auditAction();
        auditControllerCheck($response['status'] === 200 && end($GLOBALS['audit_review_calls']) === [7, false], 'An omitted force flag defaults to an ordinary cached review');
        $GLOBALS['audit_review_error'] = new RuntimeException('请先配置 Jev Token。');
        $response = $controller->auditAction();
        auditControllerCheck($response['status'] === 409 && $response['body']['msg'] === '请先配置 Jev Token。', 'Expected review failures preserve their actionable safe message');
        unset($GLOBALS['audit_review_error']);
        $beforeReviews = count($GLOBALS['audit_review_calls']);
        $beforeLibrary = $GLOBALS['library_service_calls'];
        $beforeClears = $GLOBALS['audit_cache_clears'];
        $GLOBALS['audit_input'] = [];
        $response = $controller->auditStatus();
        auditControllerCheck($response['status'] === 200 && $GLOBALS['audit_summary_calls'] === 1 && $response['body']['data']['assessment_counts']['high'] === 2, 'A status read returns the persisted quality-group summary without launching assessment or review');
        foreach ([
            [[], [0, 0, '', '', -1]],
            [['run_id' => '8', 'before' => '120', 'kind' => 'conflict', 'quality' => 'review', 'before_priority' => '2'], [8, 120, 'conflict', 'review', 2]],
            [['run_id' => 8, 'quality' => 'all'], [8, 0, '', 'all', -1]],
            [['run_id' => 8, 'before' => 60, 'quality' => 'related', 'before_priority' => 0], [8, 60, '', 'related', 0]],
        ] as $case) {
            $GLOBALS['audit_input'] = $case[0];
            $response = $controller->auditIssues();
            auditControllerCheck($response['status'] === 200 && $response['body']['code'] === 1 && end($GLOBALS['audit_issue_calls']) === $case[1], 'A result read forwards the selected quality filter and both composite cursor values including zero priority');
            auditControllerCheck($response['body']['data']['next_priority'] === -1, 'The quality continuation cursor is returned unchanged to the page');
        }
        $GLOBALS['audit_assessment_updating'] = true;
        $GLOBALS['audit_input'] = ['run_id' => 8, 'quality' => 'all'];
        $response = $controller->auditIssues();
        auditControllerCheck($response['status'] === 200 && $response['body']['data']['assessment_updating'] === true, 'The first-page read returns the assessment-updating flag unchanged so the page can disable unstable continuations');
        unset($GLOBALS['audit_assessment_updating']);
        auditControllerCheck(count($GLOBALS['audit_review_calls']) === $beforeReviews && $GLOBALS['library_service_calls'] === $beforeLibrary && $GLOBALS['audit_cache_clears'] === $beforeClears, 'Quality-group status and list reads do not review, merge or invalidate video caches');
        $GLOBALS['audit_listing_error'] = new InvalidArgumentException('排查质量筛选参数无效。');
        $response = $controller->auditIssues();
        auditControllerCheck($response['status'] === 400 && $response['body']['code'] !== 1 && $response['body']['msg'] === '排查质量筛选参数无效。', 'A rejected quality cursor or filter receives an actionable invalid-input response');
        $GLOBALS['audit_listing_error'] = new PDOException('PRIVATE_DB_ERROR');
        $response = $controller->auditIssues();
        auditControllerCheck($response['status'] === 503 && strpos(json_encode($response), 'PRIVATE_DB_ERROR') === false, 'A quality-list database failure cannot expose its raw private exception');
        unset($GLOBALS['audit_listing_error']);
        $GLOBALS['audit_input'] = ['issue_id' => '7'];
        $response = $controller->libraryStatus();
        auditControllerCheck($response['status'] === 200 && $response['body']['data']['issue_id'] === 7 && end($GLOBALS['library_method_calls']) === ['status', [7]], 'A read-only library status request passes the selected positive issue ID');
        foreach ([0, -1, '1.5', '7tail', '01', '9223372036854775808', []] as $invalid) {
            $GLOBALS['audit_input'] = ['issue_id' => $invalid];
            $beforeCalls = $GLOBALS['library_service_calls'];
            $response = $controller->libraryStatus();
            auditControllerCheck($response['status'] === 400 && $GLOBALS['library_service_calls'] === $beforeCalls, 'A malformed library status ID cannot be truncated or reach the service');
        }
        $valid = ['issue_id' => 7, 'target_id' => 100, 'job_id' => 8, 'preview_token' => str_repeat('a', 64), 'confirmed' => 1, 'separate' => 0, 'csrf' => 'valid'];
        foreach ([
            ['merge_preview', ['preview', [7, 100, false]], 0],
            ['merge_apply', ['apply', [7, 8, str_repeat('a', 64), 1]], 1],
            ['merge_rollback', ['rollback', [7, 8, 1]], 1],
            ['merge_recover', ['recover', [7, 8]], 1],
        ] as $case) {
            $GLOBALS['audit_input'] = $valid + ['operation' => $case[0]];
            $beforeClears = $GLOBALS['audit_cache_clears'];
            $response = $controller->auditAction();
            auditControllerCheck($response['status'] === 200 && $response['body']['code'] === 1 && end($GLOBALS['library_method_calls']) === $case[1], 'The controller routes validated library operation and super-admin ID: ' . $case[0]);
            auditControllerCheck($GLOBALS['audit_cache_clears'] === $beforeClears + $case[2], 'Only confirmed writes, rollback and recovery invalidate the site cache: ' . $case[0]);
        }
        $GLOBALS['audit_input'] = array_merge($valid, ['operation' => 'merge_preview', 'separate' => '1', 'confirmed' => '1']);
        $response = $controller->auditAction();
        auditControllerCheck($response['status'] === 200 && end($GLOBALS['library_method_calls']) === ['preview', [7, 100, true]], 'An explicit independent route flag is forwarded as a boolean');
        foreach ([
            ['merge_preview', 'target_id', 0], ['merge_preview', 'target_id', '1.5'], ['merge_preview', 'target_id', []],
            ['merge_preview', 'confirmed', 0], ['merge_preview', 'confirmed', 'true'], ['merge_preview', 'confirmed', []],
            ['merge_preview', 'separate', 2], ['merge_preview', 'separate', 'true'], ['merge_preview', 'separate', []],
            ['merge_apply', 'job_id', 0], ['merge_apply', 'job_id', '8tail'], ['merge_rollback', 'job_id', []],
            ['merge_recover', 'job_id', '9223372036854775808'], ['merge_apply', 'preview_token', ''],
            ['merge_apply', 'preview_token', []], ['merge_apply', 'preview_token', str_repeat('z', 64)],
        ] as $case) {
            $GLOBALS['audit_input'] = array_merge($valid, ['operation' => $case[0], $case[1] => $case[2]]);
            $beforeCalls = $GLOBALS['library_service_calls'];
            $response = $controller->auditAction();
            auditControllerCheck($response['status'] === 400 && $GLOBALS['library_service_calls'] === $beforeCalls, 'Invalid library mutation parameters are rejected before opening a service: ' . $case[0] . '/' . $case[1]);
        }
        foreach (['merge_preview', 'merge_apply', 'merge_rollback', 'merge_recover'] as $operation) {
            $GLOBALS['audit_input'] = array_merge($valid, ['operation' => $operation, 'issue_id' => '7tail']);
            $beforeCalls = $GLOBALS['library_service_calls'];
            $response = $controller->auditAction();
            auditControllerCheck($response['status'] === 400 && $GLOBALS['library_service_calls'] === $beforeCalls, 'Every library mutation strictly validates its issue ID before opening a service');
        }
        $GLOBALS['audit_input'] = $valid + ['operation' => 'merge_preview'];
        unset($GLOBALS['audit_input']['confirmed']);
        $beforeCalls = $GLOBALS['library_service_calls'];
        $response = $controller->auditAction();
        auditControllerCheck($response['status'] === 400 && $GLOBALS['library_service_calls'] === $beforeCalls, 'A preview requires the explicit same-work/season/version human confirmation');
        $GLOBALS['library_service_failure'] = true;
        $GLOBALS['audit_input'] = $valid + ['operation' => 'merge_apply'];
        $beforeClears = $GLOBALS['audit_cache_clears'];
        $response = $controller->auditAction();
        auditControllerCheck($response['status'] === 503 && strpos(json_encode($response), 'PRIVATE_DB_ERROR') === false && $GLOBALS['audit_cache_clears'] === $beforeClears, 'Library database failures stay private and cannot report or clear cache for a successful write');
        $GLOBALS['library_service_failure'] = false;
        $GLOBALS['library_service_error'] = new RuntimeException('预览已失效，请重新预览。');
        $response = $controller->auditAction();
        auditControllerCheck($response['status'] === 409 && $response['body']['msg'] === '预览已失效，请重新预览。', 'Library merge conflicts preserve the actionable safe failure message');
        unset($GLOBALS['library_service_error']);
        $GLOBALS['audit_admin_id'] = 2;
        $beforeCalls = $GLOBALS['audit_runtime_calls'];
        $beforeLibraryCalls = $GLOBALS['library_service_calls'];
        try {
            new \app\admin\controller\Vodmerge();
            throw new RuntimeException('A non-super-admin unexpectedly created the review controller');
        } catch (\think\exception\HttpException $error) {
            auditControllerCheck($error->getCode() === 403 && $GLOBALS['audit_runtime_calls'] === $beforeCalls && $GLOBALS['library_service_calls'] === $beforeLibraryCalls, 'A non-super-admin is rejected before obtaining any audit or merge service');
        }
        echo json_encode(['checks' => $checks]) . "\n";
        exit(0);
    }

    $temporary = sys_get_temp_dir() . '/vodmerge-audit-controller-' . bin2hex(random_bytes(8));
    mkdir($temporary . '/application/admin/controller', 0700, true);
    mkdir($temporary . '/addons/vodmerge', 0700, true);
    try {
        copy(dirname(__DIR__) . '/addons/vodmerge/application/admin/controller/Vodmerge.php', $temporary . '/application/admin/controller/Vodmerge.php');
        // The real controller runs unchanged; its runtime dependency is isolated in the child process.
        file_put_contents($temporary . '/addons/vodmerge/bootstrap.php', "<?php\n");
        $command = escapeshellarg(PHP_BINARY) . ' ' . escapeshellarg(__FILE__) . ' --child ' . escapeshellarg($temporary);
        $process = proc_open($command, [1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes);
        if (!is_resource($process)) {
            throw new RuntimeException('Could not start audit controller test subprocess');
        }
        $output = stream_get_contents($pipes[1]);
        $error = stream_get_contents($pipes[2]);
        fclose($pipes[1]);
        fclose($pipes[2]);
        $status = proc_close($process);
        if ($status !== 0) {
            throw new RuntimeException(trim($error . $output));
        }
        $result = json_decode($output, true);
        auditControllerCheck(is_array($result) && isset($result['checks']), 'The isolated controller test returns its completed checks');
        auditControllerCheck(strpos($error, 'PRIVATE_DB_ERROR') === false, 'Controller logging must also withhold raw private database text');
        $checks += $result['checks'];
        echo "VodMerge audit controller: $checks checks passed\n";
    } finally {
        unlink($temporary . '/application/admin/controller/Vodmerge.php');
        unlink($temporary . '/addons/vodmerge/bootstrap.php');
        foreach (['application/admin/controller', 'application/admin', 'application', 'addons/vodmerge', 'addons', ''] as $directory) {
            rmdir($temporary . ($directory === '' ? '' : '/' . $directory));
        }
    }
}
