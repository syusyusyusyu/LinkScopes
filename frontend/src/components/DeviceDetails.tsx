// frontend/src/components/DeviceDetails.tsx
import React from 'react';
import { Device } from '../types/types';

interface DeviceDetailsProps {
  device: Device | null;
  onClose: () => void;
}

const DeviceDetails: React.FC<DeviceDetailsProps> = ({ device, onClose }) => {
  if (!device) return null;
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full">
        <div className="flex justify-between items-start mb-4">
          <h2 className="text-xl font-bold">
            {device.hostname || device.ip}
            {device.is_gateway && (
              <span className="ml-2 inline-block px-2 py-1 text-xs font-medium text-white bg-purple-500 rounded-full">
                ゲートウェイ
              </span>
            )}
          </h2>
          <button 
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        </div>
        
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-1 font-medium">IP アドレス:</div>
            <div className="col-span-2">{device.ip}</div>
          </div>
          
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-1 font-medium">MAC アドレス:</div>
            <div className="col-span-2">{device.mac}</div>
          </div>
          
          {device.manufacturer && (
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-1 font-medium">メーカー:</div>
              <div className="col-span-2">{device.manufacturer}</div>
            </div>
          )}
          
          {device.hostname && (
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-1 font-medium">ホスト名:</div>
              <div className="col-span-2">{device.hostname}</div>
            </div>
          )}
          
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-1 font-medium">接続先:</div>
            <div className="col-span-2">
              {device.connected_to.length > 0 
                ? device.connected_to.join(', ') 
                : '接続先なし'}
            </div>
          </div>
        </div>
        
        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-md text-gray-800"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeviceDetails;
