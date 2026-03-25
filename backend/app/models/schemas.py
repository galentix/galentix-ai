"""
Galentix AI - Pydantic Schemas for API
"""
from datetime import datetime
from typing import Optional, List, Any, Generic, TypeVar, Literal
from pydantic import BaseModel, Field, field_validator, ConfigDict
from pydantic.generics import GenericModel

T = TypeVar('T')


class PaginatedResponse(GenericModel, Generic[T]):
    """Generic paginated response wrapper."""
    items: List[T] = Field(..., description="List of items in this page")
    total: int = Field(..., description="Total number of items")
    page: int = Field(..., description="Current page number (1-based)")
    page_size: int = Field(..., description="Number of items per page")
    total_pages: int = Field(..., description="Total number of pages")


class ErrorDetail(BaseModel):
    """Detailed error information."""
    field: str = Field(..., description="Field that caused the error")
    message: str = Field(..., description="Error message")
    code: str = Field(..., description="Error code for programmatic handling")


class ErrorResponse(BaseModel):
    """Standard error response."""
    error: str = Field(..., description="Error type")
    message: str = Field(..., description="Human-readable error message")
    details: Optional[List[ErrorDetail]] = Field(default=None, description="Detailed error information")
    request_id: Optional[str] = Field(default=None, description="Request ID for debugging")


# ============================================
# Chat Schemas
# ============================================

class ChatMessage(BaseModel):
    """Single chat message."""
    model_config = ConfigDict(str_strip_whitespace=True)
    
    role: Literal["user", "assistant", "system"] = Field(..., description="Message role: user, assistant, or system")
    content: str = Field(..., min_length=1, description="Message content")


class ChatRequest(BaseModel):
    """Chat request from client."""
    message: str = Field(..., min_length=1, max_length=32000, description="User message")
    conversation_id: Optional[str] = Field(None, description="Existing conversation ID")
    use_rag: bool = Field(True, description="Whether to use RAG for context")
    use_web_search: bool = Field(False, description="Whether to search the web")
    stream: bool = Field(True, description="Whether to stream the response")

    @field_validator('message')
    @classmethod
    def validate_message_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError('Message cannot be empty or whitespace only')
        return v


class ChatResponse(BaseModel):
    """Chat response to client."""
    message: str = Field(..., description="Assistant response")
    conversation_id: str = Field(..., description="Conversation ID")
    sources: List[dict] = Field(default=[], description="RAG sources used")
    web_results: List[dict] = Field(default=[], description="Web search results used")
    skills_used: List[str] = Field(default=[], description="Skills that were used")


class StreamChunk(BaseModel):
    """Single chunk of streamed response."""
    type: Literal["token", "source", "done", "error"] = Field(..., description="Chunk type")
    content: str = Field(default="", description="Chunk content")
    metadata: Optional[dict] = Field(default=None, description="Additional metadata")


# ============================================
# Conversation Schemas
# ============================================

class ConversationCreate(BaseModel):
    """Create new conversation."""
    title: Optional[str] = Field("New Conversation", min_length=1, max_length=200, description="Conversation title")


class ConversationUpdate(BaseModel):
    """Update conversation."""
    title: Optional[str] = Field(None, min_length=1, max_length=200, description="Conversation title")
    is_archived: Optional[bool] = Field(None, description="Whether conversation is archived")


class ConversationResponse(BaseModel):
    """Conversation response."""
    model_config = ConfigDict(from_attributes=True)
    
    id: str
    title: str
    created_at: datetime
    updated_at: datetime
    is_archived: bool
    is_deleted: bool = False
    deleted_at: Optional[datetime] = None
    message_count: int = 0


class MessageResponse(BaseModel):
    """Message response."""
    model_config = ConfigDict(from_attributes=True)
    
    id: str
    conversation_id: str
    role: str
    content: str
    created_at: datetime
    token_count: int = 0
    sources: List[dict] = []
    skills_used: List[str] = []


# ============================================
# Document Schemas
# ============================================

class DocumentUploadResponse(BaseModel):
    """Response after document upload."""
    id: str
    filename: str
    status: str
    message: str


class DocumentResponse(BaseModel):
    """Document details response."""
    model_config = ConfigDict(from_attributes=True)
    
    id: str
    filename: str
    original_name: str
    file_type: str
    file_size: int
    status: str
    error_message: Optional[str] = None
    chunk_count: int
    embedding_model: Optional[str] = None
    created_at: datetime
    processed_at: Optional[datetime] = None
    is_deleted: bool = False
    deleted_at: Optional[datetime] = None


class DocumentListResponse(BaseModel):
    """List of documents."""
    documents: List[DocumentResponse]
    total: int


# ============================================
# Search Schemas
# ============================================

class WebSearchRequest(BaseModel):
    """Web search request."""
    query: str = Field(..., min_length=1, max_length=500, description="Search query")
    max_results: int = Field(5, ge=1, le=20, description="Maximum number of results")


class WebSearchResult(BaseModel):
    """Single web search result."""
    title: str
    url: str
    snippet: str
    source: str


class WebSearchResponse(BaseModel):
    """Web search response."""
    query: str
    results: List[WebSearchResult]
    total: int


# ============================================
# System Schemas
# ============================================

class HealthResponse(BaseModel):
    """Health check response."""
    status: str
    version: str
    llm_engine: str
    llm_model: str
    llm_status: str
    rag_status: str
    search_status: str


class DeviceInfoResponse(BaseModel):
    """Device information response."""
    device_id: str
    version: str
    hardware: dict
    llm: dict
    uptime: Optional[str] = None


class SystemStatsResponse(BaseModel):
    """System statistics response."""
    cpu_percent: float
    memory_percent: float
    disk_percent: float
    conversations_count: int
    documents_count: int
    messages_count: int


# ============================================
# Settings Schemas
# ============================================

class SettingsResponse(BaseModel):
    """Current settings response."""
    llm: dict
    rag: dict
    search: dict
    ui: dict


class SettingsUpdate(BaseModel):
    """Update settings request."""
    llm: Optional[dict] = None
    rag: Optional[dict] = None
    search: Optional[dict] = None
    ui: Optional[dict] = None


# ============================================
# Model Management Schemas
# ============================================

class ModelInfo(BaseModel):
    """Information about a downloaded model."""
    name: str
    size: str = ""
    is_active: bool = False


class ModelListResponse(BaseModel):
    """List of available models."""
    models: List[ModelInfo]
    active_model: str


class ModelPullRequest(BaseModel):
    """Request to download a new model."""
    model_name: str = Field(..., min_length=1, max_length=100, description="Ollama model ID (e.g. llama3:8b)")


class ModelPullResponse(BaseModel):
    """Response after model pull."""
    success: bool
    message: str
    model_name: str


class ModelSwitchRequest(BaseModel):
    """Request to switch active model."""
    model_name: str = Field(..., min_length=1, max_length=100, description="Model to switch to")
