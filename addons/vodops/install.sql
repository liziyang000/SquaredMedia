CREATE TABLE IF NOT EXISTS `__PREFIX__vodops_lock` (
  `lock_name` varchar(32) NOT NULL,
  PRIMARY KEY (`lock_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO `__PREFIX__vodops_lock` (`lock_name`) VALUES ('scan_start');

CREATE TABLE IF NOT EXISTS `__PREFIX__vodops_scan` (
  `run_id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `status` varchar(16) NOT NULL DEFAULT 'running',
  `total_count` int(10) unsigned NOT NULL DEFAULT 0,
  `max_vod_id` int(10) unsigned NOT NULL DEFAULT 0,
  `last_vod_id` int(10) unsigned NOT NULL DEFAULT 0,
  `processed_count` int(10) unsigned NOT NULL DEFAULT 0,
  `issue_count` int(10) unsigned NOT NULL DEFAULT 0,
  `batch_size` smallint(5) unsigned NOT NULL DEFAULT 500,
  `started_by` int(10) unsigned NOT NULL DEFAULT 0,
  `finished_by` int(10) unsigned NOT NULL DEFAULT 0,
  `started_at` int(10) unsigned NOT NULL DEFAULT 0,
  `finished_at` int(10) unsigned NOT NULL DEFAULT 0,
  `updated_at` int(10) unsigned NOT NULL DEFAULT 0,
  `error_message` varchar(255) NOT NULL DEFAULT '',
  `scope_json` text NULL,
  `execution_mode` varchar(16) NOT NULL DEFAULT 'manual',
  `lease_until` int(10) unsigned NOT NULL DEFAULT 0,
  `next_run_at` int(10) unsigned NOT NULL DEFAULT 0,
  PRIMARY KEY (`run_id`),
  KEY `idx_status_updated` (`status`, `updated_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Upgrade existing installations without relying on MySQL-version-specific
-- ALTER TABLE ... ADD COLUMN IF NOT EXISTS syntax.
SET @vodops_scope_json_exists = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = '__PREFIX__vodops_scan'
    AND COLUMN_NAME = 'scope_json'
);
SET @vodops_scope_json_sql = IF(
  @vodops_scope_json_exists = 0,
  'ALTER TABLE `__PREFIX__vodops_scan` ADD COLUMN `scope_json` text NULL AFTER `error_message`',
  'SET @vodops_scope_json_noop = 1'
);
PREPARE vodops_scope_json_stmt FROM @vodops_scope_json_sql;
EXECUTE vodops_scope_json_stmt;
DEALLOCATE PREPARE vodops_scope_json_stmt;

SET @vodops_execution_mode_exists = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = '__PREFIX__vodops_scan'
    AND COLUMN_NAME = 'execution_mode'
);
SET @vodops_execution_mode_sql = IF(
  @vodops_execution_mode_exists = 0,
  'ALTER TABLE `__PREFIX__vodops_scan` ADD COLUMN `execution_mode` varchar(16) NOT NULL DEFAULT ''manual'' AFTER `scope_json`',
  'SET @vodops_execution_mode_noop = 1'
);
PREPARE vodops_execution_mode_stmt FROM @vodops_execution_mode_sql;
EXECUTE vodops_execution_mode_stmt;
DEALLOCATE PREPARE vodops_execution_mode_stmt;

SET @vodops_lease_until_exists = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = '__PREFIX__vodops_scan'
    AND COLUMN_NAME = 'lease_until'
);
SET @vodops_lease_until_sql = IF(
  @vodops_lease_until_exists = 0,
  'ALTER TABLE `__PREFIX__vodops_scan` ADD COLUMN `lease_until` int(10) unsigned NOT NULL DEFAULT 0 AFTER `execution_mode`',
  'SET @vodops_lease_until_noop = 1'
);
PREPARE vodops_lease_until_stmt FROM @vodops_lease_until_sql;
EXECUTE vodops_lease_until_stmt;
DEALLOCATE PREPARE vodops_lease_until_stmt;

SET @vodops_next_run_at_exists = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = '__PREFIX__vodops_scan'
    AND COLUMN_NAME = 'next_run_at'
);
SET @vodops_next_run_at_sql = IF(
  @vodops_next_run_at_exists = 0,
  'ALTER TABLE `__PREFIX__vodops_scan` ADD COLUMN `next_run_at` int(10) unsigned NOT NULL DEFAULT 0 AFTER `lease_until`',
  'SET @vodops_next_run_at_noop = 1'
);
PREPARE vodops_next_run_at_stmt FROM @vodops_next_run_at_sql;
EXECUTE vodops_next_run_at_stmt;
DEALLOCATE PREPARE vodops_next_run_at_stmt;

CREATE TABLE IF NOT EXISTS `__PREFIX__vodops_issue` (
  `issue_id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `run_id` int(10) unsigned NOT NULL DEFAULT 0,
  `vod_id` int(10) unsigned NOT NULL DEFAULT 0,
  `vod_name` varchar(255) NOT NULL DEFAULT '',
  `type_id` int(10) unsigned NOT NULL DEFAULT 0,
  `issue_type` varchar(40) NOT NULL DEFAULT '',
  `field_name` varchar(40) NOT NULL DEFAULT '',
  `current_value` varchar(255) NOT NULL DEFAULT '',
  `message` varchar(255) NOT NULL DEFAULT '',
  `detail_json` text NULL,
  `created_at` int(10) unsigned NOT NULL DEFAULT 0,
  PRIMARY KEY (`issue_id`),
  UNIQUE KEY `uniq_run_vod_issue` (`run_id`, `vod_id`, `issue_type`),
  KEY `idx_run_type_vod` (`run_id`, `issue_type`, `vod_id`),
  KEY `idx_run_vod` (`run_id`, `vod_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `__PREFIX__vodops_fingerprint` (
  `run_id` int(10) unsigned NOT NULL DEFAULT 0,
  `vod_id` int(10) unsigned NOT NULL DEFAULT 0,
  `fingerprint` char(64) NOT NULL,
  PRIMARY KEY (`run_id`, `vod_id`),
  KEY `idx_run_fingerprint` (`run_id`, `fingerprint`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `__PREFIX__vodops_repair_log` (
  `repair_id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `issue_id` bigint(20) unsigned NOT NULL DEFAULT 0,
  `run_id` int(10) unsigned NOT NULL DEFAULT 0,
  `vod_id` int(10) unsigned NOT NULL DEFAULT 0,
  `issue_type` varchar(40) NOT NULL DEFAULT '',
  `action` varchar(16) NOT NULL DEFAULT '',
  `operation_status` varchar(16) NOT NULL DEFAULT 'pending',
  `result_status` varchar(16) NOT NULL DEFAULT 'pending',
  `before_json` text NULL,
  `after_json` text NULL,
  `guard_json` text NULL,
  `source` varchar(32) NOT NULL DEFAULT '',
  `admin_id` int(10) unsigned NOT NULL DEFAULT 0,
  `related_repair_id` bigint(20) unsigned NOT NULL DEFAULT 0,
  `created_at` int(10) unsigned NOT NULL DEFAULT 0,
  `finished_at` int(10) unsigned NOT NULL DEFAULT 0,
  PRIMARY KEY (`repair_id`),
  KEY `idx_issue_repair` (`issue_id`, `repair_id`),
  KEY `idx_vod_created` (`vod_id`, `created_at`),
  KEY `idx_status_created` (`operation_status`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
