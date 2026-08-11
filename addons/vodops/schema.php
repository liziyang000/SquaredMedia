<?php

return [
    'douban_config' => [
        'config_key', 'config_value', 'updated_at',
    ],
    'douban_vod_meta' => [
        'vod_id', 'douban_id', 'douban_id_locked', 'douban_id_lock_time',
        'douban_id_source', 'douban_id_confidence', 'douban_review_status',
        'douban_review_reason', 'douban_ignore_until', 'douban_last_sync_at',
        'douban_next_sync_at', 'douban_sync_fail_count', 'douban_last_fail_at',
        'douban_last_fail_reason', 'intro_locked', 'intro_lock_time',
        'intro_ai_source', 'intro_ai_last_at', 'intro_ai_fail_count',
        'intro_ai_last_fail_at', 'intro_ai_last_fail_reason', 'created_at', 'updated_at',
    ],
    'douban_task' => [
        'task_id', 'vod_id', 'task_type', 'status', 'priority', 'run_after',
        'attempts', 'last_error', 'payload', 'created_at', 'updated_at',
    ],
    'douban_log' => [
        'log_id', 'vod_id', 'action', 'old_values', 'new_values', 'reason',
        'score', 'operator', 'created_at',
    ],
    'douban_review_candidate' => [
        'id', 'vod_id', 'douban_id', 'score_total', 'score_detail', 'conflicts',
        'rank', 'created_at',
    ],
    'douban_scan' => [
        'scan_id', 'status', 'high_water_vod_id', 'cursor_vod_id', 'total_videos',
        'scanned_videos', 'issue_count', 'batch_size', 'run_by', 'batch_lock_until',
        'error_message', 'started_at', 'updated_at', 'finished_at', 'created_at',
    ],
    'douban_scan_issue' => [
        'issue_id', 'scan_id', 'vod_id', 'type_id', 'vod_name', 'issue_level',
        'issue_code', 'field_name', 'message', 'snapshot', 'created_at',
    ],
];
