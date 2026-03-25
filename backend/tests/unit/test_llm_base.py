"""
Unit tests for LLM base service.
"""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from app.services.llm.base import BaseLLMService, LLMMessage, LLMResponse


class MockLLMService(BaseLLMService):
    """Mock implementation of BaseLLMService for testing."""
    
    def __init__(self):
        super().__init__(model="test-model", base_url="http://localhost:11434")
    
    async def generate(self, messages, temperature=0.7, max_tokens=2048, system_prompt=None):
        return LLMResponse(
            content="Mock response",
            model=self.model,
            tokens_used=10,
            finish_reason="stop"
        )
    
    async def generate_stream(self, messages, temperature=0.7, max_tokens=2048, system_prompt=None):
        for word in ["Mock", " ", "response", " ", "streaming"]:
            yield word
    
    async def get_embeddings(self, text):
        return [0.1] * 768
    
    async def health_check(self):
        return True
    
    @property
    def engine_name(self):
        return "mock"


class TestLLMMessage:
    """Tests for LLMMessage dataclass."""
    
    def test_create_message(self):
        msg = LLMMessage(role="user", content="Hello")
        assert msg.role == "user"
        assert msg.content == "Hello"
    
    def test_message_roles(self):
        roles = ["system", "user", "assistant"]
        for role in roles:
            msg = LLMMessage(role=role, content="Test")
            assert msg.role == role


class TestLLMResponse:
    """Tests for LLMResponse dataclass."""
    
    def test_create_response(self):
        resp = LLMResponse(
            content="Response text",
            model="test-model",
            tokens_used=100,
            finish_reason="stop"
        )
        assert resp.content == "Response text"
        assert resp.model == "test-model"
        assert resp.tokens_used == 100
        assert resp.finish_reason == "stop"
    
    def test_default_values(self):
        resp = LLMResponse(content="Test", model="test")
        assert resp.tokens_used == 0
        assert resp.finish_reason == "stop"


class TestBaseLLMService:
    """Tests for BaseLLMService abstract class."""
    
    def test_engine_name_property(self):
        service = MockLLMService()
        assert service.engine_name == "mock"
    
    def test_build_prompt_without_system(self):
        service = MockLLMService()
        messages = [
            LLMMessage(role="user", content="Hello"),
            LLMMessage(role="assistant", content="Hi there")
        ]
        prompt = service._build_prompt(messages)
        
        assert "User: Hello" in prompt
        assert "Assistant: Hi there" in prompt
        assert prompt.endswith("Assistant: ")
    
    def test_build_prompt_with_system(self):
        service = MockLLMService()
        messages = [LLMMessage(role="user", content="Hello")]
        system_prompt = "You are a helpful assistant."
        
        prompt = service._build_prompt(messages, system_prompt)
        
        assert "System: You are a helpful assistant." in prompt
        assert "User: Hello" in prompt
    
    def test_build_prompt_empty_messages(self):
        service = MockLLMService()
        prompt = service._build_prompt([])
        assert prompt.endswith("Assistant: ")


class TestMockLLMService:
    """Tests for MockLLMService implementation."""
    
    @pytest.mark.asyncio
    async def test_generate_returns_response(self):
        service = MockLLMService()
        messages = [LLMMessage(role="user", content="Test")]
        
        response = await service.generate(messages)
        
        assert isinstance(response, LLMResponse)
        assert response.content == "Mock response"
        assert response.model == "test-model"
    
    @pytest.mark.asyncio
    async def test_generate_stream_yields_chunks(self):
        service = MockLLMService()
        messages = [LLMMessage(role="user", content="Test")]
        
        chunks = []
        async for chunk in service.generate_stream(messages):
            chunks.append(chunk)
        
        assert len(chunks) > 0
        assert "Mock" in "".join(chunks)
    
    @pytest.mark.asyncio
    async def test_get_embeddings_returns_list(self):
        service = MockLLMService()
        embeddings = await service.get_embeddings("test text")
        
        assert isinstance(embeddings, list)
        assert len(embeddings) == 768
    
    @pytest.mark.asyncio
    async def test_health_check_returns_true(self):
        service = MockLLMService()
        result = await service.health_check()
        
        assert result is True