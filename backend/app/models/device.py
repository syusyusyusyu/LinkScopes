# backend/app/models/device.py
from pydantic import BaseModel
from typing import Optional, List

class Device(BaseModel):
    ip: str
    mac: str
    manufacturer: Optional[str] = None
    hostname: Optional[str] = None
    is_gateway: bool = False
    connected_to: List[str] = []
