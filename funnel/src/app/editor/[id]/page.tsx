'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { TimelineEditor } from '@/components/TimelineEditor';
import { Funnel, createDefaultFunnel } from '@/types/funnel';

export default function EditorPage() {
  const params = useParams();
  const funnelId = params.id as string;

  const [funnel, setFunnel] = useState<Funnel | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [funnelName, setFunnelName] = useState('');
  const [isEditingName, setIsEditingName] = useState(false);

  useEffect(() => {
    const loadFunnel = async () => {
      // まずAPIから取得を試みる
      try {
        const res = await fetch(`/api/funnels/${funnelId}`);
        if (res.ok) {
          const data = await res.json();
          setFunnel(data);
          setFunnelName(data.name);
          // localStorageにも同期
          syncToLocalStorage(data);
          setIsLoading(false);
          return;
        }
      } catch (e) {
        console.log('API not available, falling back to localStorage');
      }

      // APIで見つからない場合はlocalStorageから取得
      const stored = localStorage.getItem('funnels');
      if (stored) {
        const funnels: Funnel[] = JSON.parse(stored);
        let found = funnels.find((f) => f.id === funnelId);

        if (!found) {
          found = createDefaultFunnel(funnelId);
          const updatedFunnels = [...funnels, found];
          localStorage.setItem('funnels', JSON.stringify(updatedFunnels));
        } else {
          let needsUpdate = false;
          if (!found.transitions) {
            found.transitions = [];
            needsUpdate = true;
          }
          if (!found.connections) {
            found.connections = [];
            needsUpdate = true;
          }
          if (!found.canvasNodes) {
            found.canvasNodes = [];
            needsUpdate = true;
          }
          if (!found.canvasEdges) {
            found.canvasEdges = [];
            needsUpdate = true;
          }
          if (found.deliveries) {
            found.deliveries = found.deliveries.map(d => {
              if (!d.segmentIds) {
                needsUpdate = true;
                return { ...d, segmentIds: [d.segmentId] };
              }
              return d;
            });
          }
          if (needsUpdate) {
            const updatedFunnels = funnels.map(f => f.id === funnelId ? found : f);
            localStorage.setItem('funnels', JSON.stringify(updatedFunnels));
          }
        }

        setFunnel(found);
        setFunnelName(found.name);
      } else {
        const newFunnel = createDefaultFunnel(funnelId);
        localStorage.setItem('funnels', JSON.stringify([newFunnel]));
        setFunnel(newFunnel);
        setFunnelName(newFunnel.name);
      }
      setIsLoading(false);
    };

    loadFunnel();
  }, [funnelId]);

  const syncToLocalStorage = (data: Funnel) => {
    const stored = localStorage.getItem('funnels');
    const funnels: Funnel[] = stored ? JSON.parse(stored) : [];
    const index = funnels.findIndex(f => f.id === data.id);
    if (index >= 0) {
      funnels[index] = data;
    } else {
      funnels.push(data);
    }
    localStorage.setItem('funnels', JSON.stringify(funnels));
  };

  const handleUpdate = useCallback(
    async (updatedFunnel: Funnel) => {
      setIsSaving(true);

      // localStorageに保存
      const stored = localStorage.getItem('funnels');
      const funnels: Funnel[] = stored ? JSON.parse(stored) : [];
      const updatedFunnels = funnels.map((f) =>
        f.id === funnelId ? updatedFunnel : f
      );
      localStorage.setItem('funnels', JSON.stringify(updatedFunnels));

      // APIにも保存（バックグラウンド）
      try {
        await fetch(`/api/funnels/${funnelId}`, {
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

    const stored = localStorage.getItem('funnels');
    const funnels: Funnel[] = stored ? JSON.parse(stored) : [];
    const updatedFunnels = funnels.map((f) =>
      f.id === funnelId ? updatedFunnel : f
    );
    localStorage.setItem('funnels', JSON.stringify(updatedFunnels));

    // APIにも保存
    try {
      await fetch(`/api/funnels/${funnelId}`, {
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
          <Link
            href="/"
            className="text-gray-600 hover:text-gray-800 underline text-sm"
          >
            戻る
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
          <Link
            href="/"
            className="text-gray-400 hover:text-gray-600 transition text-sm"
          >
            戻る
          </Link>
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
