-- MacCMS V10 vod category maintenance
-- Purpose:
--   1. Audit video rows whose category no longer exists.
--   2. Audit video rows whose type_id_1 does not match mac_type parent data.
--   3. Normalize type_id_1 from the authoritative mac_type hierarchy.
--
-- Usage:
--   mysql -uUSER -p DATABASE < scripts/sql/maccms-vod-category-maintenance.sql
--
-- If your table prefix is not mac_, replace mac_vod and mac_type first.

-- 1. Review the category hierarchy.
SELECT type_id, type_pid, type_name, type_sort
FROM mac_type
ORDER BY type_pid, type_sort, type_id;

-- 2. Find videos pointing to a missing category.
-- Fix these manually by assigning a valid type_id before normalizing type_id_1.
SELECT v.vod_id, v.vod_name, v.type_id, v.type_id_1
FROM mac_vod v
LEFT JOIN mac_type t ON v.type_id = t.type_id
WHERE t.type_id IS NULL
ORDER BY v.vod_id
LIMIT 100;

-- 3. Find videos whose first-level category is inconsistent with mac_type.
SELECT
  v.vod_id,
  v.vod_name,
  v.type_id,
  v.type_id_1,
  t.type_name,
  t.type_pid,
  CASE WHEN t.type_pid = 0 THEN t.type_id ELSE t.type_pid END AS expected_type_id_1
FROM mac_vod v
JOIN mac_type t ON v.type_id = t.type_id
WHERE COALESCE(v.type_id_1, 0) <> CASE WHEN t.type_pid = 0 THEN t.type_id ELSE t.type_pid END
ORDER BY v.vod_id
LIMIT 100;

-- 4. Normalize type_id_1 from mac_type.
-- Keep this transaction small and review the row count after execution.
START TRANSACTION;

UPDATE mac_vod v
JOIN mac_type t ON v.type_id = t.type_id
SET v.type_id_1 = CASE
  WHEN t.type_pid = 0 THEN t.type_id
  ELSE t.type_pid
END
WHERE COALESCE(v.type_id_1, 0) <> CASE
  WHEN t.type_pid = 0 THEN t.type_id
  ELSE t.type_pid
END;

SELECT ROW_COUNT() AS normalized_vod_rows;

-- 5. Confirm no hierarchy mismatch remains after the update.
SELECT COUNT(*) AS remaining_type_id_1_mismatch
FROM mac_vod v
JOIN mac_type t ON v.type_id = t.type_id
WHERE COALESCE(v.type_id_1, 0) <> CASE WHEN t.type_pid = 0 THEN t.type_id ELSE t.type_pid END;

-- If the result looks wrong, run ROLLBACK instead of COMMIT.
-- ROLLBACK;
COMMIT;
