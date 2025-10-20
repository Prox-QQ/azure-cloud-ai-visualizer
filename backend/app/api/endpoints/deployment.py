"""Deployment management endpoints."""

import json
import logging
from datetime import datetime
from typing import Any, Dict, List
from uuid import uuid4

from fastapi import APIRouter, HTTPException, Request, Depends
from pydantic import BaseModel

from app.core.azure_client import AzureClientManager

logger = logging.getLogger(__name__)
router = APIRouter()


class DeploymentRequest(BaseModel):
    """Deployment request model."""
    resource_group: str
    subscription_id: str
    template_content: str
    template_format: str = "bicep"  # 'bicep' or 'arm'
    parameters: Dict[str, Any] = {}
    validation_only: bool = False


class DeploymentResponse(BaseModel):
    """Deployment response model."""
    id: str
    name: str
    status: str  # 'pending', 'running', 'succeeded', 'failed'
    resource_group: str
    subscription_id: str
    template_format: str
    progress: int = 0
    created_at: datetime
    completed_at: datetime | None = None
    error_message: str | None = None
    deployed_resources: List[Dict[str, Any]] = []


class DeploymentLog(BaseModel):
    """Deployment log entry."""
    timestamp: datetime
    level: str  # 'info', 'warning', 'error'
    message: str
    operation: str | None = None


def get_azure_clients(request: Request) -> AzureClientManager:
    """Dependency to get Azure clients from app state."""
    return request.app.state.azure_clients


@router.post("/deploy", response_model=DeploymentResponse)
async def create_deployment(
    deployment_request: DeploymentRequest,
    project_id: str | None = None,
    azure_clients: AzureClientManager = Depends(get_azure_clients)
) -> DeploymentResponse:
    """Create a new deployment."""
    try:
        deployment_id = str(uuid4())
        now = datetime.utcnow()
        
        deployment_name = f"azarch-deploy-{now.strftime('%Y%m%d-%H%M%S')}"
        
        # Create deployment record
        deployment_data = {
            "id": deployment_id,
            "name": deployment_name,
            "status": "pending",
            "resource_group": deployment_request.resource_group,
            "subscription_id": deployment_request.subscription_id,
            "template_format": deployment_request.template_format,
            "template_content": deployment_request.template_content,
            "parameters": deployment_request.parameters,
            "validation_only": deployment_request.validation_only,
            "progress": 0,
            "created_at": now.isoformat(),
            "completed_at": None,
            "error_message": None,
            "deployed_resources": [],
            "project_id": project_id
        }
        
        # Save deployment record to blob storage
        blob_client = azure_clients.get_blob_client()
        container_name = "deployments"
        blob_name = f"{deployment_id}/deployment.json"
        
        await blob_client.get_blob_client(
            container=container_name,
            blob=blob_name
        ).upload_blob(json.dumps(deployment_data, indent=2), overwrite=True)
        
        # Start deployment process (async)
        # In a real implementation, this would trigger Azure deployment
        await _simulate_deployment_process(deployment_id, deployment_request, azure_clients)
        
        logger.info(f"Created deployment {deployment_id}: {deployment_name}")
        return DeploymentResponse(**deployment_data)
        
    except Exception as e:
        logger.error(f"Failed to create deployment: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to create deployment: {str(e)}")


@router.get("/{deployment_id}", response_model=DeploymentResponse)
async def get_deployment(
    deployment_id: str,
    azure_clients: AzureClientManager = Depends(get_azure_clients)
) -> DeploymentResponse:
    """Get deployment status."""
    try:
        blob_client = azure_clients.get_blob_client()
        container_name = "deployments"
        blob_name = f"{deployment_id}/deployment.json"
        
        blob_data = await blob_client.get_blob_client(
            container=container_name,
            blob=blob_name
        ).download_blob()
        
        deployment_data = json.loads(await blob_data.readall())
        return DeploymentResponse(**deployment_data)
        
    except Exception as e:
        logger.error(f"Failed to get deployment {deployment_id}: {e}")
        raise HTTPException(status_code=404, detail="Deployment not found")


@router.get("/{deployment_id}/logs", response_model=List[DeploymentLog])
async def get_deployment_logs(
    deployment_id: str,
    azure_clients: AzureClientManager = Depends(get_azure_clients)
) -> List[DeploymentLog]:
    """Get deployment logs."""
    try:
        blob_client = azure_clients.get_blob_client()
        container_name = "deployments"
        blob_name = f"{deployment_id}/logs.json"
        
        try:
            blob_data = await blob_client.get_blob_client(
                container=container_name,
                blob=blob_name
            ).download_blob()
            
            logs_data = json.loads(await blob_data.readall())
            return [DeploymentLog(**log) for log in logs_data]
            
        except Exception:
            # No logs found, return empty list
            return []
        
    except Exception as e:
        logger.error(f"Failed to get deployment logs {deployment_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get deployment logs: {str(e)}")


@router.post("/{deployment_id}/cancel")
async def cancel_deployment(
    deployment_id: str,
    azure_clients: AzureClientManager = Depends(get_azure_clients)
) -> Dict[str, str]:
    """Cancel a deployment."""
    try:
        # Get current deployment
        deployment = await get_deployment(deployment_id, azure_clients)
        
        if deployment.status in ["succeeded", "failed"]:
            raise HTTPException(status_code=400, detail="Cannot cancel completed deployment")
        
        # Update status to cancelled
        blob_client = azure_clients.get_blob_client()
        container_name = "deployments"
        blob_name = f"{deployment_id}/deployment.json"
        
        deployment_data = deployment.dict()
        deployment_data["status"] = "cancelled"
        deployment_data["completed_at"] = datetime.utcnow().isoformat()
        deployment_data["error_message"] = "Deployment cancelled by user"
        
        await blob_client.get_blob_client(
            container=container_name,
            blob=blob_name
        ).upload_blob(json.dumps(deployment_data, indent=2), overwrite=True)
        
        logger.info(f"Cancelled deployment {deployment_id}")
        return {"message": "Deployment cancelled successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to cancel deployment {deployment_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to cancel deployment: {str(e)}")


@router.get("/", response_model=List[DeploymentResponse])
async def list_deployments(
    project_id: str | None = None,
    status: str | None = None,
    azure_clients: AzureClientManager = Depends(get_azure_clients)
) -> List[DeploymentResponse]:
    """List deployments with optional filtering."""
    try:
        blob_client = azure_clients.get_blob_client()
        container_name = "deployments"
        
        deployments = []
        async for blob in blob_client.get_container_client(container_name).list_blobs():
            if blob.name.endswith("/deployment.json"):
                try:
                    blob_data = await blob_client.get_blob_client(
                        container=container_name,
                        blob=blob.name
                    ).download_blob()
                    
                    deployment_data = json.loads(await blob_data.readall())
                    
                    # Apply filters
                    if project_id and deployment_data.get("project_id") != project_id:
                        continue
                    if status and deployment_data.get("status") != status:
                        continue
                    
                    deployments.append(DeploymentResponse(**deployment_data))
                    
                except Exception as e:
                    logger.warning(f"Failed to load deployment from {blob.name}: {e}")
                    continue
        
        # Sort by created_at descending
        deployments.sort(key=lambda d: d.created_at, reverse=True)
        return deployments
        
    except Exception as e:
        logger.error(f"Failed to list deployments: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to list deployments: {str(e)}")


async def _simulate_deployment_process(
    deployment_id: str,
    deployment_request: DeploymentRequest,
    azure_clients: AzureClientManager
) -> None:
    """Simulate deployment process (in production, this would use Azure Resource Manager)."""
    import asyncio
    
    try:
        blob_client = azure_clients.get_blob_client()
        container_name = "deployments"
        
        # Create logs
        logs = []
        
        def add_log(level: str, message: str, operation: str = None):
            logs.append({
                "timestamp": datetime.utcnow().isoformat(),
                "level": level,
                "message": message,
                "operation": operation
            })
        
        # Update deployment status to running
        add_log("info", "Starting deployment process", "initialize")
        
        deployment_blob = f"{deployment_id}/deployment.json"
        blob_data = await blob_client.get_blob_client(
            container=container_name,
            blob=deployment_blob
        ).download_blob()
        
        deployment_data = json.loads(await blob_data.readall())
        deployment_data["status"] = "running"
        deployment_data["progress"] = 10
        
        await blob_client.get_blob_client(
            container=container_name,
            blob=deployment_blob
        ).upload_blob(json.dumps(deployment_data, indent=2), overwrite=True)
        
        # Simulate validation
        add_log("info", "Validating template syntax", "validate")
        await asyncio.sleep(1)
        deployment_data["progress"] = 30
        
        await blob_client.get_blob_client(
            container=container_name,
            blob=deployment_blob
        ).upload_blob(json.dumps(deployment_data, indent=2), overwrite=True)
        
        if deployment_request.validation_only:
            add_log("info", "Validation completed successfully", "validate")
            deployment_data["status"] = "succeeded"
            deployment_data["progress"] = 100
            deployment_data["completed_at"] = datetime.utcnow().isoformat()
        else:
            # Simulate deployment steps
            steps = [
                ("Creating resource group", 50),
                ("Deploying infrastructure", 70),
                ("Configuring resources", 90),
                ("Finalizing deployment", 100)
            ]
            
            for step_msg, progress in steps:
                add_log("info", step_msg, "deploy")
                await asyncio.sleep(2)
                deployment_data["progress"] = progress
                
                await blob_client.get_blob_client(
                    container=container_name,
                    blob=deployment_blob
                ).upload_blob(json.dumps(deployment_data, indent=2), overwrite=True)
            
            # Simulate deployed resources
            deployment_data["deployed_resources"] = [
                {"type": "Microsoft.Storage/storageAccounts", "name": "storageaccount001", "status": "Succeeded"},
                {"type": "Microsoft.Web/sites", "name": "webapp001", "status": "Succeeded"},
                {"type": "Microsoft.Insights/components", "name": "appinsights001", "status": "Succeeded"}
            ]
            
            add_log("info", "Deployment completed successfully", "complete")
            deployment_data["status"] = "succeeded"
            deployment_data["completed_at"] = datetime.utcnow().isoformat()
        
        # Save final deployment state
        await blob_client.get_blob_client(
            container=container_name,
            blob=deployment_blob
        ).upload_blob(json.dumps(deployment_data, indent=2), overwrite=True)
        
        # Save logs
        logs_blob = f"{deployment_id}/logs.json"
        await blob_client.get_blob_client(
            container=container_name,
            blob=logs_blob
        ).upload_blob(json.dumps(logs, indent=2), overwrite=True)
        
    except Exception as e:
        logger.error(f"Deployment simulation failed: {e}")
        # Update deployment as failed
        try:
            deployment_data["status"] = "failed"
            deployment_data["error_message"] = str(e)
            deployment_data["completed_at"] = datetime.utcnow().isoformat()
            
            await blob_client.get_blob_client(
                container=container_name,
                blob=deployment_blob
            ).upload_blob(json.dumps(deployment_data, indent=2), overwrite=True)
        except Exception as save_error:
            logger.error(f"Failed to save error state: {save_error}")