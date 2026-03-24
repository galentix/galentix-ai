"""
Galentix AI - Main Application
FastAPI application entry point.
"""
import os
from pathlib import Path
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .database import init_db
from .routers import (
    chat_router,
    conversations_router,
    documents_router,
    search_router,
    system_router
)
from .services.llm import get_llm_service
from .services.rag import get_rag_pipeline


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
    
    # Shutdown
    print(f"Shutting down {settings.brand_name}...")


# Create FastAPI app
app = FastAPI(
    title=settings.brand_name,
    description="Local AI Assistant with RAG and Web Search",
    version="2.0.0",
    lifespan=lifespan,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, restrict this
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Global exception handler."""
    return JSONResponse(
        status_code=500,
        content={
            "error": "Internal server error",
            "detail": str(exc) if settings.debug else "An unexpected error occurred"
        }
    )


# Include API routers
app.include_router(chat_router)
app.include_router(conversations_router)
app.include_router(documents_router)
app.include_router(search_router)
app.include_router(system_router)


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
    
    # Try to serve static file
    static_file = frontend_path / full_path
    if static_file.exists() and static_file.is_file():
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
