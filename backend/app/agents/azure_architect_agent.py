"""
Azure Architect MAF Agent

This module implements the Microsoft Agent Framework integration for:
- Chat-driven architecture planning
- IaC generation from ReactFlow diagrams
- Azure deployment guidance
- Tool calling for canvas operations
"""

import json
import logging
from typing import Any, Dict, List, Optional, Annotated, Union

from datetime import datetime

from pydantic import Field
from typing import Any as TypingAny, cast
try:
    from agent_framework import ChatAgent, ChatMessage, TextContent, UriContent
except Exception:
    # Optional dependencies - allow module to be imported in environments
    # where the agent_framework packages are not installed. Provide
    # lightweight placeholders so code that instantiates message helpers works.
    ChatAgent = None

    class ChatMessage:
        def __init__(self, role=None, contents=None):
            # contents is expected to be a sequence of content objects
            self.role = role
            self.contents = contents or []

        def __repr__(self):
            return f"ChatMessage(role={self.role!r}, contents={self.contents!r})"

    class TextContent:
        def __init__(self, text: str):
            self.text = text

        def __repr__(self):
            return f"TextContent(text={self.text!r})"

    class UriContent:
        def __init__(self, uri: str, media_type: str = None):
            self.uri = uri
            self.media_type = media_type

        def __repr__(self):
            return f"UriContent(uri={self.uri!r}, media_type={self.media_type!r})"

    class AzureAIAgentClient:  # placeholder
        pass

    class OpenAIAssistantsClient:  # placeholder
        pass

    class OpenAIResponsesClient:  # placeholder
        pass

# To keep static type checkers happy in environments where the real
# agent_framework types differ or aren't installed, normalize the names to
# a permissive Any type for internal use. This avoids brittle type-mismatch
# errors from the analyzer while preserving runtime behavior.
ChatAgent = TypingAny if ChatAgent is None else ChatAgent
ChatMessage = TypingAny if ChatMessage is None else ChatMessage
TextContent = TypingAny if TextContent is None else TextContent
UriContent = TypingAny if UriContent is None else UriContent
AzureAIAgentClient = cast(TypingAny, globals().get('AzureAIAgentClient') or TypingAny)
OpenAIAssistantsClient = cast(TypingAny, globals().get('OpenAIAssistantsClient') or TypingAny)
OpenAIResponsesClient = cast(TypingAny, globals().get('OpenAIResponsesClient') or TypingAny)

logger = logging.getLogger(__name__)


# Tool functions for the agent
def analyze_diagram(
    diagram_json: Annotated[str, Field(description="ReactFlow diagram JSON string")],
    target_region: Annotated[str, Field(description="Target Azure region for deployment")] = "westeurope"
) -> str:
    """Analyze a ReactFlow diagram and provide architecture insights."""
    try:
        # Parse diagram JSON safely
        if isinstance(diagram_json, str):
            try:
                diagram = json.loads(diagram_json)
            except Exception:
                diagram = {"nodes": [], "edges": []}
        elif isinstance(diagram_json, dict):
            diagram = diagram_json
        else:
            diagram = {"nodes": [], "edges": []}

        nodes = diagram.get("nodes", [])

        # Resource naming helpers and maps
        resource_symbols = {}

        def symbol_name(idx: int, kind: str) -> str:
            return f"res{idx}_{kind}"

        # Helper to safe-get data fields
        def get_field(d: dict, *keys, default=None):
            for k in keys:
                if k in d:
                    return d[k]
            return default

        # Normalize node metadata so generator can detect types
        for i, node in enumerate(nodes):
            node_data = node.get("data", {}) or {}
            title = str(get_field(node_data, "title", default=f"resource{i}"))
            # Try several places for a resource type: explicit resourceType, type, or title keywords
            rtype = get_field(node_data, "resourceType", "type", default=None)
            if isinstance(rtype, str) and rtype.strip() == "":
                rtype = None

            detected = None
            if rtype:
                rt = str(rtype).lower()
                if "storage" in rt:
                    detected = "storage"
                elif "web" in rt or "function" in rt:
                    detected = "function"
                elif "sql" in rt and "cosmos" not in rt:
                    detected = "sql"
                elif "cosmos" in rt:
                    detected = "cosmos"
                elif "redis" in rt:
                    detected = "redis"
                elif "network" in rt or "vnet" in rt:
                    detected = "vnet"

            if detected is None:
                lt = title.lower()
                if "storage" in lt or "blob" in lt:
                    detected = "storage"
                elif "function" in lt or "func" in lt:
                    detected = "function"
                elif "sql" in lt or "database" in lt:
                    detected = "sql"
                elif "cosmos" in lt:
                    detected = "cosmos"
                elif "redis" in lt:
                    detected = "redis"
                elif "vnet" in lt or "subnet" in lt or "network" in lt:
                    detected = "vnet"
                elif "monitor" in lt or "activity log" in lt or "advisor" in lt or "insights" in lt:
                    detected = "monitor"
                elif "identity" in (node_data.get("category") or "").lower() or "active directory" in lt or "ad" in lt:
                    detected = "identity"
                elif "machine" in lt or "ml" in lt or "learning" in lt or "ai" in (node_data.get("category") or "").lower():
                    detected = "machinelearning"
                else:
                    detected = "generic"

            resource_symbols[node.get("id", str(i))] = {
                "symbol": symbol_name(i, detected),
                "kind": detected,
                "title": title,
                "data": node_data,
                "index": i,
            }

        return json.dumps(resource_symbols, indent=2)

    except Exception as e:
        logger.error(f"Error analyzing diagram: {e}")
        return json.dumps({"error": str(e)})


def plan_deployment(
    resource_group: Annotated[str, Field(description="Target resource group name")],
    subscription_id: Annotated[str, Field(description="Azure subscription ID")],
    bicep_content: Annotated[str, Field(description="Bicep template content")]
) -> str:
    """Create a deployment plan for the given Bicep template."""
    try:
        plan = {
            "deployment_name": f"azarch-deploy-{datetime.now().strftime('%Y%m%d-%H%M%S')}",
            "subscription_id": subscription_id,
            "resource_group": resource_group,
            "template_size": len(bicep_content),
            "estimated_resources": bicep_content.count("resource "),
            "deployment_mode": "Incremental",
            "validation_required": True,
            "estimated_duration": "5-10 minutes",
            "next_steps": [
                "Validate Bicep template syntax",
                "Run what-if deployment analysis",
                "Execute deployment with monitoring"
            ]
        }
        
        return json.dumps(plan, indent=2)
        
    except Exception as e:
        return f"Error creating deployment plan: {str(e)}"


def generate_reactflow_diagram(
    architecture_description: Annotated[str, Field(description="Natural language description of the architecture")],
    include_connections: Annotated[bool, Field(description="Whether to include connections between services")] = True
) -> str:
    """Generate a ReactFlow diagram JSON from architecture description."""
    try:
        # Parse common Azure services from description
        services = []
        service_mapping = {
            "web app": {"type": "azure.appservice", "icon": "mdi:web"},
            "function": {"type": "azure.functions", "icon": "mdi:lambda"},
            "storage": {"type": "azure.storage", "icon": "mdi:database"},
            "database": {"type": "azure.sql", "icon": "mdi:database-outline"},
            "cosmos": {"type": "azure.cosmos", "icon": "mdi:database-outline"},
            "redis": {"type": "azure.redis", "icon": "mdi:memory"},
            "api management": {"type": "azure.apim", "icon": "mdi:api"},
            "front door": {"type": "azure.frontdoor", "icon": "mdi:door"},
            "application gateway": {"type": "azure.appgateway", "icon": "mdi:gateway"},
            "openai": {"type": "azure.openai", "icon": "mdi:robot"},
            "ai search": {"type": "azure.search", "icon": "mdi:magnify"},
            "key vault": {"type": "azure.keyvault", "icon": "mdi:key"},
            "monitor": {"type": "azure.monitor", "icon": "mdi:monitor"},
            "insights": {"type": "azure.insights", "icon": "mdi:chart-line"}
        }
        
        description_lower = architecture_description.lower()
        node_id = 1
        
        # Generate nodes based on detected services
        nodes = []
        edges = []
        
        for service_name, service_config in service_mapping.items():
            if service_name in description_lower:
                node = {
                    "id": f"node_{node_id}",
                    "type": "azureService",
                    "position": {"x": (node_id - 1) * 200 + 100, "y": 100 + ((node_id - 1) % 3) * 150},
                    "data": {
                        "title": service_name.title(),
                        "subtitle": "Azure Service",
                        "icon": service_config["icon"],
                        "type": service_config["type"],
                        "status": "inactive"
                    }
                }
                nodes.append(node)
                node_id += 1
        
        # Generate basic connections if requested
        if include_connections and len(nodes) > 1:
            for i in range(len(nodes) - 1):
                edge = {
                    "id": f"edge_{i}",
                    "source": nodes[i]["id"],
                    "target": nodes[i + 1]["id"],
                    "type": "default",
                    "data": {"protocol": "HTTPS"}
                }
                edges.append(edge)
        
        # Create ReactFlow diagram
        diagram = {
            "nodes": nodes,
            "edges": edges,
            "viewport": {"x": 0, "y": 0, "zoom": 1}
        }
        
        return json.dumps(diagram, indent=2)
        
    except Exception as e:
        return f"Error generating ReactFlow diagram: {str(e)}"


# REMOVED: Deterministic generate_bicep_code function
# User requirement: Only use AI for IaC generation, no deterministic fallbacks


def analyze_image_for_architecture(
    image_url: Annotated[str, Field(description="URL of the architecture diagram image")],
    target_region: Annotated[str, Field(description="Target Azure region")] = "westeurope"
) -> str:
    """Analyze an uploaded architecture diagram image and provide insights."""
    try:
        # This function will be used with vision-capable models
        # The actual image analysis will be done by the LLM with vision capabilities
        analysis = {
            "image_url": image_url,
            "target_region": target_region,
            "analysis_type": "architecture_diagram",
            "timestamp": datetime.now().isoformat(),
            "note": "Image analysis will be performed by the AI model with vision capabilities"
        }
        
        return json.dumps(analysis, indent=2)
        
    except Exception as e:
        return f"Error analyzing image: {str(e)}"


class AzureArchitectAgent:
    """Azure Architect MAF Agent for chat-driven architecture planning."""

    def __init__(self, agent_client: TypingAny):
        # Use permissive typing for the injected client to avoid static
        # mismatches with optional dependencies in different environments.
        self.agent_client = agent_client
        self.chat_agent = None
        self.use_vision = hasattr(agent_client, "create_agent") or hasattr(agent_client, "chat")
        
    async def initialize(self) -> None:
        """Initialize the chat agent with tools."""
        logger.info("Initializing Azure Architect MAF Agent...")
        
        # Define all tools including new vision and diagram generation tools
        tools = [analyze_diagram, plan_deployment, generate_reactflow_diagram]
        
        # Add vision tool only for OpenAI Responses client
        if self.use_vision:
            tools.append(analyze_image_for_architecture)
        
        instructions = """You are the Azure Architect Agent, an expert in Azure cloud architecture and Infrastructure as Code.

Your capabilities include:
1. Analyzing ReactFlow diagrams and providing architecture insights
2. Generating Bicep Infrastructure as Code from diagrams
3. Creating deployment plans for Azure resources
4. Generating ReactFlow diagrams from natural language descriptions
5. Analyzing uploaded architecture images (vision-enabled)
6. Providing best practices and recommendations

When users ask about their architecture:
- Ask for the diagram JSON if not provided
- Analyze the components and connections
- Suggest improvements and best practices
- Generate appropriate IaC templates
- Help plan deployments step by step
- Create visual diagrams from descriptions
- Analyze uploaded architecture images when provided

Always prioritize security, scalability, and cost optimization in your recommendations.
Use the available tools to analyze diagrams, generate code, and create visualizations when requested."""

        # Create agent with appropriate client
        # Create agent using whichever client API is available. Use getattr
        # to avoid static type errors when optional libs are missing.
        try:
            create_fn = getattr(self.agent_client, "create_agent", None)
            if callable(create_fn):
                # Some clients accept a name parameter; be permissive.
                try:
                    self.chat_agent = create_fn(name="AzureArchitectAgent", instructions=instructions, tools=tools)
                except TypeError:
                    # Fallback to calling without name
                    self.chat_agent = create_fn(instructions=instructions, tools=tools)
            else:
                # If the client doesn't provide create_agent, assume it can act
                # as a chat client directly or will be wrapped elsewhere.
                self.chat_agent = getattr(self.agent_client, "chat", None) or getattr(self.agent_client, "run", None)
        except Exception:
            self.chat_agent = None
        
        logger.info(f"Azure Architect MAF Agent initialized successfully (Vision: {self.use_vision})")
    
    async def chat(self, message: str, conversation_history: Optional[List[Dict[str, Any]]] = None) -> str:
        """Send a message to the agent and get a response."""
        if not self.chat_agent:
            raise RuntimeError("Agent not initialized")
        
        try:
            # Include conversation history if provided
            context = ""
            if conversation_history:
                context = "\n".join([
                    f"{msg['role']}: {msg['content']}" 
                    for msg in conversation_history[-10:]  # Last 10 messages
                ])
                message = f"Context:\n{context}\n\nUser: {message}"
            
            response = await self.chat_agent.run(message)
            return response.result
            
        except Exception as e:
            logger.error(f"Error in agent chat: {e}")
            return f"I apologize, but I encountered an error: {str(e)}"
    
    async def stream_chat(self, message: str, conversation_history: Optional[List[Dict[str, Any]]] = None):
        """Stream chat response from the agent."""
        if not self.chat_agent:
            raise RuntimeError("Agent not initialized")
        
        try:
            # Include conversation history if provided
            context = ""
            if conversation_history:
                context = "\n".join([
                    f"{msg['role']}: {msg['content']}" 
                    for msg in conversation_history[-10:]  # Last 10 messages
                ])
                message = f"Context:\n{context}\n\nUser: {message}"
            
            async for chunk in self.chat_agent.run_stream(message):
                if chunk.delta:
                    yield chunk.delta
                    
        except Exception as e:
            logger.error(f"Error in agent stream chat: {e}")
            yield f"I apologize, but I encountered an error: {str(e)}"
            
    async def analyze_image_with_chat(self, image_url: str, prompt: str = "Analyze this architecture diagram and create a ReactFlow diagram for it") -> str:
        """Analyze an image using vision capabilities (OpenAI only)."""
        if not self.use_vision or not self.chat_agent:
            return "Image analysis not available with current configuration"
        
        try:
            # If the ChatMessage/TextContent/UriContent helpers are available
            # and callable, use them; otherwise fall back to a simple text
            # prompt that includes the image URL.
            if callable(ChatMessage) and callable(TextContent) and callable(UriContent):
                message = ChatMessage(
                    role="user",
                    contents=[
                        TextContent(text=prompt),
                        UriContent(uri=image_url, media_type="image/jpeg")
                    ]
                )
                resp = await self.chat_agent.run(message)
                return getattr(resp, "result", str(resp))
            else:
                # Fallback: append image URL to the prompt
                text_prompt = f"{prompt}\nImage: {image_url}"
                resp = await self.chat_agent.run(text_prompt)
                return getattr(resp, "result", str(resp))
        except Exception as e:
            logger.error(f"Error in image analysis: {e}")
            return f"I apologize, but I encountered an error analyzing the image: {str(e)}"

    async def generate_bicep_code(self, architecture_description: Union[str, Dict[str, Any]], include_monitoring: bool = True, include_security: bool = True) -> Dict[str, Any]:
        """Compatibility wrapper used by the /api/iac endpoint.

        The endpoint historically called `agent.generate_bicep_code(...)`. The
        AzureArchitectAgent exposes the diagram-generation tool as a standalone
        function; here we provide an async wrapper that accepts either a
        pre-parsed diagram (dict) or a prompt string that contains a JSON
        'Diagram Data' block. It returns a dict with a `bicep_code` entry so
        the existing /api/iac flow continues to work.
        """
        try:
            # Normalize architecture_description into diagram dict
            # Ensure service_configs is always defined to avoid unbound variable
            service_configs = {}
            if isinstance(architecture_description, dict):
                # Support two shapes: either the diagram dict directly, or a
                # wrapper { "diagram": {...}, "service_configs": {...} }
                if "diagram" in architecture_description:
                    diagram = architecture_description.get("diagram") or {"nodes": [], "edges": []}
                    service_configs = architecture_description.get("service_configs") or {}
                else:
                    diagram = architecture_description
                    service_configs = {}
            else:
                raw_text = str(architecture_description)
                diagram = None
                marker = "Diagram Data:"
                if marker in raw_text:
                    idx = raw_text.index(marker) + len(marker)
                    rest = raw_text[idx:]
                    brace_start = rest.find('{')
                    if brace_start != -1:
                        depth = 0
                        end = -1
                        for i, ch in enumerate(rest[brace_start:]):
                            if ch == '{': depth += 1
                            elif ch == '}':
                                depth -= 1
                                if depth == 0:
                                    end = brace_start + i + 1
                                    break
                        if end != -1:
                            json_blob = rest[brace_start:end]
                            try:
                                diagram = json.loads(json_blob)
                            except Exception:
                                diagram = None
                if diagram is None:
                    try:
                        diagram = json.loads(raw_text)
                    except Exception:
                        diagram = {"nodes": [], "edges": []}

            # Decide if we should invoke the model. With MAF the user expects AI involvement.
            force_model = False
            if isinstance(architecture_description, dict):
                force_model = bool(architecture_description.get("_force_model", False))

            # If service_configs are provided, merge them into each node's data
            try:
                nodes = diagram.get("nodes", []) if isinstance(diagram, dict) else []
                if isinstance(service_configs, dict) and isinstance(nodes, list):
                    for n in nodes:
                        nid = n.get("id") or (n.get("data") or {}).get("id")
                        if not nid:
                            continue
                        sc = service_configs.get(nid)
                        if sc and isinstance(n.get("data"), dict):
                            # Merge shallowly; do not overwrite existing nested maps unless present
                            n_data = n.get("data") or {}
                            for k, v in (sc.items() if isinstance(sc, dict) else []):
                                if v is not None:
                                    n_data.setdefault(k, v)
                            n["data"] = n_data
            except Exception:
                # Non-fatal; proceed without enriched data
                pass

            # Always attempt model first if chat_agent exists (unless explicitly disabled via _force_model=False).
            if self.chat_agent:
                try:
                    instruction = (
                        "You are an Azure Cloud Infrastructure as Code generator. Given the diagram JSON under 'diagram', "
                        "produce a realistic production-ready Bicep template mapping each service to appropriate Azure resource types. "
                        "Infer sensible naming (using namePrefix param), add parameters for locations, SKUs, and secrets (but do NOT include secret values). "
                        "Include monitoring if include_monitoring is true and basic security best-practice resources (e.g., log analytics workspace) if include_security is true. "
                        "Return ONLY a JSON object with keys 'bicep_code' (string) and 'parameters' (object). No markdown, no commentary."
                    )
                    payload = {
                        "diagram": {"nodes": diagram.get("nodes", []), "edges": diagram.get("edges", [])},
                        "requirements": {
                            "target_format": "bicep",
                            "include_monitoring": include_monitoring,
                            "include_security": include_security,
                        },
                    }
                    prompt = f"{instruction}\n\nDiagram Data: {json.dumps(payload, separators=(',',':'))}"
                    resp = await self.chat_agent.run(prompt)
                    text = getattr(resp, "result", str(resp))
                    # Attempt robust JSON extraction
                    def _extract_json(txt: str):
                        start = txt.find('{')
                        if start == -1: return None
                        depth = 0
                        for i, ch in enumerate(txt[start:]):
                            if ch == '{': depth += 1
                            elif ch == '}':
                                depth -= 1
                                if depth == 0:
                                    end = start + i + 1
                                    try:
                                        return json.loads(txt[start:end])
                                    except Exception:
                                        return None
                        return None
                    parsed = _extract_json(text) or (json.loads(text) if text.strip().startswith('{') else None)
                    if parsed and isinstance(parsed, dict) and parsed.get("bicep_code"):
                        return {"bicep_code": parsed.get("bicep_code", ""), "parameters": parsed.get("parameters", {})}
                    else:
                        logger.warning("MAF agent returned no parsable bicep_code; falling back to deterministic generator")
                except Exception as e:
                    logger.exception("MAF model call failed, falling back to deterministic generator: %s", e)

            # No deterministic fallback - AI only!
            logger.error("AI generation failed and no deterministic fallback available")
            return {"bicep_code": "", "parameters": {"error": "AI generation failed - no deterministic fallback available"}}
        except Exception as e:
            logger.error(f"Error in generate_bicep_code wrapper: {e}")
            return {"bicep_code": "", "parameters": {}, "error": str(e)}

    async def generate_terraform_code(self, architecture_description: Union[str, Dict[str, Any]], include_monitoring: bool = True, include_security: bool = True, provider: str = "azurerm") -> Dict[str, Any]:
        """Generate Terraform HCL using AI-only approach."""
        if not self.chat_agent:
            raise RuntimeError("Agent not initialized")

        try:
            # Prepare the prompt based on input type
            if isinstance(architecture_description, dict):
                context = json.dumps(architecture_description, indent=2)
            else:
                context = str(architecture_description)

            monitoring_context = " Include monitoring and alerting resources." if include_monitoring else ""
            security_context = " Include security best practices and configurations." if include_security else ""

            tf_prompt = f"""
            Generate comprehensive Terraform HCL configuration for this Azure architecture:

            {context}

            Requirements:
            - Use {provider} provider
            - Include all necessary resource configurations
            - Add appropriate variables and outputs
            - Use consistent naming conventions
            - Include resource dependencies{monitoring_context}{security_context}

            Return ONLY valid JSON in this format:
            {{
                "terraform_code": "complete HCL configuration as string",
                "parameters": {{
                    "provider": "{provider}",
                    "region": "westeurope"
                }}
            }}
            """

            logger.debug("Generating Terraform via MAF agent")
            response = await self.chat_agent.run(tf_prompt)
            text = getattr(response, "result", str(response))

            # Extract JSON from response
            try:
                start = text.find('{')
                end = text.rfind('}') + 1
                if start >= 0 and end > start:
                    result = json.loads(text[start:end])
                    # Ensure expected structure
                    return {
                        "terraform_code": result.get("terraform_code", ""),
                        "parameters": result.get("parameters", {"provider": provider})
                    }
            except Exception as parse_error:
                logger.warning(f"Failed to parse Terraform JSON response: {parse_error}")
                # Return text as-is if JSON parsing fails
                return {
                    "terraform_code": text,
                    "parameters": {"provider": provider}
                }

        except Exception as e:
            logger.error(f"Error in generate_terraform_code: {e}")
            return {"terraform_code": "", "parameters": {"provider": provider}, "error": str(e)}

    async def generate_bicep_via_mcp(self, diagram: dict, region: str = "westeurope") -> dict:
        """
        Generate Bicep using MCP Bicep schema tools for enhanced accuracy.
        
        Uses the Azure Bicep MCP server to ground the LLM in current schemas,
        reducing hallucinations and improving template correctness.
        
        Returns {'bicep_code': str, 'parameters': dict}
        """
        if not self.chat_agent:
            raise RuntimeError("Agent not initialized")

        try:
            # Import and get MCP tool
            from app.deps import get_mcp_bicep_tool
            mcp_tool = await get_mcp_bicep_tool()
            
            if mcp_tool is None:
                logger.warning("MCP Bicep tool not available, falling back to standard generation")
                return await self.generate_bicep_code({"diagram": diagram})

            # Build instruction that emphasizes MCP usage
            instruction = (
                "You are an Azure IaC generator with access to Azure Bicep MCP tools. "
                "Use the MCP tools to look up correct resource types, properties, and API versions "
                "for each service in the diagram. Before emitting each resource block, verify "
                "required properties and allowed SKUs using MCP schema lookups. "
                "Return ONLY JSON with keys 'bicep_code' (string) and 'parameters' (object). "
                "No markdown, no commentary."
            )
            
            payload = {
                "diagram": {"nodes": diagram.get("nodes", []), "edges": diagram.get("edges", [])},
                "requirements": {
                    "target_format": "bicep",
                    "include_monitoring": True,
                    "include_security": True,
                    "region": region
                },
            }
            
            prompt = f"{instruction}\n\nDiagram Data: {json.dumps(payload, separators=(',',':'))}"

            # Run with MCP tool available by passing the tool into the run call
            # Note: agent_framework expects tools to be passed either at agent
            # creation or per-run; we provide the streamable MCP tool here.
            resp = await self.chat_agent.run(prompt, tools=mcp_tool)
            text = getattr(resp, "result", str(resp))

            # Robust JSON extraction (same as standard method)
            def _extract_json(txt: str):
                start = txt.find('{')
                if start == -1: 
                    return None
                depth = 0
                for i, ch in enumerate(txt[start:]):
                    if ch == '{': 
                        depth += 1
                    elif ch == '}':
                        depth -= 1
                        if depth == 0:
                            end = start + i + 1
                            try: 
                                return json.loads(txt[start:end])
                            except Exception: 
                                return None
                return None

            parsed = _extract_json(text) or (json.loads(text) if text.strip().startswith('{') else None)
            if not parsed or "bicep_code" not in parsed:
                raise ValueError("MCP-enhanced Bicep generation failed - no valid bicep_code returned")
                
            return {
                "bicep_code": parsed.get("bicep_code", ""),
                "parameters": parsed.get("parameters", {})
            }
            
        except Exception as e:
            logger.exception(f"MCP Bicep generation failed: {e}")
            # Fall back to standard generation if MCP fails
            logger.info("Falling back to standard Bicep generation")
            return await self.generate_bicep_code({"diagram": diagram})

    async def validate_bicep_with_mcp(self, bicep_code: str) -> dict:
        """
        Validate Bicep code using MCP tools for schema and syntax correctness.
        
        Returns {"valid": boolean, "errors": [str], "warnings": [str]}
        """
        if not self.chat_agent:
            return {"valid": False, "errors": ["Agent not initialized"]}

        try:
            from app.deps import get_mcp_bicep_tool
            mcp_tool = await get_mcp_bicep_tool()
            
            if mcp_tool is None:
                return {"valid": False, "errors": ["MCP Bicep tool not available"]}

            prompt = (
                "Validate this Bicep template for syntax and schema correctness using "
                "Azure Bicep MCP tools. Check resource types, properties, and API versions. "
                "Return ONLY JSON: {\"valid\": boolean, \"errors\": [\"...\"], \"warnings\": [\"...\"]}\n\n"
                f"```bicep\n{bicep_code}\n```"
            )
            
            resp = await self.chat_agent.run(prompt)
            text = getattr(resp, "result", str(resp))
            
            # Extract JSON from response
            try:
                start = text.find('{')
                end = text.rfind('}') + 1
                if start >= 0 and end > start:
                    validation_result = json.loads(text[start:end])
                    # Ensure expected structure
                    return {
                        "valid": validation_result.get("valid", False),
                        "errors": validation_result.get("errors", []),
                        "warnings": validation_result.get("warnings", [])
                    }
            except Exception:
                pass
                
            return {"valid": False, "errors": ["Unable to parse MCP validation response"]}
            
        except Exception as e:
            logger.exception(f"MCP Bicep validation failed: {e}")
            return {"valid": False, "errors": [f"Validation error: {str(e)}"]}

    async def generate_terraform_via_mcp(self, diagram: dict, provider: str = "azurerm") -> dict:
        """
        Generate Terraform configuration using MCP tools for schema grounding.
        
        Uses HashiCorp's Terraform MCP server to lookup provider schemas,
        resource types, and examples from the Terraform Registry before
        generating IaC code.
        """
        if not self.chat_agent:
            logger.warning("Agent not initialized, falling back to standard generation")
            return await self.generate_terraform_code({"diagram": diagram, "provider": provider})

        try:
            from app.deps import get_mcp_terraform_tool
            tf_mcp = await get_mcp_terraform_tool()
            
            if tf_mcp is None:
                logger.info("Terraform MCP tool not available, falling back to standard generation")
                return await self.generate_terraform_code({"diagram": diagram, "provider": provider})

            prompt = (
                "Generate Terraform modules for this Azure architecture diagram. "
                "Use the Terraform MCP tools to lookup providers, resources, arguments, and examples "
                "from the Terraform Registry before emitting code. Ensure all resource types and "
                "arguments are valid for the specified provider version. "
                "Return ONLY JSON: {'terraform_code': string, 'variables': object, 'outputs': object}.\n\n"
                f"Diagram: {json.dumps(diagram, separators=(',',':'))}\n"
                f"Provider: {provider}"
            )
            
            resp = await self.chat_agent.run(prompt, tools=tf_mcp)
            text = getattr(resp, "result", str(resp))
            
            # Extract JSON from response
            try:
                start = text.find('{')
                end = text.rfind('}') + 1
                if start >= 0 and end > start:
                    parsed = json.loads(text[start:end])
                    return {
                        "terraform_code": parsed.get("terraform_code", ""),
                        "variables": parsed.get("variables", {}),
                        "outputs": parsed.get("outputs", {}),
                        "provider": provider
                    }
            except Exception as parse_err:
                logger.warning(f"Failed to parse MCP Terraform response: {parse_err}")
                
            # If JSON parsing fails, extract text content
            logger.info("JSON parsing failed, attempting text extraction")
            return {
                "terraform_code": text,
                "variables": {},
                "outputs": {},
                "provider": provider
            }
            
        except Exception as e:
            logger.exception(f"MCP Terraform generation failed: {e}")
            # Fall back to standard generation if MCP fails
            logger.info("Falling back to standard Terraform generation")
            return await self.generate_terraform_code({"diagram": diagram, "provider": provider})

    async def validate_terraform_with_mcp(self, terraform_code: str, provider: str = "azurerm") -> dict:
        """
        Validate Terraform configuration using MCP tools for schema and syntax correctness.
        
        Returns {"valid": boolean, "errors": [str], "warnings": [str]}
        """
        if not self.chat_agent:
            return {"valid": False, "errors": ["Agent not initialized"]}

        try:
            from app.deps import get_mcp_terraform_tool
            tf_mcp = await get_mcp_terraform_tool()
            
            if tf_mcp is None:
                return {"valid": False, "errors": ["Terraform MCP tool not available"]}

            prompt = (
                "Validate this Terraform configuration for syntax and provider schema correctness using "
                "Terraform MCP tools. Check resource types, arguments, and provider requirements. "
                f"Provider: {provider}. "
                "Return ONLY JSON: {\"valid\": boolean, \"errors\": [\"...\"], \"warnings\": [\"...\"]}\n\n"
                f"```hcl\n{terraform_code}\n```"
            )
            
            resp = await self.chat_agent.run(prompt, tools=tf_mcp)
            text = getattr(resp, "result", str(resp))
            
            # Extract JSON from response
            try:
                start = text.find('{')
                end = text.rfind('}') + 1
                if start >= 0 and end > start:
                    validation_result = json.loads(text[start:end])
                    # Ensure expected structure
                    return {
                        "valid": validation_result.get("valid", False),
                        "errors": validation_result.get("errors", []),
                        "warnings": validation_result.get("warnings", [])
                    }
            except Exception:
                pass
                
            return {"valid": False, "errors": ["Unable to parse MCP validation response"]}
            
        except Exception as e:
            logger.exception(f"MCP Terraform validation failed: {e}")
            return {"valid": False, "errors": [f"Validation error: {str(e)}"]}

    async def get_terraform_provider_info_via_mcp(self, provider: str = "azurerm") -> dict:
        """
        Get provider information and available resources using Terraform MCP.
        
        Useful for understanding what resources are available for a given provider.
        """
        if not self.chat_agent:
            return {"error": "Agent not initialized"}

        try:
            from app.deps import get_mcp_terraform_tool
            tf_mcp = await get_mcp_terraform_tool()
            
            if tf_mcp is None:
                return {"error": "Terraform MCP tool not available"}

            prompt = (
                f"Get provider information for '{provider}' including available resource types, "
                "data sources, and recent version information using Terraform MCP tools. "
                "Return ONLY JSON: {\"provider\": string, \"version\": string, \"resources\": [string], \"data_sources\": [string]}"
            )
            
            resp = await self.chat_agent.run(prompt, tools=tf_mcp)
            text = getattr(resp, "result", str(resp))
            
            # Extract JSON from response
            try:
                start = text.find('{')
                end = text.rfind('}') + 1
                if start >= 0 and end > start:
                    return json.loads(text[start:end])
            except Exception:
                pass
                
            return {"error": "Unable to parse provider info response"}
            
        except Exception as e:
            logger.exception(f"MCP provider info lookup failed: {e}")
            return {"error": f"Provider info error: {str(e)}"}