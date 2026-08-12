CREATE TABLE IF NOT EXISTS `__PREFIX__vodops_lock` (
  `lock_name` varchar(32) NOT NULL,
  PRIMARY KEY (`lock_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Keep the original douban_* names so existing addon data remains usable after
-- the Douban module is absorbed into VodOps. All statements are additive and
-- intentionally avoid renaming or dropping production tables.
CREATE TABLE IF NOT EXISTS `__PREFIX__douban_config` (
  `config_key` varchar(64) NOT NULL,
  `config_value` text NULL,
  `updated_at` int(10) unsigned NOT NULL DEFAULT 0,
  PRIMARY KEY (`config_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

CREATE TABLE IF NOT EXISTS `__PREFIX__douban_vod_meta` (
  `vod_id` int(10) unsigned NOT NULL,
  `douban_id` varchar(20) NOT NULL DEFAULT '',
  `douban_id_locked` tinyint(1) unsigned NOT NULL DEFAULT 0,
  `douban_id_lock_time` int(10) unsigned NOT NULL DEFAULT 0,
  `douban_id_source` varchar(16) NOT NULL DEFAULT '',
  `douban_id_confidence` smallint(5) unsigned NOT NULL DEFAULT 0,
  `douban_review_status` varchar(16) NOT NULL DEFAULT '',
  `douban_review_reason` varchar(255) NOT NULL DEFAULT '',
  `douban_ignore_until` int(10) unsigned NOT NULL DEFAULT 0,
  `douban_last_sync_at` int(10) unsigned NOT NULL DEFAULT 0,
  `douban_next_sync_at` int(10) unsigned NOT NULL DEFAULT 0,
  `douban_sync_fail_count` int(10) unsigned NOT NULL DEFAULT 0,
  `douban_last_fail_at` int(10) unsigned NOT NULL DEFAULT 0,
  `douban_last_fail_reason` varchar(255) NOT NULL DEFAULT '',
  `intro_locked` tinyint(1) unsigned NOT NULL DEFAULT 0,
  `intro_lock_time` int(10) unsigned NOT NULL DEFAULT 0,
  `intro_ai_source` varchar(32) NOT NULL DEFAULT '',
  `intro_ai_last_at` int(10) unsigned NOT NULL DEFAULT 0,
  `intro_ai_fail_count` int(10) unsigned NOT NULL DEFAULT 0,
  `intro_ai_last_fail_at` int(10) unsigned NOT NULL DEFAULT 0,
  `intro_ai_last_fail_reason` varchar(255) NOT NULL DEFAULT '',
  `created_at` int(10) unsigned NOT NULL DEFAULT 0,
  `updated_at` int(10) unsigned NOT NULL DEFAULT 0,
  PRIMARY KEY (`vod_id`),
  KEY `idx_douban_next_sync_at` (`douban_next_sync_at`,`douban_review_status`),
  KEY `idx_douban_review_status` (`douban_review_status`,`douban_next_sync_at`),
  KEY `idx_vod_douban_id` (`douban_id`),
  KEY `idx_intro_locked` (`intro_locked`,`intro_ai_last_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

CREATE TABLE IF NOT EXISTS `__PREFIX__douban_task` (
  `task_id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `vod_id` int(10) unsigned NOT NULL DEFAULT 0,
  `task_type` varchar(32) NOT NULL DEFAULT '',
  `status` varchar(16) NOT NULL DEFAULT 'PENDING',
  `priority` int(10) NOT NULL DEFAULT 0,
  `run_after` int(10) unsigned NOT NULL DEFAULT 0,
  `attempts` int(10) unsigned NOT NULL DEFAULT 0,
  `last_error` varchar(255) NOT NULL DEFAULT '',
  `payload` text NULL,
  `created_at` int(10) unsigned NOT NULL DEFAULT 0,
  `updated_at` int(10) unsigned NOT NULL DEFAULT 0,
  PRIMARY KEY (`task_id`),
  KEY `idx_task_poll` (`status`,`run_after`,`priority`),
  KEY `idx_task_vod_type` (`vod_id`,`task_type`,`status`),
  KEY `idx_task_type_status_attempts` (`task_type`,`status`,`attempts`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

SET @douban_task_stats_index_exists = (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = '__PREFIX__douban_task'
    AND INDEX_NAME = 'idx_task_type_status_attempts'
);
SET @douban_task_stats_index_sql = IF(
  @douban_task_stats_index_exists = 0,
  'ALTER TABLE `__PREFIX__douban_task` ADD INDEX `idx_task_type_status_attempts` (`task_type`,`status`,`attempts`)',
  'SET @douban_task_stats_index_noop = 1'
);
PREPARE douban_task_stats_index_stmt FROM @douban_task_stats_index_sql;
EXECUTE douban_task_stats_index_stmt;
DEALLOCATE PREPARE douban_task_stats_index_stmt;

CREATE TABLE IF NOT EXISTS `__PREFIX__douban_log` (
  `log_id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `vod_id` int(10) unsigned NOT NULL DEFAULT 0,
  `action` varchar(32) NOT NULL DEFAULT '',
  `old_values` text NULL,
  `new_values` text NULL,
  `reason` varchar(255) NOT NULL DEFAULT '',
  `score` smallint(5) unsigned NOT NULL DEFAULT 0,
  `operator` varchar(64) NOT NULL DEFAULT '',
  `created_at` int(10) unsigned NOT NULL DEFAULT 0,
  PRIMARY KEY (`log_id`),
  KEY `idx_vod_action` (`vod_id`,`action`,`created_at`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

CREATE TABLE IF NOT EXISTS `__PREFIX__douban_review_candidate` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `vod_id` int(10) unsigned NOT NULL DEFAULT 0,
  `douban_id` varchar(20) NOT NULL DEFAULT '',
  `score_total` smallint(5) unsigned NOT NULL DEFAULT 0,
  `score_detail` text NULL,
  `conflicts` text NULL,
  `rank` smallint(5) unsigned NOT NULL DEFAULT 0,
  `created_at` int(10) unsigned NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `idx_vod_rank` (`vod_id`,`rank`),
  KEY `idx_candidate_douban_id` (`douban_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

CREATE TABLE IF NOT EXISTS `__PREFIX__douban_scan` (
  `scan_id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `status` varchar(16) NOT NULL DEFAULT 'RUNNING',
  `high_water_vod_id` int(10) unsigned NOT NULL DEFAULT 0,
  `cursor_vod_id` int(10) unsigned NOT NULL DEFAULT 0,
  `total_videos` int(10) unsigned NOT NULL DEFAULT 0,
  `scanned_videos` int(10) unsigned NOT NULL DEFAULT 0,
  `issue_count` int(10) unsigned NOT NULL DEFAULT 0,
  `batch_size` smallint(5) unsigned NOT NULL DEFAULT 100,
  `run_by` int(10) unsigned NOT NULL DEFAULT 0,
  `batch_lock_until` int(10) unsigned NOT NULL DEFAULT 0,
  `error_message` varchar(255) NOT NULL DEFAULT '',
  `started_at` int(10) unsigned NOT NULL DEFAULT 0,
  `updated_at` int(10) unsigned NOT NULL DEFAULT 0,
  `finished_at` int(10) unsigned NOT NULL DEFAULT 0,
  `created_at` int(10) unsigned NOT NULL DEFAULT 0,
  PRIMARY KEY (`scan_id`),
  KEY `idx_scan_status` (`status`,`updated_at`),
  KEY `idx_scan_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

CREATE TABLE IF NOT EXISTS `__PREFIX__douban_scan_issue` (
  `issue_id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `scan_id` int(10) unsigned NOT NULL DEFAULT 0,
  `vod_id` int(10) unsigned NOT NULL DEFAULT 0,
  `type_id` int(10) unsigned NOT NULL DEFAULT 0,
  `vod_name` varchar(255) NOT NULL DEFAULT '',
  `issue_level` varchar(16) NOT NULL DEFAULT 'warning',
  `issue_code` varchar(64) NOT NULL DEFAULT '',
  `field_name` varchar(64) NOT NULL DEFAULT '',
  `message` varchar(255) NOT NULL DEFAULT '',
  `snapshot` text NULL,
  `created_at` int(10) unsigned NOT NULL DEFAULT 0,
  PRIMARY KEY (`issue_id`),
  KEY `idx_scan_issue` (`scan_id`,`issue_id`),
  KEY `idx_scan_code_issue` (`scan_id`,`issue_code`,`issue_id`),
  KEY `idx_scan_level_issue` (`scan_id`,`issue_level`,`issue_id`),
  KEY `idx_scan_vod` (`scan_id`,`vod_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

INSERT IGNORE INTO `__PREFIX__douban_config` (`config_key`, `config_value`, `updated_at`) VALUES
('douban_endpoint', 'internal', UNIX_TIMESTAMP()),
('exclude_type_ids', '', UNIX_TIMESTAMP()),
('batch_size', '100', UNIX_TIMESTAMP()),
('worker_limit', '20', UNIX_TIMESTAMP()),
('request_per_minute', '30', UNIX_TIMESTAMP()),
('max_attempts', '5', UNIX_TIMESTAMP()),
('auto_confirm_score', '85', UNIX_TIMESTAMP()),
('candidate_topn', '5', UNIX_TIMESTAMP()),
('audit_start_lock', '0', UNIX_TIMESTAMP()),
('rate_limit_next_at', '0', UNIX_TIMESTAMP());

UPDATE `__PREFIX__douban_config`
SET `config_value` = 'internal', `updated_at` = UNIX_TIMESTAMP()
WHERE `config_key` = 'douban_endpoint'
  AND `config_value` = '/extend/douban.php';

INSERT IGNORE INTO `__PREFIX__vodops_lock` (`lock_name`) VALUES ('scan_start'), ('douban_enqueue');

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
