CREATE TABLE IF NOT EXISTS `__PREFIX__vodmerge_job` (
  `job_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `source_key` varchar(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `source_id` varchar(128) COLLATE utf8mb4_bin NOT NULL,
  `payload_hash` char(64) CHARACTER SET ascii NOT NULL,
  `video_json` mediumtext NOT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'pending',
  `review_json` mediumtext NULL,
  `plan_json` mediumtext NULL,
  `creation_json` mediumtext NULL,
  `preview_token` char(64) CHARACTER SET ascii NOT NULL DEFAULT '',
  `preview_until` int unsigned NOT NULL DEFAULT 0,
  `vod_id` int unsigned NOT NULL DEFAULT 0,
  `operator_id` int unsigned NOT NULL DEFAULT 0,
  `message` varchar(255) NOT NULL DEFAULT '',
  `created_at` int unsigned NOT NULL,
  `updated_at` int unsigned NOT NULL,
  PRIMARY KEY (`job_id`),
  UNIQUE KEY `source_payload` (`source_key`, `source_id`, `payload_hash`),
  KEY `pending_jobs` (`status`, `job_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `__PREFIX__vodmerge_binding` (
  `source_key` varchar(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `source_id` varchar(128) COLLATE utf8mb4_bin NOT NULL,
  `vod_id` int unsigned NOT NULL,
  `routes_json` mediumtext NOT NULL,
  `identity_json` text NOT NULL,
  `last_job_id` bigint unsigned NOT NULL,
  PRIMARY KEY (`source_key`, `source_id`),
  KEY `target_video` (`vod_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `__PREFIX__vodmerge_audit_state` (
  `state_id` tinyint unsigned NOT NULL,
  `weekly_enabled` tinyint unsigned NOT NULL DEFAULT 0,
  `watermark` int unsigned NOT NULL DEFAULT 0,
  `last_completed_at` int unsigned NOT NULL DEFAULT 0,
  `next_run_at` int unsigned NOT NULL DEFAULT 0,
  `active_run_id` bigint unsigned NOT NULL DEFAULT 0,
  PRIMARY KEY (`state_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO `__PREFIX__vodmerge_audit_state` (`state_id`) VALUES (1);

CREATE TABLE IF NOT EXISTS `__PREFIX__vodmerge_audit_run` (
  `run_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `status` varchar(20) NOT NULL DEFAULT 'running',
  `mode` varchar(20) NOT NULL,
  `lower_id` int unsigned NOT NULL,
  `upper_id` int unsigned NOT NULL,
  `cursor_id` int unsigned NOT NULL,
  `total_count` int unsigned NOT NULL DEFAULT 0,
  `processed_count` int unsigned NOT NULL DEFAULT 0,
  `issue_count` bigint unsigned NOT NULL DEFAULT 0,
  `truncated_count` int unsigned NOT NULL DEFAULT 0,
  `started_at` int unsigned NOT NULL,
  `updated_at` int unsigned NOT NULL,
  `finished_at` int unsigned NOT NULL DEFAULT 0,
  `error_message` varchar(255) NOT NULL DEFAULT '',
  PRIMARY KEY (`run_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `__PREFIX__vodmerge_audit_key` (
  `key_hash` char(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `vod_id` int unsigned NOT NULL,
  PRIMARY KEY (`key_hash`, `vod_id`),
  KEY `audit_video` (`vod_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `__PREFIX__vodmerge_audit_issue` (
  `issue_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `run_id` bigint unsigned NOT NULL,
  `left_id` int unsigned NOT NULL,
  `right_id` int unsigned NOT NULL,
  `kind` varchar(30) NOT NULL,
  `assessment` varchar(20) NOT NULL DEFAULT 'unrated',
  `priority` tinyint unsigned NOT NULL DEFAULT 0,
  `assessment_version` smallint unsigned NOT NULL DEFAULT 0,
  `detail_json` mediumtext NOT NULL,
  `created_at` int unsigned NOT NULL,
  PRIMARY KEY (`issue_id`),
  UNIQUE KEY `audit_pair` (`run_id`, `left_id`, `right_id`),
  KEY `audit_results` (`run_id`, `kind`, `issue_id`),
  KEY `audit_quality` (`run_id`, `assessment`, `priority`, `issue_id`),
  KEY `audit_priority` (`run_id`, `priority`, `issue_id`),
  KEY `audit_assessment_pending` (`assessment_version`, `issue_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
