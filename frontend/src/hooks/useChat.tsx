import { useState, useCallback, useRef } from 'react';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  status?: 'sending' | 'sent' | 'error';
  meta?: ChatMeta;
}

export type ChatMeta = {
  analysisResult?: {
    services?: string[];
    connections?: { from_service: string; to_service: string; label?: string }[];
    description?: string;
  };
};

export interface UseChatOptions {
  onError?: (error: Error) => void;
  apiUrl?: string;
  wsUrl?: string;
}

export const useChat = (options: UseChatOptions = {}) => {
  const {
    onError,
    apiUrl = 'http://localhost:8000/api/chat',
    wsUrl = 'ws://localhost:8000/ws/chat'
  } = options;

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      role: 'assistant',
      content: 'Hello! I\'m your Azure Architect AI assistant. I can help you design cloud architectures, generate Infrastructure as Code, and analyze your diagrams. How can I assist you today?',
      timestamp: new Date(),
      status: 'sent'
    }
  ]);

  const [isConnected, setIsConnected] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  const connectWebSocket = useCallback(() => {
    try {
      console.log(`Attempting to connect to WebSocket: ${wsUrl}`);
      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = () => {
        setIsConnected(true);
        console.log('✅ WebSocket connected successfully');
      };

      wsRef.current.onmessage = (event) => {
        console.log('📥 WebSocket message received:', event.data);
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'message') {
            setMessages(prev => [...prev, {
              id: Date.now().toString(),
              role: 'assistant',
              content: data.content,
              timestamp: new Date(),
              status: 'sent'
            }]);
            setIsTyping(false);
          } else if (data.type === 'typing') {
            setIsTyping(data.typing);
          }
        } catch (err) {
          console.error('Failed to parse WebSocket message:', err);
        }
      };

      wsRef.current.onerror = (error) => {
        console.error('❌ WebSocket error details:', {
          error,
          readyState: wsRef.current?.readyState,
          url: wsUrl,
          protocols: wsRef.current?.protocol
        });
        setIsConnected(false);
        // Don't show error to user - we'll fallback to REST API
      };

      wsRef.current.onclose = (event) => {
        setIsConnected(false);
        console.log('🔌 WebSocket disconnected:', {
          code: event.code,
          reason: event.reason,
          wasClean: event.wasClean
        });
      };
    } catch (error) {
      console.error('❌ Failed to create WebSocket:', error);
      setIsConnected(false);
    }
  }, [wsUrl]);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
  }, []);

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim()) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: content.trim(),
      timestamp: new Date(),
      status: 'sending'
    };

    setMessages(prev => [...prev, userMessage]);
    setIsTyping(true);

    try {
      // Always use REST API for now since WebSocket has issues
      console.log('📤 Sending message via REST API');
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: content.trim(),
          conversation_history: messages.map(msg => ({
            role: msg.role,
            content: msg.content
          }))
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('API Error:', response.status, errorText);
        throw new Error('Failed to send message');
      }

      const data = await response.json();
      console.log('📥 Received response:', data);

      setMessages(prev => [
        ...prev.map(msg => 
          msg.id === userMessage.id ? { ...msg, status: 'sent' as const } : msg
        ),
        {
          id: (Date.now() + 1).toString(),
          role: 'assistant' as const,
          content: data.message?.content || data.response || 'No response received',
          timestamp: new Date(),
          status: 'sent' as const
        }
      ]);
      setIsTyping(false);
    } catch (error) {
      console.error('❌ Error sending message:', error);
      setMessages(prev => prev.map(msg => 
        msg.id === userMessage.id ? { ...msg, status: 'error' } : msg
      ));
      setIsTyping(false);
      onError?.(error as Error);
    }
  }, [apiUrl, messages, onError]);

  const clearMessages = useCallback(() => {
    setMessages([
      {
        id: '1',
        role: 'assistant',
        content: 'Hello! I\'m your Azure Architect AI assistant. How can I assist you today?',
        timestamp: new Date(),
        status: 'sent'
      }
    ]);
  }, []);

  const addAssistantMessage = useCallback((content: string, meta?: ChatMeta) => {
    if (!content) return;
    const msg: ChatMessage = {
      id: Date.now().toString(),
      role: 'assistant',
      content,
      timestamp: new Date(),
      status: 'sent',
      meta
    };
    setMessages(prev => [...prev, msg]);
  }, []);

  return {
    messages,
    isConnected,
    isTyping,
    sendMessage,
    connectWebSocket,
    disconnect,
    clearMessages
    , addAssistantMessage
  };
};