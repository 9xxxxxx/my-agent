"""报告生成工具：Markdown 报告撰写与导出"""
import re
from agents import function_tool
from pathlib import Path
from datetime import datetime


@function_tool
def generate_report(title: str, content: str, format: str = "markdown") -> str:
    """将分析内容生成为报告文件。
    format: "markdown" 生成 .md 文件。
    content 应包含完整的分析报告内容（Markdown 格式），含核心摘要、多维剖析、业务建议等。"""
    if format not in ("markdown",):
        return f"错误: 不支持的格式 '{format}'，目前仅支持 markdown。"

    reports_dir = Path("reports")
    reports_dir.mkdir(exist_ok=True)

    # Sanitize title: only allow alphanumeric, Chinese, hyphens, underscores
    safe_title = re.sub(r"[^a-zA-Z0-9_\-一-鿿]", "_", title).strip("_")[:100]
    if not safe_title:
        safe_title = "report"

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"{safe_title}_{timestamp}.md"
    filepath = (reports_dir / filename).resolve()

    # Verify path is inside reports directory
    if not filepath.is_relative_to(reports_dir.resolve()):
        return "错误: 非法的报告标题。"

    report_content = f"# {title}\n\n"
    report_content += f"*生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}*\n\n"
    report_content += "---\n\n"
    report_content += content

    filepath.write_text(report_content, encoding="utf-8")
    return f"报告已成功导出: {filepath}\n文件大小: {filepath.stat().st_size} 字节"
