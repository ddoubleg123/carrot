import { mkdir, writeFile } from 'fs/promises'
import path from 'path'
import { Prisma } from '@prisma/client'
import prisma from '@/lib/prisma'
import { assertPublicUrl, PublicUrlError, readPublicUrl, textFromPdf } from '@/lib/learn/publicUrl'
import { formatArticle } from '@/lib/learn/articleText'
import { lookupWikipedia } from '@/lib/learn/wikipedia'
import { pageThumbnail, pageThumbnails } from '@/lib/learn/hero'
import { bridgeTerms, covers, leadToken, plainSentences, questionTokens, searchWord } from '@/lib/learn/terms'
import { describePassage, explainPhotograph, lookupStatusPhoto, splitReading, statusPhotoTarget } from '@/lib/learn/readPhoto'
import { readXPost } from '@/lib/learn/xPost'
import { searchScholarly } from '@/lib/learn/beyond'
import { searchPosts } from '@/lib/learn/xSearch'

export interface TopicSource {
  id: string
  title: string
  url: string
  domain: string
  quote: string
  image?: string
  video?: string
  cfUid?: string
  summary?: string
  origin: 'search' | 'member'
  addedBy: string
  addedByName: string
  up?: string[]
  down?: string[]
  upCount?: number
  downCount?: number
  mine?: '' | 'up' | 'down'
  postedByMe?: boolean
  notes?: TopicNote[]
}

export interface TopicNote {
  id: string
  text: string
  name: string
  at: string
}

export interface TopicMessage {
  id: string
  role: 'user' | 'assistant'
  name: string
  text: string
  sourceIds: string[]
  createdAt: string
}

export interface TopicReply {
  id: string
  userId: string
  name: string
  text: string
  createdAt: string
}

export interface TopicSpoken {
  state: 'pending' | 'ready' | 'silent' | 'failed'
  text: string
  at: string
}

export interface TopicCard {
  id: string
  question: string
  adminId: string
  adminName: string
  note: string
  isAdmin: boolean
  sources: TopicSource[]
  unrelated: TopicSource[]
  replies: TopicReply[]
  image: string | null
  pending: TopicSource[]
  messages: TopicMessage[]
  slug: string
  createdAt: string
  slugLocked?: boolean
}

interface TopicMeta {
  kind: 'topic'
  adminId: string
  adminName: string
  note: string
  sources: TopicSource[]
  unrelated?: TopicSource[]
  replies: TopicReply[]
  image?: string
  pending?: TopicSource[]
  skipped?: string[]
  messages?: TopicMessage[]
  slug?: string
  spoken?: Record<string, TopicSpoken>
}

function idFor(): string {
  return Math.random().toString(36).slice(2, 10)
}

export function topicSlug(question: string): string {
  const slug = question
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/['’]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/g, '')
  return slug || 'question'
}

function withSlugs(cards: TopicCard[]): TopicCard[] {
  const taken = new Set<string>()
  const assigned = new Map<string, string>()
  const byAge = (a: TopicCard, b: TopicCard) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id)
  const ordered = [...cards.filter((card) => card.slugLocked).sort(byAge), ...cards.filter((card) => !card.slugLocked).sort(byAge)]
  for (const card of ordered) {
    let slug = card.slug || topicSlug(card.question)
    if (taken.has(slug)) {
      let n = 2
      while (taken.has(`${slug}-${n}`)) n += 1
      slug = `${slug}-${n}`
    }
    taken.add(slug)
    assigned.set(card.id, slug)
  }
  return cards.map((card) => {
    const next = { ...card, slug: assigned.get(card.id) || topicSlug(card.question) }
    delete next.slugLocked
    return next
  })
}

async function nextSlug(patchId: string, question: string): Promise<string> {
  const rows = await prisma.discoveredContent.findMany({
    where: { patchId, type: 'topic' },
    select: { id: true, title: true, metadata: true, createdAt: true },
    take: 80
  })
  const taken = new Set(withSlugs(rows.flatMap((row) => {
    const card = toCard(row, '')
    return card ? [card] : []
  })).map((card) => card.slug))
  const base = topicSlug(question)
  if (!taken.has(base)) return base
  let n = 2
  while (taken.has(`${base}-${n}`)) n += 1
  return `${base}-${n}`
}

export async function topicLabel(patchId: string, key: string): Promise<{ question: string; slug: string } | null> {
  const topics = await listTopics(patchId, '')
  const found = topics.find((topic) => topic.id === key || topic.slug === key)
  return found ? { question: found.question, slug: found.slug } : null
}

function sameDocument(a: string, b: string): boolean {
  try {
    const left = new URL(a)
    const right = new URL(b)
    const host = (value: string) => value.replace(/^www\./, '').toLowerCase()
    return host(left.hostname) === host(right.hostname) && decodeURIComponent(left.pathname).replace(/\/$/, '') === decodeURIComponent(right.pathname).replace(/\/$/, '')
  } catch {
    return a.trim() === b.trim()
  }
}

function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

async function placeOnQuestion(question: string, text: string, fallback: string, hint?: { name?: string; url?: string; lookFor?: string }): Promise<{ title: string; summary?: string }> {
  const reading = await describePassage({ question, text, name: hint?.name, url: hint?.url, lookFor: hint?.lookFor }).catch(() => null)
  const title = reading?.title || contentTitle(text, fallback)
  return reading?.summary ? { title, summary: reading.summary } : { title }
}

export function contentTitle(text: string, fallback = 'Post'): string {
  const line = text
    .replace(/https?:\/\/\S+/g, ' ')
    .split(/\n+/)
    .map((part) => part.trim())
    .find((part) => part.length > 24 && !/^(what the photograph shows|why it matters)$/i.test(part))
  if (!line) return fallback
  const sentence = line.split(/(?<=[.!?])\s+/)[0] || line
  const clean = sentence.replace(/\s+/g, ' ').trim()
  return (clean.length > 90 ? `${clean.slice(0, 87).trim()}…` : clean) || fallback
}

export function readableQuote(raw: string): string {
  const paragraphs = formatArticle(raw).flatMap((block) => block.paragraphs)
  return paragraphs.join('\n\n').slice(0, 1400)
}

function focusedQuote(text: string, tokens: string[], groupTitle: string, question = '', title = ''): string {
  if (tokens.length === 0) return readableQuote(text.slice(0, 900))
  const group = groupTitle.toLowerCase()
  const sentences = plainSentences(text).filter((sentence) => tokens.some((token) => covers(sentence, [token])))
  const aboutGroup = sentences.filter((sentence) => covers(sentence, [group]))
  const source = plainSentences(text)
  const picked = (aboutGroup.length ? aboutGroup : sentences).sort((a, b) => {
    const score = (sentence: string) => tokens.filter((token) => covers(sentence, [token])).length + (covers(sentence, [group]) ? 2 : 0)
    return score(b) - score(a) || source.indexOf(a) - source.indexOf(b)
  })
  const shown = picked.slice(0, 2).flatMap((sentence) => {
    const next = source[source.indexOf(sentence) + 1]
    return next && covers(next, [group]) ? [sentence, next] : [sentence]
  })
  const askingOrigin = /\b(form|found|start|origin|creat|began|begin)/i.test(question)
  const aboutThis = tokens.some((token) => title.toLowerCase() === token)
  if (askingOrigin && aboutThis) {
    const origin = source.find((sentence) => /\bfounded\b|\bestablished\b|\brenamed\b/i.test(sentence))
    if (origin && !shown.includes(origin)) shown.push(origin)
  }
  return readableQuote([...new Set(shown)].join(' '))
}

function termQuote(text: string, term: string, tokens: string[], groupTitle: string): string {
  const needle = term.toLowerCase().replace(/s$/, '')
  const group = groupTitle.toLowerCase()
  const matched = plainSentences(text).filter((sentence) => sentence.toLowerCase().includes(needle))
  const withLead = matched.filter((sentence) => tokens.some((token) => covers(sentence, [token])))
  const withGroup = matched.filter((sentence) => covers(sentence, [group]))
  return readableQuote((withLead.length ? withLead : withGroup).slice(0, 2).join(' '))
}

export async function gatherTopicSources(question: string, groupTitle: string, skipUrls: string[] = []): Promise<TopicSource[]> {
  const specific = questionTokens(question, groupTitle)
  const searchQuery = specific.length ? `${groupTitle} ${specific.map((token) => searchWord(token)).join(' ')}` : groupTitle
  const outside = searchScholarly(specific.length ? `${specific.map((token) => searchWord(token)).join(' ')} ${groupTitle}` : question, specific, groupTitle)
  const posts = searchPosts(specific, groupTitle)
  const page = await lookupWikipedia(searchQuery, groupTitle, specific).catch(() => null)
  const found: TopicSource[] = []
  const blocked = new Set(skipUrls)
  const add = (title: string, url: string, quote: string) => {
    const clean = readableQuote(quote)
    const hay = `${title} ${clean}`
    const hits = specific.filter((token) => covers(hay, [token])).length
    const aboutGroup = !groupTitle || covers(hay, [groupTitle])
    if (!clean || (specific.length > 0 && hits < 1)) return
    if (specific.length === 1 && !aboutGroup) return
    if (specific.length > 2 && hits < 2) return
    if (blocked.has(url) || found.some((item) => item.url === url)) return
    found.push({
      id: idFor(),
      title,
      url,
      domain: domainOf(url),
      quote: clean,
      origin: 'search',
      addedBy: 'search',
      addedByName: 'Search'
    })
  }
  const seen: string[] = []
  if (page) {
    for (const article of [page.main, ...(specific.length > 2 ? page.related : [])]) {
      const quote = focusedQuote(article.text, specific, groupTitle, question, article.title)
      if (quote) add(article.title, article.url, quote)
      seen.push(article.title)
    }
  }
  const lead = leadToken(specific)
  if (specific.length > 2 && lead) {
    for (const token of specific) {
      if (token === lead || found.length >= 4) continue
      if (found.some((item) => covers(`${item.title} ${item.quote}`, [token]))) continue
      const follow = await lookupWikipedia(`${searchWord(lead)} ${token}`, groupTitle, [lead, token], seen).catch(() => null)
      if (!follow) continue
      const quote = focusedQuote(follow.main.text, specific, groupTitle, question, follow.main.title)
      if (quote) add(follow.main.title, follow.main.url, quote)
      seen.push(follow.main.title)
    }
  }
  const papers = await outside.catch(() => [])
  for (const paper of papers) {
    if (found.length >= 5) break
    const quote = focusedQuote(paper.text, specific, groupTitle, question, paper.title) || readableQuote(paper.text)
    add(paper.title, paper.url, quote)
  }
  const xPosts = await posts.catch(() => [])
  for (const post of xPosts) {
    add(post.title, post.url, post.text)
    const saved = found.find((item) => item.url === post.url)
    if (saved && post.image) saved.image = post.image
  }
  if (specific.length <= 2 && page && lead) {
    const bridges = bridgeTerms(page.main.text, specific, groupTitle)
    for (const term of bridges) {
      if (found.length >= 5) break
      const follow = await lookupWikipedia(`${searchWord(lead)} ${term}`, groupTitle, [lead, term.toLowerCase()], seen).catch(() => null)
      if (!follow) continue
      const quote = [term, ...bridges.filter((item) => item !== term)]
        .map((item) => termQuote(follow.main.text, item, specific, groupTitle))
        .filter((item, index, all) => item.length > 0 && all.indexOf(item) === index)
        .join('\n\n')
      if (!quote.toLowerCase().includes(term.toLowerCase().replace(/s$/, ''))) continue
      add(follow.main.title, follow.main.url, quote)
      seen.push(follow.main.title)
    }
  }
  const fromX = found.filter((item) => item.domain === 'x.com' || item.domain === 'twitter.com').slice(0, 2)
  const rest = found.filter((item) => item.domain !== 'x.com' && item.domain !== 'twitter.com')
  return [...rest.slice(0, 5 - fromX.length), ...fromX]
}

function directionWords(lookFor: string): string[] {
  return [...new Set(lookFor.toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length >= 4 || /^\d{2,}$/.test(word)))]
}

function directedQuote(text: string, lookFor: string): string {
  const words = directionWords(lookFor)
  if (!words.length) return ''
  const sentences = plainSentences(text)
  const scored = sentences.map((sentence, index) => ({
    index,
    hits: words.filter((word) => sentence.toLowerCase().includes(word)).length
  })).filter((item) => item.hits > 0).sort((a, b) => b.hits - a.hits || a.index - b.index)
  if (!scored.length) return ''
  const best = scored[0].index
  return readableQuote(sentences.slice(Math.max(0, best - 1), best + 3).join(' '))
}

export function quoteFromMemberPage(text: string, question: string, groupTitle: string, lookFor = ''): string {
  const directed = directedQuote(text, lookFor)
  if (directed) return directed
  const tokens = questionTokens(question, groupTitle)
  const matched = focusedQuote(text, tokens, groupTitle)
  return matched || readableQuote(text.slice(0, 1600))
}

function hostedVideo(url: string): boolean {
  if (url.startsWith('/topic-videos/') && !url.includes('..') && url.toLowerCase().split('?')[0].endsWith('.mp4')) return true
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false
    const host = parsed.hostname.toLowerCase()
    if (host === 'youtu.be' || host.endsWith('youtube.com') || host.endsWith('googlevideo.com')) return false
    if (host === 'localhost' && parsed.pathname.toLowerCase().endsWith('.mp4')) return true
    return parsed.pathname.toLowerCase().endsWith('.mp4')
      || host.endsWith('firebasestorage.googleapis.com')
      || host.endsWith('firebasestorage.app')
      || host.endsWith('storage.googleapis.com')
      || host.endsWith('videodelivery.net')
      || host.endsWith('cloudflarestream.com')
  } catch {
    return false
  }
}

function videoPage(url: string): boolean {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '').toLowerCase()
    return host === 'youtu.be' || host.endsWith('youtube.com') || host === 'x.com' || host === 'twitter.com' || host.endsWith('facebook.com') || host === 'fb.watch' || host.endsWith('reddit.com') || host.endsWith('tiktok.com')
  } catch {
    return false
  }
}

function keptSource(item: unknown): TopicSource[] {
  if (!item || typeof item !== 'object') return []
  const source = item as Partial<TopicSource>
  if (typeof source.url !== 'string' || typeof source.quote !== 'string') return []
  const video = typeof source.video === 'string' && hostedVideo(source.video) ? source.video : undefined
  const cfUid = typeof source.cfUid === 'string' && /^[A-Za-z0-9]{16,40}$/.test(source.cfUid) ? source.cfUid : undefined
  return [{
    id: typeof source.id === 'string' ? source.id : idFor(),
    title: typeof source.title === 'string' ? source.title : 'Source',
    url: source.url,
    domain: typeof source.domain === 'string' ? source.domain : domainOf(source.url),
    quote: source.quote,
    image: typeof source.image === 'string' ? source.image : undefined,
    video,
    cfUid,
    summary: typeof source.summary === 'string' ? source.summary.slice(0, 1400) : undefined,
    origin: source.origin === 'member' ? 'member' : 'search',
    addedBy: typeof source.addedBy === 'string' ? source.addedBy : '',
    addedByName: typeof source.addedByName === 'string' ? source.addedByName : 'Member',
    up: Array.isArray(source.up) ? source.up.filter((id): id is string => typeof id === 'string').slice(0, 200) : [],
    down: Array.isArray(source.down) ? source.down.filter((id): id is string => typeof id === 'string').slice(0, 200) : [],
    notes: keptNotes(source.notes)
  }]
}

function transcriptFromCaption(raw: string): string {
  const decoded = raw.replace(/^\uFEFF/, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'").replace(/&quot;/g, '"')
  const tagged = [...decoded.matchAll(/<(?:text|p|s)\b[^>]*>([^<]+)/gi)].map((match) => match[1].trim())
  const lines = (tagged.length ? tagged : decoded.split(/\r?\n/)).flatMap((line) => {
    const trimmed = line.trim()
    if (!trimmed || trimmed === 'WEBVTT' || trimmed.startsWith('NOTE') || trimmed.startsWith('STYLE') || trimmed.startsWith('Kind:') || trimmed.startsWith('Language:')) return []
    if (/^\d+$/.test(trimmed) || trimmed.includes('-->')) return []
    const spoken = trimmed.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
    return spoken.length > 1 ? [spoken] : []
  })
  const unique: string[] = []
  for (const line of lines) {
    if (unique[unique.length - 1] !== line) unique.push(line)
  }
  const blocks: string[] = []
  let current = ''
  for (const line of unique) {
    const next = current ? `${current} ${line}` : line
    if (next.length > 420 && current) {
      blocks.push(current)
      current = line
    } else {
      current = next
    }
  }
  if (current) blocks.push(current)
  return blocks.join('\n\n').slice(0, 6000)
}

async function readCaption(raw: string): Promise<string> {
  let current = await assertPublicUrl(raw)
  const signal = AbortSignal.timeout(20000)
  for (let hop = 0; hop < 4; hop += 1) {
    const response = await fetch(current, {
      method: 'GET',
      redirect: 'manual',
      signal,
      headers: { 'User-Agent': 'CarrotLearn/1.0', Accept: 'text/vtt,text/plain,application/xml,application/json;q=0.8' }
    }).catch(() => null)
    if (!response) return ''
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location')
      if (!location) return ''
      current = await assertPublicUrl(new URL(location, current).toString())
      continue
    }
    if (!response.ok) return ''
    const text = (await response.text()).slice(0, 400000)
    return transcriptFromCaption(text)
  }
  return ''
}

function readMeta(value: unknown): TopicMeta | null {
  if (!value || typeof value !== 'object') return null
  const meta = value as Partial<TopicMeta>
  if (meta.kind !== 'topic' || typeof meta.adminId !== 'string') return null
  return {
    kind: 'topic',
    adminId: meta.adminId,
    adminName: typeof meta.adminName === 'string' ? meta.adminName : 'Member',
    note: typeof meta.note === 'string' ? meta.note : '',
    image: typeof meta.image === 'string' ? meta.image : undefined,
    slug: typeof meta.slug === 'string' ? meta.slug.slice(0, 96) : '',
    pending: Array.isArray(meta.pending) ? meta.pending.filter((item) => item && typeof item.url === 'string' && typeof item.quote === 'string') : [],
    unrelated: Array.isArray(meta.unrelated) ? meta.unrelated.flatMap((item) => keptSource(item)) : [],
    skipped: Array.isArray(meta.skipped) ? meta.skipped.filter((item): item is string => typeof item === 'string') : [],
    messages: Array.isArray(meta.messages) ? meta.messages.flatMap((item) => {
      if (!item || (item.role !== 'user' && item.role !== 'assistant') || typeof item.text !== 'string') return []
      return [{
        id: typeof item.id === 'string' ? item.id : idFor(),
        role: item.role,
        name: typeof item.name === 'string' ? item.name : 'Member',
        text: item.text,
        sourceIds: Array.isArray(item.sourceIds) ? item.sourceIds.filter((id): id is string => typeof id === 'string') : [],
        createdAt: typeof item.createdAt === 'string' ? item.createdAt : new Date().toISOString()
      }]
    }) : [],
    sources: Array.isArray(meta.sources) ? meta.sources.flatMap((item) => keptSource(item)) : [],
    replies: Array.isArray(meta.replies) ? meta.replies.filter((item) => item && typeof item.text === 'string') : [],
    spoken: readSpoken(meta.spoken)
  }
}

function readSpoken(value: unknown): Record<string, TopicSpoken> {
  if (!value || typeof value !== 'object') return {}
  const rows: Array<[string, TopicSpoken]> = []
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (!/^[a-f0-9]{24}$/.test(key) || !item || typeof item !== 'object') continue
    const row = item as Partial<TopicSpoken>
    if (row.state !== 'pending' && row.state !== 'ready' && row.state !== 'silent' && row.state !== 'failed') continue
    rows.push([key, {
      state: row.state,
      text: typeof row.text === 'string' ? row.text.slice(0, 200000) : '',
      at: typeof row.at === 'string' ? row.at.slice(0, 40) : ''
    }])
  }
  rows.sort((a, b) => b[1].at.localeCompare(a[1].at))
  return Object.fromEntries(rows.slice(0, 40))
}

function keptNotes(value: unknown): TopicNote[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') return []
    const note = item as Partial<TopicNote>
    if (typeof note.text !== 'string' || !note.text.trim()) return []
    return [{
      id: typeof note.id === 'string' ? note.id : idFor(),
      text: note.text.trim().slice(0, 2000),
      name: typeof note.name === 'string' && note.name.trim() ? note.name.trim().slice(0, 80) : 'Member',
      at: typeof note.at === 'string' ? note.at.slice(0, 40) : ''
    }]
  }).slice(-12)
}

function presentSource(source: TopicSource, viewerId: string): TopicSource {
  const up = source.up || []
  const down = source.down || []
  return {
    ...source,
    addedBy: '',
    up: [],
    down: [],
    upCount: up.length,
    downCount: down.length,
    mine: up.includes(viewerId) ? 'up' : down.includes(viewerId) ? 'down' : '',
    postedByMe: source.addedBy === viewerId,
    notes: source.notes || []
  }
}

function toCard(row: { id: string; title: string; metadata: unknown; createdAt: Date }, viewerId: string): TopicCard | null {
  const meta = readMeta(row.metadata)
  if (!meta) return null
  return {
    id: row.id,
    question: row.title,
    adminId: meta.adminId,
    adminName: meta.adminName,
    note: meta.note,
    isAdmin: meta.adminId === viewerId,
    sources: meta.sources.map((item) => presentSource(item, viewerId)),
    unrelated: (meta.unrelated || []).map((item) => presentSource(item, viewerId)),
    replies: meta.replies,
    image: meta.image || null,
    pending: (meta.pending || []).map((item) => presentSource(item, viewerId)),
    messages: meta.messages || [],
    slug: meta.slug || topicSlug(row.title),
    slugLocked: Boolean(meta.slug),
    createdAt: row.createdAt.toISOString()
  }
}

async function writeMeta(id: string, meta: TopicMeta, question: string) {
  await prisma.discoveredContent.update({
    where: { id },
    data: {
      title: question.slice(0, 180),
      summary: meta.sources.length ? `${meta.sources.length} sources` : 'No sources yet',
      textContent: meta.note,
      content: question,
      metadata: meta as unknown as Prisma.JsonObject
    }
  })
}

export async function listTopics(patchId: string, viewerId: string): Promise<TopicCard[]> {
  const rows = await prisma.discoveredContent.findMany({
    where: { patchId, type: 'topic' },
    select: { id: true, title: true, metadata: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
    take: 40
  })
  return withSlugs(rows.flatMap((row) => {
    const card = toCard(row, viewerId)
    return card ? [card] : []
  }))
}

export async function createTopic(options: {
  patchId: string
  question: string
  groupTitle: string
  adminId: string
  adminName: string
  sources?: TopicSource[]
  skipImage?: boolean
}): Promise<TopicCard> {
  const question = options.question.trim().slice(0, 240)
  const gathered = options.sources || await gatherTopicSources(question, options.groupTitle).catch(() => [])
  const remembered = options.sources ? [] : await rememberedSources(options.patchId, question, options.groupTitle, gathered.map((source) => source.url)).catch(() => [])
  const sources = [...remembered, ...gathered.filter((source) => !remembered.some((item) => item.url && item.url === source.url))].slice(0, 24)
  const leadTitles = questionTokens(question, options.groupTitle).includes('jfk') ? ['John F. Kennedy'] : []
  const image = options.skipImage ? null : await pageThumbnail([...leadTitles, ...sources.map((source) => source.title)]).catch(() => null)
  const token = `${Date.now().toString(36)}${idFor()}`
  const url = `https://topic.carrot/${options.patchId}/${token}`
  const meta: TopicMeta = {
    kind: 'topic',
    adminId: options.adminId,
    adminName: options.adminName,
    note: '',
    slug: await nextSlug(options.patchId, question),
    image: image || undefined,
    sources,
    unrelated: [],
    replies: []
  }
  const row = await prisma.discoveredContent.create({
    data: {
      patchId: options.patchId,
      title: question,
      canonicalUrl: url,
      sourceUrl: url,
      type: 'topic',
      category: 'topic',
      summary: sources.length ? `${sources.length} sources` : 'No sources yet',
      textContent: '',
      content: question,
      domain: 'topic',
      metadata: meta as unknown as Prisma.JsonObject,
      provenance: sources.map((item) => item.url) as Prisma.JsonArray,
      isUseful: true
    },
    select: { id: true, title: true, metadata: true, createdAt: true }
  })
  const card = toCard(row, options.adminId)
  if (!card) throw new Error('Could not save the question')
  return card
}

async function rememberedSources(patchId: string, question: string, groupTitle: string, skipUrls: string[]): Promise<TopicSource[]> {
  const tokens = questionTokens(question, groupTitle)
  if (tokens.length === 0) return []
  const rows = await prisma.discoveredContent.findMany({
    where: { patchId, type: 'topic' },
    select: { metadata: true },
    take: 40
  })
  const skip = new Set(skipUrls.filter(Boolean))
  const found: TopicSource[] = []
  for (const row of rows) {
    const meta = readMeta(row.metadata)
    if (!meta) continue
    for (const source of meta.sources) {
      if (!source.quote || source.quote.includes('could not be read')) continue
      if (source.url && skip.has(source.url)) continue
      const hay = `${source.title} ${source.quote}`
      const lead = leadToken(tokens)
      const rest = tokens.filter((token) => token !== lead)
      const matched = covers(hay, tokens) || (tokens.length > 1 && !!lead && covers(hay, [lead]) && rest.some((token) => covers(hay, [token])))
      if (!matched || found.some((item) => item.url && item.url === source.url)) continue
      found.push({ ...source, id: idFor(), up: [], down: [] })
    }
  }
  return found.slice(0, 4)
}

const spokenLocks = new Map<string, Promise<void>>()

function withSpokenLock<T>(topicId: string, fn: () => Promise<T>): Promise<T> {
  const prev = spokenLocks.get(topicId) || Promise.resolve()
  const run = prev.then(fn, fn)
  const settled = run.then(() => undefined, () => undefined)
  spokenLocks.set(topicId, settled)
  void settled.finally(() => {
    if (spokenLocks.get(topicId) === settled) spokenLocks.delete(topicId)
  })
  return run
}

export async function readTopicSpoken(patchId: string, topicId: string, key: string): Promise<{ found: false } | { found: true; entry: TopicSpoken | null }> {
  const row = await topicRow(patchId, topicId)
  const meta = row ? readMeta(row.metadata) : null
  if (!row || !meta) return { found: false }
  return { found: true, entry: meta.spoken?.[key] || null }
}

export async function saveTopicSpoken(patchId: string, topicId: string, key: string, entry: TopicSpoken): Promise<boolean> {
  if (!/^[a-f0-9]{24}$/.test(key)) return false
  return withSpokenLock(topicId, async () => {
    const row = await topicRow(patchId, topicId)
    const meta = row ? readMeta(row.metadata) : null
    if (!row || !meta) return false
    const spoken = { ...(meta.spoken || {}), [key]: { state: entry.state, text: entry.text.slice(0, 200000), at: entry.at.slice(0, 40) } }
    const newest = Object.entries(spoken).sort((a, b) => b[1].at.localeCompare(a[1].at)).slice(0, 40)
    meta.spoken = Object.fromEntries(newest)
    await writeMeta(row.id, meta, row.title)
    return true
  })
}

async function topicRow(patchId: string, id: string) {
  return prisma.discoveredContent.findFirst({
    where: { id, patchId, type: 'topic' },
    select: { id: true, title: true, metadata: true, createdAt: true }
  })
}

export async function saveTopicNote(patchId: string, id: string, userId: string, note: string): Promise<TopicCard | null> {
  const row = await topicRow(patchId, id)
  const meta = row ? readMeta(row.metadata) : null
  if (!row || !meta || meta.adminId !== userId) return null
  meta.note = note.trim().slice(0, 8000)
  await writeMeta(row.id, meta, row.title)
  return toCard({ ...row, metadata: meta }, userId)
}

export async function addTopicReply(patchId: string, id: string, userId: string, name: string, text: string): Promise<TopicCard | null> {
  const row = await topicRow(patchId, id)
  const meta = row ? readMeta(row.metadata) : null
  if (!row || !meta) return null
  meta.replies = [...meta.replies, { id: idFor(), userId, name, text: text.trim().slice(0, 12000), createdAt: new Date().toISOString() }].slice(-80)
  await writeMeta(row.id, meta, row.title)
  return toCard({ ...row, metadata: meta }, userId)
}

export async function addTopicSource(patchId: string, id: string, userId: string, name: string, url: string, lookFor = ''): Promise<TopicCard | null> {
  const row = await topicRow(patchId, id)
  const meta = row ? readMeta(row.metadata) : null
  if (!row || !meta) return null
  const target = statusPhotoTarget(url)
  const post = target ? await lookupStatusPhoto(url) : null
  let source: TopicSource
  if (target && !post) {
    const viewed = await readXPost(url).catch(() => null)
    const quote = (viewed?.text || '').trim().slice(0, 6000) || 'Post added to this question.'
    const placed = await placeOnQuestion(row.title, quote, 'Post', { url: `https://x.com/${target.user}/status/${target.id}` })
    source = {
      id: idFor(),
      title: placed.title,
      url: viewed?.url || `https://x.com/${target.user}/status/${target.id}`,
      domain: 'x.com',
      quote,
      summary: placed.summary,
      origin: 'member',
      addedBy: userId,
      addedByName: name
    }
    const rest = meta.sources.filter((item) => !item.url.includes(target.id))
    const previous = meta.sources.find((item) => item.url.includes(target.id))
    if (previous?.image) return toCard({ ...row, metadata: meta }, userId)
    if (previous) source.id = previous.id
    meta.sources = [source, ...rest].slice(0, 24)
    await writeMeta(row.id, meta, row.title)
    return toCard({ ...row, metadata: meta }, userId)
  }
  if (post) {
    const loaded = await readImageUrl(post.imageUrl)
    const image = await saveImageFile(row.id, loaded.bytes, loaded.mime)
    const quote = await explainPhotograph({ question: row.title, caption: post.caption, bytes: loaded.bytes, mime: loaded.mime })
    const parts = splitReading(quote)
    source = {
      id: idFor(),
      title: parts.title || contentTitle(quote, 'Photograph'),
      url: post.pageUrl,
      domain: 'x.com',
      quote: parts.quote || quote,
      summary: parts.summary || undefined,
      image,
      origin: 'member',
      addedBy: userId,
      addedByName: name
    }
    const rest = meta.sources.filter((item) => !item.url.includes(post.statusId))
    const previous = meta.sources.find((item) => item.url.includes(post.statusId))
    if (previous) source.id = previous.id
    meta.sources = [source, ...rest].slice(0, 24)
    await writeMeta(row.id, meta, row.title)
    return toCard({ ...row, metadata: meta }, userId)
  }
  const direction = lookFor.trim().slice(0, 200)
  const already = meta.sources.find((item) => item.url && sameDocument(item.url, url))
  if (already && !direction) {
    meta.sources = [already, ...meta.sources.filter((item) => item.id !== already.id)]
    await writeMeta(row.id, meta, row.title)
    return toCard({ ...row, metadata: meta }, userId)
  }
  let page: Awaited<ReturnType<typeof readPublicUrl>>
  try {
    page = await readPublicUrl(url)
  } catch (error) {
    if (!url.split('?')[0].toLowerCase().endsWith('.pdf')) throw error
    console.error('[topic] PDF link was kept without its text', error instanceof Error ? error.message : error)
    const name = decodeURIComponent(url.split('/').pop() || 'PDF').replace(/\.pdf$/i, '').replace(/[_+]+/g, ' ').replace(/-/g, ' ').trim()
    page = { finalUrl: url, title: name || 'PDF', text: '', kind: 'pdf' }
  }
  const patch = await prisma.patch.findUnique({ where: { id: patchId }, select: { title: true } })
  const quote = quoteFromMemberPage(page.text, row.title, patch?.title || '', direction) || (page.kind === 'pdf' ? 'The PDF is the source. Open the file at this address to read it.' : '')
  if (!quote) return null
  const placed = await placeOnQuestion(row.title, quote, page.title || 'Page', { name: page.title, url: page.finalUrl, lookFor: direction })
  source = {
    id: already?.id || idFor(),
    title: placed.title || page.title || domainOf(page.finalUrl),
    url: page.finalUrl,
    domain: domainOf(page.finalUrl),
    quote,
    summary: placed.summary,
    image: already?.image || await pictureFor(row.id, page.title, page.finalUrl, page.image),
    origin: 'member',
    addedBy: already?.addedBy || userId,
    addedByName: already?.addedByName || name,
    up: already?.up,
    down: already?.down
  }
  meta.sources = [source, ...meta.sources.filter((item) => item.id !== source.id)].slice(0, 24)
  await writeMeta(row.id, meta, row.title)
  return toCard({ ...row, metadata: meta }, userId)
}

export async function addTopicVideo(
  patchId: string,
  id: string,
  userId: string,
  name: string,
  input: { pageUrl: string; videoUrl?: string; cfUid?: string; title?: string; thumbnail?: string; captionUrl?: string; transcript?: string }
): Promise<TopicCard | null> {
  const row = await topicRow(patchId, id)
  const meta = row ? readMeta(row.metadata) : null
  if (!row || !meta) return null
  if (!videoPage(input.pageUrl)) throw new PublicUrlError('Paste a video link from YouTube, X, Facebook, Reddit, or TikTok.')
  const video = input.videoUrl && hostedVideo(input.videoUrl) ? input.videoUrl : undefined
  const cfUid = input.cfUid && /^[A-Za-z0-9]{16,40}$/.test(input.cfUid) ? input.cfUid : undefined
  if (!video && !cfUid) throw new PublicUrlError('That video was not saved to a copy we can play.')
  const written = typeof input.transcript === 'string' ? input.transcript.trim().slice(0, 6000) : ''
  const transcript = written.length >= 40 ? written : input.captionUrl ? await readCaption(input.captionUrl).catch(() => '') : ''
  const quote = transcript.length >= 40
    ? transcript
    : 'The video is saved here and plays from our copy.\n\nA transcript was not included with it.'
  let image: string | undefined
  if (input.thumbnail?.startsWith('/topic-videos/') && !input.thumbnail.includes('..')) {
    image = input.thumbnail
  } else if (input.thumbnail) {
    try {
      const loaded = await readImageUrl(input.thumbnail)
      image = await saveImageFile(row.id, loaded.bytes, loaded.mime)
    } catch {
      image = undefined
    }
  }
  const source: TopicSource = {
    id: idFor(),
    title: (input.title || 'Video').slice(0, 180),
    url: input.pageUrl,
    domain: domainOf(input.pageUrl),
    quote,
    image,
    video,
    cfUid,
    origin: 'member',
    addedBy: userId,
    addedByName: name
  }
  meta.sources = [source, ...meta.sources.filter((item) => item.url !== source.url)].slice(0, 24)
  await writeMeta(row.id, meta, row.title)
  return toCard({ ...row, metadata: meta }, userId)
}

async function pictureFor(topicId: string, title: string, pageUrl: string, remoteImage?: string): Promise<string | undefined> {
  const wiki = pageUrl.includes('wikipedia.org') || pageUrl.includes('wikimedia.org')
  if (wiki) {
    const photos = await pageThumbnails([title]).catch(() => ({}))
    const match = photos[title] || Object.entries(photos).find(([name]) => name.toLowerCase() === title.toLowerCase())?.[1]
    if (match) return match
  }
  if (!remoteImage) return undefined
  try {
    const loaded = await readImageUrl(remoteImage)
    return await saveImageFile(topicId, loaded.bytes, loaded.mime)
  } catch {
    return undefined
  }
}

async function withPictures(sources: TopicSource[]): Promise<TopicSource[]> {
  const photos = await pageThumbnails(sources.map((source) => source.title)).catch(() => ({} as Record<string, string>))
  return sources.map((source) => {
    const image = photos[source.title] || Object.entries(photos).find(([name]) => name.toLowerCase() === source.title.toLowerCase())?.[1]
    return image ? { ...source, image } : source
  })
}

export async function askTopic(patchId: string, id: string, groupTitle: string, userId: string, name: string, text: string): Promise<TopicCard | null> {
  const row = await topicRow(patchId, id)
  const meta = row ? readMeta(row.metadata) : null
  if (!row || !meta) return null
  const follow = text.trim().slice(0, 500)
  if (follow.length < 3) return null
  const skip = [...meta.sources.map((item) => item.url), ...(meta.skipped || []), ...(meta.pending || []).map((item) => item.url)]
  const followTokens = questionTokens(follow, groupTitle)
  const query = followTokens.length >= 2 ? follow : `${row.title} ${follow}`
  const remembered = await rememberedSources(patchId, query, groupTitle, skip).catch(() => [])
  const found = [...remembered, ...await withPictures(await gatherTopicSources(query, groupTitle, skip))]
  const now = new Date().toISOString()
  meta.pending = [...(meta.pending || []), ...found].slice(-12)
  meta.messages = [...(meta.messages || []), {
    id: idFor(),
    role: 'user',
    name,
    text: follow,
    sourceIds: [],
    createdAt: now
  }, {
    id: idFor(),
    role: 'assistant',
    name: 'Search',
    text: found.length ? 'These passages match what you asked. Add the ones that belong on this question.' : 'Nothing new matched that. Ask more specifically, or add a page, a photo, or what you know.',
    sourceIds: found.map((item) => item.id),
    createdAt: now
  }].slice(-40)
  await writeMeta(row.id, meta, row.title)
  return toCard({ ...row, metadata: meta }, userId)
}

export async function addTopicClip(patchId: string, id: string, userId: string, name: string, input: { url: string; title: string; quote: string }): Promise<TopicCard | null> {
  const row = await topicRow(patchId, id)
  const meta = row ? readMeta(row.metadata) : null
  if (!row || !meta) return null
  const quote = input.quote.trim().replace(/\s+/g, ' ').slice(0, 6000)
  if (quote.length < 8) return null
  const url = input.url.trim().slice(0, 500)
  const title = (input.title || domainOf(url) || 'Source').slice(0, 180)
  if (meta.sources.some((item) => item.url === url && item.quote === quote)) return toCard({ ...row, metadata: meta }, userId)
  meta.sources = [...meta.sources, {
    id: idFor(),
    title,
    url,
    domain: url ? domainOf(url) : '',
    quote,
    origin: 'member',
    addedBy: userId,
    addedByName: name
  }].slice(0, 24)
  await writeMeta(row.id, meta, row.title)
  return toCard({ ...row, metadata: meta }, userId)
}

export async function addTopicText(patchId: string, id: string, userId: string, name: string, text: string): Promise<TopicCard | null> {
  const row = await topicRow(patchId, id)
  const meta = row ? readMeta(row.metadata) : null
  if (!row || !meta) return null
  const quote = text.trim().slice(0, 4000)
  if (!quote) return null
  const placed = await placeOnQuestion(row.title, quote, 'Note')
  meta.sources = [...meta.sources, {
    id: idFor(),
    title: placed.title,
    url: '',
    domain: '',
    quote,
    summary: placed.summary,
    origin: 'member',
    addedBy: userId,
    addedByName: name
  }].slice(0, 24)
  await writeMeta(row.id, meta, row.title)
  return toCard({ ...row, metadata: meta }, userId)
}

export async function addTopicImageFromUrl(patchId: string, id: string, userId: string, name: string, raw: string, caption: string): Promise<TopicCard | null> {
  const loaded = await readImageUrl(raw)
  return addTopicImageSource(patchId, id, userId, name, loaded.bytes, loaded.mime, caption)
}

export async function addTopicImageSource(patchId: string, id: string, userId: string, name: string, bytes: Buffer, mime: string, caption: string): Promise<TopicCard | null> {
  const row = await topicRow(patchId, id)
  const meta = row ? readMeta(row.metadata) : null
  if (!row || !meta) return null
  const image = await saveImageFile(id, bytes, mime)
  const reading = await explainPhotograph({ question: row.title, caption, bytes, mime }).catch(() => '')
  const parts = reading ? splitReading(reading) : { title: '', quote: '', summary: '' }
  const quote = parts.quote || caption.trim().slice(0, 4000) || 'Photo added to this question.'
  meta.sources = [...meta.sources, {
    id: idFor(),
    title: parts.title || contentTitle(quote, 'Photograph'),
    url: '',
    domain: '',
    quote,
    summary: parts.summary || undefined,
    image,
    origin: 'member',
    addedBy: userId,
    addedByName: name
  }].slice(0, 24)
  await writeMeta(row.id, meta, row.title)
  return toCard({ ...row, metadata: meta }, userId)
}

const VIDEO_TYPES: Record<string, string> = {
  'video/mp4': 'mp4',
  'video/webm': 'webm'
}

async function saveVideoFile(topicId: string, bytes: Buffer, mime: string): Promise<string> {
  const ext = VIDEO_TYPES[mime]
  if (!ext) throw new PublicUrlError('Use an MP4 or WebM video.')
  if (bytes.length < 1000 || bytes.length > 200_000_000) throw new PublicUrlError('That video is empty or larger than 200 MB.')
  const dir = path.join(process.cwd(), 'public', 'topic-videos')
  await mkdir(dir, { recursive: true })
  const fileName = `${topicId}-${idFor()}.${ext}`
  await writeFile(path.join(dir, fileName), bytes)
  return `/topic-videos/${fileName}`
}

function pdfFileName(fileName: string): string {
  const raw = fileName.replace(/\.pdf$/i, '').replace(/[_+]+/g, ' ').replace(/-/g, ' ').replace(/\s+/g, ' ').trim()
  return raw.slice(0, 180) || 'PDF'
}

async function savePdfFile(topicId: string, bytes: Buffer): Promise<string> {
  const dir = path.join(process.cwd(), 'public', 'topic-docs')
  await mkdir(dir, { recursive: true })
  const fileName = `${topicId}-${idFor()}.pdf`
  await writeFile(path.join(dir, fileName), bytes)
  return `/topic-docs/${fileName}`
}

export async function addTopicUploadedPdf(patchId: string, id: string, userId: string, name: string, bytes: Buffer, fileName: string, lookFor = ''): Promise<TopicCard | null> {
  const row = await topicRow(patchId, id)
  const meta = row ? readMeta(row.metadata) : null
  if (!row || !meta) return null
  if (meta.sources.length >= 24) throw new PublicUrlError('This question already has 24 sources.')
  if (bytes.length < 100 || bytes.length > 20_000_000) throw new PublicUrlError('That PDF is empty or larger than 20 MB.')
  if (bytes.subarray(0, 5).toString('latin1') !== '%PDF-') throw new PublicUrlError('That file is not a PDF.')
  const url = await savePdfFile(id, bytes)
  const text = await textFromPdf(bytes)
  const patch = await prisma.patch.findUnique({ where: { id: patchId }, select: { title: true } })
  const fallback = pdfFileName(fileName)
  const quote = quoteFromMemberPage(text, row.title, patch?.title || '', lookFor) || 'The PDF is the source. Open the file to read it.'
  const placed = await placeOnQuestion(row.title, quote, fallback, { name: fallback, url, lookFor })
  meta.sources = [{
    id: idFor(),
    title: placed.title || fallback,
    url,
    domain: '',
    quote,
    summary: placed.summary,
    origin: 'member',
    addedBy: userId,
    addedByName: name
  }, ...meta.sources].slice(0, 24)
  await writeMeta(row.id, meta, row.title)
  return toCard({ ...row, metadata: meta }, userId)
}

export async function addTopicUploadedVideo(patchId: string, id: string, userId: string, name: string, bytes: Buffer, mime: string, fileName: string): Promise<TopicCard | null> {
  const row = await topicRow(patchId, id)
  const meta = row ? readMeta(row.metadata) : null
  if (!row || !meta) return null
  const video = await saveVideoFile(id, bytes, mime)
  const title = fileName.replace(/\.[a-z0-9]+$/i, '').slice(0, 180) || 'Video'
  meta.sources = [...meta.sources, {
    id: idFor(),
    title,
    url: video,
    domain: '',
    quote: 'Video added to this question.',
    video,
    origin: 'member',
    addedBy: userId,
    addedByName: name
  }].slice(0, 24)
  await writeMeta(row.id, meta, row.title)
  return toCard({ ...row, metadata: meta }, userId)
}

export async function searchTopic(patchId: string, id: string, groupTitle: string, viewerId: string): Promise<TopicCard | null> {
  const row = await topicRow(patchId, id)
  const meta = row ? readMeta(row.metadata) : null
  if (!row || !meta) return null
  const skip = [...meta.sources.map((item) => item.url), ...(meta.skipped || []), ...(meta.pending || []).map((item) => item.url)]
  const found = await gatherTopicSources(row.title, groupTitle, skip)
  meta.pending = [...(meta.pending || []), ...found].slice(0, 8)
  await writeMeta(row.id, meta, row.title)
  return toCard({ ...row, metadata: meta }, viewerId)
}

function placeVote(source: TopicSource, userId: string, direction: 'up' | 'down') {
  const up = new Set(source.up || [])
  const down = new Set(source.down || [])
  const chosen = direction === 'up' ? up : down
  const other = direction === 'up' ? down : up
  if (chosen.has(userId)) chosen.delete(userId)
  else {
    chosen.add(userId)
    other.delete(userId)
  }
  source.up = [...up].slice(0, 200)
  source.down = [...down].slice(0, 200)
}

export async function addTopicAddendum(patchId: string, id: string, userId: string, name: string, sourceId: string, text: string): Promise<TopicCard | null> {
  const row = await topicRow(patchId, id)
  const meta = row ? readMeta(row.metadata) : null
  const note = text.trim().slice(0, 2000)
  if (!row || !meta || !sourceId || !note) return null
  const item = [...meta.sources, ...(meta.unrelated || [])].find((source) => source.id === sourceId)
  if (!item || (meta.adminId !== userId && item.addedBy !== userId)) return null
  item.notes = [...(item.notes || []), { id: idFor(), text: note, name: name.slice(0, 80), at: new Date().toISOString() }].slice(-12)
  await writeMeta(row.id, meta, row.title)
  return toCard({ ...row, metadata: meta }, userId)
}

export async function voteTopicSource(patchId: string, id: string, userId: string, sourceId: string, direction: 'up' | 'down'): Promise<TopicCard | null> {
  const row = await topicRow(patchId, id)
  const meta = row ? readMeta(row.metadata) : null
  if (!row || !meta || !sourceId) return null
  const item = [...meta.sources, ...(meta.unrelated || [])].find((source) => source.id === sourceId)
  if (!item) return null
  placeVote(item, userId, direction)
  await writeMeta(row.id, meta, row.title)
  return toCard({ ...row, metadata: meta }, userId)
}

export async function setTopicUnrelated(patchId: string, id: string, userId: string, sourceId: string, archive: boolean): Promise<TopicCard | null> {
  const row = await topicRow(patchId, id)
  const meta = row ? readMeta(row.metadata) : null
  if (!row || !meta || meta.adminId !== userId) return null
  if (archive) {
    const item = meta.sources.find((source) => source.id === sourceId)
    if (!item) return null
    meta.sources = meta.sources.filter((source) => source.id !== sourceId)
    meta.unrelated = [item, ...(meta.unrelated || []).filter((source) => source.id !== sourceId)].slice(0, 40)
  } else {
    const item = (meta.unrelated || []).find((source) => source.id === sourceId)
    if (!item || meta.sources.length >= 24) return null
    meta.unrelated = (meta.unrelated || []).filter((source) => source.id !== sourceId)
    meta.sources = [...meta.sources, item]
  }
  await writeMeta(row.id, meta, row.title)
  return toCard({ ...row, metadata: meta }, userId)
}

export async function decideTopicSource(patchId: string, id: string, viewerId: string, sourceId: string, keep: boolean): Promise<TopicCard | null> {
  const row = await topicRow(patchId, id)
  const meta = row ? readMeta(row.metadata) : null
  if (!row || !meta) return null
  const item = (meta.pending || []).find((source) => source.id === sourceId)
  if (!item) return null
  meta.pending = (meta.pending || []).filter((source) => source.id !== sourceId)
  if (keep) {
    if (!meta.sources.some((source) => source.url === item.url)) meta.sources = [...meta.sources, item].slice(0, 24)
  } else {
    meta.skipped = [...(meta.skipped || []), item.url].slice(-100)
  }
  await writeMeta(row.id, meta, row.title)
  return toCard({ ...row, metadata: meta }, viewerId)
}

const IMAGE_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp'
}

async function saveImageFile(topicId: string, bytes: Buffer, mime: string): Promise<string> {
  const ext = IMAGE_TYPES[mime]
  if (!ext) throw new PublicUrlError('Use a JPEG, PNG, or WebP image.')
  if (bytes.length < 32 || bytes.length > 20_000_000) throw new PublicUrlError('That image is empty or larger than 20 MB.')
  const dir = path.join(process.cwd(), 'public', 'topic-images')
  await mkdir(dir, { recursive: true })
  const name = `${topicId}-${idFor()}.${ext}`
  await writeFile(path.join(dir, name), bytes)
  return `/topic-images/${name}`
}

async function readImageUrl(raw: string, depth = 0): Promise<{ bytes: Buffer; mime: string }> {
  if (depth > 2) throw new PublicUrlError('That image could not be read.')
  const url = await assertPublicUrl(raw)
  const response = await fetch(url, {
    headers: { Accept: 'image/jpeg,image/png,image/webp', 'User-Agent': 'CarrotLearn/1.0' },
    redirect: 'manual',
    signal: AbortSignal.timeout(12_000)
  }).catch(() => null)
  if (!response) throw new PublicUrlError('That image could not be read.')
  if (response.status >= 300 && response.status < 400) {
    const next = response.headers.get('location')
    if (!next) throw new PublicUrlError('That image could not be read.')
    return readImageUrl(new URL(next, url).toString(), depth + 1)
  }
  if (!response.ok) throw new PublicUrlError('That image could not be read.')
  const mime = (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase()
  if (!IMAGE_TYPES[mime]) throw new PublicUrlError('That link is not a JPEG, PNG, or WebP image.')
  const bytes = Buffer.from(await response.arrayBuffer())
  return { bytes, mime }
}

export async function setTopicImage(patchId: string, id: string, viewerId: string, image: string): Promise<TopicCard | null> {
  const row = await topicRow(patchId, id)
  const meta = row ? readMeta(row.metadata) : null
  if (!row || !meta) return null
  meta.image = image
  await writeMeta(row.id, meta, row.title)
  await prisma.discoveredContent.update({
    where: { id: row.id },
    data: { hero: { url: image, source: 'member' } as Prisma.JsonObject }
  })
  return toCard({ ...row, metadata: meta }, viewerId)
}

export async function setTopicImageFromUrl(patchId: string, id: string, viewerId: string, raw: string): Promise<TopicCard | null> {
  const loaded = await readImageUrl(raw)
  const image = await saveImageFile(id, loaded.bytes, loaded.mime)
  return setTopicImage(patchId, id, viewerId, image)
}

export async function setTopicImageFromFile(patchId: string, id: string, viewerId: string, bytes: Buffer, mime: string): Promise<TopicCard | null> {
  const image = await saveImageFile(id, bytes, mime)
  return setTopicImage(patchId, id, viewerId, image)
}
