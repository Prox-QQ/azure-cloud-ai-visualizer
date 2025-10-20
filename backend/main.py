"""
Azure Architect Backend - Main Application

FastAPI application providing REST API and WebSocket endpoints for:
- Project management with Azure Blob storage
- MAF agent chat integration
- IaC generation (Bicep/Terraform)
- Azure deployment orchestration
"""

import logging
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

from app.core.config import settings
from app.core.logging import setup_logging
import importlib
import warnings

# Runtime compatibility shim:
# Some released versions of agent-related packages place helper functions (e.g.
# `prepare_function_call_results`) inside submodules (for example
# `agent_framework.openai._shared`) while other packages import them from the
# top-level `agent_framework` package. This can cause an ImportError at import
# time when the top-level symbol isn't exported. To make the app more tolerant
# in local/dev environments we attempt to re-export the helper on the
# top-level module if it's present in the submodule.
try:
    af_shared = importlib.import_module("agent_framework.openai._shared")
    af_mod = importlib.import_module("agent_framework")
    if not hasattr(af_mod, "prepare_function_call_results") and hasattr(
        af_shared, "prepare_function_call_results"
    ):
        setattr(af_mod, "prepare_function_call_results", af_shared.prepare_function_call_results)
except Exception as _shim_err:  # pragma: no cover - environment-dependent
    # Non-fatal: if the import fails we'll fall back to guarded imports elsewhere
    warnings.warn(f"agent_framework compatibility shim not applied: {_shim_err}")

from app.api.routes import api_router
from app.websockets import websocket_router
from app.core.azure_client import AzureClientManager

# Set up logging
setup_logging()
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Application lifespan manager for startup/shutdown tasks."""
    logger.info("Starting Azure Architect Backend...")
    
    # Debug: Log registered routes
    logger.info("Registered routes:")
    for route in app.routes:
        route_path = getattr(route, 'path', str(route))
        route_methods = getattr(route, 'methods', ['WebSocket'])
        logger.info(f"  {route_path} ({route_methods})")
    
    # Initialize Azure client manager. This is optional in dev; initialize
    # and attach to app.state so request dependencies that expect it don't
    # crash. Initialization may log errors if credentials or agent deps are
    # missing, but we'll still attach the manager instance for graceful
    # handling at request time.
    azure_clients = AzureClientManager()
    try:
        await azure_clients.initialize()
        try:
            await azure_clients.ensure_containers_exist()
        except Exception:
            logger.debug("Could not ensure blob containers; continuing")
        app.state.azure_clients = azure_clients
        logger.info("Azure clients initialized and attached to app state")
    except Exception:
        logger.exception("Failed to initialize Azure/OpenAI clients; attaching manager anyway")
        # Attach the manager instance even if initialization failed so endpoints
        # can inspect and raise more helpful errors.
        app.state.azure_clients = azure_clients
    
    logger.info("Backend started successfully")
    yield
    
    # Cleanup
    logger.info("Shutting down Azure Architect Backend...")
    try:
        # Cleanup MCP tools
        from app.deps import cleanup_mcp_tools
        await cleanup_mcp_tools()
    except Exception as e:
        logger.warning(f"Error cleaning up MCP tools: {e}")
    
    try:
        await azure_clients.cleanup()
    except Exception as e:
        logger.warning(f"Error cleaning up Azure clients: {e}")
    
    logger.info("Backend shutdown complete")


# Create FastAPI app
app = FastAPI(
    title="Azure Architect Backend",
    description="Backend API for Azure architecture diagramming and deployment",
    version="0.1.0",
    lifespan=lifespan,
)

# Add middleware
app.add_middleware(GZipMiddleware, minimum_size=1000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(api_router, prefix="/api")
app.include_router(websocket_router, prefix="/ws")


@app.get("/")
async def root() -> dict[str, str]:
    """Root endpoint for health check."""
    return {"message": "Azure Architect Backend", "status": "running"}


@app.get("/health")
async def health_check() -> dict[str, str]:
    """Health check endpoint."""
    return {"status": "healthy"}


if __name__ == "__main__":
    # Use: uv run run-server
    # or: uv run uvicorn main:app --reload --port 8000
    pass