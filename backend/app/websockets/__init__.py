"""WebSocket module for real-time communication (simplified)."""

from .routes_simple import router as websocket_router
from .routes_simple import manager as connection_manager

# Note: Using simplified routes to avoid agent framework dependency issues
__all__ = ["websocket_router", "connection_manager"]