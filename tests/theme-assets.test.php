<?php

namespace think { class Addons {} }

namespace addons\pingfangdevice {
    function request() {
        return new class { public function path() { return $GLOBALS['assetPath']; } };
    }
}

namespace addons\pingfangdevice\service {
    class DeviceSession { public static function syncActiveCookie() { $GLOBALS['sessionChecks']++; } }

    function header($value, $replace = true) { $GLOBALS['assetHeaders'][] = [$value, $replace]; }
    function headers_sent() { return $GLOBALS['assetHeadersSent']; }
    function config($name) {
        if ($name !== 'maccms.site') throw new \RuntimeException('ThinkPHP only supports two-level configuration lookup');
        return ['template_dir' => $GLOBALS['assetTheme']];
    }
}

namespace {
    use addons\pingfangdevice\service\ThemeAssets;

    function asset_assert($condition, $message) {
        if (!$condition) { throw new \RuntimeException($message); }
    }
    $root = sys_get_temp_dir() . '/pingfang-assets-' . bin2hex(random_bytes(6));
    mkdir($root . '/template/pingfangvideo', 0777, true);
    define('ROOT_PATH', $root . '/');
    require dirname(__DIR__) . '/addons/pingfangdevice/service/ThemeAssets.php';
    $manifest = $root . '/template/pingfangvideo/asset-preloads.json';
    $valid = ['css/base.css' => '012345abcdef', 'css/style.css' => '123456abcdef', 'css/responsive.css' => '234567abcdef'];
    $assetTheme = 'pingfangvideo';
    $assetHeadersSent = false;
    $_SERVER = ['REQUEST_METHOD' => 'GET', 'HTTP_ACCEPT' => 'text/html,application/xhtml+xml', 'SCRIPT_NAME' => '/index.php'];
    mkdir($root . '/static/js', 0777, true);
    try {
        $include = file_get_contents(dirname(__DIR__) . '/template/pingfangvideo/html/public/include.html');
        preg_match_all('#static/js/(jquery|home)\.js\?v=\{:([^}]+)\}#', $include, $versionTags, PREG_SET_ORDER);
        asset_assert(count($versionTags) === 2, 'Both core script URLs must carry content versions');
        foreach ($versionTags as $tag) {
            file_put_contents($root . '/static/js/' . $tag[1] . '.js', $tag[1] . ' version one');
            $oldVersion = eval('return ' . $tag[2] . ';');
            asset_assert($oldVersion === substr(hash('sha256', $tag[1] . ' version one'), 0, 12), 'Core script versions must match content');
            file_put_contents($root . '/static/js/' . $tag[1] . '.js', $tag[1] . ' version two');
            asset_assert(eval('return ' . $tag[2] . ';') !== $oldVersion, 'Updating a core script must change its public URL');
        }
        file_put_contents($manifest, json_encode($valid));
        $assetHeaders = [['Cache-Control: private', true], ['Link: </existing.css>; rel=preload; as=style', false]];
        ThemeAssets::preload();
        asset_assert(count($assetHeaders) === 3, 'Preloads must append without replacing existing response headers');
        asset_assert($assetHeaders[2][1] === false, 'Existing Link headers must be preserved');
        foreach ($valid as $path => $version) {
            asset_assert(str_contains($assetHeaders[2][0], '</template/pingfangvideo/' . $path . '?v=' . $version . '>; rel=preload; as=style'), 'A CSS preload is missing or unversioned');
        }
        $_SERVER['SCRIPT_NAME'] = '/portal/index.php';
        $assetHeaders = [];
        ThemeAssets::preload();
        asset_assert(str_contains($assetHeaders[0][0], '</portal/template/'), 'Subdirectory installations must retain their prefix');
        foreach ([['REQUEST_METHOD', 'POST'], ['HTTP_ACCEPT', 'application/json'], ['SCRIPT_NAME', '/admin.php'], ['SCRIPT_NAME', "/index.php\r\nX-Injected: 1"]] as [$key, $value]) {
            $saved = $_SERVER[$key];
            $_SERVER[$key] = $value;
            $assetHeaders = [];
            ThemeAssets::preload();
            asset_assert($assetHeaders === [], 'Non-document and unsafe entry points must not emit preload headers');
            $_SERVER[$key] = $saved;
        }
        foreach (['{}', '{broken', str_repeat('x', 1025), json_encode(array_merge($valid, ['extra.css' => '012345abcdef'])), json_encode(array_merge($valid, ['css/base.css' => "bad\r\nheader"]))] as $contents) {
            file_put_contents($manifest, $contents);
            $assetHeaders = [];
            ThemeAssets::preload();
            asset_assert($assetHeaders === [], 'Invalid manifests must not emit partial or unsafe hints');
        }
        file_put_contents($manifest, json_encode($valid));
        $assetTheme = 'another-theme';
        $assetHeaders = [];
        ThemeAssets::preload();
        asset_assert($assetHeaders === [], 'Other themes must not preload these styles');
        $assetTheme = 'pingfangvideo';
        $assetHeadersSent = true;
        ThemeAssets::preload();
        asset_assert($assetHeaders === [], 'Headers must not be appended after output begins');
        $assetHeadersSent = false;
        unlink($manifest);
        ThemeAssets::preload();
        asset_assert($assetHeaders === [], 'An older theme without a manifest must continue to work');
        require dirname(__DIR__) . '/addons/pingfangdevice/Pingfangdevice.php';
        $plugin = new \addons\pingfangdevice\Pingfangdevice();
        $sessionChecks = 0;
        foreach (['' => 1, 'vod/detail/id/1' => 1, 'user/favs' => 1, 'vod/play/id/1/sid/1/nid/1' => 0, 'vod/player/id/1' => 0, 'vod/playback' => 1] as $assetPath => $expected) {
            $GLOBALS['config'] = ['app' => ['cache_page' => 1]];
            $params = null;
            $plugin->appBegin($params);
            asset_assert($GLOBALS['config']['app']['cache_page'] === $expected, 'Playback HTML must not reuse a guest or another login state; other page caching must remain enabled');
        }
        asset_assert($sessionChecks === 6, 'The existing device-session check must continue to run');

    } finally {
        foreach (['jquery', 'home'] as $name) unlink($root . '/static/js/' . $name . '.js');
        rmdir($root . '/static/js');
        rmdir($root . '/static');
        if (is_file($manifest)) unlink($manifest);
        rmdir(dirname($manifest));
        rmdir($root . '/template');
        rmdir($root);
    }
    echo "Theme preload header checks passed.\n";
}
