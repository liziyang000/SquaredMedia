#!/usr/bin/env php
<?php

declare(strict_types=1);

function poster_repair_local_pic_path(string $pic, string $root): ?string
{
    $root = rtrim($root, '/');
    $path = trim($pic);
    if ($root === '' || $path === '' || preg_match('/^[a-z][a-z0-9+.-]*:/i', $path) === 1 || str_starts_with($path, '//')) {
        return null;
    }
    $path = str_replace('\\', '/', preg_replace('/[?#].*$/', '', $path) ?? '');
    $relative = ltrim($path, '/');
    if ($relative === '' || in_array('..', explode('/', $relative), true)) {
        return null;
    }

    return $root . '/' . $relative;
}

function poster_repair_is_target_pic(?string $pic, string $root = '', bool $relativePicsAreRemote = false): bool
{
    $pic = trim((string) $pic);
    if ($pic === '') {
        return true;
    }
    if (preg_match('/^https?:\/\//i', $pic) === 1 || str_starts_with($pic, '//') || str_starts_with(strtolower($pic), 'mac:')) {
        return false;
    }
    $localPath = poster_repair_local_pic_path($pic, $root);
    if ($localPath !== null) {
        if ($relativePicsAreRemote && !str_starts_with($pic, '/')) {
            return false;
        }
        return !is_file($localPath);
    }

    return true;
}

function poster_repair_uses_remote_upload(string $root): bool
{
    $configFile = rtrim($root, '/') . '/application/extra/maccms.php';
    if (!is_file($configFile)) {
        return false;
    }
    $config = include $configFile;

    return is_array($config) && strtolower((string) ($config['upload']['mode'] ?? '')) === 'remote';
}

function poster_repair_normalize_title(string $title): string
{
    $title = html_entity_decode(strip_tags($title), ENT_QUOTES | ENT_HTML5, 'UTF-8');
    $title = mb_strtolower(trim($title), 'UTF-8');

    return preg_replace('/[\p{P}\p{S}\s\x{3000}]+/u', '', $title) ?? '';
}

function poster_repair_search_terms(string $title): array
{
    $title = trim($title);
    $terms = $title === '' ? [] : [$title];
    if (preg_match('/^[A-Z0-9]+-\d+/i', $title, $matches) === 1 && strcasecmp($matches[0], $title) !== 0) {
        $terms[] = $matches[0];
    }

    return array_values(array_unique($terms));
}

function poster_repair_normalize_year(string $year): string
{
    return preg_match('/(?:19|20)\d{2}/', $year, $matches) === 1 ? $matches[0] : '';
}

function poster_repair_normalize_pic_url(string $url): string
{
    $url = trim(html_entity_decode($url, ENT_QUOTES | ENT_HTML5, 'UTF-8'));
    if (str_starts_with($url, '//')) {
        $url = 'https:' . $url;
    }

    return preg_match('/^https?:\/\//i', $url) === 1 ? $url : '';
}

function poster_repair_pick_candidate(string $title, string $year, array $items): ?array
{
    $normalizedTitle = poster_repair_normalize_title($title);
    $normalizedYear = poster_repair_normalize_year($year);
    if ($normalizedTitle === '') {
        return null;
    }

    $matches = [];
    foreach ($items as $item) {
        if (!is_array($item) || poster_repair_normalize_title((string) ($item['vod_name'] ?? '')) !== $normalizedTitle) {
            continue;
        }
        $candidateYear = poster_repair_normalize_year((string) ($item['vod_year'] ?? ''));
        if ($normalizedYear !== '' && $candidateYear !== '' && $candidateYear !== $normalizedYear) {
            continue;
        }
        $pic = poster_repair_normalize_pic_url((string) ($item['vod_pic'] ?? ''));
        if ($pic === '') {
            continue;
        }
        $item['vod_pic'] = $pic;
        $item['_normalized_year'] = $candidateYear;
        $matches[] = $item;
    }

    $uniqueMatches = [];
    foreach ($matches as $match) {
        $pic = $match['vod_pic'];
        if (!isset($uniqueMatches[$pic]) || ($uniqueMatches[$pic]['_normalized_year'] === '' && $match['_normalized_year'] !== '')) {
            $uniqueMatches[$pic] = $match;
        }
    }
    $matches = array_values($uniqueMatches);

    if ($normalizedYear !== '') {
        $sameYear = array_values(array_filter($matches, static function (array $item) use ($normalizedYear): bool {
            return $item['_normalized_year'] === $normalizedYear;
        }));
        if (count($sameYear) === 1) {
            unset($sameYear[0]['_normalized_year']);

            return $sameYear[0];
        }
        if (count($sameYear) > 1) {
            return null;
        }
    }

    if (count($matches) !== 1) {
        return null;
    }
    unset($matches[0]['_normalized_year']);

    return $matches[0];
}

function poster_repair_douban_candidate(string $expectedId, array $payload): ?array
{
    $expectedId = preg_replace('/\D+/', '', $expectedId) ?? '';
    $returnedId = preg_replace('/\D+/', '', (string) ($payload['id'] ?? '')) ?? '';
    if ($expectedId === '' || $returnedId !== $expectedId) {
        return null;
    }
    $pic = is_array($payload['pic'] ?? null) ? $payload['pic'] : [];
    $url = poster_repair_normalize_pic_url((string) ($payload['cover_url'] ?? ($pic['large'] ?? ($pic['normal'] ?? ''))));

    return $url === '' ? null : ['vod_pic' => $url];
}

function poster_repair_bangumi_items(array $payload): array
{
    $items = [];
    $data = is_array($payload['data'] ?? null) ? $payload['data'] : [];
    foreach ($data as $item) {
        if (!is_array($item)) {
            continue;
        }
        $images = is_array($item['images'] ?? null) ? $item['images'] : [];
        $pic = (string) ($item['image'] ?? ($images['large'] ?? ($images['common'] ?? '')));
        foreach (array_unique([(string) ($item['name_cn'] ?? ''), (string) ($item['name'] ?? '')]) as $name) {
            if (trim($name) === '') {
                continue;
            }
            $items[] = [
                'vod_name' => $name,
                'vod_year' => (string) ($item['date'] ?? ''),
                'vod_pic' => $pic,
                'bangumi_id' => (int) ($item['id'] ?? 0),
            ];
        }
    }

    return $items;
}

function poster_repair_is_bangumi_type(array $vod, int $typeId): bool
{
    return $typeId > 0 && ((int) ($vod['type_id'] ?? 0) === $typeId || (int) ($vod['type_pid'] ?? 0) === $typeId);
}

function poster_repair_report_match(array $row, string $root = '', bool $relativePicsAreRemote = false): ?array
{
    $vodId = (int) ($row['vod_id'] ?? 0);
    $pic = poster_repair_normalize_pic_url((string) ($row['new_pic'] ?? ''));
    $oldPic = (string) ($row['old_pic'] ?? '');
    if ($vodId < 1 || ($row['status'] ?? '') !== 'would_update' || $pic === '' || !poster_repair_is_target_pic($oldPic, $root, $relativePicsAreRemote)) {
        return null;
    }

    return [
        'vod_id' => $vodId,
        'vod_pic' => $pic,
        'old_pic' => $oldPic,
        'provider_id' => (int) ($row['provider_id'] ?? 0),
        'provider_name' => (string) ($row['provider_name'] ?? ''),
        'term_kind' => (string) ($row['term_kind'] ?? ''),
    ];
}

function poster_repair_update_sql(string $vodTable): string
{
    return "UPDATE {$vodTable} SET vod_pic=? WHERE vod_id=? AND BINARY COALESCE(vod_pic,'')=BINARY ?";
}

function poster_repair_open_report(string $reportPath)
{
    $report = @fopen($reportPath, 'xb');
    if ($report === false) {
        throw new RuntimeException("Report path already exists or cannot be created: {$reportPath}");
    }

    return $report;
}

function poster_repair_encode_json(array $value, bool $pretty = false): string
{
    $flags = JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE | JSON_THROW_ON_ERROR;
    if ($pretty) {
        $flags |= JSON_PRETTY_PRINT;
    }

    return json_encode($value, $flags);
}

function poster_repair_write_report($report, array $row): void
{
    if (!is_resource($report)) {
        throw new RuntimeException('Report handle is not writable.');
    }
    $line = poster_repair_encode_json($row) . "\n";
    $offset = 0;
    $length = strlen($line);
    while ($offset < $length) {
        $written = fwrite($report, substr($line, $offset));
        if ($written === false || $written === 0) {
            throw new RuntimeException('Unable to write the report file.');
        }
        $offset += $written;
    }
}

function poster_repair_load_report(string $inputPath, string $root = '', bool $relativePicsAreRemote = false): array
{
    $input = @fopen($inputPath, 'rb');
    if ($input === false) {
        throw new RuntimeException("Unable to open dry-run report: {$inputPath}");
    }

    $matches = [];
    $lineNumber = 0;
    try {
        while (($line = fgets($input)) !== false) {
            $lineNumber++;
            try {
                $row = json_decode($line, true, 512, JSON_THROW_ON_ERROR);
            } catch (JsonException $error) {
                throw new RuntimeException("Invalid JSON in dry-run report at line {$lineNumber}.", 0, $error);
            }
            if (!is_array($row)) {
                throw new RuntimeException("Dry-run report row {$lineNumber} must be a JSON object.");
            }
            $match = poster_repair_report_match($row, $root, $relativePicsAreRemote);
            if ($match === null) {
                continue;
            }
            $vodId = $match['vod_id'];
            if (isset($matches[$vodId]) && $matches[$vodId] !== $match) {
                throw new RuntimeException("Conflicting dry-run report mappings for vod_id {$vodId}.");
            }
            $matches[$vodId] = $match;
        }
    } finally {
        fclose($input);
    }

    return $matches;
}

function poster_repair_quote_identifier(string $identifier): string
{
    return '`' . str_replace('`', '``', $identifier) . '`';
}

function poster_repair_database(string $root): array
{
    $databaseFile = rtrim($root, '/') . '/application/database.php';
    if (!is_file($databaseFile)) {
        throw new RuntimeException("MacCMS database config is missing: {$databaseFile}");
    }
    $config = include $databaseFile;
    if (!is_array($config)) {
        throw new RuntimeException('MacCMS database config must return an array.');
    }
    $dsn = !empty($config['dsn']) ? (string) $config['dsn'] : sprintf(
        'mysql:host=%s;port=%s;dbname=%s;charset=%s',
        $config['hostname'] ?? '127.0.0.1',
        $config['hostport'] ?? '3306',
        $config['database'] ?? '',
        $config['charset'] ?? 'utf8'
    );
    $pdo = new PDO($dsn, (string) ($config['username'] ?? ''), (string) ($config['password'] ?? ''), [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);

    return [$pdo, (string) ($config['prefix'] ?? '')];
}

function poster_repair_load_providers(PDO $pdo, string $prefix): array
{
    $table = poster_repair_quote_identifier($prefix . 'collect');
    $rows = $pdo->query(
        "SELECT collect_id,collect_name,collect_url FROM {$table} " .
        'WHERE collect_type=2 AND collect_mid=1 ORDER BY collect_id'
    )->fetchAll();
    $providers = [];
    foreach ($rows as $row) {
        $url = trim((string) ($row['collect_url'] ?? ''));
        if (preg_match('/^https?:\/\//i', $url) !== 1) {
            continue;
        }
        $key = strtolower(rtrim($url, '/?&'));
        if (isset($providers[$key])) {
            continue;
        }
        $providers[$key] = [
            'id' => (int) $row['collect_id'],
            'name' => (string) $row['collect_name'],
            'url' => $url,
        ];
    }

    return array_values($providers);
}

function poster_repair_provider_order(array $providers, array $vod): array
{
    $playFrom = strtolower((string) ($vod['vod_play_from'] ?? ''));
    $adult = (int) ($vod['type_pid'] ?? 0) === 112;
    $hints = [
        'ikm3u8' => 'ikun',
        'iqym3u8' => '爱奇艺',
        'hhm3u8' => '虎牙',
        'yhm3u8' => '樱花',
        'lzm3u8' => '量子',
        's8m3u8' => '黄色',
        'souav' => '黄色',
    ];
    foreach ($providers as &$provider) {
        $priority = $provider['id'];
        if ($adult && str_contains($provider['name'], '黄色')) {
            $priority -= 1000;
        }
        foreach ($hints as $token => $providerName) {
            if (str_contains($playFrom, $token) && stripos($provider['name'], $providerName) !== false) {
                $priority -= 2000;
            }
        }
        $provider['_priority'] = $priority;
    }
    unset($provider);
    usort($providers, static function (array $left, array $right): int {
        return $left['_priority'] <=> $right['_priority'];
    });
    foreach ($providers as &$provider) {
        unset($provider['_priority']);
    }
    unset($provider);

    return $providers;
}

function poster_repair_search_url(string $baseUrl, string $term): string
{
    $baseUrl = rtrim($baseUrl, '?&');

    return $baseUrl . (str_contains($baseUrl, '?') ? '&' : '?') . http_build_query([
        'ac' => 'detail',
        'wd' => $term,
    ]);
}

function poster_repair_multi_fetch(array $requests, int $concurrency, int $timeout): array
{
    $results = [];
    foreach (array_chunk($requests, $concurrency, true) as $chunk) {
        $multi = curl_multi_init();
        $handles = [];
        foreach ($chunk as $key => $request) {
            $url = is_array($request) ? (string) ($request['url'] ?? '') : (string) $request;
            $handle = curl_init($url);
            $headers = is_array($request) && is_array($request['headers'] ?? null) ? $request['headers'] : [
                'Accept: application/json',
                'Referer: https://movie.douban.com/',
                'User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/126 Safari/537.36',
            ];
            $options = [
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_FOLLOWLOCATION => true,
                CURLOPT_MAXREDIRS => 3,
                CURLOPT_PROTOCOLS => CURLPROTO_HTTP | CURLPROTO_HTTPS,
                CURLOPT_REDIR_PROTOCOLS => CURLPROTO_HTTP | CURLPROTO_HTTPS,
                CURLOPT_CONNECTTIMEOUT => min(5, $timeout),
                CURLOPT_TIMEOUT => $timeout,
                CURLOPT_NOSIGNAL => true,
                CURLOPT_ENCODING => '',
                CURLOPT_HTTPHEADER => $headers,
            ];
            if (is_array($request) && array_key_exists('body', $request)) {
                $options[CURLOPT_POST] = true;
                $options[CURLOPT_POSTFIELDS] = (string) $request['body'];
            }
            curl_setopt_array($handle, $options);
            curl_multi_add_handle($multi, $handle);
            $handles[(string) $key] = $handle;
        }

        do {
            $status = curl_multi_exec($multi, $running);
            if ($running > 0) {
                $selected = curl_multi_select($multi, 1.0);
                if ($selected === -1) {
                    usleep(10000);
                }
            }
        } while ($running > 0 && $status === CURLM_OK);

        foreach ($handles as $key => $handle) {
            $results[$key] = [
                'body' => (string) curl_multi_getcontent($handle),
                'status' => (int) curl_getinfo($handle, CURLINFO_HTTP_CODE),
                'error' => curl_error($handle),
            ];
            curl_multi_remove_handle($multi, $handle);
            curl_close($handle);
        }
        curl_multi_close($multi);
    }

    return $results;
}

function poster_repair_find_douban_matches(array $vods, int $concurrency, int $timeout): array
{
    $requests = [];
    $ids = [];
    foreach ($vods as $vod) {
        $vodId = (int) $vod['vod_id'];
        $doubanId = preg_replace('/\D+/', '', (string) ($vod['vod_douban_id'] ?? '')) ?? '';
        if ($doubanId === '' || ltrim($doubanId, '0') === '') {
            continue;
        }
        $ids[$vodId] = $doubanId;
        $requests[(string) $vodId] = 'https://m.douban.com/rexxar/api/v2/movie/' . rawurlencode($doubanId);
    }
    if ($requests === []) {
        return [];
    }

    $matches = [];
    $pending = $requests;
    for ($attempt = 1; $attempt <= 2 && $pending !== []; $attempt++) {
        $attemptRequested = count($pending);
        $retry = [];
        $processed = 0;
        foreach (array_chunk($pending, 20, true) as $chunk) {
            foreach (poster_repair_multi_fetch($chunk, min(2, $concurrency), $timeout) as $vodId => $response) {
                if ($response['status'] < 200 || $response['status'] >= 300 || $response['body'] === '') {
                    $retry[(string) $vodId] = $requests[(string) $vodId];
                    continue;
                }
                $payload = json_decode($response['body'], true);
                if (!is_array($payload)) {
                    $retry[(string) $vodId] = $requests[(string) $vodId];
                    continue;
                }
                $candidate = poster_repair_douban_candidate($ids[(int) $vodId], $payload);
                if ($candidate === null) {
                    continue;
                }
                $matches[(int) $vodId] = [
                    'vod_pic' => $candidate['vod_pic'],
                    'provider_id' => 0,
                    'provider_name' => '豆瓣',
                    'term_kind' => 'douban_id',
                ];
            }
            $processed += count($chunk);
            fwrite(STDERR, sprintf(
                "douban_attempt=%d progress=%d/%d resolved=%d retry=%d\n",
                $attempt,
                $processed,
                $attemptRequested,
                count($matches),
                count($retry)
            ));
            usleep(200000);
        }
        $pending = $retry;
        fwrite(STDERR, sprintf(
            "douban_attempt=%d requested=%d resolved=%d remaining=%d\n",
            $attempt,
            $attemptRequested,
            count($matches),
            count($pending)
        ));
    }

    return $matches;
}

function poster_repair_find_matches(array $vods, array $providers, int $providerRounds, int $concurrency, int $timeout): array
{
    $resolved = [];
    $orderedProviders = [];
    $terms = [];
    $maxTerms = 0;
    foreach ($vods as $vod) {
        $vodId = (int) $vod['vod_id'];
        $orderedProviders[$vodId] = poster_repair_provider_order($providers, $vod);
        $terms[$vodId] = poster_repair_search_terms((string) $vod['vod_name']);
        $maxTerms = max($maxTerms, count($terms[$vodId]));
    }

    for ($termIndex = 0; $termIndex < $maxTerms; $termIndex++) {
        for ($providerIndex = 0; $providerIndex < min($providerRounds, count($providers)); $providerIndex++) {
            $requests = [];
            $requestMeta = [];
            foreach ($vods as $vod) {
                $vodId = (int) $vod['vod_id'];
                if (isset($resolved[$vodId]) || !isset($terms[$vodId][$termIndex], $orderedProviders[$vodId][$providerIndex])) {
                    continue;
                }
                $provider = $orderedProviders[$vodId][$providerIndex];
                $requests[(string) $vodId] = poster_repair_search_url($provider['url'], $terms[$vodId][$termIndex]);
                $requestMeta[$vodId] = $provider;
            }
            if ($requests === []) {
                continue;
            }

            $responses = poster_repair_multi_fetch($requests, $concurrency, $timeout);
            foreach ($vods as $vod) {
                $vodId = (int) $vod['vod_id'];
                if (isset($resolved[$vodId]) || !isset($responses[(string) $vodId])) {
                    continue;
                }
                $response = $responses[(string) $vodId];
                if ($response['status'] < 200 || $response['status'] >= 300 || $response['body'] === '') {
                    continue;
                }
                $payload = json_decode($response['body'], true);
                $items = is_array($payload) && is_array($payload['list'] ?? null) ? $payload['list'] : [];
                $candidate = poster_repair_pick_candidate((string) $vod['vod_name'], (string) $vod['vod_year'], $items);
                if ($candidate === null) {
                    continue;
                }
                $provider = $requestMeta[$vodId];
                $resolved[$vodId] = [
                    'vod_pic' => $candidate['vod_pic'],
                    'provider_id' => $provider['id'],
                    'provider_name' => $provider['name'],
                    'term_kind' => $termIndex === 0 ? 'title' : 'catalog_code',
                ];
            }
            fwrite(STDERR, sprintf(
                "term=%d provider_round=%d requested=%d resolved=%d remaining=%d\n",
                $termIndex + 1,
                $providerIndex + 1,
                count($requests),
                count($resolved),
                count($vods) - count($resolved)
            ));
        }
    }

    return $resolved;
}

function poster_repair_find_bangumi_matches(array $vods, int $typeId, int $concurrency, int $timeout): array
{
    $requests = [];
    foreach ($vods as $vod) {
        if (!poster_repair_is_bangumi_type($vod, $typeId)) {
            continue;
        }
        $vodId = (int) $vod['vod_id'];
        $requests[(string) $vodId] = [
            'url' => 'https://api.bgm.tv/v0/search/subjects?limit=10',
            'headers' => [
                'Accept: application/json',
                'Content-Type: application/json',
                'User-Agent: SquaredMediaPosterRepair/1.0 (+https://ping2.my)',
            ],
            'body' => poster_repair_encode_json([
                'keyword' => (string) $vod['vod_name'],
                'filter' => ['type' => [2], 'nsfw' => false],
            ]),
        ];
    }
    if ($requests === []) {
        return [];
    }

    $vodById = [];
    foreach ($vods as $vod) {
        $vodById[(int) $vod['vod_id']] = $vod;
    }
    $resolved = [];
    $processed = 0;
    foreach (array_chunk($requests, 20, true) as $chunk) {
        foreach (poster_repair_multi_fetch($chunk, min(4, $concurrency), $timeout) as $vodId => $response) {
            if ($response['status'] < 200 || $response['status'] >= 300 || $response['body'] === '') {
                continue;
            }
            $payload = json_decode($response['body'], true);
            if (!is_array($payload) || !isset($vodById[(int) $vodId])) {
                continue;
            }
            $vod = $vodById[(int) $vodId];
            $candidate = poster_repair_pick_candidate(
                (string) $vod['vod_name'],
                (string) $vod['vod_year'],
                poster_repair_bangumi_items($payload)
            );
            if ($candidate === null) {
                continue;
            }
            $resolved[(int) $vodId] = [
                'vod_pic' => $candidate['vod_pic'],
                'provider_id' => 0,
                'provider_name' => 'Bangumi',
                'term_kind' => 'bangumi_title',
            ];
        }
        $processed += count($chunk);
        fwrite(STDERR, sprintf(
            "bangumi_progress=%d/%d resolved=%d\n",
            $processed,
            count($requests),
            count($resolved)
        ));
        usleep(200000);
    }

    return $resolved;
}

function poster_repair_create_backup(PDO $pdo, string $prefix, array $vodIds): array
{
    $vodTable = poster_repair_quote_identifier($prefix . 'vod');
    $backupName = $prefix . 'vod_pic_repair_backup';
    $backupTable = poster_repair_quote_identifier($backupName);
    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS {$backupTable} (" .
        'vod_id int(10) unsigned NOT NULL,' .
        "vod_pic varchar(1024) NOT NULL DEFAULT ''," .
        'backed_up_at int(10) unsigned NOT NULL,' .
        'PRIMARY KEY (vod_id)' .
        ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4'
    );
    $vodIds = array_values(array_unique(array_filter(array_map('intval', $vodIds), static function (int $vodId): bool {
        return $vodId > 0;
    })));
    $inserted = 0;
    foreach (array_chunk($vodIds, 500) as $chunk) {
        $placeholders = implode(',', array_fill(0, count($chunk), '?'));
        $statement = $pdo->prepare(
            "INSERT IGNORE INTO {$backupTable} (vod_id,vod_pic,backed_up_at) " .
            "SELECT vod_id,COALESCE(vod_pic,''),UNIX_TIMESTAMP() FROM {$vodTable} WHERE vod_id IN ({$placeholders})"
        );
        $statement->execute($chunk);
        $inserted += $statement->rowCount();
    }

    return ['table' => $backupName, 'inserted' => $inserted];
}

function poster_repair_usage(): string
{
    return <<<'TEXT'
Usage:
  php scripts/repair-vod-posters.php --root=/www/wwwroot/site [options]

Options:
  --apply              Back up target rows and update matched vod_pic values.
  --apply-report=PATH  Apply mappings from a completed dry-run JSONL report.
  --limit=N            Process at most N rows; 0 means all (default: 0).
  --min-id=N           Only process vod_id >= N.
  --max-id=N           Only process vod_id <= N.
  --concurrency=N      Concurrent source requests (default: 12, max: 32).
  --provider-rounds=N  Sources tried per search term (default: 3, max: 7; 0 skips them).
  --bangumi-type-id=N Query Bangumi for this MacCMS type and its direct children.
  --timeout=N          Per-request timeout in seconds (default: 12).
  --report=PATH        New JSONL report path; existing files are rejected.
  --help               Show this help.

Without --apply the command is a read-only dry run.
TEXT;
}

function poster_repair_main(array $argv): int
{
    $options = getopt('', ['root:', 'apply', 'apply-report:', 'limit:', 'min-id:', 'max-id:', 'concurrency:', 'provider-rounds:', 'bangumi-type-id:', 'timeout:', 'report:', 'help']);
    if (isset($options['help'])) {
        echo poster_repair_usage();

        return 0;
    }
    foreach (['curl', 'mbstring', 'pdo_mysql'] as $extension) {
        if (!extension_loaded($extension)) {
            throw new RuntimeException("The PHP {$extension} extension is required.");
        }
    }
    $root = rtrim((string) ($options['root'] ?? ''), '/');
    if ($root === '') {
        fwrite(STDERR, poster_repair_usage());

        return 2;
    }
    $relativePicsAreRemote = poster_repair_uses_remote_upload($root);
    $apply = array_key_exists('apply', $options);
    $limit = max(0, (int) ($options['limit'] ?? 0));
    $minId = max(0, (int) ($options['min-id'] ?? 0));
    $maxId = max(0, (int) ($options['max-id'] ?? 0));
    $concurrency = max(1, min(32, (int) ($options['concurrency'] ?? 12)));
    $providerRounds = max(0, min(7, (int) ($options['provider-rounds'] ?? 3)));
    $bangumiTypeId = max(0, (int) ($options['bangumi-type-id'] ?? 0));
    $timeout = max(3, min(30, (int) ($options['timeout'] ?? 12)));
    $reportPath = (string) ($options['report'] ?? (sys_get_temp_dir() . '/vod-poster-repair-' . date('Ymd-His') . '.jsonl'));

    [$pdo, $prefix] = poster_repair_database($root);
    $vodTable = poster_repair_quote_identifier($prefix . 'vod');
    $typeTable = poster_repair_quote_identifier($prefix . 'type');
    $targetCondition = "vod_pic IS NULL OR TRIM(vod_pic)='' OR (" .
        "LOWER(TRIM(vod_pic)) NOT LIKE 'http://%' AND " .
        "LOWER(TRIM(vod_pic)) NOT LIKE 'https://%' AND " .
        "TRIM(vod_pic) NOT LIKE '//%' AND " .
        "LOWER(TRIM(vod_pic)) NOT LIKE 'mac:%')";
    if (isset($options['apply-report'])) {
        if (!$apply) {
            throw new RuntimeException('--apply-report requires --apply.');
        }
        $inputPath = (string) $options['apply-report'];
        $matches = poster_repair_load_report($inputPath, $root, $relativePicsAreRemote);
        $report = poster_repair_open_report($reportPath);
        $backup = poster_repair_create_backup($pdo, $prefix, array_keys($matches));
        $update = $pdo->prepare(poster_repair_update_sql($vodTable));
        $updated = 0;
        foreach ($matches as $match) {
            if (!poster_repair_is_target_pic($match['old_pic'], $root, $relativePicsAreRemote)) {
                $status = 'skipped_restored_local_file';
            } else {
                $update->execute([$match['vod_pic'], $match['vod_id'], $match['old_pic']]);
                $status = $update->rowCount() === 1 ? 'updated' : 'skipped_concurrent_change';
            }
            if ($status === 'updated') {
                $updated++;
            }
            poster_repair_write_report($report, [
                'vod_id' => $match['vod_id'],
                'old_pic' => $match['old_pic'],
                'new_pic' => $match['vod_pic'],
                'provider_id' => $match['provider_id'],
                'provider_name' => $match['provider_name'],
                'term_kind' => $match['term_kind'],
                'status' => $status,
            ]);
        }
        fclose($report);
        echo poster_repair_encode_json([
            'mode' => 'apply-report',
            'matched' => count($matches),
            'updated' => $updated,
            'skipped' => count($matches) - $updated,
            'backup_table' => $backup['table'],
            'newly_backed_up' => $backup['inserted'],
            'report' => $reportPath,
        ], true) . "\n";

        return 0;
    }

    $providers = poster_repair_load_providers($pdo, $prefix);
    if ($providers === []) {
        fwrite(STDERR, "warning=no_video_collection_sources douban_id_matches_only=1\n");
    }
    $where = ["({$targetCondition})", "TRIM(IFNULL(vod_name,''))<>''"];
    if ($minId > 0) {
        $where[] = 'vod_id>=' . $minId;
    }
    if ($maxId > 0) {
        $where[] = 'vod_id<=' . $maxId;
    }
    $whereSql = implode(' AND ', $where);
    $limitSql = $limit > 0 ? ' LIMIT ' . $limit : '';
    $sql = "SELECT v.vod_id,v.type_id,v.vod_name,v.vod_year,v.vod_play_from,v.vod_pic,v.vod_douban_id,COALESCE(t.type_pid,0) type_pid " .
        "FROM {$vodTable} v LEFT JOIN {$typeTable} t ON t.type_id=v.type_id " .
        "WHERE " . str_replace(['vod_pic', 'vod_name', 'vod_id'], ['v.vod_pic', 'v.vod_name', 'v.vod_id'], $whereSql) .
        " ORDER BY v.vod_id DESC{$limitSql}";
    $candidateVods = $pdo->query($sql)->fetchAll();
    $vods = array_values(array_filter($candidateVods, static function (array $vod) use ($root, $relativePicsAreRemote): bool {
        return poster_repair_is_target_pic((string) ($vod['vod_pic'] ?? ''), $root, $relativePicsAreRemote);
    }));
    fwrite(STDERR, sprintf(
        "mode=%s candidates=%d targets=%d skipped_valid=%d providers=%d report=%s\n",
        $apply ? 'apply' : 'dry-run',
        count($candidateVods),
        count($vods),
        count($candidateVods) - count($vods),
        count($providers),
        $reportPath
    ));

    $report = poster_repair_open_report($reportPath);
    $matches = poster_repair_find_douban_matches($vods, $concurrency, $timeout);
    $catalogVods = array_values(array_filter($vods, static function (array $vod) use ($matches): bool {
        return !isset($matches[(int) $vod['vod_id']]);
    }));
    $matches += poster_repair_find_matches($catalogVods, $providers, $providerRounds, $concurrency, $timeout);
    if ($bangumiTypeId > 0) {
        $bangumiVods = array_values(array_filter($vods, static function (array $vod) use ($matches, $bangumiTypeId): bool {
            return !isset($matches[(int) $vod['vod_id']]) && poster_repair_is_bangumi_type($vod, $bangumiTypeId);
        }));
        $matches += poster_repair_find_bangumi_matches($bangumiVods, $bangumiTypeId, $concurrency, $timeout);
    }
    $backup = null;
    if ($apply) {
        $backup = poster_repair_create_backup($pdo, $prefix, array_keys($matches));
        fwrite(STDERR, sprintf("backup_table=%s newly_backed_up=%d\n", $backup['table'], $backup['inserted']));
    }
    $update = $apply ? $pdo->prepare(poster_repair_update_sql($vodTable)) : null;
    $summary = [
        'mode' => $apply ? 'apply' : 'dry-run',
        'candidates' => count($candidateVods),
        'targets' => count($vods),
        'skipped_valid' => count($candidateVods) - count($vods),
        'matched' => count($matches),
        'updated' => 0,
        'skipped' => 0,
        'unmatched' => count($vods) - count($matches),
        'backup_table' => $backup['table'] ?? null,
        'report' => $reportPath,
    ];
    foreach ($vods as $vod) {
        $vodId = (int) $vod['vod_id'];
        $match = $matches[$vodId] ?? null;
        $row = [
            'vod_id' => $vodId,
            'old_pic' => (string) $vod['vod_pic'],
            'status' => $match === null ? 'unmatched' : ($apply ? 'matched' : 'would_update'),
        ];
        if ($match !== null) {
            $row += [
                'new_pic' => $match['vod_pic'],
                'provider_id' => $match['provider_id'],
                'provider_name' => $match['provider_name'],
                'term_kind' => $match['term_kind'],
            ];
            if ($apply) {
                if (!poster_repair_is_target_pic((string) $vod['vod_pic'], $root, $relativePicsAreRemote)) {
                    $row['status'] = 'skipped_restored_local_file';
                } else {
                    $update->execute([$match['vod_pic'], $vodId, (string) $vod['vod_pic']]);
                    $row['status'] = $update->rowCount() === 1 ? 'updated' : 'skipped_concurrent_change';
                }
                if ($row['status'] === 'updated') {
                    $summary['updated']++;
                } else {
                    $summary['skipped']++;
                }
            }
        }
        poster_repair_write_report($report, $row);
    }
    fclose($report);

    echo poster_repair_encode_json($summary, true) . "\n";

    return 0;
}

if (realpath((string) ($_SERVER['SCRIPT_FILENAME'] ?? '')) === __FILE__) {
    try {
        exit(poster_repair_main($argv));
    } catch (Throwable $error) {
        fwrite(STDERR, 'poster repair failed: ' . $error->getMessage() . "\n");
        exit(1);
    }
}
