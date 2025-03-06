# backend/app/core/enhanced_scanner.py
import subprocess
import socket
import time
import threading
import re
import logging
import concurrent.futures
import platform
from ..models.device import Device

logger = logging.getLogger(__name__)

class EnhancedNetworkScanner:
    def __init__(self):
        self.devices = {}
        self.lock = threading.Lock()
        self.scanning = False
        self.gateway_ip = self._get_default_gateway()
        self.is_wsl = self._check_if_wsl()
        
    def _check_if_wsl(self):
        """WSL環境かどうかをチェック"""
        try:
            with open('/proc/version', 'r') as f:
                return 'microsoft' in f.read().lower()
        except:
            return False
    
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
            except Exception as e:
                logger.error(f"デフォルトゲートウェイの取得に失敗: {e}")
            return None
    
    def get_manufacturer(self, mac):
        """MACアドレスからメーカー情報を取得"""
        if not mac:
            return None
            
        # 一般的なメーカーのOUIプレフィックス
        oui_dict = {
            "00:0c:29": "VMware",
            "00:50:56": "VMware",
            "ac:de:48": "Apple",
            "b8:27:eb": "Raspberry Pi",
            "dc:a6:32": "Raspberry Pi",
            "00:25:90": "Cisco",
            "00:16:3e": "Xen",
            "f8:1a:67": "TP-Link",
            "00:11:32": "Synology",
            "74:da:38": "Edimax",
            "00:21:29": "Cisco-Linksys",
            "f0:9f:c2": "Ubiquiti",
            "3c:7c:3f": "Huawei",
            "2c:54:cf": "LG Electronics",
            "40:b0:76": "ASUSTek",
            "00:e0:4c": "REALTEK",
            "94:10:3e": "Belkin",
            "18:b4:30": "Nest",
            "fc:fc:48": "Apple",
            "a8:8e:24": "Apple",
            "70:4d:7b": "Apple",
            "58:40:4e": "Apple",
            "ac:bc:32": "Apple",
            "fe:c4:e5": "Samsung",
            "18:67:b0": "Samsung"
        }
        
        mac_prefix = mac[:8].lower()
        return oui_dict.get(mac_prefix, None)
    
    def _parse_ip_range(self, ip_range):
        """IPレンジをパース"""
        if '/' in ip_range:
            base_ip, cidr = ip_range.split('/')
            ip_parts = base_ip.split('.')
            
            # サブネットマスクの計算は簡易化
            base_network = '.'.join(ip_parts[:3])
            return base_network, int(cidr)
        else:
            # 単一IPまたは形式が異なる場合
            ip_parts = ip_range.split('.')
            base_network = '.'.join(ip_parts[:3])
            return base_network, 24  # デフォルトは/24
    
    def _ping_scan(self, base_network):
        """pingを使った簡易スキャン"""
        active_ips = []
        
        # 複数のIPを並列でスキャン
        with concurrent.futures.ThreadPoolExecutor(max_workers=50) as executor:
            future_to_ip = {}
            
            for i in range(1, 255):
                ip = f"{base_network}.{i}"
                future = executor.submit(self._ping_single_host, ip)
                future_to_ip[future] = ip
            
            for future in concurrent.futures.as_completed(future_to_ip):
                ip = future_to_ip[future]
                try:
                    if future.result():
                        active_ips.append(ip)
                except Exception as e:
                    logger.error(f"Error pinging {ip}: {e}")
        
        return active_ips
    
    def _ping_single_host(self, ip):
        """単一ホストにpingを送信"""
        # OSに応じてコマンドを調整
        if platform.system() == "Windows":
            ping_cmd = ["ping", "-n", "1", "-w", "500", ip]
        else:  # Linux/Unix/WSL
            ping_cmd = ["ping", "-c", "1", "-W", "1", ip]
        
        try:
            result = subprocess.run(ping_cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            return result.returncode == 0
        except:
            return False
    
    def _port_scan(self, ip, ports=[80, 443, 22, 8080, 5000]):
        """基本的なポートスキャン"""
        open_ports = []
        for port in ports:
            try:
                sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                sock.settimeout(0.1)
                result = sock.connect_ex((ip, port))
                if result == 0:
                    open_ports.append(port)
                sock.close()
            except:
                pass
        return len(open_ports) > 0, open_ports
    
    def _get_mac_address(self, ip):
        """ARPテーブルからMACアドレスを取得"""
        try:
            if platform.system() == "Windows":
                arp_output = subprocess.check_output(f"arp -a {ip}", shell=True).decode()
            else:
                arp_output = subprocess.check_output(f"arp -n {ip}", shell=True).decode()
            
            # MACアドレスを抽出
            mac_pattern = r'([0-9A-Fa-f]{2}[:-][0-9A-Fa-f]{2}[:-][0-9A-Fa-f]{2}[:-][0-9A-Fa-f]{2}[:-][0-9A-Fa-f]{2}[:-][0-9A-Fa-f]{2})'
            match = re.search(mac_pattern, arp_output, re.IGNORECASE)
            if match:
                return match.group(1).lower()
        except Exception as e:
            logger.debug(f"MACアドレス取得エラー ({ip}): {e}")
        
        return "00:00:00:00:00:00"
    
    def _get_hostname(self, ip):
        """IPアドレスからホスト名を解決"""
        try:
            hostname = socket.gethostbyaddr(ip)[0]
            return hostname
        except:
            return None
    
    def scan_network(self, ip_range="192.168.1.0/24"):
        """指定したIP範囲をスキャン (強化版)"""
        if self.scanning:
            return
            
        self.scanning = True
        logger.info(f"ネットワークスキャン開始: {ip_range}")
        
        try:
            # IPレンジを解析
            base_network, cidr = self._parse_ip_range(ip_range)
            logger.info(f"スキャン範囲: {base_network}.0/{cidr}")
            
            # 既存デバイスの接続情報を保持
            with self.lock:
                old_connections = {}
                for ip, device in self.devices.items():
                    old_connections[ip] = device.connected_to
            
            # 検出方法1: pingスキャン
            live_ips = self._ping_scan(base_network)
            logger.info(f"Pingスキャンで {len(live_ips)} 台のデバイスを検出")
            
            # 検出方法2: 追加のポートスキャン
            additional_devices = []
            common_iot_ports = [80, 443, 8080, 5000, 1883, 8883, 23, 22, 5353, 1900]
            
            # 特定のIPをさらにスキャン (pingに応答しない可能性があるデバイス)
            additional_ranges = []
            
            # スマートホームデバイスによく使われるIPの末尾
            if cidr <= 24:  # /24以下のネットワークに対してのみ実行
                special_suffixes = [100, 101, 102, 200, 201, 1, 2, 3, 4, 10, 20, 30, 50]
                for suffix in special_suffixes:
                    ip = f"{base_network}.{suffix}"
                    if ip not in live_ips:
                        additional_ranges.append(ip)
            
            # 追加のIPをスキャン
            with concurrent.futures.ThreadPoolExecutor(max_workers=20) as executor:
                future_to_ip = {}
                for ip in additional_ranges:
                    future = executor.submit(self._port_scan, ip, common_iot_ports)
                    future_to_ip[future] = ip
                
                for future in concurrent.futures.as_completed(future_to_ip):
                    ip = future_to_ip[future]
                    try:
                        is_active, open_ports = future.result()
                        if is_active and ip not in live_ips:
                            additional_devices.append(ip)
                            logger.info(f"ポートスキャンで追加デバイスを検出: {ip} (ポート: {open_ports})")
                    except Exception as e:
                        logger.error(f"Error port scanning {ip}: {e}")
            
            # すべての活性IPをマージ
            all_active_ips = list(set(live_ips + additional_devices))
            
            # デバイス情報を収集
            new_devices = {}
            for ip in all_active_ips:
                # MACアドレスを取得（ARPテーブルから）
                # まずpingを送信してARPキャッシュを更新
                try:
                    subprocess.run(
                        ["ping", "-c" if platform.system() != "Windows" else "-n", "1", ip], 
                        stdout=subprocess.DEVNULL, 
                        stderr=subprocess.DEVNULL,
                        timeout=1
                    )
                except:
                    pass
                
                mac = self._get_mac_address(ip)
                hostname = self._get_hostname(ip)
                manufacturer = self.get_manufacturer(mac)
                is_gateway = (ip == self.gateway_ip)
                
                # 接続情報を保持または初期化
                connected_to = old_connections.get(ip, [])
                
                # デバイス情報を追加
                new_devices[ip] = Device(
                    ip=ip,
                    mac=mac,
                    manufacturer=manufacturer,
                    hostname=hostname,
                    is_gateway=is_gateway,
                    connected_to=connected_to
                )
            
            # WSL環境での特別処理
            if self.is_wsl and self.gateway_ip:
                logger.info("WSL環境を検出: ホストとゲートウェイの追加スキャンを実行")
                
                # ゲートウェイ情報を確保
                if self.gateway_ip not in new_devices:
                    mac = self._get_mac_address(self.gateway_ip) or "00:00:00:00:00:00"
                    new_devices[self.gateway_ip] = Device(
                        ip=self.gateway_ip,
                        mac=mac,
                        manufacturer=self.get_manufacturer(mac),
                        hostname="Gateway",
                        is_gateway=True,
                        connected_to=[]
                    )
                
                # Windowsホスト情報を追加（WSL統合ホスト）
                # 通常はルーターのDHCPレンジの最初のほうにある
                host_candidates = []
                gw_parts = self.gateway_ip.split('.')
                base = f"{gw_parts[0]}.{gw_parts[1]}.{gw_parts[2]}"
                
                # よくあるホストIPをチェック
                for i in range(1, 20):
                    if i == int(gw_parts[3]):  # ゲートウェイ自身はスキップ
                        continue
                        
                    host_ip = f"{base}.{i}"
                    if host_ip not in new_devices:
                        host_candidates.append(host_ip)
                
                # 候補をスキャン
                for ip in host_candidates:
                    is_active, _ = self._port_scan(ip)
                    if is_active:
                        mac = self._get_mac_address(ip) or "00:00:00:00:00:00"
                        new_devices[ip] = Device(
                            ip=ip,
                            mac=mac,
                            manufacturer=self.get_manufacturer(mac),
                            hostname="Windows Host",
                            is_gateway=False,
                            connected_to=[self.gateway_ip]
                        )
            
            # デバイスリストを更新
            with self.lock:
                self.devices = new_devices
                
                # トポロジー推定
                self._estimate_topology()
            
            logger.info(f"スキャン完了: {len(self.devices)} 台のデバイスを検出")
        except Exception as e:
            logger.error(f"スキャン実行中にエラー発生: {e}")
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
            if ip != gateway and not device.connected_to:
                device.connected_to = [gateway]
    
    def start_periodic_scan(self, ip_range="192.168.1.0/24", interval=10):
        """定期的にネットワークスキャンを実行"""
        def scan_task():
            while True:
                self.scan_network(ip_range)
                time.sleep(interval)
        
        thread = threading.Thread(target=scan_task, daemon=True)
        thread.start()
        logger.info(f"定期スキャンを開始しました (間隔: {interval}秒)")
        
    def get_devices(self):
        """スキャンされたデバイスのリストを返す"""
        with self.lock:
            return list(self.devices.values())