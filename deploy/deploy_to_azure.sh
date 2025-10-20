#!/usr/bin/env bash
# Deploy images to Azure Container Apps or App Service using ACR image
# Requires: az cli logged in and subscription set
# Usage: ./deploy_to_azure.sh <resource-group> <acr-name> <frontend-image> <backend-image>
set -euo pipefail
RG=${1:-myResourceGroup}
ACR=${2:-myacr}
FRONT_IMG=${3:-${ACR}.azurecr.io/myrepo-frontend:latest}
BACK_IMG=${4:-${ACR}.azurecr.io/myrepo-backend:latest}

echo "Deploying to Azure using ACR=${ACR}, RG=${RG}"

# Ensure resource group exists
az group create -n "$RG" -l westeurope

# Create App Service plan (Linux)
az appservice plan create -g "$RG" -n webplan --is-linux --sku B1 || true

# Create web app for backend
az webapp create -g "$RG" -p webplan -n cloud-visualizer-backend --deployment-container-image-name "$BACK_IMG" || true

# Configure webapp to pull from ACR (requires ACR and webapp in same subscription)
ACR_ID=$(az acr show -n "$ACR" --query id -o tsv || true)
if [ -n "$ACR_ID" ]; then
  az webapp config container set -g "$RG" -n cloud-visualizer-backend --docker-custom-image-name "$BACK_IMG" --docker-registry-server-url "https://${ACR}.azurecr.io"
  echo "Configured backend webapp to use image $BACK_IMG"
else
  echo "ACR $ACR not found or accessible; ensure image is in a public registry or provide credentials."
fi

# Note: Frontend can be served from static webapp or CDN. Creating a simple App Service for frontend as well:
az webapp create -g "$RG" -p webplan -n cloud-visualizer-frontend --deployment-container-image-name "$FRONT_IMG" || true
az webapp config container set -g "$RG" -n cloud-visualizer-frontend --docker-custom-image-name "$FRONT_IMG" --docker-registry-server-url "https://${ACR}.azurecr.io" || true

echo "Deployment initiated. Check Azure Portal or use 'az webapp show' to inspect apps."
