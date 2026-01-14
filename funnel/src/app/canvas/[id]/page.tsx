'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Node, Edge } from 'reactflow';
import { FreeCanvas } from '@/components/FreeCanvas';

interface CanvasData {
  id: string;
  name: string;
  nodes: Node[];
  edges: Edge[];
  createdAt: string;
  updatedAt: string;
}

function createDefaultCanvas(id: string): CanvasData {
  return {
    id,
    name: '新規フローチャート',
    nodes: [],
    edges: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export default function CanvasPage() {
  const params = useParams();
  const canvasId = params.id as string;

  const [canvas, setCanvas] = useState<CanvasData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [canvasName, setCanvasName] = useState('');
  const [isEditingName, setIsEditingName] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('canvases');
    if (stored) {
      const canvases: CanvasData[] = JSON.parse(stored);
      let found = canvases.find((c) => c.id === canvasId);

      if (!found) {
        found = createDefaultCanvas(canvasId);
        const updated = [...canvases, found];
        localStorage.setItem('canvases', JSON.stringify(updated));
      }

      setCanvas(found);
      setCanvasName(found.name);
    } else {
      const newCanvas = createDefaultCanvas(canvasId);
      localStorage.setItem('canvases', JSON.stringify([newCanvas]));
      setCanvas(newCanvas);
      setCanvasName(newCanvas.name);
    }
    setIsLoading(false);
  }, [canvasId]);

  const handleSave = useCallback(
    (nodes: Node[], edges: Edge[]) => {
      if (!canvas) return;

      const updatedCanvas: CanvasData = {
        ...canvas,
        nodes,
        edges,
        updatedAt: new Date().toISOString(),
      };

      const stored = localStorage.getItem('canvases');
      const canvases: CanvasData[] = stored ? JSON.parse(stored) : [];
      const updatedCanvases = canvases.map((c) =>
        c.id === canvasId ? updatedCanvas : c
      );
      localStorage.setItem('canvases', JSON.stringify(updatedCanvases));
      setCanvas(updatedCanvas);

      // トースト表示
      const toast = document.createElement('div');
      toast.className =
        'fixed bottom-4 right-4 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg z-50';
      toast.textContent = '保存しました';
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), 2000);
    },
    [canvas, canvasId]
  );

  const handleNameChange = () => {
    if (!canvas || !canvasName.trim()) return;

    const updatedCanvas = {
      ...canvas,
      name: canvasName.trim(),
      updatedAt: new Date().toISOString(),
    };

    const stored = localStorage.getItem('canvases');
    const canvases: CanvasData[] = stored ? JSON.parse(stored) : [];
    const updatedCanvases = canvases.map((c) =>
      c.id === canvasId ? updatedCanvas : c
    );
    localStorage.setItem('canvases', JSON.stringify(updatedCanvases));
    setCanvas(updatedCanvas);
    setIsEditingName(false);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500">読み込み中...</div>
      </div>
    );
  }

  if (!canvas) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4">😕</div>
          <p className="text-gray-600 mb-4">キャンバスが見つかりません</p>
          <Link href="/" className="text-blue-600 hover:text-blue-700 underline">
            ダッシュボードに戻る
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* ヘッダー */}
      <header className="bg-white border-b border-gray-200 px-4 py-2 flex items-center justify-between z-10 flex-shrink-0">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-gray-500 hover:text-gray-700 transition">
            ← 戻る
          </Link>
          {isEditingName ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={canvasName}
                onChange={(e) => setCanvasName(e.target.value)}
                className="px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleNameChange();
                  if (e.key === 'Escape') {
                    setCanvasName(canvas.name);
                    setIsEditingName(false);
                  }
                }}
              />
              <button onClick={handleNameChange} className="text-green-600 hover:text-green-700">
                ✓
              </button>
            </div>
          ) : (
            <h1
              className="text-lg font-medium text-gray-800 cursor-pointer hover:text-blue-600"
              onClick={() => setIsEditingName(true)}
            >
              {canvas.name}
              <span className="text-xs text-gray-400 ml-2">✏️</span>
            </h1>
          )}
        </div>
        <div className="text-xs text-gray-400">
          自由キャンバス / Claudeからも編集可能
        </div>
      </header>

      {/* キャンバス */}
      <div className="flex-1 overflow-hidden">
        <FreeCanvas
          initialNodes={canvas.nodes}
          initialEdges={canvas.edges}
          onSave={handleSave}
        />
      </div>
    </div>
  );
}
