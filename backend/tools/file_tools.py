"""文件数据查询工具：通过 DuckDB 内存引擎查询已上传的文件数据"""
import logging
from agents import function_tool
from core.file_loader import query_file, list_file_tables
from core.sql_safety import is_select_only

logger = logging.getLogger(__name__)


@function_tool
def list_uploaded_files() -> str:
    """列出所有已上传并注册的数据文件及其表名、行数、列数。"""
    tables = list_file_tables()
    if not tables:
        return "当前没有已上传的数据文件。请先上传 CSV/Excel/JSON/Parquet 文件。"
    result = f"已注册 {len(tables)} 个文件表:\n\n"
    for t in tables:
        result += f"  - {t['table_name']} (来源: {t['source_file']}, {t['rows']} 行 x {t['columns']} 列)\n"
    result += "\n可直接用 SQL 查询这些表，例如: SELECT * FROM 表名 LIMIT 10"
    return result


@function_tool
def query_uploaded_file(sql: str) -> str:
    """对已上传的数据文件执行 SQL 查询。表名即为文件注册名（通过 list_uploaded_files 查看）。
    支持标准 SQL 语法（DuckDB 方言），可 JOIN 多个文件表。"""
    ok, err = is_select_only(sql)
    if not ok:
        return f"错误: {err}。仅允许 SELECT 查询。"
    try:
        df = query_file(sql)
        if df.empty:
            return "查询执行成功，但未返回任何数据。"
        header = f"查询结果 ({len(df)} 行 x {len(df.columns)} 列)"
        if len(df) > 100:
            header += " [显示前 100 行]"
            return f"{header}:\n" + df.head(100).to_string(index=False)
        return f"{header}:\n" + df.to_string(index=False)
    except Exception as e:
        logger.warning("File query error: %s", e)
        return "查询失败，请检查 SQL 语法。"
