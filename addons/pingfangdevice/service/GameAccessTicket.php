<?php

namespace addons\pingfangdevice\service;

class GameAccessTicket
{
    const AUDIENCE = 'pingfang-games';
    const LIFETIME_SECONDS = 60;
    const MIN_SECRET_LENGTH = 32;

    public static function issue(array $user, $game, $clientId, $now = null, $nonce = null)
    {
        $userId = intval($user['user_id'] ?? 0);
        $game = (string) $game;
        $clientId = (string) $clientId;
        if ($userId < 1) {
            throw new \RuntimeException('请先登录');
        }
        if (!in_array($game, ['gomoku', 'drawguess'], true)) {
            throw new \InvalidArgumentException('不支持的游戏');
        }
        if (!preg_match('/^[A-Za-z0-9_-]{16,64}$/D', $clientId)) {
            throw new \InvalidArgumentException('客户端标识无效');
        }

        $config = function_exists('get_addon_config') ? get_addon_config('pingfangdevice') : [];
        $secret = (string) ($config['game_ticket_secret'] ?? '');
        if (strlen($secret) < self::MIN_SECRET_LENGTH) {
            throw new \RuntimeException('联机服务尚未配置');
        }
        $socketPath = self::socketPath($config['game_websocket_path'] ?? '/game-socket');
        $issuedAt = $now === null ? time() : intval($now);
        $name = self::plainName($user['user_name'] ?? '', $userId);
        $payload = [
            'aud' => self::AUDIENCE,
            'sub' => (string) $userId,
            'name' => $name,
            'game' => $game,
            'cid' => $clientId,
            'iat' => $issuedAt,
            'exp' => $issuedAt + self::LIFETIME_SECONDS,
            'jti' => $nonce === null ? self::base64Url(random_bytes(12)) : (string) $nonce,
        ];
        $json = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        if ($json === false) {
            throw new \RuntimeException('联机票据编码失败');
        }
        $payloadPart = self::base64Url($json);
        $signaturePart = self::base64Url(hash_hmac('sha256', $payloadPart, $secret, true));

        return [
            'ticket' => $payloadPart . '.' . $signaturePart,
            'socket_path' => $socketPath,
            'expires_in' => self::LIFETIME_SECONDS,
        ];
    }

    private static function socketPath($value)
    {
        $path = trim((string) $value);
        if ($path === '') {
            $path = '/game-socket';
        }
        if ($path[0] !== '/'
            || substr($path, 0, 2) === '//'
            || strpos($path, '://') !== false
            || preg_match('/[\x00-\x20\x7f]/', $path)
        ) {
            throw new \RuntimeException('联机服务地址配置无效');
        }
        return $path;
    }

    private static function plainName($value, $userId)
    {
        $name = trim(strip_tags((string) $value));
        $cleaned = preg_replace('/[\x00-\x1F\x7F]/u', '', $name);
        $name = is_string($cleaned) ? $cleaned : '';
        if ($name === '') {
            $name = '会员' . $userId;
        }
        return function_exists('mb_substr') ? mb_substr($name, 0, 24, 'UTF-8') : substr($name, 0, 24);
    }

    private static function base64Url($value)
    {
        return rtrim(strtr(base64_encode((string) $value), '+/', '-_'), '=');
    }
}
