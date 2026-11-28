import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import prisma from '@/lib/prisma'
import { parseFeedPost } from '@/lib/feedPost'
import { groupPatterns } from '@/lib/groupSearch'
import { postCardImage } from '@/lib/portraitImage'
import { backfillSearchPhotos } from '@/lib/learn/hero'

type Row = {
  id: string
  title: string
  type: string
  createdAt: Date
  handle: string
  group: string
  slug: string
  urlSlug: string
  image: string | null
}

type FeedRow = {
  id: string
  content: string
  createdAt: Date
  handle: string
  group: string
  thumbnailUrl: string | null
  imageUrls: string | null
}

function clip(text: string, max = 280) {
  const clean = text.replace(/\s+/g, ' ').trim()
  if (clean.length <= max) return clean
  const cut = clean.slice(0, max - 1)
  const last = cut.lastIndexOf(' ')
  return `${(last > 80 ? cut.slice(0, last) : cut).trim()}…`
}

function andPatterns(columns: Prisma.Sql[], patterns: string[]) {
  const checks = patterns.map((pattern) => {
    const hits = columns.map((column) => Prisma.sql`${column} ~* ${pattern}`)
    return Prisma.sql`(${Prisma.join(hits, ' OR ')})`
  })
  return Prisma.join(checks, ' AND ')
}

function showImage(image: string, local: boolean, pageUrl = ''): string {
  if (!local || !image.startsWith('/curator-thumbs/')) return image
  if (!/^https?:\/\//i.test(pageUrl)) return ''
  return `/api/internal/preview-image?url=${encodeURIComponent(pageUrl)}&file=1`
}

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get('q')?.trim().slice(0, 80) || ''
  const local = /^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(req.headers.get('host') || '')
  const patterns = groupPatterns(q, 'sql')
  if (!patterns.length) return NextResponse.json({ posts: [] })

  try {
    const topicWhere = andPatterns(
      [Prisma.sql`d.title`, Prisma.sql`COALESCE(d.summary, '')`, Prisma.sql`left(COALESCE(d.text_content, ''), 4000)`],
      patterns
    )
    const postWhere = andPatterns([Prisma.sql`posts.content`], patterns)
    const [topics, feeds] = await Promise.all([
      prisma.$queryRaw<Row[]>`
        SELECT d.id, d.title, d.type, d.created_at AS "createdAt",
          p.handle, p.title AS "group",
          COALESCE(d.metadata->>'slug', '') AS slug,
          COALESCE(d.metadata->>'urlSlug', '') AS "urlSlug",
          COALESCE(
            NULLIF(d.metadata->>'image', ''),
            (
              SELECT NULLIF(elem->>'image', '')
              FROM jsonb_array_elements(
                CASE WHEN jsonb_typeof(d.metadata->'sources') = 'array' THEN d.metadata->'sources' ELSE '[]'::jsonb END
              ) elem
              WHERE NULLIF(elem->>'image', '') IS NOT NULL
              LIMIT 1
            )
          ) AS image
        FROM discovered_content d
        JOIN patches p ON p.id = d.patch_id
        WHERE d.type IN ('topic', 'article')
          AND ${topicWhere}
        ORDER BY d.created_at DESC
        LIMIT 24
      `,
      prisma.$queryRaw<FeedRow[]>`
        SELECT posts.id, posts.content, posts."createdAt" AS "createdAt",
          posts."thumbnailUrl" AS "thumbnailUrl", posts."imageUrls" AS "imageUrls",
          COALESCE(p.handle, '') AS handle,
          COALESCE(p.title, u.name, 'Group') AS "group"
        FROM posts
        JOIN "User" u ON u.id = posts."userId"
        LEFT JOIN patches p ON p.id = posts."patchId"
        WHERE ${postWhere}
        ORDER BY posts."createdAt" DESC
        LIMIT 12
      `
    ])

    const topicsOut = topics.map((row) => {
      const slug = row.type === 'topic' ? (row.slug || row.id) : ''
      const href = row.type === 'topic'
        ? `/patch/${row.handle}/${slug}`
        : row.urlSlug
          ? `/patch/${row.handle}/content/${row.urlSlug}`
          : `/patch/${row.handle}`
      return {
        id: row.id,
        href,
        group: row.group,
        text: clip(row.title),
        title: row.title,
        image: row.image || '',
        createdAt: new Date(row.createdAt).toISOString(),
        kind: row.type
      }
    })
    const photos = await backfillSearchPhotos(
      topicsOut.filter((row) => row.kind === 'topic').map((row) => ({ id: row.id, title: row.title, image: row.image }))
    ).catch(() => new Map<string, string>())
    const posts = [
      ...topicsOut.map((row) => ({
        id: row.id,
        href: row.href,
        group: row.group,
        text: row.text,
        image: photos.get(row.id) || showImage(row.image, local),
        createdAt: row.createdAt
      })),
      ...feeds.map((row) => {
        const page = parseFeedPost(row.content).url
        return {
          id: row.id,
          href: `/post/${row.id}`,
          group: row.group,
          text: clip(parseFeedPost(row.content).note || row.content),
          image: showImage(postCardImage(row), local, page),
          createdAt: new Date(row.createdAt).toISOString()
        }
      })
    ].sort((left, right) => +new Date(right.createdAt) - +new Date(left.createdAt))

    return NextResponse.json({ posts })
  } catch (error) {
    console.error('[groups/search]', error instanceof Error ? error.message : 'failed')
    return NextResponse.json({ posts: [], error: 'Search is unavailable right now.' }, { status: 500 })
  }
}
