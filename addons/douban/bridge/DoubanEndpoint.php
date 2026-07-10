<?php

use addons\douban\service\DoubanGateway;

header('Content-Type: application/json; charset=utf-8');

require dirname(__DIR__) . '/addons/douban/service/DoubanGateway.php';

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
