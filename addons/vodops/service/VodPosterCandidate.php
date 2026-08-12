<?php

namespace addons\vodops\service;

use think\Db;

class VodPosterCandidate
{
    private const MAX_PROVIDER_CATALOG = 50;
    private const MAX_PROVIDERS = 8;
    private const MAX_PROVIDER_ITEMS = 50;
    private const MAX_CANDIDATES_PER_PROVIDER = 3;
    private const MAX_CANDIDATES = 12;
    private const PROVIDER_CONCURRENCY = 8;
    private const REQUEST_TIMEOUT_SECONDS = 6;
    private const JSON_MAX_BYTES = 1048576;
    private const IMAGE_MAX_BYTES = 262144;
    private const DEFAULT_PROVIDER_NAMES = '量子资源,iKun资源,虎牙资源,爱奇艺资源,魔都资源,樱花资源,无尽资源,红牛资源';
    private const PLAY_GROUP_PROVIDER_NAMES = [
        'lzm3u8' => ['量子资源', '量子'],
        'ikm3u8' => ['iKun资源', 'iKun'],
        'hhm3u8' => ['虎牙资源', '虎牙'],
        'iqym3u8' => ['爱奇艺资源', '爱奇艺'],
        'mdm3u8' => ['魔都资源', '魔都'],
        'yhm3u8' => ['樱花资源', '樱花'],
        'wjm3u8' => ['无尽资源', '无尽'],
        'hnm3u8' => ['红牛资源', '红牛'],
        'lbm3u8' => ['乐播资源', '乐播'],
    ];
    private const SENSITIVE_PROVIDER_KEYWORDS = ['黄色', '成人', '伦理', '情色', '色情', '无码', '18禁', '搜av', 'av资源', '福利'];

    public static function search(
        int $issueId,
        array $providerIds = [],
        ?callable $providerFetcher = null,
        ?callable $imageProbe = null,
        ?callable $doubanFetcher = null,
        array $context = []
    ) {
        $candidateContext = VodQualityRepair::candidateContext($issueId, $context);
        $vod = (array) ($candidateContext['vod'] ?? []);
        $fieldName = (string) ($candidateContext['field_name'] ?? '');
        $candidateKind = $fieldName === 'vod_pic' ? 'poster' : 'scalar';
        $vodName = self::singleLine($vod['vod_name'] ?? '', 255);
        if ($vodName === '') {
            throw new VodQualityRepairException('视频标题为空，无法搜索外部候选。');
        }

        $catalog = self::providerCatalog();
        $selectionInitialized = ($context['provider_selection_initialized'] ?? false) === true
            || !empty($providerIds);
        $selectionMode = 'manual';
        if ($selectionInitialized) {
            $providers = self::selectedProviders($catalog, $providerIds);
        } else {
            [$providers, $selectionMode] = self::automaticProviders($catalog, $vod);
        }
        $providerResults = [];
        if (!empty($providers)) {
            if ($providerFetcher === null) {
                $providerFetcher = [self::class, 'fetchProviderItems'];
            }
            try {
                $providerResults = (array) call_user_func($providerFetcher, $providers, $vodName);
            } catch (\Throwable $e) {
                $providerResults = [];
            }
        }

        $stats = self::providerStats($providers, $providerResults);
        $candidates = [];
        $doubanFailed = 0;

        if ($doubanFetcher === null) {
            $doubanFetcher = [DoubanData::class, 'repairCandidates'];
        }
        try {
            $doubanRows = (array) call_user_func($doubanFetcher, intval($vod['vod_id'] ?? 0));
            if (isset($doubanRows['source'])) {
                $doubanRows = [$doubanRows];
            }
            foreach ($doubanRows as $doubanRow) {
                if (!is_array($doubanRow)) {
                    continue;
                }
                $candidate = self::normalizeExternalCandidate($doubanRow, $fieldName, $vod);
                if (!empty($candidate)) {
                    $candidates[] = $candidate;
                }
            }
        } catch (\Throwable $e) {
            $doubanFailed = 1;
        }

        $candidates = array_merge(
            $candidates,
            self::collectorCandidates($vod, $fieldName, $providers, $providerResults)
        );
        $candidates = self::mergeCandidates($candidates);
        usort($candidates, static function (array $left, array $right) {
            $score = intval($right['match_score'] ?? 0) <=> intval($left['match_score'] ?? 0);
            if ($score !== 0) {
                return $score;
            }
            return strcmp((string) ($left['provider_name'] ?? ''), (string) ($right['provider_name'] ?? ''));
        });
        $candidates = array_slice($candidates, 0, self::MAX_CANDIDATES);

        if ($candidateKind === 'poster') {
            $urls = array_values(array_unique(array_column($candidates, 'value')));
            if ($imageProbe === null) {
                $imageProbe = [self::class, 'probeImages'];
            }
            try {
                $probes = (array) call_user_func($imageProbe, $urls);
            } catch (\Throwable $e) {
                $probes = [];
            }

            $verified = [];
            foreach ($candidates as $candidate) {
                $url = (string) ($candidate['value'] ?? '');
                $probe = (array) ($probes[$url] ?? []);
                if (empty($probe['ok'])) {
                    continue;
                }
                $candidate['http_code'] = intval($probe['http_code'] ?? 0);
                $candidate['content_type'] = self::singleLine($probe['content_type'] ?? '', 40);
                $verified[] = $candidate;
            }
            $candidates = $verified;
        }

        return [
            'issue_id' => intval($candidateContext['issue_id'] ?? 0),
            'issue_type' => (string) ($candidateContext['issue_type'] ?? ''),
            'field_name' => $fieldName,
            'candidate_kind' => $candidateKind,
            'context_token' => (string) ($candidateContext['context_token'] ?? ''),
            'providers_available' => count($catalog),
            'provider_options' => array_map(static function (array $provider) {
                return [
                    'provider_id' => intval($provider['provider_id'] ?? 0),
                    'provider_name' => (string) ($provider['provider_name'] ?? ''),
                ];
            }, $catalog),
            'provider_ids' => array_values(array_map(static function (array $provider) {
                return intval($provider['provider_id'] ?? 0);
            }, $providers)),
            'provider_selection_mode' => $selectionMode,
            'providers_total' => $stats['total'],
            'providers_checked' => $stats['checked'],
            'providers_failed' => $stats['failed'],
            'douban_failed' => $doubanFailed,
            'candidates' => $candidates,
        ];
    }

    public static function fetchProviderItems(array $providers, string $query): array
    {
        if (!function_exists('curl_multi_init')) {
            return self::failedProviderResults($providers);
        }

        $results = [];
        foreach (array_chunk($providers, self::PROVIDER_CONCURRENCY) as $chunk) {
            $results = array_merge($results, self::fetchProviderChunk($chunk, $query));
        }
        return $results;
    }

    public static function probeImages(array $urls): array
    {
        if (!function_exists('curl_multi_init')) {
            return [];
        }

        $results = [];
        foreach (array_chunk(array_values(array_unique($urls)), self::PROVIDER_CONCURRENCY) as $chunk) {
            $results += self::probeImageChunk($chunk);
        }
        return $results;
    }

    private static function providerCatalog()
    {
        $rows = self::rowsToArray(Db::name('collect')
            ->where('collect_type', 2)
            ->where('collect_mid', 1)
            ->order('collect_id asc')
            ->limit(self::MAX_PROVIDER_CATALOG)
            ->select());
        $providers = [];
        $seen = [];
        foreach ($rows as $row) {
            $id = intval($row['collect_id'] ?? 0);
            $url = trim((string) ($row['collect_url'] ?? ''));
            $key = strtolower(rtrim($url, '/?&'));
            if ($id < 1 || $key === '' || isset($seen[$key]) || !self::providerUrlSyntaxIsSafe($url)) {
                continue;
            }
            $seen[$key] = true;
            $providers[] = [
                'provider_id' => $id,
                'provider_name' => self::singleLine($row['collect_name'] ?? '', 80) ?: '采集源 #' . $id,
                'provider_url' => $url,
            ];
        }
        return $providers;
    }

    private static function selectedProviders(array $catalog, array $providerIds)
    {
        $catalogById = [];
        foreach ($catalog as $provider) {
            $catalogById[intval($provider['provider_id'] ?? 0)] = $provider;
        }
        $providers = [];
        $seen = [];
        foreach ($providerIds as $providerId) {
            $providerId = intval($providerId);
            if ($providerId < 1 || isset($seen[$providerId]) || empty($catalogById[$providerId])) {
                continue;
            }
            $providers[] = $catalogById[$providerId];
            $seen[$providerId] = true;
            if (count($providers) >= self::MAX_PROVIDERS) {
                break;
            }
        }
        return $providers;
    }

    private static function automaticProviders(array $catalog, array $vod)
    {
        $settings = self::candidateSettings();
        $trustedProviders = self::defaultProviders($catalog, $settings['default_providers']);
        if ($settings['follow_play_group']) {
            $providers = self::playGroupProviders($trustedProviders, (string) ($vod['vod_play_from'] ?? ''));
            if (!empty($providers)) {
                return [$providers, 'play_group'];
            }
        }

        return [$trustedProviders, 'default'];
    }

    private static function playGroupProviders(array $catalog, string $playFrom)
    {
        $providers = [];
        $seen = [];
        foreach (explode('$$$', $playFrom) as $playGroup) {
            $playGroup = self::providerNameKey($playGroup);
            if ($playGroup === '') {
                continue;
            }

            $matched = null;
            foreach (self::PLAY_GROUP_PROVIDER_NAMES[$playGroup] ?? [] as $providerName) {
                $providerName = self::providerNameKey($providerName);
                foreach ($catalog as $provider) {
                    if (self::providerIsSensitive($provider)) {
                        continue;
                    }
                    if (self::providerNameKey($provider['provider_name'] ?? '') === $providerName) {
                        $matched = $provider;
                        break 2;
                    }
                }
            }

            if ($matched === null && strlen($playGroup) >= 3) {
                foreach ($catalog as $provider) {
                    if (self::providerIsSensitive($provider)) {
                        continue;
                    }
                    $providerName = self::providerNameKey($provider['provider_name'] ?? '');
                    if ($providerName !== '' && strpos($providerName, $playGroup) === 0) {
                        $matched = $provider;
                        break;
                    }
                }
            }

            $providerId = intval($matched['provider_id'] ?? 0);
            if ($providerId < 1 || isset($seen[$providerId])) {
                continue;
            }
            $providers[] = $matched;
            $seen[$providerId] = true;
            if (count($providers) >= self::MAX_PROVIDERS) {
                break;
            }
        }
        return $providers;
    }

    private static function defaultProviders(array $catalog, array $providerNames)
    {
        $catalogByName = [];
        foreach ($catalog as $provider) {
            if (self::providerIsSensitive($provider)) {
                continue;
            }
            $name = self::providerNameKey($provider['provider_name'] ?? '');
            if ($name !== '' && !isset($catalogByName[$name])) {
                $catalogByName[$name] = $provider;
            }
        }

        $providers = [];
        $seen = [];
        foreach ($providerNames as $providerName) {
            $providerName = self::providerNameKey($providerName);
            $provider = $catalogByName[$providerName] ?? null;
            $providerId = intval($provider['provider_id'] ?? 0);
            if ($providerId < 1 || isset($seen[$providerId])) {
                continue;
            }
            $providers[] = $provider;
            $seen[$providerId] = true;
            if (count($providers) >= self::MAX_PROVIDERS) {
                break;
            }
        }
        return $providers;
    }

    private static function candidateSettings()
    {
        $config = [];
        try {
            if (function_exists('get_addon_config')) {
                $loaded = get_addon_config('vodops');
                if (is_array($loaded)) {
                    $config = $loaded;
                }
            }
        } catch (\Throwable $e) {
        }

        $follow = $config['candidate_follow_play_group'] ?? '1';
        $defaults = array_key_exists('candidate_default_providers', $config)
            ? $config['candidate_default_providers']
            : self::DEFAULT_PROVIDER_NAMES;
        return [
            'follow_play_group' => self::settingEnabled($follow),
            'default_providers' => self::providerNames($defaults),
        ];
    }

    private static function settingEnabled($value)
    {
        if (is_bool($value)) {
            return $value;
        }
        return in_array(strtolower(trim((string) $value)), ['1', 'true', 'on', 'yes'], true);
    }

    private static function providerNames($value)
    {
        if (is_array($value)) {
            $values = $value;
        } else {
            $value = str_replace(["\r", "\n", '，', '；', ';'], ',', (string) $value);
            $values = explode(',', $value);
        }
        $names = [];
        foreach ($values as $name) {
            $name = self::singleLine($name, 80);
            if ($name !== '') {
                $names[] = $name;
            }
        }
        return $names;
    }

    private static function providerIsSensitive(array $provider)
    {
        $name = self::providerNameKey($provider['provider_name'] ?? '');
        foreach (self::SENSITIVE_PROVIDER_KEYWORDS as $keyword) {
            if (strpos($name, self::providerNameKey($keyword)) !== false) {
                return true;
            }
        }
        return false;
    }

    private static function providerNameKey($value)
    {
        $value = preg_replace('/\s+/u', '', self::singleLine($value, 80));
        if (function_exists('mb_strtolower')) {
            return mb_strtolower((string) $value, 'UTF-8');
        }
        return strtolower((string) $value);
    }

    private static function providerStats(array $providers, array $results)
    {
        $allowed = array_fill_keys(array_map(static function ($provider) {
            return intval($provider['provider_id'] ?? 0);
        }, $providers), true);
        $checked = 0;
        $failed = 0;
        foreach ($results as $result) {
            $id = intval($result['provider_id'] ?? 0);
            if ($id < 1 || empty($allowed[$id])) {
                continue;
            }
            $checked++;
            if (empty($result['ok'])) {
                $failed++;
            }
        }
        if ($checked < count($providers)) {
            $failed += count($providers) - $checked;
        }
        return ['total' => count($providers), 'checked' => $checked, 'failed' => $failed];
    }

    private static function collectorCandidates(array $vod, string $fieldName, array $providers, array $results)
    {
        $providerMap = [];
        foreach ($providers as $provider) {
            $providerMap[intval($provider['provider_id'] ?? 0)] = $provider;
        }

        $vodTitle = self::normalizeTitle($vod['vod_name'] ?? '');
        $vodYear = self::normalizeExactYear($vod['vod_year'] ?? '');
        $candidates = [];
        foreach ($results as $result) {
            $providerId = intval($result['provider_id'] ?? 0);
            if (empty($result['ok']) || empty($providerMap[$providerId])) {
                continue;
            }
            $provider = $providerMap[$providerId];
            $providerCandidateCount = 0;
            $providerValues = [];
            foreach (array_slice((array) ($result['items'] ?? []), 0, self::MAX_PROVIDER_ITEMS) as $item) {
                if (!is_array($item) || self::normalizeTitle($item['vod_name'] ?? '') !== $vodTitle) {
                    continue;
                }
                $candidateYear = self::normalizeExactYear($item['vod_year'] ?? '');
                if ($vodYear !== '' && $candidateYear !== '' && $candidateYear !== $vodYear) {
                    continue;
                }
                $value = self::normalizeCandidateValue($fieldName, $item[$fieldName] ?? '');
                if ($value === '') {
                    continue;
                }
                if (isset($providerValues[$value])) {
                    continue;
                }
                $providerValues[$value] = true;
                if ($vodYear === '') {
                    $matchStatus = 'local_year_missing';
                    $matchLabel = '片名一致，本地年份缺失或无效';
                    $matchScore = 75;
                } elseif ($candidateYear === '') {
                    $matchStatus = 'year_unknown';
                    $matchLabel = '片名一致，来源未提供年份';
                    $matchScore = 80;
                } else {
                    $matchStatus = 'exact_year';
                    $matchLabel = '片名和年份一致';
                    $matchScore = 95;
                }
                $candidates[] = [
                    'value' => $value,
                    'field_name' => $fieldName,
                    'candidate_kind' => $fieldName === 'vod_pic' ? 'poster' : 'scalar',
                    'source' => 'collector',
                    'provider_id' => $providerId,
                    'provider_name' => (string) $provider['provider_name'],
                    'title' => self::singleLine($item['vod_name'] ?? '', 160),
                    'year' => $candidateYear,
                    'match_status' => $matchStatus,
                    'match_label' => $matchLabel,
                    'match_score' => $matchScore,
                ];
                if ($fieldName === 'vod_pic') {
                    $last = count($candidates) - 1;
                    $candidates[$last]['pic_url'] = $value;
                    $candidates[$last]['preview_url'] = $value;
                }
                $providerCandidateCount++;
                if ($providerCandidateCount >= self::MAX_CANDIDATES_PER_PROVIDER) {
                    break;
                }
            }
        }
        return $candidates;
    }

    private static function normalizeExternalCandidate(array $candidate, string $fieldName, array $vod)
    {
        $values = is_array($candidate['values'] ?? null) ? $candidate['values'] : [];
        $rawValue = $values[$fieldName] ?? ($fieldName === 'vod_pic' ? ($candidate['pic_url'] ?? ($candidate['pic'] ?? '')) : ($candidate[$fieldName] ?? ''));
        $value = self::normalizeCandidateValue($fieldName, $rawValue);
        $source = (string) ($candidate['source'] ?? '');
        $title = self::singleLine($candidate['title'] ?? '', 160);
        $localYear = self::normalizeExactYear($vod['vod_year'] ?? '');
        $candidateYear = self::normalizeExactYear($candidate['year'] ?? ($values['vod_year'] ?? ''));
        if ($value === '' || $source !== 'douban'
            || self::normalizeTitle($title) !== self::normalizeTitle($vod['vod_name'] ?? '')
            || ($localYear !== '' && $candidateYear !== '' && $candidateYear !== $localYear)) {
            return [];
        }
        $normalized = [
            'value' => $value,
            'field_name' => $fieldName,
            'candidate_kind' => $fieldName === 'vod_pic' ? 'poster' : 'scalar',
            'source' => $source,
            'provider_id' => max(0, intval($candidate['provider_id'] ?? 0)),
            'provider_name' => self::singleLine($candidate['provider_name'] ?? '', 80) ?: '豆瓣',
            'title' => $title,
            'year' => $candidateYear,
            'match_status' => self::singleLine($candidate['match_status'] ?? '', 32),
            'match_label' => self::singleLine($candidate['match_label'] ?? '', 80),
            'match_score' => max(0, min(100, intval($candidate['match_score'] ?? 0))),
        ];
        if ($fieldName === 'vod_pic') {
            $normalized['pic_url'] = $value;
            $normalized['preview_url'] = $value;
        }
        return $normalized;
    }

    private static function mergeCandidates(array $candidates)
    {
        $merged = [];
        foreach ($candidates as $candidate) {
            $value = (string) ($candidate['value'] ?? '');
            if ($value === '') {
                continue;
            }
            if (!isset($merged[$value])) {
                $candidate['_provider_names'] = [(string) ($candidate['provider_name'] ?? '')];
                $merged[$value] = $candidate;
                continue;
            }
            $names = $merged[$value]['_provider_names'] ?? [];
            $names[] = (string) ($candidate['provider_name'] ?? '');
            $merged[$value]['_provider_names'] = array_values(array_unique(array_filter($names)));
            if (intval($candidate['match_score'] ?? 0) > intval($merged[$value]['match_score'] ?? 0)) {
                $names = $merged[$value]['_provider_names'];
                $merged[$value] = array_merge($merged[$value], $candidate);
                $merged[$value]['_provider_names'] = $names;
            }
        }
        foreach ($merged as &$candidate) {
            $candidate['provider_name'] = implode('、', (array) ($candidate['_provider_names'] ?? []));
            unset($candidate['_provider_names']);
        }
        unset($candidate);
        return array_values($merged);
    }

    private static function fetchProviderChunk(array $providers, string $query)
    {
        $multi = curl_multi_init();
        $handles = [];
        $buffers = [];
        $tooLarge = [];
        $results = [];

        foreach ($providers as $provider) {
            $id = intval($provider['provider_id'] ?? 0);
            $url = self::providerSearchUrl((string) ($provider['provider_url'] ?? ''), $query);
            $target = self::publicTarget($url, false);
            if ($id < 1 || $target === null) {
                $results[] = self::providerResult($provider, false, []);
                continue;
            }
            $buffers[$id] = '';
            $tooLarge[$id] = false;
            $handle = curl_init($url);
            if ($handle === false) {
                $results[] = self::providerResult($provider, false, []);
                continue;
            }
            curl_setopt_array($handle, [
                CURLOPT_HTTPGET => true,
                CURLOPT_HEADER => false,
                CURLOPT_RETURNTRANSFER => false,
                CURLOPT_FOLLOWLOCATION => false,
                CURLOPT_CONNECTTIMEOUT => 3,
                CURLOPT_TIMEOUT => self::REQUEST_TIMEOUT_SECONDS,
                CURLOPT_NOSIGNAL => true,
                CURLOPT_ENCODING => '',
                CURLOPT_PROXY => '',
                CURLOPT_HTTPHEADER => ['Accept: application/json'],
                CURLOPT_USERAGENT => 'SquaredMedia-VodOps/1.2',
                CURLOPT_SSL_VERIFYPEER => true,
                CURLOPT_SSL_VERIFYHOST => 2,
                CURLOPT_RESOLVE => [$target['resolve']],
                CURLOPT_WRITEFUNCTION => static function ($curl, $chunk) use (&$buffers, &$tooLarge, $id) {
                    if (strlen($buffers[$id]) + strlen($chunk) > self::JSON_MAX_BYTES) {
                        $tooLarge[$id] = true;
                        return 0;
                    }
                    $buffers[$id] .= $chunk;
                    return strlen($chunk);
                },
            ]);
            curl_multi_add_handle($multi, $handle);
            $handles[$id] = ['handle' => $handle, 'provider' => $provider];
        }

        self::runMulti($multi);
        foreach ($handles as $id => $entry) {
            $handle = $entry['handle'];
            $status = intval(curl_getinfo($handle, CURLINFO_HTTP_CODE));
            $error = curl_errno($handle);
            $decoded = !$tooLarge[$id] && $error === 0 && $status >= 200 && $status < 300
                ? json_decode($buffers[$id], true)
                : null;
            $items = is_array($decoded) && is_array($decoded['list'] ?? null) ? $decoded['list'] : [];
            $results[] = self::providerResult($entry['provider'], is_array($decoded) && isset($decoded['list']), $items);
            curl_multi_remove_handle($multi, $handle);
            curl_close($handle);
        }
        curl_multi_close($multi);
        return $results;
    }

    private static function probeImageChunk(array $urls)
    {
        $multi = curl_multi_init();
        $handles = [];
        $buffers = [];
        $tooLarge = [];
        $results = [];

        foreach ($urls as $url) {
            $url = self::normalizePosterUrl($url);
            $target = $url === '' ? null : self::publicTarget($url, true);
            if ($target === null) {
                continue;
            }
            $buffers[$url] = '';
            $tooLarge[$url] = false;
            $handle = curl_init($url);
            if ($handle === false) {
                continue;
            }
            curl_setopt_array($handle, [
                CURLOPT_HTTPGET => true,
                CURLOPT_HEADER => false,
                CURLOPT_RETURNTRANSFER => false,
                CURLOPT_FOLLOWLOCATION => false,
                CURLOPT_CONNECTTIMEOUT => 3,
                CURLOPT_TIMEOUT => self::REQUEST_TIMEOUT_SECONDS,
                CURLOPT_NOSIGNAL => true,
                CURLOPT_ENCODING => '',
                CURLOPT_PROXY => '',
                CURLOPT_RANGE => '0-' . (self::IMAGE_MAX_BYTES - 1),
                CURLOPT_HTTPHEADER => ['Accept: image/avif,image/webp,image/png,image/jpeg,image/gif'],
                CURLOPT_USERAGENT => 'Mozilla/5.0 SquaredMedia-VodOps/1.2',
                CURLOPT_SSL_VERIFYPEER => true,
                CURLOPT_SSL_VERIFYHOST => 2,
                CURLOPT_RESOLVE => [$target['resolve']],
                CURLOPT_WRITEFUNCTION => static function ($curl, $chunk) use (&$buffers, &$tooLarge, $url) {
                    $remaining = self::IMAGE_MAX_BYTES - strlen($buffers[$url]);
                    if ($remaining <= 0) {
                        $tooLarge[$url] = true;
                        return 0;
                    }
                    $buffers[$url] .= substr($chunk, 0, $remaining);
                    if (strlen($chunk) > $remaining) {
                        $tooLarge[$url] = true;
                        return 0;
                    }
                    return strlen($chunk);
                },
            ]);
            curl_multi_add_handle($multi, $handle);
            $handles[$url] = $handle;
        }

        self::runMulti($multi);
        foreach ($handles as $url => $handle) {
            $status = intval(curl_getinfo($handle, CURLINFO_HTTP_CODE));
            $contentType = strtolower(trim((string) curl_getinfo($handle, CURLINFO_CONTENT_TYPE)));
            $contentType = trim(explode(';', $contentType)[0]);
            $curlOk = curl_errno($handle) === 0 || !empty($tooLarge[$url]);
            $ok = $curlOk && in_array($status, [200, 206], true)
                && self::allowedImageType($contentType)
                && self::matchesImageMagic($contentType, $buffers[$url]);
            $results[$url] = [
                'ok' => $ok,
                'http_code' => $status,
                'content_type' => $contentType,
            ];
            curl_multi_remove_handle($multi, $handle);
            curl_close($handle);
        }
        curl_multi_close($multi);
        return $results;
    }

    private static function runMulti($multi)
    {
        do {
            $status = curl_multi_exec($multi, $running);
            if ($running > 0) {
                $selected = curl_multi_select($multi, 1.0);
                if ($selected === -1) {
                    usleep(10000);
                }
            }
        } while ($running > 0 && $status === CURLM_OK);
    }

    private static function failedProviderResults(array $providers)
    {
        return array_map(static function ($provider) {
            return self::providerResult($provider, false, []);
        }, $providers);
    }

    private static function providerResult(array $provider, $ok, array $items)
    {
        return [
            'provider_id' => intval($provider['provider_id'] ?? 0),
            'provider_name' => (string) ($provider['provider_name'] ?? ''),
            'ok' => (bool) $ok,
            'items' => array_slice($items, 0, self::MAX_PROVIDER_ITEMS),
        ];
    }

    private static function providerSearchUrl($baseUrl, $query)
    {
        $baseUrl = rtrim((string) $baseUrl, '?&');
        return $baseUrl . (strpos($baseUrl, '?') === false ? '?' : '&') . http_build_query([
            'ac' => 'detail',
            'wd' => (string) $query,
        ]);
    }

    private static function publicTarget($url, $httpsOnly)
    {
        static $targetCache = [];
        $url = trim((string) $url);
        if ($url === '' || strlen($url) > 2048 || preg_match('/[\x00-\x20\x7F]/', $url)) {
            return null;
        }
        $parts = parse_url($url);
        if (!is_array($parts) || empty($parts['host']) || isset($parts['user']) || isset($parts['pass']) || isset($parts['fragment'])) {
            return null;
        }
        $scheme = strtolower((string) ($parts['scheme'] ?? ''));
        if (($httpsOnly && $scheme !== 'https') || (!$httpsOnly && !in_array($scheme, ['http', 'https'], true))) {
            return null;
        }
        $host = strtolower(rtrim((string) $parts['host'], '.'));
        if ($host === '' || $host === 'localhost' || substr($host, -10) === '.localhost') {
            return null;
        }
        $port = intval($parts['port'] ?? ($scheme === 'https' ? 443 : 80));
        if ($port < 1 || $port > 65535) {
            return null;
        }
        $cacheKey = $scheme . '|' . $host . '|' . $port;
        if (array_key_exists($cacheKey, $targetCache)) {
            return $targetCache[$cacheKey] === false ? null : $targetCache[$cacheKey];
        }
        $addresses = filter_var($host, FILTER_VALIDATE_IP) ? [$host] : @gethostbynamel($host);
        if (!is_array($addresses) || empty($addresses)) {
            $targetCache[$cacheKey] = false;
            return null;
        }
        foreach ($addresses as $address) {
            if (!filter_var($address, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE)) {
                $targetCache[$cacheKey] = false;
                return null;
            }
        }
        $targetCache[$cacheKey] = [
            'resolve' => $host . ':' . $port . ':' . $addresses[0],
        ];
        return $targetCache[$cacheKey];
    }

    private static function providerUrlSyntaxIsSafe($url)
    {
        $url = trim((string) $url);
        if ($url === '' || strlen($url) > 2048 || preg_match('/[\x00-\x20\x7F]/', $url)) {
            return false;
        }
        $parts = parse_url($url);
        if (!is_array($parts) || empty($parts['host']) || isset($parts['user']) || isset($parts['pass']) || isset($parts['fragment'])) {
            return false;
        }
        $scheme = strtolower((string) ($parts['scheme'] ?? ''));
        if (!in_array($scheme, ['http', 'https'], true)) {
            return false;
        }
        $host = strtolower(trim((string) $parts['host'], '[]'));
        if ($host === '' || $host === 'localhost' || substr($host, -10) === '.localhost') {
            return false;
        }
        if (filter_var($host, FILTER_VALIDATE_IP)) {
            if (!filter_var($host, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE)) {
                return false;
            }
        } elseif (strlen($host) > 253 || strpos($host, '.') === false
            || !preg_match('/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i', $host)) {
            return false;
        }
        $port = intval($parts['port'] ?? ($scheme === 'https' ? 443 : 80));
        return $port >= 1 && $port <= 65535;
    }

    private static function normalizePosterUrl($value)
    {
        $url = trim(html_entity_decode((string) $value, ENT_QUOTES | ENT_HTML5, 'UTF-8'));
        if (strpos($url, '//') === 0) {
            $url = 'https:' . $url;
        } elseif (stripos($url, 'http://') === 0) {
            $url = 'https://' . substr($url, 7);
        }
        if (strlen($url) > 255 || stripos($url, 'https://') !== 0) {
            return '';
        }
        $parts = parse_url($url);
        if (!is_array($parts) || empty($parts['host']) || isset($parts['user']) || isset($parts['pass']) || isset($parts['fragment'])) {
            return '';
        }
        $host = strtolower(rtrim((string) $parts['host'], '.'));
        if ($host === 'localhost' || substr($host, -10) === '.localhost') {
            return '';
        }
        if (filter_var($host, FILTER_VALIDATE_IP)
            && !filter_var($host, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE)) {
            return '';
        }
        return preg_match('/[\x00-\x20\x7F]/', $url) ? '' : $url;
    }

    private static function normalizeTitle($value)
    {
        $value = html_entity_decode(strip_tags((string) $value), ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $value = function_exists('mb_strtolower') ? mb_strtolower(trim($value), 'UTF-8') : strtolower(trim($value));
        return preg_replace('/[\p{P}\p{S}\s\x{3000}]+/u', '', $value) ?: '';
    }

    private static function normalizeExactYear($value)
    {
        $value = trim((string) $value);
        return preg_match('/^(?:18|19|20)\d{2}$/D', $value) ? $value : '';
    }

    private static function normalizeCandidateValue(string $fieldName, $value)
    {
        if ($fieldName === 'vod_pic') {
            return self::normalizePosterUrl($value);
        }
        $value = self::singleLine($value, 255);
        if ($fieldName === 'vod_year') {
            return preg_match('/^(?:18|19|20)\d{2}$/D', $value) ? $value : '';
        }
        $limit = $fieldName === 'vod_area' ? 20 : ($fieldName === 'vod_lang' ? 10 : 0);
        if ($limit < 1) {
            return '';
        }
        $length = function_exists('mb_strlen') ? mb_strlen($value, 'UTF-8') : strlen($value);
        return $value !== '' && $value !== '0' && $length <= $limit ? $value : '';
    }

    private static function allowedImageType($contentType)
    {
        return in_array($contentType, ['image/jpeg', 'image/png', 'image/webp', 'image/gif'], true);
    }

    private static function matchesImageMagic($contentType, $body)
    {
        $body = (string) $body;
        if ($contentType === 'image/jpeg') {
            return substr($body, 0, 3) === "\xFF\xD8\xFF";
        }
        if ($contentType === 'image/png') {
            return substr($body, 0, 8) === "\x89PNG\r\n\x1A\n";
        }
        if ($contentType === 'image/gif') {
            return in_array(substr($body, 0, 6), ['GIF87a', 'GIF89a'], true);
        }
        if ($contentType === 'image/webp') {
            return substr($body, 0, 4) === 'RIFF' && substr($body, 8, 4) === 'WEBP';
        }
        return false;
    }

    private static function singleLine($value, $limit)
    {
        $value = trim(strip_tags((string) $value));
        $value = str_replace(["\0", "\r", "\n", "\t"], ' ', $value);
        if (function_exists('mb_substr')) {
            return mb_substr($value, 0, intval($limit), 'UTF-8');
        }
        return substr($value, 0, intval($limit));
    }

    private static function rowsToArray($rows)
    {
        if (is_array($rows)) {
            return $rows;
        }
        if ($rows instanceof \Traversable) {
            return iterator_to_array($rows, false);
        }
        return [];
    }
}
