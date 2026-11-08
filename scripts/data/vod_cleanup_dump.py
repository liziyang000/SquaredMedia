"""Small streaming reader for the extended INSERT format emitted by mysqldump.

Unchanged input lines and raw field tokens can be copied without re-encoding.
No SQL is executed, and the validation CLI prints counts rather than row data.
"""

import argparse
from collections import Counter
from decimal import Decimal
import json
from pathlib import Path
import re


_INSERT = re.compile(r"INSERT INTO `([^`]+)` VALUES\s*")
_CREATE = re.compile(r"CREATE TABLE `([^`]+)` \(")
_COLUMN = re.compile(r"\s+`([^`]+)`\s")
_TOKEN = re.compile(r"\s*(?:'(?:[^'\\]|\\[\s\S]|'')*'|NULL|[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][-+]?\d+)?)\s*", re.IGNORECASE)
_INTEGER = re.compile(r"[-+]?\d+\Z")
_NUMBER = re.compile(r"[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][-+]?\d+)?\Z")
_UNESCAPE = re.compile(r"\\([\s\S])|''")
_ESCAPE_VALUES = {"0": "\0", "b": "\b", "n": "\n", "r": "\r", "t": "\t", "Z": "\x1a"}


def table_schemas(path):
    """Read column order for every CREATE TABLE, without retaining INSERT data."""
    schemas = {}
    current = None
    with Path(path).open(encoding="utf-8", newline="") as source:
        for line in source:
            match = _CREATE.match(line)
            if match:
                current = match[1]
                schemas[current] = []
            elif current is not None:
                column = _COLUMN.match(line)
                if column:
                    schemas[current].append(column[1])
                elif line.startswith(")"):
                    current = None
    return schemas


def iter_insert_rows(line):
    """Return (table, iterator of raw token lists) for one extended INSERT.

    Consume the iterator completely to validate the statement terminator.
    Physical newlines inside string literals are supported by this parser;
    mysqldump itself escapes them when writing its single-line INSERTs.
    """
    match = _INSERT.match(line)
    if not match:
        raise ValueError("Expected INSERT INTO `table` VALUES statement")

    def rows():
        position = match.end()
        while True:
            if position >= len(line) or line[position] != "(":
                raise ValueError(f"Expected row opening at offset {position}")
            position += 1
            fields = []
            while True:
                token = _TOKEN.match(line, position)
                if token is None or token.end() == position:
                    raise ValueError(f"Unsupported or malformed value at offset {position}")
                fields.append(token[0])
                position = token.end()
                if position >= len(line):
                    raise ValueError("Unterminated INSERT row")
                delimiter = line[position]
                position += 1
                if delimiter == ",":
                    continue
                if delimiter == ")":
                    break
                raise ValueError(f"Expected field delimiter at offset {position - 1}")
            yield fields
            while position < len(line) and line[position].isspace():
                position += 1
            if position < len(line) and line[position] == ";":
                if line[position + 1:].strip():
                    raise ValueError("Unexpected content after INSERT terminator")
                return
            if position >= len(line) or line[position] != ",":
                raise ValueError(f"Expected row delimiter at offset {position}")
            position += 1
            while position < len(line) and line[position].isspace():
                position += 1

    return match[1], rows()


def parse_insert(line):
    """Return (table, list of rows of raw SQL tokens)."""
    table, rows = iter_insert_rows(line)
    return table, list(rows)


def decode_token(token):
    token = token.strip()
    if token.upper() == "NULL":
        return None
    if token.startswith("'") and token.endswith("'"):
        def replace(match):
            if match[0] == "''":
                return "'"
            escaped = match[1]
            if escaped in ("%", "_"):
                return "\\" + escaped
            return _ESCAPE_VALUES.get(escaped, escaped)
        return _UNESCAPE.sub(replace, token[1:-1])
    if _INTEGER.fullmatch(token):
        return int(token)
    if _NUMBER.fullmatch(token):
        return Decimal(token)
    raise ValueError("Unsupported SQL token")


def encode_value(value):
    """Encode an explicitly changed scalar for MySQL's normal string mode."""
    if value is None:
        return "NULL"
    if isinstance(value, bool):
        return "1" if value else "0"
    if isinstance(value, int):
        return str(value)
    if isinstance(value, Decimal):
        if not value.is_finite():
            raise ValueError("Non-finite SQL number")
        return str(value)
    if isinstance(value, str):
        escapes = {"\\": "\\\\", "'": "\\'", "\0": "\\0", "\b": "\\b", "\n": "\\n", "\r": "\\r", "\t": "\\t", "\x1a": "\\Z"}
        return "'" + re.sub(r"[\\'\x00\x08\n\r\t\x1a]", lambda match: escapes[match[0]], value) + "'"
    raise TypeError(f"Unsupported SQL value type: {type(value).__name__}")


def render_insert(table, rows):
    if not re.fullmatch(r"[A-Za-z0-9_]+", table):
        raise ValueError("Unsupported table identifier")
    return f"INSERT INTO `{table}` VALUES " + ",".join("(" + ",".join(row) + ")" for row in rows) + ";\n"


def check_dump(path):
    """Validate field counts as schemas and rows arrive in a single pass."""
    schemas = {}
    counts = Counter()
    statements = Counter()
    current = None
    with Path(path).open(encoding="utf-8", newline="") as source:
        for line_number, line in enumerate(source, 1):
            create = _CREATE.match(line)
            if create:
                current = create[1]
                schemas[current] = []
                counts[current] = 0
            elif current is not None:
                column = _COLUMN.match(line)
                if column:
                    schemas[current].append(column[1])
                elif line.startswith(")"):
                    current = None
            elif line.startswith("INSERT INTO "):
                table, rows = iter_insert_rows(line)
                expected = len(schemas[table])
                for row in rows:
                    if len(row) != expected:
                        raise ValueError(f"{table}: expected {expected} columns, found {len(row)} on line {line_number}")
                    counts[table] += 1
                statements[table] += 1
    return {"tables": len(schemas), "rows": dict(counts), "insert_statements": dict(statements), "columns": {table: len(columns) for table, columns in schemas.items()}}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", required=True, type=Path, help="Read and validate a mysqldump file")
    arguments = parser.parse_args()
    print(json.dumps(check_dump(arguments.check), ensure_ascii=False, indent=2))
