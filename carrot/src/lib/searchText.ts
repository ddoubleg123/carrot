/** Each word, then the close forms that should still count as that word. */
export function searchNeedles(query: string): string[][] {
  const words = query
    .toLowerCase()
    .split(/\s+/)
    .map((word) => word.replace(/[^a-z0-9']/g, ''))
    .filter((word) => word.length >= 2)
    .slice(0, 5)
  return words.map((word) => {
    const forms = [word]
    if (word.length >= 5) {
      const swapped = `${word.slice(0, -2)}${word.slice(-1)}${word.slice(-2, -1)}`
      if (swapped !== word) forms.push(swapped)
      forms.push(word.slice(0, 4))
    }
    return [...new Set(forms)]
  })
}

export function exactHit(text: string, query: string): boolean {
  return text.toLowerCase().includes(query.trim().toLowerCase())
}
