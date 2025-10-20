"""Project management endpoints."""

import json
import logging
from datetime import datetime, timedelta
from typing import Any, Dict, List
from uuid import uuid4

from fastapi import APIRouter, HTTPException, Request, Depends
from pydantic import BaseModel

# from app.core.azure_client import AzureClientManager
from app.core.config import settings

logger = logging.getLogger(__name__)
router = APIRouter()


class ProjectCreate(BaseModel):
    """Project creation request model."""
    name: str
    description: str = ""
    diagram_data: Dict[str, Any] = {}


class ProjectUpdate(BaseModel):
    """Project update request model."""
    name: str | None = None
    description: str | None = None
    diagram_data: Dict[str, Any] | None = None


class ProjectResponse(BaseModel):
    """Project response model."""
    id: str
    name: str
    description: str
    diagram_data: Dict[str, Any]
    created_at: datetime
    updated_at: datetime


def get_azure_clients(request: Request) -> AzureClientManager:
    """Dependency to get Azure clients from app state."""
    return request.app.state.azure_clients


@router.post("/", response_model=ProjectResponse)
async def create_project(
    project: ProjectCreate,
    azure_clients: AzureClientManager = Depends(get_azure_clients)
) -> ProjectResponse:
    """Create a new project."""
    try:
        project_id = str(uuid4())
        now = datetime.utcnow()
        
        project_data = {
            "id": project_id,
            "name": project.name,
            "description": project.description,
            "diagram_data": project.diagram_data,
            "created_at": now.isoformat(),
            "updated_at": now.isoformat(),
        }
        
        # Save to blob storage
        blob_client = azure_clients.get_blob_client()
        container_name = settings.AZURE_STORAGE_CONTAINER_NAME_PROJECTS
        blob_name = f"{project_id}/project.json"
        
        blob_data = json.dumps(project_data, indent=2)
        await blob_client.get_blob_client(
            container=container_name, 
            blob=blob_name
        ).upload_blob(blob_data, overwrite=True)
        
        logger.info(f"Created project {project_id}: {project.name}")
        return ProjectResponse(**project_data)
        
    except Exception as e:
        logger.error(f"Failed to create project: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to create project: {str(e)}")


@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(
    project_id: str,
    azure_clients: AzureClientManager = Depends(get_azure_clients)
) -> ProjectResponse:
    """Get a project by ID."""
    try:
        blob_client = azure_clients.get_blob_client()
        container_name = "projects"
        blob_name = f"{project_id}/project.json"
        
        blob_data = await blob_client.get_blob_client(
            container=container_name,
            blob=blob_name
        ).download_blob()
        
        project_data = json.loads(await blob_data.readall())
        return ProjectResponse(**project_data)
        
    except Exception as e:
        logger.error(f"Failed to get project {project_id}: {e}")
        raise HTTPException(status_code=404, detail="Project not found")


@router.put("/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: str,
    project_update: ProjectUpdate,
    azure_clients: AzureClientManager = Depends(get_azure_clients)
) -> ProjectResponse:
    """Update a project."""
    try:
        # First get the existing project
        existing_project = await get_project(project_id, azure_clients)
        
        # Update fields
        updated_data = existing_project.dict()
        if project_update.name is not None:
            updated_data["name"] = project_update.name
        if project_update.description is not None:
            updated_data["description"] = project_update.description
        if project_update.diagram_data is not None:
            updated_data["diagram_data"] = project_update.diagram_data
        
        updated_data["updated_at"] = datetime.utcnow().isoformat()
        
        # Save back to blob storage
        blob_client = azure_clients.get_blob_client()
        container_name = "projects"
        blob_name = f"{project_id}/project.json"
        
        blob_data = json.dumps(updated_data, indent=2)
        await blob_client.get_blob_client(
            container=container_name,
            blob=blob_name
        ).upload_blob(blob_data, overwrite=True)
        
        logger.info(f"Updated project {project_id}")
        return ProjectResponse(**updated_data)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update project {project_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to update project: {str(e)}")


@router.delete("/{project_id}")
async def delete_project(
    project_id: str,
    azure_clients: AzureClientManager = Depends(get_azure_clients)
) -> Dict[str, str]:
    """Delete a project."""
    try:
        blob_client = azure_clients.get_blob_client()
        container_name = "projects"
        
        # Delete the project blob
        blob_name = f"{project_id}/project.json"
        await blob_client.get_blob_client(
            container=container_name,
            blob=blob_name
        ).delete_blob()
        
        logger.info(f"Deleted project {project_id}")
        return {"message": "Project deleted successfully"}
        
    except Exception as e:
        logger.error(f"Failed to delete project {project_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to delete project: {str(e)}")


@router.get("/", response_model=List[ProjectResponse])
async def list_projects(
    azure_clients: AzureClientManager = Depends(get_azure_clients)
) -> List[ProjectResponse]:
    """List all projects."""
    try:
        blob_client = azure_clients.get_blob_client()
        container_name = "projects"
        
        projects = []
        async for blob in blob_client.get_container_client(container_name).list_blobs():
            if blob.name.endswith("/project.json"):
                try:
                    blob_data = await blob_client.get_blob_client(
                        container=container_name,
                        blob=blob.name
                    ).download_blob()
                    
                    project_data = json.loads(await blob_data.readall())
                    projects.append(ProjectResponse(**project_data))
                except Exception as e:
                    logger.warning(f"Failed to load project from {blob.name}: {e}")
                    continue
        
        # Sort by updated_at descending
        projects.sort(key=lambda p: p.updated_at, reverse=True)
        return projects
        
    except Exception as e:
        logger.error(f"Failed to list projects: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to list projects: {str(e)}")