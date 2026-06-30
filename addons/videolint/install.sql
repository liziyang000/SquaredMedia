CREATE TABLE IF NOT EXISTS `__PREFIX__pingfang_video_lint_scan` (
  `scan_id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `run_by` int(10) unsigned NOT NULL DEFAULT 0,
  `status` varchar(16) NOT NULL DEFAULT 'running',
  `total_videos` int(10) unsigned NOT NULL DEFAULT 0,
  `scanned_videos` int(10) unsigned NOT NULL DEFAULT 0,
  `issue_count` int(10) unsigned NOT NULL DEFAULT 0,
  `options_json` text NULL,
  `error_message` varchar(255) NOT NULL DEFAULT '',
  `started_at` int(10) unsigned NOT NULL DEFAULT 0,
  `finished_at` int(10) unsigned NOT NULL DEFAULT 0,
  `created_at` int(10) unsigned NOT NULL DEFAULT 0,
  PRIMARY KEY (`scan_id`),
  KEY `idx_status` (`status`),
  KEY `idx_started_at` (`started_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

CREATE TABLE IF NOT EXISTS `__PREFIX__pingfang_video_lint_issue` (
  `issue_id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `scan_id` int(10) unsigned NOT NULL DEFAULT 0,
  `vod_id` int(10) unsigned NOT NULL DEFAULT 0,
  `vod_name` varchar(255) NOT NULL DEFAULT '',
  `issue_level` varchar(16) NOT NULL DEFAULT 'warning',
  `issue_code` varchar(64) NOT NULL DEFAULT '',
  `field_name` varchar(64) NOT NULL DEFAULT '',
  `message` varchar(255) NOT NULL DEFAULT '',
  `snapshot` text NULL,
  `created_at` int(10) unsigned NOT NULL DEFAULT 0,
  `resolved_at` int(10) unsigned NOT NULL DEFAULT 0,
  `resolved_by` int(10) unsigned NOT NULL DEFAULT 0,
  PRIMARY KEY (`issue_id`),
  KEY `idx_scan_level` (`scan_id`,`issue_level`),
  KEY `idx_scan` (`scan_id`),
  KEY `idx_vod` (`vod_id`),
  KEY `idx_resolved` (`resolved_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
