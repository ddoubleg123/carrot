import { NextResponse } from 'next/server';
import { createJob, updateJob } from '@/lib/ingestJobs';

export const runtime = 'nodejs';

export async function POST(req: Request, _ctx: { params: Promise<{}> }) {
  try {
    const body = await req.json();
    const { sourceUrl, startSec, endSec, userId, postId } = body as {
      sourceUrl?: string;
      startSec?: number;
      endSec?: number;
      userId?: string | null;
      postId?: string | null;
    };

    if (!sourceUrl) {
      return NextResponse.json({ error: 'Missing sourceUrl' }, { status: 400 });
    }

    // Reuse ingest job store (same polling and callback semantics)
    const job = await createJob({
      sourceUrl,
      sourceType: 'youtube', // assume for trim
      userId: userId || null,
      postId: postId || null,
    });

    const updated = await updateJob(job.id, {
      status: 'downloading',
      progress: 1,
    });

    const workerUrl = process.env.INGEST_WORKER_URL;
    const workerSecret = process.env.INGEST_WORKER_SECRET || '';
    if (workerUrl) {
      const base = workerUrl.replace(/\/$/, '');
      const candidates: string[] = [`${base}/trim`];
      try {
        const u = new URL(base);
        if (u.hostname === '127.0.0.1') {
          candidates.push(`${base.replace('127.0.0.1', 'localhost')}/trim`);
          const base8081 = base.replace(/:8080$/, ':8081');
          if (base8081 !== base) {
            candidates.push(`${base8081}/trim`);
            candidates.push(`${base8081.replace('127.0.0.1', 'localhost')}/trim`);
          }
        } else if (u.hostname === 'localhost') {
          candidates.push(`${base.replace('localhost', '127.0.0.1')}/trim`);
          const base8081 = base.replace(/:8080$/, ':8081');
          if (base8081 !== base) {
            candidates.push(`${base8081}/trim`);
            candidates.push(`${base8081.replace('localhost', '127.0.0.1')}/trim`);
          }
        }
      } catch {}

      let lastErr: any = null;
      const attempts: Array<{ target: string; status?: number; body?: string; error?: string }> = [];
      for (const target of candidates) {
        try {
          const wr = await fetch(target, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(workerSecret ? { 'x-worker-secret': workerSecret } : {}),
            },
            body: JSON.stringify({ id: job.id, sourceUrl, startSec, endSec, postId }),
          });
          if (!wr.ok) {
            const text = await wr.text().catch(() => '');
            console.error('Trim worker response not ok', { status: wr.status, body: text, target });
            attempts.push({ target, status: wr.status, body: text });
            lastErr = new Error(`Worker rejected: ${wr.status}`);
            continue;
          }
          lastErr = null;
          break;
        } catch (e: any) {
          attempts.push({ target, error: e?.message || String(e) });
          lastErr = e;
          continue;
        }
      }
      if (lastErr) {
        console.error('Failed to reach trim worker', { error: lastErr?.message, attempts, candidates });
        updateJob(job.id, { status: 'failed', error: `Failed to reach trim worker: ${lastErr?.message || lastErr}` });
        return NextResponse.json(
          { error: 'Failed to reach trim worker', message: String(lastErr?.message || lastErr), attempts, candidates },
          { status: 502 }
        );
      }
    } else {
      updateJob(job.id, { status: 'failed', error: 'Ingest/trim worker not configured. Set INGEST_WORKER_URL.' });
      return NextResponse.json({ error: 'Worker not configured' }, { status: 503 });
    }

    return NextResponse.json({ job }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Unexpected error' }, { status: 500 });
  }
}
