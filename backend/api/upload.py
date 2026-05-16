"""文件上传端点"""
import shutil
from pathlib import Path
from fastapi import APIRouter, UploadFile, File
from core.file_loader import load_file, list_file_tables

router = APIRouter()

UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)


@router.post("/api/upload")
async def upload_file(file: UploadFile = File(...)):
    """上传数据文件（CSV/Excel/JSON/Parquet），自动注册为可查询的虚拟表"""
    allowed = {".csv", ".xlsx", ".xls", ".json", ".parquet"}
    suffix = Path(file.filename or "").suffix.lower()
    if suffix not in allowed:
        return {"error": f"不支持的文件格式: {suffix}。支持: {', '.join(allowed)}"}

    # 保存文件
    dest = UPLOAD_DIR / file.filename
    with open(dest, "wb") as f:
        shutil.copyfileobj(file.file, f)

    # 加载并注册
    try:
        table_name = load_file(dest)
        return {
            "success": True,
            "filename": file.filename,
            "table_name": table_name,
            "message": f"文件 '{file.filename}' 已上传并注册为表 '{table_name}'，可用 SQL 查询。",
        }
    except Exception as e:
        return {"error": f"文件加载失败: {e}"}


@router.get("/api/upload/tables")
async def get_uploaded_tables():
    """列出所有已上传的文件表"""
    return {"tables": list_file_tables()}
