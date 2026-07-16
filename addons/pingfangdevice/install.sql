CREATE TABLE IF NOT EXISTS `__PREFIX__pingfang_device_session` (
  `session_id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` int(10) unsigned NOT NULL DEFAULT 0,
  `token_hash` char(64) NOT NULL,
  `login_check_hash` char(64) NOT NULL DEFAULT '',
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

-- Upgrade existing installations without relying on MySQL-version-specific
-- ALTER TABLE ... ADD COLUMN IF NOT EXISTS syntax.
SET @pingfang_login_check_hash_exists = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = '__PREFIX__pingfang_device_session'
    AND COLUMN_NAME = 'login_check_hash'
);
SET @pingfang_login_check_hash_sql = IF(
  @pingfang_login_check_hash_exists = 0,
  'ALTER TABLE `__PREFIX__pingfang_device_session` ADD COLUMN `login_check_hash` char(64) NOT NULL DEFAULT '''' AFTER `token_hash`',
  'SET @pingfang_login_check_hash_noop = 1'
);
PREPARE pingfang_login_check_hash_stmt FROM @pingfang_login_check_hash_sql;
EXECUTE pingfang_login_check_hash_stmt;
DEALLOCATE PREPARE pingfang_login_check_hash_stmt;
