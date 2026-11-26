import path from 'path'
import { config as loadEnv } from 'dotenv'
import { saysSomething } from '@/lib/curator/meaning'

/**
 * The checks that run before a bot post is saved.
 * A rule failure is final. The reviewer never overrides one.
 * Severity 1 is held for a person. Severity 2 and 3 may be rewritten, then dropped.
 */
export interface QaFailure {
  severity: 1 | 2 | 3
  reason: string
}

const HARM = /\b(child porn|csam|sexuali[sz]e[sd]? (?:a |the )?(?:child|minor|kid|teen)|underage (?:sex|porn|girl|boy))\b/i
const NUMBER = /\b\d[\d,.]{1,}\b/g
const NAME = /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3}\b/g

export function flat(value: string): string {
  return String(value || '')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

function postBody(note: string): string {
  return String(note || '')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !/^\/patch\/\S+$/.test(line) && !/^https?:\/\//.test(line) && !/^(title|when|from|image):/i.test(line))
    .join(' ')
}

function quotedSpans(note: string): string[] {
  const spans: string[] = []
  const re = /"([^"]{8,})"/g
  let match: RegExpExecArray | null
  const text = flat(note)
  while ((match = re.exec(text))) spans.push(match[1].trim())
  return spans
}

/** A quotation on a card has to be the source's words, not a paraphrase. */
export function quoteIsExact(sentence: string, source: string): boolean {
  const said = flat(sentence).replace(/[.!?]+$/, '')
  if (said.length < 12) return false
  return flat(source).includes(said)
}

/** Measurable failures. Empty means the rules passed. */
export function postRules(note: string, source: string): QaFailure[] {
  const body = postBody(note)
  const failures: QaFailure[] = []
  if (HARM.test(body) || HARM.test(source)) {
    failures.push({ severity: 1, reason: 'Held. The item involves a minor and sexual harm.' })
    return failures
  }
  if (!saysSomething(body)) {
    failures.push({ severity: 3, reason: 'The post does not say who did what.' })
  }
  if (flat(body).length > 480) {
    failures.push({ severity: 3, reason: 'The post is over the length limit.' })
  }
  const hay = flat(source)
  const compact = hay.replace(/,/g, '')
  for (const span of quotedSpans(body)) {
    if (!hay.includes(span)) failures.push({ severity: 2, reason: 'A quotation is not in the source.' })
  }
  const numbers = flat(body).match(NUMBER) || []
  for (const num of numbers) {
    const bare = num.replace(/[.,]+$/g, '').replace(/,/g, '')
    if (bare.length < 2) continue
    if (!compact.includes(bare)) failures.push({ severity: 2, reason: `The number ${num} is not in the source.` })
  }
  const seen = new Set<string>()
  for (const name of body.match(NAME) || []) {
    const key = name.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    if (!hay.includes(key)) failures.push({ severity: 2, reason: `The name ${name} is not in the source.` })
  }
  return failures
}

function deepseekKey(): string {
  if (process.env.DEEPSEEK_API_KEY) return process.env.DEEPSEEK_API_KEY
  loadEnv({ path: path.join(process.cwd(), '.env.local') })
  return process.env.DEEPSEEK_API_KEY || ''
}

/**
 * Judgment, only after the rules pass.
 * It can see the source. It cannot waive a rule, and a missing model fails closed.
 */
export async function reviewAgainstSource(note: string, source: string): Promise<QaFailure[]> {
  const text = flat(postBody(note)).slice(0, 900)
  const record = flat(source).slice(0, 3500)
  if (!text || !record) return [{ severity: 2, reason: 'The post could not be checked against the source.' }]
  const key = deepseekKey()
  if (!key) return [{ severity: 2, reason: 'The reviewer is down, so the post stays unpublished.' }]
  try {
    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'deepseek-flash',
        temperature: 0,
        max_tokens: 80,
        thinking: { type: 'disabled' },
        messages: [{
          role: 'user',
          content: `You are the QA reviewer. You can see the source and the finished post. Pass only if every factual claim in the post is in the source, any quotation is exact, and a stranger can say who did what. Fail a mood, a scene, a metaphor, a claim the source does not make, a number or name the source does not have, and outrage the source does not state. Do not pass a post that is technically grammatical and still says nothing. Reply JSON only: {"pass":true} or {"pass":false,"reason":"one sentence"}

Source:
${record}

Post:
${text}`
        }]
      }),
      signal: AbortSignal.timeout(20000)
    })
    if (!response.ok) return [{ severity: 2, reason: 'The reviewer is down, so the post stays unpublished.' }]
    const data = await response.json().catch(() => null)
    const raw = String(data?.choices?.[0]?.message?.content || '')
    const match = raw.match(/\{[\s\S]*\}/)
    if (!match) return [{ severity: 2, reason: 'The reviewer did not return a decision.' }]
    const parsed = JSON.parse(match[0]) as { pass?: boolean; reason?: string }
    if (parsed.pass === true) return []
    const reason = String(parsed.reason || 'The post is not supported by the source.').replace(/\s+/g, ' ').trim().slice(0, 240)
    return [{ severity: 2, reason }]
  } catch {
    return [{ severity: 2, reason: 'The reviewer is down, so the post stays unpublished.' }]
  }
}

/** A missing page is a dead link. A timeout is not proof. */
export async function linkResolves(url: string): Promise<boolean> {
  if (!/^https?:\/\//i.test(url)) return true
  if (/youtube\.com|youtu\.be|twitch\.tv|kick\.com|rumble\.com/i.test(url)) return true
  try {
    const response = await fetch(url, { method: 'HEAD', redirect: 'follow', signal: AbortSignal.timeout(8000) })
    if (response.status === 405 || response.status === 403) return true
    return response.status !== 404 && response.status !== 410
  } catch {
    return true
  }
}
