import { NextRequest, NextResponse } from 'next/server';
import { folderStore } from '@/lib/folderStore';
import { Folder } from '@/types/folder';

// GET /api/folders - 全フォルダ一覧
export async function GET() {
  try {
    const folders = await folderStore.getAll();
    return NextResponse.json(folders);
  } catch (error) {
    console.error('GET /api/folders error:', error);
    return NextResponse.json({ error: String(error), message: (error as Error).message }, { status: 500 });
  }
}

// POST /api/folders - 新規フォルダ作成
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const now = new Date().toISOString();
    const folder: Folder = {
      id: body.id || `folder-${Date.now()}`,
      name: body.name || '新規フォルダ',
      parentId: body.parentId ?? null,
      createdAt: now,
      updatedAt: now,
    };

    const saved = await folderStore.save(folder);
    return NextResponse.json(saved, { status: 201 });
  } catch (error) {
    console.error('POST /api/folders error:', error);
    return NextResponse.json({ error: String(error), message: (error as Error).message }, { status: 500 });
  }
}
