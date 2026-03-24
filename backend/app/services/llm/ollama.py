"""
Galentix AI - Ollama LLM Service
Supports CPU and GPU inference via Ollama.
"""
import httpx
import json
from typing import AsyncGenerator, List, Optional
from .base import BaseLLMService, LLMMessage, LLMResponse


class OllamaService(BaseLLMService):
    """Ollama-based LLM service."""

    def __init__(self, model: str = "tinyllama", base_url: str = "http://127.0.0.1:11434"):
        super().__init__(model, base_url)
        self.embedding_model = "nomic-embed-text"
        self._client = httpx.AsyncClient(base_url=base_url, timeout=120.0)

    async def close(self):
        """Close the persistent HTTP client."""
        await self._client.aclose()
    
    @property
    def engine_name(self) -> str:
        return "ollama"
    
    async def health_check(self) -> bool:
        """Check if Ollama is available."""
        try:
            response = await self._client.get("/api/tags", timeout=5.0)
            return response.status_code == 200
        except Exception:
            return False
    
    async def generate(
        self,
        messages: List[LLMMessage],
        temperature: float = 0.7,
        max_tokens: int = 2048,
        system_prompt: Optional[str] = None
    ) -> LLMResponse:
        """Generate a response using Ollama."""
        
        # Build messages for Ollama chat API
        ollama_messages = []
        
        if system_prompt:
            ollama_messages.append({
                "role": "system",
                "content": system_prompt
            })
        
        for msg in messages:
            ollama_messages.append({
                "role": msg.role,
                "content": msg.content
            })
        
        try:
            response = await self._client.post(
                "/api/chat",
                json={
                    "model": self.model,
                    "messages": ollama_messages,
                    "stream": False,
                    "options": {
                        "temperature": temperature,
                        "num_predict": max_tokens
                    }
                }
            )

            if response.status_code == 200:
                data = response.json()
                return LLMResponse(
                    content=data.get("message", {}).get("content", ""),
                    model=self.model,
                    tokens_used=data.get("eval_count", 0),
                    finish_reason="stop"
                )
            else:
                return LLMResponse(
                    content=f"Error: Ollama returned status {response.status_code}",
                    model=self.model,
                    finish_reason="error"
                )
        except Exception as e:
            return LLMResponse(
                content=f"Error connecting to Ollama: {str(e)}",
                model=self.model,
                finish_reason="error"
            )
    
    async def generate_stream(
        self,
        messages: List[LLMMessage],
        temperature: float = 0.7,
        max_tokens: int = 2048,
        system_prompt: Optional[str] = None
    ) -> AsyncGenerator[str, None]:
        """Generate a streaming response using Ollama."""
        
        # Build messages for Ollama chat API
        ollama_messages = []
        
        if system_prompt:
            ollama_messages.append({
                "role": "system",
                "content": system_prompt
            })
        
        for msg in messages:
            ollama_messages.append({
                "role": msg.role,
                "content": msg.content
            })
        
        try:
            async with self._client.stream(
                "POST",
                "/api/chat",
                json={
                    "model": self.model,
                    "messages": ollama_messages,
                    "stream": True,
                    "options": {
                        "temperature": temperature,
                        "num_predict": max_tokens
                    }
                }
            ) as response:
                async for line in response.aiter_lines():
                    if line:
                        try:
                            data = json.loads(line)
                            if "message" in data and "content" in data["message"]:
                                yield data["message"]["content"]
                            if data.get("done", False):
                                break
                        except json.JSONDecodeError:
                            continue
        except Exception as e:
            yield f"\n\nError: {str(e)}"
    
    async def get_embeddings(self, text: str) -> List[float]:
        """Get embeddings using Ollama's embedding model."""
        try:
            response = await self._client.post(
                "/api/embeddings",
                json={
                    "model": self.embedding_model,
                    "prompt": text
                },
                timeout=30.0
            )

            if response.status_code == 200:
                data = response.json()
                return data.get("embedding", [])
            else:
                return []
        except Exception:
            return []
    
    async def list_models(self) -> List[str]:
        """List available models in Ollama."""
        try:
            response = await self._client.get("/api/tags", timeout=10.0)

            if response.status_code == 200:
                data = response.json()
                return [m["name"] for m in data.get("models", [])]
            return []
        except Exception:
            return []
    
    async def pull_model(self, model_name: str) -> bool:
        """Pull a model from Ollama registry."""
        try:
            # Use streaming to avoid timeout on large model downloads
            async with self._client.stream(
                "POST",
                "/api/pull",
                json={"name": model_name, "stream": True},
                timeout=3600.0
            ) as response:
                if response.status_code != 200:
                    return False
                # Consume the stream to completion
                async for line in response.aiter_lines():
                    if line:
                        try:
                            data = json.loads(line)
                            if data.get("status") == "success":
                                return True
                        except json.JSONDecodeError:
                            continue
                return True
        except Exception:
            return False

    async def pull_model_stream(self, model_name: str):
        """Pull a model and yield progress updates."""
        try:
            async with self._client.stream(
                "POST",
                "/api/pull",
                json={"name": model_name, "stream": True},
                timeout=3600.0
            ) as response:
                if response.status_code != 200:
                    yield {"status": "error", "message": "Failed to start download"}
                    return
                async for line in response.aiter_lines():
                    if line:
                        try:
                            data = json.loads(line)
                            progress = {}
                            progress["status"] = data.get("status", "")
                            if "total" in data and "completed" in data:
                                progress["total"] = data["total"]
                                progress["completed"] = data["completed"]
                                if data["total"] > 0:
                                    progress["percent"] = round(data["completed"] / data["total"] * 100, 1)
                            yield progress
                            if data.get("status") == "success":
                                return
                        except json.JSONDecodeError:
                            continue
        except Exception as e:
            yield {"status": "error", "message": str(e)}

    async def delete_model(self, model_name: str) -> bool:
        """Delete a model from Ollama."""
        try:
            response = await self._client.delete(
                "/api/delete",
                json={"name": model_name},
                timeout=30.0
            )
            return response.status_code == 200
        except Exception:
            return False
