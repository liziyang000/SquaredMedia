"""Read-only, offline checks for the 2026-11 mac_vod cleanup."""

import html
import re
from decimal import Decimal


RULE_NAMES = {
    "name_missing": "影片名称缺失",
    "content_missing": "剧情简介缺失",
    "actor_missing": "演员资料缺失",
    "area_missing": "地区缺失",
    "lang_missing": "语言缺失",
    "poster_missing": "海报缺失",
    "year_missing": "年份缺失",
    "year_invalid": "年份格式异常",
    "score_invalid": "评分格式或范围异常",
    "douban_id_invalid": "豆瓣 ID 格式或范围异常",
    "douban_id_unusual": "豆瓣 ID 位数待核对",
    "type_unknown": "分类不存在",
    "type_module_mismatch": "分类模块不符",
    "type_parent_mismatch": "父分类不一致",
    "play_missing": "播放来源缺失",
    "play_group_mismatch": "播放字段组数不一致",
    "down_group_mismatch": "下载字段组数不一致",
    "play_empty_group": "播放来源或地址组为空",
    "down_empty_group": "下载来源或地址组为空",
    "play_player_invalid": "播放代码格式异常",
    "down_player_invalid": "下载代码格式异常",
    "play_empty_episode": "播放条目为空",
    "down_empty_episode": "下载条目为空",
    "play_url_format": "播放地址格式待核对",
    "down_url_format": "下载地址格式待核对",
    "play_label_conflict": "播放条目同名异址",
    "down_label_conflict": "下载条目同名异址",
}
PLACEHOLDERS = {
    "", "0", "无", "未知", "暂无", "不详", "内详", "待定", "未填写",
    "暂无资料", "暂无简介", "剧情介绍", "待更新", "未公布", "暂未公布",
    "未知演员", "暂无演员", "未知主演", "unknown", "none", "null", "n/a",
    "na", "anonymous", "tba", "tbd", "佚名", "不明",
}
NUMBER = re.compile(r"[+-]?(?:\d+(?:\.\d*)?|\.\d+)\Z")
SCHEME = re.compile(r"[a-zA-Z][a-zA-Z0-9+.-]*:")
PLAYER = re.compile(r"[a-zA-Z0-9_]{1,64}\Z")


def plain(value):
    """Normalize markup only for inspection; never return changes to stored data."""
    text = re.sub(r"<[^>]*>", "", html.unescape(str(value or "")))
    return re.sub(r"[\s\u200b-\u200f\ufeff]+", " ", text).strip()


def missing(value):
    return plain(value).casefold().strip("。.!！ ") in PLACEHOLDERS


def _resources(row, kind):
    prefix = "vod_" + kind + "_"
    values = {suffix: str(row.get(prefix + suffix) or "") for suffix in ("from", "url", "server", "note")}
    label = "播放" if kind == "play" else "下载"
    issues = []

    def add(code, severity, field, reason):
        issues.append({"code": kind + "_" + code, "severity": severity, "field": field, "reason": reason})

    if not any(values.values()):
        if kind == "play":
            add("missing", "missing", prefix + "from," + prefix + "url", "播放来源与地址均为空；未判断是否为合法预告或待更新条目。")
        return issues

    groups = {suffix: value.split("$$$") for suffix, value in values.items()}
    count = len(groups["from"])
    counts = {suffix: len(parts) for suffix, parts in groups.items() if values[suffix] != "" or suffix in ("from", "url")}
    if any(size != count for size in counts.values()):
        add("group_mismatch", "error", ",".join(prefix + suffix for suffix in counts),
            label + "四字段组数不一致：" + "、".join(f"{suffix}={size}" for suffix, size in counts.items()) + "。空 server/note 允许使用默认值。")

    for suffix in ("from", "url"):
        positions = [str(index + 1) for index, value in enumerate(groups[suffix]) if not value.strip()]
        if positions:
            add("empty_group", "error", prefix + suffix, f"{label}{suffix} 第 {','.join(positions[:10])} 组为空。")

    invalid_players = [str(index + 1) for index, player in enumerate(groups["from"]) if player and not PLAYER.fullmatch(player)]
    if invalid_players:
        add("player_invalid", "suspect", prefix + "from", f"第 {','.join(invalid_players[:10])} 组代码不符合字母、数字、下划线组成且长度 1～64 的约定；需核对站点实际播放器配置。")

    empty, unusual, conflicts = [], [], []
    for group_index, value in enumerate(groups["url"], 1):
        if not value:
            continue
        # Existing MacCMS resources commonly include a trailing '#' delimiter.
        episodes = value.rstrip("#").split("#")
        names = {}
        for episode_index, episode in enumerate(episodes, 1):
            position = f"{group_index}:{episode_index}"
            name, separator, url = episode.partition("$")
            if not separator:
                url, name = name, ""
            if not url.strip():
                empty.append(position)
                continue
            # Non-HTTP schemes, protocol-relative and root-relative addresses are
            # accepted. Opaque provider payloads are only candidates for review.
            if (not (SCHEME.match(url) or url.startswith(("//", "/")))
                    or re.search(r"[\x00-\x20<>]", url)):
                unusual.append(position)
            key = plain(name).casefold()
            if key and key in names and names[key] != url:
                conflicts.append(position)
            names[key] = url
    if empty:
        add("empty_episode", "error", prefix + "url", f"{label}条目地址为空（组:条目）：{','.join(empty[:10])}。")
    if unusual:
        add("url_format", "suspect", prefix + "url", f"地址缺少可识别协议/路径前缀，或包含未编码空白、控制字符、尖括号（组:条目）：{','.join(unusual[:10])}。未联网检查，也未断言专用播放器载荷无效。")
    if conflicts:
        add("label_conflict", "suspect", prefix + "url", f"同一组中出现相同条目名称对应不同地址（组:条目）：{','.join(conflicts[:10])}；需核对是否为不同集或版本。")
    return issues


def audit_row(row: dict, types: dict[int, dict]) -> list[dict]:
    """Return {code, severity, field, reason} issues without changing inputs."""
    issues = []

    def add(code, severity, field, reason):
        issues.append({"code": code, "severity": severity, "field": field, "reason": reason})

    for field, code, label in (("vod_name", "name_missing", "影片名称"),
                                ("vod_content", "content_missing", "剧情简介"),
                                ("vod_area", "area_missing", "地区"),
                                ("vod_lang", "lang_missing", "语言"),
                                ("vod_pic", "poster_missing", "海报地址")):
        if missing(row.get(field)):
            add(code, "missing", field, label + "为空、仅有 HTML 标记或为未知/待更新等占位词。")
    actors = re.split(r"[,，/|、;；\r\n]+", plain(row.get("vod_actor")))
    if all(missing(actor) for actor in actors):
        add("actor_missing", "missing", "vod_actor", "演员名单为空或只有未知/内详等占位词；未判断该作品是否应有演员资料。")

    year = plain(row.get("vod_year"))
    if missing(year):
        add("year_missing", "missing", "vod_year", "年份为空或为未知等占位词。")
    elif not re.fullmatch(r"(?:18|19|20)\d{2}", year):
        add("year_invalid", "error", "vod_year", f"年份应为 1800～2099 的四位数字，当前为 {year[:40]!r}。")

    for field in ("vod_score", "vod_douban_score"):
        value = str(row.get(field, "0")).strip()
        if not NUMBER.fullmatch(value) or not Decimal(0) <= Decimal(value) <= Decimal(10):
            add("score_invalid", "error", field, f"评分应为 0～10 的数值（0 可表示未评分），当前为 {value[:40]!r}。")

    value = str(row.get("vod_douban_id", "0")).strip()
    if not re.fullmatch(r"\d+", value) or int(value) > 4294967295:
        add("douban_id_invalid", "error", "vod_douban_id", f"豆瓣 ID 应为非负整数且符合数据库无符号 int 范围，当前为 {value[:40]!r}；0 仅表示缺失。")
    elif int(value) > 0 and not 100000 <= int(value) < 1000000000:
        add("douban_id_unusual", "suspect", "vod_douban_id", f"正豆瓣 ID {value!r} 的有效数字位数少于 6 位或超过 9 位；仅为离线位数疑点，未联网验证该 ID 是否存在。")

    type_id, parent_id = int(row.get("type_id", 0)), int(row.get("type_id_1", 0))
    if type_id not in types:
        add("type_unknown", "error", "type_id", f"分类 ID {type_id} 在 mac_type 中不存在。")
    else:
        category = types[type_id]
        expected = int(category.get("type_pid", 0))
        if parent_id != expected:
            add("type_parent_mismatch", "error", "type_id_1", f"当前父分类 {parent_id}，但 mac_type[{type_id}].type_pid={expected}。")
        if int(category.get("type_mid", 1)) != 1:
            add("type_module_mismatch", "error", "type_id", f"分类 ID {type_id} 的 type_mid={category['type_mid']}，不属于视频模块 1。")

    issues.extend(_resources(row, "play"))
    issues.extend(_resources(row, "down"))
    return issues
