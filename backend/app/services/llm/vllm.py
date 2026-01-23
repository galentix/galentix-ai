"""
Galentix AI - vLLM Service
High-performance GPU inference via vLLM (OpenAI-compatible API).
"""
import httpx
import json
from typing import AsyncGenerator, List, Optional
from .base import BaseLLMService, LLMMessage, LLMResponse


class VLLMService(BaseLLMService):
    """vLLM-based LLM service with OpenAI-compatible API."""
    
    def __init__(self, model: str = "mistralai/Mistral-7B-Instruct-v0.2", base_url: str = "http://127.0.0.1:8000"):
        super().__init__(model, base_url)
    
    @property
    def engine_name(self) -> str:
        return "vllm"
    
    async def health_check(self) -> bool:
        """Check if vLLM server is available."""
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(f"{self.base_url}/health")
                return response.status_code == 200
        except Exception:
            # Try OpenAI-compatible endpoint
            try:
                async with httpx.AsyncClient(timeout=5.0) as client:
                    response = await client.get(f"{self.base_url}/v1/models")
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
        """Generate a response using vLLM's OpenAI-compatible API."""
        
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
                response = await client.post(
                    f"{self.base_url}/v1/chat/completions",
                    json={
                        "model": self.model,
                        "messages": api_messages,
                        "temperature": temperature,
                        "max_tokens": max_tokens,
                        "stream": False
                    }
                )
                
                if response.status_code == 200:
                    data = response.json()
                    choice = data.get("choices", [{}])[0]
                    message = choice.get("message", {})
                    usage = data.get("usage", {})
                    
                    return LLMResponse(
                        content=message.get("content", ""),
                        model=self.model,
                        tokens_used=usage.get("total_tokens", 0),
                        finish_reason=choice.get("finish_reason", "stop")
                    )
                else:
                    return LLMResponse(
                        content=f"Error: vLLM returned status {response.status_code}",
                        model=self.model,
                        finish_reason="error"
                    )
        except Exception as e:
            return LLMResponse(
                content=f"Error connecting to vLLM: {str(e)}",
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
