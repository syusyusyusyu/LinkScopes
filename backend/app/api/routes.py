# backend/app/api/routes.py
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse
from ..core.scanner import NetworkScanner
import asyncio
import json

router = APIRouter()
scanner = NetworkScanner()

# 接続されているWebSocketクライアントを管理
connected_clients = set()

@router.get("/devices")
async def get_devices():
    """スキャンされたデバイスのリストを取得"""
    devices = scanner.get_devices()
    return JSONResponse(content=[device.dict() for device in devices])

@router.post("/scan")
async def scan_network(ip_range: str = "192.168.1.0/24"):
    """ネットワークスキャンを手動で実行"""
    scanner.scan_network(ip_range)
    return {"status": "scan_completed"}

@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocketエンドポイント - リアルタイム更新用"""
    await websocket.accept()
    connected_clients.add(websocket)
    
    try:
        while True:
            # クライアントからのメッセージを待機
            await websocket.receive_text()
            
            # 最新のデバイスリストを送信
            devices = scanner.get_devices()
            await websocket.send_json([device.dict() for device in devices])
    except WebSocketDisconnect:
        connected_clients.remove(websocket)

async def broadcast_devices():
    """すべての接続クライアントにデバイス情報をブロードキャスト"""
    while True:
        if connected_clients:
            devices = scanner.get_devices()
            devices_json = [device.dict() for device in devices]
            
            # すべてのクライアントに送信
            for client in connected_clients.copy():
                try:
                    await client.send_json(devices_json)
                except:
                    connected_clients.remove(client)
        
        await asyncio.sleep(5)  # 5秒ごとに更新
