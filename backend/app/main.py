"""
Galentix AI - Main Application
FastAPI application entry point.
"""
import logging
import os
from pathlib import Path
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from .config import settings
from .database import init_db
from .rate_limit import limiter
from .routers import (
    chat_router,
    conversations_router,
    documents_router,
    search_router,
    system_router
)
from .routers import auth as auth_router
from .services.llm import get_llm_service
from .services.rag import get_rag_pipeline
from .services.rag.embeddings import get_embeddings_service
from .services.websearch import get_search_service

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager."""
    # Startup
    print(f"Starting {settings.brand_name}...")

    # Initialize database
    await init_db()
    print("Database initialized")

    # Initialize LLM service
    llm = get_llm_service()
    await llm.initialize()
    print(f"LLM service initialized ({llm.engine_name}: {llm.model_name})")

    # Initialize RAG pipeline
    rag = get_rag_pipeline()
    await rag.initialize()
    print("RAG pipeline initialized")

    print(f"{settings.brand_name} is ready!")

    yield

    # Shutdown — close persistent HTTP clients
    print(f"Shutting down {settings.brand_name}...")
    llm = get_llm_service()
    await llm.close()

    embeddings = get_embeddings_service()
    await embeddings.close()

    search = get_search_service()
    await search.close()


# Create FastAPI app
app = FastAPI(
    title=settings.brand_name,
    description="Local AI Assistant with RAG and Web Search",
    version="2.0.0",
    lifespan=lifespan,
    docs_url="/api/docs" if settings.debug else None,
    redoc_url="/api/redoc" if settings.debug else None,
    openapi_url="/api/openapi.json" if settings.debug else None,
)

# Rate limiter setup
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins if settings.allowed_origins else ["http://localhost:8080", "http://127.0.0.1:8080"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE"],
    allow_headers=["Content-Type"],
)


# Exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Global exception handler."""
    logger.error("Unhandled exception on %s %s: %s", request.method, request.url.path, exc, exc_info=True)
    return JSONResponse(
        status_code=500,
        content={
            "error": "Internal server error",
            "detail": "An internal error occurred"
        }
    )


# Include API routers
app.include_router(chat_router)
app.include_router(conversations_router)
app.include_router(documents_router)
app.include_router(search_router)
app.include_router(system_router)
app.include_router(auth_router.router)


# Serve static files (frontend)
# Check production path first, then dev path
frontend_path = settings.base_dir / "frontend"
if not (frontend_path / "index.html").exists():
    frontend_path = Path(__file__).parent.parent.parent / "frontend" / "dist"
if frontend_path.exists() and (frontend_path / "assets").exists():
    app.mount("/assets", StaticFiles(directory=frontend_path / "assets"), name="assets")


# Serve frontend for all non-API routes (SPA support)
@app.get("/")
async def serve_root():
    """Serve the frontend index.html."""
    index_path = frontend_path / "index.html"
    if index_path.exists():
        return FileResponse(index_path)

    # Fallback if frontend not built
    return JSONResponse({
        "message": f"Welcome to {settings.brand_name} API",
        "version": "2.0.0",
        "docs": "/api/docs",
        "health": "/api/system/health"
    })


@app.get("/{full_path:path}")
async def serve_spa(full_path: str):
    """Catch-all route for SPA frontend."""
    # Don't intercept API routes
    if full_path.startswith("api/"):
        return JSONResponse({"error": "Not found"}, status_code=404)

    # Try to serve static file (with path traversal protection)
    static_file = (frontend_path / full_path).resolve()
    if static_file.is_relative_to(frontend_path.resolve()) and static_file.is_file():
        return FileResponse(static_file)

    # Fallback to index.html for SPA routing
    index_path = frontend_path / "index.html"
    if index_path.exists():
        return FileResponse(index_path)

    return JSONResponse({"error": "Not found"}, status_code=404)


# Health check at root level (useful for load balancers)
@app.get("/health")
async def root_health():
    """Simple health check."""
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug
    )
