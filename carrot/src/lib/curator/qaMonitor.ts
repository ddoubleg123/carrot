import prisma from '@/lib/prisma'
import { linkResolves } from '@/lib/curator/qa'
import { logQa, recentQa } from '@/lib/curator/qaLog'

let lastRun = 0

function linkIn(content: string): string {
  const match = String(content || '').match(/https?:\/\/\S+/)
  return match ? match[0].replace(/[),.;]+$/, '') : ''
}

/**
 * Re-check live bot posts on the hunt's existing pass.
 * This does not start a second timer. It runs at most once an hour.
 */
export async function runQaMonitor(): Promise<void> {
  if (Date.now() - lastRun < 60 * 60 * 1000) return
  lastRun = Date.now()
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const posts = await prisma.post.findMany({
    where: { bucket: { not: null }, createdAt: { gte: since } },
    orderBy: { createdAt: 'desc' },
    take: 40,
    select: { id: true, content: true, createdAt: true, editedAt: true }
  }).catch(() => [])
  for (const post of posts) {
    const age = Date.now() - post.createdAt.getTime()
    const young = age < 48 * 60 * 60 * 1000
    if (!young && post.editedAt && Date.now() - post.editedAt.getTime() < 24 * 60 * 60 * 1000) continue
    const url = linkIn(post.content || '')
    if (!url) continue
    if (await linkResolves(url)) continue
    if (String(post.content || '').includes('Updated: the source page is gone.')) continue
    const when = new Date().toISOString().slice(0, 10)
    const line = `\n\nUpdated ${when}: the source page is gone.`
    await prisma.post.update({
      where: { id: post.id },
      data: { content: `${post.content}${line}`, editedAt: new Date() }
    }).catch(() => null)
    await logQa({ kind: 'correction', severity: 2, postId: post.id, sourceUrl: url, reason: 'The source link no longer resolves.' })
  }
  const open = await recentQa(14)
  const closed = new Set(open.filter((row) => row.kind === 'timeout').map((row) => row.reason))
  for (const hold of open) {
    if (hold.kind !== 'hold') continue
    if (Date.now() - new Date(hold.createdAt).getTime() < 2 * 60 * 60 * 1000) continue
    if (closed.has(hold.id)) continue
    await logQa({ kind: 'timeout', severity: 1, sourceUrl: hold.sourceUrl || '', reason: hold.id })
  }
}
