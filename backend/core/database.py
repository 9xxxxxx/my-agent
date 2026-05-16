"""SQLAlchemy 引擎管理 + 连接池"""
from sqlalchemy import create_engine, text
import pandas as pd
from core.config import settings

_engine_cache: dict[str, any] = {}


def get_engine_by_url(url: str):
    if url not in _engine_cache:
        sync_url = url.replace("+asyncpg", "+psycopg2")
        engine = create_engine(
            sync_url,
            pool_size=5,
            max_overflow=10,
            pool_timeout=30,
            pool_recycle=1800,
        )
        _engine_cache[url] = engine
    return _engine_cache[url]


def get_engine(url: str | None = None):
    current_url = url or settings.DATABASE_URL
    if not current_url:
        raise ValueError("未配置数据库连接。请设置 AGENT_DATABASE_URL 或通过前端切换数据库。")
    return get_engine_by_url(current_url)


def test_connection(url: str | None = None) -> bool:
    try:
        eng = get_engine(url)
        with eng.connect() as conn:
            conn.execute(text("SELECT 1"))
        return True
    except Exception as e:
        print(f"Database connection error: {e}")
        return False


def run_query_to_dataframe(query: str, url: str | None = None) -> pd.DataFrame:
    eng = get_engine(url)
    try:
        return pd.read_sql_query(query, con=eng)
    except Exception as e:
        raise RuntimeError(f"查询执行失败: {e}")
