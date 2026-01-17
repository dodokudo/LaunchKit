'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { TimelineEditor } from '@/components/TimelineEditor';
import { Funnel } from '@/types/funnel';

export default function EditorPage() {
  const params = useParams();
  const funnelId = params.id as string;

  const [funnel, setFunnel] = useState<Funnel | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [funnelName, setFunnelName] = useState('');
  const [isEditingName, setIsEditingName] = useState(false);
  const apiBase = process.env.NEXT_PUBLIC_BASE_PATH || '';
  const dashboardHref = apiBase ? `${apiBase}/` : '/';

  const normalizeFunnel = (data: Funnel) => {
    const next = { ...data };
    if (!next.transitions) next.transitions = [];
    if (!next.connections) next.connections = [];
    if (!next.canvasNodes) next.canvasNodes = [];
    if (!next.canvasEdges) next.canvasEdges = [];
    if (next.deliveries) {
      next.deliveries = next.deliveries.map(d => {
        if (!d.segmentIds) {
          return { ...d, segmentIds: [d.segmentId] };
        }
        return d;
      });
    }
    return next;
  };

  useEffect(() => {
    const loadFunnel = async () => {
      try {
        const res = await fetch(`${apiBase}/api/funnels/${funnelId}`);
        if (res.ok) {
          const data = await res.json();
          const normalized = normalizeFunnel(data);
          setFunnel(normalized);
          setFunnelName(normalized.name);
          return;
        }

        if (res.status === 404) {
          const created = await fetch(`${apiBase}/api/funnels`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: funnelId }),
          });
          if (created.ok) {
            const data = await created.json();
            const normalized = normalizeFunnel(data);
            setFunnel(normalized);
            setFunnelName(normalized.name);
          }
        }
      } catch (e) {
        console.error('Failed to load funnel', e);
      } finally {
        setIsLoading(false);
      }
    };

    loadFunnel();
  }, [funnelId]);

  const handleUpdate = useCallback(
    async (updatedFunnel: Funnel) => {
      setIsSaving(true);

      // APIにも保存（バックグラウンド）
      try {
        await fetch(`${apiBase}/api/funnels/${funnelId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatedFunnel),
        });
      } catch (e) {
        console.log('API save failed, data saved to localStorage only');
      }

      setFunnel(updatedFunnel);
      setFunnelName(updatedFunnel.name);
      setIsSaving(false);
    },
    [funnelId]
  );

  const handleNameChange = () => {
    if (!funnel || !funnelName.trim()) return;

    const updatedFunnel = {
      ...funnel,
      name: funnelName.trim(),
      updatedAt: new Date().toISOString(),
    };

    handleUpdate(updatedFunnel);
    setIsEditingName(false);
  };

  const handleSave = async () => {
    if (!funnel) return;

    setIsSaving(true);
    const updatedFunnel = { ...funnel, updatedAt: new Date().toISOString() };

    // APIにも保存
    try {
      await fetch(`${apiBase}/api/funnels/${funnelId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedFunnel),
      });
    } catch (e) {
      console.log('API save failed');
    }

    setIsSaving(false);

    // トースト表示
    const toast = document.createElement('div');
    toast.className =
      'fixed bottom-4 right-4 bg-gray-700 text-white px-4 py-2 rounded text-sm z-50';
    toast.textContent = '保存しました';
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2000);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500">読み込み中...</div>
      </div>
    );
  }

  if (!funnel) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 mb-4">ファネルが見つかりません</p>
          <a
            href={dashboardHref}
            className="text-gray-600 hover:text-gray-800 underline text-sm"
          >
            戻る
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* ヘッダー */}
      <header className="bg-white border-b border-gray-200 px-4 py-2 flex items-center justify-between z-10 flex-shrink-0">
        <div className="flex items-center gap-4">
          <a
            href={dashboardHref}
            className="text-gray-400 hover:text-gray-600 transition text-sm"
          >
            戻る
          </a>
          {isEditingName ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={funnelName}
                onChange={(e) => setFunnelName(e.target.value)}
                className="px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:border-gray-400"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleNameChange();
                  if (e.key === 'Escape') {
                    setFunnelName(funnel.name);
                    setIsEditingName(false);
                  }
                }}
              />
              <button
                onClick={handleNameChange}
                className="text-gray-500 hover:text-gray-700 text-sm"
              >
                OK
              </button>
            </div>
          ) : (
            <h1
              className="text-sm text-gray-700 cursor-pointer hover:text-gray-900"
              onClick={() => setIsEditingName(true)}
            >
              {funnel.name}
            </h1>
          )}
        </div>
        <div className="flex items-center gap-3">
          {isSaving && (
            <span className="text-xs text-gray-400">保存中...</span>
          )}
          <button
            onClick={handleSave}
            className="border border-gray-300 text-gray-700 px-3 py-1 rounded hover:bg-gray-100 transition text-sm"
          >
            保存
          </button>
        </div>
      </header>

      {/* エディタ */}
      <div className="flex-1 overflow-hidden">
        <TimelineEditor funnel={funnel} onUpdate={handleUpdate} />
      </div>
    </div>
  );
}
