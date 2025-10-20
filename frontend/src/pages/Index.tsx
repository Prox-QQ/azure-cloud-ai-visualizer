import { useState } from 'react';
import TopBar from '@/components/layout/TopBar';
import ServicePalette from '@/components/layout/ServicePalette';
import DiagramCanvas from '@/components/layout/DiagramCanvas';
import InspectorPanel from '@/components/layout/InspectorPanel';
import JobsDrawer from '@/components/layout/JobsDrawer';
import ChatPanel from '@/components/layout/ChatPanel';
import AssetManager from '@/components/layout/AssetManager';
import IaCVisualization from '@/components/layout/IaCVisualization';
import { useDiagramStore } from '@/store/diagramStore';
import { generateIac, createDeployment } from '@/lib/api';
import DeployModal from '@/components/layout/DeployModal';
import { useToast } from '@/hooks/use-toast';

interface IaCFile {
  id: string;
  name: string;
  type: 'bicep' | 'terraform' | 'arm' | 'yaml';
  content: string;
  size: number;
  status: 'generated' | 'validated' | 'error';
  errors?: string[];
  warnings?: string[];
}

const seedFiles: IaCFile[] = [];

const Index = () => {
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isAssetsOpen, setIsAssetsOpen] = useState(false);
  const [isIacOpen, setIsIacOpen] = useState(false);

  const handleChatToggle = () => {
    setIsChatOpen(!isChatOpen);
  };

  const handleAssetsToggle = () => {
    setIsAssetsOpen(!isAssetsOpen);
  };

  const handleIacToggle = () => {
    setIsIacOpen(!isIacOpen);
  };

  const { nodes, edges } = useDiagramStore();
  const { toast } = useToast();

  // Track generated files; start empty
  const [generatedFiles, setGeneratedFiles] = useState<IaCFile[]>(seedFiles);
  const [deployingFile, setDeployingFile] = useState<IaCFile | null>(null);
  const [isDeployModalOpen, setIsDeployModalOpen] = useState(false);

  const handleGenerate = async (type: 'bicep' | 'terraform', options?: { providerVersion?: string; workspace?: string; namingConvention?: string }) => {
    try {
      const diagramData = { nodes, edges };
      const resp = await generateIac(diagramData, type, options);
      // resp will include id, content, format
      const code: string = resp.content || '';
      const format: string = resp.format || type;
      const isBicep = format === 'bicep';
      const fileName = `diagram-${new Date().toISOString().replace(/[:.]/g,'-')}.${isBicep ? 'bicep' : (format === 'terraform' ? 'tf' : format)}`;

      // Basic sanitization: extract everything after first param/location line (keep comments) – currently we just trust content
      const sanitized = code.trim();

      // Build file object for visualization panel
      const newFile: IaCFile = {
        id: crypto.randomUUID(),
        name: fileName,
        type: (isBicep ? 'bicep' : (format === 'terraform' ? 'terraform' : 'bicep')),
        content: sanitized,
        size: sanitized.length,
        status: 'generated',
        warnings: [] as string[]
      };

      setGeneratedFiles(prev => [newFile, ...prev]);
      toast({ title: 'IaC Generated', description: `Generated ${newFile.name}` });

      // Automatic download
      const blob = new Blob([sanitized], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
  const eObj = err && typeof err === 'object' ? (err as Record<string, unknown>) : null;
  const msg = eObj && typeof eObj.message === 'string' ? eObj.message : String(err);
  toast({ title: 'IaC generation failed', description: msg || String(err), variant: 'destructive' });
    }
  };

  // Removed inline mock template; generation now purely dynamic.

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <TopBar 
        onChatToggle={handleChatToggle} 
        isChatOpen={isChatOpen}
        onAssetsToggle={handleAssetsToggle}
        isAssetsOpen={isAssetsOpen}
        onIacToggle={handleIacToggle}
        isIacOpen={isIacOpen}
      />
      <div className="flex-1 flex overflow-hidden">
        <ServicePalette />
        <DiagramCanvas />
        <InspectorPanel />
        <IaCVisualization
          isOpen={isIacOpen}
          onToggle={handleIacToggle}
          files={generatedFiles}
          onGenerate={handleGenerate}
          onDownload={(file) => {
            const blob = new Blob([file.content], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = file.name;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
          }}
          onDeploy={(file) => {
            setDeployingFile(file);
            setIsDeployModalOpen(true);
          }}
        />
        <AssetManager 
          isOpen={isAssetsOpen} 
          onToggle={handleAssetsToggle}
          onFileSelect={(file) => console.log('Selected file:', file)}
        />
        <ChatPanel isOpen={isChatOpen} onToggle={handleChatToggle} />
      </div>
      <JobsDrawer
        files={generatedFiles}
        onDownload={(file) => {
          const blob = new Blob([file.content], { type: 'text/plain' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = file.name;
          document.body.appendChild(a);
          a.click();
          a.remove();
          URL.revokeObjectURL(url);
        }}
        onDeploy={(file) => {
          // placeholder: replace with real deploy flow
          console.log('Deploy requested for file:', file.name);
          toast({ title: 'Deploy started', description: `Deploy requested for ${file.name}` });
        }}
      />
      <DeployModal
        open={isDeployModalOpen}
        onClose={() => setIsDeployModalOpen(false)}
        onConfirm={async (subscriptionId, resourceGroup, validationOnly) => {
          if (!deployingFile) return;
          toast({ title: 'Starting deploy', description: `Deploying ${deployingFile.name}...` });
          try {
            const resp = await createDeployment(resourceGroup, subscriptionId, deployingFile.content, deployingFile.type === 'terraform' ? 'terraform' : 'bicep', validationOnly);
            toast({ title: 'Deployment queued', description: `Deployment ${resp?.id} status: ${resp?.status}` });
          } catch (err: unknown) {
            const eObj = err && typeof err === 'object' ? (err as Record<string, unknown>) : null;
            const msg = eObj && typeof eObj.message === 'string' ? eObj.message : String(err);
            toast({ title: 'Deployment failed', description: msg || String(err), variant: 'destructive' });
          }
        }}
      />
    </div>
  );
};

export default Index;
