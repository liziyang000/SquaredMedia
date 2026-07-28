<?php

namespace {
    $gameTicketConfig = [
        'game_ticket_secret' => 'test-secret-that-is-long-enough-for-hmac',
        'game_websocket_path' => '/game-socket',
    ];

    function get_addon_config($name)
    {
        global $gameTicketConfig;
        return $name === 'pingfangdevice' ? $gameTicketConfig : [];
    }

    require_once dirname(__DIR__) . '/addons/pingfangdevice/service/GameAccessTicket.php';

    use addons\pingfangdevice\service\GameAccessTicket;

    $fail = static function ($message) {
        fwrite(STDERR, $message . "\n");
        exit(1);
    };
    $assertSame = static function ($expected, $actual, $message) use ($fail) {
        if ($expected !== $actual) {
            $fail($message . "\nExpected: " . var_export($expected, true) . "\nActual: " . var_export($actual, true));
        }
    };
    $assertThrows = static function ($callback, $message) use ($fail) {
        try {
            $callback();
        } catch (\Throwable $e) {
            return;
        }
        $fail($message);
    };
    $decode = static function ($value) {
        $padding = strlen($value) % 4;
        if ($padding > 0) {
            $value .= str_repeat('=', 4 - $padding);
        }
        return base64_decode(strtr($value, '-_', '+/'), true);
    };

    $result = GameAccessTicket::issue(
        ['user_id' => 42, 'user_name' => '<b>Alice</b>'],
        'gomoku',
        'client-tab-alpha-0001',
        1700000000,
        'fixed-nonce'
    );
    [$payloadPart, $signaturePart] = explode('.', $result['ticket'], 2);
    $payload = json_decode($decode($payloadPart), true);
    $expectedSignature = rtrim(strtr(base64_encode(hash_hmac(
        'sha256',
        $payloadPart,
        $gameTicketConfig['game_ticket_secret'],
        true
    )), '+/', '-_'), '=');

    $assertSame('42', $payload['sub'], 'Ticket must carry the authenticated user ID.');
    $assertSame('Alice', $payload['name'], 'Ticket names must be plain text.');
    $assertSame('gomoku', $payload['game'], 'Ticket must be scoped to one game.');
    $assertSame('client-tab-alpha-0001', $payload['cid'], 'Ticket must carry the current browser tab identity.');
    $assertSame(1700000060, $payload['exp'], 'Ticket must expire after sixty seconds.');
    $assertSame($expectedSignature, $signaturePart, 'Ticket must use an HMAC signature.');
    $assertSame('/game-socket', $result['socket_path'], 'Ticket response must expose a same-origin WebSocket path.');
    $assertSame(60, $result['expires_in'], 'Ticket response must expose its short lifetime.');

    $invalidNameResult = GameAccessTicket::issue(
        ['user_id' => 42, 'user_name' => "\xB1\x31"],
        'drawguess',
        'client-tab-alpha-0002',
        1700000000,
        'invalid-name'
    );
    [$invalidNamePayload] = explode('.', $invalidNameResult['ticket'], 2);
    $invalidNameData = json_decode($decode($invalidNamePayload), true);
    $assertSame('会员42', $invalidNameData['name'], 'Invalid UTF-8 names should use the safe member fallback.');

    $assertThrows(function () {
        GameAccessTicket::issue(['user_id' => 0], 'gomoku', 'client-tab-alpha-0003');
    }, 'Guests must not receive game tickets.');
    $assertThrows(function () {
        GameAccessTicket::issue(['user_id' => 42], 'unknown', 'client-tab-alpha-0004');
    }, 'Unknown games must not receive game tickets.');
    $assertThrows(function () {
        GameAccessTicket::issue(['user_id' => 42], 'gomoku', 'short');
    }, 'Game tickets must reject invalid browser tab identities.');

    $gameTicketConfig['game_websocket_path'] = 'https://other.example/game-socket';
    $assertThrows(function () {
        GameAccessTicket::issue(['user_id' => 42], 'gomoku', 'client-tab-alpha-0005');
    }, 'Cross-origin WebSocket endpoints must not be returned by the addon.');

    echo "Game access ticket tests passed.\n";
}
