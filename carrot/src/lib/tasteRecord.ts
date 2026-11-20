import prisma from '@/lib/prisma'
import { emptyTaste, parseTaste, setMark, subjectOf, TASTE_HOURS, type TasteMark, type TasteState } from '@/lib/taste'

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

async function saveTaste(userId: string, taste: TasteState) {
  const body = JSON.stringify(taste)
  await prisma.$executeRaw`
    UPDATE "User"
    SET metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{taste}', ${body}::jsonb, true)
    WHERE id = ${userId}
  `
}

async function foldLikes(userId: string): Promise<TasteState> {
  const likes = await prisma.postLike.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 400,
    select: {
      postId: true,
      post: { select: { userId: true, User: { select: { username: true } } } }
    }
  })
  let taste = { ...emptyTaste(), seeded: true }
  for (const like of likes.reverse()) {
    if (!like.post || like.post.userId === userId) continue
    const subject = subjectOf(like.post.User?.username, like.post.userId)
    taste = setMark(taste, subject, like.postId, 'carrot')
  }
  taste.seeded = true
  return taste
}

export async function tasteForViewer(userId: string, metadata: unknown): Promise<TasteState> {
  const parsed = parseTaste(asRecord(metadata).taste)
  if (parsed.seeded) return parsed
  const taste = await foldLikes(userId)
  await saveTaste(userId, taste)
  return taste
}

export async function recordTaste(userId: string, postId: string, mark: TasteMark | null) {
  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: { userId: true, User: { select: { username: true } } }
  })
  if (!post || post.userId === userId) return
  const viewer = await prisma.user.findUnique({ where: { id: userId }, select: { metadata: true } })
  let taste = parseTaste(asRecord(viewer?.metadata).taste)
  const seededNow = !taste.seeded
  if (seededNow) taste = await foldLikes(userId)
  if (!(seededNow && (mark === 'carrot' || mark === null))) {
    taste = setMark(taste, subjectOf(post.User?.username, post.userId), postId, mark)
  }
  taste.seeded = true
  await saveTaste(userId, taste)
}

export async function markOn(userId: string, postId: string): Promise<TasteMark | null> {
  const viewer = await prisma.user.findUnique({ where: { id: userId }, select: { metadata: true } })
  const taste = parseTaste(asRecord(viewer?.metadata).taste)
  return taste.marks.find((item) => item.id === postId)?.mark || null
}

