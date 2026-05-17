"""数据库探索工具：schema 发现、表结构查看、SQL 执行"""
from agents import function_tool
from core.database import get_engine, run_query_to_dataframe
from core.db_adapter import get_adapter


@function_tool
def list_schemas(database_url: str = "") -> str:
    """列出当前数据库中所有可用的 Schema（命名空间）。
    PostgreSQL 中对应 schema，MySQL 中对应 database，SQLite 固定为 main。"""
    try:
        engine = get_engine(database_url or None)
    except ValueError:
        return "未配置数据库连接。请在设置中配置数据库连接，或上传数据文件后使用文件分析功能。"
    try:
        adapter = get_adapter(engine)
        schemas = adapter.list_schemas()
        if not schemas:
            return "当前数据库未发现任何用户 Schema。"
        result = f"数据库类型: {adapter.db_type}\n可用 Schema ({len(schemas)} 个):\n"
        for s in schemas:
            result += f"  - {s}\n"
        return result
    except Exception as e:
        return f"获取 Schema 列表失败: {e}"


@function_tool
def list_tables(schema_name: str = "", database_url: str = "") -> str:
    """列出数据库中的表和视图。可指定 schema_name 聚焦特定范围。"""
    try:
        engine = get_engine(database_url or None)
    except ValueError:
        return "未配置数据库连接。请在设置中配置数据库连接。"
    try:
        adapter = get_adapter(engine)
        tables = adapter.list_tables(schema=schema_name or None)
        if not tables:
            scope = f" Schema '{schema_name}' 中" if schema_name else ""
            return f"在{scope}未发现任何表或视图。"
        grouped: dict[str, list] = {}
        for t in tables:
            grouped.setdefault(t["schema"], []).append(t)
        result = f"数据库类型: {adapter.db_type}\n共发现 {len(tables)} 个表/视图:\n\n"
        for s, items in grouped.items():
            result += f"Schema: {s}\n"
            for item in items:
                icon = "[TABLE]" if item["type"] == "TABLE" else "[VIEW]"
                result += f"  {icon} {item['table']}\n"
            result += "\n"
        return result
    except Exception as e:
        return f"获取表列表失败: {e}"


@function_tool
def describe_table(table_name: str, schema_name: str = "", database_url: str = "") -> str:
    """获取指定数据表的结构信息（列名、类型、主键、索引）并随机采样 3 条真实数据。
    支持 "schema.table" 格式。"""
    try:
        engine = get_engine(database_url or None)
    except ValueError:
        return "未配置数据库连接。请在设置中配置数据库连接。"
    try:
        adapter = get_adapter(engine)
        if "." in table_name and not schema_name:
            parts = table_name.split(".", 1)
            schema_name, table_name = parts[0], parts[1]
        if not adapter.has_table(table_name, schema=schema_name or None):
            return f"错误: 表 '{schema_name}.{table_name}' 不存在。请先使用 list_tables 查看可用的表。"
        info = adapter.describe_table(table_name, schema=schema_name or None)
        schema_label = f"{info['schema']}." if info['schema'] else ""
        output = [f"表: {schema_label}{info['table']}"]
        output.append(f"\n列信息 ({len(info['columns'])} 列):")
        for col in info["columns"]:
            nullable = "NULL" if col["nullable"] else "NOT NULL"
            default = f" DEFAULT={col['default']}" if col['default'] else ""
            output.append(f"  - {col['name']} ({col['type']}) {nullable}{default}")
        if info["primary_key"]:
            output.append(f"\n主键: {', '.join(info['primary_key'])}")
        if info["indexes"]:
            output.append(f"\n索引 ({len(info['indexes'])} 个):")
            for idx in info["indexes"]:
                unique_tag = " [UNIQUE]" if idx["unique"] else ""
                output.append(f"  - {idx['name']}: ({', '.join(idx['columns'])}){unique_tag}")
        try:
            df_sample = adapter.get_sample_data(table_name, schema=schema_name or None, limit=3)
            if not df_sample.empty:
                output.append(f"\n示例数据 ({len(df_sample)} 行):")
                output.append(df_sample.to_string(index=False))
            else:
                output.append("\n示例数据: 表为空。")
        except Exception as e:
            output.append(f"\n警告: 无法获取采样数据 ({e})")
        return "\n".join(output)
    except Exception as e:
        return f"获取表结构失败: {e}"


@function_tool
def run_sql_query(query: str, database_url: str = "") -> str:
    """执行 SELECT SQL 查询并返回最多前 100 条结果。仅允许 SELECT 查询。"""
    dangerous = ["DROP ", "DELETE ", "UPDATE ", "INSERT ", "ALTER ", "TRUNCATE ", "CREATE ", "GRANT "]
    query_upper = query.upper()
    for kw in dangerous:
        if kw in query_upper:
            return f"错误: 禁止执行含有 {kw.strip()} 的语句。仅允许 SELECT 查询。"
    try:
        df = run_query_to_dataframe(query, database_url or None)
        if df.empty:
            return "查询执行成功，但未返回任何数据。"
        header = f"查询结果 ({len(df)} 行 x {len(df.columns)} 列)"
        if len(df) > 100:
            header += " [显示前 100 行]"
            return f"{header}:\n" + df.head(100).to_string(index=False)
        return f"{header}:\n" + df.to_string(index=False)
    except Exception as e:
        return f"SQL 执行错误: {e}\n请检查 SQL 语法，若列名不确定请先使用 describe_table 确认。"
