import { NextRequest, NextResponse } from 'next/server';
import { folderStore } from '@/lib/folderStore';

// GET /api/folders/[id] - 特定フォルダ取得
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const folder = await folderStore.getById(id);
    if (!folder) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json(folder);
  } catch (error) {
    console.error('GET /api/folders/[id] error:', error);
    return NextResponse.json({ error: String(error), message: (error as Error).message }, { status: 500 });
  }
}

// PUT /api/folders/[id] - フォルダ更新
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const folder = await folderStore.getById(id);
    if (!folder) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    const updated = { ...folder, ...body, id };
    const saved = await folderStore.save(updated);
    return NextResponse.json(saved);
  } catch (error) {
    console.error('PUT /api/folders/[id] error:', error);
    return NextResponse.json({ error: String(error), message: (error as Error).message }, { status: 500 });
  }
}

// DELETE /api/folders/[id] - フォルダ削除
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await folderStore.delete(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/folders/[id] error:', error);
    return NextResponse.json({ error: String(error), message: (error as Error).message }, { status: 500 });
  }
}
