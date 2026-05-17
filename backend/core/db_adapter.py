"""多数据库适配层：PostgreSQL / MySQL / SQLite / DuckDB"""
import logging
from abc import ABC, abstractmethod
from typing import Optional
import pandas as pd
from sqlalchemy import text, inspect

logger = logging.getLogger(__name__)


class DatabaseAdapter(ABC):
    def __init__(self, engine):
        self.engine = engine
        self.inspector = inspect(engine)

    @property
    @abstractmethod
    def db_type(self) -> str: ...

    @abstractmethod
    def list_schemas(self) -> list[str]: ...

    @abstractmethod
    def list_tables(self, schema: Optional[str] = None) -> list[dict]: ...

    def describe_table(self, table_name: str, schema: Optional[str] = None) -> dict:
        columns = self.inspector.get_columns(table_name, schema=schema)
        pk = self.inspector.get_pk_constraint(table_name, schema=schema)
        indexes = self.inspector.get_indexes(table_name, schema=schema)
        return {
            "schema": schema,
            "table": table_name,
            "columns": [
                {
                    "name": col["name"],
                    "type": str(col["type"]),
                    "nullable": col.get("nullable", True),
                    "default": str(col.get("default", "")) if col.get("default") else None,
                }
                for col in columns
            ],
            "primary_key": pk.get("constrained_columns", []) if pk else [],
            "indexes": [
                {"name": idx["name"], "columns": idx["column_names"], "unique": idx.get("unique", False)}
                for idx in indexes
            ],
        }

    def get_sample_data(self, table_name: str, schema: Optional[str] = None, limit: int = 3) -> pd.DataFrame:
        # Escape double quotes in identifiers
        safe_table = table_name.replace('"', '""')
        if schema:
            safe_schema = schema.replace('"', '""')
            qualified = f'"{safe_schema}"."{safe_table}"'
        else:
            qualified = f'"{safe_table}"'
        query = f"SELECT * FROM {qualified} LIMIT {limit}"
        try:
            return pd.read_sql_query(query, con=self.engine)
        except Exception as e:
            logger.warning("Failed to get sample data for %s.%s: %s", schema, table_name, e)
            return pd.DataFrame()

    def has_table(self, table_name: str, schema: Optional[str] = None) -> bool:
        return self.inspector.has_table(table_name, schema=schema)


class PostgreSQLAdapter(DatabaseAdapter):
    @property
    def db_type(self) -> str:
        return "postgresql"

    def list_schemas(self) -> list[str]:
        query = text("""
            SELECT schema_name FROM information_schema.schemata
            WHERE schema_name NOT IN ('pg_catalog', 'pg_toast', 'information_schema')
            ORDER BY schema_name
        """)
        with self.engine.connect() as conn:
            return [row[0] for row in conn.execute(query)]

    def list_tables(self, schema: Optional[str] = None) -> list[dict]:
        if schema:
            tables = self.inspector.get_table_names(schema=schema)
            views = self.inspector.get_view_names(schema=schema)
            return [{"schema": schema, "table": t, "type": "TABLE"} for t in tables] + \
                   [{"schema": schema, "table": v, "type": "VIEW"} for v in views]
        all_tables = []
        for s in self.list_schemas():
            tables = self.inspector.get_table_names(schema=s)
            views = self.inspector.get_view_names(schema=s)
            all_tables += [{"schema": s, "table": t, "type": "TABLE"} for t in tables]
            all_tables += [{"schema": s, "table": v, "type": "VIEW"} for v in views]
        return all_tables


class MySQLAdapter(DatabaseAdapter):
    @property
    def db_type(self) -> str:
        return "mysql"

    def list_schemas(self) -> list[str]:
        system_dbs = {"information_schema", "mysql", "performance_schema", "sys"}
        with self.engine.connect() as conn:
            return [row[0] for row in conn.execute(text("SHOW DATABASES")) if row[0] not in system_dbs]

    def list_tables(self, schema: Optional[str] = None) -> list[dict]:
        if schema:
            tables = self.inspector.get_table_names(schema=schema)
            views = self.inspector.get_view_names(schema=schema)
            return [{"schema": schema, "table": t, "type": "TABLE"} for t in tables] + \
                   [{"schema": schema, "table": v, "type": "VIEW"} for v in views]
        all_tables = []
        for s in self.list_schemas():
            try:
                tables = self.inspector.get_table_names(schema=s)
                views = self.inspector.get_view_names(schema=s)
                all_tables += [{"schema": s, "table": t, "type": "TABLE"} for t in tables]
                all_tables += [{"schema": s, "table": v, "type": "VIEW"} for v in views]
            except Exception as e:
                logger.warning("Failed to list tables for schema %s: %s", s, e)
                continue
        return all_tables


class SQLiteAdapter(DatabaseAdapter):
    @property
    def db_type(self) -> str:
        return "sqlite"

    def list_schemas(self) -> list[str]:
        return ["main"]

    def list_tables(self, schema: Optional[str] = None) -> list[dict]:
        tables = self.inspector.get_table_names()
        views = self.inspector.get_view_names()
        return [{"schema": "main", "table": t, "type": "TABLE"} for t in tables] + \
               [{"schema": "main", "table": v, "type": "VIEW"} for v in views]

    def has_table(self, table_name: str, schema: Optional[str] = None) -> bool:
        return self.inspector.has_table(table_name)

    def describe_table(self, table_name: str, schema: Optional[str] = None) -> dict:
        return super().describe_table(table_name, schema=None)

    def get_sample_data(self, table_name: str, schema: Optional[str] = None, limit: int = 3) -> pd.DataFrame:
        safe_table = table_name.replace('"', '""')
        query = f'SELECT * FROM "{safe_table}" LIMIT {limit}'
        try:
            return pd.read_sql_query(query, con=self.engine)
        except Exception as e:
            logger.warning("Failed to get sample data for %s: %s", table_name, e)
            return pd.DataFrame()


class DuckDBAdapter(DatabaseAdapter):
    @property
    def db_type(self) -> str:
        return "duckdb"

    def list_schemas(self) -> list[str]:
        query = text("SELECT schema_name FROM information_schema.schemata ORDER BY schema_name")
        with self.engine.connect() as conn:
            return [row[0] for row in conn.execute(query)]

    def list_tables(self, schema: Optional[str] = None) -> list[dict]:
        if schema:
            tables = self.inspector.get_table_names(schema=schema)
            views = self.inspector.get_view_names(schema=schema)
            return [{"schema": schema, "table": t, "type": "TABLE"} for t in tables] + \
                   [{"schema": schema, "table": v, "type": "VIEW"} for v in views]
        all_tables = []
        for s in self.list_schemas():
            tables = self.inspector.get_table_names(schema=s)
            views = self.inspector.get_view_names(schema=s)
            all_tables += [{"schema": s, "table": t, "type": "TABLE"} for t in tables]
            all_tables += [{"schema": s, "table": v, "type": "VIEW"} for v in views]
        return all_tables


_ADAPTER_MAP = {
    "postgresql": PostgreSQLAdapter,
    "mysql": MySQLAdapter,
    "mariadb": MySQLAdapter,
    "sqlite": SQLiteAdapter,
    "duckdb": DuckDBAdapter,
}


def get_adapter(engine) -> DatabaseAdapter:
    dialect_name = engine.dialect.name
    adapter_cls = _ADAPTER_MAP.get(dialect_name)
    if adapter_cls is None:
        raise ValueError(f"不支持的数据库类型: {dialect_name}。支持: {', '.join(_ADAPTER_MAP.keys())}")
    return adapter_cls(engine)
