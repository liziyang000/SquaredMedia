<?php

namespace addons\pingfangdevice;

use addons\pingfangdevice\service\DeviceSession;
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
    }
}
