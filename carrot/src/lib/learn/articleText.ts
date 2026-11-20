export interface ArticleBlock {
  heading: string | null
  paragraphs: string[]
}

export function openedPassage(raw: string): string {
  let text = raw
    .replace(/(^|[ \t])([B-HJ-Z]) ([a-z]{3,})/g, '$1$2$3')
    .replace(/[ \t]*\b[A-Z][a-z]+(?:[ \t]+[A-Z][a-z]+){0,2}[ \t]+(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[ \t]+\d{1,2}[ \t]+[A-Za-z]+[ \t]+\d{4}(?:[ \t]+\d{2}\.\d{2}[ \t]+[A-Z]{2,4})?/g, ' ')
    .replace(/[ \t]*Last modified on[ \t]+\w+[ \t]+\d{1,2}[ \t]+[A-Za-z]+[ \t]+\d{4}(?:[ \t]+\d{2}\.\d{2}[ \t]+[A-Z]{2,4})?/gi, ' ')
    .replace(/Share Prefer the Guardian on Google/gi, ' ')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
  if (/^[a-z]/.test(text)) {
    const at = text.search(/\s[A-Z][a-z]/)
    if (at > 0 && at < 48) text = text.slice(at + 1).trim()
  }
  return text
}

export function formatArticle(raw: string): ArticleBlock[] {
  const text = raw.replace(/\r\n/g, '\n').trim()
  if (!text) return []
  const chunks = text.split(/={2,}\s*([^=\n]{2,120}?)\s*={2,}/)
  const blocks: ArticleBlock[] = []
  const push = (heading: string | null, body: string) => {
    const paragraphs = toParagraphs(body)
    if (paragraphs.length) blocks.push({ heading, paragraphs })
  }
  push(null, chunks[0] || '')
  for (let index = 1; index < chunks.length; index += 2) {
    push((chunks[index] || '').trim() || null, chunks[index + 1] || '')
  }
  return blocks
}

export function articleSummary(raw: string): string {
  const first = formatArticle(raw).flatMap((block) => block.paragraphs)[0] || ''
  if (first.length <= 360) return first
  const cut = first.slice(0, 360)
  const end = Math.max(cut.lastIndexOf('.'), cut.lastIndexOf('!'), cut.lastIndexOf('?'))
  return (end > 80 ? cut.slice(0, end + 1) : cut).trim()
}

function sentencesOf(text: string): string[] {
  const parts = text
    .replace(/\s*\n\s*/g, ' ')
    .split(/(?<=[.!?])\s+(?=["“A-Z])/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0 && !/^[\p{P}\s]+$/u.test(sentence))
  const merged: string[] = []
  for (const sentence of parts) {
    const previous = merged[merged.length - 1]
    const abbreviation = previous && /(?:\b(?:Mr|Ms|Mrs|Dr|St|Jr|Sr|Gen|Col|Sen|Rep|U\.S|J|B|A|S)|[A-Z])\.$/.test(previous)
    if (previous && (previous.length < 45 || abbreviation)) merged[merged.length - 1] = `${previous} ${sentence}`
    else merged.push(sentence)
  }
  return merged
}

function groupSentences(sentences: string[]): string[] {
  const groups: string[] = []
  let current: string[] = []
  let length = 0
  const flush = () => {
    const paragraph = current.join(' ').trim()
    if (paragraph.length > 40) groups.push(paragraph)
    current = []
    length = 0
  }
  for (const sentence of sentences) {
    current.push(sentence)
    length += sentence.length
    if ((current.length >= 2 && length > 340) || current.length >= 4 || length > 520) flush()
  }
  if (current.length) flush()
  return groups
}

function toParagraphs(body: string): string[] {
  const cleaned = body.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
  if (!cleaned) return []
  return cleaned
    .split(/\n{2,}/)
    .flatMap((block) => {
      const text = block.replace(/\s*\n\s*/g, ' ').trim()
      if (!text || /^[\p{P}\s]+$/u.test(text)) return []
      if (text.length < 420) return [text]
      return groupSentences(sentencesOf(text))
    })
    .filter((paragraph) => paragraph.length > 40)
}
