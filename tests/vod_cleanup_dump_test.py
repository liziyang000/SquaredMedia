import importlib.util
from decimal import Decimal
from pathlib import Path
import tempfile
import unittest


MODULE = Path(__file__).resolve().parents[1] / "scripts/data/vod_cleanup_dump.py"
spec = importlib.util.spec_from_file_location("vod_cleanup_dump", MODULE)
dump = importlib.util.module_from_spec(spec)
spec.loader.exec_module(dump)


class DumpTest(unittest.TestCase):
    def test_mysql_string_escapes_and_raw_preservation(self):
        line = "INSERT INTO `mac_vod` VALUES (1,'a,()\\\'b\\\\c\\n中文',NULL,8.5),(2,'it''s \\0 \\Z',0,-1e2);\n"
        table, rows = dump.parse_insert(line)
        self.assertEqual(table, "mac_vod")
        self.assertEqual(dump.decode_token(rows[0][1]), "a,()'b\\c\n中文")
        self.assertIsNone(dump.decode_token(rows[0][2]))
        self.assertEqual(dump.decode_token(rows[0][3]), Decimal("8.5"))
        self.assertEqual(dump.decode_token(rows[1][1]), "it's \0 \x1a")
        self.assertEqual(dump.decode_token(rows[1][3]), Decimal("-100"))
        self.assertEqual(dump.render_insert(table, rows), line)

    def test_string_round_trip(self):
        for value in ["", "剧情'演员\\导演", "\0\b\n\r\t\x1a", 'a"b', "100%_", "\\%\\_", "😀"]:
            with self.subTest(value=repr(value)):
                self.assertEqual(dump.decode_token(dump.encode_value(value)), value)

    def test_mysql_unknown_and_like_escape(self):
        self.assertEqual(dump.decode_token("'\\x\\%\\_'"), "x\\%\\_")

    def test_changed_field_preserves_other_tokens(self):
        table, rows = dump.parse_insert("INSERT INTO `mac_vod` VALUES (7,'it''s',8.0);\n")
        rows[0][0] = dump.encode_value(4)
        self.assertEqual(dump.render_insert(table, rows), "INSERT INTO `mac_vod` VALUES (4,'it''s',8.0);\n")

    def test_rejects_incomplete_or_unexpected_sql(self):
        for line in ["INSERT INTO `t` VALUES (1,'broken);", "INSERT INTO `t` VALUES (1)", "INSERT INTO `t` VALUES (1); DROP TABLE t;", "INSERT INTO `t` VALUES (NOW());", "INSERT INTO `t` VALUES (1,,2);", "INSERT INTO `t` VALUES (1);x"]:
            with self.subTest(line=line), self.assertRaises(ValueError):
                dump.parse_insert(line)

    def test_schema_and_column_counts(self):
        text = "CREATE TABLE `mac_vod` (\n  `vod_id` int,\n  `vod_name` text,\n PRIMARY KEY (`vod_id`)\n) ENGINE=MyISAM;\nINSERT INTO `mac_vod` VALUES (1,'片名'),(2,'片名2');\n"
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "fixture.sql"
            path.write_text(text)
            self.assertEqual(dump.table_schemas(path), {"mac_vod": ["vod_id", "vod_name"]})
            self.assertEqual(dump.check_dump(path)["rows"], {"mac_vod": 2})
            path.write_text(text.replace("(2,'片名2')", "(2)"))
            with self.assertRaises(ValueError):
                dump.check_dump(path)

    def test_whitespace_multiline_and_scalars(self):
        _, rows = dump.parse_insert("INSERT INTO `t` VALUES ( 1 , 'line\nvalue' ),\n( 2, NULL );\n")
        self.assertEqual([dump.decode_token(item) for item in rows[0]], [1, "line\nvalue"])
        for value in [None, 0, -12, Decimal("8.0"), True, False]:
            self.assertEqual(dump.decode_token(dump.encode_value(value)), value)


if __name__ == "__main__":
    unittest.main()
