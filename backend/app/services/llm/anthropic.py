"""
Galentix AI - Anthropic LLM Service
Supports Claude API (Claude 3.5, Claude 3, etc.).
"""
import httpx
import json
import asyncio
from typing import AsyncGenerator, List, Optional
from .base import BaseLLMService, LLMMessage, LLMResponse


class AnthropicService(BaseLLMService):
    """Anthropic Claude LLM service."""
    
    ANTHROPIC_BASE_URL = "https://api.anthropic.com/v1"
    
    def __init__(
        self,
        model: str = "claude-3-haiku-20240307",
        api_key: Optional[str] = None,
        max_tokens: int = 1024
    ):
        base_url = self.ANTHROPIC_BASE_URL
        super().__init__(model, base_url)
        self.api_key = api_key
        self.default_max_tokens = max_tokens
        self._headers = {
            "Content-Type": "application/json",
            "anthropic-version": "2023-06-01"
        }
        if api_key:
            self._headers["x-api-key"] = api_key
    
    @property
    def engine_name(self) -> str:
        return "anthropic"
    
    async def health_check(self) -> bool:
        """Check if Anthropic API is available."""
        if not self.api_key:
            return False
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(
                    f"{self.base_url}/messages",
                    headers=self._headers,
                    json={"max_tokens": 1, "model": self.model, "messages": [{"role": "user", "content": "hi"}]}
                )
                return response.status_code in (200, 400, 422)
        except Exception:
            return False
    
    def _build_messages(
        self,
        messages: List[LLMMessage],
        system_prompt: Optional[str] = None
    ) -> List[dict]:
        """Build messages for Anthropic API."""
        api_messages = []
        
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
        """Generate a response using Anthropic API."""
        if max_tokens <= 0:
            max_tokens = self.default_max_tokens
        
        api_messages = self._build_messages(messages, system_prompt)
        
        request_data = {
            "model": self.model,
            "messages": api_messages,
            "max_tokens": max_tokens,
            "temperature": temperature
        }
        
        if system_prompt:
            request_data["system"] = system_prompt
        
        try:
            async with httpx.AsyncClient(timeout=120.0) as client:
                response = await client.post(
                    f"{self.base_url}/messages",
                    json=request_data,
                    headers=self._headers
                )
                
                if response.status_code == 200:
                    data = response.json()
                    content = data.get("content", [])
                    text_content = ""
                    if content and isinstance(content[0], dict):
                        text_content = content[0].get("text", "")
                    
                    return LLMResponse(
                        content=text_content,
                        model=self.model,
                        tokens_used=data.get("usage", {}).get("input_tokens", 0) + data.get("usage", {}).get("output_tokens", 0),
                        finish_reason=data.get("stop_reason", "stop")
                    )
                else:
                    error_msg = f"Anthropic API error: {response.status_code}"
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
                content=f"Error connecting to Anthropic: {str(e)}",
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
        """Generate a streaming response using Anthropic API."""
        if max_tokens <= 0:
            max_tokens = self.default_max_tokens
        
        api_messages = self._build_messages(messages, system_prompt)
        
        request_data = {
            "model": self.model,
            "messages": api_messages,
            "max_tokens": max_tokens,
            "temperature": temperature,
            "stream": True
        }
        
        if system_prompt:
            request_data["system"] = system_prompt
        
        try:
            async with httpx.AsyncClient(timeout=120.0) as client:
                async with client.stream(
                    "POST",
                    f"{self.base_url}/messages",
                    json=request_data,
                    headers=self._headers
                ) as response:
                    async for line in response.aiter_lines():
                        if line.startswith("data: "):
                            data_str = line[6:]
                            
                            if data_str.strip() == "[DONE]":
                                break
                            
                            try:
                                data = json.loads(data_str)
                                if data.get("type") == "content_block_delta":
                                    delta = data.get("delta", {})
                                    if delta.get("type") == "text_delta":
                                        yield delta.get("text", "")
                                elif data.get("type") == "message_delta":
                                    pass
                            except json.JSONDecodeError:
                                continue
        except Exception as e:
            yield f"\n\nError: {str(e)}"
    
    async def get_embeddings(self, text: str) -> List[float]:
        """Get embeddings for text.
        
        Note: Anthropic does not provide an embeddings API.
        Returns empty list as fallback.
        """
        return []
    
    async def list_models(self) -> List[str]:
        """List available Claude models."""
        return [
            "claude-3-5-sonnet-20241022",
            "claude-3-5-sonnet-20240620",
            "claude-3-5-haiku-20241022",
            "claude-3-5-haiku-20240620",
            "claude-3-opus-20240229",
            "claude-3-sonnet-20240229",
            "claude-3-haiku-20240307"
        ]
