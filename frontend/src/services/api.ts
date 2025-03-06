// frontend/src/services/api.ts
import { Device } from '../types/types.ts';

const API_URL = 'http://localhost:8000/api';

export const fetchDevices = async (): Promise<Device[]> => {
  try {
    const response = await fetch(`${API_URL}/devices`, {
      headers: {
        'Accept': 'application/json',
      },
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch devices: ${response.status} ${response.statusText}`);
    }
    
    return response.json();
  } catch (error) {
    console.error('Error fetching devices:', error);
    throw error;
  }
};

export const triggerScan = async (ipRange: string = '192.168.1.0/24'): Promise<void> => {
  try {
    // 単純なGETリクエストを使用する（CORSの問題を回避するため）
    const response = await fetch(`${API_URL}/scan?ip_range=${encodeURIComponent(ipRange)}`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
      },
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(errorData?.message || `Scan failed: ${response.status} ${response.statusText}`);
    }
  } catch (error) {
    console.error('Error triggering network scan:', error);
    throw error;
  }
};