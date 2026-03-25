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
    __table_args__ = (
        Index("ix_conversations_created_at", "created_at"),
        Index("ix_conversations_updated_at", "updated_at"),
        Index("ix_conversations_is_archived", "is_archived"),
    )
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    title = Column(String(255), default="New Conversation", index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    is_archived = Column(Boolean, default=False, nullable=False, index=True)
    deleted_at = Column(DateTime, nullable=True, index=True)
    
    metadata_ = Column("metadata", JSON, default=dict)
    
    messages = relationship(
        "Message", 
        back_populates="conversation", 
        cascade="all, delete-orphan",
        lazy="dynamic"
    )
    
    @property
    def is_deleted(self) -> bool:
        deleted_at = self.deleted_at
        return deleted_at is not None
    
    def soft_delete(self):
        """Mark conversation as deleted."""
        self.deleted_at = datetime.utcnow()
    
    def restore(self):
        """Restore deleted conversation."""
        self.deleted_at = None
    
    def to_dict(self, include_messages: bool = False) -> dict:
        created_at = self.created_at
        updated_at = self.updated_at
        deleted_at = self.deleted_at
        
        result = {
            "id": self.id,
            "title": self.title,
            "created_at": created_at.isoformat() if created_at else None,
            "updated_at": updated_at.isoformat() if updated_at else None,
            "is_archived": self.is_archived,
            "is_deleted": self.is_deleted,
            "deleted_at": deleted_at.isoformat() if deleted_at else None,
            "message_count": self.messages.count() if self.messages else 0
        }
        if include_messages:
            result["messages"] = [msg.to_dict() for msg in self.messages]
        return result


class Message(Base):
    """Message model - represents a single message in a conversation."""
    __tablename__ = "messages"
    __table_args__ = (
        Index("ix_messages_conversation_id", "conversation_id"),
        Index("ix_messages_created_at", "created_at"),
        Index("ix_messages_role", "role"),
    )
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    conversation_id = Column(
        String(36), 
        ForeignKey("conversations.id", ondelete="CASCADE"), 
        nullable=False,
        index=True
    )
    role = Column(String(20), nullable=False, index=True)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    token_count = Column(Integer, default=0, nullable=False)
    
    sources = Column(JSON, default=list)
    
    skills_used = Column(JSON, default=list)
    
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
