CREATE TABLE IF NOT EXISTS `__PREFIX__vodmerge_case` (
  `left_id` int unsigned NOT NULL,
  `right_id` int unsigned NOT NULL,
  `issue_id` bigint unsigned NOT NULL,
  `assessment` varchar(20) NOT NULL,
  `priority` tinyint unsigned NOT NULL DEFAULT 0,
  `discovered_at` int unsigned NOT NULL,
  `search_text` text NULL,
  `decision` varchar(20) NOT NULL DEFAULT 'pending',
  `identity_signature` char(64) CHARACTER SET ascii NOT NULL DEFAULT '',
  `resource_signature` char(64) CHARACTER SET ascii NOT NULL DEFAULT '',
  `resolution` varchar(20) NOT NULL DEFAULT '',
  `reason` varchar(200) NOT NULL DEFAULT '',
  `actor_id` int unsigned NOT NULL DEFAULT 0,
  `reviewed_at` int unsigned NOT NULL DEFAULT 0,
  `snoozed_until` int unsigned NOT NULL DEFAULT 0,
  `job_id` bigint unsigned NOT NULL DEFAULT 0,
  PRIMARY KEY (`left_id`,`right_id`),
  KEY `case_issue` (`issue_id`),
  KEY `case_right` (`right_id`,`left_id`),
  KEY `case_review` (`identity_signature`,`job_id`,`priority`,`issue_id`,`assessment`),
  KEY `case_priority` (`priority`,`issue_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `__PREFIX__vodmerge_event` (
  `event_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `left_id` int unsigned NOT NULL,
  `right_id` int unsigned NOT NULL,
  `kind` varchar(30) NOT NULL,
  `actor_id` int unsigned NOT NULL,
  `job_id` bigint unsigned NOT NULL DEFAULT 0,
  `detail_json` text NOT NULL,
  `event_key` varchar(100) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `created_at` int unsigned NOT NULL,
  PRIMARY KEY (`event_id`),
  UNIQUE KEY `event_once` (`event_key`),
  KEY `pair_events` (`left_id`,`right_id`,`event_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
