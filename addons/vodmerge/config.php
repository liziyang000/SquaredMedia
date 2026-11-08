<?php

return [
    [
        'name' => 'auto_bound_updates',
        'title' => '已确认来源自动补集',
        'type' => 'radio',
        'content' => ['0' => '关闭', '1' => '开启'],
        'value' => '0',
        'rule' => 'required',
        'msg' => '',
        'tip' => '处理已确认绑定的来源，包括严格自动首绑建立的映射。冲突和外部修改进入审核。',
        'ok' => '',
        'extend' => '',
    ],
    [
        'name' => 'auto_first_matches',
        'title' => '严格自动首次绑定',
        'type' => 'radio',
        'content' => ['0' => '关闭', '1' => '开启'],
        'value' => '0',
        'rule' => 'required',
        'msg' => '',
        'tip' => '仅唯一豆瓣 ID、完整身份证据与 Jev 明确一致时自动合并到已有视频；歧义转人工，不自动新建。先验证本站数据再开启。',
        'ok' => '',
        'extend' => '',
    ],
];
