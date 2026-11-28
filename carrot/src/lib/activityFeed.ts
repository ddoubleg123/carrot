import prisma from '@/lib/prisma'
import { invalidateFeedCache } from '@/lib/feedCache'

/** A patch action becomes a normal post, so followers see it on the home timeline. */
export async function showFollowers(userId: string, text: string): Promise<void> {
  const content = text.replace(/\s+/g, ' ').trim().slice(0, 500)
  if (!userId || content.length < 8) return
  const handle = content.match(/\/patch\/([a-z0-9-]+)/i)?.[1]
  let patchId: string | undefined
  if (handle) {
    const patch = await prisma.patch.findUnique({ where: { handle }, select: { id: true } }).catch(() => null)
    patchId = patch?.id
  }
  try {
    await prisma.post.create({
      data: { userId, content, emoji: '▸', ...(patchId ? { patchId } : {}) }
    })
    invalidateFeedCache()
  } catch (error) {
    console.error('[activity] could not show followers', error)
  }
}
