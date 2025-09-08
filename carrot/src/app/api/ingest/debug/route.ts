import { NextResponse } from 'next/server';
import { listJobs } from '@/lib/ingestJobs';

export const runtime = 'nodejs';

export async function GET(_req: Request, _ctx: { params: Promise<{}> }) {
  const jobs = await listJobs();
  return NextResponse.json({
    ok: true,
    count: jobs.length,
    pid: process.pid,
    uptimeSec: Math.floor(process.uptime()),
    jobs,
  });
}
