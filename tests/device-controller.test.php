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

    class VodSourceQuality
    {
        public static $calls = [];
        public static $exception = false;

        public static function check($vodId, $nid)
        {
            self::$calls[] = [$vodId, $nid];
            if (self::$exception) {
                throw new \RuntimeException('probe failed');
            }
            return ['code' => 1, 'data' => ['vod_id' => $vodId, 'nid' => $nid]];
        }
    }

    class GameAccessTicket
    {
        public static $calls = [];
        public static $exception = false;

        public static function issue(array $user, $game, $clientId)
        {
            self::$calls[] = [$user, $game, $clientId];
            if (self::$exception) {
                throw new \RuntimeException('ticket unavailable');
            }
            return [
                'ticket' => 'signed-ticket',
                'socket_path' => '/game-socket',
                'expires_in' => 60,
            ];
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
    use addons\pingfangdevice\service\GameAccessTicket;
    use addons\pingfangdevice\service\VodSourceQuality;

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
        VodSourceQuality::$calls = [];
        VodSourceQuality::$exception = false;
        GameAccessTicket::$calls = [];
        GameAccessTicket::$exception = false;
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

    $reset();
    $controllerInput = ['vod_id' => 88, 'nid' => 3];
    $response = $controller->sourceQuality();
    $assertSame(1, $response['data']['code'], 'A valid source quality request should succeed.');
    $assertSame([[88, 3]], VodSourceQuality::$calls, 'Source quality should forward the video and episode IDs.');

    $reset();
    $controllerRequest->post = false;
    $response = $controller->sourceQuality();
    $assertSame(405, $response['status'], 'Source quality must reject GET requests.');
    $assertSame([], VodSourceQuality::$calls, 'Rejected source quality requests must not start probes.');

    $reset();
    $controllerRequest->ajax = false;
    $response = $controller->sourceQuality();
    $assertSame(405, $response['status'], 'Source quality must require a same-origin Ajax request.');

    $reset();
    VodSourceQuality::$exception = true;
    $response = $controller->sourceQuality();
    $assertSame(1003, $response['data']['code'], 'Probe failures should return a stable public error.');

    $reset();
    $controllerInput = ['game' => 'gomoku', 'client_id' => 'client-tab-alpha-0001'];
    DeviceSession::$currentUser = ['user_id' => 42, 'user_name' => 'Alice'];
    $response = $controller->gameTicket();
    $assertSame(1, $response['data']['code'], 'A logged-in member should receive a game ticket.');
    $assertSame(
        [[['user_id' => 42, 'user_name' => 'Alice'], 'gomoku', 'client-tab-alpha-0001']],
        GameAccessTicket::$calls,
        'Game tickets must be scoped to the current user, requested game, and browser tab.'
    );
    $assertSame('signed-ticket', $response['data']['data']['ticket'], 'The signed ticket must be returned to the browser.');

    $reset();
    $controllerInput = ['game' => 'drawguess', 'client_id' => 'client-tab-alpha-0002'];
    DeviceSession::$currentUser = null;
    $response = $controller->gameTicket();
    $assertSame(401, $response['status'], 'Guests must not receive game tickets.');
    $assertSame([], GameAccessTicket::$calls, 'Guest ticket requests must not reach the ticket service.');

    $reset();
    $controllerRequest->ajax = false;
    $controllerInput = ['game' => 'gomoku', 'client_id' => 'client-tab-alpha-0003'];
    $response = $controller->gameTicket();
    $assertSame(405, $response['status'], 'Game tickets must require same-origin Ajax requests.');

    $reset();
    $controllerInput = ['game' => 'unknown', 'client_id' => 'client-tab-alpha-0004'];
    $response = $controller->gameTicket();
    $assertSame(400, $response['status'], 'Game tickets must reject unknown game types.');

    $reset();
    $controllerInput = ['game' => 'gomoku', 'client_id' => 'short'];
    $response = $controller->gameTicket();
    $assertSame(400, $response['status'], 'Game tickets must reject invalid browser tab identities.');
    $assertSame([], GameAccessTicket::$calls, 'Invalid browser tab identities must not reach the ticket service.');

    $reset();
    $controllerInput = ['game' => 'gomoku', 'client_id' => 'client-tab-alpha-0005'];
    GameAccessTicket::$exception = true;
    $response = $controller->gameTicket();
    $assertSame(1004, $response['data']['code'], 'Ticket service failures should return a stable public error.');

    echo "Device controller behavior tests passed.\n";
}
