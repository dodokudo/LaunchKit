'use client';

import { memo, useState, useCallback } from 'react';
import { EdgeProps, getSmoothStepPath, EdgeLabelRenderer } from 'reactflow';

interface TaskEdgeData {
  task?: string;
  onTaskChange?: (id: string, task: string) => void;
}

export const TaskEdge = memo(({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  data,
}: EdgeProps<TaskEdgeData>) => {
  const [isEditing, setIsEditing] = useState(false);
  const [task, setTask] = useState(data?.task || '');

  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 0,
  });

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(true);
  }, []);

  const handleBlur = useCallback(() => {
    setIsEditing(false);
    if (data?.onTaskChange) {
      data.onTaskChange(id, task);
    }
  }, [id, task, data]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      setIsEditing(false);
      if (data?.onTaskChange) {
        data.onTaskChange(id, task);
      }
    }
    if (e.key === 'Escape') {
      setTask(data?.task || '');
      setIsEditing(false);
    }
  }, [id, task, data]);

  return (
    <>
      <path
        id={id}
        style={style}
        className="react-flow__edge-path"
        d={edgePath}
        markerEnd={markerEnd}
      />
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: 'all',
          }}
          className="nodrag nopan"
          onDoubleClick={handleDoubleClick}
        >
          {isEditing ? (
            <input
              type="text"
              value={task}
              onChange={(e) => setTask(e.target.value)}
              onBlur={handleBlur}
              onKeyDown={handleKeyDown}
              className="px-2 py-1 text-xs border border-slate-300 rounded-full bg-white shadow-sm focus:outline-none focus:border-slate-400 min-w-[90px]"
              placeholder="タスク/条件"
              autoFocus
            />
          ) : (
            task && (
              <div className="px-2 py-1 text-xs bg-white border border-slate-200 rounded-full text-slate-600 shadow-sm cursor-pointer hover:bg-slate-50">
                {task}
              </div>
            )
          )}
          {!task && !isEditing && (
            <div
              className="w-5 h-5 rounded-full bg-white border border-slate-200 shadow-sm cursor-pointer hover:bg-slate-50 flex items-center justify-center text-slate-400 text-xs"
              title="ダブルクリックでタスク追加"
            >
              +
            </div>
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  );
});

TaskEdge.displayName = 'TaskEdge';
