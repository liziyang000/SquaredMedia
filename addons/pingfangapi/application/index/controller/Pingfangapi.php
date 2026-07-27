<?php

namespace app\index\controller;

use app\common\controller\All;
use addons\pingfangapi\service\AccountService;
use addons\pingfangapi\service\ApiException;
use addons\pingfangapi\service\ApiRequest;
use addons\pingfangapi\service\ContentService;
use ip_limit\IpLocationQuery;

class Pingfangapi extends All
{
    private $requestId = '';
    private $logEndpoint = 'index';
    private $logAction = 'unknown';

    public function index()
    {
        $this->beginRequest('index', 'unknown');
        try {
            $this->assertApiAccess();
            $this->label_user();
            $request = request();
            $method = strtoupper((string) $request->method());
            $query = $request->get();
            $this->logAction = $this->safeAction(isset($query['action']) ? $query['action'] : '');
            $body = [];
            if ($method === 'POST') {
                $body = ApiRequest::decodeJson($request->contentType(), $request->getInput());
            }

            $content = new ContentService(function ($typeId, $popedom, array $param, $flag, array $info, $trysee) {
                return $this->check_user_popedom($typeId, $popedom, $param, $flag, $info, $trysee);
            });
            $verifiedUser = isset($GLOBALS['user']) && is_array($GLOBALS['user']) ? $GLOBALS['user'] : [];
            $api = new ApiRequest($content, new AccountService($verifiedUser, $this->requestId));
            $response = $api->handle($method, $query, $body, $this->requestHeaders($request));
            $this->logResponseFailure($response['status'], ApiException::class);
        } catch (ApiException $e) {
            $this->logResponseFailure($e->status(), get_class($e));
            $response = ApiRequest::failure($e->status(), $e->getMessage());
        } catch (\Throwable $e) {
            $this->logFailure(500, get_class($e));
            $response = ApiRequest::failure(500, '服务器暂时无法处理请求');
        }

        return json($response['body'], $response['status'], $this->responseHeaders($response['headers']));
    }

    public function player()
    {
        $this->beginRequest('player', 'player');
        try {
            $this->assertApiAccess();
            $this->label_maccms();
            $this->label_user();
            $param = mac_param_url();
            $vodId = intval(isset($param['id']) ? $param['id'] : 0);
            $result = $vodId > 0
                ? model('Vod')->infoData([
                    'vod_id' => ['eq', $vodId],
                    'vod_status' => ['eq', 1],
                    'vod_recycle_time' => 0,
                ], '*', 1)
                : [];
            if (!is_array($result) || intval(isset($result['code']) ? $result['code'] : 0) !== 1 || empty($result['info'])) {
                return $this->playerResponse('播放资源不存在', 404);
            }

            $info = $result['info'];
            if (intval(isset($info['vod_copyright']) ? $info['vod_copyright'] : 0) === 1
                && intval(isset($GLOBALS['config']['app']['copyright_status']) ? $GLOBALS['config']['app']['copyright_status'] : 0) === 3) {
                $this->assign('param', $param);
                $this->assign('obj', $info);
                return $this->playerResponse($this->label_fetch('vod/copyright'));
            }
            $trysee = intval(isset($GLOBALS['config']['user']['trysee']) ? $GLOBALS['config']['user']['trysee'] : 0);
            if (intval(isset($info['vod_trysee']) ? $info['vod_trysee'] : 0) > 0) {
                $trysee = intval($info['vod_trysee']);
            }
            $access = $this->check_user_popedom(intval($info['type_id']), 3, $param, 'play', $info, $trysee);
            if (intval(isset($access['code']) ? $access['code'] : 0) !== 1 && empty($access['trysee'])) {
                $info = $this->label_vod_play('play', $info);
                return $this->playerResponse($this->label_fetch(mac_tpl_fetch('vod', $info['vod_tpl_play'], 'play')));
            }

            $info = $this->label_vod_play('play', $info);
            if (intval(isset($info['vod_copyright']) ? $info['vod_copyright'] : 0) === 1
                && intval(isset($GLOBALS['config']['app']['copyright_status']) ? $GLOBALS['config']['app']['copyright_status'] : 0) === 4) {
                return $this->playerResponse($this->label_fetch('vod/copyright'));
            }
            if (trim((string) (isset($info['vod_pwd_play']) ? $info['vod_pwd_play'] : '')) !== ''
                && (string) session('1-4-' . intval($info['vod_id'])) !== '1') {
                return $this->playerResponse($this->label_fetch('vod/player_pwd'));
            }
            return $this->playerResponse($this->embeddedPlayerHtml($this->label_fetch('vod/player')));
        } catch (ApiException $e) {
            $this->logResponseFailure($e->status(), get_class($e));
            return $this->playerResponse($e->getMessage(), $e->status());
        } catch (\Throwable $e) {
            $this->logFailure(500, get_class($e));
            return $this->playerResponse('服务器暂时无法处理请求', 500);
        }
    }

    public function stream()
    {
        $this->beginRequest('stream', 'stream');
        try {
            $this->assertApiAccess();
            $this->label_user();
            $param = mac_param_url();
            $content = new ContentService(function ($typeId, $popedom, array $route, $flag, array $info, $trysee) {
                return $this->check_user_popedom($typeId, $popedom, $route, $flag, $info, $trysee);
            });
            $vodId = intval(isset($param['id']) ? $param['id'] : 0);
            $sourceId = intval(isset($param['sid']) ? $param['sid'] : 0);
            $episodeId = intval(isset($param['nid']) ? $param['nid'] : 0);
            $ticket = trim((string) (isset($param['ticket']) ? $param['ticket'] : ''));
            $media = $ticket === ''
                ? $content->playbackSource($vodId, $sourceId, $episodeId)
                : $content->playbackTicketSource($vodId, $sourceId, $episodeId, $ticket);
            return response('', 302, [
                'Location' => $media['url'],
                'Cache-Control' => 'private, no-store',
                'Pragma' => 'no-cache',
                'X-Content-Type-Options' => 'nosniff',
                'X-Request-ID' => $this->requestId,
            ]);
        } catch (ApiException $e) {
            $this->logResponseFailure($e->status(), get_class($e));
            return $this->streamErrorResponse($e->getMessage(), $e->status());
        } catch (\Throwable $e) {
            $this->logFailure(500, get_class($e));
            return $this->streamErrorResponse('服务器暂时无法处理请求', 500);
        }
    }

    private function playerResponse($content, $status = 200)
    {
        return response($content, intval($status), [
            'Cache-Control' => 'private, no-store',
            'Pragma' => 'no-cache',
            'X-Request-ID' => $this->requestId,
        ]);
    }

    private function streamErrorResponse($content, $status)
    {
        return response((string) $content, intval($status), [
            'Content-Type' => 'text/plain; charset=utf-8',
            'Cache-Control' => 'private, no-store',
            'Pragma' => 'no-cache',
            'X-Content-Type-Options' => 'nosniff',
            'X-Request-ID' => $this->requestId,
        ]);
    }

    private function embeddedPlayerHtml($content)
    {
        $style = <<<'HTML'
<style data-pingfang-player-embed>
html,body{width:100%;height:100%;min-height:0;margin:0;overflow:hidden;background:#000}
body::before,.site-header,.mobile-drawer,.mobile-drawer-backdrop,.player-head,.player-toolbar,#episodeList{display:none!important}
#mainContent,.player-page,.player-page>.wrap{width:100%!important;height:100%!important;min-height:0!important;margin:0!important;padding:0!important}
.player-page::after{display:none!important}
.player-shell{width:100%!important;height:100%!important;min-height:0!important;aspect-ratio:auto!important;margin:0!important;border:0!important;border-radius:0!important;box-shadow:none!important}
.player-shell #MacPlayer,.player-shell iframe,.player-shell video,.player-shell embed,.player-shell object,.player-shell #MacPlayer>*{width:100%!important;height:100%!important;min-height:0!important;border:0!important}
</style>
HTML;
        $content = (string) $content;
        if (stripos($content, '</head>') !== false) {
            $embedded = preg_replace('/<\/head>/i', $style . '</head>', $content, 1);
            return is_string($embedded) ? $embedded : $style . $content;
        }
        return $style . $content;
    }

    public function _empty()
    {
        $this->beginRequest('_empty', 'not_found');
        $response = ApiRequest::failure(404, '接口不存在');
        return json($response['body'], $response['status'], $this->responseHeaders($response['headers']));
    }

    private function assertApiAccess()
    {
        if (intval(isset($GLOBALS['config']['site']['site_status']) ? $GLOBALS['config']['site']['site_status'] : 1) !== 1) {
            throw new ApiException(503, '站点维护中');
        }

        $limit = (string) (isset($GLOBALS['config']['site']['mainland_ip_limit']) ? $GLOBALS['config']['site']['mainland_ip_limit'] : '0');
        if ($limit !== '1' && $limit !== '2') {
            return;
        }
        if (!function_exists('mac_get_client_ip') || !class_exists(IpLocationQuery::class)) {
            throw new ApiException(503, '地区访问策略暂时不可用');
        }

        try {
            $location = (new IpLocationQuery())->queryProvince(mac_get_client_ip());
        } catch (\GeoIp2\Exception\AddressNotFoundException $e) {
            return;
        } catch (\Throwable $e) {
            throw new ApiException(503, '地区访问策略暂时不可用');
        }

        if (($limit === '1' && $location === '') || ($limit === '2' && $location !== '')) {
            throw new ApiException(403, '当前地区不可访问');
        }
    }

    private function requestHeaders($request)
    {
        $headers = [];
        foreach (['Host', 'Origin', 'Referer', 'Sec-Fetch-Site', 'X-Requested-With', 'X-CSRF-Token'] as $name) {
            $value = $request->header($name);
            if ($value !== null && $value !== '') {
                $headers[$name] = (string) $value;
            }
        }
        $headers['X-Pingfang-Request-Scheme'] = method_exists($request, 'isSsl') && $request->isSsl() ? 'https' : 'http';

        return $headers;
    }

    private function beginRequest($endpoint, $action)
    {
        $this->requestId = $this->generateRequestId();
        $this->logEndpoint = in_array($endpoint, ['index', 'player', 'stream', '_empty'], true) ? $endpoint : 'index';
        $this->logAction = $this->safeAction($action);
    }

    private function generateRequestId()
    {
        try {
            return bin2hex(random_bytes(16));
        } catch (\Throwable $e) {
            return substr(hash('sha256', uniqid('', true) . mt_rand()), 0, 32);
        }
    }

    private function safeAction($action)
    {
        if (!is_string($action) && !is_int($action)) {
            return 'unknown';
        }
        $action = trim((string) $action);
        $allowed = [
            'home', 'home_v2', 'navigation', 'content', 'detail', 'access', 'downloads', 'plot', 'playback',
            'session', 'comments', 'favorites', 'history', 'devices', 'login', 'logout', 'favorite',
            'favorites.delete', 'history.save', 'history.delete', 'device.revoke', 'feedback', 'report',
            'comment', 'reaction', 'rating', 'password.verify', 'player', 'stream', 'not_found', 'unknown',
        ];
        return in_array($action, $allowed, true) ? $action : 'unknown';
    }

    private function responseHeaders(array $headers)
    {
        $headers['X-Request-ID'] = $this->requestId;
        return $headers;
    }

    private function logResponseFailure($status, $exceptionClass)
    {
        if (intval($status) >= 500) {
            $this->logFailure($status, $exceptionClass);
        }
    }

    private function logFailure($status, $exceptionClass)
    {
        $message = json_encode([
            'request_id' => $this->requestId,
            'endpoint' => $this->logEndpoint,
            'action' => $this->logAction,
            'status' => intval($status),
            'exception_class' => (string) $exceptionClass,
        ], JSON_UNESCAPED_SLASHES);
        if (function_exists('trace')) {
            trace($message, 'error');
            return;
        }
        error_log($message);
    }
}
