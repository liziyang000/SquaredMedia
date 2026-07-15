CREATE TABLE IF NOT EXISTS `__PREFIX__squared_media_device_session` (
  `session_id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` int(10) unsigned NOT NULL DEFAULT 0,
  `token_hash` char(64) NOT NULL,
  `device_label` varchar(120) NOT NULL DEFAULT '',
  `user_agent` varchar(255) NOT NULL DEFAULT '',
  `ip_address` varchar(45) NOT NULL DEFAULT '',
  `login_time` int(10) unsigned NOT NULL DEFAULT 0,
  `last_seen_time` int(10) unsigned NOT NULL DEFAULT 0,
  `revoked_time` int(10) unsigned NOT NULL DEFAULT 0,
  `revoked_reason` varchar(40) NOT NULL DEFAULT '',
  PRIMARY KEY (`session_id`),
  UNIQUE KEY `uniq_token_hash` (`token_hash`),
  KEY `idx_user_active` (`user_id`, `revoked_time`, `last_seen_time`),
  KEY `idx_user_login` (`user_id`, `login_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
