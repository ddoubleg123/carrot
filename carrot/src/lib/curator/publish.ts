import { Prisma } from '@prisma/client'
import prisma from '@/lib/prisma'
import { createTopic, gatherTopicSources, topicSlug, type TopicSource } from '@/lib/learn/topic'
import { invalidateFeedCache } from '@/lib/feedCache'
import { COLOR_SCHEMES } from '@/config/colorSchemes'
import { deskDisclosure, type Desk } from '@/lib/curator/desks'
import { pageImage, readLinkCard, savePreview, youtubeThumb } from '@/lib/curator/preview'
import { articleLines } from '@/lib/feedPost'
import { youtubeIdFromText } from '@/lib/youtube'
import { feedLine, patchQuestion } from '@/lib/curator/voice'
import { sameStory } from '@/lib/curator/judge'

function sourceId(): string {
  return Math.random().toString(36).slice(2, 10)
}

function deskMeta(desk: Desk, prior: unknown) {
  const base = prior && typeof prior === 'object' && !Array.isArray(prior) ? prior as Record<string, unknown> : {}
  return {
    ...base,
    isBot: true,
    botOperator: 'Carrot',
    botDisclosure: deskDisclosure(),
    bio: desk.bio,
    banner: desk.banner
  }
}

export async function deskUser(desk: Desk) {
  const existing = await prisma.user.findFirst({
    where: {
      OR: [
        { username: desk.username },
        { username: desk.priorUsername },
        { email: `${desk.priorUsername}@bots.carrot.invalid` },
        { email: `${desk.username}@bots.carrot.invalid` }
      ]
    }
  })
  if (existing) {
    return prisma.user.update({
      where: { id: existing.id },
      data: {
        username: desk.username,
        name: desk.name,
        profilePhoto: desk.avatar,
        image: desk.avatar,
        metadata: deskMeta(desk, existing.metadata)
      }
    })
  }
  return prisma.user.create({
    data: {
      username: desk.username,
      name: desk.name,
      email: `${desk.username}@bots.carrot.invalid`,
      profilePhoto: desk.avatar,
      image: desk.avatar,
      isOnboarded: true,
      metadata: deskMeta(desk, null)
    }
  })
}

export async function openDeskPatch(desk: Desk) {
  const user = await deskUser(desk)
  return deskPatch(desk, user.id)
}

async function deskPatch(desk: Desk, userId: string) {
  const existing = await prisma.patch.findUnique({ where: { handle: desk.handle } })
  const description = `${desk.beat} ${deskDisclosure()}`
  if (existing) {
    if (existing.title !== desk.name || existing.description !== description) {
      return prisma.patch.update({
        where: { id: existing.id },
        data: { title: desk.name, description }
      })
    }
    return existing
  }
  const patch = await prisma.patch.create({
    data: {
      handle: desk.handle,
      title: desk.name,
      description: `${desk.beat} ${deskDisclosure()}`,
      createdBy: userId,
      tags: ['automated', desk.id],
      theme: 'light'
    }
  })
  await prisma.patchMember.create({
    data: { patchId: patch.id, userId, role: 'admin' }
  })
  return patch
}

export interface Published {
  topicUrl: string
  postId: string
}

function palette(key: string) {
  let n = 0
  for (const ch of key) n = (n * 33 + ch.charCodeAt(0)) >>> 0
  const colors = COLOR_SCHEMES[n % COLOR_SCHEMES.length]
  const directions = ['to bottom right', 'to right', 'to bottom', 'to top right']
  return { colors, direction: directions[n % directions.length] }
}

export async function publishFinding(desk: Desk, finding: {
  title: string
  url: string
  domain: string
  excerpt: string
  summary: string
  publisher: string
  image?: string
}): Promise<Published> {
  const note = await feedLine(desk.name, finding.title, finding.excerpt || finding.summary)
  if (!note) throw new Error('The page has no idea worth posting.')
  const user = await deskUser(desk)
  const patch = await deskPatch(desk, user.id)
  const question = await patchQuestion(desk.beat, finding.title, finding.excerpt || finding.summary)
  const slug = topicSlug(question)
  const source: TopicSource = {
    id: sourceId(),
    title: question,
    url: finding.url,
    domain: finding.domain,
    quote: finding.excerpt,
    summary: finding.summary,
    origin: 'search',
    addedBy: user.id,
    addedByName: desk.name
  }
  const rows = await prisma.discoveredContent.findMany({
    where: { patchId: patch.id, type: 'topic' },
    select: { id: true, title: true, metadata: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
    take: 40
  })
  const existing = rows.find((row) => sameStory(row.title, question) || sameStory(row.title, finding.title) || topicSlug(row.title) === slug)
  let topicId = existing?.id || ''
  if (existing?.metadata && typeof existing.metadata === 'object') {
    const meta = existing.metadata as Record<string, any>
    const sources = Array.isArray(meta.sources) ? meta.sources : []
    if (!sources.some((item: TopicSource) => item.url === source.url)) {
      meta.sources = [source, ...sources].slice(0, 24)
      await prisma.discoveredContent.update({
        where: { id: existing.id },
        data: {
          metadata: meta as Prisma.JsonObject,
          summary: `${meta.sources.length} sources`
        }
      })
    }
    topicId = existing.id
  } else {
    const gathered = await Promise.race([
      gatherTopicSources(question, desk.name).catch(() => [] as TopicSource[]),
      new Promise<TopicSource[]>((resolve) => setTimeout(() => resolve([]), 25000))
    ])
    const seeded = [source, ...gathered.filter((item) => item.url !== source.url)].slice(0, 24)
    const card = await createTopic({
      patchId: patch.id,
      question,
      groupTitle: desk.name,
      adminId: user.id,
      adminName: desk.name,
      sources: seeded
    })
    topicId = card.id
    const row = await prisma.discoveredContent.findFirst({ where: { id: card.id }, select: { metadata: true } })
    if (row?.metadata && typeof row.metadata === 'object') {
      const meta = row.metadata as Record<string, any>
      meta.note = `Opened by ${desk.name}. This account is automated. The passage is from the source, kept after the captions or the page were read.`
      await prisma.discoveredContent.update({
        where: { id: card.id },
        data: { metadata: meta as Prisma.JsonObject, textContent: meta.note }
      })
    }
  }
  const topicUrl = existing
    ? `/patch/${desk.handle}?topic=${topicSlug(existing.title)}`
    : topicId
      ? `/patch/${desk.handle}?topic=${slug}`
      : `/patch/${desk.handle}`
  const isVideo = Boolean(youtubeIdFromText(finding.url))
  const link = isVideo ? null : await readLinkCard(finding.url)
  const remote = youtubeThumb(finding.url) || finding.image || link?.image || (isVideo ? null : await pageImage(finding.url))
  const preview = remote ? await savePreview(remote, finding.url) : null
  const meta = isVideo ? '' : articleLines({ ...link, image: preview || '' })
  const content = [note, '', question, topicUrl, finding.url, meta].filter((part) => part !== '').join('\n')
  const look = palette(finding.url + desk.id)
  const post = await prisma.post.create({
    data: {
      userId: user.id,
      content,
      emoji: '▸',
      gradientDirection: look.direction,
      gradientFromColor: look.colors.gradientFromColor,
      gradientViaColor: look.colors.gradientViaColor || null,
      gradientToColor: look.colors.gradientToColor,
      imageUrls: preview ? JSON.stringify([preview]) : null,
      thumbnailUrl: preview
    }
  })
  await prisma.patchPost.create({
    data: {
      patchId: patch.id,
      authorId: user.id,
      type: 'LINK',
      title: question,
      body: finding.summary,
      url: finding.url,
      tags: ['automated', desk.id],
      metrics: { likes: 0, comments: 0, reposts: 0, views: 0 }
    }
  })
  invalidateFeedCache()
  void topicId
  return { topicUrl, postId: post.id }
}
