"""
Galentix AI - Chat Router
Handles chat interactions with streaming support.
"""
import json
import uuid
from typing import Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from ..database import get_db
from ..models.conversation import Conversation, Message
from ..models.user import User
from ..models.schemas import ChatRequest, ChatResponse
from ..services.llm import get_llm_service, LLMService
from ..services.llm.base import LLMMessage
from ..services.rag import get_rag_pipeline
from ..services.websearch import get_search_service
from ..services.auth import get_current_user
from ..config import settings
from ..rate_limit import limiter

router = APIRouter(prefix="/api/chat", tags=["chat"])

# Bilingual system prompt for Galentix AI (English + Arabic)
SYSTEM_PROMPT = """You are Galentix AI, a helpful, intelligent assistant running locally on this device.
You are privacy-focused and never send data to external servers unless the user explicitly asks for a web search.
You can communicate in both English and Arabic. Respond in the same language the user writes in.

أنت Galentix AI، مساعد ذكي يعمل محلياً على هذا الجهاز.
تركز على الخصوصية ولا ترسل بيانات إلى خوادم خارجية إلا إذا طلب المستخدم بحثاً عبر الإنترنت.
يمكنك التواصل بالعربية والإنجليزية. أجب بنفس اللغة التي يكتب بها المستخدم.

Key capabilities / القدرات الرئيسية:
- Answer questions using your knowledge / الإجابة على الأسئلة
- Search uploaded documents (RAG) / البحث في المستندات المرفوعة
- Search the web when asked / البحث في الإنترنت عند الطلب
- Help with analysis, writing, coding / المساعدة في التحليل والكتابة والبرمجة

When using information from documents or web search, always cite your sources.
عند استخدام معلومات من المستندات أو البحث، اذكر مصادرك دائماً.
"""


async def generate_response_stream(
    message: str,
    conversation_id: str,
    use_rag: bool,
    use_web_search: bool,
    db: AsyncSession
):
    """Generator for streaming chat responses."""
    llm = get_llm_service()
    rag = get_rag_pipeline()
    search = get_search_service()
    
    # Build context
    context_parts = []
    sources = []
    web_results = []
    
    # RAG context
    if use_rag and settings.rag_enabled:
        try:
            rag_context, rag_results = await rag.build_context(message, top_k=settings.rag_top_k)
            if rag_context:
                context_parts.append(f"## Relevant Documents:\n{rag_context}")
                for r in rag_results:
                    sources.append({
                        "type": "document",
                        "filename": r["metadata"].get("filename", "Unknown"),
                        "chunk": r["chunk_index"],
                        "similarity": round(r["similarity"], 3)
                    })
        except Exception as e:
            print(f"RAG error: {e}")

    # Web search context
    if use_web_search and settings.search_enabled:
        try:
            search_data = await search.search_and_summarize(message, max_results=5)
            if search_data["results"]:
                context_parts.append(f"## Web Search Results:\n{search_data['context']}")
                web_results = search_data["results"]
        except Exception as e:
            print(f"Search error: {e}")
    
    # Build full prompt
    full_system_prompt = SYSTEM_PROMPT
    if context_parts:
        full_system_prompt += "\n\n" + "\n\n".join(context_parts)
        full_system_prompt += "\n\nUse the above context to help answer the user's question. Cite sources when applicable."
    
    # Get conversation history
    messages = []
    try:
        result = await db.execute(
            select(Message)
            .where(Message.conversation_id == conversation_id)
            .order_by(Message.created_at.desc())
            .limit(10)
        )
        history = result.scalars().all()
        history.reverse()  # Oldest first
        
        for msg in history:
            messages.append(LLMMessage(role=msg.role, content=msg.content))
    except Exception:
        pass
    
    # Add current message
    messages.append(LLMMessage(role="user", content=message))
    
    # Stream metadata first
    yield f"data: {json.dumps({'type': 'meta', 'sources': sources, 'web_results': web_results})}\n\n"
    
    # Stream response
    full_response = ""
    try:
        async for chunk in llm.generate_stream(
            messages=messages,
            system_prompt=full_system_prompt,
            temperature=settings.llm_temperature,
            max_tokens=settings.llm_max_tokens
        ):
            full_response += chunk
            yield f"data: {json.dumps({'type': 'token', 'content': chunk})}\n\n"
    except Exception as e:
        yield f"data: {json.dumps({'type': 'error', 'content': str(e)})}\n\n"
        return
    
    # Save messages to database
    try:
        # Save user message
        user_msg = Message(
            conversation_id=conversation_id,
            role="user",
            content=message
        )
        db.add(user_msg)
        
        # Save assistant message
        assistant_msg = Message(
            conversation_id=conversation_id,
            role="assistant",
            content=full_response,
            sources=sources,
            skills_used=["rag"] if sources else [] + ["web_search"] if web_results else []
        )
        db.add(assistant_msg)
        
        # Update conversation
        result = await db.execute(
            select(Conversation).where(Conversation.id == conversation_id)
        )
        conv = result.scalar_one_or_none()
        if conv:
            conv.updated_at = datetime.utcnow()
            # Auto-generate title from first message if still default
            if conv.title == "New Conversation":
                conv.title = message[:50] + "..." if len(message) > 50 else message
        
        await db.commit()
    except Exception as e:
        print(f"DB save error: {e}")
    
    # Send done signal
    yield f"data: {json.dumps({'type': 'done', 'conversation_id': conversation_id})}\n\n"


@router.post("/stream")
@limiter.limit("10/minute")
async def chat_stream(
    chat_request: ChatRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Stream chat response with SSE."""

    # Get or create conversation
    conversation_id = chat_request.conversation_id

    if not conversation_id:
        # Create new conversation
        conversation = Conversation(
            id=str(uuid.uuid4()),
            title="New Conversation",
            user_id=current_user.id
        )
        db.add(conversation)
        await db.commit()
        conversation_id = conversation.id
    else:
        # Verify conversation exists and belongs to current user
        result = await db.execute(
            select(Conversation).where(
                Conversation.id == conversation_id,
                Conversation.user_id == current_user.id
            )
        )
        if not result.scalar_one_or_none():
            raise HTTPException(status_code=404, detail="Conversation not found")

    return StreamingResponse(
        generate_response_stream(
            message=chat_request.message,
            conversation_id=conversation_id,
            use_rag=chat_request.use_rag,
            use_web_search=chat_request.use_web_search,
            db=db
        ),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )


@router.post("/", response_model=ChatResponse)
@limiter.limit("10/minute")
async def chat(
    chat_request: ChatRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Non-streaming chat endpoint."""
    llm = get_llm_service()
    rag = get_rag_pipeline()
    search = get_search_service()

    # Get or create conversation
    conversation_id = chat_request.conversation_id

    if not conversation_id:
        conversation = Conversation(
            id=str(uuid.uuid4()),
            title="New Conversation",
            user_id=current_user.id
        )
        db.add(conversation)
        await db.commit()
        conversation_id = conversation.id

    # Build context
    context_parts = []
    sources = []
    web_results = []

    # RAG context
    if chat_request.use_rag and settings.rag_enabled:
        try:
            rag_context, rag_results = await rag.build_context(chat_request.message, top_k=settings.rag_top_k)
            if rag_context:
                context_parts.append(f"## Relevant Documents:\n{rag_context}")
                for r in rag_results:
                    sources.append({
                        "type": "document",
                        "filename": r["metadata"].get("filename", "Unknown"),
                        "chunk": r["chunk_index"],
                        "similarity": round(r["similarity"], 3)
                    })
        except Exception:
            pass

    # Web search context
    if chat_request.use_web_search and settings.search_enabled:
        try:
            search_data = await search.search_and_summarize(chat_request.message, max_results=5)
            if search_data["results"]:
                context_parts.append(f"## Web Search Results:\n{search_data['context']}")
                web_results = search_data["results"]
        except Exception:
            pass

    # Build prompt
    full_system_prompt = SYSTEM_PROMPT
    if context_parts:
        full_system_prompt += "\n\n" + "\n\n".join(context_parts)

    # Get history
    messages = []
    try:
        result = await db.execute(
            select(Message)
            .where(Message.conversation_id == conversation_id)
            .order_by(Message.created_at.desc())
            .limit(10)
        )
        history = result.scalars().all()
        history.reverse()
        for msg in history:
            messages.append(LLMMessage(role=msg.role, content=msg.content))
    except Exception:
        pass

    messages.append(LLMMessage(role="user", content=chat_request.message))

    # Generate response
    response = await llm.generate(
        messages=messages,
        system_prompt=full_system_prompt,
        temperature=settings.llm_temperature,
        max_tokens=settings.llm_max_tokens
    )

    # Save to database
    user_msg = Message(conversation_id=conversation_id, role="user", content=chat_request.message)
    assistant_msg = Message(
        conversation_id=conversation_id,
        role="assistant",
        content=response.content,
        sources=sources
    )
    db.add(user_msg)
    db.add(assistant_msg)
    await db.commit()
    
    return ChatResponse(
        message=response.content,
        conversation_id=conversation_id,
        sources=sources,
        web_results=web_results,
        skills_used=(["rag"] if sources else []) + (["web_search"] if web_results else [])
    )
