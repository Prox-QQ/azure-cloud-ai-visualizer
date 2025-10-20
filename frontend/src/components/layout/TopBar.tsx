import { useState, useRef } from 'react';
import { Icon } from '@iconify/react';
import { Button } from '@/components/ui/button';
import { ExportModal } from '@/components/modals/ExportModal';
import { useTheme } from 'next-themes';
import ThemeToggle from '@/components/ui/theme-toggle';

interface TopBarProps {
  onChatToggle?: () => void;
  isChatOpen?: boolean;
  onAssetsToggle?: () => void;
  isAssetsOpen?: boolean;
  onIacToggle?: () => void;
  isIacOpen?: boolean;
}

const TopBar = ({ onChatToggle, isChatOpen, onAssetsToggle, isAssetsOpen, onIacToggle, isIacOpen }: TopBarProps) => {
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const canvasRef = useRef<HTMLElement | null>(null);

  // Get canvas element reference
  const getCanvasElement = () => {
    if (!canvasRef.current) {
      canvasRef.current = document.querySelector('.react-flow');
    }
    return canvasRef.current;
  };

  return (
    <header className="glass-panel border-b border-border/50 px-4 h-14 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <img src="/logo.png" alt="Azure Architect" className="h-8 w-8 object-contain" />
          <h1 className="text-lg font-bold">Azure Architect</h1>
        </div>
        
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="gap-2">
            <Icon icon="mdi:folder-open" />
            <span className="hidden md:inline">Open</span>
          </Button>
          <Button variant="ghost" size="sm" className="gap-2">
            <Icon icon="mdi:content-save" />
            <span className="hidden md:inline">Save</span>
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button 
          variant={isIacOpen ? "default" : "outline"} 
          size="sm" 
          className="gap-2"
          onClick={onIacToggle}
        >
          <Icon icon="mdi:code-json" />
          {isIacOpen ? 'IaC Panel' : 'Generate IaC'}
        </Button>
        <Button variant="default" size="sm" className="gap-2 bg-accent hover:bg-accent/90">
          <Icon icon="mdi:cloud-upload" />
          Deploy
        </Button>
        <Button 
          variant="ghost" 
          size="sm" 
          className="gap-2"
          onClick={() => setExportModalOpen(true)}
        >
          <Icon icon="mdi:download" />
          Export
        </Button>
        <Button 
          variant={isAssetsOpen ? "default" : "ghost"} 
          size="icon"
          onClick={onAssetsToggle}
          title="Asset Manager"
        >
          <Icon icon="mdi:folder-multiple-image" className="text-xl" />
        </Button>
        <Button 
          variant={isChatOpen ? "default" : "ghost"} 
          size="icon"
          onClick={onChatToggle}
          title="AI Assistant"
        >
          <Icon icon="mdi:robot" className="text-xl" />
        </Button>
        <ThemeToggle />
        <Button variant="ghost" size="icon">
          <Icon icon="mdi:account-circle" className="text-xl" />
        </Button>
      </div>

      <ExportModal 
        open={exportModalOpen}
        onOpenChange={setExportModalOpen}
        canvasElement={getCanvasElement()}
      />
    </header>
  );
};

export default TopBar;
