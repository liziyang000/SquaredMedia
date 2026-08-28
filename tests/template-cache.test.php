<?php
declare(strict_types=1);

// Run with: php tests/template-cache.test.php <engine-directory> [output-directory]
// Public source: https://github.com/magicblack/maccms10/tree/master/thinkphp/library/think
// The engine directory contains the unmodified public MacCMS ThinkPHP files:
// Template.php, template/TagLib.php, template/taglib/Cx.php and template/driver/File.php,
// saved here by their basenames. No application bootstrap or database is used.
$engineDirectory = $argv[1] ?? '';
foreach (['Template.php', 'TagLib.php', 'Cx.php', 'File.php'] as $file) {
    if (!is_file($engineDirectory . '/' . $file)) {
        fwrite(STDERR, "Usage: php tests/template-cache.test.php <directory-with-Template.php-TagLib.php-Cx.php-File.php> [output-directory]\n");
        exit(2);
    }
}

$outputDirectory = $argv[2] ?? sys_get_temp_dir() . '/pingfang-template-cache-' . bin2hex(random_bytes(6));
if (file_exists($outputDirectory)) {
    throw new RuntimeException('Use a new output directory: ' . $outputDirectory);
}
mkdir($outputDirectory . '/views/public', 0755, true);
define('DS', DIRECTORY_SEPARATOR);
define('THINK_PATH', $engineDirectory . '/');
define('TEMP_PATH', $outputDirectory . '/cache/');
require $engineDirectory . '/Template.php';
require $engineDirectory . '/TagLib.php';
require $engineDirectory . '/Cx.php';
require $engineDirectory . '/File.php';

class TitleCacheTestStorage extends \think\template\driver\File
{
    public static int $writes = 0;

    public function write($cacheFile, $content)
    {
        self::$writes++;
        parent::write($cacheFile, $content);
    }
}

$themeDirectory = dirname(__DIR__) . '/template/pingfangvideo/html/';
$head = file_get_contents($themeDirectory . 'public/head.html');
preg_match('/\A[\s\S]*?<\/head>/', $head, $headMatch);
// Preserve production SEO markup and encoding; asset loading and database-backed
// navigation are outside this test.
file_put_contents($outputDirectory . '/views/public/head.html', $headMatch[0]);
$include = file_get_contents($themeDirectory . 'public/include.html');
if (!preg_match('/<meta charset="[^"]+">/i', $include, $charset)) {
    throw new RuntimeException('Missing production charset declaration');
}
file_put_contents($outputDirectory . '/views/public/include.html', $charset[0]);

$first = [
    'maccms' => ['site_name' => '平方视频', 'site_keywords' => '站点关键词', 'site_description' => '站点简介'],
    'obj' => [
        'type_name' => '电影', 'type_key' => '电影关键词', 'type_des' => '电影简介',
        'vod_name' => '星际旅程', 'vod_tag' => '星际关键词', 'vod_blurb' => '星际简介',
        'vod_play_list' => [1 => ['urls' => [1 => ['name' => '第1集'], 2 => ['name' => '第2集']]]],
    ],
    'param' => ['wd' => '星际', 'sid' => 1, 'nid' => 1],
];
$second = $first;
$second['obj'] = array_replace($first['obj'], [
    'type_name' => '电视剧', 'type_key' => '电视剧 "新作" & 分类', 'type_des' => '电视剧 <简介> "更新"',
    'vod_name' => '归途 "续篇" & 回响', 'vod_tag' => '归途 "关键词" & 标签', 'vod_blurb' => '归途 <简介> "更新"',
]);
$second['param'] = ['wd' => '归途 "续篇" & 回响', 'sid' => 1, 'nid' => 2];
$empty = $second;
$empty['obj'] = array_replace($second['obj'], ['type_key' => '', 'type_des' => '', 'vod_tag' => '', 'vod_blurb' => '']);
$empty['param']['wd'] = '';
$missing = $empty;
foreach (['type_key', 'type_des', 'vod_tag', 'vod_blurb'] as $field) {
    unset($missing['obj'][$field]);
}
unset($missing['param']['wd']);
$entities = $second;
$entities['obj'] = array_replace($second['obj'], [
    'type_name' => '电影 &amp; 剧集', 'type_key' => '分类 &quot;关键词&quot;', 'type_des' => '分类 &lt;简介&gt;',
    'vod_name' => '归途 &amp; 回响', 'vod_tag' => '影片 &quot;关键词&quot;', 'vod_blurb' => '影片 &lt;简介&gt;',
]);
$entities['param']['wd'] = '归途 &amp; 回响';
$variants = ['first' => $first, 'second' => $second, 'empty' => $empty, 'missing' => $missing, 'entities' => $entities];
$failures = [];
$results = [];
set_error_handler(static function (int $severity, string $message) use (&$failures): bool {
    if ((error_reporting() & $severity) === 0) {
        return false;
    }
    $failures[] = 'PHP runtime warning: ' . $message;
    return true;
});

foreach (['type', 'show', 'detail', 'play', 'player', 'down', 'plot', 'search'] as $page) {
    $source = file_get_contents($themeDirectory . 'vod/' . $page . '.html');
    if (!preg_match('/\A([\s\S]*?\{include file="public\/head"[^{}]*\/\})/', $source, $prefix)
        || !preg_match('/<h1\b[^>]*>[\s\S]*?<\/h1>/', $source, $heading)) {
        throw new RuntimeException('Missing page head or heading: ' . $page);
    }
    file_put_contents($outputDirectory . '/views/' . $page . '.html', $prefix[1] . "\n<body>" . $heading[0] . '</body></html>');
    $writesBefore = TitleCacheTestStorage::$writes;

    foreach ($variants as $variant => $data) {
        if ($page === 'show' && $variant === 'empty') {
            $data['obj']['type_name'] = '';
        }
        $isCategory = in_array($page, ['type', 'show'], true);
        $title = $page === 'search' ? (($data['param']['wd'] ?? '') ?: '搜索结果')
            : ($isCategory ? ($data['obj']['type_name'] ?: '影片库') : $data['obj']['vod_name']);
        $keywords = $page === 'search' ? ($data['param']['wd'] ?? '') : ($data['obj'][$isCategory ? 'type_key' : 'vod_tag'] ?? '');
        $description = $page === 'search' ? ($data['param']['wd'] ?? '') : ($data['obj'][$isCategory ? 'type_des' : 'vod_blurb'] ?? '');
        $headingText = $title . (in_array($page, ['play', 'player'], true) ? ' - 第' . $data['param']['nid'] . '集' : '');

        // A fresh request/engine instance must read the same compiled file.
        $engine = new \think\Template(['view_path' => $outputDirectory . '/views/', 'compile_type' => '\\TitleCacheTestStorage']);
        ob_start();
        $engine->fetch($page, $data);
        $html = ob_get_clean();
        file_put_contents($outputDirectory . '/' . $page . '-' . $variant . '.html', $html);
        $actual = [];
        foreach (['title' => '/<title>([\s\S]*?)<\/title>/', 'h1' => '/<h1[^>]*>([\s\S]*?)<\/h1>/',
            'keywords' => '/<meta name="keywords" content="([^"]*)">/', 'description' => '/<meta name="description" content="([^"]*)">/'] as $key => $pattern) {
            preg_match($pattern, $html, $match);
            $actual[$key] = isset($match[1]) ? html_entity_decode($match[1], ENT_QUOTES | ENT_HTML5, 'UTF-8') : null;
        }
        $expected = array_map(
            static fn (string $value): string => html_entity_decode($value, ENT_QUOTES | ENT_HTML5, 'UTF-8'),
            ['title' => $title . ' - 平方视频', 'h1' => $headingText, 'keywords' => $keywords, 'description' => $description],
        );
        foreach ($expected as $key => $value) {
            if ($actual[$key] !== $value) {
                $failures[] = "$page/$variant $key: expected " . json_encode($value, JSON_UNESCAPED_UNICODE)
                    . ', got ' . json_encode($actual[$key], JSON_UNESCAPED_UNICODE);
            }
        }
        if (TitleCacheTestStorage::$writes !== $writesBefore + 1) {
            $failures[] = "$page/$variant recompiled instead of reusing the template cache";
        }
        if (preg_match('/\[seo_(title|keywords|description)\]/', $html)) {
            $failures[] = "$page/$variant leaked an SEO include placeholder";
        }
        $results[] = ['page' => $page, 'variant' => $variant, 'actual' => $actual, 'expected' => $expected];
    }
}

// The optional runtime variables must not alter existing static page titles.
$staticSource = file_get_contents($themeDirectory . 'label/categories.html');
preg_match('/\A\{include file="public\/head"[^{}]*\/\}/', $staticSource, $staticPrefix);
file_put_contents($outputDirectory . '/views/static.html', $staticPrefix[0]);
$engine = new \think\Template(['view_path' => $outputDirectory . '/views/']);
ob_start();
$engine->fetch('static', $second);
$staticHtml = ob_get_clean();
if (strpos($staticHtml, '<title>视频分类 - 平方视频</title>') === false) {
    $failures[] = 'Static category index title changed';
}
file_put_contents($outputDirectory . '/results.json', json_encode($results, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
restore_error_handler();
echo 'Artifacts: ' . $outputDirectory . "\n";
if ($failures !== []) {
    fwrite(STDERR, implode("\n", $failures) . "\n");
    exit(1);
}
echo 'Template cache regression passed: ' . count($results) . " dynamic renders, 8 reused caches, static title preserved.\n";
