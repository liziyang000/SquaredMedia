<?php

namespace addons\pingfangdevice;

use addons\pingfangdevice\service\DeviceSession;
use addons\pingfangdevice\service\ThemeAssets;
use think\Addons;

class Pingfangdevice extends Addons
{
    public function install()
    {
        return true;
    }

    public function uninstall()
    {
        return true;
    }

    public function appBegin(&$params)
    {
        DeviceSession::syncActiveCookie();
        if (preg_match('#^vod/(?:play|player)(?:/|$)#i', request()->path())) {
            $GLOBALS['config']['app']['cache_page'] = 0;
        }
        ThemeAssets::preload();
    }
}
