import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Download, ImageIcon, FileImage } from 'lucide-react';
import { toast } from 'sonner';
import html2canvas from 'html2canvas';
import gifshot from 'gifshot';

interface ExportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canvasElement: HTMLElement | null;
}

export const ExportModal = ({ open, onOpenChange, canvasElement }: ExportModalProps) => {
  const [duration, setDuration] = useState('5');
  const [fps, setFps] = useState('15');
  const [resolution, setResolution] = useState('current');
  const [background, setBackground] = useState('dark');
  const [progress, setProgress] = useState(0);
  const [isExporting, setIsExporting] = useState(false);

  const exportAsPNG = async () => {
    if (!canvasElement) {
      toast.error('Canvas not found');
      return;
    }

    try {
      setIsExporting(true);
      setProgress(50);

      const canvas = await html2canvas(canvasElement, {
        backgroundColor: background === 'transparent' ? null : background === 'dark' ? '#0d1117' : '#ffffff',
        scale: resolution === '1080p' ? 2 : 1,
      });

      setProgress(100);

      canvas.toBlob((blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.download = `azure-diagram-${Date.now()}.png`;
          link.href = url;
          link.click();
          URL.revokeObjectURL(url);
          toast.success('PNG exported successfully!');
          onOpenChange(false);
        }
      });
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export PNG');
    } finally {
      setIsExporting(false);
      setProgress(0);
    }
  };

  const exportAsGIF = async () => {
    if (!canvasElement) {
      toast.error('Canvas not found');
      return;
    }

    try {
      setIsExporting(true);
      const durationNum = parseInt(duration);
      const fpsNum = parseInt(fps);
      const frames = durationNum * fpsNum;
      const images: string[] = [];

      for (let i = 0; i < frames; i++) {
        setProgress((i / frames) * 100);
        
        const canvas = await html2canvas(canvasElement, {
          backgroundColor: background === 'transparent' ? null : background === 'dark' ? '#0d1117' : '#ffffff',
          scale: resolution === '1080p' ? 1.5 : 1,
        });

        images.push(canvas.toDataURL('image/png'));
        
        // Small delay between frames
        await new Promise(resolve => setTimeout(resolve, 1000 / fpsNum));
      }

      setProgress(95);

      gifshot.createGIF(
        {
          images,
          gifWidth: resolution === '1080p' ? 1920 : canvasElement.offsetWidth,
          gifHeight: resolution === '1080p' ? 1080 : canvasElement.offsetHeight,
          interval: 1 / fpsNum,
          numFrames: frames,
        },
        (obj: any) => {
          if (!obj.error) {
            const link = document.createElement('a');
            link.download = `azure-diagram-${Date.now()}.gif`;
            link.href = obj.image;
            link.click();
            setProgress(100);
            toast.success('GIF exported successfully!');
            onOpenChange(false);
          } else {
            toast.error('Failed to create GIF');
          }
          setIsExporting(false);
          setProgress(0);
        }
      );
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export GIF');
      setIsExporting(false);
      setProgress(0);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Export Diagram</DialogTitle>
          <DialogDescription>
            Export your architecture diagram as an image or animated GIF
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Resolution</Label>
            <Select value={resolution} onValueChange={setResolution}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="current">Current Size</SelectItem>
                <SelectItem value="1080p">1080p (1920x1080)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Background</Label>
            <Select value={background} onValueChange={setBackground}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="dark">Dark</SelectItem>
                <SelectItem value="light">Light</SelectItem>
                <SelectItem value="transparent">Transparent</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Duration (seconds) - for GIF</Label>
            <Input
              type="number"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              min="1"
              max="30"
            />
          </div>

          <div className="space-y-2">
            <Label>FPS - for GIF</Label>
            <Select value={fps} onValueChange={setFps}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10 FPS</SelectItem>
                <SelectItem value="15">15 FPS</SelectItem>
                <SelectItem value="30">30 FPS</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isExporting && (
            <div className="space-y-2">
              <Label>Export Progress</Label>
              <Progress value={progress} className="h-2" />
              <p className="text-xs text-muted-foreground text-center">{Math.round(progress)}%</p>
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <Button
            onClick={exportAsPNG}
            disabled={isExporting}
            className="flex-1"
            variant="outline"
          >
            <ImageIcon className="w-4 h-4 mr-2" />
            Export PNG
          </Button>
          <Button
            onClick={exportAsGIF}
            disabled={isExporting}
            className="flex-1"
          >
            <FileImage className="w-4 h-4 mr-2" />
            Export GIF
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
