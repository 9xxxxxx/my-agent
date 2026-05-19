"""PDF 导出测试"""
import pytest
from pathlib import Path
from core.pdf_generator import PDFGenerator


@pytest.fixture
def generator():
    return PDFGenerator()


def test_markdown_to_html(generator):
    """测试 Markdown 转 HTML"""
    markdown = "# 测试标题\n\n这是测试内容。"
    html = generator.markdown_to_html(markdown)
    assert "<h1" in html
    assert "测试标题" in html
    assert "测试内容" in html


def test_generate_pdf(generator, tmp_path):
    """测试 PDF 生成"""
    markdown = "# 测试报告\n\n## 第一章\n\n这是测试内容。\n\n- 要点1\n- 要点2"
    output_path = tmp_path / "test.pdf"
    result = generator.generate_pdf(markdown, output_path)
    assert result.exists()
    assert result.stat().st_size > 0


def test_generate_pdf_with_table(generator, tmp_path):
    """测试包含表格的 PDF 生成"""
    markdown = """# 数据报告

| 列1 | 列2 | 列3 |
|-----|-----|-----|
| 数据1 | 数据2 | 数据3 |
| 数据4 | 数据5 | 数据6 |
"""
    output_path = tmp_path / "table_test.pdf"
    result = generator.generate_pdf(markdown, output_path)
    assert result.exists()
