const OPEN = /^(it|it's|its|i'm|he's|she's|they're|this|that|these|those|here|there|one|they|he|she|we|but|and|or|so|because|which|who|whose|what|well|uh|um)\b/i
const BORROWED = /\b(the prior ones|every single one|we got here|the numbers)\b/i
const FILLER = /\b(uh|um|er)\b/i
const HOST = /^(i'm |i would |i think |i mean |i want |by the way\b|of course\b)/i
const ADDRESS = /^[A-Z][a-z]{2,},/
const JUNK = />>|&gt;|&lt;|\[music\]|\[applause\]/i
const STUTTER = /\b([A-Za-z']{2,}) \1\b/i
const HANGING_END = /\b(it|this|that|they|them|one)\.$/i
const ASIDE = /\b(i think|this committee|this council|when we talk)\b/i
const POINTED = /^(if you|when we)\b/i
const INSTRUCTION = /^(heat|preheat|bake|stir|mix|add|pour|line|chop|slice|dice|whisk|simmer|boil|fry|roast|grill|season|combine|place|cover|remove|transfer|serve|cook|fold|spread|brush|drain|rinse|toss|sprinkle|bring|reduce)\b/i
const RECIPE = /\b(tbsp|tsp|tablespoons?|teaspoons?|gas \d|baking trays?|preheat|°[cf])\b|\b\d+\s*(ml|g|kg|oz|cups?|grams?)\b|\b(he|she|they)\s+(combines?|adds?|mixes?|pours?|stirs?)\b/i
const ROLE = /^(the|a|an)\s+(?:[a-z0-9'-]+\s+){0,6}(champion|forward|passenger|seamer|player|driver|chef|minister|guy|star|rookie|official)(?![-'])\b/i
const VAGUE = /^(the|this|that)\s+(deal|move|change|decision|plan|bill|report|study|news|story|announcement)\b/i
const PRONOUN = /,\s*(he|she|they|it)\b/i
const GLUED = /\b[a-z]{2,} (A|The) [a-z]|\s[-–—]\s/
const CREDIT = /\b(shutterstock|getty|reuters)\b/i
const BEAT = /^(cricket|tennis|food|fashion|rugby|mlb|baseball|hockey|formula 1|college football|nfl|nba)$/i

export interface QuoteCard {
  sentence: string
  source: string
  /** When the quote was made. Empty when the page did not say. */
  date: string
}

/** One whole sentence a stranger can read with the article and the video hidden. */
export function quoteSentence(source: string): string | null {
  const text = source.replace(/\s+/g, ' ').replace(/[“”]/g, '"').replace(/[‘’]/g, "'").trim()
  if (!text) return null
  const ready = text.split(/(?<=[.])\s+/).map((part) => part.trim()).filter(standsAlone)
  if (ready.length === 0) return null
  return ready.find((sentence) => /\d/.test(sentence)) || ready[0]
}

function standsAlone(sentence: string): boolean {
  if (!sentence.endsWith('.') || sentence.includes('?') || sentence.includes('…')) return false
  if (FILLER.test(sentence) || HOST.test(sentence) || ADDRESS.test(sentence) || ASIDE.test(sentence) || POINTED.test(sentence) || JUNK.test(sentence) || STUTTER.test(sentence) || HANGING_END.test(sentence)) return false
  if (INSTRUCTION.test(sentence) || RECIPE.test(sentence) || ROLE.test(sentence) || VAGUE.test(sentence) || PRONOUN.test(sentence) || GLUED.test(sentence) || CREDIT.test(sentence)) return false
  if (/\b(his|her|their)\b/i.test(sentence)) {
    const at = sentence.search(/\b(his|her|their)\b/i)
    if (!/[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+/.test(sentence.slice(0, at))) return false
  }
  const words = sentence.slice(0, -1).split(/\s+/).filter(Boolean)
  if (words.length < 12 || words.length > 40) return false
  if (OPEN.test(sentence) || BORROWED.test(sentence)) return false
  const named = /[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+/.test(sentence)
  const number = /\d/.test(sentence)
  return named || number
}

export interface QuoteGrade {
  pass: boolean
  failures: string[]
}

/**
 * The checklist for one card. A miss stays off the feed.
 * The hunt tries the next sentence in the same piece before it gives up.
 */
export function quoteGrade(card: QuoteCard & { image?: string | null }): QuoteGrade {
  const failures: string[] = []
  const sentence = card.sentence.replace(/\s+/g, ' ').trim()
  if (quoteSentence(sentence) !== sentence) failures.push('The sentence cannot stand on its own.')
  if (!card.source.trim() || BEAT.test(card.source.trim())) failures.push('The card does not name who it came from.')
  if (!card.date.trim()) failures.push('The card does not give the date.')
  if (!String(card.image || '').trim()) failures.push('The card has no picture.')
  return { pass: failures.length === 0, failures }
}

/** The picture is hidden. Fail closed when the check cannot be run. */
export async function strangerPass(sentence: string): Promise<boolean> {
  const key = process.env.DEEPSEEK_API_KEY || ''
  if (!key || !standsAlone(sentence)) return false
  try {
    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'deepseek-flash',
        temperature: 0,
        max_tokens: 40,
        thinking: { type: 'disabled' },
        messages: [{
          role: 'user',
          content: `A stranger has not seen the video or the article. Read only this sentence.
Pass only if they can point at what it is about, and every it, this, that, they, here, and one has its meaning inside the sentence.
Fail a greeting, a thank-you, a direct address, a question to someone in the room, a sentence that needs the previous line, and a step in a method or a recipe.
Reply JSON only: {"pass":true} or {"pass":false}

${sentence}`
        }]
      }),
      signal: AbortSignal.timeout(20000)
    })
    if (!response.ok) return false
    const data = await response.json().catch(() => null)
    const raw = String(data?.choices?.[0]?.message?.content || '')
    const match = raw.match(/\{[\s\S]*\}/)
    if (!match) return false
    return (JSON.parse(match[0]) as { pass?: unknown }).pass === true
  } catch {
    return false
  }
}

export function quotePost(sentence: string, source: string, date = ''): string {
  const from = source.replace(/\s+/g, ' ').trim()
  const when = date.replace(/\s+/g, ' ').trim()
  return ['kind: quote', from ? `source: ${from}` : '', when ? `when: ${when}` : '', '', sentence].filter((line) => line !== '').join('\n')
}

export function readQuote(content?: string | null): QuoteCard | null {
  const lines = String(content || '').split('\n')
  if (!/^kind:\s*quote\s*$/i.test(lines[0]?.trim() || '')) return null
  let source = ''
  let date = ''
  const sentence: string[] = []
  for (const line of lines.slice(1)) {
    const trimmed = line.trim()
    if (/^source:\s*/i.test(trimmed)) {
      source = trimmed.replace(/^source:\s*/i, '').trim()
      continue
    }
    if (/^when:\s*/i.test(trimmed)) {
      date = trimmed.replace(/^when:\s*/i, '').trim()
      continue
    }
    if (!trimmed && sentence.length === 0) continue
    sentence.push(line)
  }
  const text = sentence.join('\n').trim()
  if (!text) return null
  return { sentence: text, source, date }
}
