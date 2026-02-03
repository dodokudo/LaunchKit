import { NextRequest, NextResponse } from 'next/server';
import { layoutNodes } from '@/lib/storage';
import { funnelStore } from '@/lib/funnelStore';

// GET /api/funnels/[id] - 特定ファネル取得
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const funnel = await funnelStore.getById(id);
    if (!funnel) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json(funnel);
  } catch (error) {
    console.error('GET /api/funnels/[id] error:', error);
    return NextResponse.json({ error: String(error), message: (error as Error).message }, { status: 500 });
  }
}

// PUT /api/funnels/[id] - ファネル更新
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const funnel = await funnelStore.getById(id);
    if (!funnel) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const body = await request.json();
    const updated = { ...funnel, ...body, id };
    const saved = await funnelStore.save(updated);
    return NextResponse.json(saved);
  } catch (error) {
    console.error('PUT /api/funnels/[id] error:', error);
    return NextResponse.json({ error: String(error), message: (error as Error).message }, { status: 500 });
  }
}

// DELETE /api/funnels/[id] - ファネル削除
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await funnelStore.delete(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/funnels/[id] error:', error);
    return NextResponse.json({ error: String(error), message: (error as Error).message }, { status: 500 });
  }
}

// PATCH /api/funnels/[id] - ノード/エッジ操作
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { action, node, nodeId, edge, updates } = body;

    const funnel = await funnelStore.getById(id);
    if (!funnel) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    switch (action) {
      case 'addNode':
        funnel.canvasNodes = funnel.canvasNodes || [];
        funnel.canvasNodes.push(node);
        break;
      case 'updateNode':
        funnel.canvasNodes = funnel.canvasNodes || [];
        funnel.canvasNodes = funnel.canvasNodes.map((n: any) =>
          n.id === nodeId ? { ...n, ...updates } : n
        );
        break;
      case 'deleteNode':
        funnel.canvasNodes = (funnel.canvasNodes || []).filter((n: any) => n.id !== nodeId);
        funnel.canvasEdges = (funnel.canvasEdges || []).filter(
          (e: any) => e.source !== nodeId && e.target !== nodeId
        );
        break;
      case 'addEdge':
        funnel.canvasEdges = funnel.canvasEdges || [];
        funnel.canvasEdges.push(edge);
        funnel.canvasNodes = layoutNodes(funnel.canvasNodes || [], funnel.canvasEdges);
        break;
      case 'autoLayout':
        funnel.canvasNodes = layoutNodes(funnel.canvasNodes || [], funnel.canvasEdges || []);
        break;
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    funnel.updatedAt = new Date().toISOString();
    const saved = await funnelStore.save(funnel);
    return NextResponse.json(saved);
  } catch (error) {
    console.error('PATCH /api/funnels/[id] error:', error);
    return NextResponse.json({ error: String(error), message: (error as Error).message }, { status: 500 });
  }
}
