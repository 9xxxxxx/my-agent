"""对话记录 & 连接配置持久化 API"""
import logging
import time
from functools import wraps
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sqlalchemy.exc import SQLAlchemyError
from core.database import get_app_session
from core.models import ConversationRow, LLMProfileRow, DBProfileRow

logger = logging.getLogger(__name__)
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
        try:
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
        except SQLAlchemyError as e:
            logger.error("Failed to create conversation: %s", e)
            session.rollback()
            raise HTTPException(500, "创建对话失败") from e


@router.put("/api/conversations/{conv_id}")
def update_conversation(conv_id: str, body: ConversationUpdate):
    try:
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
    except HTTPException:
        raise
    except SQLAlchemyError as e:
        logger.error("Failed to update conversation %s: %s", conv_id, e)
        session.rollback()
        raise HTTPException(500, "更新对话失败") from e


@router.delete("/api/conversations/{conv_id}")
def delete_conversation(conv_id: str):
    try:
        with get_app_session() as session:
            row = session.get(ConversationRow, conv_id)
            if not row:
                raise HTTPException(404, "对话不存在")
            session.delete(row)
            session.commit()
            return {"ok": True}
    except HTTPException:
        raise
    except SQLAlchemyError as e:
        logger.error("Failed to delete conversation %s: %s", conv_id, e)
        session.rollback()
        raise HTTPException(500, "删除对话失败") from e


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
        try:
            if body.is_active:
                session.query(LLMProfileRow).update({"is_active": False})
            row = LLMProfileRow(id=body.id, name=body.name, config=body.config, is_active=body.is_active, created_at=body.created_at)
            session.add(row)
            session.commit()
            return {"id": row.id}
        except SQLAlchemyError as e:
            logger.error("Failed to create LLM profile: %s", e)
            session.rollback()
            raise HTTPException(500, "创建 LLM 配置失败") from e


@router.put("/api/connections/llm/{profile_id}")
def update_llm_profile(profile_id: str, body: ProfileUpdate):
    try:
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
    except HTTPException:
        raise
    except SQLAlchemyError as e:
        logger.error("Failed to update LLM profile %s: %s", profile_id, e)
        session.rollback()
        raise HTTPException(500, "更新 LLM 配置失败") from e


@router.delete("/api/connections/llm/{profile_id}")
def delete_llm_profile(profile_id: str):
    try:
        with get_app_session() as session:
            row = session.get(LLMProfileRow, profile_id)
            if not row:
                raise HTTPException(404, "LLM 配置不存在")
            session.delete(row)
            session.commit()
            return {"ok": True}
    except HTTPException:
        raise
    except SQLAlchemyError as e:
        logger.error("Failed to delete LLM profile %s: %s", profile_id, e)
        session.rollback()
        raise HTTPException(500, "删除 LLM 配置失败") from e


@router.put("/api/connections/llm/{profile_id}/activate")
def activate_llm_profile(profile_id: str):
    try:
        with get_app_session() as session:
            target = session.get(LLMProfileRow, profile_id)
            if not target:
                raise HTTPException(404, "LLM 配置不存在")
            session.query(LLMProfileRow).update({"is_active": False})
            target.is_active = True
            session.commit()
            return {"ok": True}
    except HTTPException:
        raise
    except SQLAlchemyError as e:
        logger.error("Failed to activate LLM profile: %s", e)
        session.rollback()
        raise HTTPException(500, "激活失败") from e


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
        try:
            if body.is_active:
                session.query(DBProfileRow).update({"is_active": False})
            row = DBProfileRow(id=body.id, name=body.name, config=body.config, is_active=body.is_active, created_at=body.created_at)
            session.add(row)
            session.commit()
            return {"id": row.id}
        except SQLAlchemyError as e:
            logger.error("Failed to create DB profile: %s", e)
            session.rollback()
            raise HTTPException(500, "创建数据库配置失败") from e


@router.put("/api/connections/db/{profile_id}")
def update_db_profile(profile_id: str, body: ProfileUpdate):
    try:
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
    except HTTPException:
        raise
    except SQLAlchemyError as e:
        logger.error("Failed to update DB profile %s: %s", profile_id, e)
        session.rollback()
        raise HTTPException(500, "更新数据库配置失败") from e


@router.delete("/api/connections/db/{profile_id}")
def delete_db_profile(profile_id: str):
    try:
        with get_app_session() as session:
            row = session.get(DBProfileRow, profile_id)
            if not row:
                raise HTTPException(404, "DB 配置不存在")
            session.delete(row)
            session.commit()
            return {"ok": True}
    except HTTPException:
        raise
    except SQLAlchemyError as e:
        logger.error("Failed to delete DB profile %s: %s", profile_id, e)
        session.rollback()
        raise HTTPException(500, "删除数据库配置失败") from e


@router.put("/api/connections/db/{profile_id}/activate")
def activate_db_profile(profile_id: str):
    try:
        with get_app_session() as session:
            target = session.get(DBProfileRow, profile_id)
            if not target:
                raise HTTPException(404, "DB 配置不存在")
            session.query(DBProfileRow).update({"is_active": False})
            target.is_active = True
            session.commit()
            return {"ok": True}
    except HTTPException:
        raise
    except SQLAlchemyError as e:
        logger.error("Failed to activate DB profile: %s", e)
        session.rollback()
        raise HTTPException(500, "激活失败") from e
