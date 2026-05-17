"""SQL safety utilities: whitelist-based SELECT-only validation."""
import re

# Blocked DuckDB extensions/commands that can cause SSRF or RCE
_DUCKDB_BLOCKED = frozenset({
    "ATTACH", "DETACH", "COPY", "INSTALL", "LOAD", "EXPORT", "CALL",
})

# Regex to strip SQL block comments
_BLOCK_COMMENT_RE = re.compile(r"/\*.*?\*/", re.DOTALL)
# Regex to strip SQL line comments
_LINE_COMMENT_RE = re.compile(r"--[^\n]*")


def sanitize_sql(query: str) -> str:
    """Strip comments and collapse whitespace for analysis."""
    text = _BLOCK_COMMENT_RE.sub(" ", query)
    text = _LINE_COMMENT_RE.sub(" ", text)
    return " ".join(text.split())


def is_select_only(query: str) -> tuple[bool, str]:
    """Validate that a SQL query is a read-only SELECT/WITH statement.

    Returns (ok, error_message). If ok is False, error_message explains why.
    """
    cleaned = sanitize_sql(query)
    if not cleaned:
        return False, "空查询"

    upper = cleaned.upper()

    # Must start with SELECT or WITH (CTE)
    first_word = upper.split()[0]
    if first_word not in ("SELECT", "WITH", "EXPLAIN", "DESCRIBE"):
        return False, f"仅允许 SELECT 查询，不允许 '{first_word}' 语句"

    # Block dangerous DuckDB commands anywhere in the query
    words = set(upper.split())
    blocked = words & _DUCKDB_BLOCKED
    if blocked:
        return False, f"禁止执行 {'、'.join(sorted(blocked))} 语句"

    # Block semicolon-separated multi-statements (allow single trailing semicolon)
    stripped = cleaned.rstrip(";").strip()
    if ";" in stripped:
        return False, "禁止执行多条语句"

    return True, ""
