<?php

namespace app\admin\controller;

use addons\vodops\backend\DoubanController;
use think\Request;

class Douban extends DoubanController
{
    public function __construct(?Request $request = null)
    {
        $request = $request ?: Request::instance();
        $request->route([
            'addon' => 'vodops',
            'controller' => 'index',
            'action' => $request->action() ?: 'index',
        ]);

        parent::__construct($request);
    }
}
