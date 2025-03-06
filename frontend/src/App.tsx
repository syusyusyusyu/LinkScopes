// frontend/src/App.tsx
import React, { useState } from 'react';
import { useWebSocket } from './hooks/useWebSocket';
import NetworkMap from './components/NetworkMap';
import DeviceCard from './components/DeviceCard';
import DeviceDetails from './components/DeviceDetails';
import { Device } from './types/types';
import { triggerScan } from './services/api';

const App: React.FC = () => {
  const { devices, connected, requestUpdate } = useWebSocket();
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [ipRange, setIpRange] = useState('192.168.1.0/24');
  const [isLoading, setIsLoading] = useState(false);
  
  const handleScan = async () => {
    setIsLoading(true);
    try {
      await triggerScan(ipRange);
      setTimeout(requestUpdate, 3000); // スキャン完了を少し待ってからデータを更新
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleNodeClick = (device: Device) => {
    setSelectedDevice(device);
  };
  
  const closeDetails = () => {
    setSelectedDevice(null);
  };
  
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
            </div>
          </div>
          <p className="text-gray-600 mt-2">
            ネットワーク構造をリアルタイムで可視化
          </p>
        </header>
        
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
                <button
                  onClick={handleScan}
                  disabled={isLoading}
                  className={`w-full py-2 px-4 rounded-md text-white font-medium ${
                    isLoading ? 'bg-blue-400' : 'bg-blue-600 hover:bg-blue-700'
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
