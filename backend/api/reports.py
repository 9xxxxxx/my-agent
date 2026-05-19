"""报告管理 API 端点"""
from typing import Optional
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from core.report_service import ReportService

router = APIRouter()
service = ReportService()


class CreateReportRequest(BaseModel):
    title: str
    content: str
    tags: Optional[list[str]] = None


class UpdateReportRequest(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    tags: Optional[list[str]] = None


class ReportResponse(BaseModel):
    id: str
    title: str
    filename: str
    summary: str
    tags: list[str]
    created_at: float
    updated_at: float


class ReportDetailResponse(ReportResponse):
    content: str


class ReportListResponse(BaseModel):
    items: list[ReportResponse]
    total: int
    page: int
    page_size: int


@router.post("/api/reports", response_model=ReportResponse)
async def create_report(request: CreateReportRequest):
    """创建新报告"""
    report = service.create_report(
        title=request.title,
        content=request.content,
        tags=request.tags,
    )
    return ReportResponse(
        id=report.id,
        title=report.title,
        filename=report.filename,
        summary=report.summary,
        tags=report.tags,
        created_at=report.created_at,
        updated_at=report.updated_at,
    )


@router.get("/api/reports", response_model=ReportListResponse)
async def list_reports(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    tags: Optional[str] = None,
):
    """获取报告列表"""
    tag_list = tags.split(",") if tags else None
    reports = service.list_reports(
        page=page,
        page_size=page_size,
        search=search,
        tags=tag_list,
    )
    total = service.count_reports(search=search, tags=tag_list)

    return ReportListResponse(
        items=[
            ReportResponse(
                id=r.id,
                title=r.title,
                filename=r.filename,
                summary=r.summary,
                tags=r.tags,
                created_at=r.created_at,
                updated_at=r.updated_at,
            )
            for r in reports
        ],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/api/reports/{report_id}", response_model=ReportDetailResponse)
async def get_report(report_id: str):
    """获取报告详情"""
    report = service.get_report(report_id)
    if not report:
        raise HTTPException(status_code=404, detail="报告不存在")

    return ReportDetailResponse(
        id=report.id,
        title=report.title,
        filename=report.filename,
        summary=report.summary,
        tags=report.tags,
        content=report.content,
        created_at=report.created_at,
        updated_at=report.updated_at,
    )


@router.put("/api/reports/{report_id}", response_model=ReportResponse)
async def update_report(report_id: str, request: UpdateReportRequest):
    """更新报告"""
    report = service.update_report(
        report_id=report_id,
        title=request.title,
        content=request.content,
        tags=request.tags,
    )
    if not report:
        raise HTTPException(status_code=404, detail="报告不存在")

    return ReportResponse(
        id=report.id,
        title=report.title,
        filename=report.filename,
        summary=report.summary,
        tags=report.tags,
        created_at=report.created_at,
        updated_at=report.updated_at,
    )


@router.delete("/api/reports/{report_id}")
async def delete_report(report_id: str):
    """删除报告"""
    success = service.delete_report(report_id)
    if not success:
        raise HTTPException(status_code=404, detail="报告不存在")

    return {"message": "报告已删除"}
