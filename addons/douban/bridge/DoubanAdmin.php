<?php

namespace app\admin\controller;

use addons\douban\controller\Index as AddonIndex;
use think\Request;

class Douban extends AddonIndex
{
    public function __construct(?Request $request = null)
    {
        $request = $request ?: Request::instance();
        $request->route([
            'addon' => 'douban',
            'controller' => 'index',
            'action' => $request->action() ?: 'index',
        ]);

        parent::__construct($request);
    }
}
