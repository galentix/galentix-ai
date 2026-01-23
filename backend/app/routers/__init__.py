# Galentix AI - API Routers
from .chat import router as chat_router
from .conversations import router as conversations_router
from .documents import router as documents_router
from .search import router as search_router
from .system import router as system_router

__all__ = [
    "chat_router",
    "conversations_router", 
    "documents_router",
    "search_router",
    "system_router"
]
