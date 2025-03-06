// frontend/src/App.tsx
import React, { useState, useCallback, useEffect } from 'react';
import { useWebSocket } from './hooks/useWebSocket';
import NetworkMap from './components/NetworkMap';
import DeviceCard from './components/DeviceCard';
import DeviceDetails from './components/DeviceDetails';
import { Device } from './types/types';
import { triggerScan } from './services/api';
import { detectNetworkRange } from './utils/networkDetector';

const App: React.FC = () => {
  const { devices, connected, requestUpdate, reconnectAttempt } = useWebSocket();
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [ipRange, setIpRange] = useState('192.168.1.0/24');
  const [isLoading, setIsLoading] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [lastScanTime, setLastScanTime] = useState<Date | null>(null);
  const [showDebugInfo, setShowDebugInfo] = useState(false);
  
  // IPレンジの自動検出
  useEffect(() => {
    // IPレンジを自動検出
    const detectAndSetIpRange = async () => {
      try {
        const detectedRange = await detectNetworkRange();
        console.log(`検出されたネットワークレンジ: ${detectedRange}`);
        setIpRange(detectedRange);
      } catch (e) {
        console.error('IPレンジ検出エラー:', e);
      }
    };
    
    detectAndSetIpRange();
  }, []);
  
  const handleScan = useCallback(async () => {
    setIsLoading(true);
    setScanError(null);
    
    try {
      // スキャンを実行
      await triggerScan(ipRange);
      setLastScanTime(new Date());
      
      // ステータス表示更新
      console.log('スキャン実行中...');
      
      // データ更新を複数回リクエスト
      // 1回目 - スキャン開始直後
      setTimeout(() => {
        requestUpdate();
        console.log('初回更新リクエスト');
        
        // 2回目 - 少し待機
        setTimeout(() => {
          requestUpdate();
          console.log('2回目更新リクエスト');
          
          // 3回目 - さらに待機して最終結果を取得
          setTimeout(() => {
            requestUpdate();
            console.log('最終更新リクエスト');
          }, 3000);
        }, 2000);
      }, 1000);
    } catch (error) {
      console.error("スキャン失敗:", error);
      setScanError(error instanceof Error ? error.message : 'スキャンに失敗しました');
    } finally {
      setIsLoading(false);
    }
  }, [ipRange, requestUpdate]);
  
  const handleNodeClick = useCallback((device: Device) => {
    setSelectedDevice(device);
  }, []);
  
  const closeDetails = useCallback(() => {
    setSelectedDevice(null);
  }, []);
  
  // デバッグモードの切り替え
  const toggleDebugInfo = useCallback(() => {
    setShowDebugInfo(prev => !prev);
  }, []);
  
  return (
    <div className="min-h-screen bg-gray-100">
      <div className="container mx-auto py-6 px-4">
        <header className="mb-8">
          <div className="flex justify-between items-center">
            <h1 className="text-3xl font-bold text-gray-900">LinkScope</h1>
            <div className="flex items-center">
              <div className={`w-3 h-3 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'} mr-2`} />
              <span className="text-sm text-gray-600">
                {connected ? 'サーバーに接続中' : '接続待機中...'}
              </span>
              
              {/* デバッグモード切り替えボタン */}
              <button
                onClick={toggleDebugInfo}
                className="ml-4 text-xs text-gray-500 hover:text-gray-700"
              >
                {showDebugInfo ? 'デバッグ情報を隠す' : 'デバッグ情報を表示'}
              </button>
            </div>
          </div>
          <p className="text-gray-600 mt-2">
            ネットワーク構造をリアルタイムで可視化
          </p>
        </header>
        
        {/* デバッグ情報 */}
        {showDebugInfo && (
          <div className="bg-white p-4 rounded-lg shadow-sm mb-4">
            <h3 className="font-medium text-gray-700 mb-2">デバッグ情報</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>WebSocket:</div>
              <div className={connected ? 'text-green-600' : 'text-red-600'}>
                {connected ? '接続済み' : `未接続 (試行: ${reconnectAttempt})`}
              </div>
              
              <div>検出デバイス:</div>
              <div>{devices.length}台</div>
              
              <div>IPレンジ:</div>
              <div>{ipRange}</div>
              
              {lastScanTime && (
                <>
                  <div>最終スキャン:</div>
                  <div>{lastScanTime.toLocaleTimeString()}</div>
                </>
              )}
            </div>
            
            <div className="mt-3">
              <button
                onClick={() => {
                  requestUpdate();
                  console.log('手動更新リクエスト');
                }}
                className="px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white text-sm rounded mr-2"
              >
                手動更新
              </button>
            </div>
          </div>
        )}
        
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* サイドパネル */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white p-4 rounded-lg shadow-sm">
              <h2 className="text-lg font-medium text-gray-900 mb-4">スキャン設定</h2>
              <div className="space-y-4">
                <div>
                  <label htmlFor="ipRange" className="block text-sm font-medium text-gray-700 mb-1">
                    IP範囲
                  </label>
                  <input
                    id="ipRange"
                    type="text"
                    value={ipRange}
                    onChange={(e) => setIpRange(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-md text-sm"
                    placeholder="例: 192.168.1.0/24"
                  />
                </div>
                {scanError && (
                  <div className="text-red-500 text-sm py-1">
                    {scanError}
                  </div>
                )}
                <button
                  onClick={handleScan}
                  disabled={isLoading}
                  className={`w-full py-2 px-4 rounded-md text-white font-medium ${
                    isLoading ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
                  }`}
                >
                  {isLoading ? 'スキャン中...' : 'スキャン開始'}
                </button>
              </div>
            </div>
            
            <div className="bg-white p-4 rounded-lg shadow-sm">
              <h2 className="text-lg font-medium text-gray-900 mb-4">デバイス一覧</h2>
              {devices.length > 0 ? (
                <div className="space-y-3">
                  {devices.map((device) => (
                    <DeviceCard
                      key={device.ip}
                      device={device}
                      onClick={() => setSelectedDevice(device)}
                    />
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-4">
                  デバイスが見つかりません
                </p>
              )}
            </div>
          </div>
          
          {/* メインコンテンツ */}
          <div className="lg:col-span-3">
            <div className="bg-white p-4 rounded-lg shadow-sm h-[calc(100vh-12rem)]">
              <h2 className="text-lg font-medium text-gray-900 mb-4">ネットワークマップ</h2>
              {devices.length > 0 ? (
                <div className="h-[calc(100%-2rem)]">
                  <NetworkMap
                    devices={devices}
                    onNodeClick={handleNodeClick}
                  />
                </div>
              ) : (
                <div className="h-full flex items-center justify-center">
                  <p className="text-gray-500">
                    デバイスが見つかりません。スキャンを実行してください。
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      
      {/* デバイス詳細モーダル */}
      {selectedDevice && (
        <DeviceDetails
          device={selectedDevice}
          onClose={closeDetails}
        />
      )}
    </div>
  );
};

export default App;