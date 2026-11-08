<?php

namespace addons\vodmerge;

class Vodmerge extends \think\Addons
{
    public function install()
    {
        return true;
    }

    public function uninstall()
    {
        // Keep source bindings and write-ahead snapshots for recovery.
        return true;
    }
}
