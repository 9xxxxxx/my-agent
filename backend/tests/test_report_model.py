"""报告数据模型测试"""
import pytest
from datetime import datetime
from core.models import ReportRow


def test_report_row_creation():
    """测试报告模型创建"""
    report = ReportRow(
        id="test-uuid-123",
        title="测试报告",
        filename="test_report.md",
        file_path="reports/test_report.md",
        content_hash="abc123",
        summary="这是一个测试报告",
        tags=["测试", "示例"],
        created_at=datetime.now().timestamp(),
        updated_at=datetime.now().timestamp(),
    )
    assert report.id == "test-uuid-123"
    assert report.title == "测试报告"
    assert report.tags == ["测试", "示例"]


def test_report_row_defaults():
    """测试默认值"""
    report = ReportRow(
        id="test-uuid-456",
        title="测试报告",
        filename="test.md",
        file_path="reports/test.md",
        content_hash="def456",
        created_at=datetime.now().timestamp(),
        updated_at=datetime.now().timestamp(),
    )
    assert report.summary == ""
    assert report.tags == []
