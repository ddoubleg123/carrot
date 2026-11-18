import prisma from '@/lib/prisma'
import { covers, leadToken, questionTokens } from '@/lib/learn/terms'

export { questionTokens }

export interface RankedSource {
  id: string
  title: string
  url: string
  summary: string
  patchHandle: string
  patchTitle: string
  sameGroup: boolean
  trust: number
  up: number
  down: number
  mine: 'up' | 'down' | null
}

function readVotes(metadata: unknown): { up: string[]; down: string[] } {
  const votes = metadata && typeof metadata === 'object' ? (metadata as { memberVotes?: { up?: unknown; down?: unknown } }).memberVotes : undefined
  const up = Array.isArray(votes?.up) ? votes.up.filter((id): id is string => typeof id === 'string') : []
  const down = Array.isArray(votes?.down) ? votes.down.filter((id): id is string => typeof id === 'string') : []
  return { up, down }
}

export async function findSavedAnswers(options: {
  patchId: string
  patchTitle: string
  patchHandle: string
  tags: string[]
  question: string
  userId: string
}): Promise<RankedSource[]> {
  const wanted = questionTokens(options.question, options.patchTitle)
  const tags = options.tags.filter((tag) => tag.trim().length > 0)
  const similar = tags.length
    ? await prisma.patch.findMany({
        where: { id: { not: options.patchId }, tags: { hasSome: tags } },
        select: { id: true, handle: true, title: true },
        take: 12
      })
    : []
  const groups = new Map([[options.patchId, { handle: options.patchHandle, title: options.patchTitle }]])
  for (const group of similar) groups.set(group.id, { handle: group.handle, title: group.title })

  const rows = await prisma.discoveredContent.findMany({
    where: { patchId: { in: Array.from(groups.keys()) } },
    select: {
      id: true,
      patchId: true,
      title: true,
      summary: true,
      whyItMatters: true,
      canonicalUrl: true,
      sourceUrl: true,
      metadata: true,
      createdAt: true
    },
    orderBy: { createdAt: 'desc' },
    take: 80
  })

  const ranked = rows.flatMap((row) => {
    const group = groups.get(row.patchId)
    if (!group) return []
    const summary = row.summary || row.whyItMatters || ''
    const hay = `${row.title} ${summary}`.toLowerCase()
    const matchCount = wanted.reduce((count, word) => count + (covers(hay, [word]) ? 1 : 0), 0)
    const lead = leadToken(wanted)
    const answersQuestion = covers(hay, wanted)
    const followsLead = wanted.length > 1 && lead
      ? covers(hay, [lead]) && covers(hay, [options.patchTitle.toLowerCase()])
      : false
    if (wanted.length > 0 && !answersQuestion && !followsLead) return []
    const votes = readVotes(row.metadata)
    const trust = votes.up.length - votes.down.length
    if (trust <= -2) return []
    return [{
      id: row.id,
      title: row.title,
      url: row.canonicalUrl || row.sourceUrl,
      summary,
      patchHandle: group.handle,
      patchTitle: group.title,
      sameGroup: row.patchId === options.patchId,
      trust,
      up: votes.up.length,
      down: votes.down.length,
      mine: votes.up.includes(options.userId) ? 'up' as const : votes.down.includes(options.userId) ? 'down' as const : null,
      matchCount,
      createdAt: row.createdAt.getTime()
    }]
  })

  ranked.sort((a, b) =>
    b.trust - a.trust
    || b.matchCount - a.matchCount
    || Number(b.sameGroup) - Number(a.sameGroup)
    || b.createdAt - a.createdAt
  )

  return ranked.slice(0, 8).map(({ matchCount: _matchCount, createdAt: _createdAt, ...item }) => item)
}
