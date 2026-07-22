<?php

namespace addons\pingfangapi\service;

class ApiException extends \RuntimeException
{
    private $status;

    public function __construct($status, $message)
    {
        $this->status = intval($status);
        parent::__construct((string) $message, $this->status);
    }

    public function status()
    {
        return $this->status;
    }
}
