import copy
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parents[1] / "scripts" / "data"))
from vod_cleanup_audit import RULE_NAMES, audit_row


class AuditTests(unittest.TestCase):
    def setUp(self):
        self.types = {11: {"type_pid": 1, "type_mid": 1}}
        self.row = {
            "vod_id": 1, "vod_name": "测试影片", "vod_content": "<p>一部影片的完整简介。</p>",
            "vod_actor": "甲演员,乙演员", "vod_year": "2025", "vod_score": "8.2",
            "vod_area": "中国大陆", "vod_lang": "汉语普通话", "vod_pic": "/upload/poster.jpg",
            "vod_douban_score": 0, "vod_douban_id": 0, "type_id": 11, "type_id_1": 1,
            "vod_status": 0, "vod_play_from": "m3u8", "vod_play_url": "第1集$https://example.test/1.m3u8#",
            "vod_play_server": "", "vod_play_note": "",
        }

    def codes(self, **updates):
        row = dict(self.row, **updates)
        issues = audit_row(row, self.types)
        for issue in issues:
            self.assertEqual(set(issue), {"code", "severity", "field", "reason"})
            self.assertIn(issue["code"], RULE_NAMES)
        return {issue["code"] for issue in issues}

    def test_compatible_defaults_are_not_anomalies(self):
        self.assertEqual(self.codes(), set())
        self.assertEqual(self.codes(vod_down_from="thunder", vod_down_url="下载$magnet:?xt=urn:btih:123"), set())
        self.assertEqual(self.codes(vod_play_url="https://example.test/raw.m3u8"), set())
        self.assertEqual(self.codes(vod_play_url="第1集$/upload/1.m3u8"), set())

    def test_missing_placeholders_and_html_only(self):
        codes = self.codes(vod_name="未知", vod_content="<p>&nbsp;</p>", vod_actor="内详/未知", vod_year="0")
        self.assertEqual(codes, {"name_missing", "content_missing", "actor_missing", "year_missing"})

    def test_invalid_numeric_fields(self):
        self.assertEqual(self.codes(vod_score="NaN", vod_douban_score=11, vod_douban_id=-1, vod_year="2025-2026"),
                         {"score_invalid", "douban_id_invalid", "year_invalid"})
        self.assertIn("douban_id_invalid", self.codes(vod_douban_id=4294967296))

    def test_unusual_douban_ids_are_offline_suspicions(self):
        for value in (1, 10000, 99999, 1000000000, 2931234567):
            issues = audit_row(dict(self.row, vod_douban_id=value), self.types)
            self.assertEqual({issue["code"] for issue in issues}, {"douban_id_unusual"})
            self.assertEqual(issues[0]["severity"], "suspect")
            self.assertIn("未联网验证", issues[0]["reason"])
        for value in (0, 100000, 1292052, 999999999):
            self.assertEqual(self.codes(vod_douban_id=value), set())

    def test_missing_area_language_and_poster(self):
        self.assertEqual(self.codes(vod_area="暂无", vod_lang="unknown", vod_pic="0"),
                         {"area_missing", "lang_missing", "poster_missing"})

    def test_category_errors(self):
        self.assertEqual(self.codes(type_id=999), {"type_unknown"})
        self.assertEqual(self.codes(type_id_1=2), {"type_parent_mismatch"})
        self.types[11]["type_mid"] = 2
        self.assertEqual(self.codes(), {"type_module_mismatch"})

    def test_resource_structure(self):
        self.assertIn("play_group_mismatch", self.codes(vod_play_from="a$$$b"))
        self.assertIn("play_group_mismatch", self.codes(vod_play_note="a$$$b"))
        self.assertIn("play_empty_group", self.codes(vod_play_from=""))
        self.assertIn("play_empty_episode", self.codes(vod_play_url="一$https://e.test/1##二$https://e.test/2"))
        self.assertIn("play_empty_episode", self.codes(vod_play_url="第一集$"))

    def test_potential_problems_remain_suspicions(self):
        issues = audit_row(dict(self.row, vod_play_from="中文播放器", vod_play_url="同名$abc#同名$def"), self.types)
        self.assertTrue(issues)
        self.assertTrue(all(issue["severity"] == "suspect" for issue in issues))
        self.assertEqual({issue["code"] for issue in issues}, {"play_player_invalid", "play_url_format", "play_label_conflict"})

    def test_no_mutations(self):
        row, types = copy.deepcopy(self.row), copy.deepcopy(self.types)
        audit_row(row, types)
        self.assertEqual(row, self.row)
        self.assertEqual(types, self.types)


if __name__ == "__main__":
    unittest.main()
