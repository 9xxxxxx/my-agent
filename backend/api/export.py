"""报告/数据导出端点"""
from pathlib import Path
from fastapi import APIRouter
from fastapi.responses import FileResponse

router = APIRouter()


@router.get("/api/export/report/{filename}")
async def export_report(filename: str):
    """下载已生成的报告文件"""
    filepath = Path("reports") / filename
    if not filepath.exists():
        return {"error": f"报告文件不存在: {filename}"}
    return FileResponse(filepath, filename=filename, media_type="text/markdown")
