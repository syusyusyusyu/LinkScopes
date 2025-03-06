// frontend/src/utils/networkDetector.ts
/**
 * ネットワーク設定を自動検出する機能
 */

/**
 * 現在のネットワークに適したIPレンジを推測する
 * @returns 推測されたIPレンジ
 */
export const detectNetworkRange = async (): Promise<string> => {
    try {
      // ローカルIPを取得
      const localIp = await getLocalIpAddress();
      if (!localIp) return "192.168.1.0/24"; // デフォルト値
  
      // IPのセグメントからレンジを推測
      const segments = localIp.split('.');
      if (segments.length !== 4) return "192.168.1.0/24";
  
      if (segments[0] === '192' && segments[1] === '168') {
        return `192.168.${segments[2]}.0/24`;
      } else if (segments[0] === '10') {
        return `10.${segments[1]}.${segments[2]}.0/24`;
      } else if (segments[0] === '172' && parseInt(segments[1]) >= 16 && parseInt(segments[1]) <= 31) {
        return `172.${segments[1]}.0.0/16`;
      }
  
      // デフォルト値
      return "192.168.1.0/24";
    } catch (error) {
      console.error('Network range detection failed:', error);
      return "192.168.1.0/24";
    }
  };
  
  /**
   * WebRTCを使用してローカルIPアドレスを取得
   * @returns ローカルIPアドレス
   */
  const getLocalIpAddress = (): Promise<string | null> => {
    return new Promise((resolve) => {
      try {
        // RTCPeerConnectionを作成
        const pc = new RTCPeerConnection({
          iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
        });
  
        // 30秒後にタイムアウト
        const timeoutId = setTimeout(() => {
          pc.close();
          resolve(null);
        }, 30000);
  
        // データチャネルを作成（必要）
        pc.createDataChannel('');
  
        // ICE candidateイベントをリッスン
        pc.onicecandidate = (event) => {
          if (!event.candidate) return;
  
          // IPアドレスを抽出
          const ipRegex = /([0-9]{1,3}(\.[0-9]{1,3}){3})/;
          const matches = ipRegex.exec(event.candidate.candidate);
  
          if (matches && matches.length > 1) {
            const ip = matches[1];
            
            // プライベートIPかどうか確認
            if (isPrivateIP(ip)) {
              clearTimeout(timeoutId);
              pc.close();
              resolve(ip);
            }
          }
        };
  
        // 接続プロセスを開始
        pc.createOffer()
          .then(offer => pc.setLocalDescription(offer))
          .catch(() => {
            clearTimeout(timeoutId);
            pc.close();
            resolve(null);
          });
  
      } catch (e) {
        console.error('IP detection error:', e);
        resolve(null);
      }
    });
  };
  
  /**
   * プライベートIPアドレスかどうかを確認
   * @param ip IPアドレス
   * @returns プライベートIPならtrue
   */
  const isPrivateIP = (ip: string): boolean => {
    const segments = ip.split('.');
    if (segments.length !== 4) return false;
  
    // プライベートIPの範囲をチェック
    if (segments[0] === '10') return true;
    if (segments[0] === '172' && parseInt(segments[1]) >= 16 && parseInt(segments[1]) <= 31) return true;
    if (segments[0] === '192' && segments[1] === '168') return true;
    
    return false;
  };