import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface DeployModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (subscriptionId: string, resourceGroup: string, validationOnly: boolean) => void;
  defaultSubscription?: string;
  defaultResourceGroup?: string;
}

const DeployModal: React.FC<DeployModalProps> = ({ open, onClose, onConfirm, defaultSubscription = '', defaultResourceGroup = '' }) => {
  const [subscriptionId, setSubscriptionId] = useState<string>(defaultSubscription);
  const [resourceGroup, setResourceGroup] = useState<string>(defaultResourceGroup);
  const [validationOnly, setValidationOnly] = useState<boolean>(false);

  const handleConfirm = () => {
    if (!subscriptionId || !resourceGroup) return;
    onConfirm(subscriptionId.trim(), resourceGroup.trim(), validationOnly);
    onClose();
  };

  return (
    <Dialog open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Deploy IaC</DialogTitle>
          <DialogDescription>Enter Azure subscription and resource group to deploy the generated template.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3 mt-3">
          <div>
            <div className="text-sm mb-1">Subscription ID</div>
            <Input value={subscriptionId} onChange={(e) => setSubscriptionId(e.target.value)} placeholder="xxxxxxx-xxxx-xxxx-xxxx-xxxxxxxx" />
          </div>
          <div>
            <div className="text-sm mb-1">Resource Group</div>
            <Input value={resourceGroup} onChange={(e) => setResourceGroup(e.target.value)} placeholder="my-resource-group" />
          </div>
          <div className="flex items-center gap-2">
            <input id="valonly" type="checkbox" checked={validationOnly} onChange={(e) => setValidationOnly(e.target.checked)} />
            <label htmlFor="valonly" className="text-sm">Validation only (do not apply)</label>
          </div>
        </div>

        <DialogFooter>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button onClick={handleConfirm}>Deploy</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default DeployModal;
