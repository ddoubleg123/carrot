import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { listMedia, updateMedia } from '@/lib/mediaServer';

export const runtime = 'nodejs';

export async function GET(request: Request, _ctx: { params: Promise<{}> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q') ?? undefined;
  const includeHidden = searchParams.get('includeHidden') === '1';
  const type = (searchParams.get('type') as any) ?? undefined;
  const sort = (searchParams.get('sort') as any) ?? undefined;
  const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : undefined;

  try {
    const items = await listMedia({ userId: session.user.id, q, includeHidden, type, sort, limit });
    return NextResponse.json(items);
  } catch (e: any) {
    console.error('[api/media] listMedia failed:', e?.message || e);
    // Fail gracefully so the media picker/gallery UI does not crash the composer flow
    return new NextResponse(JSON.stringify([]), {
      status: 200,
      headers: { 'content-type': 'application/json', 'x-media-error': String(e?.message || 'listMedia failed') },
    });
  }
}

export async function PATCH(request: Request, _ctx: { params: Promise<{}> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const body = await request.json();
  const { id, patch } = body || {};
  if (!id || typeof patch !== 'object') {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  // Ensure ownership
  // In SQLite, we must check the asset belongs to user before updating
  const { prisma } = await import('@/lib/prisma');
  try {
    const asset = await (prisma as any).mediaAsset.findUnique({ where: { id } });
    if (!asset || asset.userId !== session.user.id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
  } catch {}

  const updated = await updateMedia(id, {
    title: typeof patch.title === 'string' ? patch.title : undefined,
    hidden: typeof patch.hidden === 'boolean' ? patch.hidden : undefined,
    labels: Array.isArray(patch.labels) ? patch.labels : undefined,
  });
  return NextResponse.json(updated);
}
