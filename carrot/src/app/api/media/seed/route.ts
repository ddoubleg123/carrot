import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { createMedia } from '@/lib/mediaServer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET/POST /api/media/seed
// Inserts a few demo MediaAsset rows for the signed-in user so the gallery has data.
export async function GET(req: Request) {
  return POST(req);
}

export async function POST(_req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = session.user.id;

  const samples = [
    {
      type: 'image' as const,
      url: 'https://images.unsplash.com/photo-1503023345310-bd7c1de61c7d',
      thumbUrl: 'https://images.unsplash.com/photo-1503023345310-bd7c1de61c7d?auto=format&fit=crop&w=240&q=60',
      title: 'Sample Image 1',
      source: 'seed',
      labels: ['sample', 'unsplash'],
    },
    {
      type: 'image' as const,
      url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330',
      thumbUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=240&q=60',
      title: 'Sample Image 2',
      source: 'seed',
      labels: ['sample', 'portrait'],
    },
    {
      type: 'video' as const,
      url: 'https://sample-videos.com/video321/mp4/720/big_buck_bunny_720p_1mb.mp4',
      thumbUrl: 'https://peach.blender.org/wp-content/uploads/title_anouncement.jpg',
      title: 'Sample Video',
      durationSec: 10,
      source: 'seed',
      labels: ['sample', 'video'],
    },
  ];

  let created = 0;
  for (const s of samples) {
    try {
      await createMedia({ userId, ...s });
      created += 1;
    } catch (e: any) {
      // Ignore unique constraint if already inserted
      if (!String(e?.message || e).toLowerCase().includes('unique')) {
        console.error('[api/media/seed] insert failed:', e);
      }
    }
  }

  return NextResponse.json({ ok: true, created });
}
