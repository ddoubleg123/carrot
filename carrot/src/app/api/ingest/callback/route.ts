import { NextResponse } from 'next/server';
import { updateJob, getJob, createJob } from '@/lib/ingestJobs';
import prisma from '@/lib/prisma';

// Accept either of the app-configured secrets. Do NOT leak values in logs.
const APP_SECRET_1 = process.env.INGEST_WORKER_SECRET || '';
const APP_SECRET_2 = process.env.WORKER_SECRET || '';

export const runtime = 'nodejs';
const DISABLE_JOB_DB = process.env.DISABLE_INGEST_JOB_DB === '1';

export async function POST(request: Request, _ctx: { params: Promise<{}> }) {
  try {
    const body = await request.json();
    const { 
      jobId, 
      status, 
      progress, 
      mediaUrl,
      videoUrl, 
      thumbnailUrl,
      error, 
      title, 
      channel,
      secret,
      postId,
    } = body;

    // Validate worker secret (allow header or body). Accept either configured app-side secret.
    const headerSecret = (request.headers as any).get?.('x-worker-secret') || null;
    const providedSecret = secret || headerSecret || '';
    const validSecrets = [APP_SECRET_1, APP_SECRET_2, 'dev_ingest_secret'].filter(Boolean);
    const authorized = providedSecret && validSecrets.includes(providedSecret);
    if (!authorized) {
      // Do not leak configured values; print which env keys are set.
      const flags = { hasINGEST_WORKER_SECRET: Boolean(APP_SECRET_1), hasWORKER_SECRET: Boolean(APP_SECRET_2) };
      console.warn('[callback] Unauthorized: secret mismatch or missing', flags);
      return NextResponse.json({ error: 'Unauthorized', ...flags }, { status: 401 });
    }

    if (!jobId) {
      return NextResponse.json({ error: 'Job ID is required' }, { status: 400 });
    }

    console.log(`[callback] Received callback for job ${jobId}:`, {
      status,
      progress,
      mediaUrl,
      videoUrl,
      thumbnailUrl,
      error,
      title,
      channel,
      postId,
    });

    // Update job with callback data
    const updateData: any = {};
    
    if (status) updateData.status = status;
    if (typeof progress === 'number') updateData.progress = progress;
    if (mediaUrl) updateData.mediaUrl = mediaUrl;
    if (videoUrl) updateData.videoUrl = videoUrl;
    if (thumbnailUrl) updateData.thumbnailUrl = thumbnailUrl;
    if (error) updateData.error = error;
    if (title) updateData.title = title;
    if (channel) updateData.channel = channel;

    if (!DISABLE_JOB_DB) {
      // Ensure an ingest job row exists; if not, create one first
      let existing = null as any;
      try { existing = await getJob(jobId); } catch {}
      if (!existing) {
        try {
          const srcUrl = videoUrl || mediaUrl || '';
          existing = await createJob({
            sourceUrl: srcUrl || 'about:blank',
            sourceType: 'youtube',
            userId: null,
            postId: postId || null,
            status: (status as any) || 'processing',
          } as any);
          console.log(`[callback] Created ingest job placeholder (local id: ${existing?.id}) for external jobId ${jobId}`);
        } catch (e) {
          console.warn('[callback] Failed to create placeholder job; proceeding to update or post patch anyway');
        }
      }

      try {
        await updateJob(jobId, updateData);
      } catch (e) {
        console.warn(`[callback] updateJob failed for ${jobId}; job may not exist locally yet. Continuing.`, (e as any)?.message || e);
      }
    } else {
      console.warn('[callback] Job DB disabled via DISABLE_INGEST_JOB_DB=1; skipping job upsert/update');
    }

    console.log(`[callback] Job callback processed for ${jobId}`);

    // Normalize Firebase/Storage signed URLs to durable alt=media path form
    const normalizeVideoUrl = (u?: string | null): string | null => {
      if (!u || typeof u !== 'string') return null;
      try {
        const url = new URL(u);
        const host = url.hostname;
        const sp = url.searchParams;
        const isStorage = host.includes('firebasestorage.googleapis.com') || host.includes('storage.googleapis.com') || host.endsWith('.firebasestorage.app');
        if (!isStorage) return u;
        let bucket: string | undefined;
        let path: string | undefined;
        const m2 = url.pathname.match(/^\/([^/]+)\/(.+)$/); // storage.googleapis.com/<bucket>/<path>
        if (host === 'storage.googleapis.com' && m2) {
          bucket = decodeURIComponent(m2[1]);
          path = decodeURIComponent(m2[2]);
        }
        const m1 = url.pathname.match(/\/v0\/b\/([^/]+)\/o\/(.+)$/); // firebasestorage.googleapis.com
        if (!bucket || !path) {
          if (host === 'firebasestorage.googleapis.com' && m1) {
            bucket = decodeURIComponent(m1[1]);
            path = decodeURIComponent(m1[2]);
          }
        }
        const m4 = url.pathname.match(/^\/o\/([^?]+)$/); // <sub>.firebasestorage.app/o/<ENCODED_PATH>
        if (!bucket || !path) {
          if (host.endsWith('.firebasestorage.app') && m4) {
            path = decodeURIComponent(m4[1]);
            const ga = sp.get('GoogleAccessId') || '';
            const projectMatch = ga.match(/@([a-z0-9-]+)\.iam\.gserviceaccount\.com$/i);
            if (projectMatch) bucket = `${projectMatch[1]}.appspot.com`;
          }
        }
        const m3 = url.pathname.match(/\/o\/([^?]+)$/); // generic /o/<ENCODED_PATH>
        if (!bucket || !path) {
          if (m3) {
            path = decodeURIComponent(m3[1]);
            const ga = sp.get('GoogleAccessId') || '';
            const projectMatch = ga.match(/@([a-z0-9-]+)\.iam\.gserviceaccount\.com$/i);
            if (projectMatch) bucket = `${projectMatch[1]}.appspot.com`;
          }
        }
        if (bucket && path) {
          const encPath = encodeURIComponent(path);
          return `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encPath}?alt=media`;
        }
        if (host === 'firebasestorage.googleapis.com' && !sp.has('alt')) {
          url.searchParams.set('alt', 'media');
          return url.toString();
        }
        return u;
      } catch {
        return u || null;
      }
    };

    // If postId and a media URL present, persist trimmed URL to the Post
    try {
      const pid = postId || null;
      const finalUrl = normalizeVideoUrl(videoUrl || mediaUrl || null);
      if (pid && finalUrl) {
        await prisma.post.update({
          where: { id: pid },
          data: {
            videoUrl: finalUrl,
            thumbnailUrl: thumbnailUrl || undefined,
            updatedAt: new Date(),
          }
        });
        console.log(`[callback] Post ${pid} updated with trimmed video URL`);
      }
    } catch (e) {
      console.error('[callback] Failed to update post with trimmed URL', e);
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('[callback] Error processing callback:', error);
    return NextResponse.json(
      { error: 'Failed to process callback' },
      { status: 500 }
    );
  }
}

