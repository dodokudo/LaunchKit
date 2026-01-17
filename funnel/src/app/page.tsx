'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Funnel } from '@/types/funnel';
import { Folder } from '@/types/folder';

export default function Dashboard() {
  const router = useRouter();
  const [funnels, setFunnels] = useState<Funnel[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newFolderName, setNewFolderName] = useState('');
  const [newSubfolderName, setNewSubfolderName] = useState('');
  const [subfolderParentId, setSubfolderParentId] = useState('');
  const apiBase = process.env.NEXT_PUBLIC_BASE_PATH || '';

  useEffect(() => {
    const loadData = async () => {
      try {
        const [funnelsRes, foldersRes] = await Promise.all([
          fetch(`${apiBase}/api/funnels`),
          fetch(`${apiBase}/api/folders`),
        ]);
        if (!funnelsRes.ok) throw new Error('Failed to load funnels');
        if (!foldersRes.ok) throw new Error('Failed to load folders');
        const [funnelsData, foldersData] = await Promise.all([
          funnelsRes.json(),
          foldersRes.json(),
        ]);
        setFunnels(funnelsData);
        setFolders(foldersData);
      } catch (e) {
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, [apiBase]);

  const sortedTopFolders = useMemo(() => {
    return [...folders]
      .filter((f) => !f.parentId)
      .sort((a, b) => a.name.localeCompare(b.name, 'ja'));
  }, [folders]);

  const folderOptions = useMemo(() => {
    const options: { id: string; label: string }[] = [];
    sortedTopFolders.forEach((top) => {
      options.push({ id: top.id, label: top.name });
      const children = folders
        .filter((f) => f.parentId === top.id)
        .sort((a, b) => a.name.localeCompare(b.name, 'ja'));
      children.forEach((child) => {
        options.push({ id: child.id, label: `${top.name} / ${child.name}` });
      });
    });
    return options;
  }, [folders, sortedTopFolders]);

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

  const updateFunnelFolder = async (
    funnelId: string,
    folderId: string | null,
    updateState = true
  ) => {
    const res = await fetch(`${apiBase}/api/funnels/${funnelId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folderId }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (updateState) {
      setFunnels((prev) => prev.map((f) => (f.id === funnelId ? data : f)));
    }
    return data as Funnel;
  };

  const createFolder = async (name: string, parentId?: string | null) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const res = await fetch(`${apiBase}/api/folders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: trimmed, parentId: parentId ?? null }),
    });
    if (!res.ok) return;
    const data = await res.json();
    setFolders((prev) => [...prev, data]);
  };

  const renameFolder = async (folder: Folder) => {
    const nextName = prompt('フォルダ名を入力してください', folder.name);
    if (!nextName) return;
    const trimmed = nextName.trim();
    if (!trimmed || trimmed === folder.name) return;
    const res = await fetch(`${apiBase}/api/folders/${folder.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: trimmed }),
    });
    if (!res.ok) return;
    const data = await res.json();
    setFolders((prev) => prev.map((f) => (f.id === folder.id ? data : f)));
  };

  const handleDeleteFolder = async (folderId: string) => {
    const childIds = folders.filter((f) => f.parentId === folderId).map((f) => f.id);
    const targetIds = [folderId, ...childIds];
    const hasFunnels = funnels.some((f) => targetIds.includes(f.folderId || ''));
    const message = hasFunnels
      ? 'フォルダと中のファネルを未分類に戻します。削除しますか？'
      : 'このフォルダを削除しますか？';
    if (!confirm(message)) return;

    const affectedFunnels = funnels.filter((f) => targetIds.includes(f.folderId || ''));
    await Promise.all(
      affectedFunnels.map((f) => updateFunnelFolder(f.id, null, false))
    );

    await Promise.all(
      targetIds.map((id) => fetch(`${apiBase}/api/folders/${id}`, { method: 'DELETE' }))
    );

    setFunnels((prev) =>
      prev.map((f) => (targetIds.includes(f.folderId || '') ? { ...f, folderId: null } : f))
    );
    setFolders((prev) => prev.filter((f) => !targetIds.includes(f.id)));
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

  const unassignedFunnels = funnels.filter((f) => !f.folderId);

  const renderFunnelCard = (funnel: Funnel) => (
    <div
      key={funnel.id}
      className="bg-white rounded border border-gray-200 overflow-hidden hover:border-gray-300 transition"
    >
      <Link href={`/editor/${funnel.id}`}>
        <div className="p-4">
          <h3 className="text-sm text-gray-700 mb-1">{funnel.name}</h3>
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
      <div className="px-4 py-2 bg-gray-50 border-t border-gray-100 flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-gray-400">
          {new Date(funnel.updatedAt).toLocaleDateString('ja-JP')}
        </span>
        <div className="flex items-center gap-2">
          <select
            value={funnel.folderId || ''}
            onChange={(e) => updateFunnelFolder(funnel.id, e.target.value || null)}
            className="border border-gray-200 text-xs text-gray-600 rounded px-2 py-1 bg-white"
          >
            <option value="">未分類</option>
            {folderOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
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
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-6 py-4 flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-xl text-gray-700">ファネルビルダー</h1>
          <div className="flex flex-wrap items-center gap-2 border border-gray-200 bg-gray-50 rounded px-3 py-2">
            <span className="text-xs text-gray-500 mr-1">フォルダ管理</span>
            <button
              onClick={createNewFunnel}
              className="border border-gray-300 text-gray-700 px-3 py-2 rounded hover:bg-gray-100 transition text-sm bg-white"
            >
              + 新規作成
            </button>
            <input
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="新規フォルダ名"
              className="border border-gray-300 rounded px-3 py-2 text-sm w-40 bg-white"
            />
            <button
              onClick={() => {
                createFolder(newFolderName);
                setNewFolderName('');
              }}
              className="border border-gray-300 text-gray-700 px-3 py-2 rounded hover:bg-gray-100 transition text-sm bg-white"
            >
              追加
            </button>
            <select
              value={subfolderParentId}
              onChange={(e) => setSubfolderParentId(e.target.value)}
              className="border border-gray-300 rounded px-2 py-2 text-sm bg-white"
            >
              <option value="">親フォルダを選択</option>
              {sortedTopFolders.map((folder) => (
                <option key={folder.id} value={folder.id}>
                  {folder.name}
                </option>
              ))}
            </select>
            <input
              value={newSubfolderName}
              onChange={(e) => setNewSubfolderName(e.target.value)}
              placeholder="サブフォルダ名"
              className="border border-gray-300 rounded px-3 py-2 text-sm w-40 bg-white"
            />
            <button
              onClick={() => {
                if (!subfolderParentId) return;
                createFolder(newSubfolderName, subfolderParentId);
                setNewSubfolderName('');
              }}
              className="border border-gray-300 text-gray-700 px-3 py-2 rounded hover:bg-gray-100 transition text-sm bg-white"
            >
              追加
            </button>
          </div>
        </div>
      </header>

      {/* メインコンテンツ */}
      <main className="max-w-6xl mx-auto px-6 py-8">
        {funnels.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-gray-500 mb-6">ファネルがありません</p>
            <button
              onClick={createNewFunnel}
              className="border border-gray-300 text-gray-700 px-6 py-2 rounded hover:bg-gray-100 transition text-sm"
            >
              最初のファネルを作成
            </button>
          </div>
        ) : (
          <div className="space-y-8">
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-gray-700">未分類</h2>
              </div>
              {unassignedFunnels.length === 0 ? (
                <div className="text-xs text-gray-400">未分類のファネルはありません</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {unassignedFunnels.map(renderFunnelCard)}
                </div>
              )}
            </section>

            {sortedTopFolders.map((folder) => {
              const childFolders = folders
                .filter((f) => f.parentId === folder.id)
                .sort((a, b) => a.name.localeCompare(b.name, 'ja'));
              const directFunnels = funnels.filter((f) => f.folderId === folder.id);

              return (
                <section key={folder.id}>
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-sm font-semibold text-gray-700">{folder.name}</h2>
                    <div className="flex items-center gap-2 text-xs">
                      <button
                        onClick={() => renameFolder(folder)}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        名前変更
                      </button>
                      <button
                        onClick={() => handleDeleteFolder(folder.id)}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        削除
                      </button>
                    </div>
                  </div>

                  {directFunnels.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                      {directFunnels.map(renderFunnelCard)}
                    </div>
                  )}

                  {childFolders.map((child) => {
                    const childFunnels = funnels.filter((f) => f.folderId === child.id);
                    return (
                      <div key={child.id} className="ml-4 mb-4">
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="text-xs font-semibold text-gray-600">
                            {child.name}
                          </h3>
                          <div className="flex items-center gap-2 text-xs">
                            <button
                              onClick={() => renameFolder(child)}
                              className="text-gray-400 hover:text-gray-600"
                            >
                              名前変更
                            </button>
                            <button
                              onClick={() => handleDeleteFolder(child.id)}
                              className="text-gray-400 hover:text-gray-600"
                            >
                              削除
                            </button>
                          </div>
                        </div>
                        {childFunnels.length === 0 ? (
                          <div className="text-xs text-gray-400">空のフォルダ</div>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {childFunnels.map(renderFunnelCard)}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {childFolders.length === 0 && directFunnels.length === 0 && (
                    <div className="text-xs text-gray-400">空のフォルダ</div>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
