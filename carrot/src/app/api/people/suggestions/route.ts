import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { auth } from '@/auth'
import { deskByUsername } from '@/lib/curator/desks'

function followingIds(meta: unknown): string[] {
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return []
  const following = (meta as { following?: unknown }).following
  return Array.isArray(following) ? following.map(String) : []
}

/** People who share a patch with you, and whom you do not already follow. Fewer than three means none. */
export async function GET() {
  const session = await auth()
  const viewerId = (session as { user?: { id?: string } } | null)?.user?.id
  if (!viewerId) return NextResponse.json({ people: [] })

  const viewer = await prisma.user.findUnique({ where: { id: viewerId }, select: { metadata: true } })
  const skip = new Set([viewerId, ...followingIds(viewer?.metadata)])
  const mine = await prisma.patchMember.findMany({
    where: { userId: viewerId },
    select: { patchId: true },
    take: 12,
  })
  if (mine.length === 0) return NextResponse.json({ people: [] })

  const others = await prisma.patchMember.findMany({
    where: { patchId: { in: mine.map((row) => row.patchId) }, userId: { notIn: [...skip] } },
    orderBy: { joinedAt: 'desc' },
    take: 40,
    select: {
      patch: { select: { title: true } },
      user: { select: { id: true, name: true, username: true, profilePhoto: true, image: true, email: true } },
    },
  })

  const seen = new Set<string>()
  const people: { id: string; name: string; username: string; avatar: string | null; patch: string }[] = []
  for (const row of others) {
    const user = row.user
    if (!user.username || seen.has(user.id)) continue
    if (user.email?.endsWith('@bots.carrot.invalid')) continue
    if (deskByUsername(user.username)) continue
    seen.add(user.id)
    people.push({
      id: user.id,
      name: user.name || user.username,
      username: user.username,
      avatar: user.profilePhoto || user.image || null,
      patch: row.patch.title,
    })
    if (people.length === 3) break
  }
  return NextResponse.json({ people: people.length === 3 ? people : [] })
}
