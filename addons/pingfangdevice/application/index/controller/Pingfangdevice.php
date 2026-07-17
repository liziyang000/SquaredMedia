<?php

namespace app\index\controller;

use addons\pingfangdevice\controller\DeviceActions;
use addons\pingfangdevice\service\DeviceSession;

class Pingfangdevice extends Base
{
    use DeviceActions;

    public function index()
    {
        $user = DeviceSession::currentUser();
        if (empty($user)) {
            return redirect(url('user/login'));
        }

        $this->assign('obj', $user);
        $this->assign('user', $user);
        $this->assign('device_list', DeviceSession::listSessions($user['user_id']));
        $this->assign('max_devices', DeviceSession::maxDeviceCount());
        return $this->fetch('pingfangdevice/index');
    }
}
