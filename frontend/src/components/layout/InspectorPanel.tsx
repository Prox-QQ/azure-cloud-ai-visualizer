import { Icon } from '@iconify/react';
import { useEffect, useState } from 'react';
import { useDiagramStore } from '@/store/diagramStore';
import { AzureService } from '@/data/azureServices';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// Small helper components for editing tags and endpoints as JSON text
type SelectedNodeLike = { id: string; data?: Record<string, unknown> };
const TagsEditor = ({ selectedNode, updateNodeData }: { selectedNode: SelectedNodeLike; updateNodeData: (id: string, patch: Record<string, unknown>) => void }) => {
  const initial = selectedNode.data?.tags ? JSON.stringify(selectedNode.data.tags, null, 2) : '{}';
  const [text, setText] = useState(initial);

  useEffect(() => {
    setText(selectedNode.data?.tags ? JSON.stringify(selectedNode.data.tags, null, 2) : '{}');
  }, [selectedNode]);

  return (
    <textarea
      className="w-full h-24 p-2 bg-muted/10 rounded border border-muted/20 text-sm overflow-auto"
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        try {
          const parsed = JSON.parse(text || '{}');
          updateNodeData(selectedNode.id, { tags: parsed });
        } catch (err) {
          // ignore parse errors for now
        }
      }}
    />
  );
};

const EndpointsEditor = ({ selectedNode, updateNodeData }: { selectedNode: SelectedNodeLike; updateNodeData: (id: string, patch: Record<string, unknown>) => void }) => {
  const initial = selectedNode.data?.endpoints ? JSON.stringify(selectedNode.data.endpoints, null, 2) : '[]';
  const [text, setText] = useState(initial);

  useEffect(() => {
    setText(selectedNode.data?.endpoints ? JSON.stringify(selectedNode.data.endpoints, null, 2) : '[]');
  }, [selectedNode]);

  return (
    <textarea
      className="w-full h-28 p-2 bg-muted/10 rounded border border-muted/20 text-sm overflow-auto"
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        try {
          const parsed = JSON.parse(text || '[]');
          if (Array.isArray(parsed)) {
            updateNodeData(selectedNode.id, { endpoints: parsed });
          }
        } catch (err) {
          // ignore parse errors
        }
      }}
    />
  );
};

const InspectorPanel = () => {
  const { selectedNode, updateNodeData } = useDiagramStore();

  const nodeData = (selectedNode?.data || {}) as any;

  const update = (patch: Record<string, unknown>) => updateNodeData(selectedNode!.id, patch);

  // Helpers for conditional rendering based on resource type substrings
  const rt = (nodeData.resourceType || '').toLowerCase();
  const isAppServicePlan = rt.includes('serverfarms');
  const isWebApp = rt.includes('sites');
  const isCosmos = rt.includes('documentdb') || rt.includes('databaseaccounts');
  const isKeyVault = rt.includes('keyvault');
  const isSearch = rt.includes('search/searchservices');
  const hasIdentity = !!nodeData.identity || isWebApp;

  if (!selectedNode) {
    return (
      <aside className="glass-panel border-l border-border/50 w-80 p-6 flex flex-col items-center justify-center text-center">
        <Icon icon="mdi:information-outline" className="text-4xl text-muted-foreground mb-3" />
        <h3 className="font-semibold text-sm mb-1">No Node Selected</h3>
        <p className="text-xs text-muted-foreground">
          Select a node from the canvas to view and edit its properties
        </p>
      </aside>
    );
  }

  return (
  <aside className="glass-panel border-l border-border/50 w-80 flex flex-col h-full min-h-0">
      <div className="p-4 border-b border-border/50">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <Icon icon="mdi:tune" className="text-primary" />
          Inspector
        </h2>
      </div>

  <Tabs defaultValue="properties" className="flex-1 flex flex-col min-h-0">
        <TabsList className="mx-4 mt-4 grid w-[calc(100%-2rem)] grid-cols-2">
          <TabsTrigger value="properties">Properties</TabsTrigger>
          <TabsTrigger value="animation">Animation</TabsTrigger>
        </TabsList>

  <TabsContent value="properties" className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
          <div className="space-y-2">
            <Label htmlFor="node-title">Title</Label>
            <Input
              id="node-title"
              value={nodeData.title || ''}
              onChange={(e) => updateNodeData(selectedNode.id, { title: e.target.value })}
              className="bg-muted/30"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="node-subtitle">Subtitle</Label>
            <Input
              id="node-subtitle"
              value={nodeData.subtitle || ''}
              onChange={(e) => updateNodeData(selectedNode.id, { subtitle: e.target.value })}
              className="bg-muted/30"
              placeholder="Optional"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="node-region">Region</Label>
            <Input
              id="node-region"
              value={nodeData.region || ''}
              onChange={(e) => updateNodeData(selectedNode.id, { region: e.target.value })}
              className="bg-muted/30"
              placeholder="e.g., westeurope"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="node-resourceType">Resource Type</Label>
            <Input
              id="node-resourceType"
              value={nodeData.resourceType || ''}
              onChange={(e) => updateNodeData(selectedNode.id, { resourceType: e.target.value })}
              className="bg-muted/30"
              placeholder="e.g., Microsoft.Storage/storageAccounts"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="node-resourceGroup">Resource Group</Label>
            <Input
              id="node-resourceGroup"
              value={nodeData.resourceGroup || ''}
              onChange={(e) => updateNodeData(selectedNode.id, { resourceGroup: e.target.value })}
              className="bg-muted/30"
              placeholder="e.g., rg-myapp-prod"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="node-subscription">Subscription ID</Label>
            <Input
              id="node-subscription"
              value={nodeData.subscriptionId || ''}
              onChange={(e) => updateNodeData(selectedNode.id, { subscriptionId: e.target.value })}
              className="bg-muted/30"
              placeholder="Subscription ID"
            />
          </div>

          <div className="space-y-2">
            <Label>Status</Label>
            <div className="flex gap-2">
              {['inactive', 'active', 'warning', 'error'].map((status) => (
                <button
                  key={status}
                  onClick={() => updateNodeData(selectedNode.id, { status })}
                  className={`flex-1 py-2 px-3 rounded text-xs font-medium transition-colors ${
                    nodeData.status === status
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted/30 hover:bg-muted/50'
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Badges</Label>
            <div className="flex flex-wrap gap-2">
              {nodeData.badges?.map((badge: string, i: number) => (
                <Badge key={i} variant="secondary">
                  {badge}
                </Badge>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">Badge editing coming soon</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="node-provisioning">Provisioning State</Label>
            <Input
              id="node-provisioning"
              value={nodeData.provisioningState || ''}
              onChange={(e) => updateNodeData(selectedNode.id, { provisioningState: e.target.value })}
              className="bg-muted/30"
              placeholder="Succeeded | Creating | Failed | Deleting"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="node-sku">SKU</Label>
            <Input
              id="node-sku"
              value={nodeData.sku || ''}
              onChange={(e) => updateNodeData(selectedNode.id, { sku: e.target.value })}
              className="bg-muted/30"
              placeholder="Optional SKU"
            />
          </div>

          {/* Structured SKU */}
          <div className="space-y-2">
            <Label>Structured SKU</Label>
            <div className="grid grid-cols-2 gap-2">
              <Input
                placeholder="tier"
                value={nodeData.skuObject?.tier || ''}
                onChange={(e) => update({ skuObject: { ...(nodeData.skuObject||{}), tier: e.target.value } })}
                className="bg-muted/30"
              />
              <Input
                placeholder="name"
                value={nodeData.skuObject?.name || ''}
                onChange={(e) => update({ skuObject: { ...(nodeData.skuObject||{}), name: e.target.value } })}
                className="bg-muted/30"
              />
              <Input
                placeholder="size"
                value={nodeData.skuObject?.size || ''}
                onChange={(e) => update({ skuObject: { ...(nodeData.skuObject||{}), size: e.target.value } })}
                className="bg-muted/30"
              />
              <Input
                placeholder="capacity"
                value={nodeData.skuObject?.capacity?.toString() || ''}
                onChange={(e) => {
                  const val = e.target.value.trim();
                  update({ skuObject: { ...(nodeData.skuObject||{}), capacity: val ? Number(val) : undefined } });
                }}
                className="bg-muted/30"
              />
            </div>
            <p className="text-xs text-muted-foreground">Use structured SKU when generating Bicep for plans or search services.</p>
          </div>

          {/* Identity */}
          {hasIdentity && (
            <div className="space-y-2">
              <Label>Identity</Label>
              <div className="grid grid-cols-2 gap-2">
                <Select
                  value={nodeData.identity?.type || 'None'}
                  onValueChange={(v) => update({ identity: { ...(nodeData.identity||{}), type: v as 'None' | 'SystemAssigned' | 'UserAssigned' | 'SystemAssigned,UserAssigned' } })}
                >
                  <SelectTrigger className="bg-muted/30"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="None">None</SelectItem>
                    <SelectItem value="SystemAssigned">SystemAssigned</SelectItem>
                    <SelectItem value="UserAssigned">UserAssigned</SelectItem>
                    <SelectItem value="SystemAssigned,UserAssigned">Both</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  placeholder="User Assigned IDs (comma)"
                  value={Object.keys(nodeData.identity?.userAssignedIdentities||{}).join(', ')}
                  onChange={(e) => {
                    const ids = e.target.value.split(',').map(s=>s.trim()).filter(Boolean);
                    const map: Record<string, object> = {};
                    ids.forEach(id => { map[id] = {}; });
                    update({ identity: { ...(nodeData.identity||{}), userAssignedIdentities: map } });
                  }}
                  className="bg-muted/30"
                />
              </div>
              <p className="text-xs text-muted-foreground">Configure managed identities for Web Apps or other resources.</p>
            </div>
          )}

          {/* App Service Config */}
          {(isWebApp) && (
            <div className="space-y-2">
              <Label>App Service Config</Label>
              <Input
                placeholder="linuxFxVersion (e.g. NODE|18-lts)"
                value={nodeData.appServiceConfig?.linuxFxVersion || ''}
                onChange={(e) => update({ appServiceConfig: { ...(nodeData.appServiceConfig||{}), linuxFxVersion: e.target.value } })}
                className="bg-muted/30"
              />
              <Input
                placeholder="httpsOnly true/false"
                value={nodeData.appServiceConfig?.httpsOnly ? 'true' : 'false'}
                onChange={(e) => update({ appServiceConfig: { ...(nodeData.appServiceConfig||{}), httpsOnly: e.target.value === 'true' } })}
                className="bg-muted/30"
              />
              <textarea
                placeholder='App Settings JSON array [{"name":"KEY","value":"VAL"}]'
                className="w-full h-24 p-2 bg-muted/30 rounded text-xs"
                value={JSON.stringify(nodeData.appServiceConfig?.appSettings||[], null, 2)}
                onChange={(e) => {
                  try {
                    const parsed = JSON.parse(e.target.value||'[]');
                    if (Array.isArray(parsed)) {
                      update({ appServiceConfig: { ...(nodeData.appServiceConfig||{}), appSettings: parsed as { name: string; value: string }[] } });
                    }
                  } catch (err) {
                    // ignore parse error
                  }
                }}
              />
            </div>
          )}

          {/* Cosmos DB */}
          {isCosmos && (
            <div className="space-y-2">
              <Label>Cosmos DB</Label>
              <Select
                value={nodeData.cosmosConfig?.consistencyLevel || 'Session'}
                onValueChange={(v) => update({ cosmosConfig: { ...(nodeData.cosmosConfig||{}), consistencyLevel: v as 'Strong' | 'BoundedStaleness' | 'Session' | 'ConsistentPrefix' | 'Eventual' } })}
              >
                <SelectTrigger className="bg-muted/30"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Strong">Strong</SelectItem>
                  <SelectItem value="BoundedStaleness">BoundedStaleness</SelectItem>
                  <SelectItem value="Session">Session</SelectItem>
                  <SelectItem value="ConsistentPrefix">ConsistentPrefix</SelectItem>
                  <SelectItem value="Eventual">Eventual</SelectItem>
                </SelectContent>
              </Select>
              <textarea
                placeholder='Locations JSON [{"locationName":"westeurope","failoverPriority":0}]'
                className="w-full h-20 p-2 bg-muted/30 rounded text-xs"
                value={JSON.stringify(nodeData.cosmosConfig?.locations||[], null, 2)}
                onChange={(e) => { try { const p = JSON.parse(e.target.value||'[]'); if(Array.isArray(p)) update({ cosmosConfig: { ...(nodeData.cosmosConfig||{}), locations: p as { locationName: string; failoverPriority: number; isZoneRedundant?: boolean }[] } }); } catch (err) { /* ignore */ } }}
              />
              <Input
                placeholder='Capabilities comma separated'
                value={(nodeData.cosmosConfig?.capabilities||[]).join(', ')}
                onChange={(e) => update({ cosmosConfig: { ...(nodeData.cosmosConfig||{}), capabilities: e.target.value.split(',').map(s=>s.trim()).filter(Boolean) } })}
                className="bg-muted/30"
              />
            </div>
          )}

          {/* Key Vault */}
          {isKeyVault && (
            <div className="space-y-2">
              <Label>Key Vault</Label>
              <Select
                value={nodeData.keyVaultConfig?.skuName || 'standard'}
                onValueChange={(v) => update({ keyVaultConfig: { ...(nodeData.keyVaultConfig||{}), skuName: v as 'standard' | 'premium' } })}
              >
                <SelectTrigger className="bg-muted/30"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="standard">standard</SelectItem>
                  <SelectItem value="premium">premium</SelectItem>
                </SelectContent>
              </Select>
              <textarea
                placeholder='Access Policies JSON'
                className="w-full h-24 p-2 bg-muted/30 rounded text-xs"
                value={JSON.stringify(nodeData.keyVaultConfig?.accessPolicies||[], null, 2)}
                onChange={(e) => { try { const p = JSON.parse(e.target.value||'[]'); if(Array.isArray(p)) update({ keyVaultConfig: { ...(nodeData.keyVaultConfig||{}), accessPolicies: p as { tenantId: string; objectId: string; permissions: { secrets?: string[]; keys?: string[]; certificates?: string[] } }[] } }); } catch (err) { /* ignore */ } }}
              />
              <div className="grid grid-cols-2 gap-2 text-xs">
                {['enabledForDeployment','enabledForTemplateDeployment','enabledForDiskEncryption','enablePurgeProtection','enableSoftDelete'].map(flag => (
                  <button
                    key={flag}
                    onClick={() => {
                      const current = nodeData.keyVaultConfig || {};
                      const currentVal = (current as Record<string, unknown>)[flag];
                      const newVal = !currentVal;
                      update({ keyVaultConfig: { ...current, [flag]: newVal as boolean } });
                    }}
                    className={`py-1 px-2 rounded border text-left ${nodeData.keyVaultConfig && (nodeData.keyVaultConfig as Record<string, unknown>)[flag] ? 'bg-primary text-primary-foreground' : 'bg-muted/30'}`}
                  >{flag}</button>
                ))}
              </div>
            </div>
          )}

          {/* Search Service */}
          {isSearch && (
            <div className="space-y-2">
              <Label>Search Service</Label>
              <Input
                placeholder='replicaCount'
                value={nodeData.searchConfig?.replicaCount?.toString() || ''}
                onChange={(e) => update({ searchConfig: { ...(nodeData.searchConfig||{}), replicaCount: e.target.value? Number(e.target.value): undefined } })}
                className="bg-muted/30"
              />
              <Input
                placeholder='partitionCount'
                value={nodeData.searchConfig?.partitionCount?.toString() || ''}
                onChange={(e) => update({ searchConfig: { ...(nodeData.searchConfig||{}), partitionCount: e.target.value? Number(e.target.value): undefined } })}
                className="bg-muted/30"
              />
              <Select
                value={nodeData.searchConfig?.hostingMode || 'default'}
                onValueChange={(v) => update({ searchConfig: { ...(nodeData.searchConfig||{}), hostingMode: v as 'default' | 'highDensity' } })}
              >
                <SelectTrigger className="bg-muted/30"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">default</SelectItem>
                  <SelectItem value="highDensity">highDensity</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="node-tags">Tags (JSON)</Label>
            {/* tags edited as JSON text */}
            <TagsEditor selectedNode={selectedNode} updateNodeData={updateNodeData} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="node-endpoints">Endpoints (JSON)</Label>
            <EndpointsEditor selectedNode={selectedNode} updateNodeData={updateNodeData} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="node-publicip">Public IP</Label>
            <Input
              id="node-publicip"
              value={nodeData.publicIp || ''}
              onChange={(e) => updateNodeData(selectedNode.id, { publicIp: e.target.value || null })}
              className="bg-muted/30"
              placeholder="x.x.x.x"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="node-privateip">Private IP</Label>
            <Input
              id="node-privateip"
              value={nodeData.privateIp || ''}
              onChange={(e) => updateNodeData(selectedNode.id, { privateIp: e.target.value || null })}
              className="bg-muted/30"
              placeholder="10.x.x.x"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="node-dependson">Depends On (comma separated IDs)</Label>
            <Input
              id="node-dependson"
              value={((nodeData.dependsOn || []) as string[]).join(', ')}
              onChange={(e) => updateNodeData(selectedNode.id, { dependsOn: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
              className="bg-muted/30"
              placeholder="service-id-1, service-id-2"
            />
          </div>

          <div className="space-y-2">
            <Label>Timestamps</Label>
            <div className="text-xs text-muted-foreground">
              <div>Created: {nodeData.createdAt || '—'}</div>
              <div>Updated: {nodeData.updatedAt || '—'}</div>
            </div>
          </div>
        </TabsContent>

  <TabsContent value="animation" className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
          <div className="space-y-2">
            <Label>Animation Effect</Label>
            <Select
              value={nodeData.animationProfile?.effect || 'none'}
              onValueChange={(value) =>
                updateNodeData(selectedNode.id, {
                  animationProfile: {
                    ...(nodeData.animationProfile || {}),
                    effect: value,
                  },
                })
              }
            >
              <SelectTrigger className="bg-muted/30">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                <SelectItem value="pulse">Pulse</SelectItem>
                <SelectItem value="glow">Glow</SelectItem>
                <SelectItem value="rotate">Rotate</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Animation Speed</Label>
            <div className="flex items-center gap-4">
              <Slider
                value={[nodeData.animationProfile?.speed || 1]}
                onValueChange={(value) =>
                  updateNodeData(selectedNode.id, {
                    animationProfile: {
                      ...(nodeData.animationProfile || {}),
                      speed: value[0],
                    },
                  })
                }
                min={0.5}
                max={3}
                step={0.1}
                className="flex-1"
              />
              <span className="text-sm text-muted-foreground w-12 text-right">
                {(nodeData.animationProfile?.speed || 1).toFixed(1)}x
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Preview</Label>
            <div className="glass-panel p-6 rounded-lg flex items-center justify-center">
              <div
                className={`
                  p-4 rounded-xl bg-primary/20 transition-all
                  ${nodeData.animationProfile?.effect === 'pulse' ? 'animate-pulse' : ''}
                  ${nodeData.animationProfile?.effect === 'glow' ? 'glow-primary' : ''}
                  ${nodeData.animationProfile?.effect === 'rotate' ? 'animate-spin-slow' : ''}
                `}
              >
                {nodeData.iconPath ? (
                  <img
                    src={nodeData.iconPath}
                    alt={nodeData.title as string}
                    className="h-10 w-10 object-contain"
                  />
                ) : nodeData.icon ? (
                  <Icon icon={nodeData.icon as string} className="text-3xl text-primary" />
                ) : (
                  <Icon icon="mdi:cube-outline" className="text-3xl text-primary" />
                )}
              </div>
            </div>
          </div>

          <div className="glass-panel p-4 rounded-lg space-y-2">
            <div className="flex items-center gap-2">
              <Icon icon="mdi:information-outline" className="text-accent" />
              <h4 className="text-xs font-semibold">Animation Tips</h4>
            </div>
            <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
              <li>Use pulse for emphasis</li>
              <li>Glow for active services</li>
              <li>Rotate for processing/loading states</li>
            </ul>
          </div>
        </TabsContent>
      </Tabs>
    </aside>
  );
};

export default InspectorPanel;
