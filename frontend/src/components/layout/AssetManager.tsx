import React, { useState, useCallback, useRef } from 'react';
import { Icon } from '@iconify/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';

interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  url: string;
  uploadProgress?: number;
  uploadStatus: 'uploading' | 'completed' | 'error';
  thumbnail?: string;
}

interface AssetManagerProps {
  isOpen: boolean;
  onToggle: () => void;
  onFileSelect?: (file: UploadedFile) => void;
}

const AssetManager: React.FC<AssetManagerProps> = ({ isOpen, onToggle, onFileSelect }) => {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const uploadFiles = useCallback(async (filesToUpload: File[]) => {
    const simulateUpload = async (fileId: string, file: File): Promise<void> => {
      return new Promise((resolve, reject) => {
        let progress = 0;
        const interval = setInterval(() => {
          progress += Math.random() * 10;
          
          if (progress >= 100) {
            clearInterval(interval);
            
            // Create object URL for preview
            const url = URL.createObjectURL(file);
            let thumbnail: string | undefined;
            
            // Generate thumbnail for images
            if (file.type.startsWith('image/')) {
              thumbnail = url;
            }
            
            setFiles(prev => prev.map(f => 
              f.id === fileId 
                ? { 
                    ...f, 
                    uploadStatus: 'completed' as const, 
                    uploadProgress: 100,
                    url,
                    thumbnail
                  }
                : f
            ));
            
            toast({
              title: "Upload Complete",
              description: `${file.name} uploaded successfully`,
            });
            
            resolve();
          } else {
            setFiles(prev => prev.map(f => 
              f.id === fileId 
                ? { ...f, uploadProgress: Math.min(progress, 100) }
                : f
            ));
          }
        }, 200);
      });
    };

    for (const file of filesToUpload) {
      const fileId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const uploadedFile: UploadedFile = {
        id: fileId,
        name: file.name,
        size: file.size,
        type: file.type,
        url: '',
        uploadProgress: 0,
        uploadStatus: 'uploading'
      };

      setFiles(prev => [...prev, uploadedFile]);

      try {
        // Simulate file upload with progress
        await simulateUpload(fileId, file);
      } catch (error) {
        console.error('Upload failed:', error);
        setFiles(prev => prev.map(f => 
          f.id === fileId 
            ? { ...f, uploadStatus: 'error' as const, uploadProgress: 0 }
            : f
        ));
        
        toast({
          title: "Upload Failed",
          description: `Failed to upload ${file.name}`,
          variant: "destructive",
        });
      }
    }
  }, [toast]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const droppedFiles = Array.from(e.dataTransfer.files);
    uploadFiles(droppedFiles);
  }, [uploadFiles]);

  const handleFileSelect = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    uploadFiles(selectedFiles);
  }, [uploadFiles]);



  const deleteFile = useCallback((fileId: string) => {
    const file = files.find(f => f.id === fileId);
    if (file?.url) {
      URL.revokeObjectURL(file.url);
    }
    
    setFiles(prev => prev.filter(f => f.id !== fileId));
    
    toast({
      title: "File Deleted",
      description: "File removed from assets",
    });
  }, [files, toast]);

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (type: string): string => {
    if (type.startsWith('image/')) return 'mdi:image';
    if (type.startsWith('video/')) return 'mdi:video';
    if (type.startsWith('audio/')) return 'mdi:music';
    if (type.includes('pdf')) return 'mdi:file-pdf';
    if (type.includes('document') || type.includes('docx')) return 'mdi:file-word';
    if (type.includes('spreadsheet') || type.includes('xlsx')) return 'mdi:file-excel';
    if (type.includes('presentation') || type.includes('pptx')) return 'mdi:file-powerpoint';
    return 'mdi:file';
  };

  const filteredFiles = files.filter(file => 
    file.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!isOpen) return null;

  return (
    <div className="w-80 h-full bg-background border-l border-border/50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border/50">
        <div className="flex items-center gap-2">
          <Icon icon="mdi:folder-multiple-image" className="text-xl text-primary" />
          <h3 className="font-semibold">Assets</h3>
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

      {/* Search */}
      <div className="p-4 border-b border-border/50">
        <Input
          placeholder="Search assets..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full"
        />
      </div>

      {/* Upload Area */}
      <div className="p-4 border-b border-border/50">
        <div
          className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer ${
            isDragOver 
              ? 'border-primary bg-primary/10' 
              : 'border-border hover:border-primary/50'
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={handleFileSelect}
        >
          <Icon icon="mdi:cloud-upload" className="mx-auto text-4xl text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground mb-2">
            Drop files here or click to upload
          </p>
          <p className="text-xs text-muted-foreground">
            Supports images, documents, and more
          </p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleFileInputChange}
          accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
        />
      </div>

      {/* File List */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-3">
          {filteredFiles.length === 0 ? (
            <div className="text-center py-8">
              <Icon icon="mdi:folder-open" className="mx-auto text-4xl text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                {searchQuery ? 'No assets match your search' : 'No assets uploaded yet'}
              </p>
            </div>
          ) : (
            filteredFiles.map((file) => (
              <Card 
                key={file.id} 
                className={`cursor-pointer transition-colors hover:bg-accent/50 ${
                  file.uploadStatus === 'error' ? 'border-red-500' : ''
                }`}
                onClick={() => file.uploadStatus === 'completed' && onFileSelect?.(file)}
              >
                <CardContent className="p-3">
                  <div className="flex items-start gap-3">
                    {/* Thumbnail or Icon */}
                    <div className="flex-shrink-0">
                      {file.thumbnail ? (
                        <img 
                          src={file.thumbnail} 
                          alt={file.name}
                          className="w-12 h-12 object-cover rounded border"
                        />
                      ) : (
                        <div className="w-12 h-12 bg-muted rounded border flex items-center justify-center">
                          <Icon icon={getFileIcon(file.type)} className="text-xl text-muted-foreground" />
                        </div>
                      )}
                    </div>

                    {/* File Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{file.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatFileSize(file.size)}
                          </p>
                        </div>
                        
                        {file.uploadStatus === 'completed' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 opacity-0 group-hover:opacity-100"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteFile(file.id);
                            }}
                          >
                            <Icon icon="mdi:delete" className="text-xs" />
                          </Button>
                        )}
                      </div>

                      {/* Progress Bar */}
                      {file.uploadStatus === 'uploading' && (
                        <div className="mt-2">
                          <Progress value={file.uploadProgress} className="h-1" />
                          <p className="text-xs text-muted-foreground mt-1">
                            Uploading... {Math.round(file.uploadProgress || 0)}%
                          </p>
                        </div>
                      )}

                      {/* Status Badge */}
                      <div className="mt-2 flex items-center gap-2">
                        {file.uploadStatus === 'completed' && (
                          <Badge variant="secondary" className="text-xs">
                            <Icon icon="mdi:check" className="mr-1" />
                            Ready
                          </Badge>
                        )}
                        {file.uploadStatus === 'error' && (
                          <Badge variant="destructive" className="text-xs">
                            <Icon icon="mdi:alert" className="mr-1" />
                            Failed
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="p-4 border-t border-border/50">
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{files.length} asset{files.length !== 1 ? 's' : ''}</span>
          <span>
            {files.filter(f => f.uploadStatus === 'completed').length} ready
          </span>
        </div>
      </div>
    </div>
  );
};

export default AssetManager;