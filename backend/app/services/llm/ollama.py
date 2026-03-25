"""
Galentix AI - Ollama LLM Service
Supports CPU and GPU inference via Ollama.
"""
import httpx
import json
import asyncio
import time
import logging
from typing import AsyncGenerator, List, Optional
from .base import BaseLLMService, LLMMessage, LLMResponse
from .retry import RetryConfig, async_retry

logger = logging.getLogger(__name__)


class OllamaService(BaseLLMService):
    """Ollama-based LLM service."""
    
    def __init__(self, model: str = "tinyllama", base_url: str = "http://127.0.0.1:11434"):
        super().__init__(model, base_url)
        self.embedding_model = "nomic-embed-text"
        self._retry_config = RetryConfig(max_retries=3, initial_delay=1.0)
    
    @property
    def engine_name(self) -> str:
        return "ollama"
    
    async def health_check(self) -> bool:
        """Check if Ollama is available."""
        cached = self._cached_health_check()
        if cached:
            return True
        
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(f"{self.base_url}/api/tags")
                result = response.status_code == 200
                self._update_health_cache(result)
                return result
        except Exception:
            return False
    
    async def _make_request(
        self,
        messages: List[dict],
        temperature: float,
        max_tokens: int,
        stream: bool = False
    ) -> dict:
        """Make request to Ollama with retry logic."""
        max_retries = 3
        last_error = None
        
        for attempt in range(max_retries):
            try:
                async with httpx.AsyncClient(timeout=120.0) as client:
                    response = await client.post(
                        f"{self.base_url}/api/chat",
                        json={
                            "model": self.model,
                            "messages": messages,
                            "stream": stream,
                            "options": {
                                "temperature": temperature,
                                "num_predict": max_tokens
                            }
                        }
                    )
                    
                    if response.status_code == 200:
                        return {"success": True, "data": response.json()}
                    else:
                        last_error = f"Ollama returned status {response.status_code}"
                        if attempt < max_retries - 1:
                            await asyncio.sleep(1 * (attempt + 1))
                        continue
                        
            except httpx.TimeoutException as e:
                last_error = f"Request timeout: {str(e)}"
                if attempt < max_retries - 1:
                    await asyncio.sleep(2 * (attempt + 1))
            except httpx.ConnectError as e:
                last_error = f"Connection error: {str(e)}"
                if attempt < max_retries - 1:
                    await asyncio.sleep(1 * (attempt + 1))
            except Exception as e:
                last_error = str(e)
                break
        
        return {"success": False, "error": last_error}
    
    async def generate(
        self,
        messages: List[LLMMessage],
        temperature: float = 0.7,
        max_tokens: int = 2048,
        system_prompt: Optional[str] = None
    ) -> LLMResponse:
        """Generate a response using Ollama."""
        start_time = time.time()
        
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
        
        result = await self._make_request(ollama_messages, temperature, max_tokens)
        
        latency_ms = (time.time() - start_time) * 1000
        
        if result["success"]:
            data = result["data"]
            return LLMResponse(
                content=data.get("message", {}).get("content", ""),
                model=self.model,
                tokens_used=data.get("eval_count", 0),
                finish_reason="stop",
                latency_ms=latency_ms
            )
        else:
            return LLMResponse(
                content=f"Error: {result['error']}",
                model=self.model,
                finish_reason="error",
                latency_ms=latency_ms,
                error=result["error"]
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
            async with httpx.AsyncClient(timeout=120.0) as client:
                async with client.stream(
                    "POST",
                    f"{self.base_url}/api/chat",
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
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    f"{self.base_url}/api/embeddings",
                    json={
                        "model": self.embedding_model,
                        "prompt": text
                    }
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
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(f"{self.base_url}/api/tags")
                
                if response.status_code == 200:
                    data = response.json()
                    return [m["name"] for m in data.get("models", [])]
                return []
        except Exception:
            return []
    
    async def pull_model(self, model_name: str) -> bool:
        """Pull a model from Ollama registry."""
        try:
            async with httpx.AsyncClient(timeout=3600.0) as client:
                # Use streaming to avoid timeout on large model downloads
                async with client.stream(
                    "POST",
                    f"{self.base_url}/api/pull",
                    json={"name": model_name, "stream": True}
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
            async with httpx.AsyncClient(timeout=3600.0) as client:
                async with client.stream(
                    "POST",
                    f"{self.base_url}/api/pull",
                    json={"name": model_name, "stream": True}
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
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.delete(
                    f"{self.base_url}/api/delete",
                    json={"name": model_name}
                )
                return response.status_code == 200
        except Exception:
            return False
