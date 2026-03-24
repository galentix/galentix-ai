"""
Galentix AI - System Router
System information, health checks, and settings.
"""
import asyncio
import os
import json
import logging
import shutil
import time
import psutil
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from typing import Optional

from ..database import get_db
from ..models.audit import AuditLog
from ..models.conversation import Conversation, Message
from ..models.document import Document
from ..models.user import User
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
    ModelSwitchRequest,
    BackupResponse,
    BackupListResponse,
    BackupListItem,
    PurgeResponse,
)
from ..services.llm import get_llm_service
from ..services.rag import get_rag_pipeline
from ..services.websearch import get_search_service
from ..services.auth import get_current_user, require_admin
from ..services.audit import log_action
from ..services.backup import (
    create_backup as do_create_backup,
    list_backups as do_list_backups,
    delete_backup as do_delete_backup,
    restore_backup as do_restore_backup,
)
from ..services.hardware import is_arabic_capable, ARABIC_CAPABLE_MODELS
from ..config import settings, load_device_info, save_settings
from ..rate_limit import limiter

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/system", tags=["system"])

# Track startup time
STARTUP_TIME = datetime.utcnow()

# Health check cache to avoid repeated external HTTP calls
_health_cache = {"data": None, "timestamp": 0}
HEALTH_CACHE_TTL = 10  # seconds


@router.get("/health", response_model=HealthResponse)
@limiter.limit("30/minute")
async def health_check(request: Request):
    """Health check endpoint."""
    now = time.time()
    if _health_cache["data"] and (now - _health_cache["timestamp"]) < HEALTH_CACHE_TTL:
        return _health_cache["data"]

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

    result = HealthResponse(
        status="healthy" if llm_status == "online" else "degraded",
        version="2.0.0",
        llm_engine=settings.llm_engine,
        llm_model=settings.llm_model,
        llm_status=llm_status,
        rag_status=rag_status,
        search_status=search_status
    )

    _health_cache["data"] = result
    _health_cache["timestamp"] = now
    return result


@router.get("/info", response_model=DeviceInfoResponse)
@limiter.limit("60/minute")
async def device_info(
    request: Request,
    current_user: User = Depends(get_current_user)
):
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
@limiter.limit("30/minute")
async def system_stats(
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get system statistics."""
    
    # System resources (offload blocking psutil call to thread pool)
    cpu_percent = await asyncio.to_thread(psutil.cpu_percent, 0.1)
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
@limiter.limit("60/minute")
async def get_settings(
    request: Request,
    current_user: User = Depends(get_current_user)
):
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
            "max_results": settings.search_max_results,
            "language": settings.search_language
        },
        ui={
            "brand_name": settings.brand_name,
            "brand_color": settings.brand_color,
            "theme": settings.ui_theme
        }
    )


@router.patch("/settings")
@limiter.limit("10/minute")
async def update_settings(
    request: Request,
    body: SettingsUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Update system settings (admin only, partial updates)."""
    updated_fields = body.model_dump(exclude_none=True)
    if not updated_fields:
        raise HTTPException(status_code=400, detail="No fields to update")

    if body.temperature is not None:
        settings.llm_temperature = body.temperature
    if body.max_tokens is not None:
        settings.llm_max_tokens = body.max_tokens
    if body.rag_enabled is not None:
        settings.rag_enabled = body.rag_enabled
    if body.rag_top_k is not None:
        settings.rag_top_k = body.rag_top_k
    if body.search_enabled is not None:
        settings.search_enabled = body.search_enabled
    if body.search_language is not None:
        settings.search_language = body.search_language

    save_settings(settings)
    logger.info(f"Settings updated by {current_user.username}: {list(updated_fields.keys())}")

    await log_action(
        db, "settings.updated", user=current_user,
        resource_type="settings",
        details={"fields": list(updated_fields.keys()), "values": updated_fields},
        request=request,
    )

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
            "max_results": settings.search_max_results,
            "language": settings.search_language
        },
        ui={
            "brand_name": settings.brand_name,
            "brand_color": settings.brand_color,
            "theme": settings.ui_theme
        }
    )


@router.get("/logs")
@limiter.limit("30/minute")
async def get_logs(
    request: Request,
    lines: int = Query(default=100, le=500),
    current_user: User = Depends(require_admin)
):
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
        logger.error(f"Error reading logs: {e}")
        return {"logs": [], "error": "Failed to read log file"}


@router.get("/audit-logs")
@limiter.limit("30/minute")
async def get_audit_logs(
    request: Request,
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=50, le=200),
    action: Optional[str] = None,
    user_id: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Get paginated audit logs with optional filtering (admin only)."""
    query = select(AuditLog).order_by(AuditLog.timestamp.desc())
    count_query = select(func.count(AuditLog.id))

    if action:
        query = query.where(AuditLog.action == action)
        count_query = count_query.where(AuditLog.action == action)
    if user_id:
        query = query.where(AuditLog.user_id == user_id)
        count_query = count_query.where(AuditLog.user_id == user_id)

    # Total count
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    # Paginate
    offset = (page - 1) * per_page
    query = query.offset(offset).limit(per_page)

    result = await db.execute(query)
    logs = result.scalars().all()

    return {
        "logs": [log.to_dict() for log in logs],
        "total": total,
        "page": page,
        "per_page": per_page,
        "pages": (total + per_page - 1) // per_page if per_page else 0,
    }


@router.get("/llm/status")
@limiter.limit("30/minute")
async def llm_status(
    request: Request,
    current_user: User = Depends(get_current_user)
):
    """Get detailed LLM status."""
    llm = get_llm_service()

    try:
        status = await llm.get_status()
        return status
    except Exception as e:
        logger.error(f"Error getting LLM status: {e}")
        return {
            "engine": settings.llm_engine,
            "model": settings.llm_model,
            "status": "error",
            "error": "Failed to retrieve LLM status"
        }


@router.get("/rag/stats")
@limiter.limit("30/minute")
async def rag_stats(
    request: Request,
    current_user: User = Depends(get_current_user)
):
    """Get RAG statistics."""
    rag = get_rag_pipeline()

    try:
        stats = await rag.get_stats()
        return stats
    except Exception as e:
        logger.error(f"Error getting RAG stats: {e}")
        return {
            "status": "error",
            "error": "Failed to retrieve RAG statistics"
        }


@router.get("/models", response_model=ModelListResponse)
@limiter.limit("30/minute")
async def list_models(
    request: Request,
    current_user: User = Depends(require_admin)
):
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
            # Check if model supports Arabic
            ar_capable = is_arabic_capable(name)
            ar_info = ARABIC_CAPABLE_MODELS.get(name_base, {})
            models.append(ModelInfo(
                name=name,
                is_active=is_active,
                arabic_capable=ar_capable,
                languages=ar_info.get("languages", [])
            ))

        return ModelListResponse(
            models=models,
            active_model=settings.llm_model
        )
    except Exception as e:
        logger.error(f"Error listing models: {e}")
        raise HTTPException(status_code=500, detail="Failed to list models")


@router.post("/models/pull", response_model=ModelPullResponse)
@limiter.limit("5/minute")
async def pull_model(
    request: ModelPullRequest,
    http_request: Request,
    current_user: User = Depends(require_admin)
):
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
        logger.error(f"Error downloading model {request.model_name}: {e}")
        return ModelPullResponse(
            success=False,
            message="An error occurred while downloading the model",
            model_name=request.model_name
        )
    finally:
        await ollama.close()


@router.post("/models/pull/stream")
@limiter.limit("5/minute")
async def pull_model_stream(
    request: ModelPullRequest,
    http_request: Request,
    current_user: User = Depends(require_admin)
):
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
            logger.error(f"Error streaming model pull: {e}")
            yield f"data: {json.dumps({'status': 'error', 'message': 'An error occurred during model download'})}\n\n"
        finally:
            await ollama.close()

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@router.post("/models/switch")
@limiter.limit("10/minute")
async def switch_model(
    request: ModelSwitchRequest,
    http_request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Switch the active LLM model (hot-swap, no restart needed)."""
    llm = get_llm_service()
    previous_model = settings.llm_model

    try:
        success = await llm.switch_model(request.model_name)

        await log_action(
            db, "model.switched", user=current_user,
            resource_type="model", resource_id=request.model_name,
            details={"previous_model": previous_model, "new_model": request.model_name, "healthy": success},
            request=http_request,
        )

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
        logger.error(f"Error switching model: {e}")
        raise HTTPException(status_code=500, detail="Failed to switch model")


@router.delete("/models/{model_name:path}")
@limiter.limit("10/minute")
async def delete_model(
    request: Request,
    model_name: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin)
):
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

            await log_action(
                db, "model.deleted", user=current_user,
                resource_type="model", resource_id=model_name,
                details={"model_name": model_name},
                request=request,
            )

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
        logger.error(f"Error deleting model {model_name}: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete model")
    finally:
        await ollama.close()


# ============================================
# Backup & Restore
# ============================================

@router.post("/backup", response_model=BackupResponse)
@limiter.limit("5/minute")
async def create_backup_endpoint(
    request: Request,
    current_user: User = Depends(require_admin),
):
    """Create a full backup of database, config, and documents (admin only)."""
    try:
        archive_path = await asyncio.to_thread(do_create_backup, settings)
    except Exception as e:
        logger.error(f"Backup creation failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to create backup")

    from pathlib import Path
    p = Path(archive_path)
    return BackupResponse(
        success=True,
        filename=p.name,
        size_bytes=p.stat().st_size,
        message="Backup created successfully",
    )


@router.get("/backups", response_model=BackupListResponse)
@limiter.limit("30/minute")
async def list_backups_endpoint(
    request: Request,
    current_user: User = Depends(require_admin),
):
    """List all available backups (admin only)."""
    try:
        backups = await asyncio.to_thread(do_list_backups, settings)
    except Exception as e:
        logger.error(f"Error listing backups: {e}")
        raise HTTPException(status_code=500, detail="Failed to list backups")

    return BackupListResponse(
        backups=[BackupListItem(**b) for b in backups],
        total=len(backups),
    )


@router.get("/backups/{filename}/download")
@limiter.limit("10/minute")
async def download_backup(
    request: Request,
    filename: str,
    current_user: User = Depends(require_admin),
):
    """Download a backup archive (admin only)."""
    backup_dir = settings.data_dir / "backups"
    archive_path = backup_dir / filename

    if not archive_path.exists():
        raise HTTPException(status_code=404, detail="Backup not found")

    # Prevent path traversal
    try:
        archive_path.resolve().relative_to(backup_dir.resolve())
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid filename")

    return FileResponse(
        path=str(archive_path),
        filename=filename,
        media_type="application/gzip",
    )


@router.delete("/backups/{filename}")
@limiter.limit("10/minute")
async def delete_backup_endpoint(
    request: Request,
    filename: str,
    current_user: User = Depends(require_admin),
):
    """Delete a backup archive (admin only)."""
    # Prevent path traversal
    backup_dir = settings.data_dir / "backups"
    archive_path = backup_dir / filename
    try:
        archive_path.resolve().relative_to(backup_dir.resolve())
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid filename")

    try:
        deleted = await asyncio.to_thread(do_delete_backup, settings, filename)
    except Exception as e:
        logger.error(f"Error deleting backup: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete backup")

    if not deleted:
        raise HTTPException(status_code=404, detail="Backup not found")

    return {"success": True, "message": f"Backup {filename} deleted"}


@router.post("/restore/{filename}")
@limiter.limit("3/minute")
async def restore_backup_endpoint(
    request: Request,
    filename: str,
    current_user: User = Depends(require_admin),
):
    """Restore data from a backup archive (admin only).

    Warning: this overwrites the current database, config, and documents.
    A restart of the backend service is recommended after restore.
    """
    # Prevent path traversal
    backup_dir = settings.data_dir / "backups"
    archive_path = backup_dir / filename
    try:
        archive_path.resolve().relative_to(backup_dir.resolve())
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid filename")

    try:
        await asyncio.to_thread(do_restore_backup, settings, filename)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Backup not found")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Restore failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to restore backup")

    return {
        "success": True,
        "message": f"Backup {filename} restored successfully. A service restart is recommended.",
    }


# ============================================
# Data Purge
# ============================================

@router.post("/purge", response_model=PurgeResponse)
@limiter.limit("3/minute")
async def purge_all_data(
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Delete all conversations, messages, documents, and ChromaDB data.

    User accounts and system configuration are preserved. This action
    cannot be undone -- consider creating a backup first.
    """
    deleted = {"conversations": 0, "messages": 0, "documents": 0, "chroma_reset": False}

    try:
        # Delete messages first (FK constraint)
        msg_result = await db.execute(select(func.count(Message.id)))
        deleted["messages"] = msg_result.scalar() or 0
        await db.execute(Message.__table__.delete())

        # Delete conversations
        conv_result = await db.execute(select(func.count(Conversation.id)))
        deleted["conversations"] = conv_result.scalar() or 0
        await db.execute(Conversation.__table__.delete())

        # Delete documents
        doc_result = await db.execute(select(func.count(Document.id)))
        deleted["documents"] = doc_result.scalar() or 0
        await db.execute(Document.__table__.delete())

        await db.commit()
    except Exception as e:
        await db.rollback()
        logger.error(f"Database purge failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to purge database records")

    # Reset ChromaDB collection
    try:
        rag = get_rag_pipeline()
        if rag._initialized and rag._client is not None:
            rag._client.delete_collection("galentix_documents")
            rag._collection = None
            rag._initialized = False
            deleted["chroma_reset"] = True
            logger.info("ChromaDB collection deleted")
    except Exception as e:
        logger.warning(f"ChromaDB reset failed (non-fatal): {e}")

    # Remove uploaded document files from disk
    docs_dir = settings.data_dir / "documents"
    if docs_dir.exists():
        try:
            await asyncio.to_thread(shutil.rmtree, docs_dir)
            docs_dir.mkdir(parents=True, exist_ok=True)
        except Exception as e:
            logger.warning(f"Failed to remove document files: {e}")

    logger.info(
        f"Data purge completed by {current_user.username}: "
        f"{deleted['conversations']} conversations, "
        f"{deleted['messages']} messages, "
        f"{deleted['documents']} documents"
    )

    return PurgeResponse(
        success=True,
        message="All data purged successfully",
        deleted=deleted,
    )
