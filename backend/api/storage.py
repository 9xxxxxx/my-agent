"""对话记录 & 连接配置持久化 API"""
import time
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from core.database import get_app_session
from core.models import ConversationRow, LLMProfileRow, DBProfileRow

router = APIRouter()


# ── Schemas ──

class ConversationCreate(BaseModel):
    id: str
    title: str = "新对话"
    messages: list = []
    created_at: float
    updated_at: float


class ConversationUpdate(BaseModel):
    title: str | None = None
    messages: list | None = None
    updated_at: float | None = None


class ProfileCreate(BaseModel):
    id: str
    name: str
    config: dict
    is_active: bool = False
    created_at: float


class ProfileUpdate(BaseModel):
    name: str | None = None
    config: dict | None = None


def redact_config(config: dict) -> dict:
    redacted = dict(config or {})
    if redacted.get("apiKey"):
        redacted["apiKey"] = ""
        redacted["hasApiKey"] = True
    if redacted.get("password"):
        redacted["password"] = ""
        redacted["hasPassword"] = True
    return redacted


# ── Conversations ──

@router.get("/api/conversations")
def list_conversations():
    with get_app_session() as session:
        rows = session.query(ConversationRow).order_by(ConversationRow.updated_at.desc()).all()
        return [
            {
                "id": r.id,
                "title": r.title,
                "created_at": r.created_at,
                "updated_at": r.updated_at,
                "message_count": len(r.messages) if r.messages else 0,
            }
            for r in rows
        ]


@router.get("/api/conversations/{conv_id}")
def get_conversation(conv_id: str):
    with get_app_session() as session:
        row = session.get(ConversationRow, conv_id)
        if not row:
            raise HTTPException(404, "对话不存在")
        return {
            "id": row.id,
            "title": row.title,
            "messages": row.messages,
            "created_at": row.created_at,
            "updated_at": row.updated_at,
        }


@router.post("/api/conversations", status_code=201)
def create_conversation(body: ConversationCreate):
    with get_app_session() as session:
        row = ConversationRow(
            id=body.id,
            title=body.title,
            messages=body.messages,
            created_at=body.created_at,
            updated_at=body.updated_at,
        )
        session.add(row)
        session.commit()
        return {"id": row.id}


@router.put("/api/conversations/{conv_id}")
def update_conversation(conv_id: str, body: ConversationUpdate):
    with get_app_session() as session:
        row = session.get(ConversationRow, conv_id)
        if not row:
            raise HTTPException(404, "对话不存在")
        if body.title is not None:
            row.title = body.title
        if body.messages is not None:
            row.messages = body.messages
        if body.updated_at is not None:
            row.updated_at = body.updated_at
        session.commit()
        return {"ok": True}


@router.delete("/api/conversations/{conv_id}")
def delete_conversation(conv_id: str):
    with get_app_session() as session:
        row = session.get(ConversationRow, conv_id)
        if not row:
            raise HTTPException(404, "对话不存在")
        session.delete(row)
        session.commit()
        return {"ok": True}


# ── LLM Profiles ──

@router.get("/api/connections/llm")
def list_llm_profiles():
    with get_app_session() as session:
        rows = session.query(LLMProfileRow).order_by(LLMProfileRow.created_at).all()
        return [
            {"id": r.id, "name": r.name, "config": redact_config(r.config), "is_active": r.is_active, "created_at": r.created_at}
            for r in rows
        ]


@router.post("/api/connections/llm", status_code=201)
def create_llm_profile(body: ProfileCreate):
    with get_app_session() as session:
        if body.is_active:
            session.query(LLMProfileRow).update({"is_active": False})
        row = LLMProfileRow(id=body.id, name=body.name, config=body.config, is_active=body.is_active, created_at=body.created_at)
        session.add(row)
        session.commit()
        return {"id": row.id}


@router.put("/api/connections/llm/{profile_id}")
def update_llm_profile(profile_id: str, body: ProfileUpdate):
    with get_app_session() as session:
        row = session.get(LLMProfileRow, profile_id)
        if not row:
            raise HTTPException(404, "LLM 配置不存在")
        if body.name is not None:
            row.name = body.name
        if body.config is not None:
            row.config = body.config
        session.commit()
        return {"ok": True}


@router.delete("/api/connections/llm/{profile_id}")
def delete_llm_profile(profile_id: str):
    with get_app_session() as session:
        row = session.get(LLMProfileRow, profile_id)
        if not row:
            raise HTTPException(404, "LLM 配置不存在")
        session.delete(row)
        session.commit()
        return {"ok": True}


@router.put("/api/connections/llm/{profile_id}/activate")
def activate_llm_profile(profile_id: str):
    with get_app_session() as session:
        target = session.get(LLMProfileRow, profile_id)
        if not target:
            raise HTTPException(404, "LLM 配置不存在")
        session.query(LLMProfileRow).update({"is_active": False})
        target.is_active = True
        session.commit()
        return {"ok": True}


# ── DB Profiles ──

@router.get("/api/connections/db")
def list_db_profiles():
    with get_app_session() as session:
        rows = session.query(DBProfileRow).order_by(DBProfileRow.created_at).all()
        return [
            {"id": r.id, "name": r.name, "config": redact_config(r.config), "is_active": r.is_active, "created_at": r.created_at}
            for r in rows
        ]


@router.post("/api/connections/db", status_code=201)
def create_db_profile(body: ProfileCreate):
    with get_app_session() as session:
        if body.is_active:
            session.query(DBProfileRow).update({"is_active": False})
        row = DBProfileRow(id=body.id, name=body.name, config=body.config, is_active=body.is_active, created_at=body.created_at)
        session.add(row)
        session.commit()
        return {"id": row.id}


@router.put("/api/connections/db/{profile_id}")
def update_db_profile(profile_id: str, body: ProfileUpdate):
    with get_app_session() as session:
        row = session.get(DBProfileRow, profile_id)
        if not row:
            raise HTTPException(404, "DB 配置不存在")
        if body.name is not None:
            row.name = body.name
        if body.config is not None:
            row.config = body.config
        session.commit()
        return {"ok": True}


@router.delete("/api/connections/db/{profile_id}")
def delete_db_profile(profile_id: str):
    with get_app_session() as session:
        row = session.get(DBProfileRow, profile_id)
        if not row:
            raise HTTPException(404, "DB 配置不存在")
        session.delete(row)
        session.commit()
        return {"ok": True}


@router.put("/api/connections/db/{profile_id}/activate")
def activate_db_profile(profile_id: str):
    with get_app_session() as session:
        target = session.get(DBProfileRow, profile_id)
        if not target:
            raise HTTPException(404, "DB 配置不存在")
        session.query(DBProfileRow).update({"is_active": False})
        target.is_active = True
        session.commit()
        return {"ok": True}
