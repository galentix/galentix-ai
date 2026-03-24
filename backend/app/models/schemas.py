"""
Galentix AI - Pydantic Schemas for API
"""
from datetime import datetime
from typing import Optional, List, Any
from pydantic import BaseModel, Field


# ============================================
# Chat Schemas
# ============================================

class ChatMessage(BaseModel):
    """Single chat message."""
    role: str = Field(..., description="Message role: user, assistant, or system")
    content: str = Field(..., description="Message content")


class ChatRequest(BaseModel):
    """Chat request from client."""
    message: str = Field(..., description="User message")
    conversation_id: Optional[str] = Field(None, description="Existing conversation ID")
    use_rag: bool = Field(True, description="Whether to use RAG for context")
    use_web_search: bool = Field(False, description="Whether to search the web")
    stream: bool = Field(True, description="Whether to stream the response")


class ChatResponse(BaseModel):
    """Chat response to client."""
    message: str = Field(..., description="Assistant response")
    conversation_id: str = Field(..., description="Conversation ID")
    sources: List[dict] = Field(default=[], description="RAG sources used")
    web_results: List[dict] = Field(default=[], description="Web search results used")
    skills_used: List[str] = Field(default=[], description="Skills that were used")


class StreamChunk(BaseModel):
    """Single chunk of streamed response."""
    type: str = Field(..., description="Chunk type: token, source, done, error")
    content: str = Field(default="", description="Chunk content")
    metadata: Optional[dict] = Field(default=None, description="Additional metadata")


# ============================================
# Conversation Schemas
# ============================================

class ConversationCreate(BaseModel):
    """Create new conversation."""
    title: Optional[str] = Field("New Conversation", description="Conversation title")


class ConversationUpdate(BaseModel):
    """Update conversation."""
    title: Optional[str] = None
    is_archived: Optional[bool] = None


class ConversationResponse(BaseModel):
    """Conversation response."""
    id: str
    title: str
    created_at: datetime
    updated_at: datetime
    is_archived: bool
    message_count: int = 0


class MessageResponse(BaseModel):
    """Message response."""
    id: str
    conversation_id: str
    role: str
    content: str
    created_at: datetime
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
    id: str
    filename: str
    original_name: str
    file_type: str
    file_size: int
    status: str
    error_message: Optional[str] = None
    chunk_count: int
    created_at: datetime
    processed_at: Optional[datetime] = None


class DocumentListResponse(BaseModel):
    """List of documents."""
    documents: List[DocumentResponse]
    total: int


# ============================================
# Search Schemas
# ============================================

class WebSearchRequest(BaseModel):
    """Web search request."""
    query: str = Field(..., description="Search query")
    max_results: int = Field(5, description="Maximum number of results")


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
    """Update settings request (partial updates)."""
    temperature: Optional[float] = Field(None, ge=0.0, le=1.0, description="LLM temperature")
    max_tokens: Optional[int] = Field(None, ge=256, le=8192, description="LLM max tokens")
    rag_enabled: Optional[bool] = Field(None, description="Enable/disable RAG")
    rag_top_k: Optional[int] = Field(None, ge=1, le=20, description="RAG top-K results")
    search_enabled: Optional[bool] = Field(None, description="Enable/disable web search")
    search_language: Optional[str] = Field(None, pattern="^(en|ar|all)$", description="Search language: en, ar, or all")


# ============================================
# Model Management Schemas
# ============================================

class ModelInfo(BaseModel):
    """Information about a downloaded model."""
    name: str
    size: str = ""
    is_active: bool = False
    arabic_capable: bool = False
    languages: List[str] = Field(default=[], description="Known supported languages")


class ModelListResponse(BaseModel):
    """List of available models."""
    models: List[ModelInfo]
    active_model: str


class ModelPullRequest(BaseModel):
    """Request to download a new model."""
    model_name: str = Field(..., description="Ollama model ID (e.g. llama3:8b)")


class ModelPullResponse(BaseModel):
    """Response after model pull."""
    success: bool
    message: str
    model_name: str


class ModelSwitchRequest(BaseModel):
    """Request to switch active model."""
    model_name: str = Field(..., description="Model to switch to")


# ============================================
# Backup Schemas
# ============================================

class BackupResponse(BaseModel):
    """Response after backup creation."""
    success: bool
    filename: str
    size_bytes: int
    message: str


class BackupListItem(BaseModel):
    """Single backup entry."""
    filename: str
    size_bytes: int
    created_at: str


class BackupListResponse(BaseModel):
    """List of available backups."""
    backups: List[BackupListItem]
    total: int


class PurgeResponse(BaseModel):
    """Response after data purge."""
    success: bool
    message: str
    deleted: dict
