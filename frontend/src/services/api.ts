// frontend/src/services/api.ts
import { Device } from '../types/types.ts';

const API_URL = 'http://localhost:8000/api';

export const fetchDevices = async (): Promise<Device[]> => {
  const response = await fetch(`${API_URL}/devices`);
  if (!response.ok) {
    throw new Error('Network response was not ok');
  }
  return response.json();
};

export const triggerScan = async (ipRange: string = '192.168.1.0/24'): Promise<void> => {
  await fetch(`${API_URL}/scan`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ip_range: ipRange }),
  });
};