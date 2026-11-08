<?php

$root = dirname(__DIR__);
$run = static function (array $args) use ($root): array {
    $process = proc_open(array_merge([PHP_BINARY, $root . '/scripts/verify/evaluate-vodmerge-jev.php'], $args),
        [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes, $root);
    fclose($pipes[0]);
    $output = stream_get_contents($pipes[1]);
    $error = stream_get_contents($pipes[2]);
    fclose($pipes[1]);
    fclose($pipes[2]);
    return [proc_close($process), $output, $error];
};
$check = static function ($condition, string $message): void {
    if (!$condition) {
        throw new RuntimeException($message);
    }
};
$cases = json_decode(file_get_contents(__DIR__ . '/fixtures/vodmerge-jev-cases.json'), true);
[$status, $output, $error] = $run(['--request']);
$check($status === 0, 'Request generation failed: ' . $error);
$request = json_decode($output, true);
$check(count($request['questions']) === count($cases), 'Every synthetic pair must have a question.');
foreach ($cases as $i => $case) {
    $key = 'pair_' . ($i + 1);
    $check($request['state']['pairs'][$key]['incoming']['vod_name'] === $case['incoming']['vod_name'], 'Pair metadata changed.');
    $check(strpos($request['questions'][$key]['instructions'], '`pairs.' . $key . '.incoming`') !== false, 'Question references the wrong pair.');
}

$response = ['model' => 'offline-fixture', 'answers' => []];
foreach ($cases as $i => $case) {
    $probabilities = ['same' => 0.005, 'different' => 0.005, 'uncertain' => 0.005];
    $probabilities[$case['expected_choice']] = 0.99;
    $response['answers']['pair_' . ($i + 1)] = ['type' => 'choice', 'choice' => $case['expected_choice'],
        'confidence' => 0.99, 'probabilities' => $probabilities];
}
$path = tempnam(sys_get_temp_dir(), 'vodmerge-evaluation-');
try {
    file_put_contents($path, json_encode($response));
    [$status, $output, $error] = $run(['--response', $path]);
    $check($status === 0, 'Offline response evaluation failed: ' . $error);
    $result = json_decode($output, true);
    $check($result['cases'] === count($cases) && $result['choice_matches'] === count($cases), 'Synthetic answer mapping changed.');
    $check($result['unsafe_eligible_pairs'] === 0, 'Conflicting pairs became eligible.');

    unset($response['answers']['pair_1']);
    file_put_contents($path, json_encode($response));
    [$status, $output, $error] = $run(['--response', $path]);
    $check($status === 1 && $output === '' && $error !== '', 'Incomplete responses must fail.');

    file_put_contents($path, '{');
    [$status, $output, $error] = $run(['--response', $path]);
    $check($status === 1 && $output === '' && $error !== '', 'Invalid JSON must fail.');
} finally {
    unlink($path);
}

echo 'VodMerge offline evaluation: ' . count($cases) . " synthetic pairs and invalid responses passed.\n";
