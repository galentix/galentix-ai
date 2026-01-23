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
    
    @property
    def engine_name(self) -> str:
        return "ollama"
    
    async def health_check(self) -> bool:
        """Check if Ollama is available."""
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(f"{self.base_url}/api/tags")
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
            async with httpx.AsyncClient(timeout=120.0) as client:
                response = await client.post(
                    f"{self.base_url}/api/chat",
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
            async with httpx.AsyncClient(timeout=600.0) as client:
                response = await client.post(
                    f"{self.base_url}/api/pull",
                    json={"name": model_name, "stream": False}
                )
                return response.status_code == 200
        except Exception:
            return False
