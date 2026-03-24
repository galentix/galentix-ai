"""
Galentix AI - Audit Logging Service
Provides a single helper to record audit log entries from any router.
"""
import logging
from typing import Optional

from fastapi import Request
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.audit import AuditLog
from ..models.user import User

logger = logging.getLogger(__name__)


def _client_ip(request: Optional[Request]) -> Optional[str]:
    """Extract the client IP from a FastAPI request."""
    if request is None:
        return None
    # Prefer X-Forwarded-For when behind a reverse proxy
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    if request.client:
        return request.client.host
    return None


async def log_action(
    db: AsyncSession,
    action: str,
    user: Optional[User] = None,
    resource_type: Optional[str] = None,
    resource_id: Optional[str] = None,
    details: Optional[dict] = None,
    ip_address: Optional[str] = None,
    request: Optional[Request] = None,
):
    """Record an audit log entry.

    Parameters
    ----------
    db : AsyncSession
        Active database session (the caller's request session).
    action : str
        Dot-notation action label, e.g. "user.login", "document.upload".
    user : User, optional
        The user performing the action (None for anonymous events like
        failed login attempts).
    resource_type : str, optional
        The kind of resource affected ("user", "document", "model", ...).
    resource_id : str, optional
        Primary key of the affected resource.
    details : dict, optional
        Free-form JSON-serialisable context.
    ip_address : str, optional
        Explicit client IP.  When omitted the service will try to derive it
        from *request*.
    request : Request, optional
        The current FastAPI request, used to extract the client IP if
        *ip_address* is not given.
    """
    if ip_address is None:
        ip_address = _client_ip(request)

    entry = AuditLog(
        user_id=user.id if user else None,
        username=user.username if user else None,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        details=details,
        ip_address=ip_address,
    )
    db.add(entry)
    # Flush so the row is written inside the caller's transaction; the
    # session's commit/rollback in get_db() finalises it.
    try:
        await db.flush()
    except Exception:
        logger.exception("Failed to write audit log entry for action=%s", action)
