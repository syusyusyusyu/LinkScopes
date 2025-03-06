# backend/app/core/scanner_factory.py
import platform
import logging

logger = logging.getLogger(__name__)

def is_wsl():
    """WSL環境かどうかを検出"""
    try:
        with open('/proc/version', 'r') as f:
            return 'microsoft' in f.read().lower()
    except:
        return False

def create_network_scanner():
    """環境に適したネットワークスキャナーを作成"""
    # 強化版スキャナーを使用
    try:
        from .enhanced_scanner import EnhancedNetworkScanner
        logger.info("強化版ネットワークスキャナーを使用します")
        return EnhancedNetworkScanner()
    except Exception as e:
        logger.error(f"強化版スキャナーの初期化に失敗: {e}")
        logger.info("代替として標準スキャナーを使用します")
        from .scanner import NetworkScanner
        return NetworkScanner()