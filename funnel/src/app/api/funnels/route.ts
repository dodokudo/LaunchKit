import { NextRequest, NextResponse } from 'next/server';
import { createDefaultFunnel } from '@/types/funnel';
import { funnelStore } from '@/lib/funnelStore';

// GET /api/funnels - 全ファネル一覧
export async function GET() {
  const funnels = await funnelStore.getAll();
  return NextResponse.json(funnels);
}

// POST /api/funnels - 新規ファネル作成
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const id = body.id || `funnel-${Date.now()}`;
  const funnel = createDefaultFunnel(id);

  if (body.name) funnel.name = body.name;
  if (body.description) funnel.description = body.description;

  const saved = await funnelStore.save(funnel);
  return NextResponse.json(saved, { status: 201 });
}
