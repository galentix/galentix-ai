"""
Galentix AI - Search Router
Web search endpoints.
"""
from fastapi import APIRouter, Depends, HTTPException, Request
from ..models.user import User
from ..models.schemas import WebSearchRequest, WebSearchResponse, WebSearchResult
from ..services.websearch import get_search_service
from ..services.auth import get_current_user
from ..config import settings
from ..rate_limit import limiter

router = APIRouter(prefix="/api/search", tags=["search"])


@router.post("/", response_model=WebSearchResponse)
@limiter.limit("60/minute")
async def search_web(
    request: WebSearchRequest,
    http_request: Request,
    current_user: User = Depends(get_current_user)
):
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
@limiter.limit("60/minute")
async def search_status(
    request: Request,
    current_user: User = Depends(get_current_user)
):
    """Check web search service status."""
    search = get_search_service()
    is_available = await search.health_check()

    return {
        "enabled": settings.search_enabled,
        "available": is_available,
        "url": settings.searxng_url if is_available else None
    }
