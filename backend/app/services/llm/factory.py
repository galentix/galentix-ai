"""
Galentix AI - LLM Service Factory
Automatically selects the appropriate LLM backend based on hardware.
"""
from typing import Optional
from .base import BaseLLMService
from .ollama import OllamaService
from .vllm import VLLMService
from ..hardware import hardware_detector
from ...config import settings


class LLMService:
    """
    Unified LLM Service that automatically selects the best backend.
    Provides a consistent interface regardless of underlying engine.
    """
    
    def __init__(self):
        self._service: Optional[BaseLLMService] = None
        self._initialized = False
    
    async def initialize(self) -> None:
        """Initialize the LLM service based on configuration and hardware."""
        if self._initialized:
            return
        
        # Get configuration
        engine = settings.llm_engine
        model = settings.llm_model
        
        # Create appropriate service
        if engine == "vllm":
            self._service = VLLMService(
                model=model,
                base_url=settings.vllm_url
            )
            # Check if vLLM is available, fallback to Ollama if not
            if not await self._service.health_check():
                print("vLLM not available, falling back to Ollama")
                self._service = OllamaService(
                    model=self._get_ollama_model_name(model),
                    base_url=settings.ollama_url
                )
        else:
            self._service = OllamaService(
                model=model,
                base_url=settings.ollama_url
            )
        
        self._initialized = True
    
    def _get_ollama_model_name(self, vllm_model: str) -> str:
        """Convert vLLM model name to Ollama model name."""
        # Map common vLLM models to Ollama equivalents
        model_mapping = {
            "meta-llama/Llama-3-8b-chat-hf": "llama3:8b",
            "meta-llama/Llama-3-70b-chat-hf": "llama3:70b",
            "mistralai/Mistral-7B-Instruct-v0.2": "mistral:7b",
        }
        return model_mapping.get(vllm_model, "tinyllama")
    
    @property
    def service(self) -> BaseLLMService:
        """Get the underlying service."""
        if not self._service:
            raise RuntimeError("LLM service not initialized. Call initialize() first.")
        return self._service
    
    @property
    def engine_name(self) -> str:
        """Get the name of the current engine."""
        return self.service.engine_name
    
    @property
    def model_name(self) -> str:
        """Get the name of the current model."""
        return self.service.model
    
    async def generate(self, messages, **kwargs):
        """Generate a response."""
        await self.initialize()
        return await self.service.generate(messages, **kwargs)
    
    async def generate_stream(self, messages, **kwargs):
        """Generate a streaming response."""
        await self.initialize()
        async for chunk in self.service.generate_stream(messages, **kwargs):
            yield chunk
    
    async def get_embeddings(self, text: str):
        """Get embeddings for text."""
        await self.initialize()
        return await self.service.get_embeddings(text)
    
    async def health_check(self) -> bool:
        """Check if the service is healthy."""
        await self.initialize()
        return await self.service.health_check()
    
    async def get_status(self) -> dict:
        """Get detailed status information."""
        await self.initialize()
        is_healthy = await self.service.health_check()
        
        return {
            "engine": self.engine_name,
            "model": self.model_name,
            "status": "online" if is_healthy else "offline",
            "base_url": self.service.base_url
        }


# Global LLM service instance
_llm_service: Optional[LLMService] = None


def get_llm_service() -> LLMService:
    """Get or create the global LLM service instance."""
    global _llm_service
    if _llm_service is None:
        _llm_service = LLMService()
    return _llm_service
