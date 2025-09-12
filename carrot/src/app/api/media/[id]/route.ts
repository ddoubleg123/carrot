import { NextResponse } from 'next/server';
import prisma from '../../../../lib/prisma';
import { auth } from '../../../../auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/media/[id]
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const userId = session.user.id as string; // safe after auth check
    const { id } = await ctx.params;
    const asset = await (prisma as any).mediaAsset.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        type: true,
        url: true,
        title: true,
        thumbUrl: true,
        captionVttUrl: true,
        durationSec: true,
        labels: { include: { label: true } },
      },
    });
    if (!asset || asset.userId !== session.user.id) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({
      id: asset.id,
      kind: (asset.type || '').toLowerCase().includes('video') ? 'video' : 'image',
      title: asset.title || '',
      duration: typeof asset.durationSec === 'number' ? asset.durationSec : undefined,
      url: asset.url,
      posterUrl: asset.thumbUrl || null,
      captionVttUrl: asset.captionVttUrl || null,
      tags: (asset.labels || []).map((x: any) => x?.label?.name).filter(Boolean),
    });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}

// PATCH /api/media/[id] { title?: string, hidden?: boolean, addTags?: string[], removeTags?: string[] }
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id } = await ctx.params;
    const body = await req.json().catch(() => ({}));
    const title = typeof body?.title === 'string' ? body.title : undefined;
    const hidden = typeof body?.hidden === 'boolean' ? body.hidden : undefined;
    const addTags = Array.isArray(body?.addTags) ? (body.addTags as string[]).map((t) => String(t).trim()).filter(Boolean) : [];
    const removeTags = Array.isArray(body?.removeTags) ? (body.removeTags as string[]).map((t) => String(t).trim()).filter(Boolean) : [];
    if (
      typeof title === 'undefined' &&
      typeof hidden === 'undefined' &&
      addTags.length === 0 &&
      removeTags.length === 0
    ) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
    }

    // Ownership check
    const asset = await prisma.mediaAsset.findUnique({ where: { id } });
    if (!asset || asset.userId !== userId) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // Update fields
    if (typeof title !== 'undefined' || typeof hidden !== 'undefined') {
      await prisma.mediaAsset.update({
        where: { id },
        data: {
          ...(typeof title !== 'undefined' ? { title } : {}),
          ...(typeof hidden !== 'undefined' ? { hidden } : {}),
        },
      });
    }

    // Tag additions
    if (addTags.length > 0) {
      // Find existing labels for user
      const existing = await prisma.mediaLabel.findMany({
        where: { userId, name: { in: addTags } },
        select: { id: true, name: true },
      });
      const existingNames = new Set(existing.map((x) => x.name));
      const toCreate = addTags.filter((n) => !existingNames.has(n));

      if (toCreate.length > 0) {
        // createMany does not return IDs; re-query afterwards
        await prisma.mediaLabel.createMany({
          data: toCreate.map((name) => ({ name, userId })),
          skipDuplicates: true,
        });
      }
      // Gather all label IDs
      const labels = await prisma.mediaLabel.findMany({
        where: { userId, name: { in: addTags } },
        select: { id: true },
      });
      const labelIds = labels.map((l) => l.id);
      if (labelIds.length > 0) {
        // Create asset-label connections; skip duplicates
        await prisma.mediaAssetLabel.createMany({
          data: labelIds.map((labelId) => ({ assetId: id, labelId })),
          skipDuplicates: true,
        });
      }
    }

    // Tag removals
    if (removeTags.length > 0) {
      const labels = await prisma.mediaLabel.findMany({
        where: { userId, name: { in: removeTags } },
        select: { id: true },
      });
      const labelIds = labels.map((l) => l.id);
      if (labelIds.length > 0) {
        await prisma.mediaAssetLabel.deleteMany({
          where: { assetId: id, labelId: { in: labelIds } },
        });
      }
    }

    // Return updated basics + tags
    const updated = await prisma.mediaAsset.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        hidden: true,
        labels: { include: { label: true } },
      },
    });
    const tags = (updated?.labels || []).map((al) => al.label?.name).filter(Boolean);
    return NextResponse.json({ id: updated?.id, title: updated?.title, hidden: updated?.hidden, tags });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}
