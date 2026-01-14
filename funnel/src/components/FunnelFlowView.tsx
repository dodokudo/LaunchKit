'use client';

import { useMemo, useState } from 'react';
import { Funnel, DeliveryItem, DELIVERY_TYPES } from '@/types/funnel';

interface FunnelFlowViewProps {
  funnel: Funnel;
  onSelectDelivery?: (delivery: DeliveryItem) => void;
}

export function FunnelFlowView({ funnel, onSelectDelivery }: FunnelFlowViewProps) {
  const [hoveredDelivery, setHoveredDelivery] = useState<string | null>(null);

  // 日付配列を生成
  const dates = useMemo(() => {
    const result: string[] = [];
    const start = new Date(funnel.startDate);
    const end = new Date(funnel.endDate);
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      result.push(d.toISOString().split('T')[0]);
    }
    return result;
  }, [funnel.startDate, funnel.endDate]);

  // グリッドサイズ
  const cellWidth = 100;
  const cellHeight = 80;
  const headerHeight = 50;
  const sidebarWidth = 100;
  const nodeRadius = 16;

  // 販売期間内かどうか
  const isInBaseDatePeriod = (dateStr: string) => {
    if (!funnel.baseDate) return false;
    const checkDate = new Date(dateStr);
    const startDate = new Date(funnel.baseDate);
    const endDate = new Date(funnel.baseDate);
    endDate.setDate(endDate.getDate() + (funnel.baseDateDays || 1) - 1);
    return checkDate >= startDate && checkDate <= endDate;
  };

  // 日付フォーマット
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  // 曜日取得
  const getDayOfWeek = (dateStr: string) => {
    const days = ['日', '月', '火', '水', '木', '金', '土'];
    return days[new Date(dateStr).getDay()];
  };

  // 特定のセル（日付×セグメント）の配信を取得
  const getDeliveries = (date: string, segmentId: string): DeliveryItem[] => {
    return funnel.deliveries.filter(d => {
      if (d.date !== date) return false;
      const segmentIds = d.segmentIds || [d.segmentId];
      return segmentIds.includes(segmentId);
    });
  };

  // ノードの位置を計算
  const getNodePosition = (dateIndex: number, segmentIndex: number, nodeIndex: number = 0) => {
    const x = sidebarWidth + dateIndex * cellWidth + cellWidth / 2;
    const y = headerHeight + segmentIndex * cellHeight + cellHeight / 2 + nodeIndex * 28;
    return { x, y };
  };

  // SVGサイズ
  const svgWidth = sidebarWidth + dates.length * cellWidth + 20;
  const svgHeight = headerHeight + funnel.segments.length * cellHeight + 20;

  // 接続線のパスを計算
  const getConnectionPath = (fromDeliveryId: string, toDeliveryId: string) => {
    const fromDelivery = funnel.deliveries.find(d => d.id === fromDeliveryId);
    const toDelivery = funnel.deliveries.find(d => d.id === toDeliveryId);
    if (!fromDelivery || !toDelivery) return null;

    const fromDateIndex = dates.indexOf(fromDelivery.date);
    const toDateIndex = dates.indexOf(toDelivery.date);
    const fromSegmentIds = fromDelivery.segmentIds || [fromDelivery.segmentId];
    const toSegmentIds = toDelivery.segmentIds || [toDelivery.segmentId];

    // 最初のセグメントの位置を使用
    const fromSegmentIndex = funnel.segments.findIndex(s => fromSegmentIds.includes(s.id));
    const toSegmentIndex = funnel.segments.findIndex(s => toSegmentIds.includes(s.id));

    if (fromDateIndex === -1 || toDateIndex === -1 || fromSegmentIndex === -1 || toSegmentIndex === -1) {
      return null;
    }

    const from = getNodePosition(fromDateIndex, fromSegmentIndex);
    const to = getNodePosition(toDateIndex, toSegmentIndex);

    // 矢印の開始・終了位置を調整
    const startX = from.x + nodeRadius;
    const startY = from.y;
    const endX = to.x - nodeRadius - 6;
    const endY = to.y;

    if (Math.abs(startY - endY) < 10) {
      // 横方向
      return `M ${startX} ${startY} L ${endX} ${endY}`;
    } else {
      // 斜め方向（ベジェ曲線）
      const midX = (startX + endX) / 2;
      return `M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${endY}, ${endX} ${endY}`;
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 overflow-auto">
      <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
        <span>🗺️</span>
        <span>全体フロー図</span>
      </h3>

      <div className="overflow-auto">
        <svg width={svgWidth} height={svgHeight} className="min-w-full">
          <defs>
            <marker
              id="flow-arrow"
              markerWidth="8"
              markerHeight="6"
              refX="6"
              refY="3"
              orient="auto"
            >
              <polygon points="0 0, 8 3, 0 6" fill="#3B82F6" />
            </marker>
            <marker
              id="flow-arrow-gray"
              markerWidth="8"
              markerHeight="6"
              refX="6"
              refY="3"
              orient="auto"
            >
              <polygon points="0 0, 8 3, 0 6" fill="#9CA3AF" />
            </marker>
          </defs>

          {/* 背景グリッド */}
          {dates.map((date, dateIndex) => {
            const x = sidebarWidth + dateIndex * cellWidth;
            const isBasePeriod = isInBaseDatePeriod(date);
            return (
              <rect
                key={`bg-${date}`}
                x={x}
                y={headerHeight}
                width={cellWidth}
                height={funnel.segments.length * cellHeight}
                fill={isBasePeriod ? '#FEF2F2' : 'transparent'}
                stroke="#E5E7EB"
                strokeWidth="0.5"
              />
            );
          })}

          {/* セグメント行の背景 */}
          {funnel.segments.map((segment, segmentIndex) => (
            <rect
              key={`row-${segment.id}`}
              x={0}
              y={headerHeight + segmentIndex * cellHeight}
              width={sidebarWidth}
              height={cellHeight}
              fill={segment.color + '20'}
              stroke="#E5E7EB"
              strokeWidth="0.5"
            />
          ))}

          {/* 日付ヘッダー */}
          {dates.map((date, dateIndex) => {
            const x = sidebarWidth + dateIndex * cellWidth;
            const isBasePeriod = isInBaseDatePeriod(date);
            return (
              <g key={`header-${date}`}>
                <rect
                  x={x}
                  y={0}
                  width={cellWidth}
                  height={headerHeight}
                  fill={isBasePeriod ? '#FEE2E2' : '#F9FAFB'}
                  stroke="#E5E7EB"
                  strokeWidth="0.5"
                />
                <text
                  x={x + cellWidth / 2}
                  y={20}
                  textAnchor="middle"
                  className={`text-xs font-bold ${isBasePeriod ? 'fill-red-600' : 'fill-gray-700'}`}
                >
                  {formatDate(date)}
                </text>
                <text
                  x={x + cellWidth / 2}
                  y={36}
                  textAnchor="middle"
                  className={`text-[10px] ${isBasePeriod ? 'fill-red-500' : 'fill-gray-500'}`}
                >
                  ({getDayOfWeek(date)})
                </text>
              </g>
            );
          })}

          {/* セグメントラベル */}
          {funnel.segments.map((segment, segmentIndex) => (
            <g key={`label-${segment.id}`}>
              <circle
                cx={20}
                cy={headerHeight + segmentIndex * cellHeight + cellHeight / 2}
                r={6}
                fill={segment.color}
              />
              <text
                x={32}
                y={headerHeight + segmentIndex * cellHeight + cellHeight / 2 + 4}
                className="text-xs font-medium fill-gray-800"
              >
                {segment.name.length > 6 ? segment.name.slice(0, 6) + '..' : segment.name}
              </text>
            </g>
          ))}

          {/* 接続線（矢印） */}
          {(funnel.connections || []).map(conn => {
            const path = getConnectionPath(conn.fromDeliveryId, conn.toDeliveryId);
            if (!path) return null;
            return (
              <path
                key={conn.id}
                d={path}
                fill="none"
                stroke="#3B82F6"
                strokeWidth="2"
                markerEnd="url(#flow-arrow)"
                className="opacity-70"
              />
            );
          })}

          {/* セグメント間の移行矢印 */}
          {(funnel.transitions || []).map(transition => {
            const fromSegmentIndex = transition.fromSegmentId === 'entry'
              ? -1
              : funnel.segments.findIndex(s => s.id === transition.fromSegmentId);
            const toSegmentIndex = funnel.segments.findIndex(s => s.id === transition.toSegmentId);

            if (toSegmentIndex === -1) return null;

            // セグメント間の縦矢印を描画
            const x = sidebarWidth - 15;
            const fromY = transition.fromSegmentId === 'entry'
              ? headerHeight - 10
              : headerHeight + fromSegmentIndex * cellHeight + cellHeight / 2;
            const toY = headerHeight + toSegmentIndex * cellHeight + cellHeight / 2;

            return (
              <g key={transition.id}>
                <path
                  d={`M ${x} ${fromY} L ${x} ${toY - 10}`}
                  fill="none"
                  stroke="#9CA3AF"
                  strokeWidth="1.5"
                  strokeDasharray="4 2"
                  markerEnd="url(#flow-arrow-gray)"
                />
                <text
                  x={x - 5}
                  y={(fromY + toY) / 2}
                  textAnchor="end"
                  className="text-[9px] fill-gray-500"
                >
                  {transition.condition}
                </text>
              </g>
            );
          })}

          {/* 施策ノード（丸ポツ） */}
          {dates.map((date, dateIndex) =>
            funnel.segments.map((segment, segmentIndex) => {
              const deliveries = getDeliveries(date, segment.id);
              return deliveries.map((delivery, nodeIndex) => {
                const pos = getNodePosition(dateIndex, segmentIndex, nodeIndex);
                const isHovered = hoveredDelivery === delivery.id;
                const typeInfo = DELIVERY_TYPES[delivery.type];

                return (
                  <g
                    key={`node-${delivery.id}-${segment.id}`}
                    className="cursor-pointer"
                    onMouseEnter={() => setHoveredDelivery(delivery.id)}
                    onMouseLeave={() => setHoveredDelivery(null)}
                    onClick={() => onSelectDelivery?.(delivery)}
                  >
                    {/* ノード本体 */}
                    <circle
                      cx={pos.x}
                      cy={pos.y}
                      r={isHovered ? nodeRadius + 2 : nodeRadius}
                      fill={typeInfo.color}
                      stroke="white"
                      strokeWidth="2"
                      className="transition-all duration-150"
                      style={{ filter: isHovered ? 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' : '' }}
                    />
                    {/* アイコン */}
                    <text
                      x={pos.x}
                      y={pos.y + 5}
                      textAnchor="middle"
                      className="text-sm pointer-events-none"
                    >
                      {typeInfo.icon}
                    </text>
                    {/* ホバー時のラベル */}
                    {isHovered && (
                      <g>
                        <rect
                          x={pos.x - 40}
                          y={pos.y - nodeRadius - 28}
                          width={80}
                          height={20}
                          rx={4}
                          fill="rgba(0,0,0,0.8)"
                        />
                        <text
                          x={pos.x}
                          y={pos.y - nodeRadius - 14}
                          textAnchor="middle"
                          className="text-[10px] fill-white font-medium"
                        >
                          {delivery.title.length > 10 ? delivery.title.slice(0, 10) + '..' : delivery.title}
                        </text>
                      </g>
                    )}
                  </g>
                );
              });
            })
          )}
        </svg>
      </div>

      {/* 凡例 */}
      <div className="mt-4 flex flex-wrap gap-4 text-xs text-gray-600">
        {Object.entries(DELIVERY_TYPES).map(([key, value]) => (
          <div key={key} className="flex items-center gap-1">
            <div
              className="w-4 h-4 rounded-full flex items-center justify-center text-[10px]"
              style={{ backgroundColor: value.color }}
            >
              {value.icon}
            </div>
            <span>{value.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
