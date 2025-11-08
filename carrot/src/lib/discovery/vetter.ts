const VETTER_SYSTEM_PROMPT = `You are an expert content analyst and editor. Clean, score, and synthesize one source into a high-value card. Include BOTH majority and minority viewpoints when the topic is contested, with citations. Use fair use: up to 2–3 short verbatim quotes; otherwise paraphrase. Return STRICT JSON only.
Reject low-value or off-topic content.`

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

export interface VetterResult {
  isUseful: boolean
  relevanceScore: number
  qualityScore: number
  whyItMatters: string
  facts: VetterFact[]
  quotes: VetterQuote[]
  provenance: string[]
  contested: VetterContested | null
}

const DEEPSEEK_ENDPOINT = 'https://api.deepseek.com/v1/chat/completions'

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
2) Why it matters: 1–2 concise sentences tailored to the topic.
3) Facts: 3–6 bullets with dates/numbers; each must map to a citation.
4) Quotes (optional): up to 3 SHORT verbatim quotes (<=25 words each) with speaker + citation + anchor if available.
5) Contested (optional): if this source advances or disputes a controversial claim, add a compact “contested” note with one supporting and one counter source (URLs).
6) Provenance: array of source URLs (this URL first; add on-page anchors when possible).

Return JSON ONLY:
{
  "isUseful": true,
  "relevanceScore": 0.00,
  "qualityScore": 0,
  "whyItMatters": "...",
  "facts": [{"label":"...", "value":"...", "citation":"url#anchor"}],
  "quotes": [{"text":"...", "speaker":"...", "citation":"url#anchor"}],
  "contested": {"note":"...", "supporting":"url", "counter":"url", "claim":"exact contested claim when applicable"} | null,
  "provenance": ["url#anchor", "..."]
}

Reject if:
- <200 words substantive text,
- qualityScore < 60,
- relevanceScore < 0.75 (strict),
- no mappable citations for facts/quotes.${contestedSection}`
}

function getApiKey(): string {
  const key = process.env.DEEPSEEK_API_KEY
  if (!key) {
    throw new Error('DeepSeek API key missing')
  }
  return key
}

function normaliseArray<T>(value: unknown, mapper: (entry: any) => T | null | undefined): T[] {
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
        { role: 'user', content: buildUserPrompt(args) }
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
  } catch (error) {
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
      citation: fact.citation.trim()
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

  return {
    isUseful: parsed.isUseful !== false,
    relevanceScore: Number(parsed.relevanceScore ?? 0),
    qualityScore: Number(parsed.qualityScore ?? 0),
    whyItMatters: typeof parsed.whyItMatters === 'string' ? parsed.whyItMatters.trim() : '',
    facts,
    quotes,
    provenance: provenance.length ? provenance : [args.url],
    contested: contestedValue && contestedValue.note ? contestedValue : null
  }
}


