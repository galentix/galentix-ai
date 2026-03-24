"""
Galentix AI - Embeddings Service
Generates embeddings for text using local models.
"""
import asyncio
from typing import List, Optional
import httpx
from ...config import settings


class EmbeddingsService:
    """
    Generates text embeddings using Ollama's embedding models.
    Used for RAG document indexing and query embedding.
    """

    def __init__(
        self,
        model: str = "nomic-embed-text",
        base_url: str = "http://127.0.0.1:11434"
    ):
        self.model = model
        self.base_url = base_url
        self._dimension: Optional[int] = None
        self._client = httpx.AsyncClient(base_url=base_url, timeout=60.0)

    async def close(self):
        """Close the persistent HTTP client."""
        await self._client.aclose()
    
    async def get_embedding(self, text: str) -> List[float]:
        """Get embedding for a single text."""
        if not text or not text.strip():
            return []
        
        try:
            response = await self._client.post(
                "/api/embeddings",
                json={
                    "model": self.model,
                    "prompt": text
                }
            )

            if response.status_code == 200:
                data = response.json()
                embedding = data.get("embedding", [])

                # Cache dimension
                if embedding and self._dimension is None:
                    self._dimension = len(embedding)

                return embedding
            else:
                print(f"Embedding error: {response.status_code}")
                return []
        except Exception as e:
            print(f"Embedding exception: {e}")
            return []
    
    async def get_embeddings_batch(self, texts: List[str]) -> List[List[float]]:
        """Get embeddings for multiple texts concurrently.

        Uses a semaphore to cap parallelism at 10 concurrent requests
        so we don't overwhelm the local Ollama instance.
        """
        semaphore = asyncio.Semaphore(10)

        async def _embed_with_limit(text: str) -> List[float]:
            async with semaphore:
                return await self.get_embedding(text)

        return await asyncio.gather(*[_embed_with_limit(t) for t in texts])
    
    @property
    def dimension(self) -> int:
        """Get the embedding dimension (after first embedding is generated)."""
        return self._dimension or 768  # Default for nomic-embed-text
    
    async def health_check(self) -> bool:
        """Check if embedding service is available."""
        try:
            response = await self._client.get("/api/tags", timeout=5.0)
            if response.status_code == 200:
                data = response.json()
                models = [m["name"] for m in data.get("models", [])]
                # Check if embedding model is available
                return any(self.model in m for m in models)
            return False
        except Exception:
            return False


# Global instance
_embeddings_service: Optional[EmbeddingsService] = None


def get_embeddings_service() -> EmbeddingsService:
    """Get or create the embeddings service."""
    global _embeddings_service
    if _embeddings_service is None:
        _embeddings_service = EmbeddingsService(
            model=settings.embedding_model,
            base_url=settings.ollama_url
        )
    return _embeddings_service
