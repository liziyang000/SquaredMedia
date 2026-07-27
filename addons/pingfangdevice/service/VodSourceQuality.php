<?php

namespace addons\pingfangdevice\service;

use think\Db;

class VodSourceQuality
{
    const CACHE_VERSION = 'v4';
    const CACHE_SECONDS = 60;
    const MAX_SOURCES = 12;
    const MANIFEST_BYTES = 131072;
    const SAMPLE_BYTES = 262144;
    const MAX_MEDIA_SAMPLES = 3;
    const MIN_SPEED_SAMPLES = 2;
    const MAX_VARIANT_ATTEMPTS = 3;
    const MIN_PARTIAL_BYTES = 16384;
    const SLOW_SPEED_KBPS = 800;
    const CONNECT_TIMEOUT_SECONDS = 3;
    const REQUEST_TIMEOUT_SECONDS = 6;
    const MAX_REDIRECTS = 2;
    const MAX_CHECK_SECONDS = 24;

    public static function check($vodId, $nid)
    {
        $vodId = intval($vodId);
        $nid = intval($nid);
        if ($vodId < 1 || $nid < 1 || $nid > 10000) {
            return ['code' => 1001, 'msg' => '视频或集数参数错误'];
        }

        $vod = self::rowToArray(Db::name('vod')
            ->where('vod_id', $vodId)
            ->where('vod_status', 1)
            ->field('vod_id,vod_name,vod_play_from,vod_play_url')
            ->find());
        if (empty($vod)) {
            return ['code' => 1002, 'msg' => '视频不存在或不可用'];
        }

        $cacheKey = 'pingfang_vod_source_quality_' . self::CACHE_VERSION . '_' . md5(
            $vodId . '|' . $nid . '|' . ($vod['vod_play_from'] ?? '') . '|' . ($vod['vod_play_url'] ?? '')
        );
        if (function_exists('cache')) {
            $cached = cache($cacheKey);
            if (is_array($cached)) {
                $cached['cached'] = true;
                return ['code' => 1, 'msg' => 'ok', 'data' => $cached];
            }
        }

        $result = self::inspectVod($vod, $nid);
        if (($result['code'] ?? 0) === 1 && function_exists('cache')) {
            cache($cacheKey, $result['data'], self::CACHE_SECONDS);
        }

        return $result;
    }

    public static function inspectVod(array $vod, $nid, $fetcher = null)
    {
        $vodId = intval($vod['vod_id'] ?? 0);
        $nid = intval($nid);
        if ($vodId < 1 || $nid < 1 || $nid > 10000) {
            return ['code' => 1001, 'msg' => '视频或集数参数错误'];
        }

        $fromList = self::splitGroups($vod['vod_play_from'] ?? '');
        $urlGroups = self::splitGroups($vod['vod_play_url'] ?? '');
        $sourceCount = min(self::MAX_SOURCES, max(count($fromList), count($urlGroups)));
        if ($sourceCount < 1) {
            return ['code' => 1004, 'msg' => '当前视频没有播放源'];
        }

        if ($fetcher === null) {
            $fetcher = static function ($url, $byteLimit, $byteOffset = 0, $timeoutSeconds = null) {
                return self::request($url, $byteLimit, $byteOffset, $timeoutSeconds);
            };
        } elseif (!is_callable($fetcher)) {
            return ['code' => 1001, 'msg' => '检测器参数错误'];
        }

        $sources = [];
        $startedAt = microtime(true);
        for ($index = 0; $index < $sourceCount; $index++) {
            $sid = $index + 1;
            $from = self::cleanText($fromList[$index] ?? '', 60);
            if ($from === '') {
                $from = '线路' . $sid;
            }

            $episodes = self::parseEpisodes($urlGroups[$index] ?? '');
            if (!isset($episodes[$nid - 1])) {
                $sources[] = self::emptyResult($sid, $from, $nid, '第' . $nid . '集', 'missing', '该线路缺少此集');
                continue;
            }

            $episode = $episodes[$nid - 1];
            $base = self::emptyResult($sid, $from, $nid, $episode['name'], 'failed', '连接失败');
            if (microtime(true) - $startedAt >= self::MAX_CHECK_SECONDS) {
                $base['status'] = 'timeout';
                $base['message'] = '本次检测已超时，未执行此线路';
                $sources[] = $base;
                continue;
            }
            if (!self::isHttpUrl($episode['url'])) {
                $base['status'] = 'unsupported';
                $base['message'] = '解析型地址，无法直接测速';
                $sources[] = $base;
                continue;
            }

            $probe = self::probeMedia($episode['url'], $fetcher, $startedAt + self::MAX_CHECK_SECONDS);
            $sources[] = array_merge($base, $probe);
        }
        $recommendedSid = self::rankSources($sources);

        return [
            'code' => 1,
            'msg' => 'ok',
            'data' => [
                'vod_id' => $vodId,
                'nid' => $nid,
                'checked_at' => time(),
                'cached' => false,
                'recommended_sid' => $recommendedSid,
                'sources' => $sources,
            ],
        ];
    }

    private static function probeMedia($url, callable $fetcher, $deadline)
    {
        $initial = self::fetchResponse($fetcher, $url, self::MANIFEST_BYTES, 0, $deadline);
        if (!$initial['ok']) {
            return self::failedProbe($initial);
        }
        if (self::isHtmlResponse($initial)) {
            return self::unsupportedProbe('返回的是解析页面，无法直接测速', $initial);
        }

        if (!self::isHlsResponse($url, $initial)) {
            if (self::isNonMediaResponse($initial)) {
                return self::unsupportedProbe('返回内容不是可识别的媒体数据', $initial);
            }

            $samples = [$initial];
            for ($index = 1; $index < self::MAX_MEDIA_SAMPLES; $index++) {
                if (microtime(true) >= $deadline) {
                    break;
                }
                if (intval($initial['http_code']) === 200 && intval($initial['bytes']) < self::MANIFEST_BYTES) {
                    break;
                }

                $sample = self::fetchResponse(
                    $fetcher,
                    $url,
                    self::SAMPLE_BYTES,
                    $index * self::SAMPLE_BYTES,
                    $deadline
                );
                if ($sample['ok'] && !self::isHtmlResponse($sample) && !self::isNonMediaResponse($sample)) {
                    $samples[] = $sample;
                }
            }
            return self::sampleResult($samples);
        }

        if (stripos($initial['body'], '#EXT-X-STREAM-INF') !== false) {
            return self::probeHlsMaster($url, $initial, $fetcher, $deadline);
        }

        return self::probeHlsPlaylist($url, $initial, $fetcher, $deadline);
    }

    private static function probeHlsMaster($masterUrl, array $master, callable $fetcher, $deadline)
    {
        $variants = self::parseMasterVariants($master['body']);
        if (empty($variants)) {
            return self::unsupportedProbe('HLS 主清单没有可检测线路', $master);
        }

        $maxResolution = self::maxVariantResolution($variants);
        $lastResult = self::unsupportedProbe('HLS 子清单均不可用', $master);
        $attempts = 0;
        foreach ($variants as $variant) {
            if ($attempts >= self::MAX_VARIANT_ATTEMPTS) {
                break;
            }
            if (microtime(true) >= $deadline) {
                $lastResult = self::failedProbe(self::timeoutResponse(), 'HLS 清晰度检测超时');
                break;
            }
            $attempts++;

            $playlistUrl = self::resolveUrl($masterUrl, $variant['uri']);
            if (!self::isHttpUrl($playlistUrl)) {
                $lastResult = self::unsupportedProbe('HLS 子清单地址不受支持', $master);
                continue;
            }

            $playlist = self::fetchResponse($fetcher, $playlistUrl, self::MANIFEST_BYTES, 0, $deadline);
            if (!$playlist['ok']) {
                $lastResult = self::failedProbe($playlist);
                continue;
            }
            if (self::isHtmlResponse($playlist) || !self::hasHlsHeader($playlist['body'])) {
                $lastResult = self::unsupportedProbe('HLS 子清单内容不受支持', $playlist);
                continue;
            }

            $result = self::probeHlsPlaylist($playlistUrl, $playlist, $fetcher, $deadline);
            if (!empty($result['available'])) {
                return array_merge(
                    $result,
                    self::variantResult($variant, $maxResolution, $attempts > 1)
                );
            }
            $lastResult = $result;
        }

        return array_merge(
            $lastResult,
            self::variantResult(null, $maxResolution, $attempts > 1)
        );
    }

    private static function probeHlsPlaylist($playlistUrl, array $playlist, callable $fetcher, $deadline)
    {
        $segments = self::playlistUris($playlist['body'], self::MAX_MEDIA_SAMPLES);
        if (empty($segments)) {
            return self::unsupportedProbe('HLS 清单没有可测速分片', $playlist);
        }

        $samples = [];
        $lastFailure = null;
        foreach ($segments as $segment) {
            if (microtime(true) >= $deadline) {
                $lastFailure = self::timeoutResponse();
                break;
            }

            $segmentUrl = self::resolveUrl($playlistUrl, $segment);
            if (!self::isHttpUrl($segmentUrl)) {
                $lastFailure = self::unsupportedResponse();
                continue;
            }

            $sample = self::fetchResponse($fetcher, $segmentUrl, self::SAMPLE_BYTES, 0, $deadline);
            if (!$sample['ok']) {
                $lastFailure = $sample;
                continue;
            }
            if (self::isHtmlResponse($sample) || self::isNonMediaResponse($sample)) {
                $lastFailure = array_merge($sample, ['unsupported' => true, 'ok' => false]);
                continue;
            }
            $samples[] = $sample;
        }

        if (empty($samples)) {
            $message = !empty($lastFailure['timed_out']) ? 'HLS 分片检测超时' : 'HLS 分片均不可用';
            return self::failedProbe(
                is_array($lastFailure) ? $lastFailure : self::unsupportedResponse(),
                $message
            );
        }

        return self::sampleResult($samples);
    }

    private static function fetchResponse(callable $fetcher, $url, $byteLimit, $byteOffset, $deadline)
    {
        $remaining = floatval($deadline) - microtime(true);
        if ($remaining <= 0) {
            return self::timeoutResponse();
        }

        $timeoutSeconds = max(1, min(self::REQUEST_TIMEOUT_SECONDS, intval(ceil($remaining))));
        return self::normalizeResponse($fetcher($url, $byteLimit, $byteOffset, $timeoutSeconds));
    }

    private static function sampleResult(array $samples)
    {
        $speeds = [];
        $latencies = [];
        $lastSample = [];
        foreach ($samples as $sample) {
            $bytes = max(0, intval($sample['bytes'] ?? 0));
            if ($bytes < 1) {
                continue;
            }
            $durationMs = max(1, intval($sample['duration_ms'] ?? 0));
            $speeds[] = intval(round(($bytes * 8) / $durationMs));
            $latencies[] = max(1, intval($sample['ttfb_ms'] ?? $durationMs));
            $lastSample = $sample;
        }
        $sampleCount = count($speeds);
        if ($sampleCount < 1) {
            return self::failedProbe(is_array(end($samples)) ? end($samples) : [], '未读取到媒体数据');
        }

        $speedKbps = $sampleCount >= self::MIN_SPEED_SAMPLES ? self::median($speeds) : null;
        $status = $speedKbps !== null && $speedKbps < self::SLOW_SPEED_KBPS ? 'slow' : 'available';
        $message = '可用';
        if ($sampleCount < self::MIN_SPEED_SAMPLES) {
            $message = '可用，但测速样本不足';
        } elseif ($status === 'slow') {
            $message = '可用，但当前速度较慢';
        }

        return [
            'status' => $status,
            'available' => true,
            'http_code' => intval($lastSample['http_code'] ?? 0) ?: null,
            'latency_ms' => self::median($latencies),
            'speed_kbps' => $speedKbps,
            'sample_count' => $sampleCount,
            'message' => $message,
        ];
    }

    private static function median(array $values)
    {
        sort($values, SORT_NUMERIC);
        $count = count($values);
        if ($count < 1) {
            return null;
        }
        $middle = intdiv($count, 2);
        if ($count % 2 === 1) {
            return intval($values[$middle]);
        }
        return intval(round(($values[$middle - 1] + $values[$middle]) / 2));
    }

    private static function failedProbe(array $response, $message = '')
    {
        if (!empty($response['unsupported'])) {
            return self::unsupportedProbe($message !== '' ? $message : '地址无法安全探测', $response);
        }

        $httpCode = intval($response['http_code'] ?? 0);
        $timedOut = !empty($response['timed_out']);
        if ($message === '') {
            $message = $timedOut ? '连接超时' : ($httpCode > 0 ? 'HTTP ' . $httpCode : '连接失败');
        }

        return [
            'status' => $timedOut ? 'timeout' : 'failed',
            'available' => false,
            'http_code' => $httpCode > 0 ? $httpCode : null,
            'latency_ms' => max(0, intval($response['ttfb_ms'] ?? $response['duration_ms'] ?? 0)) ?: null,
            'speed_kbps' => null,
            'sample_count' => 0,
            'tested_width' => null,
            'tested_height' => null,
            'max_width' => null,
            'max_height' => null,
            'resolution_basis' => 'unknown',
            'variant_bandwidth_kbps' => null,
            'variant_codecs' => null,
            'fallback_used' => false,
            'quality_rank' => null,
            'recommended' => false,
            'message' => $message,
        ];
    }

    private static function rankSources(array &$sources)
    {
        $ranked = [];
        foreach ($sources as $index => $source) {
            if (empty($source['available'])) {
                continue;
            }
            $speed = max(0, intval($source['speed_kbps'] ?? 0));
            $latency = max(0, intval($source['latency_ms'] ?? 0));
            $ranked[] = [
                'index' => $index,
                'sid' => intval($source['sid'] ?? 0),
                'measured' => $speed > 0 ? 1 : 0,
                'speed' => $speed,
                'latency' => $latency > 0 ? $latency : PHP_INT_MAX,
                'samples' => max(0, intval($source['sample_count'] ?? 0)),
            ];
        }

        usort($ranked, static function ($left, $right) {
            if ($left['measured'] !== $right['measured']) {
                return $right['measured'] <=> $left['measured'];
            }
            if ($left['speed'] !== $right['speed']) {
                return $right['speed'] <=> $left['speed'];
            }
            if ($left['latency'] !== $right['latency']) {
                return $left['latency'] <=> $right['latency'];
            }
            if ($left['samples'] !== $right['samples']) {
                return $right['samples'] <=> $left['samples'];
            }
            return $left['sid'] <=> $right['sid'];
        });

        foreach ($ranked as $position => $item) {
            $rank = $position + 1;
            $sources[$item['index']]['quality_rank'] = $rank;
            $sources[$item['index']]['recommended'] = $rank === 1;
        }

        return empty($ranked) ? null : $ranked[0]['sid'];
    }

    private static function unsupportedProbe($message, array $response = [])
    {
        $httpCode = intval($response['http_code'] ?? 0);
        return [
            'status' => 'unsupported',
            'available' => false,
            'http_code' => $httpCode > 0 ? $httpCode : null,
            'latency_ms' => max(0, intval($response['ttfb_ms'] ?? $response['duration_ms'] ?? 0)) ?: null,
            'speed_kbps' => null,
            'sample_count' => 0,
            'tested_width' => null,
            'tested_height' => null,
            'max_width' => null,
            'max_height' => null,
            'resolution_basis' => 'unknown',
            'variant_bandwidth_kbps' => null,
            'variant_codecs' => null,
            'fallback_used' => false,
            'quality_rank' => null,
            'recommended' => false,
            'message' => $message,
        ];
    }

    private static function emptyResult($sid, $from, $nid, $episodeName, $status, $message)
    {
        return [
            'sid' => intval($sid),
            'from' => $from,
            'nid' => intval($nid),
            'episode_name' => self::cleanText($episodeName, 100),
            'status' => $status,
            'available' => false,
            'http_code' => null,
            'latency_ms' => null,
            'speed_kbps' => null,
            'sample_count' => 0,
            'tested_width' => null,
            'tested_height' => null,
            'max_width' => null,
            'max_height' => null,
            'resolution_basis' => 'unknown',
            'variant_bandwidth_kbps' => null,
            'variant_codecs' => null,
            'fallback_used' => false,
            'quality_rank' => null,
            'recommended' => false,
            'message' => $message,
        ];
    }

    private static function splitGroups($value)
    {
        $value = trim((string) $value);
        return $value === '' ? [] : explode('$$$', $value);
    }

    private static function parseEpisodes($group)
    {
        $episodes = [];
        foreach (explode('#', (string) $group) as $index => $item) {
            $item = trim($item);
            if ($item === '') {
                continue;
            }
            $parts = explode('$', $item, 2);
            if (count($parts) === 2) {
                $name = self::cleanText($parts[0], 100);
                $url = trim($parts[1]);
            } else {
                $name = '';
                $url = trim($parts[0]);
            }
            $episodes[] = [
                'name' => $name !== '' ? $name : '第' . ($index + 1) . '集',
                'url' => $url,
            ];
        }
        return $episodes;
    }

    private static function parseMasterVariants($body)
    {
        $lines = preg_split('/\r\n|\r|\n/', (string) $body);
        $variants = [];
        $lineCount = count($lines);
        for ($index = 0; $index < $lineCount; $index++) {
            $line = trim($lines[$index]);
            if (stripos($line, '#EXT-X-STREAM-INF:') !== 0) {
                continue;
            }

            $attributes = self::parseAttributeList(substr($line, strlen('#EXT-X-STREAM-INF:')));
            $uri = '';
            for ($uriIndex = $index + 1; $uriIndex < $lineCount; $uriIndex++) {
                $candidate = trim($lines[$uriIndex]);
                if ($candidate === '') {
                    continue;
                }
                if (substr($candidate, 0, 1) === '#') {
                    break;
                }
                $uri = $candidate;
                $index = $uriIndex;
                break;
            }
            if ($uri === '') {
                continue;
            }

            $width = null;
            $height = null;
            $resolution = $attributes['RESOLUTION'] ?? '';
            if (preg_match('/^([1-9][0-9]{0,4})x([1-9][0-9]{0,4})$/i', $resolution, $matches)) {
                $candidateWidth = intval($matches[1]);
                $candidateHeight = intval($matches[2]);
                if ($candidateWidth <= 65535 && $candidateHeight <= 65535) {
                    $width = $candidateWidth;
                    $height = $candidateHeight;
                }
            }

            $bandwidth = self::positiveInteger($attributes['BANDWIDTH'] ?? '');
            $averageBandwidth = self::positiveInteger($attributes['AVERAGE-BANDWIDTH'] ?? '');
            $variants[] = [
                'uri' => $uri,
                'width' => $width,
                'height' => $height,
                'bandwidth' => $bandwidth,
                'average_bandwidth' => $averageBandwidth,
                'codecs' => self::cleanText($attributes['CODECS'] ?? '', 120),
            ];
        }

        usort($variants, static function ($left, $right) {
            $leftPixels = intval($left['width']) * intval($left['height']);
            $rightPixels = intval($right['width']) * intval($right['height']);
            if ($leftPixels !== $rightPixels) {
                return $rightPixels <=> $leftPixels;
            }
            return intval($right['bandwidth']) <=> intval($left['bandwidth']);
        });
        return $variants;
    }

    private static function parseAttributeList($value)
    {
        $attributes = [];
        if (preg_match_all('/(?:^|,)\s*([A-Z0-9-]+)=("[^"]*"|[^,]*)/i', (string) $value, $matches, PREG_SET_ORDER)) {
            foreach ($matches as $match) {
                $attributeValue = trim($match[2]);
                if (strlen($attributeValue) >= 2 && $attributeValue[0] === '"' && substr($attributeValue, -1) === '"') {
                    $attributeValue = substr($attributeValue, 1, -1);
                }
                $attributes[strtoupper($match[1])] = $attributeValue;
            }
        }
        return $attributes;
    }

    private static function positiveInteger($value)
    {
        $value = trim((string) $value);
        if (!preg_match('/^[1-9][0-9]{0,11}$/', $value)) {
            return 0;
        }
        return intval($value);
    }

    private static function maxVariantResolution(array $variants)
    {
        $max = ['width' => null, 'height' => null];
        $maxPixels = 0;
        foreach ($variants as $variant) {
            $pixels = intval($variant['width']) * intval($variant['height']);
            if ($pixels > $maxPixels) {
                $max = ['width' => intval($variant['width']), 'height' => intval($variant['height'])];
                $maxPixels = $pixels;
            }
        }
        return $max;
    }

    private static function variantResult($variant, array $maxResolution, $fallbackUsed)
    {
        $variant = is_array($variant) ? $variant : [];
        $width = intval($variant['width'] ?? 0);
        $height = intval($variant['height'] ?? 0);
        $maxWidth = intval($maxResolution['width'] ?? 0);
        $maxHeight = intval($maxResolution['height'] ?? 0);
        $bandwidth = intval($variant['average_bandwidth'] ?? 0) ?: intval($variant['bandwidth'] ?? 0);
        return [
            'tested_width' => $width > 0 ? $width : null,
            'tested_height' => $height > 0 ? $height : null,
            'max_width' => $maxWidth > 0 ? $maxWidth : null,
            'max_height' => $maxHeight > 0 ? $maxHeight : null,
            'resolution_basis' => ($width > 0 && $height > 0) || ($maxWidth > 0 && $maxHeight > 0) ? 'manifest' : 'unknown',
            'variant_bandwidth_kbps' => $bandwidth > 0 ? intval(round($bandwidth / 1000)) : null,
            'variant_codecs' => ($variant['codecs'] ?? '') !== '' ? $variant['codecs'] : null,
            'fallback_used' => (bool) $fallbackUsed,
        ];
    }

    private static function playlistUris($body, $limit)
    {
        $uris = [];
        foreach (preg_split('/\r\n|\r|\n/', (string) $body) as $line) {
            $line = trim($line);
            if ($line !== '' && substr($line, 0, 1) !== '#') {
                if (!isset($uris[$line])) {
                    $uris[$line] = $line;
                }
                if (count($uris) >= $limit) {
                    break;
                }
            }
        }
        return array_values($uris);
    }

    private static function resolveUrl($baseUrl, $relativeUrl)
    {
        $relativeUrl = trim((string) $relativeUrl);
        if (self::isHttpUrl($relativeUrl)) {
            return $relativeUrl;
        }

        $base = parse_url((string) $baseUrl);
        if (!is_array($base) || empty($base['scheme']) || empty($base['host'])) {
            return '';
        }
        if (substr($relativeUrl, 0, 2) === '//') {
            return $base['scheme'] . ':' . $relativeUrl;
        }

        $authority = $base['scheme'] . '://' . $base['host'];
        if (!empty($base['port'])) {
            $authority .= ':' . intval($base['port']);
        }
        if (substr($relativeUrl, 0, 1) === '/') {
            return $authority . self::normalizePath($relativeUrl);
        }

        $basePath = $base['path'] ?? '/';
        $directory = preg_replace('#/[^/]*$#', '/', $basePath);
        return $authority . self::normalizePath($directory . $relativeUrl);
    }

    private static function normalizePath($path)
    {
        $suffix = '';
        $queryPosition = strcspn($path, '?#');
        if ($queryPosition < strlen($path)) {
            $suffix = substr($path, $queryPosition);
            $path = substr($path, 0, $queryPosition);
        }

        $segments = [];
        foreach (explode('/', $path) as $segment) {
            if ($segment === '' || $segment === '.') {
                continue;
            }
            if ($segment === '..') {
                array_pop($segments);
                continue;
            }
            $segments[] = $segment;
        }
        return '/' . implode('/', $segments) . $suffix;
    }

    private static function isHlsResponse($url, array $response)
    {
        $contentType = strtolower((string) ($response['content_type'] ?? ''));
        $path = strtolower((string) (parse_url((string) $url, PHP_URL_PATH) ?: ''));
        return strpos($contentType, 'mpegurl') !== false || substr($path, -5) === '.m3u8' || self::hasHlsHeader($response['body'] ?? '');
    }

    private static function hasHlsHeader($body)
    {
        $body = ltrim((string) $body, "\xEF\xBB\xBF\r\n\t ");
        return strpos($body, '#EXTM3U') === 0;
    }

    private static function isHtmlResponse(array $response)
    {
        $contentType = strtolower((string) ($response['content_type'] ?? ''));
        $body = ltrim((string) ($response['body'] ?? ''));
        return strpos($contentType, 'text/html') !== false || stripos(substr($body, 0, 80), '<!doctype html') !== false || stripos(substr($body, 0, 80), '<html') !== false;
    }

    private static function isNonMediaResponse(array $response)
    {
        $contentType = strtolower((string) ($response['content_type'] ?? ''));
        if (strpos($contentType, 'application/json') !== false || strpos($contentType, 'application/xml') !== false) {
            return true;
        }

        $body = ltrim((string) ($response['body'] ?? ''), "\xEF\xBB\xBF\r\n\t ");
        $prefix = strtolower(substr($body, 0, 80));
        return strpos($prefix, '<?xml') === 0
            || strpos($prefix, '<error') === 0
            || strpos($prefix, '{"') === 0
            || strpos($prefix, '[{') === 0
            || strpos($prefix, '#extm3u') === 0;
    }

    private static function normalizeResponse($response)
    {
        $response = is_array($response) ? $response : [];
        return [
            'ok' => !empty($response['ok']),
            'unsupported' => !empty($response['unsupported']),
            'timed_out' => !empty($response['timed_out']),
            'http_code' => intval($response['http_code'] ?? 0),
            'content_type' => (string) ($response['content_type'] ?? ''),
            'body' => (string) ($response['body'] ?? ''),
            'bytes' => max(0, intval($response['bytes'] ?? 0)),
            'duration_ms' => max(0, intval($response['duration_ms'] ?? 0)),
            'ttfb_ms' => max(0, intval($response['ttfb_ms'] ?? $response['duration_ms'] ?? 0)),
        ];
    }

    private static function request($url, $byteLimit, $byteOffset = 0, $timeoutSeconds = null)
    {
        $currentUrl = (string) $url;
        $timeoutSeconds = max(1, min(
            self::REQUEST_TIMEOUT_SECONDS,
            intval($timeoutSeconds ?: self::REQUEST_TIMEOUT_SECONDS)
        ));
        $startedAt = microtime(true);
        for ($redirect = 0; $redirect <= self::MAX_REDIRECTS; $redirect++) {
            $remaining = $timeoutSeconds - (microtime(true) - $startedAt);
            if ($remaining <= 0) {
                return self::timeoutResponse();
            }
            $response = self::requestOnce($currentUrl, $byteLimit, $byteOffset, intval(ceil($remaining)));
            $httpCode = intval($response['http_code'] ?? 0);
            $location = trim((string) ($response['redirect_url'] ?? ''));
            unset($response['redirect_url']);

            if ($httpCode < 300 || $httpCode >= 400) {
                return $response;
            }
            if ($location === '' || $redirect === self::MAX_REDIRECTS) {
                $response['ok'] = false;
                return $response;
            }

            $currentUrl = self::resolveUrl($currentUrl, $location);
            if (!self::isHttpUrl($currentUrl)) {
                return self::unsupportedResponse();
            }
        }

        return self::unsupportedResponse();
    }

    private static function requestOnce($url, $byteLimit, $byteOffset, $timeoutSeconds)
    {
        if (!function_exists('curl_init')) {
            return self::unsupportedResponse();
        }

        $target = self::safeTarget($url);
        if (empty($target)) {
            return self::unsupportedResponse();
        }

        $byteLimit = max(1024, min(self::SAMPLE_BYTES, intval($byteLimit)));
        $byteOffset = max(0, intval($byteOffset));
        $timeoutSeconds = max(1, min(
            self::REQUEST_TIMEOUT_SECONDS,
            intval($timeoutSeconds ?: self::REQUEST_TIMEOUT_SECONDS)
        ));
        $body = '';
        $location = '';
        $limitReached = false;
        $curl = curl_init();
        $options = [
            CURLOPT_URL => $url,
            CURLOPT_FOLLOWLOCATION => false,
            CURLOPT_RETURNTRANSFER => false,
            CURLOPT_HEADER => false,
            CURLOPT_CONNECTTIMEOUT => min(self::CONNECT_TIMEOUT_SECONDS, $timeoutSeconds),
            CURLOPT_TIMEOUT => $timeoutSeconds,
            CURLOPT_PROXY => '',
            CURLOPT_SSL_VERIFYPEER => true,
            CURLOPT_SSL_VERIFYHOST => 2,
            CURLOPT_USERAGENT => 'PingFangVideo-SourceQuality/1.0',
            CURLOPT_HTTPHEADER => [
                'Accept: application/vnd.apple.mpegurl, application/x-mpegURL, video/*, application/octet-stream;q=0.8, */*;q=0.2',
                'Accept-Encoding: identity',
                'Range: bytes=' . $byteOffset . '-' . ($byteOffset + $byteLimit - 1),
            ],
            CURLOPT_WRITEFUNCTION => static function ($handle, $chunk) use (&$body, &$limitReached, $byteLimit) {
                $remaining = $byteLimit - strlen($body);
                if ($remaining <= 0) {
                    $limitReached = true;
                    return 0;
                }
                if (strlen($chunk) > $remaining) {
                    $body .= substr($chunk, 0, $remaining);
                    $limitReached = true;
                    return 0;
                }
                $body .= $chunk;
                return strlen($chunk);
            },
            CURLOPT_HEADERFUNCTION => static function ($handle, $header) use (&$location) {
                if (stripos($header, 'Location:') === 0) {
                    $location = trim(substr($header, 9));
                }
                return strlen($header);
            },
        ];
        if (defined('CURLOPT_PROTOCOLS') && defined('CURLPROTO_HTTP') && defined('CURLPROTO_HTTPS')) {
            $options[CURLOPT_PROTOCOLS] = CURLPROTO_HTTP | CURLPROTO_HTTPS;
        }
        if (!empty($target['resolve']) && defined('CURLOPT_RESOLVE')) {
            $options[CURLOPT_RESOLVE] = [$target['resolve']];
        }

        curl_setopt_array($curl, $options);
        $executed = curl_exec($curl);
        $httpCode = intval(curl_getinfo($curl, CURLINFO_HTTP_CODE));
        $contentType = (string) curl_getinfo($curl, CURLINFO_CONTENT_TYPE);
        $durationMs = intval(round(floatval(curl_getinfo($curl, CURLINFO_TOTAL_TIME)) * 1000));
        $ttfbMs = intval(round(floatval(curl_getinfo($curl, CURLINFO_STARTTRANSFER_TIME)) * 1000));
        $curlError = curl_errno($curl);
        curl_close($curl);

        $statusOk = $httpCode >= 200 && $httpCode < 300;
        $redirect = $httpCode >= 300 && $httpCode < 400;
        $timedOut = defined('CURLE_OPERATION_TIMEDOUT') && $curlError === CURLE_OPERATION_TIMEDOUT;
        $partialTimeout = $timedOut && strlen($body) >= self::MIN_PARTIAL_BYTES;
        $transportOk = $executed !== false || ($limitReached && $curlError === CURLE_WRITE_ERROR) || $partialTimeout;

        return [
            'ok' => $transportOk && $statusOk,
            'unsupported' => false,
            'timed_out' => $timedOut,
            'http_code' => $httpCode,
            'content_type' => $contentType,
            'body' => $body,
            'bytes' => strlen($body),
            'duration_ms' => max(1, $durationMs),
            'ttfb_ms' => max(0, $ttfbMs),
            'redirect_url' => $redirect ? $location : '',
        ];
    }

    private static function safeTarget($url)
    {
        $parts = parse_url((string) $url);
        if (!is_array($parts) || empty($parts['scheme']) || empty($parts['host']) || isset($parts['user']) || isset($parts['pass'])) {
            return [];
        }

        $scheme = strtolower($parts['scheme']);
        if ($scheme !== 'http' && $scheme !== 'https') {
            return [];
        }

        $host = trim((string) $parts['host'], '[]');
        if ($host === '' || strtolower($host) === 'localhost') {
            return [];
        }
        $port = intval($parts['port'] ?? ($scheme === 'https' ? 443 : 80));
        if ($port < 1 || $port > 65535) {
            return [];
        }

        if (filter_var($host, FILTER_VALIDATE_IP)) {
            return self::isPublicIp($host) ? ['resolve' => ''] : [];
        }
        if (!preg_match('/^[a-z0-9.-]+$/i', $host)) {
            return [];
        }

        $addresses = gethostbynamel($host);
        if (!is_array($addresses) || empty($addresses)) {
            return [];
        }
        foreach ($addresses as $address) {
            if (!self::isPublicIp($address)) {
                return [];
            }
        }

        return ['resolve' => $host . ':' . $port . ':' . $addresses[0]];
    }

    private static function isPublicIp($ip)
    {
        return filter_var(
            $ip,
            FILTER_VALIDATE_IP,
            FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE
        ) !== false;
    }

    private static function unsupportedResponse()
    {
        return [
            'ok' => false,
            'unsupported' => true,
            'timed_out' => false,
            'http_code' => 0,
            'content_type' => '',
            'body' => '',
            'bytes' => 0,
            'duration_ms' => 0,
            'ttfb_ms' => 0,
        ];
    }

    private static function timeoutResponse()
    {
        return [
            'ok' => false,
            'unsupported' => false,
            'timed_out' => true,
            'http_code' => 0,
            'content_type' => '',
            'body' => '',
            'bytes' => 0,
            'duration_ms' => 0,
            'ttfb_ms' => 0,
        ];
    }

    private static function isHttpUrl($url)
    {
        return preg_match('#^https?://#i', trim((string) $url)) === 1;
    }

    private static function cleanText($value, $length)
    {
        $value = trim(strip_tags((string) $value));
        $value = str_replace(["\r", "\n", "\t"], ' ', $value);
        if (function_exists('mb_substr')) {
            return mb_substr($value, 0, $length, 'UTF-8');
        }
        return substr($value, 0, $length * 3);
    }

    private static function rowToArray($row)
    {
        if (is_object($row) && method_exists($row, 'toArray')) {
            $row = $row->toArray();
        }
        return is_array($row) ? $row : [];
    }
}
