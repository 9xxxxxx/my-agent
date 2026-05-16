"""数据文件加载器：CSV/Excel/JSON/Parquet → DuckDB 内存表"""
from pathlib import Path
import pandas as pd
import duckdb

# 全局 DuckDB 内存连接，所有上传的文件都注册为这里的虚拟表
_con = duckdb.connect(":memory:")

# 已注册的表名 → 文件路径映射
_registered_tables: dict[str, Path] = {}


def load_file(file_path: str | Path, table_name: str | None = None) -> str:
    """加载数据文件并注册为 DuckDB 虚拟表，返回表名"""
    path = Path(file_path)
    if not path.exists():
        raise FileNotFoundError(f"文件不存在: {path}")

    name = table_name or path.stem.replace("-", "_").replace(" ", "_")
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
    df.columns = [c.replace(" ", "_").replace("-", "_") for c in df.columns]

    # 注册到 DuckDB
    _con.unregister(name) if name in _registered_tables else None
    _con.register(name, df)
    _registered_tables[name] = path

    return name


def query_file(sql: str) -> pd.DataFrame:
    """在 DuckDB 内存引擎上执行 SQL 查询（可查询所有已注册的文件表）"""
    try:
        return _con.execute(sql).fetchdf()
    except Exception as e:
        raise RuntimeError(f"文件查询失败: {e}")


def list_file_tables() -> list[dict]:
    """列出所有已注册的文件表"""
    tables = []
    for name, path in _registered_tables.items():
        try:
            row_count = _con.execute(f"SELECT COUNT(*) FROM {name}").fetchone()[0]
            col_count = len(_con.execute(f"SELECT * FROM {name} LIMIT 0").description)
            tables.append({"table_name": name, "source_file": str(path), "rows": row_count, "columns": col_count})
        except Exception:
            tables.append({"table_name": name, "source_file": str(path), "rows": -1, "columns": -1})
    return tables


def unregister_table(table_name: str) -> bool:
    """取消注册指定表"""
    if table_name in _registered_tables:
        _con.unregister(table_name)
        del _registered_tables[table_name]
        return True
    return False
