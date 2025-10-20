"""Dependency management for MCP tools and other shared resources."""

import os
import logging
from typing import Optional

logger = logging.getLogger(__name__)

# Global MCP tool instances for connection pooling
_mcp_bicep_tool: Optional[object] = None
_mcp_terraform_tool: Optional[object] = None


async def get_mcp_bicep_tool():
    """Get or create the Azure Bicep MCP tool singleton.
    
    Opens a persistent connection to the Azure Bicep MCP server for
    schema lookups and validation during IaC generation.
    """
    global _mcp_bicep_tool
    if _mcp_bicep_tool is None:
        try:
            from app.core.config import settings
            mcp_url = (settings.AZURE_MCP_BICEP_URL or "").strip()

            # Basic guard: don't attempt to initialize when no real MCP endpoint is configured
            force_init = os.getenv("AZURE_MCP_BICEP_FORCE", "false").lower() in ("1", "true", "yes")
            if (not mcp_url or "learn.microsoft.com" in mcp_url or "docs.microsoft.com" in mcp_url) and not force_init:
                logger.info(
                    "Azure Bicep MCP URL not configured or points to docs; skipping MCP initialization.\n"
                    "If you intend to use the official learn.microsoft.com MCP endpoint, ensure your environment supports a streamable MCP HTTP transport and set AZURE_MCP_BICEP_FORCE=true to force initialization.\n"
                    "Note: Browsers and plain HTTP POSTs won't work; use MCPStreamableHTTPTool from agent_framework which establishes a streaming MCP session."
                )
                return None

            # Import MCP tool from agent framework
            from agent_framework import MCPStreamableHTTPTool

            _mcp_bicep_tool = MCPStreamableHTTPTool(
                name="Azure Bicep MCP",
                url=mcp_url,
            )

            # Open connection once and reuse
            enter_method = getattr(_mcp_bicep_tool, '__aenter__', None)
            if enter_method:
                await enter_method()
            logger.info(f"Initialized Azure Bicep MCP tool at {mcp_url}")

        except ImportError:
            logger.warning("MCPStreamableHTTPTool not installed - MCP integration disabled.\n" \
                           "Install the agent_framework package that provides MCPStreamableHTTPTool to enable MCP features.")
            _mcp_bicep_tool = None
        except Exception as e:
            logger.error(f"Failed to initialize MCP Bicep tool: {e}")
            _mcp_bicep_tool = None
    
    return _mcp_bicep_tool


async def get_mcp_terraform_tool():
    """Get or create the HashiCorp Terraform MCP tool singleton.
    
    Opens a persistent connection to the HashiCorp Terraform MCP server for
    provider/resource schema lookups and validation during Terraform generation.
    """
    global _mcp_terraform_tool
    if _mcp_terraform_tool is None:
        try:
            from app.core.config import settings
            mcp_url = (settings.TERRAFORM_MCP_URL or "").strip()

            force_init = os.getenv("TERRAFORM_MCP_FORCE", "false").lower() in ("1", "true", "yes")
            if (not mcp_url or "developer.hashicorp.com" in mcp_url or "github.com/hashicorp" in mcp_url) and not force_init:
                logger.info(
                    "Terraform MCP URL not configured or points to docs; skipping MCP initialization.\n"
                    "If you intend to use the official HashiCorp MCP endpoint, ensure your environment supports a streamable MCP HTTP transport and set TERRAFORM_MCP_FORCE=true to force initialization.\n"
                    "Note: Browsers and plain HTTP POSTs won't work; use MCPStreamableHTTPTool from agent_framework which establishes a streaming MCP session."
                )
                return None

            # Import MCP tool from agent framework
            from agent_framework import MCPStreamableHTTPTool

            _mcp_terraform_tool = MCPStreamableHTTPTool(
                name="HashiCorp Terraform MCP",
                url=mcp_url,
            )

            # Open connection once and reuse
            enter_method = getattr(_mcp_terraform_tool, '__aenter__', None)
            if enter_method:
                await enter_method()
            logger.info(f"Initialized HashiCorp Terraform MCP tool at {mcp_url}")

        except ImportError:
            logger.warning("MCPStreamableHTTPTool not installed - Terraform MCP integration disabled.\n" \
                           "Install the agent_framework package that provides MCPStreamableHTTPTool to enable MCP features.")
            _mcp_terraform_tool = None
        except Exception as e:
            logger.error(f"Failed to initialize MCP Terraform tool: {e}")
            _mcp_terraform_tool = None
    
    return _mcp_terraform_tool


async def cleanup_mcp_tools():
    """Clean up MCP tool connections on app shutdown."""
    global _mcp_bicep_tool, _mcp_terraform_tool
    
    # Clean up Bicep MCP tool
    if _mcp_bicep_tool is not None:
        try:
            cleanup_method = getattr(_mcp_bicep_tool, '__aexit__', None)
            if cleanup_method:
                await cleanup_method(None, None, None)
            logger.info("Cleaned up MCP Bicep tool connection")
        except Exception as e:
            logger.warning(f"Error cleaning up MCP Bicep tool: {e}")
        finally:
            _mcp_bicep_tool = None
    
    # Clean up Terraform MCP tool
    if _mcp_terraform_tool is not None:
        try:
            cleanup_method = getattr(_mcp_terraform_tool, '__aexit__', None)
            if cleanup_method:
                await cleanup_method(None, None, None)
            logger.info("Cleaned up MCP Terraform tool connection")
        except Exception as e:
            logger.warning(f"Error cleaning up MCP Terraform tool: {e}")
        finally:
            _mcp_terraform_tool = None