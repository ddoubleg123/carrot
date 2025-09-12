import { NextResponse } from 'next/server';
import prisma from '../../../lib/prisma';
import { auth } from '../../../auth';
import { rateLimit } from '../../../lib/ratelimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function avatarForUser(u: any): string | null {
  if (!u) return null;
  if (u.profilePhotoPath) return `/api/img?path=${encodeURIComponent(u.profilePhotoPath)}`;
  if (u.profilePhoto && /^https?:\/\//i.test(u.profilePhoto)) return `/api/img?url=${encodeURIComponent(u.profilePhoto)}`;
  if (u.image && /^https?:\/\//i.test(u.image)) return `/api/img?url=${encodeURIComponent(u.image)}`;
  return u.image || u.profilePhoto || null;
}

// GET /api/comments?postId=...&sort=top|newest&cursor=...&limit=...
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const postId = searchParams.get('postId');
    const sort = (searchParams.get('sort') || 'top').toLowerCase();
    const limit = Math.max(1, Math.min(50, parseInt(searchParams.get('limit') || '20', 10) || 20));
    const cursor = searchParams.get('cursor') || undefined;
    if (!postId) return NextResponse.json([], { status: 200 });

    // For now, both 'top' and 'newest' use id-desc ordering (deterministic and cursor-friendly)
    const orderBy = { id: 'desc' as const };

    const rows = await prisma.comment.findMany({
      where: { postId },
      orderBy,
      take: limit,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      include: {
        user: {
          select: {
            id: true,
            username: true,
            image: true,
            profilePhoto: true,
            profilePhotoPath: true,
          },
        },
      },
    });

    const out = rows.map((r: any) => ({
      id: r.id,
      text: r.text,
      createdAt: r.createdAt,
      user: {
        id: r.user?.id,
        username: r.user?.username,
        avatar: avatarForUser(r.user),
      },
    }));
    const nextCursor = rows.length === limit ? rows[rows.length - 1]?.id : undefined;
    return NextResponse.json({ items: out, nextCursor });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}

// POST /api/comments { postId, content }
export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    // Basic rate limit: 5 comments / 30s per user
    const key = `cmt:${session.user.id}`;
    const rl = rateLimit(key, 5, 30_000);
    if (!rl.ok) return NextResponse.json({ error: 'Rate limit exceeded', retryAfterMs: rl.retryAfterMs }, { status: 429 });
    const body = await req.json().catch(() => ({}));
    const postId = String(body?.postId || '');
    const content = String(body?.content || '').trim();
    if (!postId) return NextResponse.json({ error: 'Missing postId' }, { status: 400 });
    if (!content) return NextResponse.json({ error: 'Empty content' }, { status: 400 });
    if (content.length > 500) return NextResponse.json({ error: 'Comment too long (max 500)' }, { status: 400 });

    // Ensure post exists (soft check)
    const postExists = await prisma.post.findUnique({ where: { id: postId }, select: { id: true } });
    if (!postExists) return NextResponse.json({ error: 'Post not found' }, { status: 404 });

    const created = await prisma.comment.create({
      data: {
        postId,
        userId: session.user.id,
        text: content,
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            image: true,
            profilePhoto: true,
            profilePhotoPath: true,
          },
        },
      },
    });

    const out = {
      id: created.id,
      text: created.text,
      createdAt: created.createdAt,
      user: {
        id: created.user?.id,
        username: created.user?.username,
        avatar: avatarForUser(created.user),
      },
    };
    return NextResponse.json(out, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}
