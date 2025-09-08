import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// Dev-only, idempotent normalization for posts
// - Ensures gradients are set when missing
// - Prefers Cloudflare HLS playback when cfUid exists but cfPlaybackUrlHls is empty
// - Optionally ensures non-empty content
// Query params:
//   dryRun=true|false (default true)
//   limit=50 (1..200)
//   fixEmptyContent=true|false (default true)

const DEFAULT_GRADIENT = {
  from: '#111827',
  via: '#1f2937',
  to: '#111827',
  direction: 'to-b',
};

function computePlaybackHlsFromCfUid(cfUid?: string | null): string | null {
  if (!cfUid) return null;
  // Standard Cloudflare Stream HLS manifest
  return `https://videodelivery.net/${cfUid}/manifest/video.m3u8`;
}

export const runtime = 'nodejs';

export async function GET(request: Request, context: { params: Promise<{}> }) {
  return POST(request, context);
}

export async function POST(request: Request, context: { params: Promise<{}> }) {
  try {
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ ok: false, error: 'Disabled in production' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const dryRun = (searchParams.get('dryRun') ?? 'true').toLowerCase() !== 'false';
    const limit = Math.max(1, Math.min(200, parseInt(searchParams.get('limit') || '50', 10) || 50));
    const fixEmptyContent = (searchParams.get('fixEmptyContent') ?? 'true').toLowerCase() !== 'false';

    // Fetch candidates: newest first to reflect current UX
    const posts = await prisma.post.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        content: true,
        gradientDirection: true,
        gradientFromColor: true,
        gradientViaColor: true,
        gradientToColor: true,
        cfUid: true,
        cfPlaybackUrlHls: true,
      },
    });

    const plan: Array<{
      id: string;
      setGradient?: boolean;
      setContent?: boolean;
      setHls?: boolean;
      newGradient?: { direction: string; from: string; via: string; to: string } | null;
      newContent?: string | null;
      newHls?: string | null;
    }> = [];

    for (const p of posts) {
      let setGradient = false;
      let setContent = false;
      let setHls = false;

      // Gradient: if any of the gradient fields is missing, set defaults
      const missingGradient = !p.gradientFromColor || !p.gradientToColor || !p.gradientDirection;
      if (missingGradient) {
        setGradient = true;
      }

      // Content: if empty and fix enabled, set a small placeholder
      let newContent: string | null = null;
      if (fixEmptyContent) {
        const trimmed = (p.content || '').trim();
        if (!trimmed) {
          newContent = 'Imported media';
          setContent = true;
        }
      }

      // Cloudflare HLS
      let newHls: string | null = null;
      if (!p.cfPlaybackUrlHls && p.cfUid) {
        newHls = computePlaybackHlsFromCfUid(p.cfUid);
        if (newHls) setHls = true;
      }

      if (setGradient || setContent || setHls) {
        plan.push({
          id: p.id,
          setGradient,
          setContent,
          setHls,
          newGradient: setGradient ? { direction: DEFAULT_GRADIENT.direction, from: DEFAULT_GRADIENT.from, via: DEFAULT_GRADIENT.via, to: DEFAULT_GRADIENT.to } : null,
          newContent,
          newHls,
        });
      }
    }

    if (dryRun) {
      return NextResponse.json({ ok: true, dryRun: true, scanned: posts.length, changes: plan.length, plan });
    }

    let updated = 0;
    for (const item of plan) {
      const data: any = {};
      if (item.setGradient && item.newGradient) {
        data.gradientDirection = item.newGradient.direction;
        data.gradientFromColor = item.newGradient.from;
        data.gradientViaColor = item.newGradient.via;
        data.gradientToColor = item.newGradient.to;
      }
      if (item.setContent && typeof item.newContent === 'string') {
        data.content = item.newContent;
      }
      if (item.setHls && typeof item.newHls === 'string') {
        data.cfPlaybackUrlHls = item.newHls;
      }
      if (Object.keys(data).length > 0) {
        await prisma.post.update({ where: { id: item.id }, data });
        updated += 1;
      }
    }

    return NextResponse.json({ ok: true, dryRun: false, scanned: posts.length, updated, plan });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}
