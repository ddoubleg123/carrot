import { deskByUsername } from '@/lib/curator/desks'

/** How many hours a signal moves that subject's posts. Follow is applied at read time. */
export const TASTE_HOURS = { follow: 12, carrot: 6, open: 2, stick: -8 } as const
export const TASTE_LEARN_AFTER = 3
const HOUR_CAP = 72
const MARK_CAP = 400

export type TasteMark = 'open' | 'carrot' | 'stick'

export type TasteState = {
  seeded: boolean
  signals: number
  desks: Record<string, number>
  marks: { id: string; mark: TasteMark }[]
}

export function emptyTaste(): TasteState {
  return { seeded: false, signals: 0, desks: {}, marks: [] }
}

export function subjectOf(username: string | null | undefined, userId: string): string {
  const desk = deskByUsername(username)
  return desk ? desk.id : `person:${userId}`
}

function clamp(n: number): number {
  return Math.max(-HOUR_CAP, Math.min(HOUR_CAP, n))
}

export function parseTaste(raw: unknown): TasteState {
  const taste = emptyTaste()
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return taste
  const row = raw as { seeded?: unknown; signals?: unknown; desks?: unknown; marks?: unknown }
  taste.seeded = row.seeded === true
  taste.signals = typeof row.signals === 'number' && row.signals > 0 ? Math.floor(row.signals) : 0
  if (row.desks && typeof row.desks === 'object' && !Array.isArray(row.desks)) {
    for (const [key, value] of Object.entries(row.desks as Record<string, unknown>)) {
      if (typeof value === 'number' && Number.isFinite(value) && value !== 0) taste.desks[key] = clamp(value)
    }
  }
  if (Array.isArray(row.marks)) {
    for (const item of row.marks) {
      if (!item || typeof item !== 'object') continue
      const id = String((item as { id?: unknown }).id || '')
      const mark = (item as { mark?: unknown }).mark
      if (!id || (mark !== 'open' && mark !== 'carrot' && mark !== 'stick')) continue
      taste.marks.push({ id, mark })
    }
    if (taste.marks.length > MARK_CAP) taste.marks = taste.marks.slice(taste.marks.length - MARK_CAP)
  }
  return taste
}

function put(desks: Record<string, number>, subject: string, hours: number) {
  const next = clamp(hours)
  if (next === 0) delete desks[subject]
  else desks[subject] = next
}

/** Record one action on a subject. Null clears a carrot or a stick. Open does not replace either. */
export function setMark(taste: TasteState, subject: string, postId: string, mark: TasteMark | null): TasteState {
  const prev = taste.marks.find((item) => item.id === postId)
  if (mark === 'open' && prev) return taste
  if (mark && prev?.mark === mark) return { ...taste, seeded: true }
  const desks = { ...taste.desks }
  let signals = taste.signals
  let marks = taste.marks.filter((item) => item.id !== postId)
  if (mark === null) {
    if (prev && prev.mark !== 'open') put(desks, subject, (desks[subject] || 0) - TASTE_HOURS[prev.mark])
    else if (prev) marks = [...marks, prev]
    return { ...taste, seeded: true, desks, marks }
  }
  if (!prev) signals += 1
  else put(desks, subject, (desks[subject] || 0) - TASTE_HOURS[prev.mark])
  put(desks, subject, (desks[subject] || 0) + TASTE_HOURS[mark])
  marks = [...marks, { id: postId, mark }]
  if (marks.length > MARK_CAP) marks = marks.slice(marks.length - MARK_CAP)
  return { ...taste, seeded: true, signals, desks, marks }
}
