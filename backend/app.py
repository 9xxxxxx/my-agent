"""FastAPI 入口：CORS + 认证 + 路由挂载"""
import logging
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from dotenv import load_dotenv

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")
from api.chat import router as chat_router
from api.upload import router as upload_router
from api.export import router as export_router
from api.db import router as db_router
from api.storage import router as storage_router
from api.reports import router as reports_router
from core.database import init_app_db
from core.config import settings

load_dotenv(override=True)

app = FastAPI(title="Data Analyst Agent", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def auth_middleware(request: Request, call_next):
    if not settings.APP_TOKEN:
        return await call_next(request)
    if request.method == "OPTIONS" or request.url.path == "/api/health":
        return await call_next(request)
    auth = request.headers.get("authorization", "")
    if auth == f"Bearer {settings.APP_TOKEN}":
        return await call_next(request)
    return JSONResponse(status_code=401, content={"detail": "未授权"})


app.include_router(chat_router)
app.include_router(upload_router)
app.include_router(export_router)
app.include_router(db_router)
app.include_router(storage_router)
app.include_router(reports_router)

# 启动时初始化应用内部 SQLite
init_app_db()


@app.get("/api/health")
async def health():
    return {"status": "ok"}
