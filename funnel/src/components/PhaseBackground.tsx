'use client';

import { memo, useState, useCallback, useRef, useEffect } from 'react';
import { useViewport } from 'reactflow';

interface Phase {
  id: number;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
}

interface PhaseBackgroundProps {
  phases: Phase[];
}

// キャンバス内のフェーズ背景と区切り線のみ（両端の線は表示しない）
export const PhaseBackground = memo(({ phases }: PhaseBackgroundProps) => {
  const { x, y, zoom } = useViewport();

  if (phases.length === 0) return null;

  return (
    <svg
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        overflow: 'visible',
      }}
    >
      <g transform={`translate(${x}, ${y}) scale(${zoom})`}>
        {/* フェーズ背景色 */}
        {phases.map((phase) => (
          <rect
            key={phase.id}
            x={phase.x}
            y={phase.y}
            width={phase.width}
            height={phase.height}
            fill={phase.color}
            stroke="none"
          />
        ))}
        {/* フェーズ間の区切り線のみ（両端は描画しない） */}
        {phases.slice(0, -1).map((phase) => (
          <line
            key={`divider-${phase.id}`}
            x1={phase.x + phase.width}
            y1={phase.y}
            x2={phase.x + phase.width}
            y2={phase.y + phase.height}
            stroke="#ddd"
            strokeWidth={1 / zoom}
            strokeDasharray={`${4 / zoom} ${4 / zoom}`}
          />
        ))}
      </g>
    </svg>
  );
});

PhaseBackground.displayName = 'PhaseBackground';

// 固定ヘッダー用のフェーズ表示（リサイズ機能付き）
interface PhaseHeaderProps {
  phases: Phase[];
  onPhaseNameChange: (index: number, name: string) => void;
  onWidthChange?: (index: number, width: number) => void;
  onAddPhase?: () => void;
  onDeletePhase?: (index: number) => void;
  editingPhase: number | null;
  setEditingPhase: (index: number | null) => void;
}

export const PhaseHeader = memo(({ phases, onPhaseNameChange, onWidthChange, onAddPhase, onDeletePhase, editingPhase, setEditingPhase }: PhaseHeaderProps) => {
  const { x, zoom } = useViewport();
  const [resizingIndex, setResizingIndex] = useState<number | null>(null);
  const [startX, setStartX] = useState(0);
  const [startWidth, setStartWidth] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // リサイズ開始
  const handleResizeStart = useCallback((e: React.MouseEvent, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    setResizingIndex(index);
    setStartX(e.clientX);
    setStartWidth(phases[index].width);
  }, [phases]);

  // リサイズ中
  useEffect(() => {
    if (resizingIndex === null) return;

    const handleMouseMove = (e: MouseEvent) => {
      const delta = (e.clientX - startX) / zoom;
      const newWidth = Math.max(100, startWidth + delta);
      onWidthChange?.(resizingIndex, Math.round(newWidth));
    };

    const handleMouseUp = () => {
      setResizingIndex(null);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [resizingIndex, startX, startWidth, zoom, onWidthChange]);

  if (phases.length === 0) return null;

  return (
    <div
      ref={containerRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 28,
        background: 'white',
        borderBottom: '1px solid #e5e5e5',
        zIndex: 10,
        display: 'flex',
        overflow: 'hidden',
      }}
    >
      {phases.map((phase, i) => {
        // ズームとパンに連動した位置と幅を計算
        const left = phase.x * zoom + x;
        const width = phase.width * zoom;
        const isLast = i === phases.length - 1;

        return (
          <div
            key={phase.id}
            style={{
              position: 'absolute',
              left: left,
              width: width,
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {onDeletePhase && (
              <button
                onClick={() => onDeletePhase(i)}
                disabled={phases.length <= 2}
                className="absolute right-1 top-1 text-[10px] text-gray-300 hover:text-red-500 disabled:opacity-30"
                type="button"
              >
                ×
              </button>
            )}
            {editingPhase === i ? (
              <input
                type="text"
                defaultValue={phase.name}
                onBlur={(e) => {
                  onPhaseNameChange(i, e.target.value);
                  setEditingPhase(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    onPhaseNameChange(i, e.currentTarget.value);
                    setEditingPhase(null);
                  }
                  if (e.key === 'Escape') setEditingPhase(null);
                }}
                className="text-xs text-center border border-gray-300 rounded px-1 w-20 focus:outline-none"
                autoFocus
              />
            ) : (
              <span
                className="text-xs text-gray-500 cursor-pointer hover:text-gray-700 truncate px-1"
                onClick={() => setEditingPhase(i)}
              >
                {phase.name}
              </span>
            )}

            {/* リサイズハンドル（右端）- 最後以外 */}
            {!isLast && (
              <div
                onMouseDown={(e) => handleResizeStart(e, i)}
                style={{
                  position: 'absolute',
                  right: 0,
                  top: 0,
                  width: 8,
                  height: '100%',
                  cursor: 'col-resize',
                  background: resizingIndex === i ? 'rgba(59, 130, 246, 0.3)' : 'transparent',
                }}
                className="hover:bg-blue-100"
              />
            )}
          </div>
        );
      })}

      {/* フェーズ追加ボタン（最後のフェーズの右側） */}
      {onAddPhase && phases.length > 0 && (
        <button
          onClick={onAddPhase}
          style={{
            position: 'absolute',
            left: (phases[phases.length - 1].x + phases[phases.length - 1].width) * zoom + x + 4,
            top: '50%',
            transform: 'translateY(-50%)',
          }}
          className="px-2 py-0.5 text-xs text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
        >
          +
        </button>
      )}
    </div>
  );
});

PhaseHeader.displayName = 'PhaseHeader';
