import { NextResponse } from 'next/server';
import { updateJob } from '@/lib/ingestJobs';

const WORKER_SECRET = process.env.INGEST_WORKER_SECRET ?? 'dev_ingest_secret';

export const runtime = 'nodejs';

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
      secret 
    } = body;

    // Validate worker secret
    if (secret !== WORKER_SECRET) {
      console.warn('[callback] Invalid worker secret');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
      channel
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

    const updatedJob = await updateJob(jobId, updateData);
    
    if (!updatedJob) {
      console.error(`[callback] Job ${jobId} not found`);
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    console.log(`[callback] Successfully updated job ${jobId}`);
    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('[callback] Error processing callback:', error);
    return NextResponse.json(
      { error: 'Failed to process callback' },
      { status: 500 }
    );
  }
}

