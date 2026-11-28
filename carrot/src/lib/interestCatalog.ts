import { deskById } from '@/lib/curator/desks'

export const PICKER_IDS = [
  'science', 'history', 'world', 'technology', 'money', 'health',
  'climate', 'cities', 'culture', 'law', 'finds'
] as const

export type InterestGroup = {
  id: string
  name: string
  beat: string
  terms: string[]
}

export type InterestPick = {
  id: string
  label: string
  terms: string[]
  kind: 'desk' | 'ask'
  because?: string
}

export function interestGroups(extra: Record<string, string[]> = {}): InterestGroup[] {
  const groups: InterestGroup[] = []
  for (const id of PICKER_IDS) {
    const desk = deskById(id)
    if (!desk) continue
    const words = [desk.name, desk.beat, ...(desk.focus || []), ...(desk.route || []), ...(extra[id] || [])]
    const terms = [...new Set(words.map((word) => word.toLowerCase().trim()).filter((word) => word.length > 2))]
    groups.push({ id: desk.id, name: desk.name, beat: desk.beat, terms })
  }
  return groups
}

export function groupById(id: string, groups = interestGroups()): InterestGroup | undefined {
  return groups.find((group) => group.id === id)
}

const STOP = new Set('the a an and or of to for in on with your you that this from are was were have has had about into over what when how who why not just like likes love want really very into'.split(' '))

export function interestTokens(text: string): string[] {
  return [...new Set(
    text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((word) => word.length > 2 && !STOP.has(word))
  )]
}

export function askId(name: string): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 32)
  return `ask:${slug || 'topic'}`
}

export function sanitizePicks(raw: unknown, groups = interestGroups()): InterestPick[] {
  if (!Array.isArray(raw)) return []
  const picks: InterestPick[] = []
  const seen = new Set<string>()
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const row = item as Record<string, unknown>
    const kind = row.kind === 'ask' ? 'ask' : 'desk'
    const id = String(row.id || '').trim()
    const label = String(row.label || '').replace(/\s+/g, ' ').trim().slice(0, 48)
    if (!label || seen.has(id)) continue
    if (kind === 'desk' && !groups.some((group) => group.id === id)) continue
    if (kind === 'ask' && !id.startsWith('ask:')) continue
    const terms = Array.isArray(row.terms)
      ? row.terms.map((term) => String(term || '').trim().toLowerCase()).filter((term) => term.length > 2 && term.length < 40).slice(0, 5)
      : []
    seen.add(id)
    picks.push({ id, label, terms, kind, because: typeof row.because === 'string' ? row.because.slice(0, 160) : undefined })
    if (picks.length >= 8) break
  }
  return picks
}
