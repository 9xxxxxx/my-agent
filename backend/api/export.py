"""报告/数据导出端点"""
from pathlib import Path
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from core.path_safety import safe_child_path

router = APIRouter()


@router.get("/api/export/report/{filename}")
async def export_report(filename: str):
    """下载已生成的报告文件"""
    try:
        filepath = safe_child_path(Path("reports"), filename)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if not filepath.exists():
        raise HTTPException(status_code=404, detail=f"报告文件不存在: {filename}")
    return FileResponse(filepath, filename=filename, media_type="text/markdown")
