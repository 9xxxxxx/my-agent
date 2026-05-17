"""数据库连接测试端点"""
from fastapi import APIRouter
from pydantic import BaseModel
from core.database import test_connection

router = APIRouter()


class TestDBRequest(BaseModel):
    database_url: str


class TestDBResponse(BaseModel):
    success: bool
    error: str | None = None


@router.post("/api/db/test", response_model=TestDBResponse)
async def test_db(req: TestDBRequest):
    """测试数据库连接是否可用"""
    try:
        ok, error_msg = test_connection(req.database_url)
        if ok:
            return TestDBResponse(success=True)
        return TestDBResponse(success=False, error=error_msg or "连接失败，请检查连接参数")
    except Exception as e:
        return TestDBResponse(success=False, error=str(e))
