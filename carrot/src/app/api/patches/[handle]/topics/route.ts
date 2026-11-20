import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import prisma from '@/lib/prisma'
import { createTopic, fillTopicPhotos, listTopics, topicPath, widenTopics } from '@/lib/learn/topic'
import { showFollowers } from '@/lib/activityFeed'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

async function groupFor(handle: string, userId: string) {
  const patch = await prisma.patch.findUnique({
    where: { handle },
    select: { id: true, title: true, createdBy: true }
  })
  if (!patch) return { error: NextResponse.json({ error: 'Group not found' }, { status: 404 }) }
  if (patch.createdBy === userId) return { patch }
  const member = await prisma.patchMember.findUnique({
    where: { patch_user_member_unique: { patchId: patch.id, userId } },
    select: { id: true }
  })
  if (!member) return { error: NextResponse.json({ error: 'Permission denied' }, { status: 403 }) }
  return { patch }
}

async function displayName(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, username: true }
  })
  return user?.name || user?.username || 'Member'
}

export async function GET(request: Request, { params }: { params: Promise<{ handle: string }> }) {
  const session = await auth()
  const { handle } = await params
  const patch = await prisma.patch.findUnique({
    where: { handle },
    select: { id: true, title: true }
  })
  if (!patch) return NextResponse.json({ error: 'Group not found' }, { status: 404 })
  const topics = await listTopics(patch.id, session?.user?.id || '')
  if (handle === 'ai') {
    const alias = await prisma.patch.findUnique({ where: { handle: 'wire-model-policy' }, select: { id: true } })
    if (alias) {
      const extra = await listTopics(alias.id, session?.user?.id || '')
      const seen = new Set(topics.map((topic) => topic.slug || topic.question))
      topics.push(...extra.filter((topic) => !seen.has(topic.slug || topic.question)))
    }
  }
  const url = new URL(request.url)
  if (url.searchParams.get('photos') === '1') {
    const withPhotos = await fillTopicPhotos(patch.id, patch.title, topics)
    return NextResponse.json({ topics: withPhotos })
  }
  if (url.searchParams.get('fill') !== '1') return NextResponse.json({ topics })
  const filled = await widenTopics(patch.id, patch.title, topics, url.searchParams.get('topic') || '')
  return NextResponse.json({ topics: filled })
}

export async function POST(request: Request, { params }: { params: Promise<{ handle: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { handle } = await params
  const access = await groupFor(handle, session.user.id)
  if (access.error) return access.error
  const body = await request.json().catch(() => ({}))
  const question = typeof body?.question === 'string' ? body.question.trim() : ''
  if (question.length < 8) return NextResponse.json({ error: 'Ask a fuller question.' }, { status: 400 })
  const topic = await createTopic({
    patchId: access.patch.id,
    question,
    groupTitle: access.patch.title,
    adminId: session.user.id,
    adminName: await displayName(session.user.id)
  })
  await showFollowers(session.user.id, `Asked on ${access.patch.title}: ${question} ${topicPath(handle, topic.slug)}`)
  return NextResponse.json({ topic })
}
