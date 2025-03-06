# backend/app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import asyncio
from .api.routes import router, scanner, broadcast_devices

app = FastAPI(title="LinkScope API")

# CORS設定
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 本番環境では特定のオリジンに制限すべき
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ルーターの登録
app.include_router(router, prefix="/api")

@app.on_event("startup")
async def startup_event():
    """アプリケーション起動時の処理"""
    # デフォルトのIP範囲でスキャン開始
    scanner.start_periodic_scan()
    
    # WebSocketブロードキャストタスクの開始
    asyncio.create_task(broadcast_devices())

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)