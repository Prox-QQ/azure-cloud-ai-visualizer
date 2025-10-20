"""Shim / fallback for IaC endpoints when optional agent deps are missing."""

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from typing import Any, Dict

router = APIRouter()


class IaCGenerateRequest(BaseModel):
    diagram_data: Dict[str, Any]
    target_format: str = "bicep"
    include_monitoring: bool = True
    include_security: bool = True
    resource_naming_convention: str = "standard"


@router.post("/generate")
async def generate_iac_shim(request_data: IaCGenerateRequest):
    """Return a deterministic stub Bicep (or Terraform) template instead of 503.

    This keeps the frontend functional in dev environments without optional
    agent dependencies. It mirrors minimal behavior of the real endpoint.
    """
    nodes = (request_data.diagram_data or {}).get("nodes", [])
    edges = (request_data.diagram_data or {}).get("edges", [])
    fmt = request_data.target_format.lower()

    if fmt == "bicep":
        lines = []
        lines.append("// Stub Bicep template (agent deps missing)")
        lines.append("// Generated locally without AI model")
        lines.append("targetScope = 'resourceGroup'\n")
        lines.append("param location string = 'westeurope'")
        lines.append("param namePrefix string = 'stub'\n")
        lines.append("var uniqueSuffix = substring(uniqueString(resourceGroup().id), 0, 6)\n")
        for i, n in enumerate(nodes):
            title = str((n.get("data") or {}).get("title") or n.get("id") or f"resource{i}")
            sym = f"res{i}_stub"
            lines.append(f"// Placeholder for {title}")
            lines.append(f"resource {sym} 'Microsoft.Resources/deployments@2020-10-01' = {{")
            lines.append(f"  name: '${{namePrefix}}res${{uniqueSuffix}}{i}'")
            lines.append("  properties: { mode: 'Incremental', template: {} }")
            lines.append("}\n")
        content = "\n".join(lines)
        return {
            "id": "stub",
            "format": "bicep",
            "content": content,
            "parameters": {"stub": True, "nodeCount": len(nodes)},
            "created_at": "stub",
            "project_id": None,
        }
    else:
        # Terraform stub (very minimal)
        lines = ["# Stub Terraform template (agent deps missing)"]
        for i, n in enumerate(nodes):
            title = str((n.get("data") or {}).get("title") or n.get("id") or f"resource{i}")
            lines.append(f"# Placeholder for {title}")
        content = "\n".join(lines)
        return {
            "id": "stub",
            "format": fmt,
            "content": content,
            "parameters": {"stub": True, "nodeCount": len(nodes)},
            "created_at": "stub",
            "project_id": None,
        }
