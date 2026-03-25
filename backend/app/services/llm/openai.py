"""
Galentix AI - OpenAI LLM Service
Supports OpenAI API (GPT-4, GPT-3.5) and compatible endpoints.
"""
import httpx
import json
import asyncio
from typing import AsyncGenerator, List, Optional
from .base import BaseLLMService, LLMMessage, LLMResponse


class OpenAIService(BaseLLMService):
    """OpenAI-compatible LLM service."""
    
    def __init__(
        self,
        model: str = "gpt-3.5-turbo",
        base_url: str = "https://api.openai.com/v1",
        api_key: Optional[str] = None,
        organization: Optional[str] = None
    ):
        super().__init__(model, base_url)
        self.api_key = api_key
        self.organization = organization
        self._headers = {
            "Content-Type": "application/json"
        }
        if api_key:
            self._headers["Authorization"] = f"Bearer {api_key}"
        if organization:
            self._headers["OpenAI-Organization"] = organization
    
    @property
    def engine_name(self) -> str:
        return "openai"
    
    async def health_check(self) -> bool:
        """Check if OpenAI API is available."""
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(
                    f"{self.base_url}/models",
                    headers=self._headers
                )
                return response.status_code == 200
        except Exception:
            return False
    
    async def _make_request(
        self,
        client: httpx.AsyncClient,
        endpoint: str,
        json_data: dict,
        timeout: float = 120.0
    ) -> httpx.Response:
        """Make a request with retry logic."""
        max_retries = 3
        retry_delay = 1.0
        
        for attempt in range(max_retries):
            try:
                response = await client.post(
                    f"{self.base_url}{endpoint}",
                    json=json_data,
                    headers=self._headers,
                    timeout=timeout
                )
                return response
            except (httpx.ConnectError, httpx.TimeoutException) as e:
                if attempt < max_retries - 1:
                    await asyncio.sleep(retry_delay * (attempt + 1))
                else:
                    raise
    
    def _build_messages(
        self,
        messages: List[LLMMessage],
        system_prompt: Optional[str] = None
    ) -> List[dict]:
        """Build messages for OpenAI API."""
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
        
        return api_messages
    
    async def generate(
        self,
        messages: List[LLMMessage],
        temperature: float = 0.7,
        max_tokens: int = 2048,
        system_prompt: Optional[str] = None
    ) -> LLMResponse:
        """Generate a response using OpenAI API."""
        api_messages = self._build_messages(messages, system_prompt)
        
        try:
            async with httpx.AsyncClient(timeout=120.0) as client:
                response = await self._make_request(
                    client,
                    "/chat/completions",
                    {
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
                    error_msg = f"OpenAI API error: {response.status_code}"
                    try:
                        error_data = response.json()
                        error_msg += f" - {error_data.get('error', {}).get('message', '')}"
                    except Exception:
                        pass
                    return LLMResponse(
                        content=error_msg,
                        model=self.model,
                        finish_reason="error"
                    )
        except Exception as e:
            return LLMResponse(
                content=f"Error connecting to OpenAI: {str(e)}",
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
        """Generate a streaming response using OpenAI API."""
        api_messages = self._build_messages(messages, system_prompt)
        
        try:
            async with httpx.AsyncClient(timeout=120.0) as client:
                async with client.stream(
                    "POST",
                    f"{self.base_url}/chat/completions",
                    json={
                        "model": self.model,
                        "messages": api_messages,
                        "temperature": temperature,
                        "max_tokens": max_tokens,
                        "stream": True
                    },
                    headers=self._headers
                ) as response:
                    async for line in response.aiter_lines():
                        if line.startswith("data: "):
                            data_str = line[6:]
                            
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
        """Get embeddings using OpenAI's embedding API."""
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    f"{self.base_url}/embeddings",
                    json={
                        "model": "text-embedding-3-small",
                        "input": text
                    },
                    headers=self._headers
                )
                
                if response.status_code == 200:
                    data = response.json()
                    embeddings = data.get("data", [])
                    if embeddings:
                        return embeddings[0].get("embedding", [])
                return []
        except Exception:
            return []
    
    async def list_models(self) -> List[str]:
        """List available models from OpenAI."""
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(
                    f"{self.base_url}/models",
                    headers=self._headers
                )
                
                if response.status_code == 200:
                    data = response.json()
                    return [m["id"] for m in data.get("data", [])]
                return []
        except Exception:
            return []
