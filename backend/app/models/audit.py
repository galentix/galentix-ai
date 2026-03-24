"""
Galentix AI - Audit Log Model
Records security-relevant actions for compliance and debugging.
"""
from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime, ForeignKey, JSON, Index
from ..database import Base
import uuid


class AuditLog(Base):
    """Audit log entry - records a user or system action."""
    __tablename__ = "audit_logs"

    __table_args__ = (
        Index("ix_audit_logs_user_action", "user_id", "action"),
    )

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=True, index=True)
    username = Column(String(50), nullable=True)  # Denormalized for fast reads
    action = Column(String(100), nullable=False, index=True)  # e.g., "user.login", "document.upload"
    resource_type = Column(String(50), nullable=True)  # e.g., "conversation", "document", "model"
    resource_id = Column(String(36), nullable=True)
    details = Column(JSON, nullable=True)  # Additional context
    ip_address = Column(String(45), nullable=True)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "timestamp": self.timestamp.isoformat() if self.timestamp else None,
            "user_id": self.user_id,
            "username": self.username,
            "action": self.action,
            "resource_type": self.resource_type,
            "resource_id": self.resource_id,
            "details": self.details,
            "ip_address": self.ip_address,
        }
