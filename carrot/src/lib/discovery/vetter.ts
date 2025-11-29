import { createHash } from 'node:crypto'

const VETTER_SYSTEM_PROMPT = `You CLEAN, SCORE, and SYNTHESIZE exactly ONE fetched source into a hero-ready card. Return STRICT JSON ONLY (parser is unforgiving).

Rules:
- Map every fact and each quote to a citation URL plus locator (anchor text, section, or timestamp).
- For each fact, include evidence anchors with CSS/XPath plus context offsets (see schema below).
- Fair use: up to TWO quoted paragraphs total (≤150 words combined), each with attribution; otherwise paraphrase with citations.
- Only add a contested note when the source itself advances or disputes a listed claim.
- Capture quoted word count, publish date, and SFW flag.
- Do **not** reject solely because the source is controversial or represents a minority viewpoint.
- Reject only if the cleaned source has <200 substantive words, relevance is below the threshold provided, qualityScore < 70, or facts lack supporting citations.
- Reject if the source asserts criminal conduct about a private individual without at least one Tier1/Tier2 credentialed citation (Reuters, AP, FT, WSJ, WaPo, NYT, BBC, Bloomberg, Guardian, NPR, Axios, Politico, Al-Monitor, France24).
- Strip or redact PII (emails, phone numbers, street addresses); if removal changes meaning or context, reject the source.`

interface VetterArgs {
  topic: string
  aliases: string[]
  url: string
  text: string
  contestedClaims?: string[]
}

export interface VetterFact {
  label: string
  value: string
  citation: string
  evidence?: VetterEvidence[]
}

export interface VetterQuote {
  text: string
  speaker?: string
  citation: string
}

export interface VetterContested {
  note: string
  supporting: string
  counter: string
  claim?: string
}

export interface VetterEvidenceAnchor {
  cssPath?: string
  xpath?: string
  startOffset?: number
  endOffset?: number
  preContext?: string
  postContext?: string
}

export interface VetterEvidence {
  url: string
  anchor: VetterEvidenceAnchor
}

export interface VetterResult {
  isUseful: boolean
  relevanceScore: number
  qualityScore: number
  importanceScore: number // 0-100: How important/significant this content is to the core subject
  whyItMatters: string
  facts: VetterFact[]
  quotes: VetterQuote[]
  provenance: string[]
  contested: VetterContested | null
  quotedWordCount: number
  isSfw: boolean
  publishDate?: string
}

export const __vetterPrompts = {
  SYSTEM_PROMPT: VETTER_SYSTEM_PROMPT,
  buildUserPrompt
}

const DEEPSEEK_ENDPOINT = 'https://api.deepseek.com/v1/chat/completions'

const TIER1_DOMAINS = new Set([
  'reuters.com',
  'apnews.com',
  'ap.org',
  'ft.com',
  'wsj.com',
  'washingtonpost.com',
  'nytimes.com',
  'bbc.co.uk',
  'bbc.com'
])

const TIER2_DOMAINS = new Set([
  'bloomberg.com',
  'theguardian.com',
  'npr.org',
  'axios.com',
  'politico.com',
  'al-monitor.com',
  'france24.com'
])

const CRIMINAL_KEYWORDS = [
  'arrested',
  'charged',
  'indicted',
  'convicted',
  'crime',
  'criminal',
  'felony',
  'manslaughter',
  'murder',
  'homicide',
  'assault',
  'fraud',
  'embezzle',
  'rape',
  'sexual assault',
  'terrorism'
]

const EMAIL_REGEX = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i
const PHONE_REGEX = /\b(?:\+?\d{1,3}[\s.-]?)?(?:\(\d{3}\)|\d{3})[\s.-]?\d{3}[\s.-]?\d{4}\b/
const ADDRESS_REGEX = /\b\d{2,5}\s+[^\n,]+\s+(street|st\.?|avenue|ave\.?|road|rd\.?|drive|dr\.?|lane|ln\.?|boulevard|blvd\.?|court|ct\.?|way)\b/i

function stripMarkdownFence(payload: string): string {
  return payload
    .replace(/^```json\s*/i, '')
    .replace(/```$/i, '')
    .trim()
}

function buildUserPrompt({ topic, aliases, url, text, contestedClaims }: VetterArgs): string {
  const aliasesCSV = aliases.length ? aliases.join(', ') : '—'
  const contestedSection = contestedClaims && contestedClaims.length
    ? `
Contested claims to monitor:
${contestedClaims.map((claim, index) => `${index + 1}. ${claim}`).join('\n')}
If the source engages with any of these, include "claim" in the contested object matching the exact text shown above.`
    : ''
  return `Topic: "${topic}" (aliases: ${aliasesCSV})
Source URL: ${url}
Source HTML/Text (cleaned extract): <<<${text}>>>

Tasks:
1) Relevance (0–1) and Quality (0–100). Off-topic if title/H1 lacks topic/alias.
2) Importance (0–100): Evaluate how SIGNIFICANT this content is to the core subject matter.
   - HIGH IMPORTANCE (80-100): Core subject matter, key people, major events, franchise history, foundational concepts, legacy-defining moments, championship seasons, dynasty eras, transformative trades/signings, coaching philosophies that shaped the organization.
   - MEDIUM IMPORTANCE (50-79): Current roster analysis, season previews, player development, draft picks, significant but routine news, strategic decisions.
   - LOW IMPORTANCE (0-49): Game recaps, routine injury updates, trade rumors, social media posts, daily news, match previews, post-game quotes, minor transactions.
   Score based on whether this content addresses what REALLY MATTERS about the topic vs. just being tangentially related news.
3) Why it matters: 1–2 concise sentences tailored to the topic, include publish date hints.
4) Facts: 3–6 bullets with dates/numbers; each must map to a citation AND include an evidence array with anchors {cssPath|xpath,startOffset,endOffset,preContext,postContext}.
5) Quotes (optional): up to 3 SHORT verbatim quotes (<=25 words each) with speaker + citation + anchor; track total quoted words.
6) Contested (optional): if this source advances or disputes a controversial claim, add a compact "contested" note with one supporting and one counter source (URLs).
7) Provenance: array of source URLs (this URL first; add on-page anchors when possible).

Return JSON ONLY:
{
  "isUseful": true,
  "relevanceScore": 0.00,
  "qualityScore": 0,
  "importanceScore": 0,
  "whyItMatters": "...",
  "facts": [{
    "label":"...",
    "value":"...",
    "citation":"url#anchor",
    "evidence": [{
      "url": "...",
      "anchor": {
        "cssPath": "...",
        "xpath": "...",
        "startOffset": 0,
        "endOffset": 0,
        "preContext": "...",
        "postContext": "..."
      }
    }]
  }],
  "quotes": [{"text":"...", "speaker":"...", "citation":"url#anchor"}],
  "contested": {"note":"...", "supporting":"url", "counter":"url", "claim":"exact contested claim when applicable"} | null,
  "provenance": ["url#anchor", "..."],
  "quotedWordCount": 0,
  "isSfw": true,
  "publishDate": "YYYY-MM-DD"
}

Reject if:
- <200 words substantive text,
- qualityScore < 70,
- relevanceScore < 0.65 (strict),
- no mappable citations for facts/quotes.${contestedSection}`
}

function getApiKey(): string {
  const key = process.env.DEEPSEEK_API_KEY
  if (!key) {
    throw new Error('DeepSeek API key missing')
  }
  return key
}

export function normaliseArray<T>(value: unknown, mapper: (entry: any) => T | null | undefined): T[] {
  if (!Array.isArray(value)) return []
  return value
    .map(mapper)
    .filter((entry): entry is T => Boolean(entry))
}

function sanitiseResponsePayload(payload: string): string {
  return stripMarkdownFence(payload)
}

export async function vetSource(args: VetterArgs): Promise<VetterResult> {
  const apiKey = getApiKey()
  const userPrompt = buildUserPrompt(args)
  const patchIdForLog = (() => {
    const candidate = (globalThis as { patchId?: unknown })?.patchId
    return typeof candidate === 'string' ? candidate : '(n/a)'
  })()
  console.info(
    `[DISCOVERY_V2][VETTER_PROMPT] patch=${patchIdForLog} sysHash=${createHash('sha256')
      .update(VETTER_SYSTEM_PROMPT)
      .digest('hex')} userHash=${createHash('sha256').update(userPrompt).digest('hex')} sysHead="${VETTER_SYSTEM_PROMPT.slice(0, 120).replace(/\s+/g, ' ')}" userHead="${userPrompt
      .slice(0, 120)
      .replace(/\s+/g, ' ')}"`
  )

  const response = await fetch(DEEPSEEK_ENDPOINT, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: VETTER_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.2,
      max_tokens: 2200,
      stream: false
    })
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => '')
    throw new Error(`deepseek_vetter_http_${response.status}:${errorText.slice(0, 200)}`)
  }

  const body = await response.json()
  const raw = body?.choices?.[0]?.message?.content
  if (!raw || typeof raw !== 'string') {
    throw new Error('deepseek_vetter_empty')
  }

  const cleaned = sanitiseResponsePayload(raw)
  let parsed: any
  try {
    parsed = JSON.parse(cleaned)
  } catch (_error) {
    console.error('[Vetter] Failed to parse JSON payload', cleaned)
    throw new Error('deepseek_vetter_parse_error')
  }

  const facts = normaliseArray(parsed.facts, (fact) => {
    if (!fact || typeof fact !== 'object') return null
    if (typeof fact.label !== 'string' || typeof fact.value !== 'string' || typeof fact.citation !== 'string') {
      return null
    }
    return {
      label: fact.label.trim(),
      value: fact.value.trim(),
      citation: fact.citation.trim(),
      evidence: normaliseArray(fact.evidence, parseEvidence)
    }
  })

  const quotes = normaliseArray(parsed.quotes, (quote) => {
    if (!quote || typeof quote !== 'object') return null
    if (typeof quote.text !== 'string' || typeof quote.citation !== 'string') {
      return null
    }
    return {
      text: quote.text.trim(),
      speaker: typeof quote.speaker === 'string' ? quote.speaker.trim() : undefined,
      citation: quote.citation.trim()
    }
  })

  const provenance = normaliseArray(parsed.provenance, (entry) => {
    if (typeof entry !== 'string') return null
    return entry.trim()
  })

  const contestedValue = parsed.contested && typeof parsed.contested === 'object'
    ? {
        note: String(parsed.contested.note || '').trim(),
        supporting: String(parsed.contested.supporting || '').trim(),
        counter: String(parsed.contested.counter || '').trim(),
        claim: parsed.contested.claim ? String(parsed.contested.claim).trim() : undefined
      }
    : null

  const combinedNarrative = [
    typeof parsed.whyItMatters === 'string' ? parsed.whyItMatters : '',
    ...facts.map((fact) => fact.value),
    ...quotes.map((quote) => quote.text)
  ].join(' ')

  if (containsPII(combinedNarrative)) {
    throw new Error('deepseek_vetter_pii_detected')
  }

  // Enforce publish date presence for off-wiki pages
  const publishDate: string | undefined = typeof parsed.publishDate === 'string' ? parsed.publishDate.trim() : undefined
  if (!publishDate) {
    throw new Error('publish_date_missing')
  }

  // Enforce anchored evidence on all facts
  for (const fact of facts) {
    if (!fact.evidence || !Array.isArray(fact.evidence) || fact.evidence.length === 0) {
      throw new Error('anchor_missing')
    }
    const ok = fact.evidence.some((e) => !!(e.anchor?.cssPath || e.anchor?.xpath))
    if (!ok) {
      throw new Error('anchor_missing')
    }
  }

  // Cap quoted words to <= 100
  const quotedWordCountCalc = Number(parsed.quotedWordCount ?? quotes.reduce((sum, quote) => sum + quote.text.split(/\s+/).filter(Boolean).length, 0))
  if (quotedWordCountCalc > 100) {
    // Non-fatal: trim quotes list to 100 words total
    let remaining = 100
    const trimmed: typeof quotes = []
    for (const q of quotes) {
      const words = q.text.split(/\s+/).filter(Boolean)
      if (remaining <= 0) break
      const take = Math.min(words.length, remaining)
      trimmed.push({ ...q, text: words.slice(0, take).join(' ') })
      remaining -= take
    }
    parsed.quotes = trimmed
  }

  for (const fact of facts) {
    if (mentionsCriminalKeyword(fact.value) && !hasTierCitation(fact.citation)) {
      throw new Error('deepseek_vetter_defamation_guard')
    }
  }

  for (const quote of quotes) {
    if (mentionsCriminalKeyword(quote.text) && !hasTierCitation(quote.citation)) {
      throw new Error('deepseek_vetter_defamation_guard')
    }
  }

  return {
    isUseful: parsed.isUseful !== false,
    relevanceScore: Number(parsed.relevanceScore ?? 0),
    qualityScore: Number(parsed.qualityScore ?? 0),
    importanceScore: Number(parsed.importanceScore ?? 50), // Default to medium if not provided
    whyItMatters: typeof parsed.whyItMatters === 'string' ? parsed.whyItMatters.trim() : '',
    facts,
    quotes: normaliseArray(parsed.quotes, (quote) => {
      if (!quote || typeof quote !== 'object') return null
      if (typeof quote.text !== 'string' || typeof quote.citation !== 'string') {
        return null
      }
      return {
        text: quote.text.trim(),
        speaker: typeof quote.speaker === 'string' ? quote.speaker.trim() : undefined,
        citation: quote.citation.trim()
      }
    }),
    provenance: provenance.length ? provenance : [args.url],
    contested: contestedValue && contestedValue.note ? contestedValue : null,
    quotedWordCount: Number(parsed.quotedWordCount ?? 0),
    isSfw: parsed.isSfw !== false,
    publishDate
  }
}

function containsPII(payload: string): boolean {
  if (!payload) return false
  return EMAIL_REGEX.test(payload) || PHONE_REGEX.test(payload) || ADDRESS_REGEX.test(payload)
}

function mentionsCriminalKeyword(text: string): boolean {
  if (!text) return false
  const lower = text.toLowerCase()
  return CRIMINAL_KEYWORDS.some((keyword) => lower.includes(keyword))
}

function hasTierCitation(citation: string): boolean {
  if (!citation) return false
  const hosts = extractCitationHosts(citation)
  if (hosts.some((host) => TIER1_DOMAINS.has(host) || TIER2_DOMAINS.has(host))) {
    return true
  }
  const raw = citation.toLowerCase()
  const trustedDomains = [...TIER1_DOMAINS, ...TIER2_DOMAINS]
  return trustedDomains.some((domain) => raw.includes(domain))
}

function extractCitationHosts(citation: string): string[] {
  return citation
    .split(/[\\s,;]+/)
    .map((entry) => {
      if (!entry) return null
      try {
        const url = new URL(entry.includes('://') ? entry : `https://${entry}`)
        return normaliseHost(url.hostname)
      } catch {
        return null
      }
    })
    .filter((host): host is string => Boolean(host))
}

function normaliseHost(hostname: string): string {
  return hostname.replace(/^www\./i, '').toLowerCase()
}

function parseEvidence(entry: any): VetterEvidence | null {
  if (!entry || typeof entry !== 'object') return null
  const url = typeof entry.url === 'string' ? entry.url.trim() : undefined
  const anchorRaw = entry.anchor
  if (!url || !anchorRaw || typeof anchorRaw !== 'object') {
    return null
  }
  const anchor: VetterEvidenceAnchor = {
    cssPath: typeof anchorRaw.cssPath === 'string' ? anchorRaw.cssPath.trim() : undefined,
    xpath: typeof anchorRaw.xpath === 'string' ? anchorRaw.xpath.trim() : undefined,
    startOffset: Number.isFinite(anchorRaw.startOffset) ? Number(anchorRaw.startOffset) : undefined,
    endOffset: Number.isFinite(anchorRaw.endOffset) ? Number(anchorRaw.endOffset) : undefined,
    preContext: typeof anchorRaw.preContext === 'string' ? anchorRaw.preContext : undefined,
    postContext: typeof anchorRaw.postContext === 'string' ? anchorRaw.postContext : undefined
  }
  return { url, anchor }
}


