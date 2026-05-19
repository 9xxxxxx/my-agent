"""报告管理 API 测试"""
import pytest
from fastapi.testclient import TestClient
from app import app

client = TestClient(app)


def test_create_report():
    """测试创建报告"""
    response = client.post("/api/reports", json={
        "title": "测试报告",
        "content": "# 测试\n\n这是测试内容。",
        "tags": ["测试"],
    })
    assert response.status_code == 200
    data = response.json()
    assert data["title"] == "测试报告"
    assert "id" in data


def test_list_reports():
    """测试获取报告列表"""
    # 先创建一个报告
    client.post("/api/reports", json={
        "title": "列表测试",
        "content": "内容",
    })
    response = client.get("/api/reports")
    assert response.status_code == 200
    data = response.json()
    assert "items" in data
    assert "total" in data


def test_get_report():
    """测试获取报告详情"""
    # 先创建
    create_resp = client.post("/api/reports", json={
        "title": "详情测试",
        "content": "# 详情\n\n详细内容。",
    })
    report_id = create_resp.json()["id"]

    response = client.get(f"/api/reports/{report_id}")
    assert response.status_code == 200
    data = response.json()
    assert data["title"] == "详情测试"
    assert "content" in data


def test_update_report():
    """测试更新报告"""
    create_resp = client.post("/api/reports", json={
        "title": "更新测试",
        "content": "原内容",
    })
    report_id = create_resp.json()["id"]

    response = client.put(f"/api/reports/{report_id}", json={
        "title": "新标题",
        "content": "新内容",
    })
    assert response.status_code == 200
    data = response.json()
    assert data["title"] == "新标题"


def test_delete_report():
    """测试删除报告"""
    create_resp = client.post("/api/reports", json={
        "title": "删除测试",
        "content": "内容",
    })
    report_id = create_resp.json()["id"]

    response = client.delete(f"/api/reports/{report_id}")
    assert response.status_code == 200

    # 确认已删除
    get_resp = client.get(f"/api/reports/{report_id}")
    assert get_resp.status_code == 404


def test_get_nonexistent_report():
    """测试获取不存在的报告"""
    response = client.get("/api/reports/nonexistent-id")
    assert response.status_code == 404
