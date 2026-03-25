"""
Galentix AI - vLLM Service
High-performance GPU inference via vLLM (OpenAI-compatible API).
"""
import httpx
import json
import asyncio
import time
import logging
from typing import AsyncGenerator, List, Optional
from .base import BaseLLMService, LLMMessage, LLMResponse

logger = logging.getLogger(__name__)


class VLLMService(BaseLLMService):
    """vLLM-based LLM service with OpenAI-compatible API."""
    
    def __init__(self, model: str = "mistralai/Mistral-7B-Instruct-v0.2", base_url: str = "http://127.0.0.1:8000"):
        super().__init__(model, base_url)
    
    @property
    def engine_name(self) -> str:
        return "vllm"
    
    async def health_check(self) -> bool:
        """Check if vLLM server is available."""
        cached = self._cached_health_check()
        if cached:
            return True
        
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(f"{self.base_url}/health")
                result = response.status_code == 200
                self._update_health_cache(result)
                return result
        except Exception:
            try:
                async with httpx.AsyncClient(timeout=5.0) as client:
                    response = await client.get(f"{self.base_url}/v1/models")
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
        """Make request to vLLM with retry logic."""
        max_retries = 3
        last_error = None
        
        for attempt in range(max_retries):
            try:
                async with httpx.AsyncClient(timeout=120.0) as client:
                    response = await client.post(
                        f"{self.base_url}/v1/chat/completions",
                        json={
                            "model": self.model,
                            "messages": messages,
                            "temperature": temperature,
                            "max_tokens": max_tokens,
                            "stream": stream
                        }
                    )
                    
                    if response.status_code == 200:
                        return {"success": True, "data": response.json()}
                    else:
                        try:
                            error_data = response.json()
                            last_error = f"vLLM error: {response.status_code} - {error_data.get('error', {}).get('message', 'Unknown error')}"
                        except Exception:
                            last_error = f"vLLM returned status {response.status_code}"
                        
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
        """Generate a response using vLLM's OpenAI-compatible API."""
        start_time = time.time()
        
        api_messages = []
        
        if system_prompt:
            api_messages.append({
                "role": "system",
                "content": system_prompt
            })
        
        for msg in messages:
            api_messages.append({
                "role": msg.role,
                "content": msg.content
            })
        
        result = await self._make_request(api_messages, temperature, max_tokens)
        
        latency_ms = (time.time() - start_time) * 1000
        
        if result["success"]:
            data = result["data"]
            choice = data.get("choices", [{}])[0]
            message = choice.get("message", {})
            usage = data.get("usage", {})
            
            return LLMResponse(
                content=message.get("content", ""),
                model=self.model,
                tokens_used=usage.get("total_tokens", 0),
                finish_reason=choice.get("finish_reason", "stop"),
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
        """Generate a streaming response using vLLM."""
        
        # Build messages for OpenAI-compatible API
        api_messages = []
        
        if system_prompt:
            api_messages.append({
                "role": "system",
                "content": system_prompt
            })
        
        for msg in messages:
            api_messages.append({
                "role": msg.role,
                "content": msg.content
            })
        
        try:
            async with httpx.AsyncClient(timeout=120.0) as client:
                async with client.stream(
                    "POST",
                    f"{self.base_url}/v1/chat/completions",
                    json={
                        "model": self.model,
                        "messages": api_messages,
                        "temperature": temperature,
                        "max_tokens": max_tokens,
                        "stream": True
                    }
                ) as response:
                    async for line in response.aiter_lines():
                        if line.startswith("data: "):
                            data_str = line[6:]  # Remove "data: " prefix
                            
                            if data_str.strip() == "[DONE]":
                                break
                            
                            try:
                                data = json.loads(data_str)
                                choices = data.get("choices", [])
                                if choices:
                                    delta = choices[0].get("delta", {})
                                    content = delta.get("content", "")
                                    if content:
                                        yield content
                            except json.JSONDecodeError:
                                continue
        except Exception as e:
            yield f"\n\nError: {str(e)}"
    
    async def get_embeddings(self, text: str) -> List[float]:
        """Get embeddings using vLLM's embedding endpoint.
        
        Note: vLLM embedding support varies by version.
        Falls back to empty list if not available.
        """
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    f"{self.base_url}/v1/embeddings",
                    json={
                        "model": self.model,
                        "input": text
                    }
                )
                
                if response.status_code == 200:
                    data = response.json()
                    embeddings = data.get("data", [])
                    if embeddings:
                        return embeddings[0].get("embedding", [])
                return []
        except Exception:
            return []
    
    async def get_model_info(self) -> dict:
        """Get information about the loaded model."""
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(f"{self.base_url}/v1/models")
                
                if response.status_code == 200:
                    data = response.json()
                    models = data.get("data", [])
                    if models:
                        return models[0]
                return {}
        except Exception:
            return {}
