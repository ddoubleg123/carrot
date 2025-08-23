import { NextRequest, NextResponse } from 'next/server';
import { updateJob, getJob } from '@/lib/ingestJobs';
import { prisma } from '@/lib/prisma';

function unauthorized(reason: string) {
  return NextResponse.json({ error: 'Unauthorized', reason }, { status: 401 });
}

// Lightweight health to verify server has the expected secret loaded
export async function GET() {
  const expected = process.env.INGEST_CALLBACK_SECRET || 'dev_ingest_secret';
  return NextResponse.json({ ok: true, hasSecret: !!expected, secretLength: expected.length });
}

export async function POST(req: NextRequest) {
  // Accept either header name for compatibility with different workers
  const secret = req.headers.get('x-ingest-secret') || req.headers.get('x-ingest-callback-secret');
  // Default to dev secret when not configured to avoid local dev stalls
  const expected = process.env.INGEST_CALLBACK_SECRET || 'dev_ingest_secret';
  if (secret !== expected) return unauthorized('mismatch');

  try {
    const body = await req.json();
    // Debug: capture a minimal snapshot of headers for troubleshooting
    try {
      const hdr = {
        hasIngestSecret: !!req.headers.get('x-ingest-secret'),
        hasCallbackSecret: !!req.headers.get('x-ingest-callback-secret'),
        contentType: req.headers.get('content-type') || undefined,
      };
      console.log('[ingest-callback] POST received', { hdr, bodyPreview: { id: body?.id, status: body?.status, progress: body?.progress } });
    } catch {}
    // Support both shapes: with nested result or flat fields
    const id = body?.id as string;
    const status = body?.status as any | undefined;
    const progress = (typeof body?.progress === 'number' ? body.progress : undefined) as number | undefined;
    const error = body?.error as string | undefined;
    const result = (body?.result ?? {
      mediaUrl: body?.mediaUrl,
      durationSec: body?.durationSec,
      width: body?.width,
      height: body?.height,
      title: body?.title,
      channel: body?.channel,
    }) as {
      mediaUrl?: string;
      durationSec?: number;
      width?: number;
      height?: number;
      title?: string;
      channel?: string;
    } | undefined;

    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    // Normalize media URL: if worker returns its own origin (e.g., http://localhost:8080/media/ingest/..)
    // rewrite to our Next proxy origin (http://localhost:3005) so CSP and rewrites apply.
    const proxyOrigin = (process.env.NEXTAUTH_URL || 'http://localhost:3005').replace(/\/$/, '');
    let normalizedMediaUrl = result?.mediaUrl as string | undefined;
    try {
      if (normalizedMediaUrl) {
        const u = new URL(normalizedMediaUrl);
        if (u.pathname.startsWith('/media/ingest/')) {
          normalizedMediaUrl = `${proxyOrigin}${u.pathname}`;
        }
      }
    } catch {
      // leave as-is if malformed
    }

    // Build a patch with only defined fields so we don't clobber existing values
    const patch: any = {};
    if (typeof status !== 'undefined') patch.status = status;
    if (typeof progress === 'number') patch.progress = progress;
    if (typeof error === 'string') patch.error = error;
    if (typeof normalizedMediaUrl === 'string') patch.mediaUrl = normalizedMediaUrl;
    if (typeof body?.cfUid !== 'undefined') patch.cfUid = body?.cfUid as string | null | undefined;
    if (typeof body?.cfStatus !== 'undefined') patch.cfStatus = body?.cfStatus as string | null | undefined;
    if (typeof result?.durationSec === 'number') patch.durationSec = result?.durationSec;
    if (typeof result?.width === 'number') patch.width = result?.width;
    if (typeof result?.height === 'number') patch.height = result?.height;
    if (typeof result?.title === 'string') patch.title = result?.title;
    if (typeof result?.channel === 'string') patch.channel = result?.channel;

    const updated = await updateJob(id, patch);
    try {
      console.log('[ingest-callback] updateJob', { id, patch, updatedExists: !!updated, updatedStatus: updated?.status, updatedProgress: updated?.progress, updatedMediaUrl: updated?.mediaUrl });
    } catch {}

    if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // When job completes successfully, update the associated post's videoUrl
    if (updated.status === 'completed' && updated.mediaUrl && updated.postId) {
      try {
        await prisma.post.update({
          where: { id: updated.postId },
          data: { videoUrl: updated.mediaUrl }
        });
        console.log('[ingest-callback] Updated post videoUrl', { postId: updated.postId, videoUrl: updated.mediaUrl });
      } catch (err) {
        console.error('[ingest-callback] Failed to update post videoUrl:', err);
      }
    }

    return NextResponse.json({ ok: true, job: updated });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Unexpected error' }, { status: 500 });
  }
}

