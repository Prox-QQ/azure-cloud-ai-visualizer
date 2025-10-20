import json
import logging
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)


async def generate_bicep_code(agent_client: Any, diagram: Dict[str, Any], use_model: bool = False) -> Dict[str, Any]:
    """Generate Bicep using AI with MCP enhancement when available.

    Returns a dict with keys: 'bicep_code' and 'parameters'.
    """
    # Try MCP-enhanced generation first if available
    try:
        if agent_client and hasattr(agent_client, 'generate_bicep_via_mcp'):
            logger.debug('Calling MCP-enhanced agent.generate_bicep_via_mcp')
            raw = await agent_client.generate_bicep_via_mcp(diagram)
            if isinstance(raw, dict) and raw.get('bicep_code'):
                # Add MCP flag to parameters to indicate enhanced generation was used
                raw.setdefault('parameters', {})['mcp_enhanced'] = True
                return raw
    except Exception as e:
        logger.warning(f'MCP-enhanced bicep generation failed, falling back to standard: {e}')

    # Fall back to standard agent method
    try:
        if agent_client and hasattr(agent_client, 'generate_bicep_code'):
            logger.debug('Calling standard agent.generate_bicep_code')
            raw = await agent_client.generate_bicep_code(architecture_description={'diagram': diagram}, include_monitoring=True, include_security=True)
            if isinstance(raw, dict) and raw.get('bicep_code'):
                return raw
            if isinstance(raw, str):
                try:
                    return json.loads(raw)
                except Exception:
                    return {'bicep_code': raw, 'parameters': {}}
    except Exception:
        logger.exception('Standard agent bicep generation failed')

    # NO DETERMINISTIC FALLBACKS - AI ONLY!
    logger.error("All AI bicep generation methods failed - no deterministic fallbacks allowed")
    return {'bicep_code': '', 'parameters': {'error': 'AI generation failed - no deterministic fallbacks allowed'}}
