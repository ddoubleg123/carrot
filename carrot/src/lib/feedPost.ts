const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' '
}

function entityChar(code: number): string {
  if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) return ''
  if (code < 32 && code !== 9 && code !== 10) return ''
  return String.fromCodePoint(code)
}

/** Turn &#x27; and its cousins back into the characters they stand for. */
export function decodeEntities(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => entityChar(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => entityChar(parseInt(dec, 10)))
    .replace(/&([a-z]+);/gi, (all, name) => NAMED_ENTITIES[name.toLowerCase()] ?? all)
}

export interface FeedPostParts {
  note: string
  url: string
  title: string
  published: string
  site: string
  image: string
}

/** Pull the note, the link, and the article lines stored under it. */
export function parseFeedPost(content?: string | null): FeedPostParts {
  const note: string[] = []
  let url = ''
  let title = ''
  let published = ''
  let site = ''
  let image = ''
  for (const line of String(content || '').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) {
      if (note.length && note[note.length - 1] !== '') note.push('')
      continue
    }
    if (/^https?:\/\/\S+$/.test(trimmed)) {
      url = trimmed
      continue
    }
    if (/^title:\s*/i.test(trimmed)) {
      title = trimmed.replace(/^title:\s*/i, '').trim()
      continue
    }
    if (/^when:\s*/i.test(trimmed)) {
      published = trimmed.replace(/^when:\s*/i, '').trim()
      continue
    }
    if (/^from:\s*/i.test(trimmed)) {
      site = trimmed.replace(/^from:\s*/i, '').trim()
      continue
    }
    if (/^image:\s*/i.test(trimmed)) {
      image = trimmed.replace(/^image:\s*/i, '').trim()
      continue
    }
    note.push(trimmed)
  }
  return {
    note: note.join('\n').replace(/\n{3,}/g, '\n\n').trim(),
    url,
    title: decodeEntities(title),
    published: decodeEntities(published),
    site: decodeEntities(site),
    image
  }
}

/** The patch conversation this post is pointing at, when the text carries that path. */
export function patchConversation(content?: string | null): string | null {
  const match = String(content || '').match(/\/patch\/([A-Za-z0-9_-]+)(?:\?topic=([A-Za-z0-9_-]+))?/)
  if (!match) return null
  return match[2] ? `/patch/${match[1]}?topic=${match[2]}` : `/patch/${match[1]}`
}

export function articleLines(card: { title?: string; published?: string; site?: string; image?: string }): string {
  const lines = [
    card.title ? `Title: ${decodeEntities(card.title)}` : '',
    card.published ? `When: ${decodeEntities(card.published)}` : '',
    card.site ? `From: ${decodeEntities(card.site)}` : '',
    card.image ? `Image: ${card.image}` : ''
  ].filter(Boolean)
  return lines.join('\n')
}
