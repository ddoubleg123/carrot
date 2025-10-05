import { NextResponse } from 'next/server';
import { indexOpenLibrary } from '@/scripts/indexers/openlibrary';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Trigger OpenLibrary indexing.
 * Optional query params:
 *  - limit (repos to index, default 20)
 *
 * Returns a summary and count of chunks (content is omitted by default).
 */
export async function POST(req: Request, context: { params: Promise<{}> }) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    const { summary /*, chunks*/ } = await indexOpenLibrary(limit);

    return NextResponse.json({ ok: true, summary });
  } catch (err: any) {
    console.error('OpenLibrary index trigger error', err);
    return NextResponse.json({ ok: false, error: err?.message || 'Indexing failed' }, { status: 500 });
  }
}
