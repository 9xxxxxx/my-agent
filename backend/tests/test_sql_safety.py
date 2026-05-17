"""Tests for SQL safety: whitelist-based SELECT-only validation."""
import pytest
from core.sql_safety import is_select_only, sanitize_sql


class TestSanitizeSql:
    def test_strips_block_comments(self):
        assert sanitize_sql("SELECT /* comment */ 1") == "SELECT 1"

    def test_strips_line_comments(self):
        assert sanitize_sql("SELECT 1 -- comment") == "SELECT 1"

    def test_collapses_whitespace(self):
        assert sanitize_sql("SELECT   1\n\tFROM  t") == "SELECT 1 FROM t"


class TestIsSelectOnly:
    def test_allows_select(self):
        ok, _ = is_select_only("SELECT * FROM users")
        assert ok is True

    def test_allows_with_cte(self):
        ok, _ = is_select_only("WITH cte AS (SELECT 1) SELECT * FROM cte")
        assert ok is True

    def test_allows_explain(self):
        ok, _ = is_select_only("EXPLAIN SELECT 1")
        assert ok is True

    def test_allows_describe(self):
        ok, _ = is_select_only("DESCRIBE users")
        assert ok is True

    def test_blocks_drop(self):
        ok, err = is_select_only("DROP TABLE users")
        assert ok is False
        assert "DROP" in err

    def test_blocks_delete(self):
        ok, err = is_select_only("DELETE FROM users")
        assert ok is False
        assert "DELETE" in err

    def test_blocks_update(self):
        ok, err = is_select_only("UPDATE users SET name='x'")
        assert ok is False
        assert "UPDATE" in err

    def test_blocks_insert(self):
        ok, err = is_select_only("INSERT INTO users VALUES (1)")
        assert ok is False
        assert "INSERT" in err

    def test_blocks_multi_statement(self):
        ok, err = is_select_only("SELECT 1; DROP TABLE users")
        assert ok is False
        assert "多条语句" in err

    def test_allows_trailing_semicolon(self):
        ok, _ = is_select_only("SELECT 1;")
        assert ok is True

    def test_blocks_comment_bypass(self):
        """SQL injection via comments between keywords."""
        ok, _ = is_select_only("SELECT 1; /**/DROP/**/ TABLE users")
        assert ok is False

    def test_blocks_attach(self):
        """DuckDB ATTACH can be used for SSRF."""
        ok, err = is_select_only("ATTACH 'http://evil.com/db' AS x")
        assert ok is False
        assert "ATTACH" in err

    def test_blocks_copy(self):
        """DuckDB COPY can read/write arbitrary files."""
        ok, _ = is_select_only("COPY (SELECT 1) TO '/tmp/out.csv'")
        assert ok is False

    def test_blocks_install(self):
        """DuckDB INSTALL can load extensions."""
        ok, _ = is_select_only("INSTALL httpfs")
        assert ok is False

    def test_blocks_empty_query(self):
        ok, err = is_select_only("")
        assert ok is False

    def test_blocks_whitespace_only(self):
        ok, _ = is_select_only("   ")
        assert ok is False
