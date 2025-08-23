import { NextRequest, NextResponse } from 'next/server';
import { listJobs } from '@/lib/ingestJobs';

export async function GET(_req: NextRequest) {
  const jobs = await listJobs();
  return NextResponse.json({
    ok: true,
    count: jobs.length,
    pid: process.pid,
    uptimeSec: Math.floor(process.uptime()),
    jobs,
  });
}
