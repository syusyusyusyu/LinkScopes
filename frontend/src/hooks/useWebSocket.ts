// frontend/src/hooks/useWebSocket.ts
import { useState, useEffect, useCallback, useRef } from 'react';
import { Device } from '../types/types';

export const useWebSocket = () => {
  const [devices, setDevices] = useState<Device[]>([]);
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;
  const initialReconnectDelay = 1000;
  const maxReconnectDelay = 30000;

  const connect = useCallback(() => {
    // 既存の再接続タイマーをクリア
    if (reconnectTimeoutRef.current !== null) {
      window.clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    // すでに接続中の場合は何もしない
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      return;
    }
    
    // 既存の接続を閉じる
    if (socketRef.current) {
      try {
        socketRef.current.close();
      } catch (e) {
        console.error('Error closing existing WebSocket:', e);
      }
    }
    
    try {
      console.log('Attempting to connect to WebSocket...');
      const ws = new WebSocket('ws://localhost:8000/api/ws');
      socketRef.current = ws;
      
      ws.onopen = () => {
        console.log('WebSocket connected');
        setConnected(true);
        reconnectAttemptsRef.current = 0; // 成功したらリセット
        
        // 接続後にデバイスデータをリクエスト
        ws.send('get_devices');
      };
      
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (Array.isArray(data)) {
            setDevices(data);
          } else {
            console.warn('Received non-array data from WebSocket:', data);
          }
        } catch (error) {
          console.error('Failed to parse WebSocket data:', error);
        }
      };
      
      ws.onclose = (event) => {
        console.log('WebSocket closed:', event.code, event.reason);
        setConnected(false);
        socketRef.current = null;
        
        // 自動再接続 (指数バックオフで待機時間を増やす)
        if (reconnectAttemptsRef.current < maxReconnectAttempts) {
          const delay = Math.min(
            initialReconnectDelay * Math.pow(2, reconnectAttemptsRef.current),
            maxReconnectDelay
          );
          
          console.log(`Reconnect attempt ${reconnectAttemptsRef.current + 1}/${maxReconnectAttempts} in ${delay}ms`);
          
          reconnectTimeoutRef.current = window.setTimeout(() => {
            reconnectAttemptsRef.current++;
            connect();
          }, delay);
        } else {
          console.log('Max reconnect attempts reached. Giving up.');
        }
      };
      
      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        // エラーハンドリングはoncloseに任せる（oncloseが必ず呼ばれる）
      };
    } catch (error) {
      console.error('Error setting up WebSocket:', error);
      setConnected(false);
    }
  }, []);
  
  const requestUpdate = useCallback(() => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send('get_devices');
    } else {
      console.log('Cannot request update - WebSocket is not connected');
      // WebSocketが接続されていない場合は接続を試みる
      if (!socketRef.current || socketRef.current.readyState === WebSocket.CLOSED) {
        connect();
      }
    }
  }, [connect]);
  
  // コンポーネントのマウント時に接続
  useEffect(() => {
    connect();
    
    // クリーンアップ関数
    return () => {
      if (reconnectTimeoutRef.current !== null) {
        window.clearTimeout(reconnectTimeoutRef.current);
      }
      
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, [connect]);
  
  // 定期的なステータスチェック
  useEffect(() => {
    const checkInterval = setInterval(() => {
      if (!connected && reconnectAttemptsRef.current < maxReconnectAttempts) {
        requestUpdate();
      }
    }, 10000); // 10秒ごとにチェック
    
    return () => clearInterval(checkInterval);
  }, [connected, requestUpdate]);
  
  return { devices, connected, requestUpdate };
};