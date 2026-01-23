"""
Galentix AI - Search Router
Web search endpoints.
"""
from fastapi import APIRouter, HTTPException
from ..models.schemas import WebSearchRequest, WebSearchResponse, WebSearchResult
from ..services.websearch import get_search_service
from ..config import settings

router = APIRouter(prefix="/api/search", tags=["search"])


@router.post("/", response_model=WebSearchResponse)
async def search_web(request: WebSearchRequest):
    """Search the web using SearXNG."""
    if not settings.search_enabled:
        raise HTTPException(status_code=503, detail="Web search is disabled")
    
    search = get_search_service()
    results = await search.search(
        query=request.query,
        max_results=request.max_results
    )
    
    return WebSearchResponse(
        query=request.query,
        results=[
            WebSearchResult(
                title=r.title,
                url=r.url,
                snippet=r.snippet,
                source=r.source
            )
            for r in results
        ],
        total=len(results)
    )


@router.get("/status")
async def search_status():
    """Check web search service status."""
    search = get_search_service()
    is_available = await search.health_check()
    
    return {
        "enabled": settings.search_enabled,
        "available": is_available,
        "url": settings.searxng_url if is_available else None
    }
