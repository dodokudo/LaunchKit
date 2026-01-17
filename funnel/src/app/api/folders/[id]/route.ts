import { NextRequest, NextResponse } from 'next/server';
import { deleteFolder, getFolder, saveFolder } from '@/lib/storage';

// GET /api/folders/[id] - 特定フォルダ取得
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const folder = getFolder(params.id);
  if (!folder) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  return NextResponse.json(folder);
}

// PUT /api/folders/[id] - フォルダ更新
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const folder = getFolder(params.id);
  if (!folder) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const updated = { ...folder, ...body, id: params.id };
  const saved = saveFolder(updated);
  return NextResponse.json(saved);
}

// DELETE /api/folders/[id] - フォルダ削除
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  deleteFolder(params.id);
  return NextResponse.json({ success: true });
}
