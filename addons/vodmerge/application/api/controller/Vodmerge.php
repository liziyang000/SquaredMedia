<?php

namespace app\api\controller;

require_once dirname(__DIR__, 3) . '/addons/vodmerge/bootstrap.php';

use addons\vodmerge\service\Payload;
use addons\vodmerge\service\Runtime;

class Vodmerge extends \think\Controller
{
    public function submit()
    {
        if (!request()->isPost()) {
            return json(['code' => 1001, 'msg' => 'POST required'], 405);
        }
        $stream = fopen('php://input', 'rb');
        $body = $stream ? stream_get_contents($stream, Payload::MAX_BYTES + 1) : '';
        if ($stream) {
            fclose($stream);
        }
        if (!Payload::authenticate((string) $body, (string) request()->header('X-Vodmerge-Time'),
            (string) request()->header('X-Vodmerge-Signature'), Runtime::secret('ingest_secret', 'VODMERGE_INGEST_SECRET'), time())) {
            return json(['code' => 1002, 'msg' => 'Invalid or expired signature'], 401);
        }
        try {
            $input = json_decode($body, true);
            if (!is_array($input)) {
                throw new \InvalidArgumentException('JSON object required');
            }
            $result = Runtime::service()->submit($input);
            return json(['code' => 1, 'data' => $result], $result['duplicate'] ? 200 : 202);
        } catch (\InvalidArgumentException $error) {
            return json(['code' => 1003, 'msg' => $error->getMessage()], 422);
        } catch (\Throwable $error) {
            // Never echo a PDO exception, source URL or credential to API clients.
            error_log('[vodmerge] Intake failed: ' . get_class($error));
            return json(['code' => 1004, 'msg' => 'Intake unavailable; check player configuration and plugin installation'], 503);
        }
    }
}
