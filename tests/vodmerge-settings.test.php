<?php

namespace app\admin\controller {
    class Base
    {
        public $_admin;
        public $view;
        public $assigned = [];
        public $initialized = false;

        public function __construct()
        {
            $this->_admin = ['admin_id' => $GLOBALS['settings_admin_id']];
            $this->view = new SettingsView();
            $this->initialized = true;
        }

        public function assign($name, $value)
        {
            $this->assigned[$name] = $value;
        }

        public function fetch($template = '')
        {
            return ['template' => $template, 'assigned' => $this->assigned];
        }
    }

    class SettingsView
    {
        public $options = [];

        public function config($name, $value)
        {
            $this->options[$name] = $value;
        }
    }
}

namespace think\exception {
    class HttpException extends \RuntimeException
    {
        private $status;

        public function __construct($status, $message)
        {
            parent::__construct($message);
            $this->status = $status;
        }

        public function getStatusCode()
        {
            return $this->status;
        }
    }
}

namespace addons\vodmerge\service {
    // Override transport only in this subprocess; production uses native cURL.
    function curl_init($url)
    {
        return (object) ['url' => $url, 'options' => []];
    }

    function curl_setopt_array($handle, $options)
    {
        $handle->options = $options;
        return true;
    }

    function curl_exec($handle)
    {
        $GLOBALS['settings_curl_calls'][] = $handle;
        $response = $GLOBALS['settings_curl_response'];
        if (($response['network'] ?? false) === true) {
            return false;
        }
        $request = json_decode($handle->options[CURLOPT_POSTFIELDS], true);
        $body = $response['body'] ?? json_encode([
            'model' => $GLOBALS['settings_upstream_private'],
            'answers' => array_fill_keys(array_keys($request['questions']), [
                'type' => 'choice', 'choice' => 'same', 'confidence' => 1,
                'probabilities' => ['same' => 1, 'different' => 0, 'uncertain' => 0],
            ]),
        ]);
        return call_user_func($handle->options[CURLOPT_WRITEFUNCTION], $handle, $body) === strlen($body);
    }

    function curl_getinfo($handle, $option)
    {
        return $GLOBALS['settings_curl_response']['status'] ?? 200;
    }

    function curl_close($handle)
    {
    }

    function opcache_invalidate($file, $force)
    {
        $GLOBALS['settings_opcache_calls'][] = [$file, $force];
        return true;
    }
}

namespace {
    use addons\vodmerge\service\Runtime;

    class SettingsRequest
    {
        public function isPost()
        {
            return $GLOBALS['settings_post'];
        }

        public function isAjax()
        {
            return $GLOBALS['settings_ajax'];
        }

        public function token()
        {
            return 'native-csrf-fixture';
        }
    }

    function session($name, $value = null)
    {
        if (func_num_args() === 2) {
            $GLOBALS['settings_session'][$name] = $value;
        }
        return $GLOBALS['settings_session'][$name] ?? null;
    }

    function request()
    {
        return new SettingsRequest();
    }

    function input($name, $default = null, $filter = null)
    {
        $name = explode('/', $name)[0];
        $name = strpos($name, 'post.') === 0 ? substr($name, 5) : $name;
        $value = $GLOBALS['settings_input'][$name] ?? $default;
        if ($name === 'api_token') {
            settingsCheck($filter === 'trim', 'Token input must explicitly override native default filters');
        }
        return $filter === 'trim' && is_string($value) ? trim($value) : $value;
    }

    function json($data, $status = 200)
    {
        return ['status' => $status, 'body' => $data];
    }

    function config($name)
    {
        throw new RuntimeException('Settings must work without a database or database configuration');
    }

    function get_addon_config($name)
    {
        return [];
    }

    // Keep the same transport fixture usable on PHP builds without cURL/opcache.
    if (!function_exists('curl_init')) {
        function curl_init($url = null) {}
    }
    if (!function_exists('opcache_invalidate')) {
        function opcache_invalidate($file, $force = false) {}
    }
    foreach (['CURLOPT_POST', 'CURLOPT_POSTFIELDS', 'CURLOPT_HTTPHEADER', 'CURLOPT_CONNECTTIMEOUT',
        'CURLOPT_TIMEOUT', 'CURLOPT_FOLLOWLOCATION', 'CURLOPT_SSL_VERIFYPEER', 'CURLOPT_SSL_VERIFYHOST',
        'CURLOPT_WRITEFUNCTION', 'CURLINFO_HTTP_CODE'] as $index => $constant) {
        if (!defined($constant)) {
            define($constant, 10000 + $index);
        }
    }

    $settingsChecks = 0;
    function settingsCheck($condition, string $message): void
    {
        global $settingsChecks;
        $settingsChecks++;
        if (!$condition) {
            throw new RuntimeException($message);
        }
    }

    function settingsFails(callable $action, string $message): void
    {
        try {
            $action();
        } catch (Throwable $error) {
            settingsCheck(strpos($error->getMessage(), $GLOBALS['settings_key']) === false, 'Errors must not expose the Token');
            return;
        }
        settingsCheck(false, $message);
    }

    function settingsWrite(array $config): void
    {
        file_put_contents($GLOBALS['settings_file'], "<?php\nreturn " . var_export($config, true) . ";\n");
        clearstatcache();
    }

    function settingsQuiet(callable $action)
    {
        ob_start();
        try {
            return $action();
        } finally {
            settingsCheck(ob_get_clean() === '', 'Loading malformed or noisy configuration must not emit Token content');
        }
    }

    function settingsCall($controller, string $operation, $key = ''): array
    {
        $GLOBALS['settings_input'] = ['csrf' => session('vodmerge_csrf'), 'operation' => $operation, 'api_token' => $key];
        return $controller->settings();
    }

    function settingsPrivate($value): void
    {
        $serialized = json_encode($value, JSON_UNESCAPED_UNICODE);
        foreach ([$GLOBALS['settings_key'], $GLOBALS['settings_new_key'], $GLOBALS['settings_upstream_private'], 'intake-secret-fixture'] as $secret) {
            settingsCheck(strpos($serialized, $secret) === false, 'HTML assignments and JSON must not expose private values');
        }
    }

    function settingsSuccess(array $response, bool $configured, string $source): void
    {
        settingsCheck($response['status'] === 200 && ($response['body']['code'] ?? 0) === 1, 'Settings operation must succeed');
        $data = $response['body']['data'];
        settingsCheck(array_keys($data) === ['configured', 'source', 'message'], 'Success responses expose only state and a fixed message');
        settingsCheck($data['configured'] === $configured && $data['source'] === $source, 'Response must describe the effective configuration');
        settingsCheck(is_string($data['message']) && $data['message'] !== '', 'Success must include an actionable message');
        settingsPrivate($response);
    }

    function settingsError(array $response, string $expected = ''): void
    {
        settingsCheck($response['status'] >= 400 && ($response['body']['code'] ?? 1) !== 1, 'Rejected operation must be an error');
        settingsCheck(array_keys($response['body']) === ['code', 'msg'], 'Error responses must not include upstream or configuration details');
        settingsCheck(is_string($response['body']['msg']) && $response['body']['msg'] !== '', 'Error must include a safe message');
        if ($expected !== '') {
            settingsCheck($response['body']['msg'] === $expected, 'Connection failure must use the expected fixed message');
        }
        settingsPrivate($response);
    }

    function settingsCleanup(string $directory): void
    {
        if (is_link($directory) || !is_dir($directory)) {
            unlink($directory);
            return;
        }
        chmod($directory, 0700);
        foreach (scandir($directory) as $entry) {
            if ($entry !== '.' && $entry !== '..') {
                settingsCleanup($directory . '/' . $entry);
            }
        }
        rmdir($directory);
    }

    function settingsScenario(string $scenario): void
    {
        $file = $GLOBALS['settings_file'];
        $key = $GLOBALS['settings_key'];
        $newKey = $GLOBALS['settings_new_key'];
        $original = ['typesafe_api_key' => $key, 'ingest_secret' => 'intake-secret-fixture', 'custom' => ['enabled' => true, 'count' => 3]];
        if ($scenario === 'runtime') {
            settingsCheck(Runtime::jevStatus() === ['configured' => false, 'source' => 'none'], 'Missing configuration is unconfigured');
            settingsCheck(Runtime::validateJevKey(" \t" . $key . "\n") === $key, 'Token validation trims surrounding whitespace');
            settingsCheck(Runtime::validateJevKey(str_repeat('a', 4096)) === str_repeat('a', 4096), 'Maximum length ASCII Token is valid');
            settingsCheck(Runtime::saveJevKey('') === ['configured' => false, 'source' => 'none'] && !file_exists($file), 'Empty save must not create a configuration file');
            settingsWrite($original);
            chmod($file, 0644);
            $before = file_get_contents($file);
            $alias = dirname($file) . '/old-config-hardlink.php';
            settingsCheck(link($file, $alias), 'Atomic replacement fixture must be created');
            settingsCheck(Runtime::saveJevKey(" \t" . $newKey . "\n") === ['configured' => true, 'source' => 'file'], 'New Token becomes the effective file configuration');
            $stored = include $file;
            settingsCheck($stored === array_merge($original, ['typesafe_api_key' => $newKey]), 'Saving must preserve ingest_secret and unrelated keys');
            settingsCheck(file_get_contents($alias) === $before, 'Saving replaces the file atomically rather than overwriting its inode');
            clearstatcache();
            settingsCheck((fileperms($file) & 0777) === 0600 && (fileperms($file . '.lock') & 0777) === 0600, 'Configuration and lock files are private');
            settingsCheck(count($GLOBALS['settings_opcache_calls']) > 0, 'Saving invalidates stale PHP configuration cache');
            $before = file_get_contents($file);
            settingsCheck(Runtime::saveJevKey(" \t\n") === ['configured' => true, 'source' => 'file'] && file_get_contents($file) === $before, 'Blank save preserves existing Token byte for byte');
            foreach (['a b', "a\tb", "a\nb", "a\rb", "a\0b", "a\x1fb", "a\x7fb", '令牌', str_repeat('a', 4097)] as $invalid) {
                settingsFails(static function () use ($invalid) { Runtime::saveJevKey($invalid); }, 'Invalid Token must be rejected');
                settingsCheck(file_get_contents($file) === $before, 'Invalid Token cannot modify stored configuration');
            }
            settingsFails(static function () use ($newKey) { Runtime::saveJevKey($newKey, true); }, 'Clear must not also supply a Token');
            settingsCheck(file_get_contents($file) === $before, 'Ambiguous clear cannot modify configuration');
            $quoted = "key'with\\literal-\$-<?php";
            Runtime::saveJevKey($quoted);
            settingsCheck(Runtime::secret('typesafe_api_key', 'TYPESAFE_API_KEY') === $quoted, 'Printable Token punctuation survives PHP serialization');
            settingsCheck(Runtime::saveJevKey('', true) === ['configured' => false, 'source' => 'none'], 'Explicit clear removes the file Token');
            $stored = include $file;
            unset($original['typesafe_api_key']);
            settingsCheck($stored === $original, 'Clear preserves ingest_secret and unrelated configuration');
            settingsPrivate(Runtime::jevStatus());
            return;
        }
        settingsWrite($original);
        if ($scenario === 'environment') {
            $before = file_get_contents($file);
            putenv('TYPESAFE_API_KEY= ' . $newKey . ' ');
            settingsCheck(Runtime::jevStatus() === ['configured' => true, 'source' => 'environment'], 'Environment Token takes precedence');
            settingsCheck(Runtime::secret('typesafe_api_key', 'TYPESAFE_API_KEY') === $newKey, 'Worker and admin use the same effective environment Token');
            foreach ([false, true] as $clear) {
                settingsFails(static function () use ($key, $clear) { Runtime::saveJevKey($clear ? '' : $key, $clear); }, 'Environment configuration cannot be changed from the backend');
                settingsCheck(file_get_contents($file) === $before, 'Environment rejection preserves file fallback');
            }
            $controller = new \app\admin\controller\Vodmerge();
            $page = $controller->index();
            settingsCheck($page['assigned']['jev_source'] === 'environment', 'Index reports environment configuration source');
            settingsPrivate($page);
            settingsError(settingsCall($controller, 'save', $key));
            settingsError(settingsCall($controller, 'clear'));
            settingsSuccess(settingsCall($controller, 'test'), true, 'environment');
            $calls = $GLOBALS['settings_curl_calls'];
            settingsCheck(in_array('Authorization: Bearer ' . $newKey, end($calls)->options[CURLOPT_HTTPHEADER], true), 'Blank connection test uses the effective environment Token');
            settingsCheck(file_get_contents($file) === $before, 'Connection test does not persist environment Token');
            return;
        }
        if ($scenario === 'unsafe-files') {
            $before = file_get_contents($file);
            $target = dirname($file) . '/external-config.php';
            rename($file, $target);
            settingsCheck(symlink($target, $file), 'Configuration symlink fixture must be created');
            foreach ([false, true] as $clear) {
                settingsFails(static function () use ($newKey, $clear) { Runtime::saveJevKey($clear ? '' : $newKey, $clear); }, 'Configuration symlink must be rejected');
                settingsCheck(is_link($file) && file_get_contents($target) === $before, 'Rejected symlink cannot alter target or replace link');
            }
            unlink($file);
            rename($target, $file);
            unlink($file . '.lock');
            file_put_contents($target, 'untouched-lock-target');
            settingsCheck(symlink($target, $file . '.lock'), 'Lock symlink fixture must be created');
            settingsFails(static function () use ($newKey) { Runtime::saveJevKey($newKey); }, 'Lock symlink must be rejected');
            settingsCheck(file_get_contents($file) === $before && file_get_contents($target) === 'untouched-lock-target', 'Rejected lock symlink preserves both files');
            unlink($file . '.lock');
            mkdir($file . '.lock');
            settingsFails(static function () use ($newKey) { Runtime::saveJevKey($newKey); }, 'Unwritable lock path must be rejected');
            settingsCheck(file_get_contents($file) === $before, 'Lock failure preserves original configuration');
            rmdir($file . '.lock');
            session('vodmerge_csrf', str_repeat('c', 64));
            foreach (["<?php return 'non-array';\n", '<?php throw new RuntimeException(' . var_export($key, true) . ');', 'plain-text-private-configuration-' . $key] as $invalidConfig) {
                file_put_contents($file, $invalidConfig);
                foreach ([
                    static function () { Runtime::secret('typesafe_api_key', 'TYPESAFE_API_KEY'); },
                    static function () { Runtime::jevStatus(); },
                ] as $read) {
                    settingsFails(static function () use ($read) { settingsQuiet($read); }, 'Malformed configuration must not be treated as a Token');
                    settingsCheck(file_get_contents($file) === $invalidConfig, 'Reading malformed configuration leaves the file unchanged');
                }
                foreach ([false, true] as $clear) {
                    settingsFails(static function () use ($newKey, $clear) {
                        settingsQuiet(static function () use ($newKey, $clear) { Runtime::saveJevKey($clear ? '' : $newKey, $clear); });
                    }, 'Malformed configuration must not be replaced');
                    settingsCheck(file_get_contents($file) === $invalidConfig, 'Rejected configuration remains byte for byte intact');
                }
                $controller = new \app\admin\controller\Vodmerge();
                settingsError(settingsQuiet(static function () use ($controller, $newKey) { return settingsCall($controller, 'save', $newKey); }));
                settingsCheck(file_get_contents($file) === $invalidConfig, 'Backend malformed configuration failure preserves original bytes');
            }
            foreach (['static function () { return true; }', '(object) ["enabled" => true]', 'fopen("php://memory", "r+")'] as $unsupported) {
                $invalidConfig = '<?php return ["typesafe_api_key" => ' . var_export($key, true)
                    . ', "ingest_secret" => "intake-secret-fixture", "custom" => ["nested" => ["value" => ' . $unsupported . ']]];';
                file_put_contents($file, $invalidConfig);
                foreach ([false, true] as $clear) {
                    settingsFails(static function () use ($newKey, $clear) {
                        settingsQuiet(static function () use ($newKey, $clear) { Runtime::saveJevKey($clear ? '' : $newKey, $clear); });
                    }, 'Nested objects and resources must not be serialized over existing configuration');
                    settingsCheck(file_get_contents($file) === $invalidConfig, 'Unsupported configuration values preserve the original PHP file byte for byte');
                    settingsCheck(Runtime::secret('ingest_secret', 'VODMERGE_SETTINGS_UNUSED_ENV') === 'intake-secret-fixture', 'Rejected serialization leaves the existing intake secret readable');
                    settingsCheck(Runtime::secret('typesafe_api_key', 'TYPESAFE_API_KEY') === $key, 'Rejected save and clear retain the existing Jev Token');
                }
            }
            file_put_contents($file, '<?php echo ' . var_export($key, true) . '; return [];');
            settingsCheck(settingsQuiet(static function () { return Runtime::secret('typesafe_api_key', 'TYPESAFE_API_KEY'); }) === '', 'Noisy configuration still returns its array without exposing echoed output');
            settingsCheck(settingsQuiet(static function () { return Runtime::jevStatus(); }) === ['configured' => false, 'source' => 'none'], 'Noisy empty configuration remains unconfigured');
            settingsCheck(settingsQuiet(static function () use ($newKey) { return Runtime::saveJevKey($newKey); }) === ['configured' => true, 'source' => 'file'], 'Noisy valid configuration can be saved without echoing its prior output');
            settingsCheck(glob(dirname($file) . '/.vodmerge-*') === [], 'Failed writes must not leave Token temporary files');
            return;
        }
        if ($scenario === 'authorization') {
            foreach ([0, 2, 7] as $admin) {
                $GLOBALS['settings_admin_id'] = $admin;
                try {
                    new \app\admin\controller\Vodmerge();
                    settingsCheck(false, 'Only the superadministrator may configure Jev');
                } catch (\think\exception\HttpException $error) {
                    settingsCheck($error->getStatusCode() === 403, 'Non-superadministrators must receive HTTP 403');
                }
            }
            $GLOBALS['settings_admin_id'] = 1;
            $controller = new \app\admin\controller\Vodmerge();
            settingsCheck($controller->initialized, 'Settings must retain native admin Base authorization');
            $before = file_get_contents($file);
            $controller->index();
            foreach ([[false, true], [true, false], [false, false]] as $method) {
                [$GLOBALS['settings_post'], $GLOBALS['settings_ajax']] = $method;
                $response = settingsCall($controller, 'save', $newKey);
                settingsCheck($response['status'] === 405, 'Settings requires POST and Ajax');
                settingsError($response);
            }
            $GLOBALS['settings_post'] = $GLOBALS['settings_ajax'] = true;
            foreach (['', 'wrong-csrf'] as $csrf) {
                $GLOBALS['settings_input'] = ['csrf' => $csrf, 'operation' => 'save', 'api_token' => $newKey];
                $response = $controller->settings();
                settingsCheck($response['status'] === 403, 'Settings must reject absent or mismatched CSRF');
                settingsError($response);
            }
            unset($GLOBALS['settings_session']['vodmerge_csrf']);
            $GLOBALS['settings_input']['csrf'] = '';
            settingsCheck($controller->settings()['status'] === 403, 'An uninitialized CSRF session cannot authorize a request');
            settingsCheck(file_get_contents($file) === $before && $GLOBALS['settings_curl_calls'] === [], 'Unauthorized requests neither save nor call Jev');
            return;
        }
        $controller = new \app\admin\controller\Vodmerge();
        $page = $controller->index();
        settingsCheck($page['template'] === 'vodmerge/index' && $page['assigned']['jev_ready'] === '已配置' && $page['assigned']['jev_source'] === 'file', 'Index exposes effective state and source');
        settingsCheck(strlen((string) session('vodmerge_csrf')) === 64, 'Index creates an independent CSRF Token');
        settingsPrivate($page);
        if ($scenario === 'controller') {
            settingsSuccess(settingsCall($controller, 'save', $newKey), true, 'file');
            $stored = include $file;
            settingsCheck($stored === array_merge($original, ['typesafe_api_key' => $newKey]), 'Backend save preserves non-Jev settings');
            $before = file_get_contents($file);
            settingsSuccess(settingsCall($controller, 'save'), true, 'file');
            foreach (["a\nb", ['array-token']] as $invalid) {
                settingsError(settingsCall($controller, 'save', $invalid));
                settingsCheck(file_get_contents($file) === $before, 'Invalid backend Token preserves current configuration');
            }
            settingsError(settingsCall($controller, 'unknown', $newKey));
            settingsError(settingsCall($controller, 'clear', $newKey));
            settingsCheck(file_get_contents($file) === $before, 'Unknown operation and ambiguous clear must preserve configuration');
            settingsSuccess(settingsCall($controller, 'clear'), false, 'none');
            unset($original['typesafe_api_key']);
            settingsCheck((include $file) === $original, 'Backend clear removes only the Jev Token');
            settingsError(settingsCall($controller, 'test'), '尚未配置 Jev Token，或服务器未启用 cURL。');
            settingsCheck($GLOBALS['settings_curl_calls'] === [], 'An unconfigured test does not call the API');
            return;
        }
        if ($scenario === 'connection') {
            $before = file_get_contents($file);
            settingsSuccess(settingsCall($controller, 'test', $newKey), true, 'file');
            settingsSuccess(settingsCall($controller, 'test'), true, 'file');
            settingsCheck(count($GLOBALS['settings_curl_calls']) === 2, 'Each connection test makes one request');
            foreach ($GLOBALS['settings_curl_calls'] as $index => $call) {
                $options = $call->options;
                $request = json_decode($options[CURLOPT_POSTFIELDS], true);
                settingsCheck($call->url === 'https://api.typesafe.ai/v1/systemone', 'Test must use the official Jev endpoint');
                settingsCheck(in_array('Authorization: Bearer ' . ($index === 0 ? $newKey : $key), $options[CURLOPT_HTTPHEADER], true), 'Test uses the candidate Token or the existing effective Token');
                settingsCheck($options[CURLOPT_SSL_VERIFYPEER] === true && $options[CURLOPT_SSL_VERIFYHOST] === 2 && $options[CURLOPT_FOLLOWLOCATION] === false, 'Token transport verifies TLS and cannot follow redirects');
                settingsCheck($options[CURLOPT_CONNECTTIMEOUT] > 0 && $options[CURLOPT_TIMEOUT] > 0 && $options[CURLOPT_TIMEOUT] <= 30, 'Connection tests have bounded network timeouts');
                settingsCheck(count($request['questions']) === 1 && $request['model'] === 'jev-latest', 'Connection test uses the same structured model protocol');
                $incoming = $request['state']['incoming'];
                $candidate = reset($request['state']['candidates']);
                settingsCheck($incoming === $candidate && strpos($incoming['vod_name'], '虚构') !== false, 'Test compares only matching fictional metadata');
                settingsPrivate($request);
            }
            settingsCheck(file_get_contents($file) === $before && !file_exists($file . '.lock'), 'Testing a new or saved Token never writes configuration or a lock');
            settingsSuccess(settingsCall($controller, 'clear'), false, 'none');
            $before = file_get_contents($file);
            settingsSuccess(settingsCall($controller, 'test', $newKey), false, 'none');
            settingsCheck(file_get_contents($file) === $before && Runtime::jevStatus()['source'] === 'none', 'Successful testing of an unsaved Token leaves configuration unconfigured');
            return;
        }
        if ($scenario === 'connection-errors') {
            $before = file_get_contents($file);
            foreach ([
                [401, false, 'Jev Token 认证失败，请检查 Token。'],
                [403, false, 'Jev Token 认证失败，请检查 Token。'],
                [429, false, 'Jev 请求已限流，请稍后重试。'],
                [500, false, 'Jev 上游服务暂时不可用，请稍后重试。'],
                [503, false, 'Jev 上游服务暂时不可用，请稍后重试。'],
                [0, true, 'Jev 网络连接失败或超时，请检查服务器网络。'],
                [400, false, 'Jev 连接测试失败，请检查服务器配置后重试。'],
            ] as $failure) {
                $GLOBALS['settings_curl_response'] = ['status' => $failure[0], 'network' => $failure[1], 'body' => $GLOBALS['settings_upstream_private']];
                settingsError(settingsCall($controller, 'test', $newKey), $failure[2]);
                settingsCheck(file_get_contents($file) === $before, 'Connection failures must not change the stored Token');
            }
            foreach (['not-json-' . $key, '[]', '{"answers":{}}', '{"answers":{"vod_1":{"type":"choice","choice":"same","confidence":1,"probabilities":{"same":2,"different":0,"uncertain":0}}}}'] as $body) {
                $GLOBALS['settings_curl_response'] = ['status' => 200, 'body' => $body];
                settingsError(settingsCall($controller, 'test', $newKey), 'Jev 返回格式无效，连接测试未通过。');
            }
            $GLOBALS['settings_curl_response'] = ['status' => 200, 'body' => str_repeat('x', 131073)];
            settingsError(settingsCall($controller, 'test', $newKey));
            settingsCheck(file_get_contents($file) === $before && !file_exists($file . '.lock'), 'Invalid and oversized responses leave configuration untouched');
            return;
        }
        throw new RuntimeException('Unknown settings test scenario');
    }

    try {
        if (($argv[1] ?? '') === '--scenario') {
            $installation = $argv[2];
            define('APP_PATH', $installation . '/application/');
            $GLOBALS['settings_file'] = APP_PATH . 'extra/vodmerge.php';
            $GLOBALS['settings_key'] = 'fixture-private-old-token';
            $GLOBALS['settings_new_key'] = 'fixture-private-new-token';
            $GLOBALS['settings_upstream_private'] = 'fixture-private-upstream-body';
            $GLOBALS['settings_admin_id'] = 1;
            $GLOBALS['settings_post'] = $GLOBALS['settings_ajax'] = true;
            $GLOBALS['settings_input'] = $GLOBALS['settings_session'] = $GLOBALS['settings_curl_calls'] = $GLOBALS['settings_opcache_calls'] = [];
            $GLOBALS['settings_curl_response'] = [];
            putenv('TYPESAFE_API_KEY');
            require APP_PATH . 'admin/controller/Vodmerge.php';
            settingsScenario($argv[3]);
            echo json_encode(['checks' => $settingsChecks]) . "\n";
            exit(0);
        }
        $root = dirname(__DIR__);
        $temporary = sys_get_temp_dir() . '/vodmerge-settings-' . bin2hex(random_bytes(8));
        mkdir($temporary, 0700);
        try {
            foreach (['runtime', 'environment', 'unsafe-files', 'authorization', 'controller', 'connection', 'connection-errors'] as $scenario) {
                $installation = $temporary . '/' . $scenario;
                foreach (['addons/vodmerge/service', 'application/admin/controller', 'application/extra'] as $directory) {
                    mkdir($installation . '/' . $directory, 0700, true);
                }
                foreach (['Payload', 'Playlist', 'Jev', 'Service', 'AuditMatch', 'LibraryAudit', 'Runtime'] as $service) {
                    copy($root . '/addons/vodmerge/service/' . $service . '.php', $installation . '/addons/vodmerge/service/' . $service . '.php');
                }
                copy($root . '/addons/vodmerge/bootstrap.php', $installation . '/addons/vodmerge/bootstrap.php');
                copy($root . '/addons/vodmerge/application/admin/controller/Vodmerge.php', $installation . '/application/admin/controller/Vodmerge.php');
                $command = escapeshellarg(PHP_BINARY) . ' ' . escapeshellarg(__FILE__) . ' --scenario ' . escapeshellarg($installation) . ' ' . escapeshellarg($scenario);
                $process = proc_open($command, [1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes);
                if (!is_resource($process)) {
                    throw new RuntimeException('Could not start settings test subprocess');
                }
                $output = stream_get_contents($pipes[1]);
                $error = stream_get_contents($pipes[2]);
                fclose($pipes[1]);
                fclose($pipes[2]);
                $code = proc_close($process);
                if ($code !== 0) {
                    throw new RuntimeException($scenario . ': ' . trim($error . $output));
                }
                $result = json_decode($output, true);
                settingsCheck(is_array($result) && isset($result['checks']), 'Scenario subprocess must return its check count');
                $settingsChecks += $result['checks'];
            }
        } finally {
            settingsCleanup($temporary);
        }
        echo 'VodMerge settings tests passed (' . $settingsChecks . " checks)\n";
    } catch (Throwable $error) {
        fwrite(STDERR, $error->getMessage() . "\n");
        exit(1);
    }
}
