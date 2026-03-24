"""
Galentix AI - Web Search Service
Integrates with SearXNG for privacy-focused web search.
"""
import httpx
from typing import List, Optional, Dict, Any
from dataclasses import dataclass
from ..config import settings


@dataclass
class SearchResult:
    """A single search result."""
    title: str
    url: str
    snippet: str
    source: str


class WebSearchService:
    """
    Web search service using SearXNG.
    Provides privacy-focused web search capabilities.
    """

    def __init__(
        self,
        base_url: str = "http://127.0.0.1:8888",
        max_results: int = 5
    ):
        self.base_url = base_url
        self.max_results = max_results
        self._client = httpx.AsyncClient(base_url=base_url, timeout=30.0)

    async def close(self):
        """Close the persistent HTTP client."""
        await self._client.aclose()
    
    async def search(
        self,
        query: str,
        max_results: Optional[int] = None,
        categories: Optional[List[str]] = None,
        language: Optional[str] = None
    ) -> List[SearchResult]:
        """
        Search the web using SearXNG.

        Args:
            query: Search query
            max_results: Maximum number of results to return
            categories: Categories to search (general, images, news, etc.)
            language: Search language ("en", "ar", "all"). Defaults to settings.search_language.

        Returns:
            List of search results
        """
        if not query or not query.strip():
            return []

        max_results = max_results or self.max_results
        categories = categories or ["general"]
        language = language or settings.search_language

        try:
            response = await self._client.get(
                "/search",
                params={
                    "q": query,
                    "format": "json",
                    "categories": ",".join(categories),
                    "language": language,
                    "safesearch": 0
                }
            )

            if response.status_code == 200:
                data = response.json()
                results = []

                for item in data.get("results", [])[:max_results]:
                    results.append(SearchResult(
                        title=item.get("title", ""),
                        url=item.get("url", ""),
                        snippet=item.get("content", ""),
                        source=item.get("engine", "unknown")
                    ))

                return results
            else:
                print(f"Search error: {response.status_code}")
                return []
        except Exception as e:
            print(f"Search exception: {e}")
            return []
    
    async def search_and_summarize(
        self,
        query: str,
        max_results: int = 5
    ) -> Dict[str, Any]:
        """
        Search and return formatted results for LLM context.
        """
        results = await self.search(query, max_results=max_results)
        
        if not results:
            return {
                "query": query,
                "results": [],
                "context": "No search results found."
            }
        
        # Build context for LLM
        context_parts = []
        result_dicts = []
        
        for i, result in enumerate(results, 1):
            context_parts.append(
                f"[{i}] {result.title}\n"
                f"URL: {result.url}\n"
                f"{result.snippet}"
            )
            result_dicts.append({
                "title": result.title,
                "url": result.url,
                "snippet": result.snippet,
                "source": result.source
            })
        
        context = "\n\n".join(context_parts)
        
        return {
            "query": query,
            "results": result_dicts,
            "context": context
        }
    
    async def health_check(self) -> bool:
        """Check if SearXNG is available."""
        try:
            response = await self._client.get("/healthz", timeout=5.0)
            if response.status_code == 200:
                return True
            # Fallback check
            response = await self._client.get("/", timeout=5.0)
            return response.status_code == 200
        except Exception:
            return False


# Global instance
_search_service: Optional[WebSearchService] = None


def get_search_service() -> WebSearchService:
    """Get or create the web search service."""
    global _search_service
    if _search_service is None:
        _search_service = WebSearchService(
            base_url=settings.searxng_url,
            max_results=settings.search_max_results
        )
    return _search_service
