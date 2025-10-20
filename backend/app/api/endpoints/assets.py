"""Asset management endpoints."""

import json
import logging
from datetime import datetime, timedelta
from typing import Dict, List
from uuid import uuid4

from fastapi import APIRouter, HTTPException, Request, Depends, UploadFile, File
from pydantic import BaseModel

from app.core.azure_client import AzureClientManager

logger = logging.getLogger(__name__)
router = APIRouter()


class AssetResponse(BaseModel):
    """Asset response model."""
    id: str
    name: str
    type: str  # 'bicep', 'terraform', 'image', 'document'
    size: int
    url: str
    created_at: datetime


def get_azure_clients(request: Request) -> AzureClientManager:
    """Dependency to get Azure clients from app state."""
    return request.app.state.azure_clients


@router.post("/upload", response_model=AssetResponse)
async def upload_asset(
    project_id: str,
    file: UploadFile = File(...),
    azure_clients: AzureClientManager = Depends(get_azure_clients)
) -> AssetResponse:
    """Upload an asset file."""
    try:
        asset_id = str(uuid4())
        now = datetime.utcnow()
        
        # Determine asset type based on file extension
        file_ext = file.filename.split('.')[-1].lower() if '.' in file.filename else ''
        asset_type = {
            'bicep': 'bicep',
            'tf': 'terraform',
            'json': 'document',
            'png': 'image',
            'jpg': 'image',
            'jpeg': 'image',
            'svg': 'image',
            'pdf': 'document',
            'md': 'document'
        }.get(file_ext, 'document')
        
        # Read file content
        content = await file.read()
        
        # Upload to blob storage
        blob_client = azure_clients.get_blob_client()
        container_name = "assets"
        blob_name = f"{project_id}/{asset_id}/{file.filename}"
        
        await blob_client.get_blob_client(
            container=container_name,
            blob=blob_name
        ).upload_blob(content, overwrite=True)
        
        # Generate SAS URL for access
        sas_url = await generate_sas_url(
            azure_clients, container_name, blob_name, hours=24
        )
        
        asset_data = {
            "id": asset_id,
            "name": file.filename,
            "type": asset_type,
            "size": len(content),
            "url": sas_url,
            "created_at": now,
        }
        
        logger.info(f"Uploaded asset {asset_id}: {file.filename}")
        return AssetResponse(**asset_data)
        
    except Exception as e:
        logger.error(f"Failed to upload asset: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to upload asset: {str(e)}")


@router.get("/{project_id}/assets", response_model=List[AssetResponse])
async def list_project_assets(
    project_id: str,
    azure_clients: AzureClientManager = Depends(get_azure_clients)
) -> List[AssetResponse]:
    """List all assets for a project."""
    try:
        blob_client = azure_clients.get_blob_client()
        container_name = "assets"
        
        assets = []
        async for blob in blob_client.get_container_client(container_name).list_blobs(
            name_starts_with=f"{project_id}/"
        ):
            # Parse asset info from blob path: project_id/asset_id/filename
            path_parts = blob.name.split('/')
            if len(path_parts) >= 3:
                asset_id = path_parts[1]
                filename = '/'.join(path_parts[2:])  # Handle nested paths
                
                # Generate fresh SAS URL
                sas_url = await generate_sas_url(
                    azure_clients, container_name, blob.name, hours=24
                )
                
                # Determine asset type
                file_ext = filename.split('.')[-1].lower() if '.' in filename else ''
                asset_type = {
                    'bicep': 'bicep',
                    'tf': 'terraform',
                    'json': 'document',
                    'png': 'image',
                    'jpg': 'image',
                    'jpeg': 'image',
                    'svg': 'image',
                    'pdf': 'document',
                    'md': 'document'
                }.get(file_ext, 'document')
                
                assets.append(AssetResponse(
                    id=asset_id,
                    name=filename,
                    type=asset_type,
                    size=blob.size,
                    url=sas_url,
                    created_at=blob.last_modified or datetime.utcnow()
                ))
        
        # Sort by created_at descending
        assets.sort(key=lambda a: a.created_at, reverse=True)
        return assets
        
    except Exception as e:
        logger.error(f"Failed to list assets for project {project_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to list assets: {str(e)}")


@router.delete("/{project_id}/assets/{asset_id}")
async def delete_asset(
    project_id: str,
    asset_id: str,
    azure_clients: AzureClientManager = Depends(get_azure_clients)
) -> Dict[str, str]:
    """Delete an asset."""
    try:
        blob_client = azure_clients.get_blob_client()
        container_name = "assets"
        
        # Find and delete all blobs for this asset
        deleted_count = 0
        async for blob in blob_client.get_container_client(container_name).list_blobs(
            name_starts_with=f"{project_id}/{asset_id}/"
        ):
            await blob_client.get_blob_client(
                container=container_name,
                blob=blob.name
            ).delete_blob()
            deleted_count += 1
        
        if deleted_count == 0:
            raise HTTPException(status_code=404, detail="Asset not found")
        
        logger.info(f"Deleted asset {asset_id} from project {project_id}")
        return {"message": f"Asset deleted successfully ({deleted_count} files)"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to delete asset {asset_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to delete asset: {str(e)}")


async def generate_sas_url(
    azure_clients: AzureClientManager,
    container_name: str,
    blob_name: str,
    hours: int = 24
) -> str:
    """Generate a SAS URL for blob access."""
    try:
        from azure.storage.blob import generate_blob_sas, BlobSasPermissions
        from azure.core.credentials import AzureNamedKeyCredential
        
        blob_client = azure_clients.get_blob_client()
        
        # Generate SAS token
        sas_token = generate_blob_sas(
            account_name=blob_client.account_name,
            container_name=container_name,
            blob_name=blob_name,
            credential=blob_client.credential,
            permission=BlobSasPermissions(read=True),
            expiry=datetime.utcnow() + timedelta(hours=hours)
        )
        
        # Construct SAS URL
        blob_url = blob_client.get_blob_client(
            container=container_name,
            blob=blob_name
        ).url
        
        return f"{blob_url}?{sas_token}"
        
    except Exception as e:
        logger.error(f"Failed to generate SAS URL: {e}")
        # Fallback to direct blob URL (may not work without proper access)
        return blob_client.get_blob_client(
            container=container_name,
            blob=blob_name
        ).url