"""文件上传端点"""
import shutil
from pathlib import Path
from fastapi import APIRouter, UploadFile, File, HTTPException
from core.file_loader import load_file, list_file_tables, MAX_FILE_SIZE
from core.path_safety import safe_child_path

router = APIRouter()

UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)


@router.post("/api/upload")
async def upload_file(file: UploadFile = File(...)):
    """上传数据文件（CSV/Excel/JSON/Parquet），自动注册为可查询的虚拟表"""
    allowed = {".csv", ".xlsx", ".xls", ".json", ".parquet"}
    suffix = Path(file.filename or "").suffix.lower()
    if suffix not in allowed:
        raise HTTPException(status_code=400, detail=f"不支持的文件格式: {suffix}。支持: {', '.join(allowed)}")

    try:
        dest = safe_child_path(UPLOAD_DIR, file.filename or "")
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    # Check file size by reading in chunks
    total_size = 0
    with open(dest, "wb") as f:
        while chunk := await file.read(8192):
            total_size += len(chunk)
            if total_size > MAX_FILE_SIZE:
                f.close()
                dest.unlink(missing_ok=True)
                raise HTTPException(
                    status_code=413,
                    detail=f"文件过大，最大允许 {MAX_FILE_SIZE // 1024 // 1024}MB",
                )
            f.write(chunk)

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
        raise HTTPException(status_code=500, detail=f"文件加载失败: {e}") from e


@router.get("/api/upload/tables")
async def get_uploaded_tables():
    """列出所有已上传的文件表"""
    return {"tables": list_file_tables()}
