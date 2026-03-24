"""
Galentix AI - Document Model for RAG
"""
from datetime import datetime
from sqlalchemy import Column, String, Text, DateTime, Integer, Boolean, JSON
from ..database import Base
import uuid


class Document(Base):
    """Document model - represents an uploaded document for RAG."""
    __tablename__ = "documents"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    filename = Column(String(255), nullable=False)
    original_name = Column(String(255), nullable=False)
    file_type = Column(String(50), nullable=False)  # pdf, docx, txt, etc.
    file_size = Column(Integer, default=0)  # in bytes
    
    # Processing status
    status = Column(String(20), default="pending", index=True)  # pending, processing, ready, error
    error_message = Column(Text, nullable=True)
    
    # RAG metadata
    chunk_count = Column(Integer, default=0)
    embedding_model = Column(String(100), nullable=True)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    processed_at = Column(DateTime, nullable=True)
    
    # Additional metadata
    metadata_ = Column("metadata", JSON, default=dict)
    
    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "filename": self.filename,
            "original_name": self.original_name,
            "file_type": self.file_type,
            "file_size": self.file_size,
            "status": self.status,
            "error_message": self.error_message,
            "chunk_count": self.chunk_count,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "processed_at": self.processed_at.isoformat() if self.processed_at else None,
        }
