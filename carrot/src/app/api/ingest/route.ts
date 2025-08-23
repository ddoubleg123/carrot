import { NextRequest, NextResponse } from 'next/server';
import { createJob, IngestSourceType, updateJob, getJob } from '@/lib/ingestJobs';

// Shared-secret for worker auth (defaults for local dev)
const WORKER_SECRET = process.env.INGEST_WORKER_SECRET ?? 'dev_ingest_secret';

// Candidate worker base URLs to try (deduped)
const CANDIDATE_WORKERS = Array.from(
  new Set(
    [
      process.env.INGEST_WORKER_URL, // if provided
      'http://127.0.0.1:8080',
      'http://localhost:8080',
    ].filter(Boolean)
  )
);

async function enqueueToWorker(payload: any): Promise<boolean> {
  const body = JSON.stringify(payload);
  const headers: Record<string, string> = {
    'content-type': 'application/json',
  };
  if (WORKER_SECRET) headers['x-worker-secret'] = WORKER_SECRET;

  // 2 passes across candidates with a 5s per-attempt timeout and tiny backoff
  const attempts = 2;
  let lastErr: unknown;
  for (let pass = 0; pass < attempts; pass++) {
    for (const base of CANDIDATE_WORKERS) {
      try {
        const ctrl = new AbortController();
        const to = setTimeout(() => ctrl.abort(), 5000);
        const res = await fetch(`${base.replace(/\/$/, '')}/ingest`, {
          method: 'POST',
          headers,
          body,
          signal: ctrl.signal,
        });
        clearTimeout(to);
        if (res.ok) return true; // accepted by worker
        lastErr = new Error(`Worker ${base} HTTP ${res.status}`);
      } catch (e) {
        lastErr = e;
      }
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  try { console.error('[ingest] enqueueToWorker failed', { lastErr }); } catch {}
  return false;
}

function isValidUrl(url: string) {
  try {
    const u = new URL(url);
    return !!u.protocol && !!u.hostname;
  } catch {
    return false;
  }
}

export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      message: 'POST a JSON body to create an ingest job',
      example: { url: 'https://www.youtube.com/watch?v=...', type: 'youtube' },
      debug: 'See /api/ingest/debug for current jobs'
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { url, type, userId, postId } = body as {
      url?: string;
      type?: IngestSourceType;
      userId?: string | null;
      postId?: string | null;
    };

    if (!url || !isValidUrl(url)) {
      return NextResponse.json({ error: 'Invalid or missing url' }, { status: 400 });
    }

    const allowed: IngestSourceType[] = ['youtube', 'x', 'facebook', 'reddit', 'tiktok'];
    const sourceType: IngestSourceType = (type as IngestSourceType) || 'youtube';
    if (!allowed.includes(sourceType)) {
      return NextResponse.json({ error: 'Unsupported type' }, { status: 400 });
    }

    // TODO: attach authenticated user id from session if available
    const job = await createJob({ sourceUrl: url, sourceType, userId: userId ?? null, postId: postId ?? null });
    // Optimistically bump immediately so UI doesn't stay at 0%
    let jobForResponse = job;
    try {
      const updated = await updateJob(job.id, { status: 'downloading', progress: 1 });
      if (updated) jobForResponse = updated;
    } catch {}

    // Enqueue to worker with retries; fail fast if unreachable so UI doesn't spin at 1%
    const accepted = await enqueueToWorker({ id: job.id, url, type: sourceType });
    if (!accepted) {
      try {
        await updateJob(job.id, {
          status: 'failed',
          progress: 1,
          error: 'Ingest worker unreachable (no /ingest ACK)'
        });
      } catch {}
      return NextResponse.json(
        { id: job.id, status: 'failed', error: 'Worker unreachable' },
        { status: 503, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    // Respond with the latest database snapshot (includes optimistic bump)
    const latest = await getJob(job.id) || jobForResponse;
    return NextResponse.json({ job: latest }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Unexpected error' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
}

// DEV SIMULATION ONLY – replace with Cloud Run worker using yt-dlp + ffmpeg
function simulateYouTubeIngest(jobId: string, sourceUrl: string) {
  // downloading
  setTimeout(() => {
    updateJob(jobId, { status: 'downloading', progress: 10 });
  }, 300);
  // transcoding
  setTimeout(() => {
    updateJob(jobId, { status: 'transcoding', progress: 45 });
  }, 2200);
  // uploading
  setTimeout(() => {
    updateJob(jobId, { status: 'uploading', progress: 80 });
  }, 4200);
  // completed
  setTimeout(() => {
    // Simulation disabled for strict real testing. Mark as failed if ever invoked.
    updateJob(jobId, {
      status: 'failed',
      progress: 100,
      error: 'Dev simulation disabled. Real ingest worker required.'
    });
    // TODO: trigger transcription job here using existing API once integrated
  }, 6200);
}
