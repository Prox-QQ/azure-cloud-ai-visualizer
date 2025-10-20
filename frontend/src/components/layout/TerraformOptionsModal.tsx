import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogFooter, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: (options: Record<string, unknown>) => void;
  initial?: Record<string, unknown>;
}

const TerraformOptionsModal: React.FC<Props> = ({ open, onClose, onSave, initial }) => {
  const [providerVersion, setProviderVersion] = useState<string>(initial?.providerVersion as string || '');
  const [requiredProviders, setRequiredProviders] = useState<string>(initial?.requiredProviders as string || '');
  const [workspace, setWorkspace] = useState<string>(initial?.workspace as string || '');
  const [namingConvention, setNamingConvention] = useState<string>(initial?.namingConvention as string || 'standard');
  const [variables, setVariables] = useState<string>(initial?.variables as string || '');
  const [remoteBackend, setRemoteBackend] = useState<string>(initial?.remoteBackend as string || '');
  const [initAndValidate, setInitAndValidate] = useState<boolean>(!!initial?.initAndValidate);

  useEffect(() => {
    if (open && initial) {
      setProviderVersion(initial?.providerVersion as string || '');
      setRequiredProviders(initial?.requiredProviders as string || '');
      setWorkspace(initial?.workspace as string || '');
      setNamingConvention(initial?.namingConvention as string || 'standard');
      setVariables(initial?.variables as string || '');
      setRemoteBackend(initial?.remoteBackend as string || '');
      setInitAndValidate(!!initial?.initAndValidate);
    }
  }, [open, initial]);

  const handleSave = () => {
    const opts: Record<string, unknown> = {
      providerVersion: providerVersion || undefined,
      requiredProviders: requiredProviders || undefined,
      workspace: workspace || undefined,
      namingConvention: namingConvention || undefined,
      variables: variables || undefined,
      remoteBackend: remoteBackend || undefined,
      initAndValidate: initAndValidate || undefined,
    };
    onSave(opts);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Terraform Generation Options</DialogTitle>
        </DialogHeader>
        <div className="p-4 space-y-3">
          <div>
            <Label>Provider version (e.g. 3.0.0)</Label>
            <Input value={providerVersion} onChange={(e) => setProviderVersion(e.target.value)} />
          </div>
          <div>
            <Label>Required providers (HCL block body)</Label>
            <Textarea rows={3} value={requiredProviders} onChange={(e) => setRequiredProviders(e.target.value)} />
            <p className="text-xs text-muted-foreground">Example: {`{ azurerm = { source = "hashicorp/azurerm" version = "~>3.0" } }`}</p>
          </div>
          <div>
            <Label>Remote backend config (HCL)</Label>
            <Textarea rows={3} value={remoteBackend} onChange={(e) => setRemoteBackend(e.target.value)} />
            <p className="text-xs text-muted-foreground">Example: Azure storage backend config</p>
          </div>
          <div>
            <Label>Workspace name</Label>
            <Input value={workspace} onChange={(e) => setWorkspace(e.target.value)} />
          </div>
          <div>
            <Label>Naming convention</Label>
            <Input value={namingConvention} onChange={(e) => setNamingConvention(e.target.value)} />
          </div>
          <div>
            <Label>Variables scaffold (HCL body)</Label>
            <Textarea rows={3} value={variables} onChange={(e) => setVariables(e.target.value)} />
          </div>
          <div className="flex items-center gap-2">
            <Checkbox checked={initAndValidate} onCheckedChange={(v) => setInitAndValidate(!!v)} />
            <Label>Run terraform init & validate on server after generation (requires terraform installed)</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave}>Save & Generate</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default TerraformOptionsModal;
