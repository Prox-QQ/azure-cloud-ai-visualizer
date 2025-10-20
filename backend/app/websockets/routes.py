"""WebSocket routes for real-time communication."""

import logging
from uuid import uuid4

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, Request

from app.websockets.handlers import handle_chat_websocket, handle_deployment_websocket
from app.core.azure_client import AzureClientManager

logger = logging.getLogger(__name__)
router = APIRouter()


def get_azure_clients(request: Request) -> AzureClientManager:
    """Dependency to get Azure clients from app state."""
    return request.app.state.azure_clients


@router.websocket("/chat/{client_id}")
async def websocket_chat_endpoint(
    websocket: WebSocket,
    client_id: str,
    azure_clients: AzureClientManager = Depends(get_azure_clients)
):
    """WebSocket endpoint for real-time chat with the Azure Architect Agent."""
    await handle_chat_websocket(websocket, client_id, azure_clients)


@router.websocket("/chat")
async def websocket_chat_endpoint_auto_id(
    websocket: WebSocket,
    azure_clients: AzureClientManager = Depends(get_azure_clients)
):
    """WebSocket endpoint for real-time chat with auto-generated client ID."""
    client_id = str(uuid4())
    await handle_chat_websocket(websocket, client_id, azure_clients)


@router.websocket("/deployment/{client_id}")
async def websocket_deployment_endpoint(
    websocket: WebSocket,
    client_id: str,
    azure_clients: AzureClientManager = Depends(get_azure_clients)
):
    """WebSocket endpoint for real-time deployment monitoring."""
    await handle_deployment_websocket(websocket, client_id, azure_clients)


@router.websocket("/deployment")
async def websocket_deployment_endpoint_auto_id(
    websocket: WebSocket,
    azure_clients: AzureClientManager = Depends(get_azure_clients)
):
    """WebSocket endpoint for real-time deployment monitoring with auto-generated client ID."""
    client_id = str(uuid4())
    await handle_deployment_websocket(websocket, client_id, azure_clients)