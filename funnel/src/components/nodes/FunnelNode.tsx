'use client';

import { memo, useState, useEffect } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';

interface FunnelNodeData {
  label: string;
  nodeType: string;
  bg?: string;
  border?: string;
  target?: number;
  denominatorId?: string;
  kpiOptions?: { id: string; label: string; target?: number }[];
  showKpi?: boolean;
}

export const FunnelNode = memo(({ id, data, selected }: NodeProps<FunnelNodeData>) => {
  const [isEditing, setIsEditing] = useState(false);
  const [label, setLabel] = useState(data.label);
  const [isMetricEditing, setIsMetricEditing] = useState(false);
  const [target, setTarget] = useState<number | ''>(data.target ?? '');
  const [denominatorId, setDenominatorId] = useState<string>(data.denominatorId ?? '');
  const denominatorTarget = data.kpiOptions?.find((option) => option.id === data.denominatorId)?.target;
  const cvr =
    data.target && denominatorTarget ? Math.round((data.target / denominatorTarget) * 1000) / 10 : null;

  useEffect(() => {
    setLabel(data.label);
    setTarget(data.target ?? '');
    setDenominatorId(data.denominatorId ?? '');
  }, [data.label, data.target, data.denominatorId]);

  const handleDoubleClick = () => {
    setIsEditing(true);
  };

  const handleBlur = () => {
    setIsEditing(false);
    data.label = label;
  };

  const commitMetrics = () => {
    data.target = target === '' ? undefined : Number(target);
    data.denominatorId = denominatorId || undefined;
    setIsMetricEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      setIsEditing(false);
      data.label = label;
    }
    if (e.key === 'Escape') {
      setLabel(data.label);
      setIsEditing(false);
    }
  };

  return (
    <div
      className={`min-w-[120px] px-4 py-2 rounded-xl border transition-shadow ${
        selected ? 'shadow-md ring-2 ring-blue-200 border-blue-300' : 'shadow-sm hover:shadow-md'
      }`}
      style={{
        backgroundColor: data.bg || '#ffffff',
        borderColor: data.border || '#cbd5e1',
      }}
      onDoubleClick={handleDoubleClick}
    >
      {/* 入力ハンドル（上） */}
      <Handle
        type="target"
        position={Position.Top}
        className="w-2.5 h-2.5 !bg-white !border !border-slate-300"
      />

      {/* 入力ハンドル（左） */}
      <Handle
        type="target"
        position={Position.Left}
        id="left"
        className="w-2.5 h-2.5 !bg-white !border !border-slate-300"
      />

      {/* コンテンツ */}
      {isEditing ? (
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          className="bg-transparent border-b border-slate-300 outline-none text-sm w-full text-slate-700 font-medium"
          autoFocus
        />
      ) : (
        <span className="text-sm text-slate-700 font-medium">{data.label}</span>
      )}

      {data.showKpi && (
        <div className="mt-1 text-[10px] text-slate-500 flex items-center gap-2">
          {isMetricEditing ? (
            <>
              <input
                type="number"
                value={target}
                onChange={(e) => setTarget(e.target.value === '' ? '' : Number(e.target.value))}
                onBlur={commitMetrics}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitMetrics();
                  if (e.key === 'Escape') {
                    setTarget(data.target ?? '');
                    setDenominatorId(data.denominatorId ?? '');
                    setIsMetricEditing(false);
                  }
                }}
                className="w-16 text-[10px] border border-slate-200 rounded px-1 py-0.5 focus:outline-none"
                placeholder="人数"
              />
              <select
                value={denominatorId}
                onChange={(e) => setDenominatorId(e.target.value)}
                onBlur={commitMetrics}
                className="w-24 text-[10px] border border-slate-200 rounded px-1 py-0.5 focus:outline-none bg-white"
              >
                <option value="">CVR基準</option>
                {(data.kpiOptions || [])
                  .filter((option) => option.id !== id)
                  .map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
              </select>
            </>
          ) : (
            <button
              type="button"
              className="text-[10px] text-slate-400 hover:text-slate-600"
              onClick={() => setIsMetricEditing(true)}
            >
              {data.target ? `${data.target}人` : '人数'}
              {data.denominatorId && cvr !== null ? ` / ${cvr}%` : data.target ? '' : ' / CVR'}
            </button>
          )}
        </div>
      )}

      {/* 出力ハンドル（下） */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="w-2.5 h-2.5 !bg-white !border !border-slate-300"
      />

      {/* 出力ハンドル（右） */}
      <Handle
        type="source"
        position={Position.Right}
        id="right"
        className="w-2.5 h-2.5 !bg-white !border !border-slate-300"
      />
    </div>
  );
});

FunnelNode.displayName = 'FunnelNode';
