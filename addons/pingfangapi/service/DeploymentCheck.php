<?php

namespace addons\pingfangapi\service;

class DeploymentCheck
{
    public static function inspect($root, $scope, $detectScope = false)
    {
        foreach (['pdo_mysql', 'json', 'mbstring', 'session'] as $extension) {
            if (!extension_loaded($extension)) {
                throw new \RuntimeException('Required PHP CLI extension is missing: ' . $extension);
            }
        }
        $root = realpath($root);
        if ($root === false || $root === '/' || !is_file($root . '/application/database.php') || !is_readable($root . '/application/database.php')) {
            throw new \RuntimeException('Remote MacCMS application/database.php is missing or unreadable.');
        }
        $db = include $root . '/application/database.php';
        if (!is_array($db)) {
            throw new \RuntimeException('MacCMS database configuration must return an array.');
        }
        try {
            $pdo = static::connect($db);
        } catch (\Throwable $error) {
            throw new \RuntimeException('Database connection failed. Check the server database configuration and PHP CLI environment; credentials are not printed.');
        }
        try {
            $result = self::schema($pdo, isset($db['prefix']) ? (string) $db['prefix'] : '', $scope, $detectScope);
        } catch (\PDOException $error) {
            throw new \RuntimeException('Database schema could not be read. Check access to information_schema for the configured database.');
        }

        $directories = [$root . '/addons', $root . '/application/index/controller', $root . '/runtime/cache', $root . '/runtime/temp', '/tmp'];
        if ($result['scope'] !== 'api') {
            $directories[] = $root . '/application/extra';
        }
        foreach ($directories as $directory) {
            $existing = $directory;
            while (!file_exists($existing) && !is_link($existing)) {
                $existing = dirname($existing);
            }
            if (!is_dir($existing) || !is_writable($existing) || !is_executable($existing)) {
                throw new \RuntimeException('Deployment user cannot write or traverse directory: ' . $directory);
            }
        }
        $result['checks'] = ['PHP CLI ' . PHP_VERSION . ' extensions ready', 'Database connection and required columns checked', 'Deployment-user directory access checked (PHP-FPM user still needs acceptance)'];
        foreach ([$root, '/tmp'] as $directory) {
            $bytes = disk_free_space($directory);
            if ($bytes === false || $bytes <= 0) {
                throw new \RuntimeException('Free disk space is unavailable or exhausted: ' . $directory);
            }
            $result['checks'][] = 'Free disk at ' . $directory . ': ' . intval(floor($bytes / 1048576)) . ' MiB (verify room for archives and backups)';
        }
        return $result;
    }

    protected static function connect(array $db)
    {
        if (empty($db['dsn']) && empty($db['hostname'])) {
            throw new \RuntimeException('MacCMS database hostname is missing.');
        }
        $dsn = !empty($db['dsn']) ? $db['dsn'] : sprintf(
            'mysql:host=%s;port=%s;dbname=%s;charset=%s',
            isset($db['hostname']) ? $db['hostname'] : '',
            isset($db['hostport']) ? $db['hostport'] : '3306',
            isset($db['database']) ? $db['database'] : '',
            isset($db['charset']) ? $db['charset'] : 'utf8'
        );
        return new \PDO($dsn, isset($db['username']) ? $db['username'] : '', isset($db['password']) ? $db['password'] : '', [
            \PDO::ATTR_ERRMODE => \PDO::ERRMODE_EXCEPTION,
            \PDO::ATTR_TIMEOUT => 5,
        ]);
    }

    public static function schema($pdo, $prefix, $scope, $detectScope = false)
    {
        if (!in_array($scope, ['api', 'backend', 'all'], true)) {
            throw new \RuntimeException('Invalid pingfangapi deployment scope.');
        }
        $missing = array_diff(['ulog_point', 'ulog_duration'], self::columns($pdo, $prefix . 'ulog'));
        if (!empty($missing)) {
            throw new \RuntimeException('MacCMS ulog is missing: ' . implode(', ', $missing) . '. Stop and review a separate database migration; backend deployment does not add these columns.');
        }
        $columns = self::columns($pdo, $prefix . 'pingfang_device_session');
        $required = ['device_label', 'ip_address', 'last_seen_time', 'login_check_hash', 'login_time', 'revoked_reason', 'revoked_time', 'session_id', 'token_hash', 'user_agent', 'user_id'];
        $missing = array_diff($required, $columns);
        $reason = 'database baseline is compatible';
        if (empty($columns)) {
            $reason = 'backend will create the missing device session table after backup and confirmation';
        } elseif (!empty(array_diff($missing, ['login_check_hash']))) {
            throw new \RuntimeException('Device session schema is missing: ' . implode(', ', $missing) . '. Stop and review a separate database migration; install.sql cannot repair this existing table.');
        } elseif (!empty($missing)) {
            $reason = 'backend will add login_check_hash after backup and confirmation';
        }
        if (!empty($missing) && $scope === 'api') {
            if (!$detectScope) {
                throw new \RuntimeException('Installed pingfangdevice database schema is not compatible with API-only deployment. Run the checked backend deployment first.');
            }
            $scope = 'backend';
        }
        return ['scope' => $scope, 'reason' => $reason];
    }

    private static function columns($pdo, $table)
    {
        $query = $pdo->prepare('SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?');
        $query->execute([$table]);
        return $query->fetchAll(\PDO::FETCH_COLUMN);
    }
}

// The same local source is streamed over SSH for --check and run from the staged
// release before installation. Loading the class in a web request does no work.
if (PHP_SAPI === 'cli' && getenv('PFAPI_RUN_DEPLOY_CHECK') === '1') {
    try {
        $result = DeploymentCheck::inspect(getenv('MACCMS_ROOT'), getenv('DEPLOY_SCOPE'), getenv('PFAPI_DETECT_SCOPE') === '1');
        echo 'PFAPI_DEPLOY_SCOPE=' . $result['scope'] . "\n";
        echo 'PFAPI_DEPLOY_REASON=' . $result['reason'] . "\n";
        foreach ($result['checks'] as $check) {
            echo 'PFAPI_DEPLOY_CHECK=' . $check . "\n";
        }
    } catch (\Throwable $error) {
        file_put_contents('php://stderr', 'Deployment check failed: ' . $error->getMessage() . "\n");
        exit(1);
    }
}
