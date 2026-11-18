const STOP = new Set([
  'what', 'when', 'where', 'which', 'how', 'can', 'are', 'was', 'were', 'the', 'and', 'for', 'with',
  'from', 'that', 'this', 'about', 'does', 'have', 'your', 'they', 'them', 'then', 'than', 'just',
  'like', 'into', 'you', 'our', 'better', 'really', 'very', 'some', 'more', 'most', 'good', 'role',
  'part', 'people', 'person', 'thing', 'things', 'involved', 'involvement', 'connection', 'between',
  'during', 'after', 'before', 'because', 'their', 'there', 'been', 'will', 'would', 'could', 'should',
  'make', 'made', 'much', 'many', 'also', 'only', 'over', 'under', 'such', 'other', 'another', 'being',
  'did', 'done', 'has', 'had', 'its', 'his', 'her', 'who', 'whom', 'whose', 'why', 'not', 'but', 'any',
  'find', 'information', 'working', 'hard', 'explain', 'please', 'looking', 'want', 'need', 'tell',
  'show', 'give', 'using', 'something', 'anything', 'formed', 'didnt'
])

const ALIASES: Record<string, string[]> = {
  jfk: ['kennedy'],
  rfk: ['kennedy'],
  lbj: ['johnson'],
  mlk: ['king'],
  fdr: ['roosevelt'],
  '911': ['9/11', '9-11', 'september 11']
}

const EVENT_911 = /\b9\s*[/\-]\s*11\b|\b911\b|\bsept(?:ember)?\.?\s+11(?:st|th)?\b|\b11(?:st|th)?\s+sept(?:ember)?\b/i

function wordsOf(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 3 && !STOP.has(word))
}

export function questionTokens(question: string, groupTitle: string): string[] {
  const group = new Set(wordsOf(groupTitle))
  const events: string[] = []
  const acronyms: string[] = []
  const specific: string[] = []
  if (EVENT_911.test(question)) events.push('911')
  const body = question
    .replace(/\b9\s*[/\-]\s*11\b/gi, ' ')
    .replace(/\b911\b/g, ' ')
    .replace(/\bsept(?:ember)?\.?\s+11(?:st|th)?\b/gi, ' ')
    .replace(/\b11(?:st|th)?\s+sept(?:ember)?\b/gi, ' ')
  for (const match of body.matchAll(/[A-Za-z0-9]+(?:'[A-Za-z]+)?/g)) {
    const bare = match[0].replace(/'s$/i, '')
    const lower = bare.toLowerCase().replace(/'/g, '')
    const acronym = /^[A-Z]{2,6}$/.test(bare)
    if (STOP.has(lower) || lower === '911') continue
    if (/^\d+$/.test(lower) && lower.length < 4) continue
    if (!acronym && lower.length < 4) continue
    if ([...group].some((name) => name === lower || name.includes(lower) || lower.includes(name))) continue
    const bucket = acronym ? acronyms : specific
    if (!bucket.includes(lower)) bucket.push(lower)
  }
  return [...events, ...acronyms, ...specific].slice(0, 6)
}

const BRIDGE_STOP = new Set([
  ...STOP, 'president', 'prime', 'minister', 'united', 'states', 'state', 'american', 'america',
  'national', 'general', 'department', 'justice', 'public', 'affairs', 'foreign', 'agent', 'agents',
  'israeli', 'israel', 'according', 'however', 'another', 'while', 'under', 'about', 'kennedy',
  'johnson', 'lyndon', 'david', 'michael', 'collins', 'final', 'judgment', 'missing', 'link'
])

function aliasIn(hay: string, alias: string): boolean {
  if (!hay.includes(alias)) return false
  if (alias !== 'kennedy') return true
  return hay.replace(/kennedy school/g, ' ').includes('kennedy')
}

export function covers(text: string, tokens: string[]): boolean {
  if (tokens.length === 0) return true
  const hay = text.toLowerCase()
  return tokens.every((token) => {
    const needle = token.toLowerCase()
    return hay.includes(needle) || (ALIASES[needle] || []).some((alias) => aliasIn(hay, alias))
  })
}

export function leadToken(tokens: string[]): string | null {
  return tokens.find((token) => ALIASES[token]) || tokens[0] || null
}

export function searchWord(token: string): string {
  return (ALIASES[token] || [token])[0]
}

export function plainSentences(text: string): string[] {
  return text
    .replace(/={2,}[^=\n]{0,160}={2,}/g, ' ')
    .replace(/[–—]/g, '-')
    .replace(/\b([A-Z])\./g, '$1')
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.replace(/\s+/g, ' ').trim())
    .filter((sentence) => sentence.length > 50)
}

export function bridgeTerms(text: string, anchors: string[], group?: string): string[] {
  const known = new Set(anchors.flatMap((token) => [token, ...(ALIASES[token] || [])]).map((token) => token.toLowerCase()))
  const sentences = plainSentences(text)
  const connecting = sentences.filter((sentence, index) => {
    const window = [sentences[index - 1], sentence, sentences[index + 1]].filter(Boolean).join(' ')
    const hitsAnchor = anchors.some((token) => covers(window, [token]))
    const hitsGroup = group ? covers(window, [group.toLowerCase()]) : true
    return hitsAnchor && hitsGroup
  })
  const counts = new Map<string, { word: string; count: number }>()
  for (const sentence of connecting) {
    const seen = new Set<string>()
    const cleaned = sentence.replace(/According to(?:\s+[A-Z][A-Za-z0-9.'-]+){1,5}/g, ' ')
    for (const match of cleaned.matchAll(/\b[A-Z][A-Za-z0-9]+(?:-[A-Z][A-Za-z0-9]+)*\b/g)) {
      const word = match[0]
      const key = word.toLowerCase().replace(/s$/, '')
      if (key.length < 5 || known.has(key) || BRIDGE_STOP.has(key) || seen.has(key)) continue
      seen.add(key)
      const current = counts.get(key)
      counts.set(key, { word: current && current.word.length >= word.length ? current.word : word, count: (current?.count || 0) + 1 })
    }
  }
  return [...counts.values()]
    .sort((a, b) => Number(/ists?$/.test(a.word)) - Number(/ists?$/.test(b.word)) || b.count - a.count || b.word.length - a.word.length)
    .slice(0, 2)
    .map((item) => item.word)
}
