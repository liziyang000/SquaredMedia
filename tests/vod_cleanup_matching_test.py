"""Identity regressions for offline mac_vod deduplication."""

from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts/data"))
from vod_cleanup import assess, metadata


TYPES = {1: {"type_pid": 0}, 2: {"type_pid": 0}, 11: {"type_pid": 1}, 22: {"type_pid": 2}}
SYNOPSIS = (
    "一位年轻的警察为了追查失踪的朋友来到海边的小城，在寻找真相的过程中，"
    "他遇到了两位来自不同家庭的伙伴。三个人共同调查多年前发生的案件，"
    "终于找到了被隐藏的证据，并帮助当地居民恢复正常生活。"
)


def row(ident=1, **changes):
    value = {
        "vod_id": ident, "type_id": 11, "vod_name": "海边追踪", "vod_sub": "",
        "vod_douban_id": 0, "vod_year": "2020", "vod_actor": "张甲,王乙",
        "vod_director": "陈导演", "vod_content": SYNOPSIS, "vod_version": "",
    }
    value.update(changes)
    return value


def decision(left, right):
    return assess(metadata(left, TYPES), metadata(right, TYPES))[0]


class MatchingTest(unittest.TestCase):
    def test_same_valid_id_and_consistent_metadata(self):
        self.assertTrue(decision(row(vod_douban_id=1234567), row(2, vod_douban_id=1234567)))

    def test_no_id_needs_title_synopsis_cast_and_year(self):
        self.assertTrue(decision(row(), row(2)))
        self.assertFalse(decision(row(), row(2, vod_content="短简介")))
        self.assertFalse(decision(row(), row(2, vod_year="")))
        self.assertFalse(decision(row(), row(2, vod_actor="赵丙,李丁")))
        self.assertFalse(decision(row(), row(2, vod_name="另一部电影")))

    def test_missing_id_can_join_consistent_known_id(self):
        self.assertTrue(decision(row(), row(2, vod_douban_id=1234567)))

    def test_distinct_positive_ids_are_never_merged(self):
        self.assertFalse(decision(row(vod_douban_id=1234567), row(2, vod_douban_id=7654321)))

    def test_one_actor_needs_shared_director(self):
        self.assertFalse(decision(row(vod_actor="张甲", vod_director=""), row(2, vod_actor="张甲", vod_director="")))
        self.assertTrue(decision(row(vod_actor="张甲"), row(2, vod_actor="张甲")))

    def test_same_title_remakes_with_different_years(self):
        self.assertFalse(decision(row(vod_year="1990"), row(2, vod_year="2020")))
        self.assertFalse(decision(row(vod_douban_id=1234567, vod_year="1990"), row(2, vod_douban_id=1234567)))

    def test_film_and_tv_roots_conflict(self):
        self.assertFalse(decision(row(vod_douban_id=1234567), row(2, vod_douban_id=1234567, type_id=22)))

    def test_different_seasons_despite_shared_cast_and_copied_synopsis(self):
        self.assertFalse(decision(row(vod_name="小城故事第一季", vod_sub="小城故事", vod_douban_id=1234567), row(2, vod_name="小城故事第二季", vod_sub="小城故事", vod_douban_id=1234567)))

    def test_different_parts_despite_shared_id(self):
        self.assertFalse(decision(row(vod_name="七十二家房客第一部", vod_douban_id=3238316), row(2, vod_name="七十二家房客第二部", vod_douban_id=3238316)))

    def test_different_editions_despite_shared_id(self):
        self.assertFalse(decision(row(vod_name="街坊故事第一辑", vod_douban_id=1234567), row(2, vod_name="街坊故事第二辑", vod_douban_id=1234567)))

    def test_chinese_and_arabic_season_numbers_are_equivalent(self):
        self.assertTrue(decision(row(vod_name="小城故事第十二季", vod_douban_id=1234567), row(2, vod_name="小城故事第12季", vod_douban_id=1234567)))

    def test_one_sided_season_is_deferred(self):
        self.assertFalse(decision(row(vod_name="小城故事", vod_douban_id=1234567), row(2, vod_name="小城故事第二季", vod_douban_id=1234567)))

    def test_suffix_sequel_is_not_original(self):
        self.assertFalse(decision(row(vod_name="无间道", vod_douban_id=1234567), row(2, vod_name="无间道2", vod_douban_id=1234567)))

    def test_shared_general_alias_does_not_hide_sequel_suffix(self):
        self.assertFalse(decision(row(vod_name="无间道", vod_douban_id=1234567), row(2, vod_name="无间道2", vod_sub="无间道", vod_douban_id=1234567)))

    def test_roman_numeral_sequel_is_not_original(self):
        self.assertFalse(decision(row(vod_name="洛奇", vod_douban_id=1234567), row(2, vod_name="洛奇Ⅱ", vod_douban_id=1234567)))

    def test_chinese_numeral_sequel_is_not_original(self):
        self.assertFalse(decision(row(vod_name="聊斋", vod_douban_id=1234567), row(2, vod_name="聊斋二", vod_douban_id=1234567)))

    def test_shared_series_alias_is_insufficient_without_id(self):
        self.assertFalse(decision(row(vod_name="倚天屠龙记之九阳神功", vod_sub="倚天屠龙记"), row(2, vod_name="倚天屠龙记之圣火雄风", vod_sub="倚天屠龙记")))

    def test_legitimate_primary_to_alias_match(self):
        self.assertTrue(decision(row(vod_name="海边追踪", vod_sub="Seaside Trace"), row(2, vod_name="Seaside Trace", vod_sub="海边追踪")))

    def test_prequel_is_not_original(self):
        self.assertFalse(decision(row(vod_name="功夫熊猫", vod_douban_id=1234567), row(2, vod_name="功夫熊猫前传", vod_douban_id=1234567)))

    def test_alias_season_conflict_is_not_hidden_by_main_title(self):
        self.assertFalse(decision(row(vod_name="小城故事", vod_sub="小城故事第一季", vod_douban_id=1234567), row(2, vod_name="小城故事", vod_sub="小城故事第二季", vod_douban_id=1234567)))

    def test_copied_synopsis_and_cast_do_not_override_director_conflict(self):
        self.assertFalse(decision(row(vod_director="甲导演"), row(2, vod_director="乙导演")))

    def test_special_content_and_versions_are_deferred(self):
        self.assertFalse(decision(row(vod_douban_id=1234567), row(2, vod_name="海边追踪电影解说", vod_douban_id=1234567)))
        self.assertFalse(decision(row(vod_douban_id=1234567, vod_version="导演剪辑版"), row(2, vod_douban_id=1234567, vod_version="院线版")))

    def test_version_suffix_conflicts_even_with_same_douban_id(self):
        for suffix in ("网络版", "TV版", "电视版", "未删减版"):
            with self.subTest(suffix=suffix):
                self.assertFalse(decision(row(vod_douban_id=1234567), row(2, vod_name="海边追踪" + suffix, vod_douban_id=1234567)))

    def test_shared_id_without_corroboration_is_deferred(self):
        self.assertFalse(decision(row(vod_douban_id=1234567), row(2, vod_douban_id=1234567, vod_name="完全不同的影片", vod_actor="赵丙,李丁", vod_content="")))

    def test_language_label_is_identity_neutral(self):
        self.assertTrue(decision(row(vod_name="海边追踪国语版"), row(2, vod_name="海边追踪粤语版")))


if __name__ == "__main__":
    unittest.main()
