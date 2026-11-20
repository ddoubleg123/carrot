import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'

const MAX_BYTES = 2_000_000
const MAX_PDF_BYTES = 8_000_000
const MAX_REDIRECTS = 3
const TIMEOUT_MS = 12_000

export class PublicUrlError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PublicUrlError'
  }
}

export interface ReadPage {
  finalUrl: string
  title: string
  text: string
  kind: 'html' | 'pdf' | 'text'
  image?: string
}

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split('.').map((part) => Number(part))
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return null
  }
  return (((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0)
}

function inCidr(ip: string, base: string, bits: number): boolean {
  const value = ipv4ToInt(ip)
  const start = ipv4ToInt(base)
  if (value === null || start === null) return false
  const mask = bits === 0 ? 0 : ((~0 << (32 - bits)) >>> 0)
  return (value & mask) === (start & mask)
}

export function isPrivateAddress(ip: string): boolean {
  const kind = isIP(ip)
  if (kind === 4) {
    return (
      inCidr(ip, '0.0.0.0', 8) ||
      inCidr(ip, '10.0.0.0', 8) ||
      inCidr(ip, '127.0.0.0', 8) ||
      inCidr(ip, '169.254.0.0', 16) ||
      inCidr(ip, '172.16.0.0', 12) ||
      inCidr(ip, '192.0.0.0', 24) ||
      inCidr(ip, '192.0.2.0', 24) ||
      inCidr(ip, '192.168.0.0', 16) ||
      inCidr(ip, '100.64.0.0', 10) ||
      inCidr(ip, '198.51.100.0', 24) ||
      inCidr(ip, '203.0.113.0', 24) ||
      inCidr(ip, '224.0.0.0', 4) ||
      ip === '255.255.255.255'
    )
  }
  if (kind === 6) {
    const lower = ip.toLowerCase()
    if (lower === '::1' || lower === '::') return true
    if (lower.startsWith('fe80:')) return true
    if (lower.startsWith('fc') || lower.startsWith('fd')) return true
    const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)
    if (mapped) return isPrivateAddress(mapped[1])
    return false
  }
  return true
}

function blockedHostname(hostname: string): boolean {
  const host = hostname.replace(/^\[|\]$/g, '').toLowerCase().replace(/\.$/, '')
  if (!host || host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal') || host.endsWith('.localhost')) {
    return true
  }
  return false
}

export async function assertPublicUrl(raw: string): Promise<URL> {
  let url: URL
  try {
    url = new URL(raw.trim())
  } catch {
    throw new PublicUrlError('That is not a valid web address.')
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new PublicUrlError('Only public http and https links can be read.')
  }
  if (url.username || url.password) {
    throw new PublicUrlError('Links with a username or password are not allowed.')
  }
  if (url.port && url.port !== '80' && url.port !== '443') {
    throw new PublicUrlError('Only standard web ports can be read.')
  }
  if (blockedHostname(url.hostname)) {
    throw new PublicUrlError('That address is not a public web link.')
  }

  const host = url.hostname.replace(/^\[|\]$/g, '')
  const kind = isIP(host)
  if (kind !== 0) {
    if (isPrivateAddress(host)) throw new PublicUrlError('That address is not a public web link.')
    return url
  }

  let records: { address: string; family: number }[]
  try {
    records = await lookup(host, { all: true, verbatim: true })
  } catch {
    throw new PublicUrlError('That address could not be reached.')
  }
  if (records.length === 0 || records.some((record) => isPrivateAddress(record.address))) {
    throw new PublicUrlError('That address is not a public web link.')
  }
  return url
}

const NAMED_ENTITIES: Record<string, string> = {
  nbsp: ' ',
  amp: '&',
  quot: '"',
  apos: "'",
  lt: '<',
  gt: '>',
  ldquo: '\u201C',
  rdquo: '\u201D',
  lsquo: '\u2018',
  rsquo: '\u2019',
  mdash: '\u2014',
  ndash: '\u2013',
  hellip: '\u2026',
  bull: '\u2022'
}

export function decodeEntities(value: string): string {
  let current = value
  for (let pass = 0; pass < 3; pass += 1) {
    const next = current.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (entity, body: string) => {
      if (body[0] === '#') {
        const code = /^x/i.test(body.slice(1)) ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10)
        return code > 0 && code <= 0x10FFFF ? String.fromCodePoint(code) : entity
      }
      return NAMED_ENTITIES[body.toLowerCase()] ?? entity
    })
    if (next === current) break
    current = next
  }
  return current
}

const CHROME = /accessibility|one\s*tap|hide toolbar|cookie|consent|български|português|powered by|vision impaired|not consenting|privacy policy|copyright|select your accessibility|language switcher/i

export function looksLikeChrome(text: string): boolean {
  const hits = text.match(/accessibility|hide toolbar|onetap|български|português \(brasil\)|not consenting or withdrawing/gi)
  return (hits?.length || 0) >= 2
}

function plain(value: string): string {
  const inline = value
    .replace(/<\/(span|a|em|strong|b|i|mark|sup|sub|small|time|abbr)\s*>/gi, '')
    .replace(/<(span|a|em|strong|b|i|mark|sup|sub|small|time|abbr)\b[^>]*>/gi, '')
  return decodeEntities(inline.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim()
}

function articleRegion(html: string): string {
  const stand = html.indexOf('data-gu-name="standfirst"')
  const body = html.indexOf('data-gu-name="body"')
  if (stand < 0 && body < 0) return html
  const start = stand >= 0 ? stand : body
  const end = html.indexOf('data-gu-name="submeta"', start + 20)
  return html.slice(start, end > start ? end : start + 120000)
}

export function pageImage(html: string): string {
  const tags = html.match(/<meta\b[^>]*>/gi) || []
  for (const tag of tags) {
    const key = (tag.match(/\b(?:property|name)\s*=\s*["']([^"']+)["']/i)?.[1] || '').toLowerCase()
    if (key !== 'og:image' && key !== 'twitter:image') continue
    const content = tag.match(/\bcontent\s*=\s*["']([^"']+)["']/i)?.[1] || ''
    if (content.startsWith('http://') || content.startsWith('https://')) return content
  }
  return ''
}

export function htmlToText(html: string): { title: string; text: string } {
  const title = plain(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '')
  const withoutCode = articleRegion(html)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
  const paragraphs: string[] = []
  for (const match of withoutCode.matchAll(/<(p|h[1-3]|blockquote|li)[^>]*>([\s\S]*?)<\/\1>/gi)) {
    const text = plain(match[2])
    if (text.length < 40 || CHROME.test(text)) continue
    if (/\bour locations\b|\bpro shop\b/i.test(text)) continue
    if ((text.match(/\|/g) || []).length > 0 && !/[.]/.test(text)) continue
    paragraphs.push(text)
  }
  if (paragraphs.length > 0) return { title, text: paragraphs.join('\n\n') }

  const sentences = plain(withoutCode)
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 40 && !CHROME.test(sentence))
  return { title, text: sentences.slice(0, 40).join(' ') }
}

async function readBody(response: Response, signal: AbortSignal, maxBytes: number): Promise<Uint8Array> {
  const reader = response.body?.getReader()
  if (!reader) return new Uint8Array()
  const chunks: Uint8Array[] = []
  let total = 0
  try {
    for (;;) {
      if (signal.aborted) throw new PublicUrlError('Reading that link took too long.')
      const { done, value } = await reader.read()
      if (done) break
      total += value.byteLength
      if (total > maxBytes) {
        throw new PublicUrlError('That page is too large to store.')
      }
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }
  const body = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    body.set(chunk, offset)
    offset += chunk.byteLength
  }
  return body
}

function pdfTitle(url: URL): string {
  const raw = decodeURIComponent(url.pathname.split('/').pop() || 'PDF').replace(/\.pdf$/i, '')
  const title = raw.replace(/[_+]+/g, ' ').replace(/-/g, ' ').replace(/\s+/g, ' ').trim()
  return title || 'PDF'
}

export async function textFromPdf(bytes: Uint8Array): Promise<string> {
  return pdfToText(bytes).catch((error) => {
    console.error('[topic] PDF text was not read', error instanceof Error ? error.message : error)
    return ''
  })
}

async function pdfToText(bytes: Uint8Array): Promise<string> {
  const { PDFParse } = await import('pdf-parse')
  const parser = new PDFParse({ data: bytes })
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('The PDF took too long to read.')), 20000)
  })
  try {
    const result = await Promise.race([parser.getText(), timeout])
    return (result.text || '').replace(/[ \t]+\n/g, '\n').replace(/[ \t]{2,}/g, ' ').replace(/\n{3,}/g, '\n\n').trim()
  } finally {
    if (timer) clearTimeout(timer)
    await parser.destroy().catch(() => undefined)
  }
}

function kindFor(contentType: string, url: URL): 'html' | 'pdf' | 'text' | null {
  const type = contentType.split(';')[0].trim().toLowerCase()
  if (type === 'text/html' || type === 'application/xhtml+xml') return 'html'
  if (type === 'text/plain') return 'text'
  if (type === 'application/pdf' || type === 'application/x-pdf') return 'pdf'
  if ((type === 'application/octet-stream' || type === '') && url.pathname.toLowerCase().endsWith('.pdf')) return 'pdf'
  return null
}

export async function readPublicUrl(raw: string): Promise<ReadPage> {
  let current = await assertPublicUrl(raw)
  const signal = AbortSignal.timeout(TIMEOUT_MS)

  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const response = await fetch(current, {
      method: 'GET',
      redirect: 'manual',
      signal,
      headers: {
        'User-Agent': 'CarrotLearn/1.0',
        Accept: 'text/html,application/pdf,text/plain;q=0.9'
      }
    }).catch(() => {
      throw new PublicUrlError('That link could not be read.')
    })

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location')
      if (!location || hop === MAX_REDIRECTS) {
        throw new PublicUrlError('That link could not be read.')
      }
      current = await assertPublicUrl(new URL(location, current).toString())
      continue
    }

    if (!response.ok) {
      throw new PublicUrlError('That link could not be read.')
    }

    const kind = kindFor(response.headers.get('content-type') || '', current)
    if (!kind) {
      throw new PublicUrlError('That link is not a readable page or PDF.')
    }

    const bytes = await readBody(response, signal, kind === 'pdf' ? MAX_PDF_BYTES : MAX_BYTES)
    if (kind === 'pdf') {
      const text = await textFromPdf(bytes)
      return { finalUrl: current.toString(), title: pdfTitle(current), text, kind }
    }

    const decoded = new TextDecoder('utf-8', { fatal: false }).decode(bytes)
    if (kind === 'text') {
      return {
        finalUrl: current.toString(),
        title: decodeURIComponent(current.pathname.split('/').pop() || current.hostname),
        text: decoded.replace(/\s+/g, ' ').trim(),
        kind
      }
    }

    const parsed = htmlToText(decoded)
    return {
      finalUrl: current.toString(),
      title: parsed.title || current.hostname,
      text: parsed.text,
      image: pageImage(decoded) || undefined,
      kind
    }
  }

  throw new PublicUrlError('That link could not be read.')
}

export async function resolveGoogleNews(raw: string): Promise<string> {
  let parsed: URL
  try {
    parsed = new URL(raw)
  } catch {
    return raw
  }
  if (!/(^|\.)news\.google\.com$/i.test(parsed.hostname) || !/\/articles\//.test(parsed.pathname)) return raw
  const page = await fetch(parsed, {
    redirect: 'follow',
    headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'text/html' },
    signal: AbortSignal.timeout(8000)
  }).catch(() => null)
  if (!page?.ok) return raw
  const html = await page.text()
  const id = html.match(/data-n-a-id="([^"]+)"/)?.[1]
  const timestamp = html.match(/data-n-a-ts="([^"]+)"/)?.[1]
  const signature = html.match(/data-n-a-sg="([^"]+)"/)?.[1]
  if (!id || !timestamp || !signature) return raw
  const inner = JSON.stringify(['garturlreq', [['X', 'X', ['X', 'X'], null, null, 1, 1, 'US:en', null, 1, null, null, null, null, null, 0, 1], 'X', 'X', 1, [1, 1, 1], 1, 1, null, 0, 0, null, 0], id, Number(timestamp), signature])
  const decoded = await fetch('https://news.google.com/_/DotsSplashUi/data/batchexecute?rpcids=Fbv4je', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8', 'User-Agent': 'Mozilla/5.0' },
    body: `f.req=${encodeURIComponent(JSON.stringify([[['Fbv4je', inner, null, 'generic']]]))}`,
    signal: AbortSignal.timeout(8000)
  }).catch(() => null)
  if (!decoded?.ok) return raw
  const text = await decoded.text()
  const url = text.match(/https?:\/\/(?!news\.google\.com)[^"\\]+/)?.[0]
  if (!url) return raw
  try {
    return new URL(url).toString()
  } catch {
    return raw
  }
}
