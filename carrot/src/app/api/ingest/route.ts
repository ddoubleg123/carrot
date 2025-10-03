import { NextResponse } from 'next/server';

const RAILWAY_SERVICE_URL = process.env.INGEST_WORKER_URL || 'http://localhost:8000';
const INGEST_WORKER_SECRET = process.env.INGEST_WORKER_SECRET || 'dev_ingest_secret';

interface IngestRequest {
  url: string;
  inMs?: number | null;
  outMs?: number | null;
  aspect?: string | null;
  postId?: string | null;
}

interface RailwayIngestResponse {
  job_id: string;
  status: string;
  message: string;
}

interface RailwayJobStatus {
  job_id: string;
  status: string;
  progress: number;
  created_at: string;
  completed_at?: string;
  error?: string;
  result?: {
    video_id: string;
    title: string;
    description?: string;
    duration: number;
    uploader: string;
    upload_date: string;
    view_count?: number;
    thumbnail: string;
    formats: Array<{
      format_id: string;
      url: string;
      ext: string;
      acodec: string;
      filesize?: number;
    }>;
    subtitles: Record<string, any>;
    automatic_captions: Record<string, any>;
  };
}

export const runtime = 'nodejs';

export async function POST(request: Request, _ctx: { params: Promise<{}> }) {
  try {
    // DEBUG: Log environment variables
    console.log('[INGEST DEBUG] Environment check:', {
      INGEST_WORKER_URL: process.env.INGEST_WORKER_URL,
      RAILWAY_SERVICE_URL: process.env.INGEST_WORKER_URL || 'http://localhost:8000',
      INGEST_WORKER_SECRET: process.env.INGEST_WORKER_SECRET ? 'SET' : 'MISSING'
    });

    const body: IngestRequest = await request.json();
    const { url, inMs, outMs, aspect, postId } = body;

    if (!url) {
      return NextResponse.json(
        { error: 'URL is required' },
        { status: 400 }
      );
    }

    // Validate URL format
    try {
      new URL(url);
    } catch {
      return NextResponse.json(
        { error: 'Invalid URL format' },
        { status: 400 }
      );
    }

    // Start ingestion job on worker service (forward trim params if provided)
    const workerUrl = `${RAILWAY_SERVICE_URL}/ingest`;
    console.log('[INGEST DEBUG] Calling worker at:', workerUrl);
    console.log('[INGEST DEBUG] Request payload:', { url, inMs, outMs, aspect, postId });
    
    const response = await fetch(workerUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-worker-secret': INGEST_WORKER_SECRET,
      },
      body: JSON.stringify({ url, inMs, outMs, aspect, postId }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Ingest worker error (POST /ingest):', {
        status: response.status,
        body: errorText
      });
      return NextResponse.json(
        {
          error: 'Ingestion service unavailable',
          upstreamStatus: response.status,
          upstreamBody: (errorText || '').slice(0, 4000)
        },
        { status: 503 }
      );
    }

    // TEMP: success-path logging to inspect upstream 200 body shape
    const okBodyText = await response.text();
    try {
      console.log('[api/ingest] upstream 200 body (trunc)', okBodyText.slice(0, 500));
    } catch {}
    let upstream: any = {};
    try { upstream = okBodyText ? JSON.parse(okBodyText) : {}; } catch {}
    try {
      console.log('[api/ingest] upstream 200 keys', Array.isArray(upstream) ? ['<array>'] : Object.keys(upstream || {}));
    } catch {}

    // Try to extract common fields from various shapes
    const jobId = upstream?.job_id ?? upstream?.jobId ?? upstream?.id ?? upstream?.job?.id ?? upstream?.job?.job_id ?? null;
    const jobStatus = upstream?.status ?? upstream?.job?.status ?? 'accepted';
    const jobMessage = upstream?.message ?? upstream?.msg ?? null;

    return NextResponse.json({
      job: {
        id: jobId,
        status: jobStatus,
        progress: 0,
        url,
        message: jobMessage,
        inMs: typeof inMs === 'number' ? inMs : null,
        outMs: typeof outMs === 'number' ? outMs : null,
        aspect: aspect || null,
        postId: postId || null,
      }
    });

  } catch (error) {
    console.error('Ingest API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: Request, _ctx: { params: Promise<{}> }) {
  try {
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get('jobId');

    if (!jobId) {
      return NextResponse.json(
        { error: 'jobId parameter is required' },
        { status: 400 }
      );
    }

    // Get job status from Railway service
    const response = await fetch(`${RAILWAY_SERVICE_URL}/jobs/${jobId}`);

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json(
          { error: 'Job not found' },
          { status: 404 }
        );
      }
      const errorText = await response.text();
      console.error('Ingest worker error (GET /jobs/:id):', {
        status: response.status,
        body: errorText
      });
      return NextResponse.json(
        {
          error: 'Ingestion service unavailable',
          upstreamStatus: response.status,
          upstreamBody: (errorText || '').slice(0, 4000)
        },
        { status: 503 }
      );
    }

    const railwayJob: RailwayJobStatus = await response.json();

    // Transform Railway response to match existing format
    const job = {
      id: railwayJob.job_id,
      status: railwayJob.status,
      progress: railwayJob.progress,
      created_at: railwayJob.created_at,
      completed_at: railwayJob.completed_at,
      error: railwayJob.error,
    };

    // If completed successfully, include the processed result
    if (railwayJob.status === 'completed' && railwayJob.result) {
      const result = railwayJob.result;
      
      // Find the best video format with fallback to audio
      const videoFormat = result.formats?.find(f => 
        f.ext === 'mp4' && f.acodec && f.acodec !== 'none'
      ) || result.formats?.find(f => f.acodec && f.acodec !== 'none');
      
      return NextResponse.json({
        job: {
          ...job,
          videoUrl: videoFormat?.url,
          mediaUrl: videoFormat?.url,
          title: result.title,
          duration: result.duration,
          thumbnail: result.thumbnail,
          uploader: result.uploader,
          video_id: result.video_id,
          // Include subtitle information with null safety
          hasSubtitles: result.subtitles ? Object.keys(result.subtitles).length > 0 : false,
          hasAutoSubtitles: result.automatic_captions ? Object.keys(result.automatic_captions).length > 0 : false,
          subtitles: result.subtitles || {},
          automaticCaptions: result.automatic_captions || {},
        }
      });
    }

    return NextResponse.json({ job });

  } catch (error) {
    console.error('Ingest status API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PATCH handler to link ingest job to post
export async function PATCH(request: Request, _ctx: { params: Promise<{}> }) {
  try {
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get('jobId');
    const { postId } = await request.json();

    if (!jobId || !postId) {
      return NextResponse.json(
        { error: 'Missing jobId or postId' },
        { status: 400 }
      );
    }

    // For now, just acknowledge the link - could store in database if needed
    console.log(`[ComposerModal] Linked ingest job to post: {jobId: '${jobId}', postId: '${postId}'}`);
    
    return NextResponse.json({ 
      success: true, 
      message: 'Job linked to post successfully',
      jobId,
      postId 
    });

  } catch (error) {
    console.error('Ingest link API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
