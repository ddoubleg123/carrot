import { NextResponse } from 'next/server';
import { listSources } from '@/lib/sources/registry';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request, context: { params: Promise<{}> }) {
  try {
    const sources = listSources();
    return NextResponse.json({ ok: true, sources });
  } catch (err) {
    console.error('Sources registry error', err);
    return NextResponse.json({ ok: false, error: 'Failed to load sources registry' }, { status: 500 });
  }
}
