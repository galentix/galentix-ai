"""
Galentix AI - Base LLM Service Interface
"""
from abc import ABC, abstractmethod
from typing import AsyncGenerator, List, Dict, Any, Optional
from dataclasses import dataclass


@dataclass
class LLMMessage:
    """Message for LLM conversation."""
    role: str  # "system", "user", "assistant"
    content: str


@dataclass
class LLMResponse:
    """Response from LLM."""
    content: str
    model: str
    tokens_used: int = 0
    finish_reason: str = "stop"


class BaseLLMService(ABC):
    """Abstract base class for LLM services."""
    
    def __init__(self, model: str, base_url: str):
        self.model = model
        self.base_url = base_url
        self._is_available: Optional[bool] = None
    
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
    
    @property
    def engine_name(self) -> str:
        """Return the engine name."""
        return "base"
    
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
