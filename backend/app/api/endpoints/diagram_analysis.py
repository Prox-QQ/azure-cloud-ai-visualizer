"""
API endpoint for analyzing architecture diagrams using OpenAI Vision
"""
import base64
import logging
import json
import re
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Optional
import os
import asyncio
from dotenv import load_dotenv
try:
    # Prefer the async client when available so we don't block the event loop
    from openai import AsyncOpenAI
except Exception:
    AsyncOpenAI = None
import openai

# Load environment variables
load_dotenv()

logger = logging.getLogger(__name__)
router = APIRouter()

# NOTE: We intentionally avoid creating a top-level OpenAI client here so that
# env changes during startup won't leave a stale client. The endpoint will
# create an AsyncOpenAI client per-request when needed (safe for async FastAPI).


def find_all_balanced_jsons(s: str) -> List[str]:
    """Return all balanced-brace substrings that look like JSON objects found in s."""
    results = []
    if not s:
        return results
    starts = [m.start() for m in re.finditer(r"\{", s)]
    for start_idx in starts:
        depth = 0
        for i, ch in enumerate(s[start_idx:], start=start_idx):
            if ch == '{':
                depth += 1
            elif ch == '}':
                depth -= 1
                if depth == 0:
                    cand = s[start_idx:i+1]
                    results.append(cand)
                    break
    return results


def extract_json_from_text(text: Optional[str]) -> Optional[dict]:
    """Attempt to extract a JSON object from free-form assistant text.

    Strategy:
    - If fenced ```json blocks exist, scan their contents for balanced JSON candidates.
    - Otherwise, scan the whole text for balanced JSON candidates.
    - Try candidates from largest->smallest, attempt json.loads, then simple repairs.
    - Return the first successfully decoded dict, or None.
    """
    if not text:
        return None

    candidates: List[str] = []

    # Prefer explicit fenced blocks first
    fenced = re.findall(r"```(?:json)?\s*([\s\S]*?)\s*```", text, re.IGNORECASE)
    if fenced:
        for block in fenced:
            block = block.strip()
            logger.info('Found fenced JSON block preview: %s', block[:200])
            candidates.extend(find_all_balanced_jsons(block) or [block])
    else:
        # No fences: try stripping triple-backticks then scanning
        stripped = re.sub(r"```[a-zA-Z0-9_+-]*", "", text)
        stripped = stripped.replace('```', '').strip()
        logger.info('No fenced block - using stripped text preview: %s', (stripped or '')[:200])
        candidates.extend(find_all_balanced_jsons(stripped))
        # Also scan the original text as a fallback
        candidates.extend(find_all_balanced_jsons(text))

    # Deduplicate while preserving order
    seen = set()
    uniq_candidates = []
    for c in candidates:
        if c and c not in seen:
            seen.add(c)
            uniq_candidates.append(c)

    # Sort by length (largest first) - prefer full objects
    uniq_candidates.sort(key=len, reverse=True)

    for idx, cand in enumerate(uniq_candidates):
        preview = (cand or '')[:400]
        logger.info('Trying JSON candidate #%d (len=%d): %s', idx + 1, len(cand or ''), preview)
        try:
            parsed = json.loads(cand)
            logger.info('Parsed JSON candidate #%d successfully', idx + 1)
            return parsed
        except Exception as e:
            logger.debug('Failed to json.loads candidate #%d: %s', idx + 1, str(e))
            # Attempt simple repairs
            # 1) Remove trailing commas before } or ]
            repaired = re.sub(r",\s*(\}|\])", r"\1", cand)
            try:
                parsed = json.loads(repaired)
                logger.info('Parsed repaired JSON candidate #%d successfully', idx + 1)
                return parsed
            except Exception:
                pass
            # 2) Replace single quotes with double quotes (best-effort)
            try:
                swapped = cand.replace("'", '"')
                parsed = json.loads(swapped)
                logger.info('Parsed single-quote-replaced candidate #%d successfully', idx + 1)
                return parsed
            except Exception:
                pass

    return None


def normalize_connections(analysis_json: dict) -> List[dict]:
    """Normalize connection entries into DiagramConnection objects.

    Handles keys like 'from', 'from_service', 'source', 'to', 'to_service', 'target'.
    Tries to match names to the canonical services list (case-insensitive or substring).
    Deduplicates connections.
    """
    services = analysis_json.get("services", []) or []
    raw_conns = analysis_json.get("connections", []) or []

    def pick_key(d: dict, candidates):
        for k in candidates:
            if k in d and isinstance(d[k], str):
                return d[k]
        return None

    def best_match(name: str) -> str:
        if not name:
            return ""
        n = name.strip()
        low = n.lower()
        # exact match
        for s in services:
            if isinstance(s, str) and s.lower() == low:
                return s
        # substring match
        for s in services:
            if isinstance(s, str) and (low in s.lower() or s.lower() in low):
                return s
        # no match - return original
        return n

    seen = set()
    out: List[dict] = []
    for rc in raw_conns:
        if not isinstance(rc, dict):
            continue
        raw_from = pick_key(rc, ("from_service", "from", "source", "src")) or ""
        raw_to = pick_key(rc, ("to_service", "to", "target", "dst")) or ""
        label = rc.get("label") or rc.get("type") or rc.get("relationship") or "connection"

        f = best_match(raw_from)
        t = best_match(raw_to)

        key = (f, t, label or "")
        if key in seen:
            continue
        seen.add(key)
        out.append({"from_service": f, "to_service": t, "label": label})

    return out


class ImageAnalysisRequest(BaseModel):
    image: str  # Base64 encoded image
    format: str  # Image format (e.g., "image/jpeg")

class DiagramConnection(BaseModel):
    from_service: str = ""
    to_service: str = ""
    label: Optional[str] = None

class DiagramAnalysisResult(BaseModel):
    services: List[str]
    connections: List[DiagramConnection]
    description: str
    suggested_services: List[str]

class ImageAnalysisResponse(BaseModel):
    analysis: DiagramAnalysisResult

@router.post("/analyze-diagram", response_model=ImageAnalysisResponse)
async def analyze_diagram(request: ImageAnalysisRequest, force_model: bool = False):
    """
    Analyze an uploaded architecture diagram using OpenAI Vision API
    """
    try:
        logger.info("Received diagram analysis request")
        
        # Validate the image input
        if not request.image or not isinstance(request.image, str) or len(request.image.strip()) == 0:
            raise HTTPException(status_code=400, detail="Missing or empty image data (expected base64 string without data: prefix)")

        # Prepare the image for OpenAI Vision API
        image_data = f"data:{request.format};base64,{request.image}"

        # Create the system prompt for diagram analysis
        system_prompt = """You are an expert Azure cloud architect analyzing architecture diagrams.

        Your task is to:
        1. Identify every individual Azure service or feature icon visible in the diagram — even if multiple appear inside one box (for example: Text Analytics, Translator, and Vision should each be listed separately, not grouped under 'Cognitive Services').
        2. Detect and describe all logical connections or data flows between services.
        3. Provide a concise summary of the architecture’s purpose and flow.
        4. Suggest additional Azure services that would strengthen or secure the architecture.

            Return your analysis strictly in this JSON format:
            {
                "services": ["Service Name 1", "Service Name 2", ...],
                "connections": [{"from_service": "Service A", "to_service": "Service B", "label": "connection type"}],
                "description": "Brief description of the architecture",
                "suggested_services": ["Suggested Service 1", "Suggested Service 2", ...]
            }

            Guidelines:
            - List every distinct Azure icon or capability you see (e.g., Azure Cognitive Services - Text Analytics, Translator, Vision, Azure Functions, AI Document Intelligence, Azure Machine Learning, Azure Cognitive Search, Blob Storage, Table Storage, Web Application, etc.).
            - Do **not** merge icons or label groups.
            - Be specific with complete Azure service names (e.g., 'Azure Cognitive Services - Text Analytics' instead of 'Cognitive Services').
            - Use precise connection labels (Ingestion, Enrichment, Projection, Query, Indexing, etc.).
            """


        # Call OpenAI Vision API using the async client if available. We send the
        # image as an inline data:<mime>;base64,... URL in the user message text
        # so that both async OpenAI clients and simple fallbacks can process it.
        response = None
        try:
            openai_api_key = os.getenv("OPENAI_API_KEY")
            if AsyncOpenAI is not None and openai_api_key:
                logger.info("Using AsyncOpenAI client for vision analysis")
                async_client = AsyncOpenAI(api_key=openai_api_key)
                try:
                    # Use proper OpenAI vision message format with separate image content
                    messages = [
                        {"role": "system", "content": system_prompt},
                        {
                            "role": "user", 
                            "content": [
                                {
                                    "type": "text",
                                    "text": "Please analyze this Azure architecture diagram and identify all services and their connections."
                                },
                                {
                                    "type": "image_url",
                                    "image_url": {
                                        "url": image_data,
                                        "detail": "low"  # Use "low" to reduce token usage
                                    }
                                }
                            ]
                        }
                    ]
                    # Cast to Any to avoid strict static type mismatch with the SDK
                    from typing import Any
                    messages_any: Any = messages
                    response = await async_client.chat.completions.create(
                        model=os.getenv("OPENAI_MODEL", "gpt-4o"),
                        messages=messages_any,
                        max_tokens=1500,
                        temperature=0.1
                    )
                finally:
                    # Close the async client to free resources if supported.
                    # The close helper may be sync or async depending on the SDK,
                    # so call it and await only if it returns a coroutine.
                    aclose = getattr(async_client, 'aclose', None) or getattr(async_client, 'close', None)
                    if callable(aclose):
                        try:
                            maybe_coro = aclose()
                            if asyncio.iscoroutine(maybe_coro):
                                await maybe_coro
                        except Exception:
                            pass
            else:
                # Fall back to the synchronous OpenAI client if present (best-effort)
                logger.info("AsyncOpenAI not available or OPENAI_API_KEY missing — trying sync client fallback")
                try:
                    # Some environments provide openai.OpenAI which may be sync
                    sync_client = getattr(openai, 'OpenAI', None)
                    if sync_client and os.getenv("OPENAI_API_KEY"):
                        client = sync_client(api_key=os.getenv("OPENAI_API_KEY"))
                        messages = [
                            {"role": "system", "content": system_prompt},
                            {
                                "role": "user", 
                                "content": [
                                    {
                                        "type": "text",
                                        "text": "Please analyze this Azure architecture diagram and identify all services and their connections."
                                    },
                                    {
                                        "type": "image_url",
                                        "image_url": {
                                            "url": image_data,
                                            "detail": "low"
                                        }
                                    }
                                ]
                            }
                        ]
                        # Cast messages to Any for compatibility with different SDK shapes
                        from typing import Any
                        messages_any: Any = messages
                        response = client.chat.completions.create(
                            model=os.getenv("OPENAI_MODEL", "gpt-4o"),
                            messages=messages_any,
                            max_tokens=1500,
                            temperature=0.1
                        )
                except Exception as e:
                    logger.warning("Sync OpenAI client call failed: %s", e)
                    response = None
        except Exception as e:
            logger.error("Failed to call OpenAI (vision) client: %s", e)
            response = None
        
        # Extract the response content and normalize to a string. If no model
        # response was obtained, fall back to the deterministic analyzer so the
        # frontend still receives a structured result instead of a 500.
        raw_content = None
        if response is None:
            logger.warning("No OpenAI response received — using deterministic image analyzer fallback")
            try:
                from app.agents.azure_architect_agent import analyze_image_for_architecture as deterministic_image_analyze
                raw_content = deterministic_image_analyze(image_data)
            except Exception as e:
                logger.error("Deterministic image analyzer failed: %s", e)
                raw_content = "{\"services\": [], \"connections\": [], \"description\": \"No analysis available\", \"suggested_services\": []}"
        else:
            try:
                # Support both async/sync client shapes. Prefer structured access
                # but fall back to stringifying the response when unsure.
                choices = getattr(response, 'choices', None)
                if choices and len(choices) > 0:
                    first = choices[0]
                    msg = getattr(first, 'message', None)
                    # If message is a dict-like mapping, read keys safely
                    if isinstance(msg, dict):
                        raw_content = msg.get('content') or msg.get('text') or str(msg)
                    else:
                        # Try attribute access, otherwise stringify
                        raw_content = getattr(msg, 'content', None) or getattr(msg, 'text', None) or str(first)
                else:
                    raw_content = str(response)
            except Exception as e:
                logger.error("Failed to extract content from OpenAI response: %s", e)
                raw_content = str(response)

        def normalize_content(c):
            # If it's already a string, return it
            if isinstance(c, str):
                return c
            # If it's a list of items, extract textual parts
            if isinstance(c, (list, tuple)):
                parts = []
                for item in c:
                    if isinstance(item, str):
                        parts.append(item)
                    elif isinstance(item, dict):
                        # Common shapes: {'type':'text','text':'...'} or {'text': '...'}
                        if 'text' in item and isinstance(item['text'], str):
                            parts.append(item['text'])
                        elif 'content' in item and isinstance(item['content'], str):
                            parts.append(item['content'])
                        else:
                            parts.append(str(item))
                    else:
                        parts.append(str(item))
                return '\n'.join(parts)
            # If it's a dict, try common keys
            if isinstance(c, dict):
                if 'content' in c and isinstance(c['content'], str):
                    return c['content']
                if 'text' in c and isinstance(c['text'], str):
                    return c['text']
                # fallback to string repr
                return json.dumps(c)
            # fallback
            return str(c)

        analysis_text = normalize_content(raw_content)
        logger.info('OpenAI Vision analysis (type=%s, len=%d): %s', type(raw_content).__name__, len(analysis_text or ''), analysis_text[:1000])

        # Parse the JSON response robustly (strip Markdown/code fences, extract JSON block)
        analysis_json = extract_json_from_text(analysis_text)
        if analysis_json is None:
            # If JSON parsing fails, extract information manually
            logger.warning("Failed to parse JSON response, using fallback parsing")
            # Try the deterministic analyzer from azure_architect_agent as a
            # final fallback. This will at least return structured symbols.
            try:
                from app.agents.azure_architect_agent import analyze_diagram as deterministic_analyze
                det = deterministic_analyze(analysis_text)
                # deterministic_analyze returns a JSON string of resource symbols
                try:
                    det_json = json.loads(det)
                    services = [v.get("title") for k, v in det_json.items() if isinstance(v, dict)]
                except Exception:
                    services = []
                analysis_json = {
                    "services": services,
                    "connections": [],
                    "description": (analysis_text or "").strip()[:200] + "...",
                    "suggested_services": []
                }
            except Exception:
                analysis_json = {
                    "services": [],
                    "connections": [],
                    "description": (analysis_text or "").strip()[:200] + "...",
                    "suggested_services": []
                }
        # --- Expand grouped or generic service names into detailed sub-services ---
        EXPANSION_MAP = {
            "Azure Cognitive Services": [
                "Azure Cognitive Services - Text Analytics",
                "Azure Cognitive Services - Translator",
                "Azure Cognitive Services - Vision"
            ],
            "Cognitive Services": [
                "Azure Cognitive Services - Text Analytics",
                "Azure Cognitive Services - Translator",
                "Azure Cognitive Services - Vision"
            ],
            "AI Search": ["Azure AI Search (Cognitive Search)"],
            "Azure AI Search": ["Azure AI Search (Cognitive Search)"],
            "AI Document Intelligence": ["Azure AI Document Intelligence (Form Recognizer)"],
            "Document Intelligence": ["Azure AI Document Intelligence (Form Recognizer)"]
        }

        expanded_services = []
        for s in analysis_json.get("services", []):
            expanded_services.extend(EXPANSION_MAP.get(s, [s]))

        # Deduplicate while preserving order
        analysis_json["services"] = list(dict.fromkeys(expanded_services))
        # Normalize and convert connections to the expected format
        raw_connections = normalize_connections(analysis_json)
        connections = [DiagramConnection(
            from_service=rc.get("from_service", ""),
            to_service=rc.get("to_service", ""),
            label=rc.get("label", "connection")
        ) for rc in raw_connections]

        # Create the analysis result
        result = DiagramAnalysisResult(
            services=analysis_json.get("services", []),
            connections=connections,
            description=analysis_json.get("description", "Architecture diagram analyzed"),
            suggested_services=analysis_json.get("suggested_services", [])
        )

        logger.info(f"Successfully analyzed diagram: found {len(result.services)} services")

        return ImageAnalysisResponse(analysis=result)
        
    except Exception as e:
        logger.error(f"Error analyzing diagram: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to analyze diagram: {str(e)}")