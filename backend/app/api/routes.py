# backend/app/api/routes.py
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from fastapi.responses import JSONResponse
from ..core.scanner import NetworkScanner
import asyncio
import json
import logging

# ロガーの設定
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter()
scanner = NetworkScanner()

# 接続されているWebSocketクライアントを管理
connected_clients = set()

@router.get("/devices")
async def get_devices():
    """スキャンされたデバイスのリストを取得"""
    devices = scanner.get_devices()
    return [device.dict() for device in devices]

@router.post("/scan")
async def scan_network(ip_range: str = Query("192.168.1.0/24")):
    """ネットワークスキャンを手動で実行"""
    try:
        scanner.scan_network(ip_range)
        return {"status": "scan_completed", "ip_range": ip_range}
    except Exception as e:
        logger.error(f"Scan error: {e}")
        return JSONResponse(
            status_code=500, 
            content={"status": "error", "message": str(e)}
        )

@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocketエンドポイント - リアルタイム更新用"""
    await websocket.accept()
    logger.info("WebSocket client connected")
    connected_clients.add(websocket)
    
    try:
        # 接続時に最初のデータを送信
        devices = scanner.get_devices()
        await websocket.send_json([device.dict() for device in devices])
        
        # クライアントからのメッセージを待機
        while True:
            try:
                message = await websocket.receive_text()
                logger.info(f"WebSocket message received: {message}")
                
                # メッセージに応じて処理
                if message == "get_devices":
                    devices = scanner.get_devices()
                    await websocket.send_json([device.dict() for device in devices])
            except WebSocketDisconnect:
                logger.info("WebSocket disconnected normally")
                break
            except Exception as e:
                logger.error(f"WebSocket error: {e}")
                break
    except Exception as e:
        logger.error(f"WebSocket unhandled exception: {e}")
    finally:
        # 常に接続リストから削除
        if websocket in connected_clients:
            connected_clients.remove(websocket)
        logger.info("WebSocket client removed from connected clients")

async def broadcast_devices():
    """すべての接続クライアントにデバイス情報をブロードキャスト"""
    while True:
        try:
            await asyncio.sleep(5)  # 最初に待機して、初期化完了を確認
            
            if not connected_clients:
                continue
                
            devices = scanner.get_devices()
            devices_json = [device.dict() for device in devices]
            
            # すべてのクライアントに送信
            disconnected_clients = []
            for client in connected_clients:
                try:
                    await client.send_json(devices_json)
                except Exception as e:
                    logger.error(f"Error broadcasting to client: {e}")
                    disconnected_clients.append(client)
            
            # 切断されたクライアントを削除
            for client in disconnected_clients:
                if client in connected_clients:
                    connected_clients.remove(client)
        except Exception as e:
            logger.error(f"Broadcast error: {e}")
            await asyncio.sleep(5)  # エラーが続く場合も少し待機