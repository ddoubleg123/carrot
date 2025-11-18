/**
 * Fair-use quote extraction
 * Extracts up to 2 contiguous paragraphs (max ~250-300 words) for fair use quoting
 */

export interface FairUseQuote {
  quoteHtml: string
  quoteText: string
  quoteWordCount: number
  quoteStartChar: number
  quoteEndChar: number
}

/**
 * Extract up to 2 contiguous paragraphs from article text
 * Returns the quote with HTML, text, word count, and character offsets
 */
export function extractFairUseQuote(articleHtml: string, articleText: string): FairUseQuote | null {
  if (!articleText || articleText.trim().length < 100) {
    return null
  }

  // Find main content paragraphs in HTML
  const paragraphMatches = articleHtml.match(/<p[^>]*>([\s\S]*?)<\/p>/gi)
  if (!paragraphMatches || paragraphMatches.length === 0) {
    // Fallback: try to extract from text
    return extractFromText(articleText)
  }

  // Extract text from first few paragraphs
  const paragraphs: Array<{ html: string; text: string; wordCount: number }> = []
  let totalWords = 0
  const MAX_WORDS = 300

  for (const paraMatch of paragraphMatches.slice(0, 5)) {
    const html = paraMatch
    const text = html
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    
    if (text.length < 50) continue // Skip very short paragraphs
    
    const wordCount = text.split(/\s+/).filter(Boolean).length
    if (totalWords + wordCount > MAX_WORDS && paragraphs.length >= 1) {
      break // Stop if adding this would exceed limit
    }
    
    paragraphs.push({ html, text, wordCount })
    totalWords += wordCount
    
    if (paragraphs.length >= 2) {
      break // Max 2 paragraphs
    }
  }

  if (paragraphs.length === 0) {
    return extractFromText(articleText)
  }

  // Combine paragraphs
  const quoteHtml = paragraphs.map(p => p.html).join('\n\n')
  const quoteText = paragraphs.map(p => p.text).join('\n\n')
  const quoteWordCount = totalWords

  // Find character offsets in original text
  const quoteStartChar = articleText.indexOf(paragraphs[0].text)
  const quoteEndChar = quoteStartChar >= 0 
    ? quoteStartChar + quoteText.length 
    : 0

  return {
    quoteHtml,
    quoteText,
    quoteWordCount,
    quoteStartChar: quoteStartChar >= 0 ? quoteStartChar : 0,
    quoteEndChar
  }
}

/**
 * Fallback: extract from plain text if HTML parsing fails
 */
function extractFromText(text: string): FairUseQuote | null {
  const sentences = text.split(/[.!?]+\s+/).filter(s => s.trim().length > 20)
  if (sentences.length === 0) return null

  let selectedText = ''
  let wordCount = 0
  const MAX_WORDS = 300

  for (const sentence of sentences.slice(0, 10)) {
    const sentenceWords = sentence.split(/\s+/).filter(Boolean).length
    if (wordCount + sentenceWords > MAX_WORDS) break
    
    selectedText += (selectedText ? ' ' : '') + sentence.trim()
    wordCount += sentenceWords
    
    if (wordCount >= 200) break // Good enough
  }

  if (selectedText.length < 100) return null

  const quoteStartChar = text.indexOf(selectedText)
  const quoteEndChar = quoteStartChar >= 0 ? quoteStartChar + selectedText.length : 0

  return {
    quoteHtml: `<p>${selectedText}</p>`,
    quoteText: selectedText,
    quoteWordCount: wordCount,
    quoteStartChar: quoteStartChar >= 0 ? quoteStartChar : 0,
    quoteEndChar
  }
}

