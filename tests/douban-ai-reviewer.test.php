<?php

namespace {
    $GLOBALS['douban_ai_search_config'] = [];
    $GLOBALS['douban_ai_response'] = [];
    $GLOBALS['douban_ai_calls'] = [];

    function config($name)
    {
        if ($name === 'maccms.ai_search') {
            return $GLOBALS['douban_ai_search_config'];
        }

        return null;
    }
}

namespace app\common\util {
    class AiProvider
    {
        public static function chat($config, $systemPrompt, $userPrompt)
        {
            $GLOBALS['douban_ai_calls'][] = [$config, $systemPrompt, $userPrompt];

            return $GLOBALS['douban_ai_response'];
        }
    }
}

namespace {
    require dirname(__DIR__) . '/addons/vodops/service/DoubanAiReviewer.php';

    use addons\vodops\service\DoubanAiReviewer;

    function assertAiReviewValue($expected, $actual, string $message): void
    {
        if ($expected !== $actual) {
            fwrite(STDERR, $message . ': expected ' . var_export($expected, true) . ', got ' . var_export($actual, true) . PHP_EOL);
            exit(1);
        }
    }

    $GLOBALS['douban_ai_search_config'] = [
        'enabled' => '1',
        'provider' => 'openai',
        'model' => 'deepseek-chat',
        'api_base' => 'https://api.example.test/v1',
        'api_key' => 'test-key',
        'timeout' => '12',
    ];
    $GLOBALS['douban_ai_response'] = [
        'code' => 1,
        'text' => "```json\n{\"douban_id\":\"222\",\"confidence\":96,\"reason\":\"别名与本地片名一致\"}\n```",
    ];

    $review = DoubanAiReviewer::review([
        'vod_name' => '测试影片',
        'vod_year' => '2025',
        'vod_actor' => '演员甲',
    ], [
        ['douban_id' => '111', 'title' => '测试影片', 'year' => '2025'],
        ['douban_id' => '222', 'title' => '测试影片', 'subtitle' => '别名', 'year' => '2025'],
    ]);

    assertAiReviewValue('selected', $review['status'] ?? '', 'A valid AI choice should be accepted');
    assertAiReviewValue('222', $review['douban_id'] ?? '', 'The selected ID should be returned');
    assertAiReviewValue(96, $review['confidence'] ?? 0, 'AI confidence should be normalized');
    assertAiReviewValue(1, count($GLOBALS['douban_ai_calls']), 'One review should make one model call');
    assertAiReviewValue('test-key', $GLOBALS['douban_ai_calls'][0][0]['api_key'] ?? '', 'The existing AI search credential should be reused server-side');

    $GLOBALS['douban_ai_response'] = [
        'code' => 1,
        'text' => '{"douban_id":"999","confidence":99,"reason":"not a candidate"}',
    ];
    $outside = DoubanAiReviewer::review(['vod_name' => '测试影片'], [
        ['douban_id' => '111', 'title' => '测试影片', 'year' => '2025'],
    ]);
    assertAiReviewValue('invalid', $outside['status'] ?? '', 'An ID outside the supplied candidates must be rejected');
    assertAiReviewValue('', $outside['douban_id'] ?? '', 'Rejected output must not expose a writable ID');

    $GLOBALS['douban_ai_search_config']['enabled'] = '0';
    $callsBeforeDisabledReview = count($GLOBALS['douban_ai_calls']);
    $disabled = DoubanAiReviewer::review(['vod_name' => '测试影片'], [
        ['douban_id' => '111', 'title' => '测试影片', 'year' => '2025'],
    ]);
    assertAiReviewValue('disabled', $disabled['status'] ?? '', 'A disabled AI search should fall back without a model call');
    assertAiReviewValue($callsBeforeDisabledReview, count($GLOBALS['douban_ai_calls']), 'Disabled review must not call the model');

    echo "Douban AI reviewer tests passed\n";
}
