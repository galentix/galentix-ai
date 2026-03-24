"""
Galentix AI - Conversation & Message Models
"""
from datetime import datetime
from typing import Optional, List
from sqlalchemy import Column, String, Text, DateTime, ForeignKey, Integer, Boolean, JSON, Index
from sqlalchemy.orm import relationship
from ..database import Base
import uuid


class Conversation(Base):
    """Conversation model - represents a chat session."""
    __tablename__ = "conversations"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    title = Column(String(255), default="New Conversation")
    user_id = Column(String, ForeignKey("users.id"), nullable=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, index=True)
    is_archived = Column(Boolean, default=False, index=True)
    
    # Metadata
    metadata_ = Column("metadata", JSON, default=dict)
    
    # Relationships
    messages = relationship("Message", back_populates="conversation", cascade="all, delete-orphan")
    
    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "title": self.title,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "is_archived": self.is_archived,
            "message_count": len(self.messages) if self.messages else 0
        }


class Message(Base):
    """Message model - represents a single message in a conversation."""
    __tablename__ = "messages"
    
    __table_args__ = (
        Index("ix_messages_conversation_created", "conversation_id", "created_at"),
    )

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    conversation_id = Column(String(36), ForeignKey("conversations.id"), nullable=False)
    role = Column(String(20), nullable=False)  # "user", "assistant", "system"
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Token counts for analytics
    token_count = Column(Integer, default=0)
    
    # Sources used (for RAG responses)
    sources = Column(JSON, default=list)
    
    # Skill usage
    skills_used = Column(JSON, default=list)
    
    # Relationships
    conversation = relationship("Conversation", back_populates="messages")
    
    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "conversation_id": self.conversation_id,
            "role": self.role,
            "content": self.content,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "token_count": self.token_count,
            "sources": self.sources or [],
            "skills_used": self.skills_used or []
        }
