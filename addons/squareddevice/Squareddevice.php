<?php

namespace addons\squareddevice;

use addons\squareddevice\service\DeviceSession;
use think\Addons;

class Squareddevice extends Addons
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
    }
}
