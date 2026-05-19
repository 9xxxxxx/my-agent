"""报告服务层测试"""
import pytest
import os
import tempfile
from pathlib import Path
from datetime import datetime
from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session
from core.models import Base
from core.report_service import ReportService


@pytest.fixture
def temp_reports_dir():
    """创建临时报告目录"""
    with tempfile.TemporaryDirectory() as tmpdir:
        yield Path(tmpdir)


@pytest.fixture
def test_engine():
    """创建内存数据库引擎"""
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})

    @event.listens_for(engine, "connect")
    def _set_sqlite_pragma(dbapi_conn, connection_record):
        cursor = dbapi_conn.cursor()
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA busy_timeout=5000")
        cursor.close()

    Base.metadata.create_all(engine)
    return engine


@pytest.fixture
def service(temp_reports_dir, monkeypatch, test_engine):
    """创建报告服务实例（使用内存数据库）"""
    monkeypatch.setattr("core.report_service.REPORTS_DIR", temp_reports_dir)

    def _get_test_session():
        return Session(test_engine)

    monkeypatch.setattr("core.report_service.get_app_session", _get_test_session)
    return ReportService()


def test_create_report(service, temp_reports_dir):
    """测试创建报告"""
    report = service.create_report(
        title="测试报告",
        content="# 测试内容\n\n这是测试。",
        tags=["测试"],
    )
    assert report.title == "测试报告"
    assert report.filename.endswith(".md")
    assert (temp_reports_dir / report.filename).exists()


def test_get_report(service):
    """测试获取报告"""
    created = service.create_report(title="测试", content="内容")
    fetched = service.get_report(created.id)
    assert fetched is not None
    assert fetched.id == created.id
    assert fetched.title == "测试"


def test_list_reports(service):
    """测试列表报告"""
    service.create_report(title="报告1", content="内容1")
    service.create_report(title="报告2", content="内容2")
    reports = service.list_reports()
    assert len(reports) == 2


def test_update_report(service):
    """测试更新报告"""
    report = service.create_report(title="原标题", content="原内容")
    updated = service.update_report(
        report.id,
        title="新标题",
        content="新内容",
    )
    assert updated.title == "新标题"
    # 验证文件内容已更新
    fetched = service.get_report(report.id)
    assert fetched.content == "新内容"


def test_delete_report(service, temp_reports_dir):
    """测试删除报告"""
    report = service.create_report(title="待删除", content="内容")
    filename = report.filename
    service.delete_report(report.id)
    assert not (temp_reports_dir / filename).exists()
    assert service.get_report(report.id) is None


def test_search_reports(service):
    """测试搜索报告"""
    service.create_report(title="数据分析报告", content="内容1")
    service.create_report(title="销售报告", content="内容2")
    results = service.list_reports(search="数据")
    assert len(results) == 1
    assert results[0].title == "数据分析报告"
