import { Prisma } from '@prisma/client'
import prisma from '@/lib/prisma'
import { officeHandle } from '@/lib/officeHandle'
import { sameStory } from '@/lib/curator/judge'
import type { FeedItem, Official } from '@/lib/polWatch'

const PORTRAIT = 'https://unitedstates.github.io/images/congress/225x275'

export type OfficeAccount = {
  id: string
  username: string
  photo: string
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function nameForms(name: string): string[] {
  const clean = name.replace(/^(Democrat|Republican|Democratic)\s+/i, '').trim()
  const parts = clean.split(/\s+/).filter(Boolean)
  const forms = [clean]
  if (parts.length > 2) forms.push(`${parts[0]} ${parts[parts.length - 1]}`)
  return forms
}

async function wikiPortrait(name: string): Promise<string> {
  for (const form of nameForms(name)) {
    const title = encodeURIComponent(form.replace(/ /g, '_'))
    const res = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${title}`, {
      headers: { 'User-Agent': 'Carrot/1.0 (public office profile)' },
      signal: AbortSignal.timeout(8000)
    }).catch(() => null)
    if (!res?.ok) continue
    const data = await res.json().catch(() => null)
    const src = data?.originalimage?.source || data?.thumbnail?.source
    if (typeof src === 'string' && src.startsWith('https://upload.wikimedia.org/')) return src
  }
  return ''
}

async function portraitOf(person: Official): Promise<string> {
  if (/^[A-Za-z]\d{6}$/.test(person.id)) {
    const url = `${PORTRAIT}/${person.id}.jpg`
    const res = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(8000) }).catch(() => null)
    if (res?.ok) return url
  }
  return wikiPortrait(person.name)
}

function officeMeta(person: Official, photo: string, prior: unknown) {
  const base = asRecord(prior)
  const party = person.party ? `, ${person.party}` : ''
  return {
    ...base,
    officeId: person.id,
    bio: `${person.office}${party}.`,
    botDisclosure: 'Bills, hearings, and news about this office, taken from the public record. This person does not write these posts.',
    banner: photo || (typeof base.banner === 'string' ? base.banner : '')
  }
}

export async function ensureOffices(people: Official[]): Promise<Map<string, OfficeAccount>> {
  const accounts = new Map<string, OfficeAccount>()
  await Promise.all(people.map(async (person) => {
    const username = officeHandle(person.id)
    const existing = await prisma.user.findUnique({ where: { username } })
    const prior = asRecord(existing?.metadata)
    if (
      existing
      && existing.name === person.name
      && typeof existing.profilePhoto === 'string'
      && existing.profilePhoto.startsWith('https://')
      && prior.officeId === person.id
    ) {
      accounts.set(person.id, { id: existing.id, username, photo: existing.profilePhoto })
      return
    }
    const photo = (typeof existing?.profilePhoto === 'string' && existing.profilePhoto.startsWith('https://'))
      ? existing.profilePhoto
      : await portraitOf(person)
    const metadata = officeMeta(person, photo, prior) as Prisma.InputJsonValue
    const saved = existing
      ? await prisma.user.update({
        where: { id: existing.id },
        data: {
          name: person.name,
          profilePhoto: photo || existing.profilePhoto,
          image: photo || existing.image,
          metadata
        }
      })
      : await prisma.user.create({
        data: {
          username,
          name: person.name,
          email: `${username}@office.carrot.invalid`,
          profilePhoto: photo || null,
          image: photo || null,
          isOnboarded: true,
          metadata
        }
      })
    accounts.set(person.id, { id: saved.id, username, photo: photo || '' })
  }))
  return accounts
}

export function attachProfiles(people: Official[], accounts: Map<string, OfficeAccount>): Official[] {
  return people.map((person) => {
    const account = accounts.get(person.id)
    return account ? { ...person, photo: account.photo, username: account.username } : person
  })
}

export async function followOffices(viewerId: string, accounts: OfficeAccount[]) {
  if (!accounts.length) return
  const viewer = await prisma.user.findUnique({ where: { id: viewerId }, select: { metadata: true } })
  const meta = asRecord(viewer?.metadata)
  const current = Array.isArray(meta.following) ? meta.following.map(String) : []
  const missing = accounts.filter((account) => account.id !== viewerId && !current.includes(account.id))
  if (!missing.length) return
  const rows = await prisma.user.findMany({
    where: { id: { in: missing.map((account) => account.id) } },
    select: { id: true, metadata: true }
  })
  await prisma.$transaction([
    prisma.user.update({
      where: { id: viewerId },
      data: { metadata: { ...meta, following: [...current, ...missing.map((account) => account.id)] } as Prisma.InputJsonValue }
    }),
    ...rows.map((row) => {
      const prior = asRecord(row.metadata)
      const count = typeof prior.followerCount === 'number' ? prior.followerCount : 0
      return prisma.user.update({
        where: { id: row.id },
        data: { metadata: { ...prior, followerCount: count + 1 } as Prisma.InputJsonValue }
      })
    })
  ])
}

function thinOfficeLine(body: string): boolean {
  if (/x\.com|twitter\.com|facebook\.com|instagram\.com/i.test(body)) return true
  const title = body.split('\n')[0].trim()
  if (title.length < 40) return true
  if (/^(thank you|thanks\b|honored\b|proud to|happy |congratulations)/i.test(title)) return true
  return false
}

export async function settleOfficePosts(viewerId: string, people: Official[], accounts: Map<string, OfficeAccount>) {
  const posts = await prisma.post.findMany({
    where: { userId: viewerId, createdAt: { gte: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000) } },
    select: { id: true, content: true },
    take: 80
  })
  let changed = false
  for (const post of posts) {
    const content = post.content || ''
    const person = people.find((item) => content.startsWith(`${item.name}: `))
    const account = person && accounts.get(person.id)
    if (!person || !account) continue
    const body = content.slice(person.name.length + 2)
    if (thinOfficeLine(body)) {
      await prisma.post.delete({ where: { id: post.id } }).catch(() => null)
      changed = true
      continue
    }
    await prisma.post.update({
      where: { id: post.id },
      data: { userId: account.id, content: body }
    })
    changed = true
  }
  return changed
}

export async function collapseOfficePosts(accounts: OfficeAccount[]) {
  let changed = false
  for (const account of accounts) {
    const posts = await prisma.post.findMany({
      where: { userId: account.id, createdAt: { gte: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) } },
      select: { id: true, content: true },
      orderBy: { createdAt: 'desc' },
      take: 30
    })
    const kept: string[] = []
    for (const post of posts) {
      const title = (post.content || '').split('\n')[0]
      if (kept.some((item) => sameStory(item, title))) {
        await prisma.post.delete({ where: { id: post.id } }).catch(() => null)
        changed = true
      } else if (title) {
        kept.push(title)
      }
    }
  }
  return changed
}

export function worthSharing(item: FeedItem): boolean {
  if (item.kind !== 'bill' && item.kind !== 'hearing' && item.kind !== 'news') return false
  if (!/^https?:\/\//i.test(item.url || '')) return false
  if (/x\.com|twitter\.com|facebook\.com|instagram\.com/i.test(item.url)) return false
  const title = item.title.replace(/\s+/g, ' ').trim()
  if (title.length < 40) return false
  if (/^(thank you|thanks\b|honored\b|proud to|happy |congratulations)/i.test(title)) return false
  return true
}

export function storyText(item: FeedItem): string {
  const detail = item.detail && item.detail !== item.title ? `${item.detail}\n` : ''
  const source = item.source ? `${item.source}\n` : ''
  return `${item.title}\n${detail}${source}${item.url}`.slice(0, 2000)
}
