"""报告业务逻辑服务"""
import hashlib
import os
import re
import uuid
from datetime import datetime
from pathlib import Path
from typing import Optional

from core.database import get_app_session
from core.models import ReportRow

_REPORTS_DIR = Path(os.path.join(os.path.dirname(os.path.dirname(__file__)), "reports"))


class ReportService:
    """报告 CRUD 服务"""

    def __init__(self):
        _REPORTS_DIR.mkdir(exist_ok=True)

    def _generate_filename(self, title: str, report_id: str) -> str:
        """生成安全的文件名（包含 UUID 避免碰撞）"""
        safe_title = re.sub(r"[^a-zA-Z0-9_\-一-鿿]", "_", title).strip("_")[:100]
        if not safe_title:
            safe_title = "report"
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        short_id = report_id[:8]
        return f"{safe_title}_{timestamp}_{short_id}.md"

    def _compute_hash(self, content: str) -> str:
        """计算内容哈希"""
        return hashlib.md5(content.encode("utf-8")).hexdigest()

    def _extract_summary(self, content: str, max_length: int = 200) -> str:
        """从内容中提取摘要"""
        # 移除 Markdown 标记
        text = re.sub(r"[#*_`\[\]()]", "", content)
        # 取前 max_length 个字符
        text = text.strip()
        if len(text) > max_length:
            text = text[:max_length] + "..."
        return text

    def create_report(
        self,
        title: str,
        content: str,
        tags: Optional[list[str]] = None,
    ) -> ReportRow:
        """创建新报告"""
        report_id = str(uuid.uuid4())
        filename = self._generate_filename(title, report_id)
        file_path = _REPORTS_DIR / filename

        # 写入文件
        report_content = f"# {title}\n\n"
        report_content += f"*生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}*\n\n"
        report_content += "---\n\n"
        report_content += content
        file_path.write_text(report_content, encoding="utf-8")

        # 创建数据库记录
        now = datetime.now().timestamp()
        report = ReportRow(
            id=report_id,
            title=title,
            filename=filename,
            file_path=str(file_path),
            content_hash=self._compute_hash(content),
            summary=self._extract_summary(content),
            tags=tags or [],
            created_at=now,
            updated_at=now,
        )

        with get_app_session() as session:
            session.add(report)
            session.commit()
            session.refresh(report)

        return report

    def get_report(self, report_id: str) -> Optional[ReportRow]:
        """获取报告详情"""
        with get_app_session() as session:
            report = session.get(ReportRow, report_id)
            if report:
                # 读取文件内容
                file_path = Path(report.file_path)
                if file_path.exists():
                    content = file_path.read_text(encoding="utf-8")
                    # 移除文件头（标题和时间戳）
                    lines = content.split("\n")
                    # 找到 "---" 分隔符后的内容
                    for i, line in enumerate(lines):
                        if line.strip() == "---":
                            report.content = "\n".join(lines[i + 1:]).strip()
                            break
                    else:
                        report.content = content
                else:
                    report.content = ""
            return report

    def list_reports(
        self,
        page: int = 1,
        page_size: int = 20,
        search: Optional[str] = None,
        tags: Optional[list[str]] = None,
    ) -> list[ReportRow]:
        """获取报告列表"""
        with get_app_session() as session:
            query = session.query(ReportRow)

            if search:
                query = query.filter(
                    ReportRow.title.contains(search) |
                    ReportRow.summary.contains(search)
                )

            if tags:
                for tag in tags:
                    query = query.filter(ReportRow.tags.contains(tag))

            query = query.order_by(ReportRow.updated_at.desc())
            query = query.offset((page - 1) * page_size).limit(page_size)

            return query.all()

    def count_reports(
        self,
        search: Optional[str] = None,
        tags: Optional[list[str]] = None,
    ) -> int:
        """统计报告数量"""
        with get_app_session() as session:
            query = session.query(ReportRow)

            if search:
                query = query.filter(
                    ReportRow.title.contains(search) |
                    ReportRow.summary.contains(search)
                )

            if tags:
                for tag in tags:
                    query = query.filter(ReportRow.tags.contains(tag))

            return query.count()

    def update_report(
        self,
        report_id: str,
        title: Optional[str] = None,
        content: Optional[str] = None,
        tags: Optional[list[str]] = None,
    ) -> Optional[ReportRow]:
        """更新报告"""
        with get_app_session() as session:
            report = session.get(ReportRow, report_id)
            if not report:
                return None

            if title is not None:
                report.title = title
            if tags is not None:
                report.tags = tags

            if content is not None or title is not None:
                # 重新生成文件内容
                current_content = content or ""
                if content is None:
                    # 读取现有内容
                    file_path = Path(report.file_path)
                    if file_path.exists():
                        existing = file_path.read_text(encoding="utf-8")
                        lines = existing.split("\n")
                        for i, line in enumerate(lines):
                            if line.strip() == "---":
                                current_content = "\n".join(lines[i + 1:]).strip()
                                break

                new_title = title or report.title
                report_content = f"# {new_title}\n\n"
                report_content += f"*更新时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}*\n\n"
                report_content += "---\n\n"
                report_content += current_content

                file_path = Path(report.file_path)
                file_path.write_text(report_content, encoding="utf-8")

                report.content_hash = self._compute_hash(current_content)
                report.summary = self._extract_summary(current_content)

            report.updated_at = datetime.now().timestamp()
            session.commit()
            session.refresh(report)

            return report

    def delete_report(self, report_id: str) -> bool:
        """删除报告"""
        with get_app_session() as session:
            report = session.get(ReportRow, report_id)
            if not report:
                return False

            # 删除文件
            file_path = Path(report.file_path)
            if file_path.exists():
                file_path.unlink()

            # 删除数据库记录
            session.delete(report)
            session.commit()

            return True
