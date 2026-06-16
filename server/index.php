<?php
declare(strict_types=1);

if (PHP_VERSION_ID < 80400) {
    http_response_code(500);
    echo 'PHP 8.4 or newer is required.';
    exit;
}

require __DIR__ . '/lib/data.php';
require __DIR__ . '/lib/render.php';

$data = load_data();
$route = (string) ($_GET['route'] ?? 'home');

echo render_page($data, $route, $_GET);
