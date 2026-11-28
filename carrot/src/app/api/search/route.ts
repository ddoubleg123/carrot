import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { auth } from '@/auth';
import { askId, interestGroups } from '@/lib/interestCatalog';
import { readInterestText } from '@/lib/readInterest';
import { loadFeedRank } from '@/lib/feedRankStore';
import { recordSearch } from '@/lib/recordInterest';
import { parseFeedPost } from '@/lib/feedPost';
import { exactHit, searchNeedles } from '@/lib/searchText';
import { postCardImage } from '@/lib/portraitImage';
import { knownCover, portraitCover } from '@/lib/groups/cover';

function coverOf(patch: { handle: string; entity?: unknown }) {
  return knownCover(patch.entity) || portraitCover(patch.handle) || '';
}

function snippet(text: string, max = 220) {
  const clean = (text || '').replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  const last = cut.lastIndexOf(' ');
  return `${(last > 80 ? cut.slice(0, last) : cut).trim()}…`;
}

function wordMatch(forms: string[], fields: string[]) {
  return {
    OR: forms.flatMap((form) => fields.map((field) => ({
      [field]: { contains: form, mode: 'insensitive' as const }
    })))
  };
}

function textWhere(query: string, fields: string[]) {
  const needles = searchNeedles(query);
  if (!needles.length) return null;
  return { AND: needles.map((forms) => wordMatch(forms, fields)) };
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = (url.searchParams.get('q') || '').trim().slice(0, 80);
  const author = (url.searchParams.get('author') || '').trim().replace(/^@/, '').slice(0, 40);

  try {
    if (!q && !author) {
      const patches = await prisma.patch.findMany({
        orderBy: { createdAt: 'desc' },
        take: 8,
        select: { id: true, handle: true, title: true, tagline: true, entity: true },
      });
      return NextResponse.json({
        people: [],
        posts: [],
        recent: true,
        patches: patches.map((patch) => ({
          id: patch.id,
          handle: patch.handle,
          title: patch.title,
          tagline: patch.tagline,
          image: coverOf(patch)
        }))
      });
    }

    const peopleWhere = textWhere(q, ['name', 'username']);
    const postText = textWhere(q, ['content', 'carrotText', 'stickText']);
    const patchWhere = textWhere(q, ['title', 'handle', 'tagline', 'description']);
    const postWhere = !q && author
      ? { User: { username: { equals: author, mode: 'insensitive' as const } } }
      : postText
        ? {
            AND: [
              ...(author ? [{ User: { username: { equals: author, mode: 'insensitive' as const } } }] : []),
              postText,
            ],
          }
        : null;

    const [people, posts, patches] = await Promise.all([
      author || !peopleWhere
        ? Promise.resolve([])
        : prisma.user.findMany({
            where: peopleWhere,
            select: { id: true, name: true, username: true, image: true, profilePhoto: true },
            take: 8,
          }),
      postWhere
        ? prisma.post.findMany({
            where: postWhere,
            orderBy: { createdAt: 'desc' },
            take: 24,
            select: {
              id: true,
              content: true,
              createdAt: true,
              thumbnailUrl: true,
              imageUrls: true,
              User: { select: { name: true, username: true, image: true, profilePhoto: true } },
            },
          })
        : Promise.resolve([]),
      author || !patchWhere
        ? Promise.resolve([])
        : prisma.patch.findMany({
            where: patchWhere,
            take: 8,
            select: { id: true, handle: true, title: true, tagline: true, entity: true },
          }),
    ]);

    if (q.length >= 3) {
      void auth().then(async (session) => {
        const userId = session?.user?.id;
        if (!userId) return;
        const rank = await loadFeedRank().catch(() => null);
        const reading = readInterestText(q, interestGroups(rank?.extraTerms || {}));
        const bucket = reading.matches[0]?.id || askId(q);
        await recordSearch(userId, bucket);
      }).catch((error) => console.error('[interest] search', error instanceof Error ? error.message : error));
    }

    const ranked = [...posts].sort((left, right) => {
      const leftHit = exactHit(left.content, q) ? 1 : 0;
      const rightHit = exactHit(right.content, q) ? 1 : 0;
      if (leftHit !== rightHit) return rightHit - leftHit;
      return +new Date(right.createdAt) - +new Date(left.createdAt);
    }).slice(0, 12);

    return NextResponse.json({
      recent: false,
      people,
      patches: patches.map((patch) => ({
        id: patch.id,
        handle: patch.handle,
        title: patch.title,
        tagline: patch.tagline,
        image: coverOf(patch)
      })),
      posts: ranked.map((post) => ({
        id: post.id,
        content: snippet(parseFeedPost(post.content).note || post.content),
        image: postCardImage(post),
        createdAt: post.createdAt,
        author: post.User,
      })),
    });
  } catch (error) {
    console.error('[api/search]', error instanceof Error ? error.message : 'failed');
    return NextResponse.json({ people: [], posts: [], patches: [], error: 'Search is unavailable right now.' }, { status: 500 });
  }
}
