// frontend/src/types/types.ts
export interface Device {
    ip: string;
    mac: string;
    manufacturer: string | null;
    hostname: string | null;
    is_gateway: boolean;
    connected_to: string[];
  }