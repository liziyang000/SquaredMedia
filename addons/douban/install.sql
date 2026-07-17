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

INSERT IGNORE INTO `__PREFIX__douban_config` (`config_key`, `config_value`, `updated_at`) VALUES
('douban_endpoint', 'internal', UNIX_TIMESTAMP()),
('exclude_type_ids', '', UNIX_TIMESTAMP()),
('batch_size', '100', UNIX_TIMESTAMP()),
('worker_limit', '20', UNIX_TIMESTAMP()),
('request_per_minute', '30', UNIX_TIMESTAMP()),
('max_attempts', '5', UNIX_TIMESTAMP()),
('auto_confirm_score', '85', UNIX_TIMESTAMP()),
('candidate_topn', '5', UNIX_TIMESTAMP()),
('rate_limit_next_at', '0', UNIX_TIMESTAMP());

UPDATE `__PREFIX__douban_config`
SET `config_value` = 'internal', `updated_at` = UNIX_TIMESTAMP()
WHERE `config_key` = 'douban_endpoint'
  AND `config_value` = '/extend/douban.php';
