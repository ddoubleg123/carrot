import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import prisma from '@/lib/prisma'
import { PublicUrlError, readPublicUrl } from '@/lib/learn/publicUrl'
import { lookupWikipedia } from '@/lib/learn/wikipedia'
import { saveLearnedSource } from '@/lib/learn/saveSource'
import { findSavedAnswers, questionTokens } from '@/lib/learn/rank'
import { bridgeTerms, covers, leadToken, plainSentences, searchWord } from '@/lib/learn/terms'
import { findFreeHero } from '@/lib/learn/hero'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const REFERENCE_LIMIT = 4

function mentionsQuestion(title: string, text: string, tokens: string[]): boolean {
  return covers(`${title} ${text.slice(0, 20000)}`, tokens)
}

function focusedSummary(text: string, tokens: string[], groupTitle: string): string {
  if (tokens.length === 0) return text.slice(0, 600)
  const group = groupTitle.toLowerCase()
  const sentences = plainSentences(text).filter((sentence) => tokens.some((token) => covers(sentence, [token])))
  const aboutGroup = sentences.filter((sentence) => covers(sentence, [group]))
  const source = plainSentences(text)
  const picked = tokens.length > 1 ? aboutGroup : sentences
  picked.sort((a, b) => {
    const score = (sentence: string) => tokens.filter((token) => covers(sentence, [token])).length + (covers(sentence, [group]) ? 2 : 0)
    return score(b) - score(a)
  })
  const shown = picked.slice(0, 2).flatMap((sentence) => {
    const next = source[source.indexOf(sentence) + 1]
    return next && covers(next, [group]) ? [sentence, next] : [sentence]
  })
  return [...new Set(shown)].join(' ').slice(0, 700)
}

function termSummary(text: string, term: string, tokens: string[], groupTitle: string): string {
  const needle = term.toLowerCase().replace(/s$/, '')
  const group = groupTitle.toLowerCase()
  const matched = plainSentences(text).filter((sentence) => sentence.toLowerCase().includes(needle))
  const withLead = matched.filter((sentence) => tokens.some((token) => covers(sentence, [token])))
  const withGroup = matched.filter((sentence) => covers(sentence, [group]))
  const picked = withLead.length ? withLead : withGroup
  return picked.slice(0, 2).join(' ').slice(0, 700)
}

async function heroUrlFor(title: string, existing: string | null): Promise<string | null> {
  if (existing && existing.startsWith('http')) return existing
  const found = await findFreeHero(title).catch(() => null)
  return found?.url || null
}

async function canLearn(patchId: string, userId: string, createdBy: string | null) {
  if (createdBy === userId) return true
  const member = await prisma.patchMember.findUnique({
    where: {
      patch_user_member_unique: {
        patchId,
        userId
      }
    },
    select: { id: true }
  })
  return Boolean(member)
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ handle: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { handle } = await params
  const patch = await prisma.patch.findUnique({
    where: { handle },
    select: { id: true, title: true, createdBy: true, handle: true, tags: true }
  })
  if (!patch) {
    return NextResponse.json({ error: 'Group not found' }, { status: 404 })
  }
  if (!(await canLearn(patch.id, session.user.id, patch.createdBy))) {
    return NextResponse.json({ error: 'Permission denied' }, { status: 403 })
  }

  const body = await request.json().catch(() => ({}))
  const url = typeof body?.url === 'string' ? body.url.trim() : ''
  const question = typeof body?.question === 'string' ? body.question.trim().slice(0, 240) : ''

  if (url) {
    try {
      const page = await readPublicUrl(url)
      const saved = await saveLearnedSource({
        patchId: patch.id,
        title: page.title,
        url: page.finalUrl,
        text: page.text || 'Saved the link. This file had no readable text layer.',
        type: page.kind === 'pdf' ? 'pdf' : 'article',
        category: 'link'
      })
      const message = page.text.length > 40
        ? 'Saved that link on this group.'
        : 'Saved the link. The page did not include enough readable text.'
      return NextResponse.json({ success: true, saved: [saved], message })
    } catch (error) {
      const message = error instanceof PublicUrlError ? error.message : 'Could not read that link.'
      const status = error instanceof PublicUrlError ? 400 : 502
      return NextResponse.json({ error: message }, { status })
    }
  }

  const specific = question ? questionTokens(question, patch.title) : []
  const searchQuery = specific.length ? `${patch.title} ${specific.join(' ')}` : patch.title
  const savedAnswers = question
    ? await findSavedAnswers({
        patchId: patch.id,
        patchTitle: patch.title,
        patchHandle: patch.handle,
        tags: patch.tags.filter((tag): tag is string => typeof tag === 'string'),
        question,
        userId: session.user.id
      })
    : []
  if (savedAnswers.length >= 2) {
    return NextResponse.json({
      success: true,
      source: 'group',
      results: savedAnswers,
      saved: [],
      message: 'Showing sources this group and similar groups already saved.'
    })
  }

  const page = await lookupWikipedia(searchQuery, patch.title, specific).catch(() => null)
  if (!page) {
    return NextResponse.json({
      success: true,
      source: savedAnswers.length ? 'group' : 'web',
      results: savedAnswers,
      saved: [],
      message: savedAnswers.length
        ? 'Showing the saved source that matches. Nothing new was found outside the group.'
        : specific.length
          ? 'Nothing found that answers that question.'
          : 'No Wikipedia page matched this group. Paste a link on Facts to read it instead.'
    })
  }

  const saved = []
  const mainSummary = focusedSummary(page.main.text, specific, patch.title)
  if (mentionsQuestion(page.main.title, page.main.text, specific) && (specific.length === 0 || mainSummary)) {
    const mainHero = await heroUrlFor(page.main.title, page.main.thumbnail)
    saved.push(await saveLearnedSource({
      patchId: patch.id,
      title: page.main.title,
      url: page.main.url,
      text: page.main.text,
      summary: mainSummary || page.main.text.slice(0, 600),
      type: 'article',
      category: 'wikipedia',
      heroUrl: mainHero
    }))
  }

  const relatedSaves = await Promise.all(page.related.map(async (article) => {
    const summary = focusedSummary(article.text, specific, patch.title)
    if (!mentionsQuestion(article.title, article.text, specific) || (specific.length > 0 && !summary)) return null
    return saveLearnedSource({
      patchId: patch.id,
      title: article.title,
      url: article.url,
      text: article.text,
      summary,
      type: 'article',
      category: 'wikipedia',
      heroUrl: await heroUrlFor(article.title, article.thumbnail)
    }).catch(() => null)
  }))
  for (const item of relatedSaves) {
    if (item) saved.push(item)
  }

  const lead = leadToken(specific)
  const bridges = lead ? bridgeTerms(page.main.text, specific, patch.title) : []
  const seenTitles = saved.map((item) => item.title)
  for (const term of bridges) {
    const follow = await lookupWikipedia(`${searchWord(lead || term)} ${term}`, patch.title, lead ? [lead, term.toLowerCase()] : specific, seenTitles).catch(() => null)
    if (!follow) continue
    const summary = [term, ...bridges.filter((item) => item !== term)]
      .map((item) => termSummary(follow.main.text, item, specific, patch.title))
      .filter((item, index, all) => item.length > 0 && all.indexOf(item) === index)
      .join(' ')
      .slice(0, 700)
    if (!summary.toLowerCase().includes(term.toLowerCase().replace(/s$/, '')) || !covers(summary, [lead || term])) continue
    if (saved.some((item) => item.url === follow.main.url)) continue
    seenTitles.push(follow.main.title)
    saved.push(await saveLearnedSource({
      patchId: patch.id,
      title: follow.main.title,
      url: follow.main.url,
      text: follow.main.text,
      summary,
      type: 'article',
      category: 'wikipedia',
      heroUrl: await heroUrlFor(follow.main.title, follow.main.thumbnail)
    }))
  }

  let skipped = 0
  let storedReferences = 0
  let cursor = 0
  const referenceUrls = page.references.slice(0, REFERENCE_LIMIT)
  const readers = Array.from({ length: referenceUrls.length }, async () => {
    while (cursor < referenceUrls.length && storedReferences < REFERENCE_LIMIT) {
      const reference = referenceUrls[cursor]
      cursor += 1
      try {
        const read = await readPublicUrl(reference)
        const summary = focusedSummary(read.text, specific, patch.title)
        if (read.text.length < 400 || !mentionsQuestion(read.title, read.text, specific) || (specific.length > 0 && !summary)) {
          skipped += 1
          continue
        }
        const item = await saveLearnedSource({
          patchId: patch.id,
          title: read.title,
          url: read.finalUrl,
          text: read.text,
          summary,
          type: read.kind === 'pdf' ? 'pdf' : 'article',
          category: 'reference',
          heroUrl: await heroUrlFor(read.title, null)
        })
        saved.push(item)
        storedReferences += 1
      } catch {
        skipped += 1
      }
    }
  })
  await Promise.all(readers)

  const results = await findSavedAnswers({
    patchId: patch.id,
    patchTitle: patch.title,
    patchHandle: patch.handle,
    tags: patch.tags.filter((tag): tag is string => typeof tag === 'string'),
    question: question || patch.title,
    userId: session.user.id
  })
  return NextResponse.json({
    success: true,
    source: savedAnswers.length ? 'mixed' : 'web',
    results,
    saved,
    skipped,
    message: savedAnswers.length
      ? 'Started from saved sources, then added new ones.'
      : saved.length
        ? `Saved ${saved.length} source${saved.length === 1 ? '' : 's'} that talk about ${specific.join(' ')}.`
        : 'Nothing found that answers that question.'
  })
}
