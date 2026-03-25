"""
Galentix AI - LLM Service Factory
Automatically selects the appropriate LLM backend based on hardware and availability.
"""
import os
import asyncio
import logging
from typing import Optional, List, Dict, Any
from .base import BaseLLMService, LLMServiceInfo
from .ollama import OllamaService
from .vllm import VLLMService
from .openai import OpenAIService
from .anthropic import AnthropicService
from ..hardware import hardware_detector
from ...config import settings

logger = logging.getLogger(__name__)


class ModelFallback:
    """Manages fallback chain for models."""
    
    def __init__(self, fallback_chain: Optional[List[str]] = None):
        self.fallback_chain = fallback_chain or []
    
    def get_next(self, current: str) -> Optional[str]:
        """Get next fallback model."""
        try:
            idx = self.fallback_chain.index(current)
            if idx + 1 < len(self.fallback_chain):
                return self.fallback_chain[idx + 1]
        except ValueError:
            pass
        return None
    
    def add_fallback(self, model: str) -> None:
        """Add a fallback model."""
        if model not in self.fallback_chain:
            self.fallback_chain.append(model)


class LLMService:
    """
    Unified LLM Service that automatically selects the best backend.
    Provides a consistent interface regardless of underlying engine.
    Supports multiple providers with automatic fallback.
    """
    
    ENGINE_MAP = {
        "ollama": OllamaService,
        "vllm": VLLMService,
        "openai": OpenAIService,
        "anthropic": AnthropicService,
    }
    
    def __init__(self):
        self._service: Optional[BaseLLMService] = None
        self._initialized = False
        self._fallback_chain: List[BaseLLMService] = []
        self._current_fallback_index = 0
        self._lock = asyncio.Lock()
        self._last_error: Optional[str] = None
    
    async def initialize(self) -> None:
        """Initialize the LLM service based on configuration and hardware."""
        async with self._lock:
            if self._initialized:
                return
            
            engine = settings.llm_engine
            model = settings.llm_model
            
            await self._create_service(engine, model)
            self._initialized = True
    
    async def _create_service(self, engine: str, model: str) -> None:
        """Create and validate the primary service."""
        service_class = self.ENGINE_MAP.get(engine.lower())
        
        if not service_class:
            logger.warning(f"Unknown engine {engine}, falling back to Ollama")
            service_class = OllamaService
            engine = "ollama"
        
        if engine == "openai":
            api_key = os.environ.get("OPENAI_API_KEY")
            self._service = service_class(
                model=model,
                api_key=api_key
            )
        elif engine == "anthropic":
            api_key = os.environ.get("ANTHROPIC_API_KEY")
            self._service = service_class(
                model=model,
                api_key=api_key
            )
        else:
            url = getattr(settings, f"{engine}_url", "http://127.0.0.1:11434")
            self._service = service_class(
                model=model,
                base_url=url
            )
        
        if not await self._service.health_check():
            await self._setup_fallbacks(engine, model)
    
    async def _setup_fallbacks(self, original_engine: str, original_model: str) -> None:
        """Set up fallback services when primary is unavailable."""
        logger.info(f"Primary engine {original_engine} unavailable, setting up fallbacks")
        
        fallback_engines = ["ollama", "vllm", "openai"]
        fallback_engines = [e for e in fallback_engines if e != original_engine.lower()]
        
        for engine in fallback_engines:
            if engine in ["openai", "anthropic"]:
                api_key = os.environ.get(f"{engine.upper()}_API_KEY")
                if not api_key:
                    continue
                service_class = self.ENGINE_MAP[engine]
                service = service_class(
                    model=settings.llm_model,
                    api_key=api_key
                )
            else:
                service_class = self.ENGINE_MAP.get(engine)
                if not service_class:
                    continue
                url = getattr(settings, f"{engine}_url", f"http://127.0.0.1:{'11434' if engine == 'ollama' else '8000'}")
                service = service_class(model=self._get_fallback_model_name(engine), base_url=url)
            
            if await service.health_check():
                self._fallback_chain.append(service)
                logger.info(f"Fallback {engine} is available")
        
        if self._fallback_chain:
            self._service = self._fallback_chain[0]
            self._current_fallback_index = 0
    
    def _get_fallback_model_name(self, engine: str) -> str:
        """Get fallback model name for an engine."""
        model_mapping = {
            "ollama": "tinyllama",
            "vllm": "mistralai/Mistral-7B-Instruct-v0.2"
        }
        return model_mapping.get(engine.lower(), "tinyllama")
    
    def _get_ollama_model_name(self, vllm_model: str) -> str:
        """Convert vLLM model name to Ollama model name."""
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
        
        if self._fallback_chain:
            return await self._generate_with_fallback(messages, **kwargs)
        
        return await self.service.generate(messages, **kwargs)
    
    async def _generate_with_fallback(self, messages, **kwargs):
        """Generate with automatic fallback on failure."""
        last_error = None
        
        for i, fallback_service in enumerate(self._fallback_chain):
            try:
                result = await fallback_service.generate(messages, **kwargs)
                
                if result.finish_reason != "error":
                    if i > 0:
                        self._service = fallback_service
                        self._current_fallback_index = i
                        logger.info(f"Switched to fallback {fallback_service.engine_name}")
                    return result
                
                last_error = result.content
            except Exception as e:
                last_error = str(e)
                logger.warning(f"Fallback {fallback_service.engine_name} failed: {e}")
        
        from .base import LLMResponse
        return LLMResponse(
            content=f"All backends failed. Last error: {last_error}",
            model=self.model_name,
            finish_reason="error"
        )
    
    async def generate_stream(self, messages, **kwargs):
        """Generate a streaming response."""
        await self.initialize()
        async for chunk in self.service.generate_stream(messages, **kwargs):
            yield chunk
    
    async def get_embeddings(self, text: str):
        """Get embeddings for text."""
        await self.initialize()
        
        if hasattr(self.service, 'get_embeddings'):
            return await self.service.get_embeddings(text)
        return []
    
    async def health_check(self) -> bool:
        """Check if the service is healthy."""
        await self.initialize()
        return await self.service.health_check()
    
    async def list_models(self) -> list:
        """List available models."""
        await self.initialize()
        if hasattr(self.service, 'list_models'):
            return await self.service.list_models()
        return []
    
    async def get_status(self) -> dict:
        """Get detailed status information."""
        await self.initialize()
        is_healthy = await self.service.health_check()
        
        status = {
            "engine": self.engine_name,
            "model": self.model_name,
            "status": "online" if is_healthy else "offline",
            "base_url": self.service.base_url,
            "fallback_count": len(self._fallback_chain)
        }
        
        if hasattr(self.service, 'service_info'):
            info = self.service.service_info
            status.update({
                "capabilities": info.capabilities,
                "supports_streaming": info.supports_streaming,
                "supports_embeddings": info.supports_embeddings
            })
        
        return status
    
    async def switch_model(self, model_name: str) -> bool:
        """Hot-swap to a different model. Next request uses the new model."""
        from ...config import settings, save_settings
        
        settings.llm_model = model_name
        if model_name not in settings.llm_models:
            settings.llm_models.append(model_name)
        
        self._service = None
        self._initialized = False
        self._fallback_chain = []
        
        save_settings(settings)
        
        await self.initialize()
        return await self.health_check()
    
    async def switch_engine(self, engine: str, model: Optional[str] = None) -> bool:
        """Switch to a different engine."""
        from ...config import settings, save_settings
        
        settings.llm_engine = engine
        if model:
            settings.llm_model = model
        
        self._service = None
        self._initialized = False
        self._fallback_chain = []
        
        save_settings(settings)
        
        await self.initialize()
        return await self.health_check()
    
    async def get_service_info(self) -> LLMServiceInfo:
        """Get detailed service information."""
        await self.initialize()
        if hasattr(self.service, 'service_info'):
            return self.service.service_info
        return LLMServiceInfo(
            engine=self.engine_name,
            model=self.model_name,
            base_url=self.service.base_url
        )


_llm_service: Optional[LLMService] = None


def get_llm_service() -> LLMService:
    """Get or create the global LLM service instance."""
    global _llm_service
    if _llm_service is None:
        _llm_service = LLMService()
    return _llm_service


async def get_all_providers_status() -> Dict[str, Any]:
    """Get status of all available LLM providers."""
    providers = {}
    
    for engine_name, service_class in LLMService.ENGINE_MAP.items():
        try:
            if engine_name in ["openai", "anthropic"]:
                api_key = os.environ.get(f"{engine_name.upper()}_API_KEY")
                if not api_key:
                    providers[engine_name] = {"status": "not_configured", "available": False}
                    continue
                service = service_class(api_key=api_key)
            else:
                url = getattr(settings, f"{engine_name}_url", "http://127.0.0.1:11434")
                service = service_class(base_url=url)
            
            is_healthy = await service.health_check()
            providers[engine_name] = {
                "status": "online" if is_healthy else "offline",
                "available": is_healthy,
                "base_url": service.base_url
            }
        except Exception as e:
            providers[engine_name] = {
                "status": "error",
                "available": False,
                "error": str(e)
            }
    
    return providers
