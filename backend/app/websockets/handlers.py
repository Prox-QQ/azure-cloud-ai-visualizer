"""WebSocket handlers for real-time communication."""

import json
import logging
from typing import Dict, Any
from datetime import datetime

from fastapi import WebSocket, WebSocketDisconnect
from app.core.azure_client import AzureClientManager

logger = logging.getLogger(__name__)


class ConnectionManager:
    """Manages WebSocket connections."""
    
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
        self.conversation_connections: Dict[str, list] = {}
    
    async def connect(self, websocket: WebSocket, client_id: str):
        """Accept a WebSocket connection."""
        await websocket.accept()
        self.active_connections[client_id] = websocket
        logger.info(f"Client {client_id} connected")
    
    def disconnect(self, client_id: str):
        """Remove a WebSocket connection."""
        if client_id in self.active_connections:
            del self.active_connections[client_id]
            logger.info(f"Client {client_id} disconnected")
    
    async def send_personal_message(self, message: str, client_id: str):
        """Send a message to a specific client."""
        if client_id in self.active_connections:
            websocket = self.active_connections[client_id]
            await websocket.send_text(message)
    
    async def send_json_message(self, data: dict, client_id: str):
        """Send JSON data to a specific client."""
        if client_id in self.active_connections:
            websocket = self.active_connections[client_id]
            await websocket.send_json(data)
    
    def add_to_conversation(self, conversation_id: str, client_id: str):
        """Add client to conversation for broadcasting."""
        if conversation_id not in self.conversation_connections:
            self.conversation_connections[conversation_id] = []
        if client_id not in self.conversation_connections[conversation_id]:
            self.conversation_connections[conversation_id].append(client_id)
    
    async def broadcast_to_conversation(self, conversation_id: str, data: dict):
        """Broadcast message to all clients in a conversation."""
        if conversation_id in self.conversation_connections:
            clients = self.conversation_connections[conversation_id].copy()
            for client_id in clients:
                try:
                    await self.send_json_message(data, client_id)
                except Exception as e:
                    logger.warning(f"Failed to send to client {client_id}: {e}")
                    # Remove disconnected client
                    if client_id in self.conversation_connections[conversation_id]:
                        self.conversation_connections[conversation_id].remove(client_id)


# Global connection manager
manager = ConnectionManager()


async def handle_chat_websocket(websocket: WebSocket, client_id: str, azure_clients: AzureClientManager):
    """Handle WebSocket connections for chat."""
    await manager.connect(websocket, client_id)
    
    try:
        while True:
            # Receive message from client
            data = await websocket.receive_json()
            message_type = data.get("type")
            
            if message_type == "chat_message":
                await handle_chat_message(data, client_id, azure_clients)
            elif message_type == "join_conversation":
                await handle_join_conversation(data, client_id)
            elif message_type == "stream_chat":
                await handle_stream_chat(data, client_id, azure_clients)
            elif message_type == "analyze_diagram":
                await handle_analyze_diagram(data, client_id, azure_clients)
            else:
                await manager.send_json_message({
                    "type": "error",
                    "message": f"Unknown message type: {message_type}"
                }, client_id)
                
    except WebSocketDisconnect:
        manager.disconnect(client_id)
    except Exception as e:
        logger.error(f"WebSocket error for client {client_id}: {e}")
        await manager.send_json_message({
            "type": "error",
            "message": f"Server error: {str(e)}"
        }, client_id)


async def handle_chat_message(data: dict, client_id: str, azure_clients: AzureClientManager):
    """Handle regular chat messages."""
    try:
        message = data.get("message", "")
        conversation_id = data.get("conversation_id")
        context = data.get("context", {})
        
        if not message:
            await manager.send_json_message({
                "type": "error",
                "message": "Message is required"
            }, client_id)
            return
        
        # Get the agent
        agent = azure_clients.get_azure_architect_agent()
        
        # Send typing indicator
        await manager.send_json_message({
            "type": "typing",
            "conversation_id": conversation_id
        }, client_id)
        
        # Enhanced message with context
        enhanced_message = message
        if context:
            context_str = json.dumps(context, indent=2)
            enhanced_message = f"Context: {context_str}\n\nUser: {message}"
        
        # Get response from agent
        response = await agent.chat(enhanced_message)
        
        # Send response
        await manager.send_json_message({
            "type": "chat_response",
            "message": response,
            "conversation_id": conversation_id,
            "timestamp": datetime.utcnow().isoformat()
        }, client_id)
        
        # Broadcast to conversation if others are listening
        if conversation_id:
            await manager.broadcast_to_conversation(conversation_id, {
                "type": "conversation_update",
                "conversation_id": conversation_id,
                "user_message": message,
                "assistant_message": response,
                "timestamp": datetime.utcnow().isoformat()
            })
        
    except Exception as e:
        logger.error(f"Error handling chat message: {e}")
        await manager.send_json_message({
            "type": "error",
            "message": f"Failed to process message: {str(e)}"
        }, client_id)


async def handle_stream_chat(data: dict, client_id: str, azure_clients: AzureClientManager):
    """Handle streaming chat messages."""
    try:
        message = data.get("message", "")
        conversation_id = data.get("conversation_id")
        context = data.get("context", {})
        
        if not message:
            await manager.send_json_message({
                "type": "error",
                "message": "Message is required"
            }, client_id)
            return
        
        # Get the agent
        agent = azure_clients.get_azure_architect_agent()
        
        # Send start streaming indicator
        await manager.send_json_message({
            "type": "stream_start",
            "conversation_id": conversation_id
        }, client_id)
        
        # Enhanced message with context
        enhanced_message = message
        if context:
            context_str = json.dumps(context, indent=2)
            enhanced_message = f"Context: {context_str}\n\nUser: {message}"
        
        # Stream response from agent
        full_response = ""
        async for chunk in agent.stream_chat(enhanced_message):
            full_response += chunk
            await manager.send_json_message({
                "type": "stream_chunk",
                "chunk": chunk,
                "conversation_id": conversation_id
            }, client_id)
        
        # Send end streaming indicator
        await manager.send_json_message({
            "type": "stream_end",
            "conversation_id": conversation_id,
            "full_message": full_response,
            "timestamp": datetime.utcnow().isoformat()
        }, client_id)
        
        # Broadcast to conversation if others are listening
        if conversation_id:
            await manager.broadcast_to_conversation(conversation_id, {
                "type": "conversation_update",
                "conversation_id": conversation_id,
                "user_message": message,
                "assistant_message": full_response,
                "timestamp": datetime.utcnow().isoformat()
            })
        
    except Exception as e:
        logger.error(f"Error handling stream chat: {e}")
        await manager.send_json_message({
            "type": "error",
            "message": f"Failed to stream message: {str(e)}"
        }, client_id)


async def handle_join_conversation(data: dict, client_id: str):
    """Handle joining a conversation for real-time updates."""
    try:
        conversation_id = data.get("conversation_id")
        
        if not conversation_id:
            await manager.send_json_message({
                "type": "error",
                "message": "Conversation ID is required"
            }, client_id)
            return
        
        manager.add_to_conversation(conversation_id, client_id)
        
        await manager.send_json_message({
            "type": "conversation_joined",
            "conversation_id": conversation_id
        }, client_id)
        
    except Exception as e:
        logger.error(f"Error joining conversation: {e}")
        await manager.send_json_message({
            "type": "error",
            "message": f"Failed to join conversation: {str(e)}"
        }, client_id)


async def handle_analyze_diagram(data: dict, client_id: str, azure_clients: AzureClientManager):
    """Handle diagram analysis via WebSocket."""
    try:
        diagram_data = data.get("diagram_data")
        target_region = data.get("target_region", "westeurope")
        conversation_id = data.get("conversation_id")
        
        if not diagram_data:
            await manager.send_json_message({
                "type": "error",
                "message": "Diagram data is required"
            }, client_id)
            return
        
        # Get the agent
        agent = azure_clients.get_azure_architect_agent()
        
        # Send processing indicator
        await manager.send_json_message({
            "type": "analysis_start",
            "conversation_id": conversation_id
        }, client_id)
        
        # Analyze diagram
        diagram_json = json.dumps(diagram_data)
        analysis = await agent.analyze_diagram(diagram_json, target_region)
        
        # Send analysis result
        await manager.send_json_message({
            "type": "analysis_complete",
            "analysis": analysis,
            "conversation_id": conversation_id,
            "timestamp": datetime.utcnow().isoformat()
        }, client_id)
        
        # Broadcast to conversation if others are listening
        if conversation_id:
            await manager.broadcast_to_conversation(conversation_id, {
                "type": "diagram_analyzed",
                "conversation_id": conversation_id,
                "analysis": analysis,
                "timestamp": datetime.utcnow().isoformat()
            })
        
    except Exception as e:
        logger.error(f"Error analyzing diagram: {e}")
        await manager.send_json_message({
            "type": "error",
            "message": f"Failed to analyze diagram: {str(e)}"
        }, client_id)


async def handle_deployment_websocket(websocket: WebSocket, client_id: str, azure_clients: AzureClientManager):
    """Handle WebSocket connections for deployment monitoring."""
    await manager.connect(websocket, client_id)
    
    try:
        while True:
            # Receive message from client
            data = await websocket.receive_json()
            message_type = data.get("type")
            
            if message_type == "monitor_deployment":
                await handle_monitor_deployment(data, client_id, azure_clients)
            elif message_type == "get_deployment_logs":
                await handle_get_deployment_logs(data, client_id, azure_clients)
            else:
                await manager.send_json_message({
                    "type": "error",
                    "message": f"Unknown message type: {message_type}"
                }, client_id)
                
    except WebSocketDisconnect:
        manager.disconnect(client_id)
    except Exception as e:
        logger.error(f"WebSocket error for client {client_id}: {e}")
        await manager.send_json_message({
            "type": "error",
            "message": f"Server error: {str(e)}"
        }, client_id)


async def handle_monitor_deployment(data: dict, client_id: str, azure_clients: AzureClientManager):
    """Handle deployment monitoring requests."""
    try:
        deployment_id = data.get("deployment_id")
        
        if not deployment_id:
            await manager.send_json_message({
                "type": "error",
                "message": "Deployment ID is required"
            }, client_id)
            return
        
        # TODO: Implement real deployment monitoring
        # For now, send periodic updates
        await manager.send_json_message({
            "type": "deployment_status",
            "deployment_id": deployment_id,
            "status": "monitoring_started"
        }, client_id)
        
    except Exception as e:
        logger.error(f"Error monitoring deployment: {e}")
        await manager.send_json_message({
            "type": "error",
            "message": f"Failed to monitor deployment: {str(e)}"
        }, client_id)


async def handle_get_deployment_logs(data: dict, client_id: str, azure_clients: AzureClientManager):
    """Handle deployment log requests."""
    try:
        deployment_id = data.get("deployment_id")
        
        if not deployment_id:
            await manager.send_json_message({
                "type": "error",
                "message": "Deployment ID is required"
            }, client_id)
            return
        
        # Load logs from blob storage
        blob_client = azure_clients.get_blob_client()
        container_name = "deployments"
        blob_name = f"{deployment_id}/logs.json"
        
        try:
            blob_data = await blob_client.get_blob_client(
                container=container_name,
                blob=blob_name
            ).download_blob()
            
            logs_data = json.loads(await blob_data.readall())
            
            await manager.send_json_message({
                "type": "deployment_logs",
                "deployment_id": deployment_id,
                "logs": logs_data
            }, client_id)
            
        except Exception:
            # No logs found
            await manager.send_json_message({
                "type": "deployment_logs",
                "deployment_id": deployment_id,
                "logs": []
            }, client_id)
        
    except Exception as e:
        logger.error(f"Error getting deployment logs: {e}")
        await manager.send_json_message({
            "type": "error",
            "message": f"Failed to get deployment logs: {str(e)}"
        }, client_id)