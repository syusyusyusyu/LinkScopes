// frontend/src/components/DeviceCard.tsx
import React from 'react';
import { Device } from '../types/types';

interface DeviceCardProps {
  device: Device;
  onClick: () => void;
}

const DeviceCard: React.FC<DeviceCardProps> = ({ device, onClick }) => {
  return (
    <div 
      className="p-4 border rounded-lg shadow-sm bg-white hover:shadow-md transition-shadow cursor-pointer"
      onClick={onClick}
    >
      <div className="flex items-center mb-2">
        <div className={`w-3 h-3 rounded-full mr-2 ${device.is_gateway ? 'bg-purple-500' : 'bg-green-500'}`} />
        <h3 className="text-lg font-medium text-gray-900">
          {device.hostname || device.ip}
        </h3>
      </div>
      <div className="text-sm text-gray-600">
        <p><span className="font-medium">IP:</span> {device.ip}</p>
        <p><span className="font-medium">MAC:</span> {device.mac}</p>
        {device.manufacturer && (
          <p><span className="font-medium">メーカー:</span> {device.manufacturer}</p>
        )}
        {device.is_gateway && (
          <div className="mt-1 inline-block px-2 py-1 text-xs font-medium text-white bg-purple-500 rounded-full">
            ゲートウェイ
          </div>
        )}
      </div>
    </div>
  );
};

export default DeviceCard;
