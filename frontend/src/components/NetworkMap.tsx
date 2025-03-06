// frontend/src/components/NetworkMap.tsx
import React, { useRef, useEffect } from 'react';
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
  
  useEffect(() => {
    if (!svgRef.current || devices.length === 0) return;
    
    // D3グラフを作成
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    
    const width = svgRef.current.clientWidth;
    const height = svgRef.current.clientHeight;
    
    // ノードとリンクのデータを準備
    const nodes: CustomNodeDatum[] = devices.map(device => ({
      id: device.ip,
      device: device,
      r: device.is_gateway ? 25 : 15,
    }));
    
    const links: CustomLinkDatum[] = [];
    devices.forEach(device => {
      device.connected_to.forEach(targetIp => {
        links.push({
          source: device.ip,
          target: targetIp,
        });
      });
    });
    
    // シミュレーションを作成
    const simulation = d3.forceSimulation<CustomNodeDatum>(nodes)
      .force('charge', d3.forceManyBody().strength(-300))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('link', d3.forceLink<CustomNodeDatum, CustomLinkDatum>(links).id(d => d.id).distance(100))
      .force('collide', d3.forceCollide().radius(d => (d as CustomNodeDatum).r * 1.5));
    
    // リンクを描画
    const link = svg.append('g')
      .selectAll<SVGLineElement, CustomLinkDatum>('line')
      .data(links)
      .enter()
      .append('line')
      .attr('stroke', '#999')
      .attr('stroke-opacity', 0.6)
      .attr('stroke-width', 2);
    
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
      .attr('fill', d => {
        const device = d.device;
        if (device.is_gateway) return '#9333ea'; // ゲートウェイ
        return '#10b981'; // 通常デバイス
      })
      .attr('stroke', '#fff')
      .attr('stroke-width', 2);
    
    // ラベルを追加
    node.append('text')
      .attr('dy', d => d.r + 10)
      .attr('text-anchor', 'middle')
      .attr('fill', '#4b5563')
      .attr('font-size', 12)
      .text(d => {
        const device = d.device;
        return device.hostname || device.ip;
      });
    
    // マウスオーバー時のツールチップ
    node.append('title')
      .text(d => {
        const device = d.device;
        return `IP: ${device.ip}\nMAC: ${device.mac}\n${device.manufacturer ? `メーカー: ${device.manufacturer}` : ''}`;
      });
    
    // シミュレーションの更新時の処理
    simulation.on('tick', () => {
      link
        .attr('x1', d => (d.source as CustomNodeDatum).x || 0)
        .attr('y1', d => (d.source as CustomNodeDatum).y || 0)
        .attr('x2', d => (d.target as CustomNodeDatum).x || 0)
        .attr('y2', d => (d.target as CustomNodeDatum).y || 0);
      
      node.attr('transform', d => `translate(${d.x || 0},${d.y || 0})`);
    });
    
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
      d.fx = null;
      d.fy = null;
    }
    
    return () => {
      simulation.stop();
    };
  }, [devices, onNodeClick]);
  
  return (
    <div className="w-full h-full bg-gray-50 rounded-lg overflow-hidden">
      <svg ref={svgRef} width="100%" height="100%" />
    </div>
  );
};

export default NetworkMap;