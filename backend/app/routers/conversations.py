"""
Galentix AI - Conversations Router
Manages conversation history and messages.
"""
from typing import List
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete, func
from sqlalchemy.orm import selectinload

from ..database import get_db
from ..models.conversation import Conversation, Message
from ..models.schemas import (
    ConversationCreate,
    ConversationUpdate,
    ConversationResponse,
    MessageResponse,
    PaginatedResponse,
    ErrorResponse
)

router = APIRouter(
    prefix="/api/conversations",
    tags=["conversations"],
    responses={
        400: {"model": ErrorResponse, "description": "Invalid request"},
        422: {"model": ErrorResponse, "description": "Validation error"},
        429: {"model": ErrorResponse, "description": "Rate limit exceeded"},
        500: {"model": ErrorResponse, "description": "Internal server error"}
    }
)

MAX_PAGE_SIZE = 100
DEFAULT_PAGE_SIZE = 20


@router.get(
    "/",
    response_model=PaginatedResponse[ConversationResponse],
    summary="List conversations",
    description="Retrieve a paginated list of conversations. Results are ordered by most recently updated.",
    responses={
        200: {"description": "Successfully retrieved conversations"},
        422: {"model": ErrorResponse, "description": "Invalid pagination parameters"}
    }
)
async def list_conversations(
    page: int = Query(1, ge=1, description="Page number (1-based)"),
    page_size: int = Query(DEFAULT_PAGE_SIZE, ge=1, le=MAX_PAGE_SIZE, description="Number of items per page"),
    include_archived: bool = Query(False, description="Include archived conversations"),
    db: AsyncSession = Depends(get_db)
):
    """List all conversations with pagination."""
    skip = (page - 1) * page_size
    
    base_query = select(Conversation).options(selectinload(Conversation.messages))
    if not include_archived:
        base_query = base_query.where(Conversation.is_archived == False)
    
    count_query = select(func.count(Conversation.id))
    if not include_archived:
        count_query = count_query.where(Conversation.is_archived == False)
    
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0
    
    query = base_query.order_by(Conversation.updated_at.desc()).offset(skip).limit(page_size)
    result = await db.execute(query)
    conversations = result.scalars().all()
    
    items = [
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
    
    total_pages = (total + page_size - 1) // page_size if total > 0 else 1
    
    return PaginatedResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages
    )


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


@router.get(
    "/{conversation_id}",
    response_model=ConversationResponse,
    summary="Get a conversation",
    description="Retrieve a specific conversation by its ID.",
    responses={
        200: {"description": "Conversation found and returned"},
        404: {"model": ErrorResponse, "description": "Conversation not found"}
    }
)
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
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found"
        )
    
    return ConversationResponse(
        id=conversation.id,
        title=conversation.title,
        created_at=conversation.created_at,
        updated_at=conversation.updated_at,
        is_archived=conversation.is_archived,
        message_count=len(conversation.messages) if conversation.messages else 0
    )


@router.patch(
    "/{conversation_id}",
    response_model=ConversationResponse,
    summary="Update a conversation",
    description="Update conversation title or archived status.",
    responses={
        200: {"description": "Conversation updated successfully"},
        404: {"model": ErrorResponse, "description": "Conversation not found"},
        422: {"model": ErrorResponse, "description": "Validation error in request body"}
    }
)
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
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found"
        )
    
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


@router.delete(
    "/{conversation_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a conversation",
    description="Delete a conversation and all its messages permanently.",
    responses={
        204: {"description": "Conversation deleted successfully"},
        404: {"model": ErrorResponse, "description": "Conversation not found"}
    }
)
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
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found"
        )
    
    await db.delete(conversation)
    await db.commit()


@router.get(
    "/{conversation_id}/messages",
    response_model=PaginatedResponse[MessageResponse],
    summary="Get conversation messages",
    description="Retrieve messages for a specific conversation with pagination.",
    responses={
        200: {"description": "Successfully retrieved messages"},
        404: {"model": ErrorResponse, "description": "Conversation not found"}
    }
)
async def get_messages(
    conversation_id: str,
    page: int = Query(1, ge=1, description="Page number (1-based)"),
    page_size: int = Query(DEFAULT_PAGE_SIZE, ge=1, le=MAX_PAGE_SIZE, description="Number of items per page"),
    db: AsyncSession = Depends(get_db)
):
    """Get messages for a conversation with pagination."""
    result = await db.execute(
        select(Conversation).where(Conversation.id == conversation_id)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found"
        )
    
    skip = (page - 1) * page_size
    
    count_result = await db.execute(
        select(func.count(Message.id)).where(Message.conversation_id == conversation_id)
    )
    total = count_result.scalar() or 0
    
    result = await db.execute(
        select(Message)
        .where(Message.conversation_id == conversation_id)
        .order_by(Message.created_at.asc())
        .offset(skip)
        .limit(page_size)
    )
    messages = result.scalars().all()
    
    items = [
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
    
    total_pages = (total + page_size - 1) // page_size if total > 0 else 1
    
    return PaginatedResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages
    )


@router.delete(
    "/{conversation_id}/messages",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Clear conversation messages",
    description="Delete all messages in a conversation (keeps the conversation itself).",
    responses={
        204: {"description": "Messages cleared successfully"},
        404: {"model": ErrorResponse, "description": "Conversation not found"}
    }
)
async def clear_messages(
    conversation_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Clear all messages in a conversation."""
    result = await db.execute(
        select(Conversation).where(Conversation.id == conversation_id)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found"
        )
    
    await db.execute(
        delete(Message).where(Message.conversation_id == conversation_id)
    )
    await db.commit()
