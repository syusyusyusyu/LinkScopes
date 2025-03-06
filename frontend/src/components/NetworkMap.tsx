// frontend/src/components/NetworkMap.tsx
import React, { useRef, useEffect, useState } from 'react';
import * as d3 from 'd3';
import { Device } from '../types/types';

interface NetworkMapProps {
  devices: Device[];
  onNodeClick: (device: Device) => void;
}

// D3のノードの型定義を拡張
interface CustomNodeDatum extends d3.SimulationNodeDatum {
  id: string;
  device: Device;
  r: number;
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
}

// リンクの型定義
interface CustomLinkDatum extends d3.SimulationLinkDatum<CustomNodeDatum> {
  source: string | CustomNodeDatum;
  target: string | CustomNodeDatum;
}

const NetworkMap: React.FC<NetworkMapProps> = ({ devices, onNodeClick }) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // ノードの半径を調整する関数
  const getNodeRadius = (device: Device): number => {
    if (device.is_gateway) return 25;
    
    // メーカー情報を元にノードサイズを調整
    if (device.manufacturer) {
      const mfr = device.manufacturer.toLowerCase();
      if (mfr.includes('apple')) return 18;
      if (mfr.includes('samsung')) return 18;
      if (mfr.includes('google')) return 18;
      if (mfr.includes('nest')) return 16;
      if (mfr.includes('raspb')) return 16;
    }
    
    return 15;
  };

  // ノードの色を決める関数
  const getNodeColor = (device: Device): string => {
    if (device.is_gateway) return '#9333ea'; // ゲートウェイは紫
    
    // メーカー別の色分け
    if (device.manufacturer) {
      const mfr = device.manufacturer.toLowerCase();
      if (mfr.includes('apple')) return '#0ea5e9'; // Apple は水色
      if (mfr.includes('samsung')) return '#f97316'; // Samsung はオレンジ
      if (mfr.includes('google') || mfr.includes('nest')) return '#fbbf24'; // Google/Nest は黄色
      if (mfr.includes('raspb')) return '#ef4444'; // Raspberry Pi は赤
      if (mfr.includes('tp-link') || mfr.includes('linksys')) return '#84cc16'; // ネットワーク機器は緑
    }
    
    return '#10b981'; // その他は通常の緑
  };
  
  useEffect(() => {
    if (!svgRef.current) return;
    
    try {
      if (devices.length === 0) {
        // Clear the SVG if no devices
        const svg = d3.select(svgRef.current);
        svg.selectAll("*").remove();
        return;
      }
      
      // SVG要素のサイズを正確に取得
      const svg = d3.select(svgRef.current);
      svg.selectAll("*").remove();
      
      // クライアント幅・高さを取得し、0より小さければデフォルト値を使用
      const width = Math.max(svgRef.current.clientWidth, 300);
      const height = Math.max(svgRef.current.clientHeight, 300);
      
      console.log("SVG dimensions:", width, "x", height);
      
      // ノードとリンクのデータを準備
      const nodes: CustomNodeDatum[] = devices.map(device => ({
        id: device.ip,
        device: device,
        r: getNodeRadius(device),
        // 初期位置をランダムに設定して中央付近に分散させる
        x: width * 0.25 + Math.random() * width * 0.5,
        y: height * 0.25 + Math.random() * height * 0.5
      }));
      
      // Make sure all connected_to IPs exist in our devices list
      const deviceIpSet = new Set(devices.map(d => d.ip));
      const links: CustomLinkDatum[] = [];
      
      devices.forEach(device => {
        device.connected_to.forEach(targetIp => {
          // Only add links to IPs that exist in our device list
          if (deviceIpSet.has(targetIp)) {
            links.push({
              source: device.ip,
              target: targetIp,
            });
          }
        });
      });
      
      // ゲートウェイノードを見つける
      const gatewayNode = nodes.find(n => n.device.is_gateway);
      
      // ゲートウェイノードがあれば、中央に固定
      if (gatewayNode) {
        gatewayNode.fx = width / 2;
        gatewayNode.fy = height / 2;
      }
      
      // シミュレーションを作成
      const simulation = d3.forceSimulation<CustomNodeDatum>(nodes)
        // 反発力を強めに設定（小さな負の値で強い反発）
        .force('charge', d3.forceManyBody().strength(-400))
        // 中心力をより強く設定
        .force('center', d3.forceCenter(width / 2, height / 2).strength(0.15))
        // リンクの距離を適度に設定
        .force('link', d3.forceLink<CustomNodeDatum, CustomLinkDatum>(links)
          .id(d => d.id)
          .distance(d => {
            // ゲートウェイへのリンクは長めにする
            const source = d.source as CustomNodeDatum;
            const target = d.target as CustomNodeDatum;
            if (source.device.is_gateway || target.device.is_gateway) {
              return 150;
            }
            return 100;
          }))
        // 衝突回避を強めに設定
        .force('collide', d3.forceCollide().radius(d => (d as CustomNodeDatum).r * 2));
      
      // 最初にいくつかのtickを実行して配置を安定させる
      for (let i = 0; i < 30; i++) {
        simulation.tick();
      }
      
      // リンクを描画
      const link = svg.append('g')
        .selectAll<SVGLineElement, CustomLinkDatum>('line')
        .data(links)
        .enter()
        .append('line')
        .attr('stroke', '#999')
        .attr('stroke-opacity', 0.6)
        .attr('stroke-width', d => {
          // ゲートウェイへの接続は太く表示
          const source = d.source as CustomNodeDatum;
          const target = d.target as CustomNodeDatum;
          return (source.device.is_gateway || target.device.is_gateway) ? 3 : 2;
        });
      
      // ノードグループを作成
      const node = svg.append('g')
        .selectAll<SVGGElement, CustomNodeDatum>('.node')
        .data(nodes)
        .enter()
        .append('g')
        .attr('class', 'node')
        .on('click', (event, d) => {
          event.stopPropagation();
          onNodeClick(d.device);
        })
        .call(d3.drag<SVGGElement, CustomNodeDatum>()
          .on('start', dragstarted)
          .on('drag', dragged)
          .on('end', dragended));
      
      // ノード円を描画
      node.append('circle')
        .attr('r', d => d.r)
        .attr('fill', d => getNodeColor(d.device))
        .attr('stroke', '#fff')
        .attr('stroke-width', 2)
        .attr('opacity', 0.9);
      
      // ゲートウェイアイコンを追加（オプション）
      node.filter(d => d.device.is_gateway)
        .append('text')
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'central')
        .attr('fill', 'white')
        .attr('font-size', 12)
        .attr('font-weight', 'bold')
        .text('G');
      
      // ラベルを追加
      node.append('text')
        .attr('dy', d => d.r + 12)
        .attr('text-anchor', 'middle')
        .attr('fill', '#4b5563')
        .attr('font-size', d => d.device.is_gateway ? 14 : 12)
        .attr('font-weight', d => d.device.is_gateway ? 'bold' : 'normal')
        .text(d => {
          const device = d.device;
          if (device.hostname && device.hostname !== 'unknown') {
            // ホスト名が長すぎる場合は短縮
            return device.hostname.length > 15 
              ? device.hostname.substring(0, 12) + '...'
              : device.hostname;
          } else {
            // IPのみ表示する場合は最後のオクテットだけ
            const ipParts = device.ip.split('.');
            return ipParts[3];
          }
        });
      
      // マウスオーバー時のツールチップ
      node.append('title')
        .text(d => {
          const device = d.device;
          let tooltip = `IP: ${device.ip}\nMAC: ${device.mac}`;
          
          if (device.hostname) {
            tooltip += `\nホスト名: ${device.hostname}`;
          }
          
          if (device.manufacturer) {
            tooltip += `\nメーカー: ${device.manufacturer}`;
          }
          
          if (device.is_gateway) {
            tooltip += '\n(ゲートウェイ)';
          }
          
          return tooltip;
        });
      
      // シミュレーションの更新時の処理
      simulation.on('tick', () => {
        link
          .attr('x1', d => {
            const src = d.source as CustomNodeDatum;
            return src.x || 0;
          })
          .attr('y1', d => {
            const src = d.source as CustomNodeDatum;
            return src.y || 0;
          })
          .attr('x2', d => {
            const tgt = d.target as CustomNodeDatum;
            return tgt.x || 0;
          })
          .attr('y2', d => {
            const tgt = d.target as CustomNodeDatum;
            return tgt.y || 0;
          });
        
        node.attr('transform', d => `translate(${d.x || 0},${d.y || 0})`);
      });
      
      // 境界制約を追加（ノードが画面外に出ないようにする）
      simulation.on('tick', () => {
        nodes.forEach(node => {
          // 境界チェックをより緩やかに設定
          // 半径分だけ内側ではなく、少しはみ出ても良いようにする
          const margin = node.r * 0.5;
          node.x = Math.max(margin, Math.min(width - margin, node.x || 0));
          node.y = Math.max(margin, Math.min(height - margin, node.y || 0));
        });
      });
      
      // シミュレーションの活性度を設定（より長く動かす）
      simulation.alpha(1).alphaDecay(0.01);
      
      // ドラッグ関連の関数
      function dragstarted(event: d3.D3DragEvent<SVGGElement, CustomNodeDatum, CustomNodeDatum>, d: CustomNodeDatum) {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      }
      
      function dragged(event: d3.D3DragEvent<SVGGElement, CustomNodeDatum, CustomNodeDatum>, d: CustomNodeDatum) {
        d.fx = event.x;
        d.fy = event.y;
      }
      
      function dragended(event: d3.D3DragEvent<SVGGElement, CustomNodeDatum, CustomNodeDatum>, d: CustomNodeDatum) {
        if (!event.active) simulation.alphaTarget(0);
        
        // ゲートウェイ以外はドラッグ終了時に固定を解除
        if (!d.device.is_gateway) {
          d.fx = null;
          d.fy = null;
        }
      }
      
      // ズーム機能を追加
      const zoom = d3.zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.5, 3])
        .on('zoom', (event) => {
          svg.selectAll('g').attr('transform', event.transform);
        });
      
      svg.call(zoom);
      
      // SVGをクリックした時にズームをリセット
      svg.on('dblclick.zoom', () => {
        svg.transition().duration(750).call(
          zoom.transform,
          d3.zoomIdentity
        );
      });
      
      // Clean up simulation on unmount
      return () => {
        simulation.stop();
      };
    } catch (err) {
      console.error('Error rendering network map:', err);
      setError(err instanceof Error ? err.message : 'ネットワークマップの描画中にエラーが発生しました');
    }
  }, [devices, onNodeClick]);
  
  if (error) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-red-50 text-red-500 p-4 rounded-lg">
        <p>{error}</p>
      </div>
    );
  }
  
  return (
    <div className="w-full h-full bg-gray-50 rounded-lg overflow-hidden">
      <svg ref={svgRef} width="100%" height="100%" />
    </div>
  );
};

export default NetworkMap;