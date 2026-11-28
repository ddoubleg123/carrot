import Link from 'next/link'
import { notFound } from 'next/navigation'
import MinimalNav from '@/components/MinimalNav'
import { curatorAllowed } from '@/lib/curator/access'
import { GROUP_INDEX } from '@/lib/curator/groupIndex'
import { readyLink, readyTitle, readyType, type ReadyGroup, type ReadyItem } from '@/lib/curator/ready'
import prisma from '@/lib/prisma'
import ReadyBoard from './ReadyBoard'

export const dynamic = 'force-dynamic'

export default async function ReadyAdminPage() {
  if (!(await curatorAllowed())) notFound()
  const since = new Date(Date.now() - 72 * 60 * 60 * 1000)
  const posts = await prisma.post.findMany({
    where: { bucket: { not: null }, createdAt: { gte: since } },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      content: true,
      bucket: true,
      createdAt: true,
      videoUrl: true,
      videoPath: true,
      audioUrl: true,
      imageUrls: true,
      gifUrl: true,
      thumbnailUrl: true
    }
  })
  const known = new Set(GROUP_INDEX.map((desk) => desk.id))
  const extras: ReadyGroup[] = []
  const items: ReadyItem[] = posts.flatMap((post) => {
    const groupId = post.bucket || ''
    if (!groupId) return []
    if (!known.has(groupId)) {
      known.add(groupId)
      extras.push({ id: groupId, name: groupId })
    }
    return [{
      id: post.id,
      groupId,
      at: post.createdAt.toISOString(),
      type: readyType(post),
      title: readyTitle(post.content),
      url: readyLink(post.content)
    }]
  })
  const groups: ReadyGroup[] = [
    ...GROUP_INDEX,
    ...extras
  ].sort((a, b) => a.name.localeCompare(b.name))
  return (
    <div className="flex min-h-screen bg-[#F6F3EE]">
      <aside className="sticky top-0 h-screen w-20 shrink-0 self-start border-r border-[#E6E8EC] bg-[#FAFAF8]">
        <MinimalNav />
      </aside>
      <main className="min-w-0 flex-1 px-6 pt-10 pb-16">
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#FF6A00]">Admin</p>
        <h1 className="mt-2 text-[1.7rem] font-semibold tracking-tight text-[#0B0B0F]">What the groups have</h1>
        <p className="mt-2 max-w-[640px] text-sm text-[#57534E]">
          Posts the bots have saved. A person&apos;s own post is still shown first in the feed. This is every group, and what it has by type.
        </p>
        <p className="mt-3 text-sm"><Link href="/admin" className="text-[#FF6A00] underline">All tools</Link></p>
        <ReadyBoard groups={groups} items={items} now={Date.now()} />
      </main>
    </div>
  )
}
