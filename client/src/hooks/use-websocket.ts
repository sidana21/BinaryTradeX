import { useEffect, useRef, useState } from 'react';

interface WebSocketMessage {
  type: string;
  data: any;
}

export function useWebSocket(url: string) {
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  const ws = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();

  const connect = () => {
    const protocol = location.protocol === "https:" ? "wss" : "ws";
    const socketUrl = `${protocol}://${location.host}/ws`;
    
    console.log("🔌 Connecting to:", socketUrl);
    
    ws.current = new WebSocket(socketUrl);

    ws.current.onopen = () => {
      console.log("✅ Connected to WebSocket");
      setIsConnected(true);
      // Subscribe to updates
      ws.current?.send(JSON.stringify({ type: 'subscribe' }));
    };

    ws.current.onmessage = (event) => {
      console.log("📨 Message from server:", event.data);
      try {
        const message: WebSocketMessage = JSON.parse(event.data);
        setLastMessage(message);
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };

    ws.current.onclose = () => {
      console.log("❌ WebSocket disconnected");
      setIsConnected(false);
      // Attempt to reconnect after 3 seconds
      reconnectTimeoutRef.current = setTimeout(connect, 3000);
    };

    ws.current.onerror = (err) => {
      console.error("⚠️ WebSocket error:", err);
    };
  };

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (ws.current) {
        ws.current.close();
      }
    };
  }, [url]);

  const sendMessage = (message: any) => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(message));
    }
  };

  return {
    isConnected,
    lastMessage,
    sendMessage
  };
}
