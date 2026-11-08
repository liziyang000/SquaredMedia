"""Loss and access-boundary checks for complete-route offline merges."""

from copy import deepcopy
from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts/data"))
from vod_cleanup import merge_group, resource_groups


PROTECTED = (
    "group_id", "vod_status", "vod_copyright", "vod_points", "vod_points_play", "vod_points_down", "vod_trysee",
    "vod_pwd", "vod_pwd_url", "vod_pwd_play", "vod_pwd_play_url", "vod_pwd_down", "vod_pwd_down_url", "vod_jumpurl", "vod_publish_time",
)
NUMERIC = (
    "vod_douban_id", "vod_douban_score", "vod_score", "vod_total", "vod_time", "vod_time_hits", "vod_time_make",
    "vod_hits", "vod_hits_day", "vod_hits_week", "vod_hits_month", "vod_up", "vod_down", "vod_score_all", "vod_score_num", "vod_share_count",
)


def row(ident=1, **changes):
    string_fields = (
        "vod_actor", "vod_director", "vod_writer", "vod_tag", "vod_class", "vod_sub", "vod_content", "vod_blurb",
        "vod_pic_thumb", "vod_pic_slide", "vod_pic_original", "vod_pic_screenshot", "vod_tv", "vod_weekday", "vod_area", "vod_lang",
        "vod_pubdate", "vod_duration", "vod_reurl", "vod_behind", "vod_author", "vod_rel_vod", "vod_rel_art",
    )
    value = dict.fromkeys(string_fields, "")
    value.update(dict.fromkeys(PROTECTED, 0))
    value.update(dict.fromkeys(NUMERIC, 0))
    value.update({"vod_id": ident, "vod_name": "海边追踪", "vod_lock": 0, "vod_recycle_time": 0, "vod_time_add": 100})
    for kind in ("play", "down"):
        value.update({f"vod_{kind}_{suffix}": "" for suffix in ("from", "url", "server", "note")})
    value.update({"vod_play_from": "player", "vod_play_url": "第1集$https://example.test/1.m3u8#第2集$https://example.test/2.m3u8#"})
    value.update(changes)
    return value


class MergeTest(unittest.TestCase):
    def test_oldest_id_is_retained_without_mutating_originals(self):
        originals = [row(20, vod_content="较长的剧情简介"), row(10, vod_content="简介")]
        snapshot = deepcopy(originals)
        merged, routes = merge_group(originals)
        self.assertEqual(merged["vod_id"], 10)
        self.assertEqual(merged["vod_content"], "较长的剧情简介")
        self.assertEqual(originals, snapshot)
        self.assertEqual(routes["play"], {"10": {1: 1}, "20": {1: 1}})

    def test_unchanged_route_format_and_trailing_delimiter_are_preserved(self):
        target = row(vod_play_server="", vod_play_note="")
        donor = row(2, vod_play_server="no", vod_play_note="")
        merged, routes = merge_group([target, donor])
        for field in ("vod_play_from", "vod_play_url", "vod_play_server", "vod_play_note"):
            self.assertEqual(merged[field], target[field])
        self.assertEqual(routes["play"]["2"], {1: 1})

    def test_append_complete_routes_preserves_episode_positions(self):
        first = "第1集$https://example.test/a1#第2集$https://example.test/a2#"
        second = "第2集$https://example.test/b2#第1集$https://example.test/b1#"
        third = "第1集$https://example.test/c1#"
        target = row(vod_play_from="a$$$b", vod_play_url=first + "$$$" + second)
        donor = row(2, vod_play_from="b$$$c", vod_play_url=second + "$$$" + third)
        merged, routes = merge_group([target, donor])
        self.assertEqual(merged["vod_play_from"], "a$$$b$$$c")
        self.assertEqual(merged["vod_play_url"], first + "$$$" + second + "$$$" + third)
        self.assertEqual(routes["play"], {"1": {1: 1, 2: 2}, "2": {1: 2, 2: 3}})
        self.assertEqual(merged["vod_play_server"], "no$$$no$$$no")
        self.assertEqual(merged["vod_play_note"], "$$$$$$")

    def test_same_player_with_different_urls_keeps_both_routes(self):
        donor = row(2, vod_play_url="第1集$https://example.test/alternate#")
        merged, routes = merge_group([row(), donor])
        self.assertEqual(merged["vod_play_from"], "player$$$player")
        self.assertEqual(routes["play"]["2"], {1: 2})
        self.assertEqual(resource_groups(merged, "play")[1][1], donor["vod_play_url"])

    def test_existing_duplicate_slots_keep_their_original_numbers(self):
        url = "正片$https://example.test/movie"
        target = row(vod_play_from="a$$$a", vod_play_url=url + "$$$" + url)
        merged, routes = merge_group([target, row(2, vod_play_from="a", vod_play_url=url)])
        self.assertEqual(routes["play"]["1"], {1: 1, 2: 2})
        self.assertEqual(routes["play"]["2"], {1: 1})
        self.assertEqual(merged["vod_play_from"], "a$$$a")

    def test_server_or_note_difference_retains_distinct_resource(self):
        for field in ("vod_play_server", "vod_play_note"):
            with self.subTest(field=field):
                merged, routes = merge_group([row(), row(2, **{field: "custom"})])
                self.assertEqual(len(resource_groups(merged, "play")), 2)
                self.assertEqual(routes["play"]["2"], {1: 2})

    def test_download_resources_and_coordinates_are_merged_independently(self):
        donor = row(2, vod_down_from="http", vod_down_url="全集$https://example.test/movie.zip")
        merged, routes = merge_group([row(), donor])
        self.assertEqual(merged["vod_down_url"], donor["vod_down_url"])
        self.assertEqual(routes["down"], {"1": {}, "2": {1: 1}})
        self.assertEqual(routes["play"]["2"], {1: 1})

    def test_route_header_overflow_is_deferred_without_truncation(self):
        target = row(vod_play_from="a" * 130)
        donor = row(2, vod_play_from="b" * 130)
        with self.assertRaisesRegex(ValueError, "vod_play_from.*255"):
            merge_group([target, donor])

    def test_route_group_mismatch_is_rejected(self):
        with self.assertRaisesRegex(ValueError, "组数错位"):
            resource_groups(row(vod_play_from="a$$$b"), "play")

    def test_every_access_or_status_difference_blocks_merge(self):
        for field in PROTECTED:
            with self.subTest(field=field), self.assertRaisesRegex(ValueError, field):
                merge_group([row(), row(2, **{field: 1})])

    def test_locked_and_recycled_records_are_preserved(self):
        for field in ("vod_lock", "vod_recycle_time"):
            with self.subTest(field=field), self.assertRaisesRegex(ValueError, "锁定|回收"):
                merge_group([row(), row(2, **{field: 1})])

    def test_metadata_union_preserves_existing_format_when_nothing_added(self):
        target = row(vod_actor="张甲 / 王乙")
        merged, _ = merge_group([target, row(2, vod_actor="王乙,张甲")])
        self.assertEqual(merged["vod_actor"], target["vod_actor"])

    def test_metadata_union_does_not_truncate_at_field_limit(self):
        target = row(vod_tag="甲" * 60)
        donor = row(2, vod_tag="乙" * 60)
        merged, _ = merge_group([target, donor])
        self.assertEqual(merged["vod_tag"], target["vod_tag"])
        self.assertEqual(donor["vod_tag"], "乙" * 60)

    def test_metadata_combines_people_aliases_and_preserves_chosen_markup(self):
        target = row(vod_actor="张甲", vod_name="海边追踪", vod_content="<p>简介</p>", vod_time_add=200)
        donor = row(2, vod_actor="张甲,王乙", vod_name="海岸追踪", vod_content="<p>更完整的剧情内容</p>", vod_time_add=100)
        merged, _ = merge_group([target, donor])
        self.assertEqual(merged["vod_actor"], "张甲,王乙")
        self.assertEqual(merged["vod_sub"], "海岸追踪")
        self.assertEqual(merged["vod_content"], "<p>更完整的剧情内容</p>")
        self.assertEqual(merged["vod_time_add"], 100)

    def test_relation_overflow_defers_group_instead_of_losing_ids(self):
        with self.assertRaisesRegex(ValueError, "vod_rel_vod.*255"):
            merge_group([row(vod_rel_vod=",".join(str(i) for i in range(100, 150))), row(2, vod_rel_vod=",".join(str(i) for i in range(150, 200)))])


if __name__ == "__main__":
    unittest.main()
