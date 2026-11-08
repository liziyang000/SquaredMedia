"""Offline, loss-preserving cleanup of the supplied SquaredMedia SQL snapshot."""

import argparse
from collections import Counter, defaultdict
import csv
import gzip
import hashlib
import html
from itertools import combinations
import json
from pathlib import Path
import re
import sqlite3
import unicodedata

from vod_cleanup_dump import decode_token, encode_value, iter_insert_rows, render_insert, table_schemas
from vod_cleanup_audit import audit_row, missing, plain, RULE_NAMES

SEASON_PATTERN = r"第\s*[0-9一二三四五六七八九十]+\s*[季部辑]|\b(?:season|s)\s*\d+\b"


def key(value):
    return "".join(c for c in unicodedata.normalize("NFKC", plain(value)).casefold() if c.isalnum())


def title_key(value):
    value = re.sub(r"[（(【\[]?(?:国语|粤语|普通话|英语|日语|韩语)(?:配音)?版[）)】\]]?", "", plain(value))
    value = re.sub(SEASON_PATTERN, lambda m: next(iter(seasons(m[0]))), value, flags=re.I)
    return key(value)


def people(value):
    return {key(v) for v in re.split(r"[,，/|、;；&\r\n]+", plain(value)) if not missing(v) and len(key(v)) >= 2}


def seasons(value):
    nums = {"一": "1", "二": "2", "三": "3", "四": "4", "五": "5", "六": "6", "七": "7", "八": "8", "九": "9", "十": "10"}
    result = set()
    for match in re.finditer(r"第\s*([0-9一二三四五六七八九十]+)\s*([季部辑])|\b(?:season|s)\s*(\d+)\b", unicodedata.normalize("NFKC", str(value)), re.I):
        n = match[1] or match[3]
        if n.isdigit():
            n = str(int(n))
        elif n in nums:
            n = nums[n]
        elif "十" in n:
            left, right = n.split("十", 1)
            n = str(int(nums.get(left, "1")) * 10 + int(nums.get(right, "0")))
        result.add((match[2] or "季") + n)
    return result


def synopsis_similarity(a, b):
    if min(len(a), len(b)) < 40:
        return 0.0
    if a == b:
        return 1.0
    # Character bigrams accommodate punctuation and small synopsis edits.
    aa = {a[i:i + 2] for i in range(len(a) - 1)}
    bb = {b[i:i + 2] for i in range(len(b) - 1)}
    return 2 * len(aa & bb) / (len(aa) + len(bb))


def metadata(v, types):
    titles = [v["vod_name"], *re.split(r"[/|,，、;；\r\n]+", v["vod_sub"])]
    category = types.get(v["type_id"], {})
    return {"id": v["vod_id"], "name": v["vod_name"], "douban": int(v["vod_douban_id"]),
            "titles": {title_key(t) for t in titles if not missing(t) and title_key(t)}, "year": v["vod_year"],
            "type": v["type_id"], "root": category.get("type_pid") or v["type_id"],
            "cast": people(v["vod_actor"]), "directors": people(v["vod_director"]),
            "synopsis": key(v["vod_content"]), "seasons": seasons(v["vod_name"] + " " + v["vod_sub"]),
            "version": plain(v["vod_version"])}


def assess(a, b):
    same_id = a["douban"] > 0 and a["douban"] == b["douban"]
    titles_match = bool(a["titles"] & b["titles"])
    primary_match = title_key(a["name"]) in b["titles"] or title_key(b["name"]) in a["titles"]
    overlap = a["cast"] & b["cast"]
    sim = synopsis_similarity(a["synopsis"], b["synopsis"])
    conflicts = []
    if a["douban"] and b["douban"] and a["douban"] != b["douban"]:
        conflicts.append("不同的正豆瓣 ID")
    if a["year"] and b["year"] and a["year"] != b["year"]:
        conflicts.append("年份不同")
    if a["root"] != b["root"]:
        conflicts.append("作品大类不同")
    if a["seasons"] != b["seasons"] and (a["seasons"] or b["seasons"]):
        conflicts.append("季数不同或仅一方明确季数")
    if len(a["seasons"]) > 1 or len(b["seasons"]) > 1:
        conflicts.append("单条记录包含多个季/部/辑")
    special = r"电影解说|预告|花絮|幕后|抢先|导演剪辑|加长版|网络版|TV版|电视版|未删减版|删减版|院线版|重映版|修复版|剧场版|特别篇|纪录片|前传|后传|续集|上部|下部|上篇|下篇|4K"
    if set(re.findall(special, a["name"], re.I)) != set(re.findall(special, b["name"], re.I)):
        conflicts.append("片名标注版本或内容形式不同")
    if a["version"] and b["version"] and a["version"] != b["version"]:
        conflicts.append("版本字段不同")
    if a["directors"] and b["directors"] and not (a["directors"] & b["directors"]):
        conflicts.append("双方导演均有资料但没有交集")
    if not primary_match:
        conflicts.append("主片名与对方主片名/别名没有明确对应，仅通用别名或相同ID不足以确认")
    if re.findall(r"\d+", re.sub(SEASON_PATTERN, "", a["name"], flags=re.I)) != re.findall(r"\d+", re.sub(SEASON_PATTERN, "", b["name"], flags=re.I)):
        conflicts.append("片名数字/续作编号不同")
    sequence_names = [unicodedata.normalize("NFKC", plain(v["name"])) for v in (a, b)]
    sequence_parts = [re.fullmatch(r"(.{2,}?)([IVX]{1,6}|[一二三四五六七八九十]+)", name) for name in sequence_names]
    for index, part in enumerate(sequence_parts):
        if part and key(part[1]) == key(sequence_names[1 - index]):
            conflicts.append("片名罗马数字或汉字续作编号不同")
    if same_id and not titles_match and not overlap and sim < 0.3:
        conflicts.append("豆瓣 ID 相同但片名、演员与简介缺少相互印证")
    evidence = {"same_douban": same_id, "title_match": titles_match,
                "cast_overlap": len(overlap), "synopsis_similarity": round(sim, 4), "conflicts": conflicts}
    if conflicts:
        return False, evidence
    if same_id:
        return True, evidence
    strong_cast = len(overlap) >= 2 or (bool(overlap) and bool(a["directors"] & b["directors"]))
    confirmed = (primary_match and sim >= 0.8 and strong_cast and bool(a["year"]) and a["year"] == b["year"])
    return confirmed, evidence


def csv_writer(path, fields):
    handle = path.open("w", encoding="utf-8-sig", newline="")
    writer = csv.DictWriter(handle, fieldnames=fields)
    writer.writeheader()
    return handle, writer


def csv_row(writer, row):
    # Treat movie titles/content as untrusted spreadsheet text.
    writer.writerow({k: ("'" + str(v) if isinstance(v, str) and v.lstrip().startswith(("=", "+", "-", "@")) else v) for k, v in row.items()})


def resource_groups(v, kind):
    fields = [f"vod_{kind}_{suffix}" for suffix in ("from", "url", "server", "note")]
    if not v[fields[0]] and not v[fields[1]]:
        return []
    parts = [str(v[field]).split("$$$") for field in fields]
    count = len(parts[0])
    if not v[fields[2]]:
        parts[2] = ["no"] * count
    if not v[fields[3]]:
        parts[3] = [""] * count
    if any(len(p) != count for p in parts):
        raise ValueError("播放或下载字段组数错位")
    return list(zip(*parts))


def merge_group(rows):
    """Keep the oldest ID; append complete routes, retaining episode positions."""
    rows = sorted(rows, key=lambda v: v["vod_id"])
    target = dict(rows[0])
    protected = ["group_id", "vod_status", "vod_copyright", "vod_points", "vod_points_play", "vod_points_down", "vod_trysee",
                 "vod_pwd", "vod_pwd_url", "vod_pwd_play", "vod_pwd_play_url", "vod_pwd_down", "vod_pwd_down_url", "vod_jumpurl", "vod_publish_time"]
    for field in protected:
        if len({v[field] for v in rows}) > 1:
            raise ValueError("访问/收费/状态设置不同：" + field)
    if any(v["vod_lock"] or v["vod_recycle_time"] for v in rows):
        raise ValueError("记录被锁定或处于回收站")
    routes = {}
    for kind in ("play", "down"):
        groups = resource_groups(rows[0], kind)
        slots = {}
        for v in rows:
            mapping = {}
            for source_slot, group in enumerate(resource_groups(v, kind), 1):
                if v is rows[0]:
                    slot = source_slot
                elif group in groups:
                    slot = groups.index(group) + 1
                else:
                    groups.append(group)
                    slot = len(groups)
                mapping[source_slot] = slot
            slots[str(v["vod_id"])] = mapping
        for index, suffix in enumerate(("from", "url", "server", "note")):
            field = f"vod_{kind}_{suffix}"
            value = "$$$".join(g[index] for g in groups)
            if suffix != "url" and len(value) > 255:
                raise ValueError(field + " 合并后超过255字符，暂不截断资源")
            if suffix == "url" and len(value.encode("utf-8")) > 16777215:
                raise ValueError(field + " 合并后超过MEDIUMTEXT范围")
            # Preserve original formatting when its effective route list is unchanged.
            if groups != resource_groups(rows[0], kind):
                target[field] = value
        routes[kind] = slots
    # Combine list metadata without truncating fields. Originals remain in the backup.
    for field, limit in (("vod_actor", 255), ("vod_director", 255), ("vod_writer", 100), ("vod_tag", 100), ("vod_class", 255), ("vod_sub", 255)):
        values = []
        seen = set()
        for v in rows:
            sources = [v[field]]
            if field == "vod_sub" and v["vod_name"] != target["vod_name"]:
                sources.append(v["vod_name"])
            for source in sources:
                for item in re.split(r"[,，/|、;；\r\n]+", str(source)):
                    item = item.strip()
                    if not missing(item) and key(item) not in seen:
                        seen.add(key(item))
                        values.append(item)
        value = ",".join(values)
        if len(value) <= limit and value and set(key(x) for x in values) != set(key(x) for x in re.split(r"[,，/|、;；\r\n]+", str(target[field])) if not missing(x)):
            target[field] = value
    target["vod_content"] = max(rows, key=lambda v: len(plain(v["vod_content"])))["vod_content"]
    target["vod_blurb"] = max(rows, key=lambda v: len(plain(v["vod_blurb"])))["vod_blurb"]
    for field in ("vod_douban_id", "vod_douban_score", "vod_score", "vod_total", "vod_time", "vod_time_hits", "vod_time_make", "vod_hits", "vod_hits_day", "vod_hits_week", "vod_hits_month", "vod_up", "vod_down", "vod_score_all", "vod_score_num", "vod_share_count"):
        target[field] = max((v[field] for v in rows), key=lambda x: float(x))
    for field in ("vod_time_add",):
        target[field] = min((v[field] for v in rows if int(v[field]) > 0), default=target[field])
    for field in ("vod_pic_thumb", "vod_pic_slide", "vod_pic_original", "vod_pic_screenshot", "vod_tv", "vod_weekday", "vod_area", "vod_lang", "vod_pubdate", "vod_duration", "vod_reurl", "vod_behind", "vod_author"):
        if missing(target[field]):
            target[field] = next((v[field] for v in rows if not missing(v[field])), target[field])
    for field in ("vod_rel_vod", "vod_rel_art"):
        items = list(dict.fromkeys(x for v in rows for x in str(v[field]).split(",") if x))
        value = ",".join(items)
        if len(value) > 255:
            raise ValueError(field + " 关联ID合并后超过255字符")
        target[field] = value
    return target, routes


def plan(source, output):
    work = output / ".analysis"
    db = sqlite3.connect(work / "records.sqlite")
    types = {r[0]: json.loads(r[1]) for r in db.execute("SELECT * FROM types")}
    proposed = json.loads((work / "proposed.json").read_text())
    deferred = json.loads((work / "deferred.json").read_text())
    inventory = json.loads((work / "reference_inventory.json").read_text())
    schemas = json.loads((work / "schemas.json").read_text())
    ulogs = defaultdict(list)
    with source.open(encoding="utf-8") as stream:
        for line in stream:
            if line.startswith("INSERT INTO `mac_ulog` VALUES"):
                table, items = iter_insert_rows(line)
                for tokens in items:
                    row = dict(zip(schemas[table], map(decode_token, tokens)))
                    if row["ulog_mid"] == 1:
                        ulogs[row["ulog_rid"]].append(row)
    # Preserve every abnormal mac_vod row exactly, including its related-ID list.
    anomaly_ids = set(json.loads((work / "anomaly_ids.json").read_text()))
    abnormal_referrers = defaultdict(list)
    for ident, data in db.execute("SELECT id,data FROM vod"):
        if ident not in anomaly_ids:
            continue
        for ref in str(json.loads(data)["vod_rel_vod"]).split(","):
            if ref.strip().isdigit():
                abnormal_referrers[int(ref)].append(ident)
    merged, id_map, route_maps, accepted = {}, {}, {}, []
    conflicts_handle, conflicts_writer = csv_writer(output / "retained_field_alternatives.csv", ["keeper_id", "source_id", "field", "retained_value", "source_value"])
    with gzip.open(output / "merged_original_rows.jsonl.gz", "wt", encoding="utf-8") as backup:
        for group in proposed:
            rows = [json.loads(db.execute("SELECT data FROM vod WHERE id=?", (ident,)).fetchone()[0]) for ident in group["ids"]]
            try:
                target, routes = merge_group(rows)
                if audit_row(target, types):
                    raise ValueError("合并后产生新的字段异常")
                if any(ident in abnormal_referrers for ident in group["ids"][1:]):
                    raise ValueError("待移除记录被异常影片的关联字段引用，为保留异常行原样暂缓")
                for row in rows:
                    for ulog in ulogs[row["vod_id"]]:
                        sid, nid = ulog["ulog_sid"], ulog["ulog_nid"]
                        if sid == nid == 0:
                            continue
                        groups = resource_groups(row, "play")
                        if ulog["ulog_type"] != 4 or not 1 <= sid <= len(groups) or not 1 <= nid <= len(groups[sid - 1][1].rstrip("#").split("#")):
                            raise ValueError("现有观看进度坐标无法明确迁移，暂不改动相关影片")
            except ValueError as exc:
                group["reasons"].append(str(exc))
                deferred.append(group)
                continue
            keeper = target["vod_id"]
            merged[str(keeper)] = target
            route_maps[str(keeper)] = routes
            accepted.append(group)
            for row in rows:
                backup.write(json_text(row) + "\n")
                if row["vod_id"] != keeper:
                    id_map[str(row["vod_id"])] = keeper
                for field, value in row.items():
                    if field != "vod_id" and value != target[field] and value not in (None, "", 0, "0", "0.0") and not field.startswith(("vod_play_", "vod_down_")):
                        csv_row(conflicts_writer, {"keeper_id": keeper, "source_id": row["vod_id"], "field": field, "retained_value": str(target[field]), "source_value": str(value)})
    conflicts_handle.close()
    handle, writer = csv_writer(output / "merge_mapping.csv", ["source_id", "keeper_id", "source_name", "keeper_name", "basis", "douban_id"])
    for group in accepted:
        keeper = group["ids"][0]
        for ident, name in zip(group["ids"][1:], group["names"][1:]):
            csv_row(writer, {"source_id": ident, "keeper_id": keeper, "source_name": name, "keeper_name": group["names"][0], "basis": group["basis"], "douban_id": merged[str(keeper)]["vod_douban_id"]})
    handle.close()
    handle, writer = csv_writer(output / "deferred_groups.csv", ["record_ids", "names", "basis", "reason"])
    for group in deferred:
        csv_row(writer, {"record_ids": ",".join(map(str, group["ids"])), "names": " / ".join(group["names"]), "basis": group["basis"], "reason": "；".join(group["reasons"])})
    handle.close()
    for name, obj in (("merged.json", merged), ("id_map.json", id_map), ("route_maps.json", route_maps), ("accepted.json", accepted)):
        (work / name).write_text(json_text(obj), encoding="utf-8")
    summary = {"merged_groups": len(accepted), "removed_duplicate_rows": len(id_map), "remaining_vod_rows": db.execute("SELECT count(*) FROM vod").fetchone()[0] - len(id_map),
               "groups_by_basis": dict(Counter(g["basis"] for g in accepted)), "deferred_groups": len(deferred)}
    (output / "merge_summary.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json_text(summary), flush=True)


def remap_list(value, id_map, self_id=None):
    parts = str(value).split(",")
    if not any(part.strip() in id_map for part in parts):
        return value
    result = []
    for part in parts:
        mapped = str(id_map.get(part.strip(), part.strip()))
        if part.strip() in id_map and mapped == str(self_id):
            continue
        if mapped and mapped not in result:
            result.append(mapped)
    return ",".join(result)


def write_dump(source, output):
    work = output / ".analysis"
    schemas = json.loads((work / "schemas.json").read_text())
    merged = json.loads((work / "merged.json").read_text())
    id_map = json.loads((work / "id_map.json").read_text())
    routes = json.loads((work / "route_maps.json").read_text())
    source_manifest = json.loads((output / "source_manifest.json").read_text())
    anomaly_ids = set(json.loads((work / "anomaly_ids.json").read_text()))
    changed_counts, removed_counts = Counter(), Counter()
    seen_keys, seen_repeat = set(), set()
    sensitive_tables = {"mac_vod", "mac_ulog", "mac_dynamics", "mac_vodmerge_audit_key", "mac_vod_repeat", "mac_vod_search", "mac_art", "mac_topic", "mac_manga"}
    source_hash, result_hash = hashlib.sha256(), hashlib.sha256()
    destination = output / "squaredmedia_cleaned_2026-11-06.sql"
    temporary = destination.with_suffix(".sql.partial")
    with source.open("rb") as stream, temporary.open("wb") as target:
        for raw in stream:
            source_hash.update(raw)
            rendered = raw
            if raw.startswith(b"INSERT INTO "):
                name = raw.split(b"`", 2)[1].decode()
                if name in sensitive_tables:
                    table, parsed = iter_insert_rows(raw.decode("utf-8"))
                    columns = schemas[table]
                    result_rows, line_changed = [], False
                    for tokens in parsed:
                        row = dict(zip(columns, map(decode_token, tokens)))
                        old = dict(row)
                        skip = False
                        if table == "mac_vod":
                            ident = str(row["vod_id"])
                            skip = ident in id_map
                            if ident in merged:
                                row = dict(merged[ident])
                            row["vod_rel_vod"] = remap_list(row["vod_rel_vod"], id_map, row["vod_id"])
                            if int(ident) in anomaly_ids and (skip or row != old):
                                raise ValueError("异常影片应保持原样：" + ident)
                        elif table == "mac_ulog" and row["ulog_mid"] == 1 and str(row["ulog_rid"]) in id_map:
                            old_id = str(row["ulog_rid"])
                            keeper = id_map[old_id]
                            row["ulog_rid"] = keeper
                            if row["ulog_sid"]:
                                row["ulog_sid"] = routes[str(keeper)]["play"][old_id][str(row["ulog_sid"])]
                        elif table == "mac_dynamics" and row["dyn_mid"] == 1 and str(row["dyn_rid"]) in id_map:
                            row["dyn_rid"] = id_map[str(row["dyn_rid"])]
                        elif table == "mac_vodmerge_audit_key":
                            row["vod_id"] = id_map.get(str(row["vod_id"]), row["vod_id"])
                            unique = (row["key_hash"], row["vod_id"])
                            skip = unique in seen_keys
                            seen_keys.add(unique)
                        elif table == "mac_vod_repeat":
                            row["id1"] = id_map.get(str(row["id1"]), row["id1"])
                            unique = (row["id1"], row["name1"])
                            skip = unique in seen_repeat
                            seen_repeat.add(unique)
                        elif table == "mac_vod_search":
                            row["search_result_ids"] = remap_list(row["search_result_ids"], id_map)
                            if row["search_result_ids"] != old["search_result_ids"]:
                                before_count = len([x for x in old["search_result_ids"].split(",") if x])
                                after_count = len([x for x in row["search_result_ids"].split(",") if x])
                                row["search_result_count"] -= before_count - after_count
                        elif table in ("mac_art", "mac_topic", "mac_manga"):
                            field = table[4:] + "_rel_vod"
                            row[field] = remap_list(row[field], id_map)
                        if skip:
                            removed_counts[table] += 1
                            line_changed = True
                            continue
                        if row != old:
                            for index, field in enumerate(columns):
                                if row[field] != old[field]:
                                    tokens[index] = encode_value(row[field])
                            changed_counts[table] += 1
                            line_changed = True
                        result_rows.append(tokens)
                    if line_changed:
                        rendered = render_insert(table, result_rows).encode("utf-8") if result_rows else b""
            target.write(rendered)
            result_hash.update(rendered)
    if source_hash.hexdigest() != source_manifest["sha256"]:
        raise ValueError("输入文件在处理期间发生变化，未发布输出文件")
    temporary.replace(destination)
    report = {"output_file": str(destination), "size": destination.stat().st_size, "sha256": result_hash.hexdigest(),
              "source_sha256_verified": source_hash.hexdigest(), "changed_rows": dict(changed_counts), "removed_rows": dict(removed_counts)}
    (output / "output_manifest.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json_text(report), flush=True)


def analyze(source, output):
    work = output / ".analysis"
    db = sqlite3.connect(work / "records.sqlite")
    types = {r[0]: json.loads(r[1]) for r in db.execute("SELECT * FROM types")}
    metas, by_douban, by_title, by_synopsis = {}, defaultdict(list), defaultdict(list), defaultdict(list)
    issue_counts, issue_ids, blocked = Counter(), set(), {}
    handle, writer = csv_writer(output / "anomalies.csv", ["vod_id", "vod_name", "issue_type", "severity", "field", "reason"])
    for ident, data in db.execute("SELECT id,data FROM vod"):
        v = json.loads(data)
        issues = audit_row(v, types)
        for issue in issues:
            issue_counts[issue["code"]] += 1
            csv_row(writer, {"vod_id": ident, "vod_name": v["vod_name"], "issue_type": RULE_NAMES[issue["code"]],
                             **{k: issue[k] for k in ("severity", "field", "reason")}})
        if issues:
            issue_ids.add(ident)
            blocked[ident] = [i["code"] for i in issues]
        m = metadata(v, types)
        metas[ident] = m
        if m["douban"]:
            by_douban[m["douban"]].append(ident)
        for title in m["titles"]:
            by_title[title].append(ident)
        if len(m["synopsis"]) >= 80:
            by_synopsis[hashlib.sha256(m["synopsis"].encode()).digest()].append(ident)
        if len(metas) % 50000 == 0:
            print(f"audited {len(metas)}", flush=True)
    candidates = set()
    large_groups = []
    for kind, index in (("title", by_title), ("identical_synopsis", by_synopsis)):
        for ids in index.values():
            if len(ids) > 100:
                large_groups.append({"basis": kind, "ids": sorted(ids), "reason": "同一标题/简介对应超过100条记录，区分信息不足，保留整组供人工审核"})
            else:
                candidates.update(tuple(sorted(pair)) for pair in combinations(ids, 2))
    # Identical meaningful synopses also surface candidates whose titles differ.
    candidates.update(tuple(sorted(pair)) for ids in by_douban.values() for pair in combinations(ids, 2))
    print(f"candidate pairs {len(candidates)}; ambiguous large groups {len(large_groups)}", flush=True)
    safe_edges, suspect_rows, pair_evidence = [], [], {}
    identity_conflicts = defaultdict(set)
    for left, right in sorted(candidates):
        a, b = metas[left], metas[right]
        # Different known IDs are not duplicate candidates unless other fields closely match.
        confirmed, evidence = assess(a, b)
        if a["douban"] and b["douban"] and a["douban"] != b["douban"]:
            if evidence["synopsis_similarity"] < 0.8 or evidence["cast_overlap"] < 2:
                continue
        if confirmed:
            safe_edges.append((left, right))
            pair_evidence[f"{left}:{right}"] = evidence
        else:
            suspect_rows.append((left, right, evidence))
            if evidence["same_douban"] and evidence["conflicts"]:
                for ident in by_douban[a["douban"]]:
                    identity_conflicts[ident].update(evidence["conflicts"])
            elif a["douban"] and b["douban"] and a["douban"] != b["douban"]:
                identity_conflicts[left].add("不同豆瓣 ID 但片名/简介/演员高度相似")
                identity_conflicts[right].add("不同豆瓣 ID 但片名/简介/演员高度相似")
    for ident, reasons in sorted(identity_conflicts.items()):
        issue_counts["identity_conflict"] += 1
        issue_ids.add(ident)
        blocked.setdefault(ident, []).append("identity_conflict")
        csv_row(writer, {"vod_id": ident, "vod_name": metas[ident]["name"], "issue_type": "作品身份信息冲突", "severity": "suspect",
                         "field": "vod_douban_id,vod_name,vod_year,vod_actor,vod_director,vod_content", "reason": "；".join(sorted(reasons))})
    handle.close()
    (work / "anomaly_ids.json").write_text(json_text(sorted(issue_ids)), encoding="utf-8")
    (output / "ambiguous_large_groups.json").write_text(json_text(large_groups), encoding="utf-8")
    inventory = json.loads((work / "reference_inventory.json").read_text())
    active = set(inventory["active_blocker_union"])
    # Connected candidates are accepted only when EVERY pair agrees; no transitive merges.
    parent = {ident: ident for pair in safe_edges for ident in pair}
    def find(ident):
        while parent[ident] != ident:
            parent[ident] = parent[parent[ident]]
            ident = parent[ident]
        return ident
    for left, right in safe_edges:
        parent[find(right)] = find(left)
    groups = defaultdict(list)
    for ident in parent:
        groups[find(ident)].append(ident)
    proposed, deferred = [], []
    for ids in groups.values():
        ids.sort()
        reasons = []
        bad_ids = [ident for ident in ids if ident in blocked]
        if bad_ids:
            reasons.append("涉及异常清单记录，按要求保持原样：" + ",".join(map(str, bad_ids)))
        active_ids = [ident for ident in ids if ident in active]
        if active_ids:
            reasons.append("涉及插件活跃任务、绑定或可回滚快照：" + ",".join(map(str, active_ids)))
        for left, right in combinations(ids, 2):
            confirmed, evidence = assess(metas[left], metas[right])
            if not confirmed:
                reasons.append(f"组内 {left}/{right} 不满足独立匹配，禁止传递式合并")
                break
        group = {"ids": ids, "names": [metas[i]["name"] for i in ids], "basis": "douban_id" if len({metas[i]["douban"] for i in ids}) == 1 and metas[ids[0]]["douban"] else "metadata",
                 "reasons": reasons}
        (deferred if reasons else proposed).append(group)
    handle, writer = csv_writer(output / "suspected_duplicates.csv", ["left_id", "left_name", "right_id", "right_name", "same_douban", "title_match", "cast_overlap", "synopsis_similarity", "reason"])
    for left, right, evidence in suspect_rows:
        csv_row(writer, {"left_id": left, "left_name": metas[left]["name"], "right_id": right, "right_name": metas[right]["name"],
                         **{k: evidence[k] for k in ("same_douban", "title_match", "cast_overlap", "synopsis_similarity")},
                         "reason": "；".join(evidence["conflicts"]) or "简介/演员/年份综合证据不足"})
    handle.close()
    (work / "proposed.json").write_text(json_text(proposed), encoding="utf-8")
    (work / "deferred.json").write_text(json_text(deferred), encoding="utf-8")
    (work / "pair_evidence.json").write_text(json_text(pair_evidence), encoding="utf-8")
    summary = {"vod_rows": len(metas), "with_douban": sum(len(ids) for ids in by_douban.values()),
               "same_douban_groups": sum(len(ids)>1 for ids in by_douban.values()), "anomaly_records": len(issue_ids),
               "anomaly_counts": dict(issue_counts), "candidate_pairs": len(candidates), "suspect_pairs": len(suspect_rows),
               "proposed_groups": len(proposed), "deferred_groups": len(deferred),
               "proposed_by_basis": dict(Counter(g["basis"] for g in proposed))}
    (output / "analysis_summary.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json_text(summary), flush=True)


def json_text(value):
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"), default=str)


def extract(source, output):
    work = output / ".analysis"
    work.mkdir(parents=True, exist_ok=True)
    schemas = table_schemas(source)
    (work / "schemas.json").write_text(json_text(schemas), encoding="utf-8")
    db = sqlite3.connect(work / "records.sqlite")
    db.executescript("CREATE TABLE vod (id INTEGER PRIMARY KEY, data TEXT NOT NULL); CREATE TABLE types (id INTEGER PRIMARY KEY, data TEXT NOT NULL);")
    counts = Counter()
    digest = hashlib.sha256()
    with source.open("rb") as stream:
        for raw in stream:
            digest.update(raw)
            if not raw.startswith((b"INSERT INTO `mac_vod` VALUES", b"INSERT INTO `mac_type` VALUES")):
                continue
            table, rows = iter_insert_rows(raw.decode("utf-8"))
            columns = schemas[table]
            for tokens in rows:
                if len(tokens) != len(columns):
                    raise ValueError(f"{table}: invalid field count")
                row = dict(zip(columns, map(decode_token, tokens)))
                if table == "mac_vod":
                    db.execute("INSERT INTO vod VALUES (?, ?)", (row["vod_id"], json_text(row)))
                else:
                    db.execute("INSERT INTO types VALUES (?, ?)", (row["type_id"], json_text(row)))
                counts[table] += 1
            db.commit()
    info = {"source": str(source.resolve()), "size": source.stat().st_size, "sha256": digest.hexdigest(), "extracted_rows": dict(counts)}
    (output / "source_manifest.json").write_text(json.dumps(info, ensure_ascii=False, indent=2), encoding="utf-8")
    db.close()
    print(json_text(info), flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("stage", choices=["extract", "analyze", "plan", "write"])
    parser.add_argument("source", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    {"extract": extract, "analyze": analyze, "plan": plan, "write": write_dump}[args.stage](args.source, args.output)
