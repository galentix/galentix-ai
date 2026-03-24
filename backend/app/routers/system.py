"""
Galentix AI - System Router
System information, health checks, and settings.
"""
import os
import json
import psutil
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from ..database import get_db
from ..models.conversation import Conversation, Message
from ..models.document import Document
from ..models.schemas import (
    HealthResponse,
    DeviceInfoResponse,
    SystemStatsResponse,
    SettingsResponse,
    SettingsUpdate,
    ModelInfo,
    ModelListResponse,
    ModelPullRequest,
    ModelPullResponse,
    ModelSwitchRequest
)
from ..services.llm import get_llm_service
from ..services.rag import get_rag_pipeline
from ..services.websearch import get_search_service
from ..config import settings, load_device_info, save_settings

router = APIRouter(prefix="/api/system", tags=["system"])

# Track startup time
STARTUP_TIME = datetime.utcnow()


@router.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint."""
    llm = get_llm_service()
    rag = get_rag_pipeline()
    search = get_search_service()
    
    # Check LLM
    llm_status = "unknown"
    try:
        if await llm.health_check():
            llm_status = "online"
        else:
            llm_status = "offline"
    except Exception:
        llm_status = "error"
    
    # Check RAG
    rag_status = "unknown"
    try:
        rag_stats = await rag.get_stats()
        rag_status = rag_stats.get("status", "unknown")
    except Exception:
        rag_status = "error"
    
    # Check search
    search_status = "unknown"
    if settings.search_enabled:
        try:
            if await search.health_check():
                search_status = "online"
            else:
                search_status = "offline"
        except Exception:
            search_status = "error"
    else:
        search_status = "disabled"
    
    return HealthResponse(
        status="healthy" if llm_status == "online" else "degraded",
        version="2.0.0",
        llm_engine=settings.llm_engine,
        llm_model=settings.llm_model,
        llm_status=llm_status,
        rag_status=rag_status,
        search_status=search_status
    )


@router.get("/info", response_model=DeviceInfoResponse)
async def device_info():
    """Get device information."""
    device = load_device_info()
    
    # Calculate uptime
    uptime_delta = datetime.utcnow() - STARTUP_TIME
    hours, remainder = divmod(int(uptime_delta.total_seconds()), 3600)
    minutes, seconds = divmod(remainder, 60)
    uptime_str = f"{hours}h {minutes}m {seconds}s"
    
    return DeviceInfoResponse(
        device_id=device.get("device_id", "unknown"),
        version=device.get("version", "2.0.0"),
        hardware=device.get("hardware", {}),
        llm=device.get("llm", {}),
        uptime=uptime_str
    )


@router.get("/stats", response_model=SystemStatsResponse)
async def system_stats(db: AsyncSession = Depends(get_db)):
    """Get system statistics."""
    
    # System resources
    cpu_percent = psutil.cpu_percent(interval=0.1)
    memory = psutil.virtual_memory()
    disk = psutil.disk_usage("/")
    
    # Database counts
    conv_result = await db.execute(select(func.count(Conversation.id)))
    conversations_count = conv_result.scalar() or 0
    
    doc_result = await db.execute(select(func.count(Document.id)))
    documents_count = doc_result.scalar() or 0
    
    msg_result = await db.execute(select(func.count(Message.id)))
    messages_count = msg_result.scalar() or 0
    
    return SystemStatsResponse(
        cpu_percent=cpu_percent,
        memory_percent=memory.percent,
        disk_percent=disk.percent,
        conversations_count=conversations_count,
        documents_count=documents_count,
        messages_count=messages_count
    )


@router.get("/settings", response_model=SettingsResponse)
async def get_settings():
    """Get current settings."""
    return SettingsResponse(
        llm={
            "engine": settings.llm_engine,
            "model": settings.llm_model,
            "temperature": settings.llm_temperature,
            "max_tokens": settings.llm_max_tokens
        },
        rag={
            "enabled": settings.rag_enabled,
            "chunk_size": settings.rag_chunk_size,
            "chunk_overlap": settings.rag_chunk_overlap,
            "top_k": settings.rag_top_k
        },
        search={
            "enabled": settings.search_enabled,
            "max_results": settings.search_max_results
        },
        ui={
            "brand_name": settings.brand_name,
            "brand_color": settings.brand_color,
            "theme": settings.ui_theme
        }
    )


@router.get("/logs")
async def get_logs(lines: int = 100):
    """Get recent log entries."""
    log_file = settings.log_dir / "backend.log"
    
    if not log_file.exists():
        return {"logs": [], "message": "No logs available"}
    
    try:
        with open(log_file, "r") as f:
            all_lines = f.readlines()
            recent_lines = all_lines[-lines:] if len(all_lines) > lines else all_lines
            return {"logs": [line.strip() for line in recent_lines]}
    except Exception as e:
        return {"logs": [], "error": str(e)}


@router.get("/llm/status")
async def llm_status():
    """Get detailed LLM status."""
    llm = get_llm_service()
    
    try:
        status = await llm.get_status()
        return status
    except Exception as e:
        return {
            "engine": settings.llm_engine,
            "model": settings.llm_model,
            "status": "error",
            "error": str(e)
        }


@router.get("/rag/stats")
async def rag_stats():
    """Get RAG statistics."""
    rag = get_rag_pipeline()
    
    try:
        stats = await rag.get_stats()
        return stats
    except Exception as e:
        return {
            "status": "error",
            "error": str(e)
        }


@router.get("/models", response_model=ModelListResponse)
async def list_models():
    """List all downloaded models with active model marked."""
    llm = get_llm_service()

    try:
        # Get models from Ollama via the LLM service
        model_names = await llm.list_models()

        # Normalize active model name for comparison (handle :latest suffix)
        active = settings.llm_model
        active_base = active.split(":")[0] if ":" in active else active

        models = []
        for name in model_names:
            name_base = name.split(":")[0] if ":" in name else name
            is_active = (name == active) or (name_base == active_base and (
                name.endswith(":latest") or active.endswith(":latest") or ":" not in active or ":" not in name
            ))
            models.append(ModelInfo(
                name=name,
                is_active=is_active
            ))

        return ModelListResponse(
            models=models,
            active_model=settings.llm_model
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list models: {str(e)}")


@router.post("/models/pull", response_model=ModelPullResponse)
async def pull_model(request: ModelPullRequest):
    """Download a new model from Ollama registry."""
    from ..services.llm.ollama import OllamaService

    ollama = OllamaService(base_url=settings.ollama_url)

    try:
        success = await ollama.pull_model(request.model_name)

        if success:
            # Add to tracked models list
            if request.model_name not in settings.llm_models:
                settings.llm_models.append(request.model_name)
                save_settings(settings)

            return ModelPullResponse(
                success=True,
                message=f"Model {request.model_name} downloaded successfully",
                model_name=request.model_name
            )
        else:
            return ModelPullResponse(
                success=False,
                message=f"Failed to download model {request.model_name}",
                model_name=request.model_name
            )
    except Exception as e:
        return ModelPullResponse(
            success=False,
            message=f"Error downloading model: {str(e)}",
            model_name=request.model_name
        )


@router.post("/models/pull/stream")
async def pull_model_stream(request: ModelPullRequest):
    """Download a model with streaming progress via SSE."""
    from ..services.llm.ollama import OllamaService

    ollama = OllamaService(base_url=settings.ollama_url)

    async def event_stream():
        try:
            async for progress in ollama.pull_model_stream(request.model_name):
                yield f"data: {json.dumps(progress)}\n\n"

            # Add to tracked models list on success
            if request.model_name not in settings.llm_models:
                settings.llm_models.append(request.model_name)
                save_settings(settings)

            yield f"data: {json.dumps({'status': 'success', 'percent': 100})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'status': 'error', 'message': str(e)})}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@router.post("/models/switch")
async def switch_model(request: ModelSwitchRequest):
    """Switch the active LLM model (hot-swap, no restart needed)."""
    llm = get_llm_service()

    try:
        success = await llm.switch_model(request.model_name)

        if success:
            return {
                "success": True,
                "message": f"Switched to model {request.model_name}",
                "active_model": request.model_name
            }
        else:
            return {
                "success": False,
                "message": f"Model {request.model_name} switched but health check failed. It may still work.",
                "active_model": request.model_name
            }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to switch model: {str(e)}")


@router.delete("/models/{model_name:path}")
async def delete_model(model_name: str):
    """Delete a downloaded model."""
    # Don't allow deleting the active model
    if model_name == settings.llm_model:
        raise HTTPException(status_code=400, detail="Cannot delete the active model. Switch to a different model first.")

    from ..services.llm.ollama import OllamaService

    ollama = OllamaService(base_url=settings.ollama_url)

    try:
        success = await ollama.delete_model(model_name)

        if success:
            # Remove from tracked models list
            if model_name in settings.llm_models:
                settings.llm_models.remove(model_name)
                save_settings(settings)

            return {
                "success": True,
                "message": f"Model {model_name} deleted successfully"
            }
        else:
            return {
                "success": False,
                "message": f"Failed to delete model {model_name}"
            }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete model: {str(e)}")
