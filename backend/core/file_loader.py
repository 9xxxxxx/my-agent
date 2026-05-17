"""数据文件加载器：CSV/Excel/JSON/Parquet → DuckDB 内存表"""
import re
import threading
from pathlib import Path
import pandas as pd
import duckdb

# Thread lock for DuckDB operations
_duckdb_lock = threading.Lock()

# 全局 DuckDB 内存连接，所有上传的文件都注册为这里的虚拟表
_con = duckdb.connect(":memory:")

# 已注册的表名 → 文件路径映射
_registered_tables: dict[str, Path] = {}

# Maximum upload file size: 500MB
MAX_FILE_SIZE = 500 * 1024 * 1024

# Safe table name pattern
_SAFE_TABLE_RE = re.compile(r"^[a-zA-Z_][a-zA-Z0-9_]*$")


def _sanitize_table_name(name: str) -> str:
    """Sanitize table name to only allow safe identifiers."""
    # Replace common separators with underscores
    clean = name.replace("-", "_").replace(" ", "_").replace(".", "_")
    # Remove any non-alphanumeric/underscore characters
    clean = re.sub(r"[^a-zA-Z0-9_]", "", clean)
    # Ensure it starts with a letter or underscore
    if clean and clean[0].isdigit():
        clean = "_" + clean
    return clean or "table"


def load_file(file_path: str | Path, table_name: str | None = None) -> str:
    """加载数据文件并注册为 DuckDB 虚拟表，返回表名"""
    path = Path(file_path)
    if not path.exists():
        raise FileNotFoundError(f"文件不存在: {path}")

    # Check file size
    file_size = path.stat().st_size
    if file_size > MAX_FILE_SIZE:
        raise ValueError(f"文件过大: {file_size / 1024 / 1024:.1f}MB，最大允许 {MAX_FILE_SIZE / 1024 / 1024:.0f}MB")

    name = _sanitize_table_name(table_name or path.stem)
    suffix = path.suffix.lower()

    if suffix == ".csv":
        df = pd.read_csv(path)
    elif suffix in (".xlsx", ".xls"):
        df = pd.read_excel(path)
    elif suffix == ".json":
        df = pd.read_json(path)
    elif suffix == ".parquet":
        df = pd.read_parquet(path)
    else:
        raise ValueError(f"不支持的文件格式: {suffix}。支持: .csv, .xlsx, .json, .parquet")

    # 清理列名中的特殊字符
    df.columns = [_sanitize_table_name(c) or f"col_{i}" for i, c in enumerate(df.columns)]

    # Deduplicate column names
    seen = {}
    unique_cols = []
    for col in df.columns:
        if col in seen:
            seen[col] += 1
            unique_cols.append(f"{col}_{seen[col]}")
        else:
            seen[col] = 0
            unique_cols.append(col)
    df.columns = unique_cols

    # 注册到 DuckDB (thread-safe)
    with _duckdb_lock:
        if name in _registered_tables:
            _con.unregister(name)
        _con.register(name, df)
        _registered_tables[name] = path

    return name


def query_file(sql: str) -> pd.DataFrame:
    """在 DuckDB 内存引擎上执行 SQL 查询（可查询所有已注册的文件表）"""
    with _duckdb_lock:
        try:
            return _con.execute(sql).fetchdf()
        except Exception as e:
            raise RuntimeError(f"文件查询失败: {e}")


def list_file_tables() -> list[dict]:
    """列出所有已注册的文件表"""
    tables = []
    with _duckdb_lock:
        for name, path in _registered_tables.items():
            try:
                safe_name = f'"{name}"'
                row_count = _con.execute(f"SELECT COUNT(*) FROM {safe_name}").fetchone()[0]
                col_count = len(_con.execute(f"SELECT * FROM {safe_name} LIMIT 0").description)
                tables.append({"table_name": name, "source_file": str(path), "rows": row_count, "columns": col_count})
            except Exception:
                tables.append({"table_name": name, "source_file": str(path), "rows": -1, "columns": -1})
    return tables


def unregister_table(table_name: str) -> bool:
    """取消注册指定表"""
    with _duckdb_lock:
        if table_name in _registered_tables:
            _con.unregister(table_name)
            del _registered_tables[table_name]
            return True
    return False
