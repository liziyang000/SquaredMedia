<?php

$root = dirname(__DIR__);
$source = $root . '/addons/vodmerge';
$dist = $root . '/dist';
if (!is_dir($dist)) {
    mkdir($dist, 0755, true);
}
$version = parse_ini_file($source . '/info.ini')['version'];
$path = $dist . '/vodmerge-' . $version . '.zip';
$zip = new ZipArchive();
if ($zip->open($path, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
    throw new RuntimeException('Cannot create plugin archive');
}
$files = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($source, FilesystemIterator::SKIP_DOTS));
$manifest = [];
foreach ($files as $file) {
    $relative = substr($file->getPathname(), strlen($source) + 1);
    if ($file->isLink() || preg_match('~(^|/)(\.|__pycache__)|\.pyc$~', $relative)) {
        continue;
    }
    $entry = 'vodmerge/' . $relative;
    $zip->addFile($file->getPathname(), $entry);
    $zip->setExternalAttributesName($entry, ZipArchive::OPSYS_UNIX, 0100644 << 16);
    $manifest[$entry] = hash_file('sha256', $file->getPathname());
}
$zip->close();
$verify = new ZipArchive();
if ($verify->open($path) !== true || $verify->numFiles !== count($manifest)) {
    throw new RuntimeException('Archive validation failed');
}
foreach ($manifest as $entry => $hash) {
    if (hash('sha256', $verify->getFromName($entry)) !== $hash) {
        throw new RuntimeException('Archive hash mismatch: ' . $entry);
    }
}
$verify->close();
file_put_contents($path . '.sha256', hash_file('sha256', $path) . '  ' . basename($path) . "\n");
echo $path . "\n" . count($manifest) . " files verified\n";
