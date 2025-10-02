// Simple text chunker used by PDF ingestion
// Splits on paragraph boundaries when possible, then falls back to hard slicing.

export function chunkText(text: string, maxLen: number = 1400): string[] {
  if (!text) return []
  const clean = text.replace(/\r\n/g, '\n').replace(/[\t\f\v]+/g, ' ').trim()
  if (clean.length <= maxLen) return [clean]

  const paragraphs = clean.split(/\n{2,}/g).map(p => p.trim()).filter(Boolean)
  const chunks: string[] = []
  let current = ''
  for (const p of paragraphs) {
    if ((current + (current ? '\n\n' : '') + p).length <= maxLen) {
      current = current ? current + '\n\n' + p : p
    } else {
      if (current) chunks.push(current)
      if (p.length <= maxLen) {
        current = p
      } else {
        // Hard slice long paragraph
        let i = 0
        while (i < p.length) {
          const slice = p.slice(i, i + maxLen)
          chunks.push(slice)
          i += maxLen
        }
        current = ''
      }
    }
  }
  if (current) chunks.push(current)
  return chunks
}
