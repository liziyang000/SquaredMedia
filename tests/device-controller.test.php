<?php

namespace addons\pingfangdevice\service {
    class DeviceSession
    {
        public static $currentUser;
        public static $registerCalls = 0;
        public static $registerException = false;
        public static $logoutCurrentCalls = 0;

        public static function currentUser()
        {
            return self::$currentUser;
        }

        public static function registerLogin(array $meta)
        {
            self::$registerCalls++;
            if (self::$registerException) {
                throw new \RuntimeException('device registration failed');
            }
            return 1;
        }

        public static function logoutCurrentDevice($userId = 0)
        {
            self::$logoutCurrentCalls++;
        }

        public static function listSessions($userId)
        {
            return [];
        }

        public static function maxDeviceCount()
        {
            return 3;
        }

        public static function revokeSession($userId, $sessionId)
        {
            return ['code' => 1, 'msg' => 'ok'];
        }
    }

    class VodFilterOptions
    {
        public static function filters(array $input)
        {
            return ['code' => 1];
        }
    }
}

namespace app\index\controller {
    class Base
    {
        public function assign($name, $value)
        {
        }

        public function fetch($template = '')
        {
            return $template;
        }
    }
}

namespace think\addons {
    class Controller
    {
    }
}

namespace {
    use addons\pingfangdevice\service\DeviceSession;

    $controllerInput = [];
    $controllerRequest = new class {
        public $post = true;
        public $ajax = true;

        public function isPost()
        {
            return $this->post;
        }

        public function isAjax()
        {
            return $this->ajax;
        }
    };
    $controllerUserModel = new class {
        public $loginParam;
        public $logoutCalls = 0;

        public function login($param, $options = [])
        {
            $this->loginParam = $param;
            return ['code' => 1, 'msg' => 'ok', 'meta' => ['user_id' => 42]];
        }

        public function logout()
        {
            $this->logoutCalls++;
            return ['code' => 1];
        }
    };

    function request()
    {
        global $controllerRequest;
        return $controllerRequest;
    }

    function input($name = null, $default = null)
    {
        global $controllerInput;
        if ($name === null) {
            return $controllerInput;
        }
        $key = preg_replace('/\/[a-z]$/i', '', $name);
        return $controllerInput[$key] ?? $default;
    }

    function model($name)
    {
        global $controllerUserModel;
        return $controllerUserModel;
    }

    function json($data, $status = 200)
    {
        return ['status' => $status, 'data' => $data];
    }

    function redirect($url)
    {
        return ['redirect' => $url];
    }

    function url($route)
    {
        return '/' . $route;
    }

    require_once dirname(__DIR__) . '/addons/pingfangdevice/controller/DeviceActions.php';
    require_once dirname(__DIR__) . '/addons/pingfangdevice/application/index/controller/Pingfangdevice.php';
    require_once dirname(__DIR__) . '/addons/pingfangdevice/controller/Index.php';

    $actionTrait = \addons\pingfangdevice\controller\DeviceActions::class;
    if (!in_array($actionTrait, class_uses(\app\index\controller\Pingfangdevice::class), true)) {
        fwrite(STDERR, "Application controller must use the shared device actions.\n");
        exit(1);
    }
    if (!in_array($actionTrait, class_uses(\addons\pingfangdevice\controller\Index::class), true)) {
        fwrite(STDERR, "Addon controller must use the shared device actions.\n");
        exit(1);
    }

    $controller = new \app\index\controller\Pingfangdevice();
    $fail = static function ($message) {
        fwrite(STDERR, $message . "\n");
        exit(1);
    };
    $assertSame = static function ($expected, $actual, $message) use ($fail) {
        if ($expected !== $actual) {
            $fail($message . "\nExpected: " . var_export($expected, true) . "\nActual: " . var_export($actual, true));
        }
    };
    $reset = static function () use (&$controllerInput, $controllerRequest, $controllerUserModel) {
        $controllerInput = ['user_name' => 'alice', 'user_pwd' => 'secret'];
        $controllerRequest->post = true;
        $controllerRequest->ajax = true;
        $controllerUserModel->loginParam = null;
        $controllerUserModel->logoutCalls = 0;
        DeviceSession::$currentUser = ['user_id' => 42];
        DeviceSession::$registerCalls = 0;
        DeviceSession::$registerException = false;
        DeviceSession::$logoutCurrentCalls = 0;
    };

    $reset();
    $response = $controller->login();
    $assertSame(1, $response['data']['code'], 'A valid device login should succeed.');
    $assertSame('', $controllerUserModel->loginParam['verify'] ?? null, 'Login must normalize the verify field.');
    $assertSame('', $controllerUserModel->loginParam['openid'] ?? null, 'Login must normalize the openid field.');
    $assertSame('', $controllerUserModel->loginParam['col'] ?? null, 'Login must normalize the col field.');

    $reset();
    $controllerRequest->ajax = false;
    $response = $controller->login();
    $assertSame(405, $response['status'], 'Login must require a same-origin Ajax request.');
    $assertSame(null, $controllerUserModel->loginParam, 'Rejected login requests must not reach the native login model.');

    $reset();
    DeviceSession::$registerException = true;
    try {
        $response = $controller->login();
    } catch (\Throwable $e) {
        $fail('Device registration failures must be converted to a login error response.');
    }
    $assertSame(1004, $response['data']['code'], 'Device registration failures must fail the login response.');
    $assertSame(1, $controllerUserModel->logoutCalls, 'Device registration failures must roll back native login cookies.');

    $reset();
    $controllerRequest->post = false;
    $response = $controller->logout();
    $assertSame(405, $response['status'], 'Logout must reject GET requests.');
    $assertSame(0, $controllerUserModel->logoutCalls, 'Rejected logout requests must not mutate login state.');

    $reset();
    $controllerRequest->ajax = false;
    $response = $controller->revoke();
    $assertSame(405, $response['status'], 'Device revocation must require same-origin Ajax requests.');

    $reset();
    DeviceSession::$currentUser = null;
    $response = $controller->logout();
    $assertSame(1, $response['data']['code'], 'A valid logout request should succeed even when native login is stale.');
    $assertSame(1, DeviceSession::$logoutCurrentCalls, 'Logout must always clear the current device token.');

    echo "Device controller behavior tests passed.\n";
}
