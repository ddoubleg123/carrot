const ALIASES: Record<string, string[]> = {
  jfk: ['jfk', 'kennedy']
}

function words(query: string): string[] {
  return query
    .toLowerCase()
    .split(/\s+/)
    .map((word) => word.replace(/[^a-z0-9']/g, ''))
    .filter((word) => word.length >= 2)
    .slice(0, 5)
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** One pattern per word. JFK also counts as Kennedy. */
export function groupPatterns(query: string, flavor: 'js' | 'sql' = 'js'): string[] {
  const boundary = flavor === 'sql' ? '[^[:alnum:]]' : '[^a-z0-9]'
  return words(query).map((word) => {
    const forms = new Set<string>(ALIASES[word] || [word])
    if (word.length >= 6) {
      const swapped = `${word.slice(0, -2)}${word.slice(-1)}${word.slice(-2, -1)}`
      if (swapped !== word) forms.add(swapped)
    }
    const body = [...forms].map(escapeRegExp).join('|')
    return `(^|${boundary})(?:${body})(${boundary}|$)`
  })
}

export function textMatches(text: string, query: string): boolean {
  const patterns = groupPatterns(query)
  if (!patterns.length) return false
  return patterns.every((pattern) => new RegExp(pattern, 'i').test(text))
}
