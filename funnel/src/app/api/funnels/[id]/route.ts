import { NextRequest, NextResponse } from 'next/server';
import { getFunnel, saveFunnel, deleteFunnel, addNode, updateNode, deleteNode, addEdge, autoLayout } from '@/lib/storage';

// GET /api/funnels/[id] - 特定ファネル取得
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const funnel = getFunnel(params.id);
  if (!funnel) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  return NextResponse.json(funnel);
}

// PUT /api/funnels/[id] - ファネル更新
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const funnel = getFunnel(params.id);
  if (!funnel) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const body = await request.json();
  const updated = { ...funnel, ...body, id: params.id };
  const saved = saveFunnel(updated);
  return NextResponse.json(saved);
}

// DELETE /api/funnels/[id] - ファネル削除
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const deleted = deleteFunnel(params.id);
  if (!deleted) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}

// PATCH /api/funnels/[id] - ノード/エッジ操作
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await request.json();
  const { action, node, nodeId, edge, updates } = body;

  let result = null;

  switch (action) {
    case 'addNode':
      result = addNode(params.id, node);
      break;
    case 'updateNode':
      result = updateNode(params.id, nodeId, updates);
      break;
    case 'deleteNode':
      result = deleteNode(params.id, nodeId);
      break;
    case 'addEdge':
      result = addEdge(params.id, edge);
      break;
    case 'autoLayout':
      result = autoLayout(params.id);
      break;
    default:
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  }

  if (!result) {
    return NextResponse.json({ error: 'Operation failed' }, { status: 400 });
  }

  return NextResponse.json(result);
}
