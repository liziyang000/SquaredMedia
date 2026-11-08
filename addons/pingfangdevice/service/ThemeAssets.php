<?php

namespace addons\pingfangdevice\service;

class ThemeAssets
{
    public static function preload()
    {
        $script = (string) ($_SERVER['SCRIPT_NAME'] ?? '');
        $site = config('maccms.site');
        if (headers_sent()
            || ($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET'
            || stripos((string) ($_SERVER['HTTP_ACCEPT'] ?? ''), 'text/html') === false
            || strlen($script) > 512
            || !preg_match('#^/(?:[A-Za-z0-9._~-]+/)*index\.php$#D', $script)
            || !defined('ROOT_PATH')
            || $site['template_dir'] !== 'pingfangvideo') {
            return;
        }

        $manifest = @file_get_contents(rtrim(ROOT_PATH, '/\\') . '/template/pingfangvideo/asset-preloads.json', false, null, 0, 1025);
        if (!is_string($manifest) || strlen($manifest) > 1024) {
            return;
        }
        $assets = json_decode($manifest, true);
        if (!is_array($assets) || count($assets) !== 3) {
            return;
        }

        $prefix = rtrim(dirname($script), '/') . '/template/pingfangvideo/';
        $links = [];
        foreach (['css/base.css', 'css/style.css', 'css/responsive.css'] as $path) {
            $version = $assets[$path] ?? null;
            if (!is_string($version) || !preg_match('/^[a-f0-9]{12}$/D', $version)) {
                return;
            }
            $links[] = '<' . $prefix . $path . '?v=' . $version . '>; rel=preload; as=style';
        }
        header('Link: ' . implode(', ', $links), false);
    }
}
