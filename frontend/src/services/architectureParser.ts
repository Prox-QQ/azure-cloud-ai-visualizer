/**
 * Service to parse AI chat responses and extract Azure architecture components
 */

import { Node } from '@xyflow/react';
import { AzureService, azureServices } from '@/data/azureServices';
import iconIndex from '@/data/azureIconIndex.json';

type IconEntry = { title?: string; file?: string; id?: string };
type IconCategory = { icons?: IconEntry[] };
type IconIndex = { categories?: IconCategory[] };
import { BicepResourceMapper, BICEP_RESOURCE_MAPPINGS } from './bicepResourceMapper';

export interface ParsedArchitecture {
  services: AzureService[];
  connections: { from: string; to: string; label?: string }[];
  layout: 'horizontal' | 'vertical' | 'grid';
  bicepResources?: { resourceType: string; resourceName: string }[];
}

// Comprehensive mapping from service names and Bicep resource types to exact icon titles
const SERVICE_TO_ICON_MAPPINGS: { [key: string]: string } = {
  // App Services
  'app service': 'App Services',
  'web app': 'App Services',
  'azure app service': 'App Services',
  'webApp': 'App Services',
  'Microsoft.Web/sites': 'App Services',
  
  // Cosmos DB
  'cosmos db': 'Azure Cosmos Db',
  'azure cosmos db': 'Azure Cosmos Db',
  'cosmosdb': 'Azure Cosmos Db',
  'cosmos': 'Azure Cosmos Db',
  'Microsoft.DocumentDB/databaseAccounts': 'Azure Cosmos Db',
  
  // SQL Database
  'sql database': 'SQL Database',
  'azure sql': 'SQL Database', 
  'azure sql database': 'SQL Database',
  'Microsoft.Sql/servers': 'SQL Server',
  'Microsoft.Sql/servers/databases': 'SQL Database',
  
  // Storage
  'storage account': 'Storage Accounts',
  'storage accounts': 'Storage Accounts',
  'azure storage': 'Storage Accounts',
  'blob storage': 'Storage Accounts',
  'azure blob storage': 'Storage Accounts',
  'Microsoft.Storage/storageAccounts': 'Storage Accounts',
  
  // Functions
  'function app': 'Function Apps',
  'azure functions': 'Function Apps',
  'functions': 'Function Apps',
  'function apps': 'Function Apps',
  'Microsoft.Web/sites/functions': 'Function Apps',
  
  // Application Gateway
  'application gateway': 'Application Gateways',
  'azure application gateway': 'Application Gateways',
  'Microsoft.Network/applicationGateways': 'Application Gateways',
  
  // Virtual Network
  'virtual network': 'Virtual Networks',
  'vnet': 'Virtual Networks',
  'azure vnet': 'Virtual Networks',
  'Microsoft.Network/virtualNetworks': 'Virtual Networks',
  
  // Key Vault
  'key vault': 'Key Vaults',
  'azure key vault': 'Key Vaults',
  'Microsoft.KeyVault/vaults': 'Key Vaults',
  
  // Service Bus
  'service bus': 'Service Bus',
  'azure service bus': 'Service Bus',
  'Microsoft.ServiceBus/namespaces': 'Service Bus',
  
  // Redis Cache
  'redis cache': 'Cache Redis',
  'cache redis': 'Cache Redis',
  'azure cache for redis': 'Cache Redis',
  'Microsoft.Cache/Redis': 'Cache Redis',
  
  // Event Grid
  'event grid': 'Event Grid Topics',
  'azure event grid': 'Event Grid Topics',
  'Microsoft.EventGrid/topics': 'Event Grid Topics',
  
  // API Management
  'api management': 'API Management Services',
  'azure api management': 'API Management Services',
  'Microsoft.ApiManagement/service': 'API Management Services',
  
  // Container Registry
  'container registry': 'Container Registries',
  'azure container registry': 'Container Registries',
  'Microsoft.ContainerRegistry/registries': 'Container Registries',
  
  // Kubernetes Service
  'kubernetes service': 'Kubernetes Services',
  'aks': 'Kubernetes Services',
  'azure kubernetes service': 'Kubernetes Services',
  'Microsoft.ContainerService/managedClusters': 'Kubernetes Services',
  
  // Resource Groups
  'resource group': 'Resource Groups',
  'resource groups': 'Resource Groups',
  'Microsoft.Resources/resourceGroups': 'Resource Groups',
  
  // Service Plans
  'app service plan': 'App Service Plans',
  'service plan': 'App Service Plans',
  'Microsoft.Web/serverfarms': 'App Service Plans',
  
  // Data Factory
  'data factory': 'Data Factories',
  'azure data factory': 'Data Factories',
  'data factories': 'Data Factories',
  
  // Data Lake
  'data lake storage': 'Data Lake Store Gen1',
  'azure data lake storage': 'Data Lake Store Gen1',
  'data lake store': 'Data Lake Store Gen1',
  
  // Exact Bicep resource type mappings
  'microsoft.web/sites': 'App Services',
  'microsoft.documentdb/databaseaccounts': 'Azure Cosmos Db',
  'microsoft.web/serverfarms': 'App Service Plans',
};

export class ArchitectureParser {
  /**
   * Parse AI response and extract Azure services and their relationships
   */
  static parseResponse(response: string): ParsedArchitecture {
    const services: AzureService[] = [];
    const connections: { from: string; to: string; label?: string }[] = [];
    
    // Extract mentioned Azure services
    const mentionedServices = this.extractServices(response);
    console.log('🔍 Extracted service names:', mentionedServices);
    
    // Find actual Azure service objects
    for (const serviceName of mentionedServices) {
      const azureService = this.findAzureService(serviceName);
      console.log(`🎯 Looking for "${serviceName}" -> Found:`, azureService?.title || 'NOT FOUND');
      if (azureService && !services.find(s => s.id === azureService.id)) {
        services.push(azureService);
      }
    }
    
    console.log('✅ Final services for diagram:', services.map(s => s.title));
    
    // Extract connections from text patterns
    const extractedConnections = this.extractConnections(response, services);
    connections.push(...extractedConnections);
    
    return {
      services,
      connections,
      layout: services.length <= 3 ? 'horizontal' : services.length <= 6 ? 'vertical' : 'grid'
    };
  }
  
  /**
   * Extract Azure service names from text
   */
  private static extractServices(text: string): string[] {
    const services: string[] = [];
    const lowerText = text.toLowerCase();
    
    // Extract Bicep resource types - more comprehensive patterns
    const bicepResourcePatterns = [
      /Microsoft\.Web\/sites(?:\/\w+)?/gi,
      /Microsoft\.DocumentDB\/databaseAccounts/gi,
      /Microsoft\.Storage\/storageAccounts/gi,
      /Microsoft\.Sql\/servers(?:\/databases)?/gi,
      /Microsoft\.KeyVault\/vaults/gi,
      /Microsoft\.Network\/virtualNetworks/gi,
      /Microsoft\.Network\/applicationGateways/gi,
      /Microsoft\.Web\/serverfarms/gi,
      /Microsoft\.Cache\/Redis/gi,
      /Microsoft\.ServiceBus\/namespaces/gi,
      /Microsoft\.EventGrid\/topics/gi,
      /Microsoft\.ApiManagement\/service/gi,
      /Microsoft\.ContainerRegistry\/registries/gi,
      /Microsoft\.ContainerService\/managedClusters/gi,
    ];
    
    // Extract Bicep resource types and add them to services
    bicepResourcePatterns.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) {
        matches.forEach(match => {
          services.push(match.trim());
        });
      }
    });
    
    // Common service name patterns in natural language
    const serviceNamePatterns = [
      /\b(azure\s+)?app\s+service\b/gi,
      /\bweb\s+app\b/gi,
      /\b(azure\s+)?cosmos\s+db\b/gi,
      /\bcosmosdb\b/gi,
      /\b(azure\s+)?sql\s+(database|server)\b/gi,
      /\bstorage\s+account\b/gi,
      /\bblob\s+storage\b/gi,
      /\b(azure\s+)?function\s+app\b/gi,
      /\b(azure\s+)?functions\b/gi,
      /\b(azure\s+)?key\s+vault\b/gi,
      /\bvirtual\s+network\b/gi,
      /\bvnet\b/gi,
      /\bresource\s+group\b/gi,
      /\bapplication\s+gateway\b/gi,
    ];
    
    // Extract natural language service names
    serviceNamePatterns.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) {
        matches.forEach(match => {
          let serviceName = match.toLowerCase().trim();
          // Clean up common prefixes
          serviceName = serviceName.replace(/^(azure\s+|microsoft\s+)/, '');
          services.push(serviceName);
        });
      }
    });
    
    // Check for service mappings using comprehensive mappings
    Object.keys(SERVICE_TO_ICON_MAPPINGS).forEach(serviceName => {
      if (lowerText.includes(serviceName)) {
        services.push(serviceName);
      }
    });
    
    // Extract services from Bicep/ARM template code blocks using comprehensive mapper
    const bicepResourceTypes = BicepResourceMapper.extractResourceTypesFromBicep(text);
    bicepResourceTypes.forEach(resourceType => {
      const mapping = BicepResourceMapper.getMapping(resourceType);
      if (mapping) {
        services.push(mapping.serviceName.toLowerCase());
      }
    });
    
    // Also check for service names mentioned in comprehensive mappings
    BICEP_RESOURCE_MAPPINGS.forEach(mapping => {
      if (lowerText.includes(mapping.serviceName.toLowerCase()) || 
          lowerText.includes(mapping.iconTitle.toLowerCase())) {
        services.push(mapping.serviceName.toLowerCase());
      }
    });
    
    return [...new Set(services)]; // Remove duplicates
  }
  
  /**
   * Find Azure service object by name or type
   */
  static findAzureServiceByName(serviceName: string): AzureService | null {
    return this.findAzureService(serviceName);
  }

  /**
   * Find Azure service object by name or type (internal implementation)
   */
  private static findAzureService(serviceName: string): AzureService | null {
    const normalizedName = serviceName.toLowerCase();
    
    console.log(`🔍 Looking for service: "${serviceName}" (normalized: "${normalizedName}")`);
    
    // Try direct mapping to icon titles first
    const exactIconTitle = SERVICE_TO_ICON_MAPPINGS[normalizedName];
    if (exactIconTitle) {
      console.log(`✅ Found exact mapping: "${normalizedName}" -> "${exactIconTitle}"`);
      const service = azureServices.find(s => 
        (s.title || '').toLowerCase() === exactIconTitle.toLowerCase()
      );
      if (service) {
        console.log(`✅ Found Azure service:`, service.title);
        return service;
      } else {
        console.log(`❌ No Azure service found for icon title: "${exactIconTitle}"`);
      }
    }
    
    // Try Bicep resource mappings
    const bicepMapping = BICEP_RESOURCE_MAPPINGS.find(mapping => 
      mapping.serviceName.toLowerCase() === normalizedName ||
      mapping.iconTitle.toLowerCase() === normalizedName
    );
    
    if (bicepMapping) {
      console.log(`✅ Found Bicep mapping:`, bicepMapping);
      const service = azureServices.find(s => 
        (s.title || '').toLowerCase() === bicepMapping.iconTitle.toLowerCase()
      );
      if (service) {
        console.log(`✅ Found Azure service from Bicep mapping:`, service.title);
        return service;
      }
    }
    
    // Try fuzzy matching as last resort - but be more restrictive
    const fuzzyMatch = azureServices.find(service => {
      const serviceTitle = (service.title || '').toLowerCase();
      
      // Exact match
      if (serviceTitle === normalizedName) return true;
      
      // Don't match very short titles (like "Azure A") unless exact
      if (serviceTitle.length <= 8 && serviceTitle !== normalizedName) return false;
      
      // Only match if the normalized name is reasonably long
      if (normalizedName.length < 4) return false;
      
      // For Bicep resource types, only match if they contain the right parts
      if (normalizedName.includes('microsoft.')) {
        const parts = normalizedName.split('/');
        if (parts.length >= 2) {
          const resourceType = parts[parts.length - 1]; // e.g., "sites" from "Microsoft.Web/sites"
          return serviceTitle.includes(resourceType) || serviceTitle.includes(parts[0].replace('microsoft.', ''));
        }
      }
      
      // Contains match (both directions) - but with minimum length requirement
      if (normalizedName.length >= 6 && (serviceTitle.includes(normalizedName) || normalizedName.includes(serviceTitle))) {
        return true;
      }
      
      return false;
    });
    
    if (fuzzyMatch) {
      console.log(`🎯 Found fuzzy match: "${serviceName}" -> "${fuzzyMatch.title}"`);
      return fuzzyMatch;
    }
    
    // Ontology / icon-index based best-score fallback
    const ontologyMatch = this.findBestIconMatch(normalizedName);
    if (ontologyMatch) {
      console.log(`🎯 Found ontology/icon-index match: "${serviceName}" -> "${ontologyMatch.title}"`);
      return ontologyMatch;
    }

    console.log(`❌ No service found for: "${serviceName}"`);
    return null;
  }

  // Cache for icon titles extracted from azureIconIndex.json
  private static _iconTitleCache: string[] | null = null;

  /**
   * Find the best matching AzureService using the icon index ontology.
   * Builds a flat list of icon titles and scores them against the query.
   */
  private static findBestIconMatch(query: string): AzureService | null {
    if (!query || typeof query !== 'string') return null;
    const normalizedQuery = query.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').trim();

    // Build cache of icon titles
    if (!this._iconTitleCache) {
      const titles: string[] = [];
      const cats = (iconIndex as IconIndex).categories || [];
      for (const c of cats) {
        // c.icons may be an array or an object map depending on how index was generated
  const rawIcons = (c && (c as unknown as IconCategory).icons) || [];
        const iconsArr = Array.isArray(rawIcons) ? rawIcons : Object.values(rawIcons || {});
        for (const ic of iconsArr) {
          let title = '';
          if (!ic) continue;
          if (typeof ic === 'string') {
            title = ic;
          } else if (typeof ic === 'object') {
            title = (ic.title || ic.file || ic.id || ic.path || '').toString();
          } else {
            title = String(ic);
          }
          if (title) titles.push(title.toLowerCase());
        }
      }
      this._iconTitleCache = [...new Set(titles)];
    }

    let bestScore = 0;
    let bestTitle: string | null = null;
    for (const title of this._iconTitleCache) {
      const score = this.computeNameScore(normalizedQuery, title);
      if (score > bestScore) {
        bestScore = score;
        bestTitle = title;
      }
    }

    // Threshold only reasonably good matches
    if (bestScore >= 0.35 && bestTitle) {
      const found = azureServices.find(s => (s.title || '').toLowerCase() === bestTitle);
      return found || null;
    }

    return null;
  }

  /**
   * Lightweight similarity score combining token overlap and trigram Jaccard.
   */
  private static computeNameScore(query: string, candidate: string): number {
    if (!query || !candidate) return 0;
    const qTokens = query.split(/\s+/).filter(Boolean);
    const cTokens = candidate.split(/\s+/).filter(Boolean);

    const intersection = qTokens.filter(t => cTokens.includes(t)).length;
    const tokenScore = intersection / Math.max(qTokens.length, cTokens.length, 1);

    const trigrams = (s: string) => {
      const t: string[] = [];
      const s2 = `  ${s}  `;
      for (let i = 0; i < s2.length - 2; i++) t.push(s2.substr(i, 3));
      return t;
    };
    const qTri = trigrams(query);
    const cTri = trigrams(candidate);
    const triInter = qTri.filter(t => cTri.includes(t)).length;
    const triUnion = new Set([...qTri, ...cTri]).size || 1;
    const trigramScore = triInter / triUnion;

    return tokenScore * 0.6 + trigramScore * 0.4;
  }
  
  /**
   * Extract connections between services from text
   */
  private static extractConnections(
    text: string, 
    services: AzureService[]
  ): { from: string; to: string; label?: string }[] {
    const connections: { from: string; to: string; label?: string }[] = [];
    
    // Enhanced pattern matching for connections
    const connectionPatterns = [
      // Direct connection words
      /(\w+(?:\s+\w+)*)\s+(?:connects?\s+to|talks?\s+to|calls?|uses?|accesses?|queries?|stores?\s+data\s+in)\s+(\w+(?:\s+\w+)*)/gi,
      // Arrow patterns
      /(\w+(?:\s+\w+)*)\s*(?:<-->|->|→)\s*(\w+(?:\s+\w+)*)/gi,
      // Bicep dependencies - look for dependsOn patterns
      /dependsOn:\s*\[?\s*(\w+)\s*\]?/gi,
    ];
    
    connectionPatterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const from = this.findServiceByName(match[1], services);
        const to = this.findServiceByName(match[2], services);
        
        if (from && to && from.id !== to.id) {
          connections.push({
            from: from.id,
            to: to.id,
            label: 'connection'
          });
        }
      }
    });
    
    // Add logical connections based on common Azure service patterns
    this.addLogicalConnections(services, connections);
    
    return connections;
  }
  
  /**
   * Add logical connections based on common Azure architecture patterns
   */
  private static addLogicalConnections(
    services: AzureService[], 
    connections: { from: string; to: string; label?: string }[]
  ): void {
  const servicesByTitle = new Map(services.map(s => [(s.title || '').toLowerCase(), s]));
    
    // Common connection patterns
    const patterns = [
      // App Service typically connects to databases
      {
        from: ['app services', 'app service'],
        to: ['azure cosmos db', 'sql database', 'mysql', 'postgresql'],
        label: 'data access'
      },
      // App Service connects to App Service Plan
      {
        from: ['app services'],
        to: ['app service plans'],
        label: 'hosted on'
      },
      // Services connect to Key Vault for secrets
      {
        from: ['app services', 'function app', 'azure cosmos db'],
        to: ['key vaults'],
        label: 'secrets'
      },
      // Function App connects to Storage
      {
        from: ['function app'],
        to: ['storage accounts'],
        label: 'runtime storage'
      },
      // API Management in front of services
      {
        from: ['api management services'],
        to: ['app services', 'function app'],
        label: 'api gateway'
      },
      // Application Gateway load balances
      {
        from: ['application gateways'],
        to: ['app services'],
        label: 'load balancer'
      }
    ];
    
    patterns.forEach(pattern => {
      pattern.from.forEach(fromTitle => {
        pattern.to.forEach(toTitle => {
          const fromService = servicesByTitle.get(fromTitle);
          const toService = servicesByTitle.get(toTitle);
          
          if (fromService && toService && 
              !connections.find(c => c.from === fromService.id && c.to === toService.id)) {
            connections.push({
              from: fromService.id,
              to: toService.id,
              label: pattern.label
            });
          }
        });
      });
    });
  }
  
  /**
   * Find service in list by partial name match
   */
  private static findServiceByName(name: string, services: AzureService[]): AzureService | null {
    // Guard against undefined/null and non-string names
    if (!name || typeof name !== 'string') return null;
    const normalizedName = name.toString().toLowerCase().trim();
    if (!normalizedName) return null;

    return services.find(service => {
      const title = service && service.title ? String(service.title).toLowerCase() : '';
      if (!title) return false;
      return title.includes(normalizedName) || normalizedName.includes(title);
    }) || null;
  }
  

  
  /**
   * Generate React Flow nodes from parsed architecture
   */
  static generateNodes(architecture: ParsedArchitecture): Node[] {
    const nodes: Node[] = [];
    const { services, layout } = architecture;
    
    services.forEach((service, index) => {
      const position = this.calculateNodePosition(index, services.length, layout);
      
      nodes.push({
        id: service.id,
        type: 'azure.service',
        position,
        data: {
          title: service.title,
          subtitle: service.description,
          iconPath: service.iconPath,
          status: 'active' as const,
          service, // Keep the original service object for reference
        },
      });
    });
    
    return nodes;
  }
  
  /**
   * Calculate node position based on layout
   */
  private static calculateNodePosition(
    index: number, 
    total: number, 
    layout: 'horizontal' | 'vertical' | 'grid'
  ): { x: number; y: number } {
    switch (layout) {
      case 'horizontal':
        return {
          x: index * 250,
          y: 100,
        };
      
      case 'vertical':
        return {
          x: 100,
          y: index * 150,
        };
      
      case 'grid': {
        const cols = Math.ceil(Math.sqrt(total));
        const row = Math.floor(index / cols);
        const col = index % cols;
        return {
          x: col * 250,
          y: row * 150,
        };
      }
      
      default:
        return { x: 0, y: 0 };
    }
  }
}