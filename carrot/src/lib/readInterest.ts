import path from 'path'
import { config as loadEnv } from 'dotenv'
import { askId, groupById, interestGroups, interestTokens, type InterestGroup } from '@/lib/interestCatalog'

export type InterestMatch = {
  id: string
  label: string
  kind: 'group' | 'term'
  terms: string[]
  because: string
}

export type InterestProposal = {
  id: string
  name: string
  because: string
  nearest: string | null
  nearestLabel: string | null
  terms: string[]
}

export type InterestReading = {
  matches: InterestMatch[]
  proposals: InterestProposal[]
}

function wordsOf(group: InterestGroup): Set<string> {
  const bag = new Set<string>()
  for (const term of group.terms) {
    for (const token of interestTokens(term)) bag.add(token)
  }
  return bag
}

function titleFrom(tokens: string[]): string {
  const name = tokens.slice(0, 3).map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
  return name.slice(0, 32) || 'New topic'
}

/** Match a sentence to groups we already have. No model required. */
export function readInterestText(text: string, groups = interestGroups()): InterestReading {
  const tokens = interestTokens(text).slice(0, 24)
  const matches: InterestMatch[] = []
  const used = new Set<string>()
  let nearest: { id: string; label: string; score: number } | null = null

  for (const group of groups) {
    const bag = wordsOf(group)
    const nameBag = new Set(interestTokens(group.name))
    const hits = tokens.filter((token) => bag.has(token))
    const nameHits = tokens.filter((token) => nameBag.has(token))
    if (!nearest || hits.length > nearest.score) nearest = { id: group.id, label: group.name, score: hits.length }
    if (nameHits.length > 0 || hits.length >= 2) {
      hits.forEach((hit) => used.add(hit))
      nameHits.forEach((hit) => used.add(hit))
      matches.push({
        id: group.id,
        label: group.name,
        kind: 'group',
        terms: [],
        because: `Matches ${group.name}.`
      })
      continue
    }
    if (hits.length === 1) {
      used.add(hits[0])
      matches.push({
        id: group.id,
        label: group.name,
        kind: 'term',
        terms: hits,
        because: `${group.name}, including ${hits[0]}.`
      })
    }
  }

  const leftover = tokens.filter((token) => !used.has(token))
  const proposals: InterestProposal[] = []
  if (matches.length === 0 && leftover.length > 0) {
    const close = nearest && nearest.score > 0 ? nearest : null
    const name = titleFrom(leftover)
    proposals.push({
      id: askId(name),
      name,
      because: close
        ? `Nothing we have is this. Closest group is ${close.label}.`
        : 'Nothing we have is this.',
      nearest: close?.id || null,
      nearestLabel: close?.label || null,
      terms: leftover.slice(0, 5)
    })
  }
  return { matches, proposals }
}

function deepseekKey(): string {
  if (process.env.DEEPSEEK_API_KEY) return process.env.DEEPSEEK_API_KEY
  try { loadEnv({ path: path.join(process.cwd(), '.env.local') }) } catch {}
  return process.env.DEEPSEEK_API_KEY || ''
}

function sanitize(raw: unknown, groups: InterestGroup[]): InterestReading | null {
  if (!raw || typeof raw !== 'object') return null
  const body = raw as { matches?: unknown; proposals?: unknown }
  const matches: InterestMatch[] = []
  if (Array.isArray(body.matches)) {
    for (const item of body.matches) {
      if (!item || typeof item !== 'object') continue
      const row = item as { id?: unknown; kind?: unknown; terms?: unknown }
      const group = groupById(String(row.id || ''), groups)
      if (!group) continue
      const kind = row.kind === 'term' ? 'term' : 'group'
      const terms = Array.isArray(row.terms)
        ? row.terms.map((term) => String(term || '').trim().toLowerCase()).filter((term) => term.length > 2).slice(0, 3)
        : []
      matches.push({
        id: group.id,
        label: group.name,
        kind,
        terms,
        because: kind === 'term' && terms[0] ? `${group.name}, including ${terms[0]}.` : `Matches ${group.name}.`
      })
    }
  }
  const proposals: InterestProposal[] = []
  if (Array.isArray(body.proposals)) {
    for (const item of body.proposals) {
      if (!item || typeof item !== 'object') continue
      const row = item as { name?: unknown; nearest?: unknown; terms?: unknown }
      const name = String(row.name || '').replace(/\s+/g, ' ').trim().slice(0, 32)
      if (name.length < 3) continue
      const nearest = groupById(String(row.nearest || ''), groups)
      const terms = Array.isArray(row.terms)
        ? row.terms.map((term) => String(term || '').trim().toLowerCase()).filter((term) => term.length > 2).slice(0, 5)
        : interestTokens(name)
      proposals.push({
        id: askId(name),
        name,
        because: nearest ? `Nothing we have is this. Closest group is ${nearest.name}.` : 'Nothing we have is this.',
        nearest: nearest?.id || null,
        nearestLabel: nearest?.name || null,
        terms
      })
    }
  }
  if (!matches.length && !proposals.length) return null
  return { matches, proposals }
}

export async function readInterest(text: string, groups = interestGroups()): Promise<InterestReading> {
  const local = readInterestText(text, groups)
  const key = deepseekKey()
  const sentence = text.replace(/\s+/g, ' ').trim().slice(0, 280)
  if (!key || sentence.length < 3) return local
  const catalog = groups.map((group) => `${group.id} | ${group.name} | ${group.beat}`).join('\n')
  try {
    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'deepseek-flash',
        temperature: 0,
        max_tokens: 300,
        thinking: { type: 'disabled' },
        messages: [{
          role: 'user',
          content: `Groups, one per line as id | name | what it covers:
${catalog}

The person wrote: ${sentence}

Reply JSON only.
matches: groups this is already about. kind "group" when the sentence is that group. kind "term" when it is a narrower word that belongs under that group. terms is the narrower words.
proposals: only the part that fits no group. name is a short topic. nearest is the closest group id or null.
Use only ids from the list. Do not invent a public group.
{"matches":[{"id":"","kind":"group","terms":[]}],"proposals":[{"name":"","nearest":null,"terms":[]}]}`
        }]
      }),
      signal: AbortSignal.timeout(12000)
    })
    if (!response.ok) return local
    const data = await response.json().catch(() => null)
    const raw = String(data?.choices?.[0]?.message?.content || '')
    const match = raw.match(/\{[\s\S]*\}/)
    if (!match) return local
    return sanitize(JSON.parse(match[0]), groups) || local
  } catch {
    return local
  }
}
