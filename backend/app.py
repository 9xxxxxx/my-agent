"""FastAPI 入口：CORS + 路由挂载"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from api.chat import router as chat_router
from api.upload import router as upload_router
from api.export import router as export_router

load_dotenv(override=True)

app = FastAPI(title="Data Analyst Agent", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(chat_router)
app.include_router(upload_router)
app.include_router(export_router)


@app.get("/api/health")
async def health():
    return {"status": "ok"}
