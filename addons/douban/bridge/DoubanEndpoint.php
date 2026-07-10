<?php

use addons\douban\service\DoubanGateway;

header('Content-Type: application/json; charset=utf-8');

require dirname(__DIR__) . '/addons/douban/service/DoubanGateway.php';

$clientIp = (string) ($_SERVER['REMOTE_ADDR'] ?? 'unknown');
$rateFile = sys_get_temp_dir() . '/douban-gateway-' . hash('sha256', $clientIp) . '.json';
$rateHandle = @fopen($rateFile, 'c+');
if ($rateHandle !== false && flock($rateHandle, LOCK_EX)) {
    $minute = intdiv(time(), 60);
    $state = json_decode((string) stream_get_contents($rateHandle), true);
    $count = is_array($state) && (int) ($state['minute'] ?? 0) === $minute ? (int) ($state['count'] ?? 0) : 0;
    if ($count >= 30) {
        flock($rateHandle, LOCK_UN);
        fclose($rateHandle);
        header('Retry-After: 60');
        http_response_code(429);
        echo json_encode(['code' => 1003, 'msg' => '请求过于频繁', 'data' => null], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        exit;
    }
    ftruncate($rateHandle, 0);
    rewind($rateHandle);
    fwrite($rateHandle, json_encode(['minute' => $minute, 'count' => $count + 1]));
    fflush($rateHandle);
    flock($rateHandle, LOCK_UN);
    fclose($rateHandle);
}

try {
    $id = preg_replace('/\D+/', '', (string) ($_GET['id'] ?? ''));
    $query = trim((string) ($_GET['q'] ?? ''));
    if ($id !== '') {
        $data = DoubanGateway::subject($id);
    } elseif ($query !== '') {
        $data = DoubanGateway::search($query, (int) ($_GET['limit'] ?? 5));
    } else {
        throw new InvalidArgumentException('id or q is required');
    }

    echo json_encode(['code' => 1, 'data' => $data], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
} catch (Throwable $e) {
    http_response_code(502);
    echo json_encode(['code' => 1002, 'msg' => $e->getMessage(), 'data' => null], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
}
