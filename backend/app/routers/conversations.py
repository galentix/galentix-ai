"""
Galentix AI - Conversations Router
Manages conversation history and messages.
"""
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from sqlalchemy.orm import selectinload

from ..database import get_db
from ..models.conversation import Conversation, Message
from ..models.schemas import (
    ConversationCreate,
    ConversationUpdate,
    ConversationResponse,
    MessageResponse
)

router = APIRouter(prefix="/api/conversations", tags=["conversations"])


@router.get("/", response_model=List[ConversationResponse])
async def list_conversations(
    skip: int = 0,
    limit: int = 50,
    include_archived: bool = False,
    db: AsyncSession = Depends(get_db)
):
    """List all conversations."""
    query = select(Conversation).options(selectinload(Conversation.messages))
    
    if not include_archived:
        query = query.where(Conversation.is_archived == False)
    
    query = query.order_by(Conversation.updated_at.desc()).offset(skip).limit(limit)
    
    result = await db.execute(query)
    conversations = result.scalars().all()
    
    return [
        ConversationResponse(
            id=c.id,
            title=c.title,
            created_at=c.created_at,
            updated_at=c.updated_at,
            is_archived=c.is_archived,
            message_count=len(c.messages) if c.messages else 0
        )
        for c in conversations
    ]


@router.post("/", response_model=ConversationResponse)
async def create_conversation(
    data: ConversationCreate,
    db: AsyncSession = Depends(get_db)
):
    """Create a new conversation."""
    conversation = Conversation(
        title=data.title or "New Conversation"
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
async def get_conversation(
    conversation_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Get a specific conversation."""
    result = await db.execute(
        select(Conversation)
        .options(selectinload(Conversation.messages))
        .where(Conversation.id == conversation_id)
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


@router.patch("/{conversation_id}", response_model=ConversationResponse)
async def update_conversation(
    conversation_id: str,
    data: ConversationUpdate,
    db: AsyncSession = Depends(get_db)
):
    """Update a conversation."""
    result = await db.execute(
        select(Conversation).where(Conversation.id == conversation_id)
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
async def delete_conversation(
    conversation_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Delete a conversation and all its messages."""
    result = await db.execute(
        select(Conversation).where(Conversation.id == conversation_id)
    )
    conversation = result.scalar_one_or_none()
    
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    await db.delete(conversation)
    await db.commit()
    
    return {"message": "Conversation deleted"}


@router.get("/{conversation_id}/messages", response_model=List[MessageResponse])
async def get_messages(
    conversation_id: str,
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db)
):
    """Get messages for a conversation."""
    # Verify conversation exists
    result = await db.execute(
        select(Conversation).where(Conversation.id == conversation_id)
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
async def clear_messages(
    conversation_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Clear all messages in a conversation."""
    # Verify conversation exists
    result = await db.execute(
        select(Conversation).where(Conversation.id == conversation_id)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    # Delete messages
    await db.execute(
        delete(Message).where(Message.conversation_id == conversation_id)
    )
    await db.commit()
    
    return {"message": "Messages cleared"}
