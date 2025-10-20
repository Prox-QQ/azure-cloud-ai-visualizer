import React, { useState, useRef, useEffect } from 'react';
import { Icon } from '@iconify/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { useChat } from '@/hooks/useChat';
import { useDiagramStore } from '@/store/diagramStore';
import { ArchitectureParser, ParsedArchitecture } from '@/services/architectureParser';
import { AzureService } from '@/data/azureServices';
import { ImageUpload } from '@/components/upload/ImageUpload';

interface ChatPanelProps {
  isOpen: boolean;
  onToggle: () => void;
}

const ChatPanel: React.FC<ChatPanelProps> = ({ isOpen, onToggle }) => {
  const [inputMessage, setInputMessage] = useState('');
  const [showImageUpload, setShowImageUpload] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { addNodesFromArchitecture, clearDiagram } = useDiagramStore();

  const {
    messages,
    isConnected,
    isTyping,
    sendMessage,
    connectWebSocket,
    disconnect
    , addAssistantMessage
  } = useChat({
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  });
  

  // Function to check if a message contains architecture information
  const containsArchitecture = (content: string): boolean => {
    const architectureKeywords = [
      'architecture', 'azure app service', 'sql database', 'storage account',
      'azure functions', 'application gateway', 'virtual network', 'bicep',
      'terraform', 'resource', 'microsoft.web', 'microsoft.sql', 'microsoft.storage'
    ];
    
    const lowerContent = content.toLowerCase();
    return architectureKeywords.some(keyword => lowerContent.includes(keyword));
  };

  // Function to visualize architecture from AI response
  const visualizeArchitecture = (messageContent: string, replaceExisting: boolean = false) => {
    try {
      const architecture = ArchitectureParser.parseResponse(messageContent);
      
      if (architecture.services.length === 0) {
        toast({
          title: "No Architecture Found",
          description: "Could not extract Azure services from this message.",
          variant: "destructive",
        });
        return;
      }

      if (replaceExisting) {
        clearDiagram();
      }

      const nodes = ArchitectureParser.generateNodes(architecture);
      addNodesFromArchitecture(nodes, architecture.connections);

      toast({
        title: "Architecture Visualized",
        description: `Added ${architecture.services.length} Azure services to the diagram.`,
      });
    } catch (error) {
      console.error('Error visualizing architecture:', error);
      toast({
        title: "Visualization Error",
        description: "Failed to visualize the architecture. Please try again.",
        variant: "destructive",
      });
    }
  };

  // WebSocket connection management - DISABLED for stability, using REST API
  useEffect(() => {
    // Disabled WebSocket auto-connection to avoid unnecessary connection attempts
    // The chat uses REST API which is working perfectly with OpenAI
    console.log('Chat panel opened, using REST API for communication');
  }, [isOpen]);

  const handleSendMessage = async (content: string) => {
    await sendMessage(content);
    setInputMessage('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSendMessage(inputMessage);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(inputMessage);
    }
  };

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollElement = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollElement) {
        scrollElement.scrollTop = scrollElement.scrollHeight;
      }
    }
  }, [messages]);

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const formatTimestamp = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getStatusIcon = (status?: string) => {
    switch (status) {
      case 'sending':
        return <Icon icon="mdi:clock-outline" className="text-yellow-500 animate-pulse" />;
      case 'sent':
        return <Icon icon="mdi:check" className="text-green-500" />;
      case 'error':
        return <Icon icon="mdi:alert-circle" className="text-red-500" />;
      default:
        return null;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="w-80 h-full bg-background border-l border-border/50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border/50">
        <div className="flex items-center gap-2">
          <Icon icon="mdi:robot" className="text-xl text-primary" />
          <div>
            <h3 className="font-semibold">Azure AI Assistant</h3>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
              {isConnected ? 'Connected' : 'Disconnected'}
            </div>
          </div>
        </div>
        <div className="ml-2">
          {isConnected ? (
            <Button size="sm" variant="ghost" onClick={() => disconnect()}>
              Disconnect
            </Button>
          ) : (
            <Button size="sm" onClick={() => connectWebSocket()}>
              Connect
            </Button>
          )}
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

      <ScrollArea ref={scrollAreaRef} className="flex-1 p-4">
        <div className="space-y-4">

          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <Card className={`max-w-[85%] p-3 ${
                message.role === 'user' 
                  ? 'bg-primary text-primary-foreground' 
                  : 'bg-muted'
              }`}>
                <div className="whitespace-pre-wrap text-sm">
                  {message.content}
                </div>
                
                {/* Visualization buttons for assistant messages with architecture */}
                {message.role === 'assistant' && (containsArchitecture(message.content) || message.meta?.analysisResult) && (
                  <div className="flex gap-2 mt-3 pt-3 border-t border-border/50">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        const analysis = message.meta?.analysisResult;
                        if (!analysis) {
                          visualizeArchitecture(message.content, false);
                          return;
                        }

                        // Collect unique service names from the analysis (services + connection endpoints)
                        const nameSet = new Set<string>();
                        (analysis.services || []).forEach((s: string) => nameSet.add(s));
                        (analysis.connections || []).forEach((c: { from_service?: string; to_service?: string; label?: string }) => {
                          if (c.from_service) nameSet.add(c.from_service);
                          if (c.to_service) nameSet.add(c.to_service);
                        });

                        const allNames = Array.from(nameSet);
                        const unmapped: string[] = [];
                        const servicesArr: AzureService[] = [];
                        const nameToId = new Map<string, string>();

                        for (const name of allNames) {
                          const found = ArchitectureParser.findAzureServiceByName(name);
                          if (found) {
                            servicesArr.push(found);
                            nameToId.set(name, found.id);
                          } else {
                            // create a stub AzureService so the node will appear
                            const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
                            const stub: AzureService = {
                              id: `ai:${slug}`,
                              type: `ai.detected/${slug}`,
                              category: 'AI Detected',
                              categoryId: 'ai-detected',
                              title: name,
                              iconPath: '',
                              description: 'Detected by AI from diagram',
                            } as AzureService;
                            servicesArr.push(stub);
                            nameToId.set(name, stub.id);
                            unmapped.push(name);
                          }
                        }

                        // Build connections using ids (fallback to stub ids)
                        const connections = (analysis.connections || []).map((c: { from_service?: string; to_service?: string; label?: string }) => ({
                          from: nameToId.get(c.from_service || '') || `ai:${(c.from_service || '').toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
                          to: nameToId.get(c.to_service || '') || `ai:${(c.to_service || '').toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
                          label: c.label,
                        }));

                        const architecture: ParsedArchitecture = {
                          services: servicesArr,
                          connections,
                          layout: servicesArr.length <= 3 ? 'horizontal' : servicesArr.length <= 6 ? 'vertical' : 'grid'
                        };

                        const nodes = ArchitectureParser.generateNodes(architecture);
                        addNodesFromArchitecture(nodes, architecture.connections);

                        if (unmapped.length) {
                          toast({ title: 'Some detected services were unmapped', description: unmapped.slice(0,10).join(', ') });
                        }
                      }}
                      className="text-xs"
                    >
                      <Icon icon="mdi:diagram-outline" className="mr-1" />
                      Add to Diagram
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        const analysis = message.meta?.analysisResult;
                        if (!analysis) {
                          visualizeArchitecture(message.content, true);
                          return;
                        }

                        // Collect unique names (services + connection endpoints)
                        const nameSet = new Set<string>();
                        (analysis.services || []).forEach((s: string) => nameSet.add(s));
                        (analysis.connections || []).forEach((c: { from_service?: string; to_service?: string; label?: string }) => {
                          if (c.from_service) nameSet.add(c.from_service);
                          if (c.to_service) nameSet.add(c.to_service);
                        });

                        const allNames = Array.from(nameSet);
                        const unmapped: string[] = [];
                        const servicesArr: AzureService[] = [];
                        const nameToId = new Map<string, string>();

                        for (const name of allNames) {
                          const found = ArchitectureParser.findAzureServiceByName(name);
                          if (found) {
                            servicesArr.push(found);
                            nameToId.set(name, found.id);
                          } else {
                            const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
                            const stub: AzureService = {
                              id: `ai:${slug}`,
                              type: `ai.detected/${slug}`,
                              category: 'AI Detected',
                              categoryId: 'ai-detected',
                              title: name,
                              iconPath: '',
                              description: 'Detected by AI from diagram',
                            } as AzureService;
                            servicesArr.push(stub);
                            nameToId.set(name, stub.id);
                            unmapped.push(name);
                          }
                        }

                        const connections = (analysis.connections || []).map((c: { from_service?: string; to_service?: string; label?: string }) => ({
                          from: nameToId.get(c.from_service || '') || `ai:${(c.from_service || '').toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
                          to: nameToId.get(c.to_service || '') || `ai:${(c.to_service || '').toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
                          label: c.label,
                        }));

                        const architecture: ParsedArchitecture = {
                          services: servicesArr,
                          connections,
                          layout: servicesArr.length <= 3 ? 'horizontal' : servicesArr.length <= 6 ? 'vertical' : 'grid'
                        };

                        const nodes = ArchitectureParser.generateNodes(architecture);
                        clearDiagram();
                        addNodesFromArchitecture(nodes, architecture.connections);

                        if (unmapped.length) {
                          toast({ title: 'Some detected services were unmapped', description: unmapped.slice(0,10).join(', ') });
                        }
                      }}
                      className="text-xs"
                    >
                      <Icon icon="mdi:refresh" className="mr-1" />
                      Replace Diagram
                    </Button>
                  </div>
                )}
                
                <div className={`flex items-center justify-between mt-2 text-xs ${
                  message.role === 'user' 
                    ? 'text-primary-foreground/70' 
                    : 'text-muted-foreground'
                }`}>
                  <span>{formatTimestamp(message.timestamp)}</span>
                  {message.role === 'user' && getStatusIcon(message.status)}
                </div>
              </Card>
            </div>
          ))}
          
          {isTyping && (
            <div className="flex justify-start">
              <Card className="bg-muted p-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-current rounded-full animate-bounce" />
                    <div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                    <div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                  </div>
                  Assistant is typing...
                </div>
              </Card>
            </div>
          )}
        </div>
      </ScrollArea>

      <Separator />

      {/* Quick Actions */}
      <div className="p-3 border-b border-border/50">
        <div className="flex flex-wrap gap-2">
          <Badge 
            variant="secondary" 
            className="cursor-pointer hover:bg-secondary/80"
            onClick={() => setInputMessage("Help me design a web application architecture")}
          >
            <Icon icon="mdi:web" className="mr-1" />
            Web App
          </Badge>
          <Badge 
            variant="secondary" 
            className="cursor-pointer hover:bg-secondary/80"
            onClick={() => setInputMessage("Generate Bicep code for this diagram")}
          >
            <Icon icon="mdi:code-json" className="mr-1" />
            Generate IaC
          </Badge>
          <Badge 
            variant="secondary" 
            className="cursor-pointer hover:bg-secondary/80"
            onClick={() => setInputMessage("Analyze my current architecture")}
          >
            <Icon icon="mdi:chart-line" className="mr-1" />
            Analyze
          </Badge>
        </div>
      </div>

      {/* Image Upload Section */}
      {showImageUpload && (
        <div className="p-4 border-t">
          <ImageUpload 
                onAnalysisComplete={(result) => {
                  toast({
                    title: "Diagram Analyzed",
                    description: `Found ${result.services.length} services in your diagram!`,
                  });
                  // Push the assistant's analysis description into the chat so users see it
                  console.log('Image analysis completed, result preview:', {
                    services: result.services?.slice?.(0, 10),
                    connections: result.connections?.slice?.(0, 10),
                    description: result.description?.slice?.(0, 200)
                  });
                  if (typeof addAssistantMessage === 'function') {
                      const meta = { analysisResult: result };
                      if (result.description) {
                        console.log('Adding assistant message from analysis description with meta');
                        addAssistantMessage(result.description, meta);
                        toast({ title: 'Assistant message added', description: result.description.slice(0, 200) });
                      } else {
                        console.log('Adding assistant message with summary fallback and meta');
                        const summary = `Analyzed diagram: found ${result.services.length} services.`;
                        addAssistantMessage(summary, meta);
                        toast({ title: 'Assistant message added', description: summary });
                      }
                  } else {
                    console.error('addAssistantMessage is not available on useChat hook');
                  }
                  setShowImageUpload(false);
                }}
          />
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-4">
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => setShowImageUpload(!showImageUpload)}
            className="shrink-0"
          >
            <Icon icon={showImageUpload ? "mdi:close" : "mdi:image-plus"} />
          </Button>
          <Input
            ref={inputRef}
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask me about Azure architecture or upload a diagram..."
            className="flex-1"
            disabled={isTyping}
          />
          <Button
            type="submit"
            size="icon"
            disabled={!inputMessage.trim() || isTyping}
          >
            <Icon icon="mdi:send" />
          </Button>
        </div>
        <div className="text-xs text-muted-foreground mt-2">
          Press Enter to send, Shift+Enter for new line • Click 📷 to upload diagrams
        </div>
      </form>
    </div>
  );
};

export default ChatPanel;