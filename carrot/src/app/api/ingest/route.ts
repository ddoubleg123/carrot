import { NextResponse } from 'next/server';

const RAILWAY_SERVICE_URL = process.env.INGEST_WORKER_URL || 'http://localhost:8000';
const INGEST_WORKER_SECRET = process.env.INGEST_WORKER_SECRET || 'dev_ingest_secret';

interface IngestRequest {
  url: string;
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
    const body: IngestRequest = await request.json();
    const { url } = body;

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

    // Start ingestion job on Railway service
    const response = await fetch(`${RAILWAY_SERVICE_URL}/ingest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-worker-secret': INGEST_WORKER_SECRET,
      },
      body: JSON.stringify({ url }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Railway service error:', errorText);
      return NextResponse.json(
        { error: 'Ingestion service unavailable' },
        { status: 503 }
      );
    }

    const railwayResponse: RailwayIngestResponse = await response.json();

    return NextResponse.json({
      job: {
        id: railwayResponse.job_id,
        status: railwayResponse.status,
        progress: 0,
        url,
        message: railwayResponse.message,
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
      console.error('Railway service error:', errorText);
      return NextResponse.json(
        { error: 'Ingestion service unavailable' },
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
