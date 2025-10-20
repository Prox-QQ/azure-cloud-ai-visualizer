Param(
  [string]$ResourceGroup = "myResourceGroup",
  [string]$AcrName = "myacr",
  [string]$FrontendImage = "$($AcrName).azurecr.io/myrepo-frontend:latest",
  [string]$BackendImage = "$($AcrName).azurecr.io/myrepo-backend:latest"
)

Write-Host "Deploying to Azure using ACR=$AcrName, RG=$ResourceGroup"

az group create -n $ResourceGroup -l westeurope | Out-Null

az appservice plan create -g $ResourceGroup -n webplan --is-linux --sku B1 -o none

az webapp create -g $ResourceGroup -p webplan -n cloud-visualizer-backend --deployment-container-image-name $BackendImage -o none

try {
  $acrId = az acr show -n $AcrName --query id -o tsv
  if ($acrId) {
    az webapp config container set -g $ResourceGroup -n cloud-visualizer-backend --docker-custom-image-name $BackendImage --docker-registry-server-url "https://$AcrName.azurecr.io" | Out-Null
    Write-Host "Configured backend webapp to use image $BackendImage"
  }
} catch {
  Write-Host "ACR $AcrName not found or accessible; ensure image is in a public registry or provide credentials."
}

az webapp create -g $ResourceGroup -p webplan -n cloud-visualizer-frontend --deployment-container-image-name $FrontendImage -o none
az webapp config container set -g $ResourceGroup -n cloud-visualizer-frontend --docker-custom-image-name $FrontendImage --docker-registry-server-url "https://$AcrName.azurecr.io" -o none

Write-Host "Deployment initiated. Check Azure Portal or use 'az webapp show' to inspect apps."