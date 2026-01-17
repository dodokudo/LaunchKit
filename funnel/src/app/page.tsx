'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Funnel } from '@/types/funnel';

export default function Dashboard() {
  const router = useRouter();
  const [funnels, setFunnels] = useState<Funnel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const apiBase = process.env.NEXT_PUBLIC_BASE_PATH || '';

  useEffect(() => {
    const loadFunnels = async () => {
      try {
        const res = await fetch(`${apiBase}/api/funnels`);
        if (!res.ok) throw new Error('Failed to load funnels');
        const data = await res.json();
        setFunnels(data);
      } catch (e) {
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    };
    loadFunnels();
  }, []);

  const createNewFunnel = () => {
    const create = async () => {
      const res = await fetch(`${apiBase}/api/funnels`, { method: 'POST' });
      if (!res.ok) return;
      const data = await res.json();
      router.push(`/editor/${data.id}`);
    };
    create();
  };

  const deleteFunnel = (id: string) => {
    if (!confirm('このファネルを削除しますか？')) return;
    const remove = async () => {
      const res = await fetch(`${apiBase}/api/funnels/${id}`, { method: 'DELETE' });
      if (!res.ok) return;
      setFunnels((prev) => prev.filter((f) => f.id !== id));
    };
    remove();
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500">読み込み中...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <h1 className="text-xl text-gray-700">
            ファネルビルダー
          </h1>
          <button
            onClick={createNewFunnel}
            className="border border-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-100 transition text-sm"
          >
            + 新規作成
          </button>
        </div>
      </header>

      {/* メインコンテンツ */}
      <main className="max-w-6xl mx-auto px-6 py-8">
        {funnels.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-gray-500 mb-6">
              ファネルがありません
            </p>
            <button
              onClick={createNewFunnel}
              className="border border-gray-300 text-gray-700 px-6 py-2 rounded hover:bg-gray-100 transition text-sm"
            >
              最初のファネルを作成
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {funnels.map((funnel) => (
              <div
                key={funnel.id}
                className="bg-white rounded border border-gray-200 overflow-hidden hover:border-gray-300 transition"
              >
                <Link href={`/editor/${funnel.id}`}>
                  <div className="p-4">
                    <h3 className="text-sm text-gray-700 mb-1">
                      {funnel.name}
                    </h3>
                    <p className="text-xs text-gray-400 mb-3">
                      {funnel.description || '説明なし'}
                    </p>
                    {funnel.baseDate && (
                      <div className="text-xs text-gray-400">
                        {funnel.baseDateLabel || '基準日'}: {formatDate(funnel.baseDate)}
                      </div>
                    )}
                    <div className="flex items-center gap-3 text-xs text-gray-400 mt-1">
                      <span>{funnel.segments?.length || 0} セグメント</span>
                      <span>{funnel.deliveries?.length || 0} 配信</span>
                    </div>
                  </div>
                </Link>
                <div className="px-4 py-2 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
                  <span className="text-xs text-gray-400">
                    {new Date(funnel.updatedAt).toLocaleDateString('ja-JP')}
                  </span>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      deleteFunnel(funnel.id);
                    }}
                    className="text-gray-400 hover:text-gray-600 text-xs"
                  >
                    削除
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
