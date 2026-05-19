"""数据导出测试"""
import pytest
import pandas as pd
from pathlib import Path
from core.data_exporter import DataExporter


@pytest.fixture
def exporter():
    return DataExporter()


@pytest.fixture
def sample_dataframe():
    """示例数据"""
    return pd.DataFrame({
        "姓名": ["张三", "李四", "王五"],
        "年龄": [25, 30, 35],
        "城市": ["北京", "上海", "广州"],
    })


def test_export_excel(exporter, sample_dataframe, tmp_path):
    """测试 Excel 导出"""
    output_path = tmp_path / "test.xlsx"
    result = exporter.export_excel(sample_dataframe, output_path)
    assert result.exists()
    assert result.stat().st_size > 0

    # 验证内容
    df = pd.read_excel(result)
    assert len(df) == 3
    assert list(df.columns) == ["姓名", "年龄", "城市"]


def test_export_csv(exporter, sample_dataframe, tmp_path):
    """测试 CSV 导出"""
    output_path = tmp_path / "test.csv"
    result = exporter.export_csv(sample_dataframe, output_path)
    assert result.exists()
    assert result.stat().st_size > 0

    # 验证内容
    df = pd.read_csv(result, encoding="utf-8-sig")
    assert len(df) == 3


def test_export_excel_with_formatting(exporter, sample_dataframe, tmp_path):
    """测试带格式的 Excel 导出"""
    output_path = tmp_path / "formatted.xlsx"
    result = exporter.export_excel(
        sample_dataframe,
        output_path,
        title="测试报告",
    )
    assert result.exists()
