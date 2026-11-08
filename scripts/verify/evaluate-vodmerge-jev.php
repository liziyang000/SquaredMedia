<?php

require dirname(__DIR__, 2) . '/addons/vodmerge/bootstrap.php';

use addons\vodmerge\service\Jev;
use addons\vodmerge\service\Payload;

// Build a metadata-only request; credentials and network calls stay outside this script.
$cases = json_decode(file_get_contents(dirname(__DIR__, 2) . '/tests/fixtures/vodmerge-jev-cases.json'), true);
$request = ['state' => ['pairs' => []], 'questions' => [], 'model' => 'jev-latest'];
$individual = [];
foreach ($cases as $i => $case) {
    $key = 'pair_' . ($i + 1);
    $single = Jev::request($case['incoming'], [$case['target']]);
    $question = reset($single['questions']);
    $candidateKey = key($single['questions']);
    $question['instructions'] = str_replace(['`incoming`', '`candidates.' . $candidateKey . '`'],
        ['`pairs.' . $key . '.incoming`', '`pairs.' . $key . '.candidates.' . $candidateKey . '`'], $question['instructions']);
    $request['state']['pairs'][$key] = $single['state'];
    $request['questions'][$key] = $question;
    $individual[$key] = $single;
}

if ($argc === 2 && $argv[1] === '--request') {
    echo Payload::json($request) . "\n";
    exit(0);
}
if ($argc !== 3 || $argv[1] !== '--response') {
    fwrite(STDERR, "Usage: php scripts/verify/evaluate-vodmerge-jev.php --request | --response response.json\n");
    exit(2);
}

try {
    $response = json_decode(file_get_contents($argv[2]), true);
    if (!is_array($response) || empty($response['answers'])) {
        throw new RuntimeException('Missing valid Jev answers; the live evaluation did not complete.');
    }
    $results = [];
    $correct = 0;
    $unsafe = 0;
    $automatic = 0;
    foreach ($cases as $i => $case) {
        $key = 'pair_' . ($i + 1);
        $single = $individual[$key];
        $candidateKey = key($single['questions']);
        $parsed = Jev::parse(['model' => $response['model'] ?? '', 'answers' => [$candidateKey => $response['answers'][$key] ?? []]], $single);
        $answer = $parsed['answers'][(int) $case['target']['vod_id']];
        $issues = Payload::automaticIssues($case['incoming'], $case['target']);
        $eligible = !$issues && $answer['choice'] === 'same' && $answer['probabilities']['same'] >= .98 && $answer['confidence'] >= .95;
        $correct += $answer['choice'] === $case['expected_choice'] ? 1 : 0;
        $unsafe += $eligible && !$case['allow_automatic'] ? 1 : 0;
        $automatic += $eligible ? 1 : 0;
        $results[] = ['case' => $case['id'], 'expected' => $case['expected_choice'], 'actual' => $answer['choice'],
            'confidence' => $answer['confidence'], 'same_probability' => $answer['probabilities']['same'],
            'eligible_pair' => $eligible, 'hard_rule_blocks' => $issues];
    }
    echo json_encode(['model' => $response['model'] ?? '', 'cases' => count($cases), 'choice_matches' => $correct,
        'eligible_pairs' => $automatic, 'unsafe_eligible_pairs' => $unsafe, 'results' => $results,
        'scope' => 'Synthetic pairs only; not production accuracy. Database uniqueness, candidate coverage and concurrency are checked by the regression suite.'],
        JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . "\n";
    exit($unsafe ? 1 : 0);
} catch (Throwable $error) {
    fwrite(STDERR, $error->getMessage() . "\n");
    exit(1);
}
