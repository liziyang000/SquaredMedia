<?php

return [
    [
        'name' => 'max_devices',
        'title' => '最大同时在线设备数',
        'type' => 'string',
        'content' => [],
        'value' => '3',
        'rule' => 'required;integer',
        'msg' => '',
        'tip' => '超过该数量后自动踢掉最早登录的设备。',
        'ok' => '',
        'extend' => '',
    ],
    [
        'name' => 'device_token_cookie',
        'title' => '设备 Token Cookie',
        'type' => 'string',
        'content' => [],
        'value' => 'squared_media_device_token',
        'rule' => 'required',
        'msg' => '',
        'tip' => '用于识别当前登录设备，请勿与其他 Cookie 重名。',
        'ok' => '',
        'extend' => '',
    ],
];
