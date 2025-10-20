import { Icon } from '@iconify/react';
import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface IaCFileBrief {
  id: string;
  name: string;
  type: string;
  content: string;
  size: number;
  status: 'generated' | 'validated' | 'error';
  errors?: string[];
  warnings?: string[];
}

interface JobsDrawerProps {
  files?: IaCFileBrief[];
  onDownload?: (file: IaCFileBrief) => void;
  onDeploy?: (file: IaCFileBrief) => void;
}

const JobsDrawer = ({ files = [], onDownload, onDeploy }: JobsDrawerProps) => {
  const [selectedFileId, setSelectedFileId] = useState<string | null>(files.length ? files[0].id : null);

  const selectedFile = files.find((f) => f.id === selectedFileId) ?? files[0] ?? null;

  return (
    <div className="glass-panel border-t border-border/50 h-48">
      <Tabs defaultValue="summary" className="h-full flex flex-col">
        <TabsList className="mx-4 mt-3 grid w-auto grid-cols-4">
          <TabsTrigger value="summary" className="gap-2">
            <Icon icon="mdi:chart-box" />
            Summary
          </TabsTrigger>
          <TabsTrigger value="iac" className="gap-2">
            <Icon icon="mdi:code-json" />
            IaC
          </TabsTrigger>
          <TabsTrigger value="validation" className="gap-2">
            <Icon icon="mdi:check-circle" />
            Validation
          </TabsTrigger>
          <TabsTrigger value="logs" className="gap-2">
            <Icon icon="mdi:text-box" />
            Deploy Logs
          </TabsTrigger>
        </TabsList>

        <TabsContent value="summary" className="flex-1 overflow-y-auto px-4 pb-4">
          <div className="text-center py-6">
            <Icon icon="mdi:information" className="text-3xl text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Project summary and statistics will appear here</p>
          </div>
        </TabsContent>

        <TabsContent value="iac" className="flex-1 overflow-y-auto px-4 pb-4">
          {files.length === 0 ? (
            <div className="text-center py-6">
              <Icon icon="mdi:code-json" className="text-3xl text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No generated IaC files yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {files.map((file) => (
                <div key={file.id} className="flex items-center justify-between p-2 rounded border border-border/30">
                  <div className="flex items-center gap-3">
                    <div className="w-8 text-center text-muted-foreground">
                      <Icon icon={file.type === 'bicep' ? 'mdi:file-binary' : 'mdi:file-code'} />
                    </div>
                    <div>
                      <div className="font-medium">{file.name}</div>
                      <div className="text-xs text-muted-foreground">{Math.round(file.size)} bytes • {file.status}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => {
                        setSelectedFileId(file.id);
                      }}
                    >
                      View
                    </button>
                    <button
                      className="btn btn-outline btn-sm"
                      onClick={() => (onDownload ? onDownload(file) : (() => {
                        const blob = new Blob([file.content], { type: 'text/plain' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = file.name;
                        document.body.appendChild(a);
                        a.click();
                        a.remove();
                        URL.revokeObjectURL(url);
                      })())}
                    >
                      Download
                    </button>
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => (onDeploy ? onDeploy(file) : console.log('Deploy', file))}
                    >
                      Deploy
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="validation" className="flex-1 overflow-y-auto px-4 pb-4">
          {selectedFile ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">Validation for {selectedFile.name}</div>
                  <div className="text-xs text-muted-foreground">Status: {selectedFile.status}</div>
                </div>
              </div>

              <div>
                <div className="font-semibold">Warnings</div>
                {selectedFile.warnings && selectedFile.warnings.length ? (
                  <ul className="list-disc pl-6 text-sm">
                    {selectedFile.warnings.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-sm text-muted-foreground">No warnings</div>
                )}
              </div>

              <div>
                <div className="font-semibold">Errors</div>
                {selectedFile.errors && selectedFile.errors.length ? (
                  <ul className="list-disc pl-6 text-sm text-destructive">
                    {selectedFile.errors.map((e, i) => (
                      <li key={i}>{e}</li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-sm text-muted-foreground">No errors</div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-6">
              <Icon icon="mdi:check-circle" className="text-3xl text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Select a file in the IaC tab to see validation</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="logs" className="flex-1 overflow-y-auto px-4 pb-4">
          <div className="text-center py-6">
            <Icon icon="mdi:text-box" className="text-3xl text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Live deployment logs will stream here</p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default JobsDrawer;
