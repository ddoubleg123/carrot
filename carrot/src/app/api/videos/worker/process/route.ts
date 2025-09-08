import { NextResponse } from 'next/server';
import { videoIngestWorker } from '@/lib/ingestWorker';

export const runtime = 'nodejs';

export async function POST(req: Request, _ctx: { params: Promise<{}> }) {
  try {
    // Simple endpoint to trigger worker processing (for development/testing)
    // In production, this would be secured or replaced with a proper job queue

    const authHeader = req.headers.get('authorization');
    const expectedToken = process.env.WORKER_SECRET || 'dev-secret';

    if (authHeader !== `Bearer ${expectedToken}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Process pending jobs
    await videoIngestWorker.processPendingJobs();

    return NextResponse.json(
      {
        success: true,
        message: 'Worker processing completed',
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('[API] Worker process error:', error);

    return NextResponse.json(
      {
        error: 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      },
      { status: 500 }
    );
  }
}
