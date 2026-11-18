import { Prisma } from '@prisma/client'
import prisma from '@/lib/prisma'
import { canonicalizeUrlFast, getDomainFromUrl } from '@/lib/discovery/canonicalize'
import { articleSummary } from '@/lib/learn/articleText'

export interface LearnedSourceInput {
  patchId: string
  title: string
  url: string
  text: string
  summary?: string
  type: 'article' | 'pdf'
  category: 'wikipedia' | 'reference' | 'link'
  heroUrl?: string | null
}

function clip(value: string, max: number): string {
  const clean = value.replace(/\s+/g, ' ').trim()
  return clean.length > max ? `${clean.slice(0, max - 1).trim()}…` : clean
}

function keepBreaks(value: string, max: number): string {
  const clean = value
    .replace(/\r\n/g, '\n')
    .replace(/[^\S\n]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  return clean.length > max ? clean.slice(0, max).trim() : clean
}

function slugFor(title: string): string {
  const base = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'source'
  return `${base}-${Math.random().toString(36).slice(2, 8)}`
}

export async function saveLearnedSource(input: LearnedSourceInput): Promise<{ id: string; title: string; url: string; summary: string }> {
  const canonicalUrl = canonicalizeUrlFast(input.url) || input.url
  const text = keepBreaks(input.text, 20000)
  const summary = clip(articleSummary(input.summary || text) || input.summary || text, 600)
  const title = clip(input.title, 180) || 'Untitled source'
  const existing = await prisma.discoveredContent.findFirst({
    where: { patchId: input.patchId, canonicalUrl },
    select: { id: true, metadata: true }
  })

  const previousSlug = existing && existing.metadata && typeof existing.metadata === 'object'
    ? (existing.metadata as { urlSlug?: string }).urlSlug
    : undefined
  const urlSlug = previousSlug || slugFor(title)
  const metadata = {
    urlSlug,
    source: 'learn',
    category: input.category,
    storedAt: new Date().toISOString()
  } as Prisma.JsonObject

  const data = {
    title,
    summary,
    whyItMatters: clip(summary, 180),
    textContent: text,
    content: text,
    sourceUrl: input.url,
    canonicalUrl,
    domain: getDomainFromUrl(canonicalUrl),
    type: input.type,
    category: input.category,
    relevanceScore: input.category === 'wikipedia' ? 0.9 : 0.6,
    qualityScore: text.length > 200 ? 0.7 : 0.3,
    provenance: [input.url] as Prisma.JsonArray,
    hero: input.heroUrl ? ({ url: input.heroUrl, source: 'wikimedia' } as Prisma.JsonObject) : Prisma.JsonNull,
    metadata,
    isUseful: text.length > 40,
    lastCrawledAt: new Date()
  }

  const saved = existing
    ? await prisma.discoveredContent.update({ where: { id: existing.id }, data, select: { id: true, title: true, canonicalUrl: true } })
    : await prisma.discoveredContent.create({
        data: { patchId: input.patchId, ...data },
        select: { id: true, title: true, canonicalUrl: true }
      })

  return { id: saved.id, title: saved.title, url: saved.canonicalUrl, summary }
}
