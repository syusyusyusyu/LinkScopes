// frontend/src/hooks/useWebSocket.ts
import { useState, useEffect, useCallback, useRef } from 'react';
import { Device } from '../types/types';
import { fetchDevices } from '../services/api';

// 開発環境の判定
const isDevelopment = import.meta.env.DEV;

export const useWebSocket = () => {
  const [devices, setDevices] = useState<Device[]>([]);
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const isComponentMountedRef = useRef(true);
  const maxReconnectAttempts = isDevelopment ? 10 : 5;
  const initialReconnectDelay = isDevelopment ? 2000 : 1000;
  const maxReconnectDelay = 30000;

  // サーバーがアクティブかチェック
  const checkServerHealth = useCallback(async (): Promise<boolean> => {
  try {
    // HEADの代わりにGETを使用（より軽量なオプションをつける）
    const response = await fetch('http://localhost:8000/api/devices', {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      // レスポンスボディが不要であることを示す
      cache: 'no-store',
      signal: AbortSignal.timeout(3000) // タイムアウト3秒
    });
    return response.ok;
  } catch (error) {
    console.log('Server health check failed:', error);
    return false;
  }
}, []);

  // WebSocketフォールバックとしてHTTPリクエストでデータ取得
  const fetchDevicesWithFallback = useCallback(async (): Promise<boolean> => {
    try {
      if (!isComponentMountedRef.current) return false;
      
      const deviceData = await fetchDevices();
      setDevices(deviceData);
      return true;
    } catch (error) {
      console.error('Failed to fetch devices with fallback:', error);
      return false;
    }
  }, []);

  const connect = useCallback(async () => {
    // 既存の再接続タイマーをクリア
    if (reconnectTimeoutRef.current !== null) {
      window.clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    // コンポーネントがアンマウントされていたら何もしない
    if (!isComponentMountedRef.current) return;
    
    // すでに接続中の場合は何もしない
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      return;
    }
    
    // サーバーの健全性をチェック
    const isServerHealthy = await checkServerHealth();
    if (!isServerHealthy) {
      console.log('Server is not healthy, will retry connection later');
      
      // 最大再試行回数を超えた場合はHTTPフォールバックを使用
      if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
        console.log('Max WebSocket reconnection attempts reached, using HTTP fallback');
        await fetchDevicesWithFallback();
      }
      
      // 再接続を予約
      if (reconnectAttemptsRef.current < maxReconnectAttempts && isComponentMountedRef.current) {
        const delay = Math.min(
          initialReconnectDelay * Math.pow(2, reconnectAttemptsRef.current),
          maxReconnectDelay
        );
        
        console.log(`Scheduling reconnect attempt ${reconnectAttemptsRef.current + 1}/${maxReconnectAttempts} in ${delay}ms`);
        
        reconnectTimeoutRef.current = window.setTimeout(() => {
          reconnectAttemptsRef.current++;
          connect();
        }, delay);
      }
      
      return;
    }
    
    // 既存の接続を適切に閉じる
    if (socketRef.current) {
      try {
        // 接続が確立されている場合のみ正常に閉じる
        if (socketRef.current.readyState === WebSocket.OPEN) {
          socketRef.current.close(1000, "Reconnecting");
        } else {
          // その他の状態では強制的に参照を切る
          socketRef.current = null;
        }
      } catch (e) {
        console.error('Error closing existing WebSocket:', e);
        socketRef.current = null;
      }
    }
    
    try {
      console.log('Attempting to connect to WebSocket...');
      const ws = new WebSocket('ws://localhost:8000/api/ws');
      socketRef.current = ws;
      
      // 接続タイムアウトを設定
      const connectionTimeout = setTimeout(() => {
        if (ws.readyState !== WebSocket.OPEN && isComponentMountedRef.current) {
          console.log('WebSocket connection timeout');
          ws.close();
        }
      }, 10000);
      
      ws.onopen = () => {
        clearTimeout(connectionTimeout);
        
        if (!isComponentMountedRef.current) {
          // コンポーネントがアンマウントされていたら接続を閉じる
          ws.close(1000, "Component unmounted");
          return;
        }
        
        console.log('WebSocket connected');
        setConnected(true);
        reconnectAttemptsRef.current = 0; // 成功したらリセット
        
        // 接続後にデバイスデータをリクエスト
        ws.send('get_devices');
      };
      
      ws.onmessage = (event) => {
        if (!isComponentMountedRef.current) return;
        
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
        clearTimeout(connectionTimeout);
        
        console.log('WebSocket closed:', event.code, event.reason);
        
        if (!isComponentMountedRef.current) return;
        
        setConnected(false);
        socketRef.current = null;
        
        // 正常なクローズでは再接続しない (code 1000)
        if (event.code === 1000 && event.reason === "Component unmounted") {
          return;
        }
        
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
          console.log('Max reconnect attempts reached. Switching to HTTP fallback.');
          fetchDevicesWithFallback();
        }
      };
      
      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        // エラーハンドリングはoncloseに任せる（oncloseが必ず呼ばれる）
      };
    } catch (error) {
      console.error('Error setting up WebSocket:', error);
      if (isComponentMountedRef.current) {
        setConnected(false);
      }
    }
  }, [checkServerHealth, fetchDevicesWithFallback]);
  
  const requestUpdate = useCallback(() => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send('get_devices');
      return true;
    } else {
      console.log('Cannot request update - WebSocket is not connected');
      // WebSocketが接続されていない場合は接続を試みる
      if (!socketRef.current || socketRef.current.readyState === WebSocket.CLOSED) {
        connect();
      }
      return false;
    }
  }, [connect]);
  
  // コンポーネントのマウント時に接続
  useEffect(() => {
    isComponentMountedRef.current = true;
    connect();
    
    // クリーンアップ関数
    return () => {
      isComponentMountedRef.current = false;
      
      if (reconnectTimeoutRef.current !== null) {
        window.clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      
      if (socketRef.current) {
        // 接続が確立されている場合のみ正常に閉じる
        if (socketRef.current.readyState === WebSocket.OPEN) {
          socketRef.current.close(1000, "Component unmounted");
        }
        socketRef.current = null;
      }
    };
  }, [connect]);
  
  // 定期的なステータスチェック
  useEffect(() => {
    // 接続が切れている場合、定期的にチェック
    const checkInterval = setInterval(() => {
      if (!connected && reconnectAttemptsRef.current < maxReconnectAttempts && isComponentMountedRef.current) {
        console.log('Periodic connection check');
        connect();
      }
    }, 15000); // 15秒ごとにチェック
    
    return () => clearInterval(checkInterval);
  }, [connected, connect]);
  
  // 接続情報の取得
  const getConnectionStatus = useCallback(() => {
    return {
      connected,
      reconnecting: !connected && reconnectAttemptsRef.current > 0,
      reconnectAttempt: reconnectAttemptsRef.current,
      maxReconnectAttempts
    };
  }, [connected]);
  
  return { 
    devices, 
    connected, 
    requestUpdate, 
    getConnectionStatus, 
    reconnectAttempt: reconnectAttemptsRef.current 
  };
};