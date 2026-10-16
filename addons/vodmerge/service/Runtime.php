<?php

namespace addons\vodmerge\service;

class Runtime
{
    public static function secret(string $name, string $environment): string
    {
        $value = trim((string) getenv($environment));
        if ($value !== '') {
            return $value;
        }
        $config = self::readConfig();
        return trim((string) ($config[$name] ?? ''));
    }

    private static function configFile(): string
    {
        return dirname(__DIR__, 3) . '/application/extra/vodmerge.php';
    }

    private static function readConfig(): array
    {
        $file = self::configFile();
        clearstatcache(true, $file);
        if (is_link($file) || (file_exists($file) && !is_file($file))) {
            throw new \RuntimeException('密钥配置文件必须为普通文件。');
        }
        if (!is_file($file)) {
            return [];
        }
        if (function_exists('opcache_invalidate')) {
            @opcache_invalidate($file, true);
        }
        ob_start();
        try {
            $config = @include $file;
        } catch (\Throwable $error) {
            throw new \RuntimeException('无法读取密钥配置，请检查服务器配置文件。');
        } finally {
            ob_end_clean();
        }
        if (!is_array($config)) {
            throw new \RuntimeException('密钥配置文件必须返回数组，未覆盖原文件。');
        }
        return $config;
    }

    public static function jevStatus(): array
    {
        if (trim((string) getenv('TYPESAFE_API_KEY')) !== '') {
            return ['configured' => true, 'source' => 'environment'];
        }
        $configured = self::secret('typesafe_api_key', 'TYPESAFE_API_KEY') !== '';
        return ['configured' => $configured, 'source' => $configured ? 'file' : 'none'];
    }

    public static function validateJevKey(string $key): string
    {
        $key = trim($key);
        if ($key !== '' && !preg_match('/^[\x21-\x7e]{1,4096}$/D', $key)) {
            throw new \InvalidArgumentException('Token 只能包含非空白 ASCII 字符，长度不能超过 4096 字节。');
        }
        return $key;
    }

    public static function saveJevKey(string $key, bool $clear = false): array
    {
        $key = self::validateJevKey($key);
        if (trim((string) getenv('TYPESAFE_API_KEY')) !== '') {
            throw new \RuntimeException('当前使用服务器环境变量 Token，请先由服务器管理员移除该环境变量。');
        }
        if ($clear && $key !== '') {
            throw new \InvalidArgumentException('清除 Token 时请保持输入框为空。');
        }
        if (!$clear && $key === '') {
            return self::jevStatus();
        }
        $file = self::configFile();
        $lockFile = $file . '.lock';
        if (is_link($lockFile)) {
            throw new \RuntimeException('密钥配置锁必须为普通文件。');
        }
        $lock = @fopen($lockFile, 'c');
        if ($lock === false) {
            throw new \RuntimeException('无法保存 Token，请检查站点 PHP 用户对 application/extra 的写入权限。');
        }
        $temporary = '';
        try {
            if (!@chmod($lockFile, 0600) || !flock($lock, LOCK_EX)) {
                throw new \RuntimeException('无法锁定密钥配置文件，请检查站点 PHP 用户权限。');
            }
            $config = self::readConfig();
            if ($clear) {
                unset($config['typesafe_api_key']);
            } else {
                $config['typesafe_api_key'] = $key;
            }
            array_walk_recursive($config, static function ($value) {
                if ($value !== null && !is_scalar($value)) {
                    throw new \RuntimeException('密钥配置仅支持静态数组及标量，未覆盖原文件。');
                }
            });
            $temporary = @tempnam(dirname($file), '.vodmerge-');
            if ($temporary === false || dirname($temporary) !== dirname($file)) {
                $temporary = $temporary ?: '';
                throw new \RuntimeException('无法创建密钥配置临时文件，请检查站点 PHP 用户权限。');
            }
            $content = "<?php\n\nreturn " . var_export($config, true) . ";\n";
            if (!@chmod($temporary, 0600) || @file_put_contents($temporary, $content) !== strlen($content)
                || !@rename($temporary, $file)) {
                throw new \RuntimeException('Token 保存失败，原配置未覆盖，请检查站点 PHP 用户权限。');
            }
            $temporary = '';
            if (function_exists('opcache_invalidate')) {
                @opcache_invalidate($file, true);
            }
            return self::jevStatus();
        } finally {
            if ($temporary !== '' && is_file($temporary)) {
                @unlink($temporary);
            }
            flock($lock, LOCK_UN);
            fclose($lock);
        }
    }

    public static function database(): array
    {
        $config = config('database');
        if (!is_array($config) || ($config['type'] ?? '') !== 'mysql' || !empty($config['deploy'])) {
            throw new \RuntimeException('插件需要单主 MySQL 数据库配置。');
        }
        $db = new \PDO('mysql:host=' . $config['hostname'] . ';port=' . ($config['hostport'] ?: 3306)
            . ';dbname=' . $config['database'] . ';charset=utf8mb4', $config['username'], $config['password'], [
                \PDO::ATTR_ERRMODE => \PDO::ERRMODE_EXCEPTION,
                \PDO::ATTR_EMULATE_PREPARES => false,
                \PDO::MYSQL_ATTR_MULTI_STATEMENTS => false,
            ]);
        return [$db, (string) ($config['prefix'] ?? 'mac_')];
    }

    public static function service(): Service
    {
        [$db, $prefix] = self::database();
        return new Service($db, $prefix, (array) config('vodplayer'));
    }

    public static function audit(): LibraryAudit
    {
        [$db, $prefix] = self::database();
        $workbench = new Workbench($db, $prefix, new Service($db, $prefix, (array) config('vodplayer')));
        return new LibraryAudit($db, $prefix, null, [$workbench, 'discover']);
    }

    public static function workbench(): Workbench
    {
        [$db, $prefix] = self::database();
        return new Workbench($db, $prefix, new Service($db, $prefix, (array) config('vodplayer')));
    }

    public static function autoBound(): bool
    {
        $config = function_exists('get_addon_config') ? get_addon_config('vodmerge') : [];
        return (string) ($config['auto_bound_updates'] ?? '0') === '1';
    }

    public static function autoFirst(): bool
    {
        $config = function_exists('get_addon_config') ? get_addon_config('vodmerge') : [];
        return (string) ($config['auto_first_matches'] ?? '0') === '1';
    }

    public static function invalidate(): void
    {
        // Do not remove runtime/log, template files or unrelated filesystem data.
        try {
            \think\Cache::clear();
        } catch (\Throwable $error) {
            error_log('[vodmerge] Cache invalidation failed; clear application cache in the admin panel.');
        }
    }
}
