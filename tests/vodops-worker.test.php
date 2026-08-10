<?php

declare(strict_types=1);

function vodops_worker_fail(string $message): void
{
    fwrite(STDERR, $message . "\n");
    exit(1);
}

function vodops_worker_run(string $worker, array $arguments): array
{
    $command = escapeshellarg(PHP_BINARY) . ' ' . escapeshellarg($worker);
    foreach ($arguments as $argument) {
        $command .= ' ' . escapeshellarg($argument);
    }
    $output = [];
    $status = 0;
    exec($command . ' 2>&1', $output, $status);
    return ['status' => $status, 'output' => implode("\n", $output)];
}

$worker = dirname(__DIR__) . '/addons/vodops/bin/vodops-worker.php';
$help = vodops_worker_run($worker, ['--help']);
if ($help['status'] !== 0) {
    vodops_worker_fail('Vodops worker --help should not require a MacCMS bootstrap.\n' . $help['output']);
}
foreach (['--max-chunks', '--max-seconds', 'Cron'] as $needle) {
    if (strpos($help['output'], $needle) === false) {
        vodops_worker_fail('Vodops worker help is missing: ' . $needle);
    }
}

$invalidChunks = vodops_worker_run($worker, ['--max-chunks=0']);
if ($invalidChunks['status'] !== 2 || strpos($invalidChunks['output'], '--max-chunks') === false) {
    vodops_worker_fail('Vodops worker should reject an unsafe chunk budget before bootstrapping MacCMS.');
}

$invalidSeconds = vodops_worker_run($worker, ['--max-seconds=301']);
if ($invalidSeconds['status'] !== 2 || strpos($invalidSeconds['output'], '--max-seconds') === false) {
    vodops_worker_fail('Vodops worker should reject an unsafe time budget before bootstrapping MacCMS.');
}

echo "Vodops CLI worker tests passed\n";
