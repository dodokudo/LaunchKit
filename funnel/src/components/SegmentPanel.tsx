'use client';

import { useRef, useState } from 'react';
import { Segment } from '@/types/funnel';

interface SegmentPanelProps {
  segments: Segment[];
  onUpdate: (segments: Segment[]) => void;
}

const PRESET_COLORS = [
  '#6B7280', // gray
  '#EF4444', // red
  '#F59E0B', // amber
  '#10B981', // emerald
  '#3B82F6', // blue
  '#8B5CF6', // violet
  '#EC4899', // pink
  '#06B6D4', // cyan
];

export function SegmentPanel({ segments, onUpdate }: SegmentPanelProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(PRESET_COLORS[4]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  const handleAdd = () => {
    if (!newName.trim()) return;

    const newSegment: Segment = {
      id: `seg-${Date.now()}`,
      name: newName.trim(),
      color: newColor,
    };

    onUpdate([...segments, newSegment]);
    setNewName('');
    setNewColor(PRESET_COLORS[(segments.length + 1) % PRESET_COLORS.length]);
    setIsAdding(false);
  };

  const handleDelete = (id: string) => {
    const segment = segments.find(s => s.id === id);
    if (segment?.isDefault) return; // デフォルトは削除不可

    if (confirm(`「${segment?.name}」を削除しますか？`)) {
      onUpdate(segments.filter(s => s.id !== id));
    }
  };

  const handleUpdateName = (id: string, name: string) => {
    onUpdate(segments.map(s => s.id === id ? { ...s, name } : s));
  };

  const handleUpdateColor = (id: string, color: string) => {
    onUpdate(segments.map(s => s.id === id ? { ...s, color } : s));
  };

  const moveSegment = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;
    const nextSegments = [...segments];
    const [moved] = nextSegments.splice(fromIndex, 1);
    nextSegments.splice(toIndex, 0, moved);
    onUpdate(nextSegments);
  };

  const handleMove = (index: number, direction: number) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= segments.length) return;
    moveSegment(index, newIndex);
  };

  const handlePointerMove = (event: React.PointerEvent) => {
    if (!draggingId) return;
    const target = document.elementFromPoint(event.clientX, event.clientY);
    const row = target?.closest('[data-segment-id]') as HTMLElement | null;
    const targetId = row?.dataset.segmentId;
    if (!targetId || targetId === draggingId) return;
    const targetSegment = segments.find((segment) => segment.id === targetId);
    if (targetSegment?.isDefault) return;
    const fromIndex = segments.findIndex((segment) => segment.id === draggingId);
    const toIndex = segments.findIndex((segment) => segment.id === targetId);
    if (fromIndex === -1 || toIndex === -1) return;
    moveSegment(fromIndex, toIndex);
  };

  const handlePointerUp = (event: React.PointerEvent) => {
    if (draggingId) {
      setDraggingId(null);
      try {
        event.currentTarget.releasePointerCapture(event.pointerId);
      } catch {
        // no-op
      }
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 flex flex-col">
      <div className="p-3 border-b border-gray-200">
        <h3 className="font-bold text-gray-800 flex items-center gap-2">
          <span>📊</span>
          <span>セグメント</span>
        </h3>
      </div>

      {/* セグメント一覧 */}
      <div className="flex-1 overflow-y-auto p-2" ref={listRef}>
        {segments.map((segment, index) => (
          <div
            key={segment.id}
            className="p-2 rounded-lg mb-2 hover:bg-gray-50"
            style={{ backgroundColor: segment.color + '10' }}
            data-segment-id={segment.id}
          >
            {editingId === segment.id ? (
              <div className="space-y-2">
                <input
                  type="text"
                  value={segment.name}
                  onChange={(e) => handleUpdateName(segment.id, e.target.value)}
                  className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                  autoFocus
                />
                <div className="flex gap-1 flex-wrap">
                  {PRESET_COLORS.map(color => (
                    <button
                      key={color}
                      className={`w-5 h-5 rounded-full ${segment.color === color ? 'ring-2 ring-offset-1 ring-gray-400' : ''}`}
                      style={{ backgroundColor: color }}
                      onClick={() => handleUpdateColor(segment.id, color)}
                    />
                  ))}
                </div>
                <button
                  onClick={() => setEditingId(null)}
                  className="text-xs text-blue-600 hover:text-blue-700"
                >
                  完了
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className={`w-3 h-3 rounded-full ${segment.isDefault ? '' : 'cursor-grab active:cursor-grabbing'}`}
                    style={{ backgroundColor: segment.color }}
                    onPointerDown={(event) => {
                      if (segment.isDefault) return;
                      setDraggingId(segment.id);
                      event.currentTarget.setPointerCapture(event.pointerId);
                    }}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    title={segment.isDefault ? '固定' : 'ドラッグで並び替え'}
                  />
                  <span className="text-sm font-medium">{segment.name}</span>
                  {segment.isDefault && (
                    <span className="text-xs text-gray-400">(デフォルト)</span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleMove(index, -1)}
                    className="text-gray-400 hover:text-gray-600 text-xs disabled:opacity-30"
                    disabled={segment.isDefault || index === 0}
                    title="上へ"
                  >
                    ↑
                  </button>
                  <button
                    onClick={() => handleMove(index, 1)}
                    className="text-gray-400 hover:text-gray-600 text-xs disabled:opacity-30"
                    disabled={segment.isDefault || index === segments.length - 1}
                    title="下へ"
                  >
                    ↓
                  </button>
                  <button
                    onClick={() => setEditingId(segment.id)}
                    className="text-gray-400 hover:text-gray-600 text-xs"
                  >
                    ✏️
                  </button>
                  {!segment.isDefault && (
                    <button
                      onClick={() => handleDelete(segment.id)}
                      className="text-gray-400 hover:text-red-500 text-xs"
                    >
                      🗑️
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* 追加フォーム */}
      <div className="p-3 border-t border-gray-200">
        {isAdding ? (
          <div className="space-y-2">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="セグメント名"
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            />
            <div className="flex gap-1 flex-wrap">
              {PRESET_COLORS.map(color => (
                <button
                  key={color}
                  className={`w-6 h-6 rounded-full ${newColor === color ? 'ring-2 ring-offset-1 ring-gray-400' : ''}`}
                  style={{ backgroundColor: color }}
                  onClick={() => setNewColor(color)}
                />
              ))}
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleAdd}
                className="flex-1 bg-blue-600 text-white px-3 py-1.5 rounded text-sm hover:bg-blue-700"
              >
                追加
              </button>
              <button
                onClick={() => setIsAdding(false)}
                className="px-3 py-1.5 text-gray-600 hover:bg-gray-100 rounded text-sm"
              >
                キャンセル
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setIsAdding(true)}
            className="w-full py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition flex items-center justify-center gap-1"
          >
            <span>+</span>
            <span>セグメントを追加</span>
          </button>
        )}
      </div>

    </div>
  );
}
