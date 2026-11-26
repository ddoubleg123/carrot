const REFLECTION = /\b(stays with me|stay with me|the part that stays|the part i |i keep coming|i can't put|i cannot put|that's the part|that is the part|the whole story|the only question that matters|a picture stays)\b/i
const NAMED = /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3}(?:['’]s)?\b|\b[A-Z]{2,}(?:['’]s)?\b|\b[A-Z]\d+\b/
const NUMBER = /\d/

function sentencesOf(note: string): string[] {
  const body = String(note || '')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !/^\/patch\/\S+$/.test(line) && !/^https?:\/\//.test(line) && !/^(title|when|from|image):/i.test(line))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
  return body.split(/(?<=[.!])\s+/).map((part) => part.trim()).filter(Boolean)
}

/** Sentences that say who did what. A mood, a "she" with no name, and a cut sentence stay out. */
export function plainAccount(note: string): string {
  const kept = sentencesOf(note).filter((sentence) => !REFLECTION.test(sentence) && (NAMED.test(sentence) || NUMBER.test(sentence)))
  const out: string[] = []
  for (const sentence of kept) {
    const next = [...out, sentence].join(' ')
    if (next.length > 480 || out.length === 3) break
    out.push(sentence)
  }
  return out.join(' ')
}

export function saysSomething(note: string): boolean {
  return plainAccount(note).length >= 40
}

/** The account, or the headline when the account says nothing. A question is not an account. */
export function articleExplanation(note: string, title: string): string {
  const told = plainAccount(note)
  if (told) return told
  const head = String(title || '').replace(/\s+/g, ' ').trim()
  if (!head || head.length < 24 || /[?]/.test(head) || /^(how|why|what|who|when|where)\b/i.test(head)) return ''
  return /[.!]$/.test(head) ? head : `${head}.`
}
