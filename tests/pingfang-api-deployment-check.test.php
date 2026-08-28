<?php
declare(strict_types=1);

namespace addons\pingfangapi\service {
    // Server extension readiness is simulated; local unit tests need no MySQL driver.
    function extension_loaded($name)
    {
        return true;
    }
}

namespace {

use addons\pingfangapi\service\DeploymentCheck;

require_once dirname(__DIR__) . '/addons/pingfangapi/service/DeploymentCheck.php';

final class PingfangDeploymentCheckDatabase
{
    public array $tables;
    public array $reads = [];

    public function __construct(array $tables)
    {
        $this->tables = $tables;
    }

    public function prepare($sql)
    {
        if (!preg_match('/^SELECT COLUMN_NAME FROM information_schema\.COLUMNS /', $sql)) {
            throw new RuntimeException('Deployment checks may only read schema metadata.');
        }
        return new class($this) {
            private PingfangDeploymentCheckDatabase $database;
            private string $table = '';

            public function __construct(PingfangDeploymentCheckDatabase $database)
            {
                $this->database = $database;
            }

            public function execute($parameters)
            {
                $this->table = (string) $parameters[0];
                $this->database->reads[] = $this->table;
                return true;
            }

            public function fetchAll($mode)
            {
                return $this->database->tables[$this->table] ?? [];
            }
        };
    }
}

$assertSame = static function ($expected, $actual, string $message): void {
    if ($expected !== $actual) {
        throw new RuntimeException($message . '\nExpected: ' . var_export($expected, true) . '\nActual: ' . var_export($actual, true));
    }
};
$assertFailure = static function (callable $check, string $message): void {
    try {
        $check();
    } catch (RuntimeException $error) {
        if (strpos($error->getMessage(), $message) !== false) {
            return;
        }
        throw $error;
    }
    throw new RuntimeException('Expected deployment failure: ' . $message);
};

$deviceColumns = ['session_id', 'user_id', 'token_hash', 'login_check_hash', 'device_label', 'user_agent', 'ip_address', 'login_time', 'last_seen_time', 'revoked_time', 'revoked_reason'];
$tables = ['custom_ulog' => ['ulog_id', 'ulog_point', 'ulog_duration'], 'custom_pingfang_device_session' => $deviceColumns];
$database = new PingfangDeploymentCheckDatabase($tables);
$ready = DeploymentCheck::schema($database, 'custom_', 'api', true);
$assertSame('api', $ready['scope'], 'A compatible schema must keep API-only scope.');
$assertSame(['custom_ulog', 'custom_pingfang_device_session'], $database->reads, 'Checks must honor the configured table prefix.');
$assertSame('backend', DeploymentCheck::schema($database, 'custom_', 'backend', true)['scope'], 'Explicit backend refresh must not be downgraded.');

unset($database->tables['custom_pingfang_device_session']);
$assertSame('backend', DeploymentCheck::schema($database, 'custom_', 'api', true)['scope'], 'A missing device table must be classified as an installable backend dependency.');
$assertFailure(static function () use ($database): void {
    DeploymentCheck::schema($database, 'custom_', 'api', false);
}, 'backend');
$assertSame('backend', DeploymentCheck::schema($database, 'custom_', 'backend', false)['scope'], 'A confirmed first install may create the device table later.');

$database->tables['custom_pingfang_device_session'] = array_values(array_diff($deviceColumns, ['login_check_hash']));
$upgrade = DeploymentCheck::schema($database, 'custom_', 'api', true);
$assertSame('backend', $upgrade['scope'], 'The supported login_check_hash migration must select backend.');
$assertSame(true, strpos($upgrade['reason'], 'login_check_hash') !== false, 'The operator must see the exact supported migration.');

$database->tables['custom_pingfang_device_session'] = array_values(array_diff($deviceColumns, ['token_hash']));
foreach (['api', 'backend', 'all'] as $scope) {
    $assertFailure(static function () use ($database, $scope): void {
        DeploymentCheck::schema($database, 'custom_', $scope, true);
    }, 'token_hash');
}
$database->tables = $tables;
$database->tables['custom_ulog'] = ['ulog_id', 'ulog_duration'];
foreach (['api', 'backend'] as $scope) {
    $assertFailure(static function () use ($database, $scope): void {
        DeploymentCheck::schema($database, 'custom_', $scope, true);
    }, 'ulog_point');
}
$assertFailure(static function () use ($database): void {
    DeploymentCheck::schema($database, 'custom_', 'unknown', true);
}, 'scope');

final class PingfangDeploymentInspectFixture extends DeploymentCheck
{
    public static $database;
    public static bool $failConnection = false;

    protected static function connect(array $db)
    {
        if (self::$failConnection) {
            throw new PDOException('fixture-secret-password must not be exposed');
        }
        return self::$database;
    }
}

$fixture = sys_get_temp_dir() . '/pingfang-deployment-check-' . bin2hex(random_bytes(8));
mkdir($fixture, 0700);
$removeFixture = static function (string $directory) use (&$removeFixture): void {
    foreach (scandir($directory) as $name) {
        if ($name === '.' || $name === '..') {
            continue;
        }
        $path = $directory . '/' . $name;
        if (is_dir($path) && !is_link($path)) {
            $removeFixture($path);
        } else {
            unlink($path);
        }
    }
    rmdir($directory);
};
try {
    mkdir($fixture . '/application', 0700);
    file_put_contents($fixture . '/application/database.php', "<?php return ['prefix' => 'custom_', 'password' => 'fixture-secret-password'];\n");
    PingfangDeploymentInspectFixture::$database = new PingfangDeploymentCheckDatabase($tables);
    $before = hash_file('sha256', $fixture . '/application/database.php');
    $inspection = PingfangDeploymentInspectFixture::inspect($fixture, 'api', true);
    $assertSame('api', $inspection['scope'], 'Full inspection must preserve an already compatible scope.');
    $assertSame(5, count($inspection['checks']), 'Inspection must report PHP, database, permissions and both disk locations.');
    $assertSame($before, hash_file('sha256', $fixture . '/application/database.php'), 'Inspection must never rewrite configuration.');
    $assertSame(['.', '..', 'application'], scandir($fixture), 'Inspection must not create deployment or cache directories.');

    file_put_contents($fixture . '/runtime', 'not a directory');
    $assertFailure(static function () use ($fixture): void {
        PingfangDeploymentInspectFixture::inspect($fixture, 'api', true);
    }, 'directory');
    unlink($fixture . '/runtime');
    $assertFailure(static function (): void {
        PingfangDeploymentInspectFixture::inspect('/', 'api', true);
    }, 'database.php');

    PingfangDeploymentInspectFixture::$failConnection = true;
    try {
        PingfangDeploymentInspectFixture::inspect($fixture, 'api', true);
        throw new RuntimeException('A failed database connection must block deployment.');
    } catch (RuntimeException $error) {
        $assertSame(true, strpos($error->getMessage(), 'Database connection failed') !== false, 'Connection errors must be actionable.');
        $assertSame(false, strpos($error->getMessage(), 'fixture-secret-password') !== false, 'Database credentials must never appear in diagnostics.');
    }
} finally {
    $removeFixture($fixture);
}

echo "Pingfangapi read-only deployment schema tests passed.\n";
}
