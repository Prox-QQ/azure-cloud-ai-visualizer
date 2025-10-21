import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useDiagramStore } from '@/store/diagramStore';

interface Props {
  edgeId?: string | null;
  open: boolean;
  onClose: () => void;
}

const EdgeLabelModal: React.FC<Props> = ({ edgeId, open, onClose }) => {
  const updateEdgeLabel = useDiagramStore((s) => s.updateEdgeLabel);
  const edges = useDiagramStore((s) => s.edges);
  const [label, setLabel] = useState('');

  useEffect(() => {
    if (edgeId) {
      const e = edges.find((ed) => ed.id === edgeId);
      setLabel(e?.label ?? '');
    } else {
      setLabel('');
    }
  }, [edgeId, edges]);

  const handleSave = () => {
    if (edgeId) updateEdgeLabel(edgeId, label || undefined);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit edge label</DialogTitle>
        </DialogHeader>

        <div className="mt-4">
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Label (e.g. HTTPS, Pub/Sub, Private)"
            className="w-full rounded-md border px-3 py-2 bg-background"
          />
        </div>

        <DialogFooter>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button onClick={handleSave}>Save</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EdgeLabelModal;
