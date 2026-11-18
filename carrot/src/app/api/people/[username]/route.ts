import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import prisma from '../../../../lib/prisma'
import { auth } from '@/auth'
import { projectPost } from '../../posts/_project'

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function followingIds(meta: Record<string, unknown>): string[] {
  return Array.isArray(meta.following) ? meta.following.map(String) : []
}

async function findPerson(username: string) {
  return prisma.user.findFirst({
    where: { username },
    select: {
      id: true,
      name: true,
      username: true,
      profilePhoto: true,
      image: true,
      metadata: true
    }
  })
}

const remembered = new Map<string, { until: number; body: unknown }>()

function recall(key: string) {
  const hit = remembered.get(key)
  if (!hit) return null
  if (hit.until < Date.now()) {
    remembered.delete(key)
    return null
  }
  return hit.body
}

function remember(key: string, body: unknown, ms: number) {
  remembered.set(key, { until: Date.now() + ms, body })
}

function cardOf(person: NonNullable<Awaited<ReturnType<typeof findPerson>>>, following: boolean, isSelf: boolean) {
  const meta = asRecord(person.metadata)
  return {
    id: person.id,
    name: person.name,
    username: person.username,
    avatar: person.profilePhoto || person.image,
    banner: typeof meta.banner === 'string' ? meta.banner : null,
    bio: typeof meta.bio === 'string' ? meta.bio : '',
    disclosure: typeof meta.botDisclosure === 'string' ? meta.botDisclosure : '',
    followerCount: typeof meta.followerCount === 'number' ? meta.followerCount : 0,
    following,
    isSelf
  }
}

export async function GET(req: Request, ctx: { params: Promise<{ username: string }> }) {
  const { username } = await ctx.params
  const handle = decodeURIComponent(username)
  const part = new URL(req.url).searchParams.get('part') || 'all'
  const session = await auth()
  const viewerId = (session as { user?: { id?: string } } | null)?.user?.id || ''
  const cacheKey = `${part}:${handle}:${viewerId}`
  const cached = recall(cacheKey)
  if (cached) return NextResponse.json(cached)

  const person = await findPerson(handle)
  if (!person) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  let following = false
  if (viewerId && viewerId !== person.id) {
    const viewer = await prisma.user.findUnique({ where: { id: viewerId }, select: { metadata: true } })
    following = followingIds(asRecord(viewer?.metadata)).includes(person.id)
  }
  const card = cardOf(person, following, viewerId === person.id)
  if (part === 'card') {
    remember(cacheKey, card, 60_000)
    return NextResponse.json(card)
  }
  const rows = await prisma.post.findMany({
    where: { userId: person.id },
    orderBy: { createdAt: 'desc' },
    take: 12,
    select: {
      id: true,
      content: true,
      createdAt: true,
      imageUrls: true,
      gifUrl: true,
      videoUrl: true,
      thumbnailUrl: true,
      audioUrl: true,
      gradientFromColor: true,
      gradientToColor: true,
      gradientViaColor: true,
      gradientDirection: true,
      userId: true,
      _count: { select: { likes: true, comments: true } }
    }
  })
  const posts = rows.map((row) => projectPost({
    ...row,
    User: {
      id: person.id,
      name: person.name,
      username: person.username,
      profilePhoto: person.profilePhoto,
      image: person.image
    }
  }))
  if (part === 'posts') {
    const body = { posts }
    remember(cacheKey, body, 20_000)
    return NextResponse.json(body)
  }
  const body = { ...card, posts }
  remember(cacheKey, body, 20_000)
  return NextResponse.json(body)
}

export async function POST(_req: Request, ctx: { params: Promise<{ username: string }> }) {
  const session = await auth()
  const viewerId = (session as { user?: { id?: string } } | null)?.user?.id
  if (!viewerId) return NextResponse.json({ error: 'Sign in to follow' }, { status: 401 })
  const { username } = await ctx.params
  const person = await findPerson(decodeURIComponent(username))
  if (!person) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (person.id === viewerId) return NextResponse.json({ error: 'That is you' }, { status: 400 })
  const viewer = await prisma.user.findUnique({ where: { id: viewerId }, select: { metadata: true } })
  const meta = asRecord(viewer?.metadata)
  const current = followingIds(meta)
  const has = current.includes(person.id)
  const next = has ? current.filter((id) => id !== person.id) : [...current, person.id]
  const targetMeta = asRecord(person.metadata)
  const count = typeof targetMeta.followerCount === 'number' ? targetMeta.followerCount : 0
  await prisma.$transaction([
    prisma.user.update({
      where: { id: viewerId },
      data: { metadata: { ...meta, following: next } as Prisma.InputJsonValue }
    }),
    prisma.user.update({
      where: { id: person.id },
      data: { metadata: { ...targetMeta, followerCount: Math.max(0, count + (has ? -1 : 1)) } as Prisma.InputJsonValue }
    })
  ])
  remembered.clear()
  return NextResponse.json({ following: !has })
}
