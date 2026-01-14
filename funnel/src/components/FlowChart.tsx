'use client';

import { useState, useMemo } from 'react';
import { Segment, SegmentTransition } from '@/types/funnel';

interface FlowChartProps {
  segments: Segment[];
  transitions: SegmentTransition[];
  onUpdateTransitions: (transitions: SegmentTransition[]) => void;
}

interface NodePosition {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export function FlowChart({ segments, transitions, onUpdateTransitions }: FlowChartProps) {
  const [selectedTransition, setSelectedTransition] = useState<string | null>(null);
  const [isAddingTransition, setIsAddingTransition] = useState(false);
  const [addingFrom, setAddingFrom] = useState<string | null>(null);
  const [editingTransition, setEditingTransition] = useState<SegmentTransition | null>(null);

  // ノードの位置を計算
  const nodePositions = useMemo(() => {
    const positions: NodePosition[] = [];
    const nodeWidth = 120;
    const nodeHeight = 40;
    const startX = 20;
    const startY = 60;
    const gapY = 80;

    // 流入元ノード
    positions.push({
      id: 'entry',
      x: startX,
      y: startY,
      width: nodeWidth,
      height: nodeHeight,
    });

    // セグメントノード
    segments.forEach((segment, index) => {
      positions.push({
        id: segment.id,
        x: startX,
        y: startY + (index + 1) * gapY,
        width: nodeWidth,
        height: nodeHeight,
      });
    });

    return positions;
  }, [segments]);

  // ノードの位置を取得
  const getNodePosition = (id: string): NodePosition | undefined => {
    return nodePositions.find(p => p.id === id);
  };

  // 矢印のパスを計算
  const getArrowPath = (from: NodePosition, to: NodePosition) => {
    const startX = from.x + from.width;
    const startY = from.y + from.height / 2;
    const endX = to.x;
    const endY = to.y + to.height / 2;

    // 右に出て、下に曲がって、左に入る
    const midX = startX + 30;

    if (Math.abs(startY - endY) < 10) {
      // 同じ高さ: 直線
      return `M ${startX} ${startY} L ${endX} ${endY}`;
    }

    // 曲線で接続
    return `M ${startX} ${startY}
            C ${midX} ${startY}, ${midX} ${endY}, ${endX} ${endY}`;
  };

  // ノードクリック
  const handleNodeClick = (nodeId: string) => {
    if (isAddingTransition) {
      if (addingFrom === null) {
        setAddingFrom(nodeId);
      } else if (addingFrom !== nodeId) {
        // 移行を追加
        setEditingTransition({
          id: `transition-${Date.now()}`,
          fromSegmentId: addingFrom,
          toSegmentId: nodeId,
          condition: '',
        });
        setAddingFrom(null);
        setIsAddingTransition(false);
      }
    }
  };

  // 移行を保存
  const handleSaveTransition = () => {
    if (!editingTransition || !editingTransition.condition.trim()) return;

    const existing = transitions.find(t => t.id === editingTransition.id);
    if (existing) {
      onUpdateTransitions(transitions.map(t => t.id === editingTransition.id ? editingTransition : t));
    } else {
      onUpdateTransitions([...transitions, editingTransition]);
    }
    setEditingTransition(null);
  };

  // 移行を削除
  const handleDeleteTransition = (id: string) => {
    onUpdateTransitions(transitions.filter(t => t.id !== id));
    setSelectedTransition(null);
  };

  // 移行をクリック
  const handleTransitionClick = (transition: SegmentTransition) => {
    setEditingTransition(transition);
  };

  // SVGの高さを計算
  const svgHeight = (segments.length + 1) * 80 + 40;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-gray-800 flex items-center gap-2">
          <span>🔀</span>
          <span>フロー</span>
        </h3>
        <button
          onClick={() => {
            setIsAddingTransition(!isAddingTransition);
            setAddingFrom(null);
          }}
          className={`text-xs px-2 py-1 rounded transition ${
            isAddingTransition
              ? 'bg-blue-100 text-blue-700'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          {isAddingTransition ? '✕ キャンセル' : '+ 移行を追加'}
        </button>
      </div>

      {isAddingTransition && (
        <div className="mb-3 p-2 bg-blue-50 rounded text-xs text-blue-800">
          {addingFrom
            ? `「${addingFrom === 'entry' ? '流入' : segments.find(s => s.id === addingFrom)?.name}」から移行先をクリック`
            : '移行元のノードをクリックしてください'}
        </div>
      )}

      <svg width="100%" height={svgHeight} className="overflow-visible">
        <defs>
          <marker
            id="flow-arrowhead"
            markerWidth="8"
            markerHeight="6"
            refX="7"
            refY="3"
            orient="auto"
          >
            <polygon points="0 0, 8 3, 0 6" fill="#6B7280" />
          </marker>
          <marker
            id="flow-arrowhead-hover"
            markerWidth="8"
            markerHeight="6"
            refX="7"
            refY="3"
            orient="auto"
          >
            <polygon points="0 0, 8 3, 0 6" fill="#3B82F6" />
          </marker>
        </defs>

        {/* 移行の矢印 */}
        {transitions.map(transition => {
          const fromPos = getNodePosition(transition.fromSegmentId);
          const toPos = getNodePosition(transition.toSegmentId);
          if (!fromPos || !toPos) return null;

          const path = getArrowPath(fromPos, toPos);
          const midY = (fromPos.y + fromPos.height / 2 + toPos.y + toPos.height / 2) / 2;

          return (
            <g
              key={transition.id}
              className="cursor-pointer group"
              onClick={() => handleTransitionClick(transition)}
            >
              <path
                d={path}
                fill="none"
                stroke="transparent"
                strokeWidth="15"
              />
              <path
                d={path}
                fill="none"
                stroke="#6B7280"
                strokeWidth="2"
                strokeDasharray="4 2"
                markerEnd="url(#flow-arrowhead)"
                className="group-hover:stroke-blue-500 transition-colors"
              />
              <rect
                x={fromPos.x + fromPos.width + 5}
                y={midY - 10}
                width={Math.max(transition.condition.length * 7, 40)}
                height={20}
                rx={4}
                fill="white"
                stroke="#E5E7EB"
                className="group-hover:stroke-blue-300"
              />
              <text
                x={fromPos.x + fromPos.width + 10}
                y={midY + 4}
                className="text-[10px] fill-gray-600 group-hover:fill-blue-600"
              >
                {transition.condition || '条件'}
              </text>
            </g>
          );
        })}

        {/* 流入元ノード */}
        <g
          onClick={() => handleNodeClick('entry')}
          className={`cursor-pointer ${isAddingTransition ? 'hover:opacity-80' : ''}`}
        >
          <rect
            x={20}
            y={60}
            width={120}
            height={40}
            rx={20}
            fill={addingFrom === 'entry' ? '#DBEAFE' : '#F3F4F6'}
            stroke={addingFrom === 'entry' ? '#3B82F6' : '#D1D5DB'}
            strokeWidth={addingFrom === 'entry' ? 2 : 1}
          />
          <text
            x={80}
            y={85}
            textAnchor="middle"
            className="text-sm font-medium fill-gray-700"
          >
            🌐 流入
          </text>
        </g>

        {/* セグメントノード */}
        {segments.map((segment, index) => {
          const y = 60 + (index + 1) * 80;
          const isSelected = addingFrom === segment.id;

          return (
            <g
              key={segment.id}
              onClick={() => handleNodeClick(segment.id)}
              className={`cursor-pointer ${isAddingTransition ? 'hover:opacity-80' : ''}`}
            >
              <rect
                x={20}
                y={y}
                width={120}
                height={40}
                rx={8}
                fill={isSelected ? '#DBEAFE' : segment.color + '20'}
                stroke={isSelected ? '#3B82F6' : segment.color}
                strokeWidth={isSelected ? 2 : 1}
              />
              <circle
                cx={35}
                cy={y + 20}
                r={6}
                fill={segment.color}
              />
              <text
                x={85}
                y={y + 25}
                textAnchor="middle"
                className="text-sm font-medium fill-gray-800"
              >
                {segment.name.length > 8 ? segment.name.slice(0, 8) + '...' : segment.name}
              </text>
            </g>
          );
        })}
      </svg>

      {/* 移行編集モーダル */}
      {editingTransition && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 p-4">
            <h4 className="font-bold text-gray-800 mb-3">移行条件を設定</h4>
            <div className="text-sm text-gray-600 mb-3">
              <span className="font-medium">
                {editingTransition.fromSegmentId === 'entry'
                  ? '流入'
                  : segments.find(s => s.id === editingTransition.fromSegmentId)?.name}
              </span>
              <span className="mx-2">→</span>
              <span className="font-medium">
                {segments.find(s => s.id === editingTransition.toSegmentId)?.name}
              </span>
            </div>
            <div className="mb-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                条件
              </label>
              <input
                type="text"
                value={editingTransition.condition}
                onChange={(e) => setEditingTransition({ ...editingTransition, condition: e.target.value })}
                placeholder="例: LINE登録、購入完了"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                補足説明（任意）
              </label>
              <input
                type="text"
                value={editingTransition.description || ''}
                onChange={(e) => setEditingTransition({ ...editingTransition, description: e.target.value })}
                placeholder="例: 3日以内に登録した場合"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex items-center justify-between">
              <button
                onClick={() => handleDeleteTransition(editingTransition.id)}
                className="text-red-500 hover:text-red-700 text-sm"
              >
                🗑️ 削除
              </button>
              <div className="flex gap-2">
                <button
                  onClick={() => setEditingTransition(null)}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  キャンセル
                </button>
                <button
                  onClick={handleSaveTransition}
                  disabled={!editingTransition.condition.trim()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  保存
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ヒント */}
      {transitions.length === 0 && !isAddingTransition && (
        <div className="text-xs text-gray-500 mt-2">
          「+ 移行を追加」でセグメント間の流れを設定
        </div>
      )}
    </div>
  );
}
