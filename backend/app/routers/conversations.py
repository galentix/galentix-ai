"""
Galentix AI - Conversations Router
Manages conversation history and messages.
"""
import json
import re
from datetime import datetime
from typing import List
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete, func
from sqlalchemy.orm import selectinload

from ..database import get_db
from ..models.conversation import Conversation, Message
from ..models.user import User
from ..models.schemas import (
    ConversationCreate,
    ConversationUpdate,
    ConversationResponse,
    MessageResponse
)
from ..services.auth import get_current_user
from ..rate_limit import limiter

router = APIRouter(prefix="/api/conversations", tags=["conversations"])


@router.get("/", response_model=List[ConversationResponse])
@limiter.limit("60/minute")
async def list_conversations(
    request: Request,
    skip: int = 0,
    limit: int = 50,
    include_archived: bool = False,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List all conversations."""
    # Use subquery count instead of loading all messages
    query = (
        select(
            Conversation,
            func.count(Message.id).label("message_count")
        )
        .outerjoin(Message)
        .where(Conversation.user_id == current_user.id)
        .group_by(Conversation.id)
    )

    if not include_archived:
        query = query.where(Conversation.is_archived == False)

    query = query.order_by(Conversation.updated_at.desc()).offset(skip).limit(limit)

    result = await db.execute(query)
    rows = result.all()

    return [
        ConversationResponse(
            id=c.id,
            title=c.title,
            created_at=c.created_at,
            updated_at=c.updated_at,
            is_archived=c.is_archived,
            message_count=count
        )
        for c, count in rows
    ]


@router.post("/", response_model=ConversationResponse)
@limiter.limit("60/minute")
async def create_conversation(
    request: Request,
    data: ConversationCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new conversation."""
    conversation = Conversation(
        title=data.title or "New Conversation",
        user_id=current_user.id
    )
    db.add(conversation)
    await db.commit()
    await db.refresh(conversation)
    
    return ConversationResponse(
        id=conversation.id,
        title=conversation.title,
        created_at=conversation.created_at,
        updated_at=conversation.updated_at,
        is_archived=conversation.is_archived,
        message_count=0
    )


@router.get("/{conversation_id}", response_model=ConversationResponse)
@limiter.limit("60/minute")
async def get_conversation(
    request: Request,
    conversation_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a specific conversation."""
    result = await db.execute(
        select(Conversation)
        .options(selectinload(Conversation.messages))
        .where(Conversation.id == conversation_id)
        .where(Conversation.user_id == current_user.id)
    )
    conversation = result.scalar_one_or_none()

    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    return ConversationResponse(
        id=conversation.id,
        title=conversation.title,
        created_at=conversation.created_at,
        updated_at=conversation.updated_at,
        is_archived=conversation.is_archived,
        message_count=len(conversation.messages) if conversation.messages else 0
    )


@router.get("/{conversation_id}/export")
@limiter.limit("10/minute")
async def export_conversation(
    conversation_id: str,
    format: str = Query(default="text", pattern="^(text|markdown|json)$"),
    request: Request = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Export a conversation in the specified format."""
    # Load conversation with messages
    result = await db.execute(
        select(Conversation)
        .options(selectinload(Conversation.messages))
        .where(Conversation.id == conversation_id)
        .where(Conversation.user_id == current_user.id)
    )
    conversation = result.scalar_one_or_none()

    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")

    # Sort messages by creation time
    messages = sorted(conversation.messages or [], key=lambda m: m.created_at)

    # Sanitize title for filename
    safe_title = re.sub(r'[^\w\s-]', '', conversation.title).strip()
    safe_title = re.sub(r'[\s]+', '_', safe_title)[:50] or "conversation"

    if format == "text":
        lines = [f"Conversation: {conversation.title}\n"]
        lines.append(f"Date: {conversation.created_at.strftime('%Y-%m-%d %H:%M')}\n")
        lines.append("=" * 50 + "\n\n")

        for msg in messages:
            role_label = "User" if msg.role == "user" else "Assistant"
            lines.append(f"{role_label}: {msg.content}\n\n")

        exported_content = "".join(lines)
        media_type = "text/plain; charset=utf-8"
        filename = f"{safe_title}.txt"

    elif format == "markdown":
        lines = [f"# {conversation.title}\n\n"]
        lines.append(f"**Date:** {conversation.created_at.strftime('%Y-%m-%d %H:%M')}  \n")
        lines.append(f"**Messages:** {len(messages)}\n\n")
        lines.append("---\n\n")

        for msg in messages:
            timestamp = msg.created_at.strftime('%H:%M') if msg.created_at else ""
            if msg.role == "user":
                lines.append(f"### User ({timestamp})\n\n")
            else:
                lines.append(f"### Assistant ({timestamp})\n\n")
            lines.append(f"{msg.content}\n\n")

            # Include source citations for assistant messages
            if msg.role == "assistant" and msg.sources:
                lines.append("**Sources:**\n\n")
                for src in msg.sources:
                    if isinstance(src, dict):
                        if src.get("type") == "web":
                            lines.append(f"- [{src.get('title', 'Web')}]({src.get('url', '')})\n")
                        else:
                            lines.append(f"- {src.get('filename', 'Document')}")
                            if src.get("chunk"):
                                lines.append(f" (chunk {src['chunk']})")
                            lines.append("\n")
                lines.append("\n")

        exported_content = "".join(lines)
        media_type = "text/markdown; charset=utf-8"
        filename = f"{safe_title}.md"

    else:  # json
        export_data = {
            "conversation": {
                "id": conversation.id,
                "title": conversation.title,
                "created_at": conversation.created_at.isoformat() if conversation.created_at else None,
                "updated_at": conversation.updated_at.isoformat() if conversation.updated_at else None,
                "is_archived": conversation.is_archived,
            },
            "messages": [
                {
                    "id": msg.id,
                    "role": msg.role,
                    "content": msg.content,
                    "created_at": msg.created_at.isoformat() if msg.created_at else None,
                    "token_count": msg.token_count,
                    "sources": msg.sources or [],
                    "skills_used": msg.skills_used or [],
                }
                for msg in messages
            ],
            "exported_at": datetime.utcnow().isoformat(),
        }
        exported_content = json.dumps(export_data, indent=2, ensure_ascii=False)
        media_type = "application/json; charset=utf-8"
        filename = f"{safe_title}.json"

    return Response(
        content=exported_content,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )


@router.patch("/{conversation_id}", response_model=ConversationResponse)
@limiter.limit("60/minute")
async def update_conversation(
    request: Request,
    conversation_id: str,
    data: ConversationUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update a conversation."""
    result = await db.execute(
        select(Conversation)
        .where(Conversation.id == conversation_id)
        .where(Conversation.user_id == current_user.id)
    )
    conversation = result.scalar_one_or_none()
    
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    if data.title is not None:
        conversation.title = data.title
    if data.is_archived is not None:
        conversation.is_archived = data.is_archived
    
    await db.commit()
    await db.refresh(conversation)
    
    return ConversationResponse(
        id=conversation.id,
        title=conversation.title,
        created_at=conversation.created_at,
        updated_at=conversation.updated_at,
        is_archived=conversation.is_archived,
        message_count=0
    )


@router.delete("/{conversation_id}")
@limiter.limit("60/minute")
async def delete_conversation(
    request: Request,
    conversation_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a conversation and all its messages."""
    result = await db.execute(
        select(Conversation)
        .where(Conversation.id == conversation_id)
        .where(Conversation.user_id == current_user.id)
    )
    conversation = result.scalar_one_or_none()
    
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    await db.delete(conversation)
    await db.commit()
    
    return {"message": "Conversation deleted"}


@router.get("/{conversation_id}/messages", response_model=List[MessageResponse])
@limiter.limit("60/minute")
async def get_messages(
    request: Request,
    conversation_id: str,
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get messages for a conversation."""
    # Verify conversation exists and belongs to current user
    result = await db.execute(
        select(Conversation)
        .where(Conversation.id == conversation_id)
        .where(Conversation.user_id == current_user.id)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    # Get messages
    result = await db.execute(
        select(Message)
        .where(Message.conversation_id == conversation_id)
        .order_by(Message.created_at.asc())
        .offset(skip)
        .limit(limit)
    )
    messages = result.scalars().all()
    
    return [
        MessageResponse(
            id=m.id,
            conversation_id=m.conversation_id,
            role=m.role,
            content=m.content,
            created_at=m.created_at,
            sources=m.sources or [],
            skills_used=m.skills_used or []
        )
        for m in messages
    ]


@router.delete("/{conversation_id}/messages")
@limiter.limit("60/minute")
async def clear_messages(
    request: Request,
    conversation_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Clear all messages in a conversation."""
    # Verify conversation exists and belongs to current user
    result = await db.execute(
        select(Conversation)
        .where(Conversation.id == conversation_id)
        .where(Conversation.user_id == current_user.id)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    # Delete messages
    await db.execute(
        delete(Message).where(Message.conversation_id == conversation_id)
    )
    await db.commit()
    
    return {"message": "Messages cleared"}
