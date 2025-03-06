# backend/app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import asyncio
import logging
from .api.routes import router, scanner, broadcast_devices

# ロギングの設定
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = FastAPI(title="LinkScope API")

# 開発環境のCORS設定
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 開発環境では全てのオリジンを許可
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ルーターの登録
app.include_router(router, prefix="/api")

# ブロードキャストタスクの参照を保持
broadcast_task = None

@app.on_event("startup")
async def startup_event():
    """アプリケーション起動時の処理"""
    logger.info("Starting application...")
    
    try:
        # デフォルトのIP範囲でスキャン開始
        scanner.start_periodic_scan()
        logger.info("Network scanner started successfully")
        
        # ブロードキャストタスクを開始し、グローバル変数に保存
        global broadcast_task
        broadcast_task = asyncio.create_task(broadcast_devices())
        logger.info("WebSocket broadcast task started")
    except Exception as e:
        logger.error(f"Error during startup: {e}")
        # エラーが発生しても起動は続行

@app.on_event("shutdown")
async def shutdown_event():
    """アプリケーション終了時の処理"""
    logger.info("Application shutting down...")
    
    # ブロードキャストタスクをキャンセル
    global broadcast_task
    if broadcast_task:
        broadcast_task.cancel()
        try:
            await broadcast_task
        except asyncio.CancelledError:
            logger.info("Broadcast task cancelled successfully")
        except Exception as e:
            logger.error(f"Error cancelling broadcast task: {e}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)