"""PDF 生成器"""
from pathlib import Path
import markdown2
from xhtml2pdf import pisa


class PDFGenerator:
    """Markdown 转 PDF 生成器"""

    CSS_TEMPLATE = """
    @page {
        size: A4;
        margin: 2cm;
    }

    body {
        font-family: Arial, Helvetica, sans-serif;
        font-size: 12pt;
        line-height: 1.8;
        color: #333;
    }

    h1 {
        font-size: 24pt;
        color: #1a1a1a;
        border-bottom: 2px solid #333;
        padding-bottom: 10px;
        margin-bottom: 30px;
    }

    h2 {
        font-size: 18pt;
        color: #2c3e50;
        margin-top: 30px;
        margin-bottom: 15px;
    }

    h3 {
        font-size: 14pt;
        color: #34495e;
        margin-top: 20px;
        margin-bottom: 10px;
    }

    p {
        margin-bottom: 15px;
        text-align: justify;
    }

    ul, ol {
        margin-bottom: 15px;
        padding-left: 30px;
    }

    li {
        margin-bottom: 5px;
    }

    table {
        width: 100%;
        border-collapse: collapse;
        margin: 20px 0;
        font-size: 10pt;
    }

    th, td {
        border: 1px solid #ddd;
        padding: 8px 12px;
        text-align: left;
    }

    th {
        background-color: #f5f5f5;
        font-weight: bold;
        color: #2c3e50;
    }

    tr:nth-child(even) {
        background-color: #fafafa;
    }

    code {
        background-color: #f4f4f4;
        padding: 2px 6px;
        border-radius: 4px;
        font-family: "Consolas", "Monaco", monospace;
        font-size: 10pt;
    }

    pre {
        background-color: #f8f8f8;
        padding: 15px;
        border-radius: 4px;
        overflow-x: auto;
        margin: 20px 0;
        border: 1px solid #e0e0e0;
    }

    pre code {
        background-color: transparent;
        padding: 0;
    }

    blockquote {
        border-left: 4px solid #3498db;
        padding-left: 15px;
        margin: 20px 0;
        color: #555;
        font-style: italic;
    }

    img {
        max-width: 100%;
        height: auto;
        margin: 20px 0;
    }

    hr {
        border: none;
        border-top: 1px solid #ddd;
        margin: 30px 0;
    }

    .timestamp {
        font-size: 10pt;
        color: #888;
        text-align: center;
        margin-bottom: 30px;
    }
    """

    def markdown_to_html(self, markdown_content: str) -> str:
        """将 Markdown 转换为 HTML"""
        html_content = markdown2.markdown(
            markdown_content,
            extras=[
                "tables",
                "fenced-code-blocks",
                "code-friendly",
                "cuddled-lists",
                "header-ids",
                "break-on-newline",
            ],
        )
        return html_content

    def generate_pdf(
        self,
        markdown_content: str,
        output_path: Path,
        title: str = "",
    ) -> Path:
        """生成 PDF 文件"""
        html_content = self.markdown_to_html(markdown_content)

        # 构建完整 HTML
        full_html = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <style>{self.CSS_TEMPLATE}</style>
        </head>
        <body>
            {html_content}
        </body>
        </html>
        """

        # 使用 xhtml2pdf 生成 PDF
        with open(str(output_path), "w+b") as output_file:
            pisa_status = pisa.CreatePDF(
                src=full_html,
                dest=output_file,
                encoding="utf-8",
            )
            if pisa_status.err:
                raise RuntimeError(
                    f"PDF 生成失败: xhtml2pdf 错误代码 {pisa_status.err}"
                )

        return output_path
