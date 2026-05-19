"""报告/数据导出端点"""
import os
import tempfile
from pathlib import Path
from pydantic import BaseModel
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from core.path_safety import safe_child_path
from core.pdf_generator import PDFGenerator
from core.report_service import ReportService
from core.data_exporter import DataExporter
from core.database import run_query_to_dataframe
from core.sql_safety import is_select_only

_REPORTS_DIR = Path(os.path.join(os.path.dirname(os.path.dirname(__file__)), "reports"))

router = APIRouter()

pdf_generator = PDFGenerator()
report_service = ReportService()
data_exporter = DataExporter()


class ExportQueryRequest(BaseModel):
    sql: str
    database: str = ""


@router.get("/api/export/report/{filename}")
async def export_report(filename: str):
    """下载已生成的报告文件"""
    try:
        filepath = safe_child_path(_REPORTS_DIR, filename)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if not filepath.exists():
        raise HTTPException(status_code=404, detail=f"报告文件不存在: {filename}")
    return FileResponse(filepath, filename=filename, media_type="text/markdown")


@router.get("/api/reports/{report_id}/export/pdf")
async def export_report_pdf(report_id: str):
    """导出报告为 PDF"""
    report = report_service.get_report(report_id)
    if not report:
        raise HTTPException(status_code=404, detail="报告不存在")

    # 读取完整内容
    file_path = Path(report.file_path)
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="报告文件不存在")

    content = file_path.read_text(encoding="utf-8")

    # 生成 PDF
    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
        tmp_path = Path(tmp.name)

    try:
        pdf_generator.generate_pdf(content, tmp_path, title=report.title)
        return FileResponse(
            tmp_path,
            filename=f"{report.title}.pdf",
            media_type="application/pdf",
        )
    except Exception as e:
        if tmp_path.exists():
            tmp_path.unlink()
        raise HTTPException(status_code=500, detail=f"PDF 生成失败: {str(e)}")


@router.post("/api/export/query/excel")
async def export_query_excel(request: ExportQueryRequest):
    """将查询结果导出为 Excel"""
    ok, err = is_select_only(request.sql)
    if not ok:
        raise HTTPException(status_code=400, detail=f"仅允许 SELECT 查询: {err}")
    try:
        df = run_query_to_dataframe(request.sql, request.database or None)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"查询失败: {str(e)}")

    with tempfile.NamedTemporaryFile(suffix=".xlsx", delete=False) as tmp:
        tmp_path = Path(tmp.name)

    try:
        data_exporter.export_excel(df, tmp_path, title="查询结果")
        return FileResponse(
            tmp_path,
            filename="query_result.xlsx",
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
    except Exception as e:
        if tmp_path.exists():
            tmp_path.unlink()
        raise HTTPException(status_code=500, detail=f"Excel 导出失败: {str(e)}")


@router.post("/api/export/query/csv")
async def export_query_csv(request: ExportQueryRequest):
    """将查询结果导出为 CSV"""
    ok, err = is_select_only(request.sql)
    if not ok:
        raise HTTPException(status_code=400, detail=f"仅允许 SELECT 查询: {err}")
    try:
        df = run_query_to_dataframe(request.sql, request.database or None)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"查询失败: {str(e)}")

    with tempfile.NamedTemporaryFile(suffix=".csv", delete=False) as tmp:
        tmp_path = Path(tmp.name)

    try:
        data_exporter.export_csv(df, tmp_path)
        return FileResponse(
            tmp_path,
            filename="query_result.csv",
            media_type="text/csv",
        )
    except Exception as e:
        if tmp_path.exists():
            tmp_path.unlink()
        raise HTTPException(status_code=500, detail=f"CSV 导出失败: {str(e)}")
