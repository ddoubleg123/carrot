import { NextResponse } from 'next/server';
import prisma from '../../../../../lib/prisma';

// Cloudflare Stream webhook receiver (stub)
// Configure webhook in Cloudflare Dashboard → Stream → Webhooks → this endpoint URL
// Events: video.created, video.ready, video.error, download.ready, etc.
// Docs: https://developers.cloudflare.com/stream/viewing-videos/webhooks/
export const runtime = 'nodejs';

export async function POST(req: Request, _ctx: { params: Promise<{}> }) {
  try {
    const payloadText = await req.text();
    // Optionally verify with a shared secret header if configured
    const event = JSON.parse(payloadText || '{}');

    // Minimal logging for now (avoid noisy console in prod)
    // You may want to persist this in logs or use a queue.
    // console.log('[CF Stream Webhook]', event?.type, event?.uid);

    const type: string | undefined = event?.type || event?.event;
    const uid: string | undefined = event?.uid || event?.video?.uid || event?.data?.uid;
    if (!uid) {
      return NextResponse.json({ error: 'Missing uid' }, { status: 400 });
    }

    // Compute common URLs
    const hlsUrl = `https://videodelivery.net/${uid}/manifest/video.m3u8`;
    const posterUrl = `https://videodelivery.net/${uid}/thumbnails/thumbnail.jpg?time=1s`;

    if (type === 'video.created') {
      // Ensure a post exists referencing this uid; if not, no-op
      await prisma.post.updateMany({
        where: { cfUid: uid },
        data: { cfStatus: 'queued', cfPlaybackUrlHls: hlsUrl },
      });
    } else if (type === 'video.ready') {
      const duration = event?.meta?.duration || event?.video?.duration || undefined;
      const width = event?.meta?.width || event?.video?.input?.width || undefined;
      const height = event?.meta?.height || event?.video?.input?.height || undefined;
      await prisma.post.updateMany({
        where: { cfUid: uid },
        data: {
          cfStatus: 'ready',
          cfDurationSec: duration ?? null,
          cfWidth: width ?? null,
          cfHeight: height ?? null,
          cfPlaybackUrlHls: hlsUrl,
          // Only set thumbnailUrl if not already present
        },
      });
      // Set thumbnail if missing
      await prisma.post.updateMany({
        where: { cfUid: uid, thumbnailUrl: null },
        data: { thumbnailUrl: posterUrl },
      });
    } else if (type === 'video.error') {
      await prisma.post.updateMany({
        where: { cfUid: uid },
        data: { cfStatus: 'errored' },
      });
    } else {
      // ignore unhandled events
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Invalid webhook' }, { status: 400 });
  }
}
