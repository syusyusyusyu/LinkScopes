// frontend/src/hooks/useWebSocket.ts
import { useState, useEffect, useCallback } from 'react';
import { Device } from '../types/types';

export const useWebSocket = () => {
  const [devices, setDevices] = useState<Device[]>([]);
  const [connected, setConnected] = useState(false);
  const [socket, setSocket] = useState<WebSocket | null>(null);

  const connect = useCallback(() => {
    const ws = new WebSocket('ws://localhost:8000/api/ws');
    
    ws.onopen = () => {
      setConnected(true);
      ws.send('get_devices');
    };
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setDevices(data);
    };
    
    ws.onclose = () => {
      setConnected(false);
      // 5秒後に再接続を試みる
      setTimeout(connect, 5000);
    };
    
    setSocket(ws);
    
    return () => {
      ws.close();
    };
  }, []);
  
  const requestUpdate = useCallback(() => {
    if (socket && connected) {
      socket.send('get_devices');
    }
  }, [socket, connected]);
  
  useEffect(() => {
    const cleanup = connect();
    return cleanup;
  }, [connect]);
  
  return { devices, connected, requestUpdate };
};
