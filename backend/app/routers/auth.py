"""
Galentix AI - Auth Router
Handles authentication, user setup, and user management.
"""
import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from jose import JWTError

from ..database import get_db
from ..models.user import User
from ..rate_limit import limiter
from ..services.auth import (
    hash_password,
    verify_password,
    validate_password_policy,
    create_access_token,
    create_refresh_token,
    decode_token,
    get_current_user,
    require_admin,
)
from ..services.audit import log_action

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/auth", tags=["auth"])

# Cookie settings for the local appliance (no HTTPS)
COOKIE_KWARGS = {
    "httponly": True,
    "samesite": "lax",
    "secure": False,
}


# ---------------------------------------------------------------------------
# Pydantic Schemas
# ---------------------------------------------------------------------------

class SetupRequest(BaseModel):
    """First-run admin account creation."""
    username: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=8)
    email: Optional[str] = Field(None, max_length=255)


class LoginRequest(BaseModel):
    """Login credentials."""
    username: str
    password: str


class CreateUserRequest(BaseModel):
    """Admin creates a new user."""
    username: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=8)
    email: Optional[str] = Field(None, max_length=255)
    role: str = Field("user", pattern=r"^(admin|user)$")


class UpdateUserRequest(BaseModel):
    """Admin updates a user."""
    role: Optional[str] = Field(None, pattern=r"^(admin|user)$")
    is_active: Optional[bool] = None


class UserResponse(BaseModel):
    """Public user representation."""
    id: str
    username: str
    email: Optional[str] = None
    role: str
    is_active: bool
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class SetupStatusResponse(BaseModel):
    needs_setup: bool


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _set_auth_cookies(response: JSONResponse, user: User) -> None:
    """Set access and refresh token cookies on a response."""
    access = create_access_token(user.id, user.role)
    refresh = create_refresh_token(user.id)
    response.set_cookie(key="access_token", value=access, **COOKIE_KWARGS)
    response.set_cookie(key="refresh_token", value=refresh, **COOKIE_KWARGS)


def _user_response(user: User) -> dict:
    """Convert a User ORM object to a JSON-safe dict."""
    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "role": user.role,
        "is_active": user.is_active,
        "created_at": user.created_at.isoformat() if user.created_at else None,
        "updated_at": user.updated_at.isoformat() if user.updated_at else None,
    }


# ---------------------------------------------------------------------------
# Public Endpoints
# ---------------------------------------------------------------------------

@router.get("/setup-status")
@limiter.limit("30/minute")
async def setup_status(request: Request, db: AsyncSession = Depends(get_db)):
    """Check whether the initial admin setup is needed."""
    result = await db.execute(select(func.count(User.id)))
    count = result.scalar()
    return {"needs_setup": count == 0}


@router.post("/setup")
@limiter.limit("5/minute")
async def setup(request: Request, body: SetupRequest, db: AsyncSession = Depends(get_db)):
    """Create the first admin account. Only works when no users exist."""
    result = await db.execute(select(func.count(User.id)))
    count = result.scalar()
    if count > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Setup has already been completed",
        )

    # Validate password policy
    policy_error = validate_password_policy(body.password)
    if policy_error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=policy_error,
        )

    user = User(
        username=body.username,
        email=body.email,
        hashed_password=hash_password(body.password),
        role="admin",
        is_active=True,
    )
    db.add(user)
    await db.flush()

    await log_action(
        db, "user.setup", user=user,
        resource_type="user", resource_id=user.id,
        details={"username": user.username, "role": "admin"},
        request=request,
    )

    response = JSONResponse(
        content={"message": "Admin account created", "user": _user_response(user)}
    )
    _set_auth_cookies(response, user)
    return response


@router.post("/login")
@limiter.limit("5/minute")
async def login(request: Request, body: LoginRequest, db: AsyncSession = Depends(get_db)):
    """Authenticate with username/password and receive JWT cookies."""
    result = await db.execute(select(User).where(User.username == body.username))
    user = result.scalar_one_or_none()

    if user is None or not verify_password(body.password, user.hashed_password):
        await log_action(
            db, "user.login_failed",
            details={"username": body.username, "reason": "invalid_credentials"},
            request=request,
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
        )

    if not user.is_active:
        await log_action(
            db, "user.login_failed", user=user,
            details={"username": body.username, "reason": "account_disabled"},
            request=request,
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is disabled",
        )

    await log_action(
        db, "user.login", user=user,
        resource_type="user", resource_id=user.id,
        request=request,
    )

    response = JSONResponse(
        content={"message": "Login successful", "user": _user_response(user)}
    )
    _set_auth_cookies(response, user)
    return response


@router.post("/refresh")
@limiter.limit("10/minute")
async def refresh_token(request: Request, db: AsyncSession = Depends(get_db)):
    """Issue a new access token using a valid refresh token cookie."""
    token = request.cookies.get("refresh_token")
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="No refresh token",
        )

    try:
        payload = decode_token(token)
        if payload.get("type") != "refresh":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token type",
            )
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token",
            )
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        )

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if user is None or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive",
        )

    new_access = create_access_token(user.id, user.role)
    response = JSONResponse(content={"message": "Token refreshed"})
    response.set_cookie(key="access_token", value=new_access, **COOKIE_KWARGS)
    return response


# ---------------------------------------------------------------------------
# Authenticated Endpoints
# ---------------------------------------------------------------------------

@router.post("/logout")
async def logout(
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Clear JWT cookies to log out."""
    await log_action(
        db, "user.logout", user=current_user,
        resource_type="user", resource_id=current_user.id,
        request=request,
    )
    response = JSONResponse(content={"message": "Logged out"})
    response.delete_cookie("access_token")
    response.delete_cookie("refresh_token")
    return response


@router.get("/me")
async def me(current_user: User = Depends(get_current_user)):
    """Return the currently authenticated user's info."""
    return _user_response(current_user)


# ---------------------------------------------------------------------------
# Admin-Only User Management
# ---------------------------------------------------------------------------

@router.get("/users")
async def list_users(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """List all users (admin only)."""
    result = await db.execute(select(User).order_by(User.created_at))
    users = result.scalars().all()
    return [_user_response(u) for u in users]


@router.post("/users", status_code=status.HTTP_201_CREATED)
async def create_user(
    request: Request,
    body: CreateUserRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Create a new user (admin only)."""
    # Check for duplicate username
    result = await db.execute(select(User).where(User.username == body.username))
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Username already exists",
        )

    # Check for duplicate email
    if body.email:
        result = await db.execute(select(User).where(User.email == body.email))
        if result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Email already exists",
            )

    # Validate password policy
    policy_error = validate_password_policy(body.password)
    if policy_error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=policy_error,
        )

    user = User(
        username=body.username,
        email=body.email,
        hashed_password=hash_password(body.password),
        role=body.role,
        is_active=True,
    )
    db.add(user)
    await db.flush()

    await log_action(
        db, "user.created", user=current_user,
        resource_type="user", resource_id=user.id,
        details={"username": user.username, "role": user.role},
        request=request,
    )

    return _user_response(user)


@router.patch("/users/{user_id}")
async def update_user(
    request: Request,
    user_id: str,
    body: UpdateUserRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Update a user's role or active status (admin only)."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    # Prevent removing the last admin
    if user.role == "admin" and (
        (body.role is not None and body.role != "admin")
        or (body.is_active is not None and not body.is_active)
    ):
        admin_count_result = await db.execute(
            select(func.count(User.id)).where(
                User.role == "admin", User.is_active == True  # noqa: E712
            )
        )
        admin_count = admin_count_result.scalar()
        if admin_count <= 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot remove or deactivate the last admin",
            )

    changes = {}
    if body.role is not None:
        changes["role"] = {"from": user.role, "to": body.role}
        user.role = body.role
    if body.is_active is not None:
        changes["is_active"] = {"from": user.is_active, "to": body.is_active}
        user.is_active = body.is_active
    user.updated_at = datetime.now(timezone.utc)

    await db.flush()

    await log_action(
        db, "user.updated", user=current_user,
        resource_type="user", resource_id=user.id,
        details={"target_username": user.username, "changes": changes},
        request=request,
    )

    return _user_response(user)


@router.delete("/users/{user_id}")
async def delete_user(
    request: Request,
    user_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Delete a user (admin only). Cannot delete self or the last admin."""
    if user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete your own account",
        )

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    # Prevent deleting the last admin
    if user.role == "admin":
        admin_count_result = await db.execute(
            select(func.count(User.id)).where(
                User.role == "admin", User.is_active == True  # noqa: E712
            )
        )
        admin_count = admin_count_result.scalar()
        if admin_count <= 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot delete the last admin",
            )

    deleted_username = user.username
    deleted_role = user.role
    await db.delete(user)
    await db.flush()

    await log_action(
        db, "user.deleted", user=current_user,
        resource_type="user", resource_id=user_id,
        details={"deleted_username": deleted_username, "deleted_role": deleted_role},
        request=request,
    )

    return {"message": "User deleted"}
