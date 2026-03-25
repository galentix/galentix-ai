"""
Galentix AI - Document Model for RAG
"""
from datetime import datetime
from typing import Optional
from sqlalchemy import Column, String, Text, DateTime, Integer, Boolean, JSON, Index
from ..database import Base
import uuid


class Document(Base):
    """Document model - represents an uploaded document for RAG."""
    __tablename__ = "documents"
    __table_args__ = (
        Index("ix_documents_status", "status"),
        Index("ix_documents_created_at", "created_at"),
        Index("ix_documents_file_type", "file_type"),
    )
    
    VALID_STATUSES = ["pending", "processing", "ready", "error"]
    VALID_FILE_TYPES = ["pdf", "docx", "doc", "txt", "md", "csv", "json", "html", "xml"]
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    filename = Column(String(255), nullable=False)
    original_name = Column(String(255), nullable=False)
    file_type = Column(String(50), nullable=False)
    file_size = Column(Integer, default=0, nullable=False)
    
    status = Column(String(20), default="pending", nullable=False, index=True)
    error_message = Column(Text, nullable=True)
    
    chunk_count = Column(Integer, default=0, nullable=False)
    embedding_model = Column(String(100), nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    processed_at = Column(DateTime, nullable=True)
    deleted_at = Column(DateTime, nullable=True, index=True)
    
    metadata_ = Column("metadata", JSON, default=dict)
    
    @property
    def is_deleted(self) -> bool:
        deleted_at = self.deleted_at
        return deleted_at is not None
    
    @property
    def is_processed(self) -> bool:
        status = self.status
        return status == "ready"
    
    def soft_delete(self):
        """Mark document as deleted."""
        self.deleted_at = datetime.utcnow()
    
    def restore(self):
        """Restore deleted document."""
        self.deleted_at = None
    
    def to_dict(self) -> dict:
        created_at = self.created_at
        processed_at = self.processed_at
        deleted_at = self.deleted_at
        
        return {
            "id": self.id,
            "filename": self.filename,
            "original_name": self.original_name,
            "file_type": self.file_type,
            "file_size": self.file_size,
            "status": self.status,
            "error_message": self.error_message,
            "chunk_count": self.chunk_count,
            "embedding_model": self.embedding_model,
            "created_at": created_at.isoformat() if created_at else None,
            "processed_at": processed_at.isoformat() if processed_at else None,
            "is_deleted": self.is_deleted,
            "deleted_at": deleted_at.isoformat() if deleted_at else None,
        }
