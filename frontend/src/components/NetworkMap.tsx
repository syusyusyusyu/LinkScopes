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
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 600, height: 400 });
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

  // コンテナのリサイズを監視
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const { width, height } = containerRef.current.getBoundingClientRect();
        console.log("Container dimensions:", width, "x", height);
        setDimensions({ width, height });
      }
    };

    // 初期サイズの設定
    updateDimensions();

    // リサイズイベントのリスナーを設定
    window.addEventListener('resize', updateDimensions);
    
    return () => {
      window.removeEventListener('resize', updateDimensions);
    };
  }, []);
  
  // D3.jsでネットワークマップを描画
  useEffect(() => {
    if (!svgRef.current || devices.length === 0) return;
    
    try {
      // SVG要素を選択し、内容をクリア
      const svg = d3.select(svgRef.current);
      svg.selectAll("*").remove();
      
      // SVGのサイズを明示的に設定
      svg
        .attr("width", dimensions.width)
        .attr("height", dimensions.height)
        .attr("viewBox", [0, 0, dimensions.width, dimensions.height])
        .style("outline", "1px solid lightgray"); // デバッグ用の境界線
      
      console.log("SVG dimensions set to:", dimensions.width, "x", dimensions.height);
      
      // ノードとリンクのデータを準備
      const nodes: CustomNodeDatum[] = devices.map((device, i) => ({
        id: device.ip,
        device: device,
        r: getNodeRadius(device),
        // 明示的な初期位置を設定
        x: dimensions.width / 2 + 100 * Math.cos(2 * Math.PI * i / devices.length),
        y: dimensions.height / 2 + 100 * Math.sin(2 * Math.PI * i / devices.length)
      }));
      
      // デバイスのIPからノードへのマッピングを作成
      const nodeMap = new Map<string, CustomNodeDatum>();
      nodes.forEach(node => nodeMap.set(node.id, node));
      
      // リンクの作成
      const links: CustomLinkDatum[] = [];
      devices.forEach(device => {
        device.connected_to.forEach(targetIp => {
          if (nodeMap.has(targetIp)) {
            links.push({
              source: device.ip,
              target: targetIp,
            });
          }
        });
      });
      
      // ゲートウェイノードを中心に固定
      const gatewayNode = nodes.find(n => n.device.is_gateway);
      if (gatewayNode) {
        gatewayNode.fx = dimensions.width / 2;
        gatewayNode.fy = dimensions.height / 2;
        console.log("Gateway node fixed at center:", gatewayNode.fx, gatewayNode.fy);
      }
      
      // コンテナを作成
      const container = svg.append("g");
      
      // リンクを描画
      const link = container.append("g")
        .attr("stroke", "#999")
        .attr("stroke-opacity", 0.6)
        .selectAll("line")
        .data(links)
        .join("line")
        .attr("stroke-width", d => {
          const source = typeof d.source === 'string' ? nodeMap.get(d.source) : d.source;
          const target = typeof d.target === 'string' ? nodeMap.get(d.target) : d.target;
          return ((source as CustomNodeDatum).device.is_gateway || (target as CustomNodeDatum).device.is_gateway) ? 3 : 2;
        });
      
      // ノードグループを作成
      const node = container.append("g")
        .selectAll("g")
        .data(nodes)
        .join("g")
        .attr("cursor", "pointer")
        .on("click", (event, d) => {
          event.stopPropagation();
          onNodeClick(d.device);
        });
      
      // ノード円を描画
      node.append("circle")
        .attr("r", d => d.r)
        .attr("fill", d => getNodeColor(d.device))
        .attr("stroke", "#fff")
        .attr("stroke-width", 2);
      
      // ゲートウェイアイコン
      node.filter(d => d.device.is_gateway)
        .append("text")
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "central")
        .attr("fill", "white")
        .attr("font-size", 12)
        .attr("font-weight", "bold")
        .text("G");
      
      // ラベルを追加
      node.append("text")
        .attr("dy", d => d.r + 12)
        .attr("text-anchor", "middle")
        .attr("fill", "#4b5563")
        .attr("font-size", d => d.device.is_gateway ? 14 : 12)
        .attr("font-weight", d => d.device.is_gateway ? "bold" : "normal")
        .text(d => {
          const device = d.device;
          if (device.hostname && device.hostname !== "unknown") {
            return device.hostname.length > 15 
              ? device.hostname.substring(0, 12) + "..."
              : device.hostname;
          } else {
            const ipParts = device.ip.split(".");
            return ipParts[3];
          }
        });
      
      // ツールチップ
      node.append("title")
        .text(d => {
          const device = d.device;
          let tooltip = `IP: ${device.ip}\nMAC: ${device.mac}`;
          if (device.hostname) tooltip += `\nホスト名: ${device.hostname}`;
          if (device.manufacturer) tooltip += `\nメーカー: ${device.manufacturer}`;
          if (device.is_gateway) tooltip += "\n(ゲートウェイ)";
          return tooltip;
        });
      
      // ドラッグ挙動の定義
      const drag = d3.drag<SVGGElement, CustomNodeDatum>()
        .on("start", (event, d) => {
          if (!event.active) simulation.alphaTarget(0.3).restart();
          d.fx = d.x;
          d.fy = d.y;
        })
        .on("drag", (event, d) => {
          d.fx = event.x;
          d.fy = event.y;
        })
        .on("end", (event, d) => {
          if (!event.active) simulation.alphaTarget(0);
          if (!d.device.is_gateway) {
            d.fx = null;
            d.fy = null;
          }
        });
      
      // ドラッグ機能を適用
      (node as d3.Selection<SVGGElement, CustomNodeDatum, SVGGElement, unknown>).call(drag);
      
      // シミュレーションを作成
      const simulation = d3.forceSimulation<CustomNodeDatum>(nodes)
        .force("link", d3.forceLink<CustomNodeDatum, CustomLinkDatum>(links)
          .id(d => d.id)
          .distance(d => {
            // ゲートウェイへのリンクは長めにする
            const source = typeof d.source === 'string' ? nodeMap.get(d.source) : d.source;
            const target = typeof d.target === 'string' ? nodeMap.get(d.target) : d.target;
            return ((source as CustomNodeDatum).device.is_gateway || (target as CustomNodeDatum).device.is_gateway) ? 150 : 100;
          }))
        .force("charge", d3.forceManyBody().strength(-500))
        .force("center", d3.forceCenter(dimensions.width / 2, dimensions.height / 2).strength(0.3))
        .force("collision", d3.forceCollide().radius(d => (d as CustomNodeDatum).r * 1.5));
      
      // シミュレーションを一度予熱
      console.log("Pre-heating simulation...");
      for (let i = 0; i < 50; i++) {
        simulation.tick();
      }
      
      // 境界制約を設定
      simulation.on("tick", () => {
        nodes.forEach(d => {
          if (d.fx === undefined) {
            d.x = Math.max(d.r, Math.min(dimensions.width - d.r, d.x || 0));
            d.y = Math.max(d.r, Math.min(dimensions.height - d.r, d.y || 0));
          }
        });
        
        link
          .attr("x1", d => {
            const source = typeof d.source === 'string' ? nodeMap.get(d.source) : d.source;
            return (source as CustomNodeDatum).x || 0;
          })
          .attr("y1", d => {
            const source = typeof d.source === 'string' ? nodeMap.get(d.source) : d.source;
            return (source as CustomNodeDatum).y || 0;
          })
          .attr("x2", d => {
            const target = typeof d.target === 'string' ? nodeMap.get(d.target) : d.target;
            return (target as CustomNodeDatum).x || 0;
          })
          .attr("y2", d => {
            const target = typeof d.target === 'string' ? nodeMap.get(d.target) : d.target;
            return (target as CustomNodeDatum).y || 0;
          });
        
        node.attr("transform", d => `translate(${d.x},${d.y})`);
      });
      
      // ズーム機能を追加
      const zoom = d3.zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.5, 3])
        .on("zoom", (event) => {
          container.attr("transform", event.transform);
        });
      
      svg.call(zoom);
      
      // SVGをダブルクリックしたときにズームをリセット
      svg.on("dblclick.zoom", () => {
        svg.transition().duration(750).call(
          zoom.transform,
          d3.zoomIdentity
        );
      });
      
      // シミュレーションを適度な温度で開始
      simulation.alpha(0.5).alphaDecay(0.05).restart();
      
      // クリーンアップ
      return () => {
        simulation.stop();
      };
    } catch (err) {
      console.error("Error rendering network map:", err);
      setError(err instanceof Error ? err.message : "ネットワークマップの描画中にエラーが発生しました");
    }
  }, [devices, dimensions, onNodeClick]);
  
  if (error) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-red-50 text-red-500 p-4 rounded-lg">
        <p>{error}</p>
      </div>
    );
  }
  
  return (
    <div ref={containerRef} className="w-full h-full bg-gray-50 rounded-lg overflow-hidden">
      <svg ref={svgRef} className="w-full h-full" />
    </div>
  );
};

export default NetworkMap;