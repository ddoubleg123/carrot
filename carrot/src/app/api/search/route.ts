import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

function snippet(text: string, max = 160) {
  const clean = (text || '').replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1)}…`;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = (url.searchParams.get('q') || '').trim().slice(0, 80);
  const author = (url.searchParams.get('author') || '').trim().replace(/^@/, '').slice(0, 40);

  try {
    if (!q && !author) {
      const patches = await prisma.patch.findMany({
        orderBy: { createdAt: 'desc' },
        take: 6,
        select: { id: true, handle: true, title: true, tagline: true },
      });
      return NextResponse.json({ people: [], posts: [], patches, recent: true });
    }

    const people = author
      ? []
      : await prisma.user.findMany({
          where: {
            OR: [
              { name: { contains: q, mode: 'insensitive' } },
              { username: { contains: q, mode: 'insensitive' } },
            ],
          },
          select: { id: true, name: true, username: true, image: true, profilePhoto: true },
          take: 8,
        });

    const posts = await prisma.post.findMany({
      where: {
        ...(author
          ? { User: { username: { equals: author, mode: 'insensitive' } } }
          : {}),
        ...(q ? { content: { contains: q, mode: 'insensitive' } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 12,
      select: {
        id: true,
        content: true,
        createdAt: true,
        User: { select: { name: true, username: true, image: true, profilePhoto: true } },
      },
    });

    const patches = author
      ? []
      : await prisma.patch.findMany({
          where: {
            OR: [
              { title: { contains: q, mode: 'insensitive' } },
              { handle: { contains: q, mode: 'insensitive' } },
              { tagline: { contains: q, mode: 'insensitive' } },
            ],
          },
          take: 8,
          select: { id: true, handle: true, title: true, tagline: true },
        });

    return NextResponse.json({
      recent: false,
      people,
      patches,
      posts: posts.map((post) => ({
        id: post.id,
        content: snippet(post.content),
        createdAt: post.createdAt,
        author: post.User,
      })),
    });
  } catch (error) {
    console.error('[api/search]', error instanceof Error ? error.message : 'failed');
    return NextResponse.json({ people: [], posts: [], patches: [], error: 'Search is unavailable right now.' }, { status: 500 });
  }
}
