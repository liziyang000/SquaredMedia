"""Independently verify the offline cleanup result without executing its SQL."""

import argparse
from collections import Counter, defaultdict
import gzip
import hashlib
import json
from pathlib import Path
import re
import sqlite3
import time

from vod_cleanup_dump import decode_token, iter_insert_rows


REFERENCE_TABLES = {
    "mac_ulog", "mac_dynamics", "mac_vodmerge_audit_key", "mac_vod_repeat",
    "mac_vod_search", "mac_art", "mac_topic", "mac_manga",
}
CHANGED_TABLES = REFERENCE_TABLES | {"mac_vod"}
CREATE = re.compile(rb"CREATE TABLE `([^`]+)` \(")
COLUMN = re.compile(rb"\s+`([^`]+)`\s")


def canonical(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"), default=str)


def require(condition, message):
    if not condition:
        raise ValueError(message)


def row_digest(row):
    return hashlib.sha256(canonical(row).encode("utf-8")).digest()


def id_list(value):
    return [part.strip() for part in str(value).split(",") if part.strip()]


def mapped_list(value, mapping, self_id=None):
    parts = str(value).split(",")
    if not any(part.strip() in mapping for part in parts):
        return value
    result = []
    for part in parts:
        old = part.strip()
        new = str(mapping.get(old, old))
        if old in mapping and new == str(self_id):
            continue
        if new and new not in result:
            result.append(new)
    return ",".join(result)


def playlist(row, kind):
    """Read effective full route tuples, preserving episode bytes and order."""
    fields = [f"vod_{kind}_{part}" for part in ("from", "url", "server", "note")]
    if row[fields[0]] == "" and row[fields[1]] == "":
        return []
    sources, urls = row[fields[0]].split("$$$"), row[fields[1]].split("$$$")
    servers = row[fields[2]].split("$$$") if row[fields[2]] else ["no"] * len(sources)
    notes = row[fields[3]].split("$$$") if row[fields[3]] else [""] * len(sources)
    require(len(sources) == len(urls) == len(servers) == len(notes), "Merged source or target has misaligned route fields")
    return list(zip(sources, urls, servers, notes))


def scan_dump(path, on_row, decode_tables):
    schemas, counts, hashes = {}, Counter(), defaultdict(hashlib.sha256)
    current = None
    file_hash, non_insert_hash = hashlib.sha256(), hashlib.sha256()
    with path.open("rb") as stream:
        for line_number, raw in enumerate(stream, 1):
            file_hash.update(raw)
            if raw.startswith(b"INSERT INTO "):
                table, rows = iter_insert_rows(raw.decode("utf-8"))
                require(table in schemas, f"INSERT before schema: {table}")
                hashes[table].update(raw)
                columns = schemas[table]
                for tokens in rows:
                    require(len(tokens) == len(columns), f"Wrong field count in {table}, line {line_number}")
                    counts[table] += 1
                    if table in decode_tables:
                        on_row(table, dict(zip(columns, map(decode_token, tokens))))
            else:
                non_insert_hash.update(raw)
                match = CREATE.match(raw)
                if match:
                    current = match[1].decode("ascii")
                    schemas[current] = []
                    counts[current] = 0
                elif current is not None:
                    column = COLUMN.match(raw)
                    if column:
                        schemas[current].append(column[1].decode("ascii"))
                    elif raw.startswith(b")"):
                        current = None
    return {
        "schemas": schemas, "rows": dict(counts),
        "insert_sha256": {table: digest.hexdigest() for table, digest in hashes.items()},
        "sha256": file_hash.hexdigest(), "non_insert_sha256": non_insert_hash.hexdigest(),
    }


def verify(source, output):
    started = time.monotonic()
    work = output / ".analysis"
    destination = output / "squaredmedia_cleaned_2026-11-06.sql"
    id_map = json.loads((work / "id_map.json").read_text())
    merged = json.loads((work / "merged.json").read_text())
    routes = json.loads((work / "route_maps.json").read_text())
    anomalies = set(json.loads((work / "anomaly_ids.json").read_text()))
    removed = {int(value) for value in id_map}
    keepers = {int(value) for value in merged}
    require(not removed & keepers, "Deleted and retained target ID sets overlap")
    require(not (removed | keepers) & anomalies, "Anomaly row included in merge plan")
    require({int(value) for value in id_map.values()} == keepers, "ID map does not cover exactly the merge targets")
    db = sqlite3.connect(f"file:{work / 'records.sqlite'}?mode=ro", uri=True)
    original_ids = {row[0] for row in db.execute("SELECT id FROM vod")}
    require(removed | keepers <= original_ids, "Plan contains nonexistent source IDs")

    def original(ident):
        row = db.execute("SELECT data FROM vod WHERE id=?", (int(ident),)).fetchone()
        require(row is not None, "Output contains unknown video ID")
        return json.loads(row[0])

    actual_ids, actual_targets, unique_audit_keys = set(), {}, set()
    actual_references = defaultdict(Counter)
    anomaly_checked = 0
    unchanged_vod_checked = 0
    rel_only_vod_changed = 0

    def require_current_reference(value, context):
        require(str(value) not in id_map, f"Dangling deleted video ID in {context}")

    def output_row(table, row):
        nonlocal anomaly_checked, unchanged_vod_checked, rel_only_vod_changed
        if table == "mac_vod":
            ident = row["vod_id"]
            require(ident not in actual_ids, "Duplicate mac_vod primary key")
            require(ident not in removed, "Deleted source row remains in output")
            actual_ids.add(ident)
            old = original(ident)
            if ident in anomalies:
                require(canonical(row) == canonical(old), "Anomaly row changed in actual SQL")
                anomaly_checked += 1
            if ident in keepers:
                expected = dict(merged[str(ident)])
                expected["vod_rel_vod"] = mapped_list(expected["vod_rel_vod"], id_map, ident)
                require(canonical(row) == canonical(expected), "Actual target differs from recorded merge result")
                actual_targets[ident] = row
            else:
                expected = dict(old)
                expected["vod_rel_vod"] = mapped_list(old["vod_rel_vod"], id_map, ident)
                require(canonical(row) == canonical(expected), "Non-target video changed beyond required related-video mapping")
                unchanged_vod_checked += 1
                rel_only_vod_changed += expected["vod_rel_vod"] != old["vod_rel_vod"]
            for value in id_list(row["vod_rel_vod"]):
                require_current_reference(value, "mac_vod.vod_rel_vod")
            return

        actual_references[table][row_digest(row)] += 1
        if table == "mac_ulog" and row["ulog_mid"] == 1:
            require_current_reference(row["ulog_rid"], table)
        elif table == "mac_dynamics" and row["dyn_mid"] == 1:
            require_current_reference(row["dyn_rid"], table)
        elif table == "mac_vodmerge_audit_key":
            require_current_reference(row["vod_id"], table)
            key = row["key_hash"], row["vod_id"]
            require(key not in unique_audit_keys, "Duplicate audit_key composite primary key")
            unique_audit_keys.add(key)
        elif table == "mac_vod_repeat":
            require_current_reference(row["id1"], table)
        elif table in ("mac_art", "mac_topic", "mac_manga", "mac_vod_search"):
            field = "search_result_ids" if table == "mac_vod_search" else table[4:] + "_rel_vod"
            for value in id_list(row[field]):
                require_current_reference(value, table + "." + field)

    print("Validating output SQL fields, videos and references", flush=True)
    result = scan_dump(destination, output_row, CHANGED_TABLES)
    require(actual_ids == original_ids - removed, "Output video ID set differs from precise deletion plan")
    require(anomaly_checked == len(anomalies), "Not every original anomaly row survived unchanged")
    require(set(actual_targets) == keepers, "Missing merged target in output")

    route_count = 0
    sources_by_keeper = {keeper: {keeper} for keeper in keepers}
    for old, keeper in id_map.items():
        sources_by_keeper[int(keeper)].add(int(old))
    for keeper in keepers:
        source_ids = sources_by_keeper[keeper]
        for kind in ("play", "down"):
            actual_groups = playlist(actual_targets[keeper], kind)
            require(set(routes[str(keeper)][kind]) == {str(value) for value in source_ids}, "Route map source coverage mismatch")
            for source_id in source_ids:
                source_groups = playlist(original(source_id), kind)
                mapping = routes[str(keeper)][kind][str(source_id)]
                require(set(mapping) == {str(i) for i in range(1, len(source_groups) + 1)}, "Route map slot coverage mismatch")
                for slot, group in enumerate(source_groups, 1):
                    destination_slot = int(mapping[str(slot)])
                    require(1 <= destination_slot <= len(actual_groups), "Route map has invalid destination slot")
                    require(group == actual_groups[destination_slot - 1], "Original full resource tuple missing or changed after mapping")
                    # Tuple equality includes the exact episode payload/order, so
                    # every positive nid still denotes the same label and URL.
                    route_count += 1

    expected_references = defaultdict(Counter)
    seen_audit, seen_repeat = set(), set()
    history_positions_checked = 0

    def source_row(table, row):
        nonlocal history_positions_checked
        if table == "mac_ulog" and row["ulog_mid"] == 1 and str(row["ulog_rid"]) in id_map:
            old_id = str(row["ulog_rid"])
            keeper = int(id_map[old_id])
            source_video = original(old_id)
            old_slot = row["ulog_sid"]
            row["ulog_rid"] = keeper
            if old_slot:
                new_slot = int(routes[str(keeper)]["play"][old_id][str(old_slot)])
                old_group = playlist(source_video, "play")[old_slot - 1]
                new_group = playlist(actual_targets[keeper], "play")[new_slot - 1]
                require(old_group == new_group, "Watch-history sid maps to different content")
                nid = row["ulog_nid"]
                if nid:
                    old_episodes, new_episodes = old_group[1].rstrip("#").split("#"), new_group[1].rstrip("#").split("#")
                    require(1 <= nid <= len(old_episodes), "Merged source has out-of-range watch-history nid")
                    require(old_episodes[nid - 1] == new_episodes[nid - 1], "Watch-history nid changed content")
                row["ulog_sid"] = new_slot
                history_positions_checked += 1
        elif table == "mac_dynamics" and row["dyn_mid"] == 1:
            row["dyn_rid"] = id_map.get(str(row["dyn_rid"]), row["dyn_rid"])
        elif table == "mac_vodmerge_audit_key":
            row["vod_id"] = id_map.get(str(row["vod_id"]), row["vod_id"])
            key = row["key_hash"], row["vod_id"]
            if key in seen_audit:
                return
            seen_audit.add(key)
        elif table == "mac_vod_repeat":
            row["id1"] = id_map.get(str(row["id1"]), row["id1"])
            key = row["id1"], row["name1"]
            if key in seen_repeat:
                return
            seen_repeat.add(key)
        elif table in ("mac_art", "mac_topic", "mac_manga", "mac_vod_search"):
            field = "search_result_ids" if table == "mac_vod_search" else table[4:] + "_rel_vod"
            old_value = row[field]
            row[field] = mapped_list(old_value, id_map)
            if table == "mac_vod_search" and old_value != row[field]:
                row["search_result_count"] -= len([x for x in old_value.split(",") if x]) - len([x for x in row[field].split(",") if x])
        expected_references[table][row_digest(row)] += 1

    print("Validating original SQL hashes and exact reference transformations", flush=True)
    before = scan_dump(source, source_row, REFERENCE_TABLES)
    require(before["schemas"] == result["schemas"], "Table schemas or column order changed")
    require(before["non_insert_sha256"] == result["non_insert_sha256"], "Non-INSERT SQL bytes changed")
    require(before["rows"]["mac_vod"] == len(original_ids), "Original SQL and extraction database row counts differ")
    source_manifest = json.loads((output / "source_manifest.json").read_text())
    require(before["sha256"] == source_manifest["sha256"], "Original SQL hash no longer matches source manifest")
    output_manifest = json.loads((output / "output_manifest.json").read_text())
    require(result["sha256"] == output_manifest["sha256"], "Actual SQL hash differs from final output manifest")
    untouched = set(before["schemas"]) - CHANGED_TABLES
    for table in untouched:
        require(before["insert_sha256"].get(table) == result["insert_sha256"].get(table), f"Unrelated table INSERT bytes changed: {table}")
        require(before["rows"][table] == result["rows"][table], f"Unrelated table row count changed: {table}")
    for table in REFERENCE_TABLES:
        require(expected_references[table] == actual_references[table], f"Unexpected reference row mutation or loss: {table}")

    backup_ids = set()
    with gzip.open(output / "merged_original_rows.jsonl.gz", "rt", encoding="utf-8") as backup:
        for line in backup:
            row = json.loads(line)
            ident = row["vod_id"]
            require(ident not in backup_ids, "Duplicate backup video ID")
            require(canonical(row) == canonical(original(ident)), "Backup differs from original video row")
            backup_ids.add(ident)
    require(backup_ids == removed | keepers, "Original-row backup coverage mismatch")
    db.close()

    return {
        "status": "passed", "mysql_import_executed": False,
        "scope": "Actual SQL parsed offline; no MySQL service available. Historical audit rows retain original IDs.",
        "source_sha256": before["sha256"], "output_sha256": result["sha256"],
        "tables": len(result["schemas"]), "all_field_counts_valid": True,
        "non_insert_sql_byte_identical": True, "untouched_tables_byte_identical": len(untouched),
        "original_vod_rows": len(original_ids), "output_vod_rows": len(actual_ids),
        "removed_vod_rows": len(removed), "merged_targets": len(keepers),
        "anomaly_rows_unchanged": anomaly_checked, "non_target_rows_verified": unchanged_vod_checked,
        "non_target_related_id_only_changes": rel_only_vod_changed,
        "original_resource_tuples_preserved": route_count,
        "watch_history_positions_verified": history_positions_checked,
        "current_references_to_removed_ids": 0, "audit_key_primary_key_duplicates": 0,
        "reference_tables_exact_transform_verified": sorted(REFERENCE_TABLES),
        "original_backup_rows_verified": len(backup_ids),
        "output_table_rows": result["rows"], "elapsed_seconds": round(time.monotonic() - started, 2),
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    arguments = parser.parse_args()
    report = verify(arguments.source, arguments.output)
    (arguments.output / "verification.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({key: value for key, value in report.items() if key != "output_table_rows"}, ensure_ascii=False, indent=2))
