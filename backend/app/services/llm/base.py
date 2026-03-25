"""
Galentix AI - Base LLM Service Interface
"""
from abc import ABC, abstractmethod
from typing import AsyncGenerator, List, Dict, Any, Optional
from dataclasses import dataclass, field
from datetime import datetime
import logging

logger = logging.getLogger(__name__)


@dataclass
class LLMMessage:
    """Message for LLM conversation."""
    role: str  # "system", "user", "assistant"
    content: str
    name: Optional[str] = None


@dataclass
class LLMResponse:
    """Response from LLM."""
    content: str
    model: str
    tokens_used: int = 0
    finish_reason: str = "stop"
    latency_ms: float = 0.0
    error: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class LLMServiceInfo:
    """Information about an LLM service."""
    engine: str
    model: str
    base_url: str
    status: str = "unknown"
    capabilities: List[str] = field(default_factory=list)
    max_tokens: int = 4096
    supports_streaming: bool = True
    supports_embeddings: bool = True
    last_health_check: Optional[datetime] = None


class BaseLLMService(ABC):
    """Abstract base class for LLM services."""
    
    def __init__(self, model: str, base_url: str):
        self.model = model
        self.base_url = base_url
        self._is_available: Optional[bool] = None
        self._health_check_cache: Optional[bool] = None
        self._health_check_timestamp: Optional[float] = None
        self._health_check_ttl: float = 30.0
    
    @abstractmethod
    async def generate(
        self,
        messages: List[LLMMessage],
        temperature: float = 0.7,
        max_tokens: int = 2048,
        system_prompt: Optional[str] = None
    ) -> LLMResponse:
        """Generate a response from the LLM."""
        pass
    
    @abstractmethod
    async def generate_stream(
        self,
        messages: List[LLMMessage],
        temperature: float = 0.7,
        max_tokens: int = 2048,
        system_prompt: Optional[str] = None
    ) -> AsyncGenerator[str, None]:
        """Generate a streaming response from the LLM."""
        pass
    
    @abstractmethod
    async def get_embeddings(self, text: str) -> List[float]:
        """Get embeddings for text."""
        pass
    
    @abstractmethod
    async def health_check(self) -> bool:
        """Check if the LLM service is available."""
        pass
    
    def _cached_health_check(self) -> bool:
        """Get cached health check result."""
        import time
        now = time.time()
        
        if self._health_check_cache is not None and self._health_check_timestamp:
            if now - self._health_check_timestamp < self._health_check_ttl:
                return self._health_check_cache
        
        return False
    
    def _update_health_cache(self, result: bool) -> None:
        """Update health check cache."""
        import time
        self._health_check_cache = result
        self._health_check_timestamp = time.time()
    
    @property
    def engine_name(self) -> str:
        """Return the engine name."""
        return "base"
    
    @property
    def service_info(self) -> LLMServiceInfo:
        """Get service information."""
        return LLMServiceInfo(
            engine=self.engine_name,
            model=self.model,
            base_url=self.base_url,
            capabilities=self._get_capabilities(),
            supports_streaming=hasattr(self, 'generate_stream'),
            supports_embeddings=hasattr(self, 'get_embeddings')
        )
    
    def _get_capabilities(self) -> List[str]:
        """Get list of service capabilities."""
        capabilities = ["chat"]
        if hasattr(self, 'generate_stream'):
            capabilities.append("streaming")
        if hasattr(self, 'get_embeddings'):
            capabilities.append("embeddings")
        if hasattr(self, 'list_models'):
            capabilities.append("list_models")
        if hasattr(self, 'pull_model'):
            capabilities.append("pull_model")
        return capabilities
    
    def _build_prompt(
        self,
        messages: List[LLMMessage],
        system_prompt: Optional[str] = None
    ) -> str:
        """Build a prompt string from messages."""
        parts = []
        
        if system_prompt:
            parts.append(f"System: {system_prompt}\n")
        
        for msg in messages:
            if msg.role == "system":
                parts.append(f"System: {msg.content}\n")
            elif msg.role == "user":
                parts.append(f"User: {msg.content}\n")
            elif msg.role == "assistant":
                parts.append(f"Assistant: {msg.content}\n")
        
        parts.append("Assistant: ")
        return "".join(parts)
    
    async def warm_up(self) -> bool:
        """Warm up the service with a test request."""
        try:
            test_messages = [LLMMessage(role="user", content="Hello")]
            response = await self.generate(
                messages=test_messages,
                temperature=0.0,
                max_tokens=1
            )
            return response.finish_reason != "error"
        except Exception as e:
            logger.warning(f"Warm-up failed: {e}")
            return False
