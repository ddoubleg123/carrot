export interface BrainItem {
  title: string
  url: string
  quote: string
  body?: string
  origin: 'search' | 'member'
  video?: string
  question?: string
}

const PLACEHOLDER = /transcript was not included|video added to this question|open the file to read it|open the file at this address/i

/** A PDF, a transcript, or a note someone put on the group. A web page is not this. */
export function heldDocument(item: BrainItem): boolean {
  if (item.origin !== 'member') return false
  const text = (item.body || item.quote || '').trim()
  if (text.length < 40 || PLACEHOLDER.test(text)) return false
  const url = item.url.split('?')[0].toLowerCase()
  if (url.startsWith('/topic-docs/') || url.endsWith('.pdf')) return true
  if (item.video) return true
  if (!item.url) return true
  return false
}

/** A saved transcript is held. A saved web page is outside material. */
export function postKnowledge(content: string, transcription: string | null, question: string): BrainItem[] {
  const items: BrainItem[] = []
  const spoken = (transcription || '').replace(/\s+/g, ' ').trim()
  if (spoken.length >= 40) {
    items.push({
      title: 'Transcript',
      url: '',
      quote: spoken.slice(0, 1500),
      body: spoken.slice(0, 400000),
      origin: 'member',
      question
    })
  }
  const text = content.replace(/\s+/g, ' ').trim()
  if (text.length < 40) return items
  const web = text.match(/https?:\/\/\S+/)?.[0] || ''
  items.push({
    title: web ? 'Saved page' : 'Post',
    url: web,
    quote: text.slice(0, 1500),
    body: text.slice(0, 400000),
    origin: web ? 'search' : 'member',
    question
  })
  return items
}

function words(value: string): string[] {
  return value.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((word) => word.length > 3)
}

/** The parts of a saved document that match the question, including a line that is not at the start. */
export function passages(text: string, query: string, max: number): string {
  const clean = text.replace(/\s+/g, ' ').trim()
  if (clean.length <= max) return clean
  const wanted = [...new Set(words(query))].slice(0, 12)
  const lower = clean.toLowerCase()
  const hits: number[] = []
  for (const word of wanted) {
    let from = 0
    while (hits.length < 16) {
      const at = lower.indexOf(word, from)
      if (at < 0) break
      hits.push(at)
      from = at + word.length
    }
  }
  const spots = hits.length ? hits.sort((a, b) => a - b) : [0, Math.floor(clean.length / 2)]
  const parts: string[] = []
  let used = 0
  let previous = -1
  for (const at of spots) {
    const start = Math.max(0, at - 220)
    if (previous >= 0 && start < previous + 500) continue
    const slice = clean.slice(start, start + 900).trim()
    if (slice.length < 40) continue
    if (used + slice.length > max) break
    parts.push(slice)
    used += slice.length
    previous = start
    if (parts.length >= 4) break
  }
  return parts.join('\n…\n') || clean.slice(0, max)
}

export const SHELF_CHARS = 2_000_000

function documentBlocks(list: BrainItem[], label: string): string[] {
  const ordered = [...list.filter(heldDocument), ...list.filter((item) => !heldDocument(item))]
  const blocks: string[] = []
  for (const item of ordered) {
    const text = (item.body || item.quote || '').trim()
    if (text.length < 40) continue
    if (!blocks.length) blocks.push(label)
    const where = item.question ? `${item.question} — ${item.title}` : item.title
    blocks.push(`[${where}]\n${text}`)
  }
  return blocks
}

function splitBlock(block: string, shelfChars: number): string[] {
  if (shelfChars < 1) return [block]
  const parts: string[] = []
  let rest = block.trim()
  while (rest.length > shelfChars) {
    let at = rest.lastIndexOf('\n\n', shelfChars)
    if (at < shelfChars * 0.5) at = rest.lastIndexOf(' ', shelfChars)
    if (at < 1) at = shelfChars
    const piece = rest.slice(0, at).trim()
    if (!piece) break
    parts.push(piece)
    rest = rest.slice(at).trim()
  }
  if (rest) parts.push(rest)
  return parts
}

/** Whole documents packed onto shelves. A document moves to the next shelf instead of being cut. */
export function buildShelves(items: BrainItem[], focus = '', shelfChars = SHELF_CHARS): string[] {
  const mine = focus ? items.filter((item) => item.question === focus) : []
  const rest = focus ? items.filter((item) => item.question !== focus) : items
  const blocks = focus
    ? [
      ...documentBlocks(mine, 'THIS QUESTION. Full text saved on this question.'),
      ...documentBlocks(rest, 'REST OF THE GROUP. Full text saved on the other questions in this group.')
    ]
    : [
      ...documentBlocks(rest.filter(heldDocument), 'HELD RECORD. Full text of the documents, transcripts, and notes saved on this group. This is the whole text, not a summary.'),
      ...documentBlocks(rest.filter((item) => !heldDocument(item)), 'REST OF THE GROUP. Full text of the other pages and posts saved on this group.')
    ]
  const shelves: string[][] = []
  let current: string[] = []
  let size = 0
  for (const block of blocks) {
    const pieces = block.length <= shelfChars ? [block] : splitBlock(block, shelfChars)
    for (const piece of pieces) {
      if (current.length && size + piece.length + 2 > shelfChars) {
        shelves.push(current)
        current = []
        size = 0
      }
      current.push(piece)
      size += piece.length + 2
    }
  }
  if (current.length) shelves.push(current)
  if (!shelves.length) return []
  const titles = blocks.filter((block) => block.startsWith('[')).map((block) => block.split('\n')[0])
  const mapText = (count: number) => `MAP. ${titles.length} saved documents across ${count} ${count === 1 ? 'shelf' : 'shelves'}.\n${titles.map((title, index) => `${index + 1}. ${title}`).join('\n')}`
  let map = mapText(shelves.length)
  const first = shelves[0]
  while (first.length > 1 && map.length + 2 + first.join('\n\n').length > shelfChars) {
    const moved = first.pop()
    if (!moved) break
    shelves.splice(1, 0, [moved])
    map = mapText(shelves.length)
  }
  shelves[0] = [map, ...shelves[0]]
  return shelves.map((shelf, index) => `SHELF ${index + 1} OF ${shelves.length}.\n\n${shelf.join('\n\n')}`)
}

/** This question's full text first, then the rest of the group. Shelves are included in order. */
export function brainBrief(items: BrainItem[], _query: string, focus = ''): string {
  return buildShelves(items, focus).join('\n\n')
}

export const BRAIN_RULE = `Answer from the full text saved on this question first, then the full text saved on the rest of the group. That text is the whole document, transcript, note, or page, not a summary. Documents, transcripts, and notes come before other pages. If they disagree, say what the question has saved and what the other item says. Do not treat a page as false because of who published it. Do not add a fact that is not in the saved text. If the saved text does not cover the question, say so.`

/** Read one shelf. The shelf stays first so a repeat of the same text can be cached. */
export async function readBrain(question: string, asked: string, brief: string, tail = ''): Promise<string | null> {
  const key = process.env.DEEPSEEK_API_KEY || ''
  if (!key || !brief.trim()) return null
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
        max_tokens: 800,
        thinking: { type: 'disabled' },
        messages: [{
          role: 'user',
          content: `${BRAIN_RULE}

${brief}

Question on the group: ${question}
Asked: ${asked}${tail ? `\n\n${tail}` : ''}`
        }]
      }),
      signal: AbortSignal.timeout(60000)
    })
    if (!response.ok) return null
    const data = await response.json().catch(() => null)
    const text = String(data?.choices?.[0]?.message?.content || '').replace(/\s+\n/g, '\n').trim()
    return text.length >= 20 ? text.slice(0, 4000) : null
  } catch {
    return null
  }
}

/** Read every shelf. One shelf is one read. Further shelves are opened when the question has more saved text. */
export async function readShelves(question: string, asked: string, shelves: string[]): Promise<string | null> {
  if (!shelves.length) return null
  if (shelves.length === 1) return readBrain(question, asked, shelves[0])
  const notes: string[] = []
  for (let index = 0; index < shelves.length; index += 1) {
    const note = await readBrain(
      question,
      asked,
      shelves[index],
      'Quote the passages from this shelf that bear on what was asked. Keep the wording from the shelf.'
    )
    if (note) notes.push(`Shelf ${index + 1}:\n${note}`)
  }
  if (!notes.length) return null
  return readBrain(
    question,
    asked,
    `Readings from ${notes.length} shelves of the saved text.\n\n${notes.join('\n\n')}`,
    'Answer from these shelf readings. They quote the saved text.'
  )
}
