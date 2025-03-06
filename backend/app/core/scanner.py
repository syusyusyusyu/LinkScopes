# backend/app/core/scanner.py
import scapy.all as scapy
import socket
import time
import threading
import subprocess
import re
from ..models.device import Device

class NetworkScanner:
    def __init__(self):
        self.devices = {}
        self.lock = threading.Lock()
        self.scanning = False
        self.gateway_ip = self._get_default_gateway()
        
    def _get_default_gateway(self):
        """デフォルトゲートウェイを取得"""
        try:
            # Linuxの場合
            result = subprocess.check_output("ip route | grep default", shell=True).decode()
            gateway = re.search(r'default via (\d+\.\d+\.\d+\.\d+)', result).group(1)
            return gateway
        except:
            try:
                # Windowsの場合
                result = subprocess.check_output("ipconfig", shell=True).decode()
                for line in result.split('\n'):
                    if 'Default Gateway' in line:
                        gateway = re.search(r'(\d+\.\d+\.\d+\.\d+)', line).group(1)
                        return gateway
            except:
                return None
    
    def get_manufacturer(self, mac):
        """MACアドレスからメーカー情報を取得（実際にはより詳細なOUIデータベースを使用）"""
        # 簡易的な実装（実際にはOUIデータベースを使用）
        oui_dict = {
            "00:0c:29": "VMware",
            "00:50:56": "VMware",
            "ac:de:48": "Apple",
            "b8:27:eb": "Raspberry Pi",
            "dc:a6:32": "Raspberry Pi",
            "00:25:90": "Cisco",
            "00:16:3e": "Xen"
        }
        
        if not mac:
            return None
            
        mac_prefix = mac[:8].lower()
        return oui_dict.get(mac_prefix, None)
    
    def scan_network(self, ip_range="192.168.1.0/24"):
        """指定したIP範囲をスキャン"""
        if self.scanning:
            return
            
        self.scanning = True
        
        try:
            # ARPリクエストパケットの作成と送信
            arp_request = scapy.ARP(pdst=ip_range)
            broadcast = scapy.Ether(dst="ff:ff:ff:ff:ff:ff")
            arp_request_broadcast = broadcast/arp_request
            answered_list = scapy.srp(arp_request_broadcast, timeout=3, verbose=False)[0]
            
            with self.lock:
                # 既存の接続情報を保持するための一時マップ
                old_connections = {}
                for ip, device in self.devices.items():
                    old_connections[ip] = device.connected_to
                
                # デバイス情報の更新
                for element in answered_list:
                    ip = element[1].psrc
                    mac = element[1].hwsrc
                    
                    # ホスト名を取得（可能な場合）
                    hostname = None
                    try:
                        hostname = socket.gethostbyaddr(ip)[0]
                    except:
                        pass
                    
                    # メーカー情報の取得
                    manufacturer = self.get_manufacturer(mac)
                    
                    # ゲートウェイかどうかを判定
                    is_gateway = (ip == self.gateway_ip)
                    
                    # 接続情報を保持
                    connected_to = old_connections.get(ip, [])
                    
                    # デバイス情報を更新
                    self.devices[ip] = Device(
                        ip=ip,
                        mac=mac,
                        manufacturer=manufacturer,
                        hostname=hostname,
                        is_gateway=is_gateway,
                        connected_to=connected_to
                    )
                
                # トポロジー推定（簡易版）
                self._estimate_topology()
        finally:
            self.scanning = False
    
    def _estimate_topology(self):
        """ネットワークトポロジーの推定（簡易実装）"""
        # ゲートウェイを識別
        gateway = None
        for ip, device in self.devices.items():
            if device.is_gateway:
                gateway = ip
                break
        
        if not gateway and self.devices:
            # ゲートウェイが見つからない場合は最初のデバイスをゲートウェイとして扱う
            gateway = list(self.devices.keys())[0]
            self.devices[gateway].is_gateway = True
        
        # すべてのデバイスをゲートウェイに接続
        for ip, device in self.devices.items():
            if ip != gateway:
                device.connected_to = [gateway]
    
    def start_periodic_scan(self, ip_range="192.168.1.0/24", interval=10):
        """定期的にネットワークスキャンを実行"""
        def scan_task():
            while True:
                self.scan_network(ip_range)
                time.sleep(interval)
        
        thread = threading.Thread(target=scan_task, daemon=True)
        thread.start()
        
    def get_devices(self):
        """スキャンされたデバイスのリストを返す"""
        with self.lock:
            return list(self.devices.values())