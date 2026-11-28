import { quoteIsExact } from '@/lib/curator/qa'

export interface KeptQuote {
  sentence: string
  speaker: string
  date: string
}

const SPEECH = /\b(said|wrote|told|declared|argued|warned|asked|replied|insisted|observed|remarked|proclaimed|vowed|recalled|added)\b/i
const NAME = String.raw`[A-Z][a-z'’]{2,}(?:\s+[A-Z][a-z'’]{2,}){1,3}(?:\s+(?:Jr|Sr)\.|\s+(?:III|II))?`
const PERSON = new RegExp(String.raw`\b${NAME}(?!\w)`, 'g')
const MONTH = /^(January|February|March|April|May|June|July|August|September|October|November|December|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)$/
const NOT_A_PERSON = /\b(United States|United Nations|New York|Los Angeles|White House|Supreme Court|Associated Press|Times|Post|News|Journal|Review|Magazine|Press|Herald|Tribune|Guardian|Reuters|Bloomberg|Congress|Senate|Parliament)\b/
const LABEL = /^(Note|Image|Photo|Source|Caption|Credit|Video|Audio|File|Page|Chapter|Figure|Table)$/i
const NEWS_DAY = /\b(on monday|on tuesday|on wednesday|on thursday|on friday|on saturday|on sunday|last week|this week|earlier today|earlier this week|yesterday|this morning)\b/i
const LEDGER = /\b(the bill|a bill|appropriations|amendment|would require|statute|field goal|touchdown|three-pointer|defeated|subscribe|cookie policy|all rights reserved|click here|featured by|shutterstock|getty images|photo shows|the caption|according to (?:a |the )?(?:report|study|officials)|newsletter|read more|copyright)\b/i
const HOST = /^(i'm joined|i am joined|welcome back|thanks for watching|thanks for having|as always)\b/i
const JUNK = />>|\[music\]|\[applause\]|https?:\/\//i
const FULL_DATE = /\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+\d{4}\b/
const IN_YEAR = /\bin\s+(1\d{3}|20\d{2})\b/

/** A news report, a caption, a score, a bill, or page text. Empty when the line can still be a quote. */
export function notAQuote(sentence: string): boolean {
  const line = sentence.replace(/\s+/g, ' ').trim()
  if (!/[.!?]$/.test(line)) return true
  if (HOST.test(line) || NEWS_DAY.test(line) || LEDGER.test(line) || JUNK.test(line)) return true
  const words = line.slice(0, -1).split(/\s+/).filter(Boolean)
  return words.length < 7 || words.length > 45
}

function personOk(name: string): boolean {
  if (NOT_A_PERSON.test(name) || LABEL.test(name)) return false
  return !name.replace(/\./g, '').split(/\s+/).some((part) => MONTH.test(part))
}

function tidy(sentence: string): string {
  let line = sentence.replace(/\s+/g, ' ').replace(/[“”]/g, '"').trim()
  line = line.replace(/^["'\s]+|["'\s]+$/g, '').replace(/[,:;]+$/, '').trim()
  if (!line) return ''
  if (!/[.!?]$/.test(line)) line = `${line}.`
  return line
}

function sentencesIn(inner: string): string[] {
  const parts = inner.split(/(?<=[.!?])\s+/).map(tidy).filter((line) => line && !notAQuote(line))
  if (parts.length) return parts
  const whole = tidy(inner)
  return whole && !notAQuote(whole) ? [whole] : []
}

function speakerFor(window: string, quote: string): string {
  const at = window.indexOf(quote)
  const after = at >= 0 ? window.slice(at + quote.length, at + quote.length + 96) : ''
  const dash = after.match(new RegExp(String.raw`^[\s,"'“”]*[—–-]\s*(${NAME})(?!\w)`))
  if (dash && personOk(dash[1])) return dash[1].replace(/\s+/g, ' ').trim()
  const names = [...window.matchAll(PERSON)].map((match) => match[0]).filter((name) => personOk(name) && !quote.includes(name))
  const named = names.filter((name) => {
    const spot = window.indexOf(name)
    const near = window.slice(Math.max(0, spot - 48), spot + name.length + 48)
    return SPEECH.test(near)
  })
  return named.sort((a, b) => b.length - a.length)[0]?.replace(/\s+/g, ' ').trim() || ''
}

function spokenWhen(window: string): string {
  return window.match(FULL_DATE)?.[0] || window.match(IN_YEAR)?.[1] || ''
}

/** Lines a person said or wrote, copied from the saved text. The wording is the text's own. */
export function keptQuotes(text: string): KeptQuote[] {
  const clean = text.replace(/\s+/g, ' ').trim()
  if (clean.length < 40) return []
  const found: KeptQuote[] = []
  const seen = new Set<string>()
  const add = (sentence: string, speaker: string, window: string) => {
    const line = tidy(sentence)
    const who = speaker.replace(/\s+/g, ' ').trim()
    if (!line || !who || notAQuote(line) || !quoteIsExact(line, clean)) return
    const key = line.toLowerCase()
    if (seen.has(key)) return
    seen.add(key)
    found.push({ sentence: line, speaker: who, date: spokenWhen(window) })
  }
  const quoted = /[“"]([^“”"]{24,500})[”"]/g
  let match: RegExpExecArray | null
  while ((match = quoted.exec(clean))) {
    const inner = match[1]
    const window = clean.slice(Math.max(0, match.index - 180), Math.min(clean.length, match.index + match[0].length + 180))
    const speaker = speakerFor(window, inner)
    if (!speaker) continue
    for (const sentence of sentencesIn(inner)) add(sentence, speaker, window)
  }
  const labeled = /\b([A-Z][a-z'’]{2,}(?:\s+[A-Z][a-z'’]{2,}){1,3}):\s+([A-Z][^:]{24,400}?[.!?])(?=\s|$)/g
  while ((match = labeled.exec(clean))) {
    if (!personOk(match[1]) || LABEL.test(match[1])) continue
    const window = clean.slice(Math.max(0, match.index - 80), Math.min(clean.length, match.index + match[0].length + 120))
    for (const sentence of sentencesIn(match[2])) add(sentence, match[1], window)
  }
  return found.slice(0, 6)
}
