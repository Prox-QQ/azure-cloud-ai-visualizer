import React, { useState, useRef } from 'react';
import { Icon } from '@iconify/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import TerraformOptionsModal from './TerraformOptionsModal';
import { useIacSettings } from '@/hooks/useIacSettings';

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

interface IaCVisualizationProps {
  isOpen: boolean;
  onToggle: () => void;
  files?: IaCFile[];
  onGenerate?: (type: 'bicep' | 'terraform', options?: { providerVersion?: string; workspace?: string; namingConvention?: string }) => void;
  onDownload?: (file: IaCFile) => void;
  onDeploy?: (file: IaCFile) => void;
}

const IaCVisualization: React.FC<IaCVisualizationProps> = ({
  isOpen,
  onToggle,
  files = [],
  onGenerate,
  onDownload,
  onDeploy
}) => {
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'files' | 'validation'>('files');
  const codeRef = useRef<HTMLPreElement>(null);
  const { toast } = useToast();

  const selectedFile = files.find(f => f.id === selectedFileId);

  const getLanguageFromType = (type: string): string => {
    switch (type) {
      case 'bicep': return 'bicep';
      case 'terraform': return 'hcl';
      case 'arm': return 'json';
      case 'yaml': return 'yaml';
      default: return 'text';
    }
  };

  const getIconFromType = (type: string): string => {
    switch (type) {
      case 'bicep': return 'mdi:microsoft-azure';
      case 'terraform': return 'mdi:terraform';
      case 'arm': return 'mdi:code-json';
      case 'yaml': return 'mdi:file-code';
      default: return 'mdi:file';
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const copyToClipboard = async (content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      toast({
        title: "Copied!",
        description: "Code copied to clipboard",
      });
    } catch (error) {
      toast({
        title: "Copy Failed",
        description: "Failed to copy code to clipboard",
        variant: "destructive",
      });
    }
  };

  const handleGenerate = (type: 'bicep' | 'terraform') => {
    if (type === 'terraform') {
      // open modal
      setTerraformModalOpen(true);
      return;
    }
    onGenerate?.(type);
    toast({ title: 'Generating IaC', description: `Generating ${type} template from your diagram...` });
  };

  const { settings, save } = useIacSettings();
  const [terraformModalOpen, setTerraformModalOpen] = React.useState(false);

  const handleTerraformSave = (opts: Record<string, unknown>) => {
    const s = {
      providerVersion: opts.providerVersion as string | undefined,
      requiredProviders: opts.requiredProviders as string | undefined,
      workspace: opts.workspace as string | undefined,
      namingConvention: opts.namingConvention as string | undefined,
      variables: opts.variables as string | undefined,
      remoteBackend: opts.remoteBackend as string | undefined,
      initAndValidate: !!opts.initAndValidate,
    };
    save(s);
    onGenerate?.('terraform', s as { providerVersion?: string; workspace?: string; namingConvention?: string; requiredProviders?: string; variables?: string; remoteBackend?: string; initAndValidate?: boolean });
    toast({ title: 'Generating IaC', description: `Generating terraform template from your diagram...` });
  };

  // Render Terraform options modal so it opens when `terraformModalOpen` is set
  const renderTerraformModal = () => (
    <TerraformOptionsModal
      open={terraformModalOpen}
      onClose={() => setTerraformModalOpen(false)}
      onSave={handleTerraformSave}
      initial={settings}
    />
  );

  if (!isOpen) return null;

  return (
    <div className="w-96 h-full bg-background border-l border-border/50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border/50">
        <div className="flex items-center gap-2">
          <Icon icon="mdi:code-json" className="text-xl text-primary" />
          <h3 className="font-semibold">Infrastructure as Code</h3>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggle}
          className="h-8 w-8"
        >
          <Icon icon="mdi:close" />
        </Button>
      </div>

      {/* Generation Controls */}
      <div className="p-4 border-b border-border/50">
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 gap-2"
            onClick={() => handleGenerate('bicep')}
          >
            <Icon icon="mdi:microsoft-azure" />
            Generate Bicep
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1 gap-2"
            onClick={() => handleGenerate('terraform')}
          >
            <Icon icon="mdi:terraform" />
            Generate Terraform
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'files' | 'validation')} className="flex-1 flex flex-col">
          <TabsList className="grid w-full grid-cols-2 mx-4 mt-4">
            <TabsTrigger value="files">Files</TabsTrigger>
            <TabsTrigger value="validation">
              Validation
              {selectedFile?.errors?.length ? (
                <Badge variant="destructive" className="ml-2 h-4 w-4 p-0 text-xs">
                  {selectedFile.errors.length}
                </Badge>
              ) : null}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="files" className="flex-1 flex flex-col m-0">
            {files.length === 0 ? (
              <div className="flex-1 flex items-center justify-center p-8">
                <div className="text-center">
                  <Icon icon="mdi:file-code" className="mx-auto text-4xl text-muted-foreground mb-4" />
                  <p className="text-sm text-muted-foreground mb-4">
                    No IaC files generated yet
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Click "Generate Bicep" or "Generate Terraform" to create infrastructure code from your diagram
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col">
                {/* File List */}
                <div className="p-4 border-b border-border/50">
                  <div className="space-y-2">
                    {files.map((file) => (
                      <Card 
                        key={file.id}
                        className={`cursor-pointer transition-colors hover:bg-accent/50 ${
                          selectedFileId === file.id ? 'ring-2 ring-primary' : ''
                        }`}
                        onClick={() => setSelectedFileId(file.id)}
                      >
                        <CardContent className="p-3">
                          <div className="flex items-center gap-3">
                            <Icon icon={getIconFromType(file.type)} className="text-xl text-primary" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{file.name}</p>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <span>{formatFileSize(file.size)}</span>
                                <span>•</span>
                                <Badge 
                                  variant={file.status === 'error' ? 'destructive' : 'secondary'}
                                  className="text-xs"
                                >
                                  {file.status}
                                </Badge>
                              </div>
                            </div>
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onDownload?.(file);
                                }}
                                title="Download"
                              >
                                <Icon icon="mdi:download" className="text-xs" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onDeploy?.(file);
                                }}
                                title="Deploy"
                              >
                                <Icon icon="mdi:cloud-upload" className="text-xs" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>

                {/* Code Viewer */}
                {selectedFile && (
                  <div className="flex-1 flex flex-col">
                    <div className="flex items-center justify-between p-3 border-b border-border/50 bg-muted/50">
                      <div className="flex items-center gap-2">
                        <Icon icon={getIconFromType(selectedFile.type)} className="text-sm" />
                        <span className="text-sm font-medium">{selectedFile.name}</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(selectedFile.content)}
                        className="gap-1"
                      >
                        <Icon icon="mdi:content-copy" className="text-xs" />
                        Copy
                      </Button>
                    </div>
                    <ScrollArea className="flex-1">
                      <pre 
                        ref={codeRef}
                        className="p-4 text-xs font-mono leading-relaxed whitespace-pre-wrap"
                      >
                        <code className={`language-${getLanguageFromType(selectedFile.type)}`}>
                          {selectedFile.content}
                        </code>
                      </pre>
                    </ScrollArea>
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="validation" className="flex-1 m-0 p-4">
            {selectedFile ? (
              <div className="space-y-4">
                {/* Errors */}
                {selectedFile.errors && selectedFile.errors.length > 0 && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center gap-2 text-red-600">
                        <Icon icon="mdi:alert-circle" />
                        Errors ({selectedFile.errors.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="space-y-2">
                        {selectedFile.errors.map((error, index) => (
                          <div key={index} className="p-2 bg-red-50 dark:bg-red-950/20 rounded text-xs">
                            {error}
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Warnings */}
                {selectedFile.warnings && selectedFile.warnings.length > 0 && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center gap-2 text-yellow-600">
                        <Icon icon="mdi:alert" />
                        Warnings ({selectedFile.warnings.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="space-y-2">
                        {selectedFile.warnings.map((warning, index) => (
                          <div key={index} className="p-2 bg-yellow-50 dark:bg-yellow-950/20 rounded text-xs">
                            {warning}
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Success State */}
                {(!selectedFile.errors?.length && !selectedFile.warnings?.length) && (
                  <Card>
                    <CardContent className="p-6 text-center">
                      <Icon icon="mdi:check-circle" className="mx-auto text-4xl text-green-600 mb-2" />
                      <p className="text-sm font-medium text-green-600">All Clear!</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        No validation issues found
                      </p>
                    </CardContent>
                  </Card>
                )}
              </div>
            ) : (
              <div className="text-center py-8">
                <Icon icon="mdi:file-check" className="mx-auto text-4xl text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
                  Select a file to view validation results
                </p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
      {renderTerraformModal()}
    </div>
  );
};

export default IaCVisualization;