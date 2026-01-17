import { NextRequest, NextResponse } from 'next/server';
import { getAllFolders, saveFolder } from '@/lib/storage';
import { Folder } from '@/types/folder';

// GET /api/folders - 全フォルダ一覧
export async function GET() {
  const folders = getAllFolders();
  return NextResponse.json(folders);
}

// POST /api/folders - 新規フォルダ作成
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const now = new Date().toISOString();
  const folder: Folder = {
    id: body.id || `folder-${Date.now()}`,
    name: body.name || '新規フォルダ',
    parentId: body.parentId ?? null,
    createdAt: now,
    updatedAt: now,
  };

  const saved = saveFolder(folder);
  return NextResponse.json(saved, { status: 201 });
}
