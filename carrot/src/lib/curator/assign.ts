import { DESKS, deskById, type Desk } from '@/lib/curator/desks'

function hits(hay: string, terms: string[]): number {
  return terms.filter((term) => term.length > 3 && hay.includes(term.toLowerCase())).length
}

/** One desk owns a video. A weak match stays with the catch-all desk. */
export function chooseDesk(text: string): Desk {
  const hay = text.toLowerCase()
  let best: Desk | null = null
  let score = 0
  for (const desk of DESKS) {
    if (desk.id === 'finds') continue
    const focus = hits(hay, desk.focus || [])
    const beat = hits(hay, desk.beat.split(/[^a-z0-9]+/i))
    const next = focus * 2 + (focus > 0 ? beat : 0)
    if (next > score) {
      score = next
      best = desk
    }
  }
  return (score >= 2 && best) || deskById('finds') || DESKS[0]
}
