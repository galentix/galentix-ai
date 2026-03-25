"""
Galentix AI - Embeddings Service
Generates embeddings for text using multiple backends.
"""
from typing import List, Optional, Dict, Any
from enum import Enum
import asyncio
import httpx
from ...config import settings


class EmbeddingBackend(Enum):
    """Available embedding backends."""
    OLLAMA = "ollama"
    SENTENCE_TRANSFORMERS = "sentence_transformers"


EMBEDDING_MODELS = {
    "ollama": {
        "nomic-embed-text": 768,
        "mxbai-embed-large": 1024,
        "snowflake-arctic-embed": 1024,
        "bge-m3": 1024,
    },
    "sentence_transformers": {
        "BAAI/bge-small-en-v1.5": 384,
        "BAAI/bge-base-en-v1.5": 768,
        "BAAI/bge-large-en-v1.5": 1024,
        "BAAI/bge-m3": 1024,
        "sentence-transformers/all-MiniLM-L6-v2": 384,
        "intfloat/e5-small-v2": 384,
        "intfloat/e5-base-v2": 768,
    }
}


class EmbeddingsService:
    """
    Generates text embeddings using multiple backends.
    Supports Ollama and Sentence Transformers.
    """
    
    def __init__(
        self,
        model: str = "nomic-embed-text",
        base_url: str = "http://127.0.0.1:11434",
        backend: str = "ollama",
        batch_size: int = 32,
        device: Optional[str] = None
    ):
        self.model = model
        self.base_url = base_url
        self.backend = EmbeddingBackend(backend)
        self.batch_size = batch_size
        self.device = device
        self._dimension: Optional[int] = None
        self._st_model = None
    
    async def get_embedding(self, text: str) -> List[float]:
        """Get embedding for a single text."""
        if not text or not text.strip():
            return []
        
        if self.backend == EmbeddingBackend.OLLAMA:
            return await self._get_ollama_embedding(text)
        else:
            return await self._get_st_embedding(text)
    
    async def get_embeddings_batch(self, texts: List[str]) -> List[List[float]]:
        """Get embeddings for multiple texts with batching."""
        if not texts:
            return []
        
        texts = [t.strip() if t else "" for t in texts]
        
        if self.backend == EmbeddingBackend.OLLAMA:
            return await self._get_ollama_batch(texts)
        else:
            return await self._get_st_batch(texts)
    
    async def _get_ollama_embedding(self, text: str) -> List[float]:
        """Get embedding from Ollama."""
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(
                    f"{self.base_url}/api/embeddings",
                    json={
                        "model": self.model,
                        "prompt": text
                    }
                )
                
                if response.status_code == 200:
                    data = response.json()
                    embedding = data.get("embedding", [])
                    
                    if embedding and self._dimension is None:
                        self._dimension = len(embedding)
                    
                    return embedding
                else:
                    print(f"Ollama embedding error: {response.status_code}")
                    return []
        except Exception as e:
            print(f"Ollama embedding exception: {e}")
            return []
    
    async def _get_ollama_batch(self, texts: List[str]) -> List[List[float]]:
        """Get embeddings from Ollama in batch."""
        tasks = [self._get_ollama_embedding(text) for text in texts]
        embeddings = await asyncio.gather(*tasks)
        return embeddings
    
    async def _get_st_embedding(self, text: str) -> List[float]:
        """Get embedding from Sentence Transformers."""
        if self._st_model is None:
            await self._load_st_model()
        
        if self._st_model is None:
            return []
        
        try:
            import numpy as np
            embedding = self._st_model.encode(text, convert_to_numpy=True)
            result = embedding.tolist()
            
            if result and self._dimension is None:
                self._dimension = len(result)
            
            return result
        except Exception as e:
            print(f"Sentence Transformers error: {e}")
            return []
    
    async def _get_st_batch(self, texts: List[str]) -> List[List[float]]:
        """Get embeddings from Sentence Transformers in batch."""
        if self._st_model is None:
            await self._load_st_model()
        
        if self._st_model is None:
            return [[]] * len(texts)
        
        try:
            import numpy as np
            embeddings = self._st_model.encode(
                texts,
                batch_size=self.batch_size,
                convert_to_numpy=True,
                show_progress_bar=False
            )
            
            if hasattr(embeddings, 'tolist'):
                result = embeddings.tolist()
            else:
                result = [emb.tolist() for emb in embeddings]
            
            if result and self._dimension is None:
                self._dimension = len(result[0]) if result[0] else 0
            
            return result
        except Exception as e:
            print(f"Sentence Transformers batch error: {e}")
            return [[]] * len(texts)
    
    async def _load_st_model(self):
        """Load Sentence Transformers model."""
        try:
            from sentence_transformers import SentenceTransformer
            
            device = self.device or "cpu"
            self._st_model = SentenceTransformer(self.model, device=device)
            
            # Get dimension
            self._dimension = self._st_model.get_sentence_embedding_dimension()
        except Exception as e:
            print(f"Failed to load Sentence Transformers model: {e}")
            self._st_model = None
    
    @property
    def dimension(self) -> int:
        """Get the embedding dimension."""
        if self._dimension:
            return self._dimension
        
        # Try to get from known models
        for backend_models in EMBEDDING_MODELS.values():
            if self.model in backend_models:
                return backend_models[self.model]
        
        return 768
    
    def get_available_models(self, backend: Optional[str] = None) -> Dict[str, int]:
        """Get available embedding models."""
        if backend:
            return EMBEDDING_MODELS.get(backend, {})
        return {k: v for models in EMBEDDING_MODELS.values() for k, v in models.items()}
    
    async def health_check(self) -> bool:
        """Check if embedding service is available."""
        if self.backend == EmbeddingBackend.OLLAMA:
            return await self._health_check_ollama()
        else:
            return await self._health_check_st()
    
    async def _health_check_ollama(self) -> bool:
        """Check if Ollama is available."""
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(f"{self.base_url}/api/tags")
                if response.status_code == 200:
                    data = response.json()
                    models = [m["name"] for m in data.get("models", [])]
                    return any(self.model in m for m in models)
                return False
        except Exception:
            return False
    
    async def _health_check_st(self) -> bool:
        """Check if Sentence Transformers is available."""
        try:
            if self._st_model is None:
                await self._load_st_model()
            return self._st_model is not None
        except Exception:
            return False


_ollama_service: Optional[EmbeddingsService] = None
_st_service: Optional[EmbeddingsService] = None


def get_embeddings_service(
    model: Optional[str] = None,
    backend: Optional[str] = None
) -> EmbeddingsService:
    """Get or create the embeddings service."""
    model = model or settings.embedding_model
    backend = backend or "ollama"
    
    global _ollama_service, _st_service
    
    if backend == "sentence_transformers":
        if _st_service is None or _st_service.model != model:
            _st_service = EmbeddingsService(
                model=model,
                backend=backend,
                base_url=settings.ollama_url
            )
        return _st_service
    else:
        if _ollama_service is None or _ollama_service.model != model:
            _ollama_service = EmbeddingsService(
                model=model,
                backend=backend,
                base_url=settings.ollama_url
            )
        return _ollama_service
