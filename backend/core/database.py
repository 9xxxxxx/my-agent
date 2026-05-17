"""SQLAlchemy 引擎管理 + 连接池"""
import os
from contextvars import ContextVar
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session
import pandas as pd
from core.config import settings
from core.models import Base

_engine_cache: dict[str, any] = {}

# Per-request database URL override (set by API layer)
_current_db_url: ContextVar[str | None] = ContextVar("current_db_url", default=None)

# ── 应用内部 SQLite（持久化对话、配置） ──

_DB_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data")
_APP_DB_URL = f"sqlite:///{os.path.join(_DB_DIR, 'app.db')}"
_app_engine = None


def get_app_engine():
    """获取应用内部 SQLite 引擎（单例）"""
    global _app_engine
    if _app_engine is None:
        os.makedirs(_DB_DIR, exist_ok=True)
        _app_engine = create_engine(_APP_DB_URL)
    return _app_engine


def init_app_db():
    """启动时自动建表"""
    engine = get_app_engine()
    Base.metadata.create_all(engine)


def get_app_session() -> Session:
    """获取应用内部数据库 session"""
    return Session(get_app_engine())


def set_current_db_url(url: str | None):
    """Set the database URL for the current request context."""
    _current_db_url.set(url)


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
    current_url = url or _current_db_url.get() or settings.DATABASE_URL
    if not current_url:
        raise ValueError("未配置数据库连接。请设置 AGENT_DATABASE_URL 或通过前端切换数据库。")
    return get_engine_by_url(current_url)


def test_connection(url: str | None = None) -> tuple[bool, str | None]:
    try:
        eng = get_engine(url)
        with eng.connect() as conn:
            conn.execute(text("SELECT 1"))
        return True, None
    except Exception as e:
        print(f"Database connection error: {e}")
        return False, str(e)


def run_query_to_dataframe(query: str, url: str | None = None) -> pd.DataFrame:
    eng = get_engine(url)
    try:
        return pd.read_sql_query(query, con=eng)
    except Exception as e:
        raise RuntimeError(f"查询执行失败: {e}")
