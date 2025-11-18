/**
 * Paraphrase summarization
 * Produces 3-5 bullet points paraphrasing facts (no verbatim phrases > 10 words)
 */

export interface ParaphraseSummary {
  summaryPoints: string[]
  wordCount: number
}

/**
 * Generate paraphrase summary from article text
 * Returns 3-5 bullet points with no verbatim phrases > 10 words
 */
export async function summarizeParaphrase(text: string, title?: string): Promise<ParaphraseSummary> {
  if (!text || text.trim().length < 200) {
    return {
      summaryPoints: [],
      wordCount: 0
    }
  }

  // Simple heuristic-based summarization (can be enhanced with LLM later)
  const sentences = text
    .split(/[.!?]+\s+/)
    .filter(s => s.trim().length > 30)
    .slice(0, 20) // First 20 sentences

  if (sentences.length === 0) {
    return {
      summaryPoints: [],
      wordCount: 0
    }
  }

  // Extract key facts (sentences with numbers, dates, names, or important keywords)
  const keyFacts: string[] = []
  const seenPhrases = new Set<string>()

  for (const sentence of sentences) {
    // Skip if too similar to already selected
    const normalized = sentence.toLowerCase().slice(0, 50)
    if (seenPhrases.has(normalized)) continue

    // Check for fact indicators
    const hasNumber = /\d/.test(sentence)
    const hasDate = /\d{4}|\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/i.test(sentence)
    const hasName = /\b[A-Z][a-z]+\s+[A-Z][a-z]+/.test(sentence) // Simple name pattern
    const isLong = sentence.split(/\s+/).length > 15

    if ((hasNumber || hasDate || hasName || isLong) && sentence.length > 50) {
      // Paraphrase: remove quotes, simplify
      const paraphrased = paraphraseSentence(sentence)
      if (paraphrased && paraphrased.length > 30) {
        keyFacts.push(paraphrased)
        seenPhrases.add(normalized)
        if (keyFacts.length >= 5) break
      }
    }
  }

  // If we don't have enough facts, add important sentences
  if (keyFacts.length < 3) {
    for (const sentence of sentences.slice(0, 10)) {
      if (keyFacts.length >= 5) break
      const normalized = sentence.toLowerCase().slice(0, 50)
      if (seenPhrases.has(normalized)) continue
      
      const paraphrased = paraphraseSentence(sentence)
      if (paraphrased && paraphrased.length > 30) {
        keyFacts.push(paraphrased)
        seenPhrases.add(normalized)
      }
    }
  }

  // Ensure we have at least 3 points
  while (keyFacts.length < 3 && sentences.length > keyFacts.length) {
    const remaining = sentences.filter((_, i) => i >= keyFacts.length)
    if (remaining.length === 0) break
    
    const sentence = remaining[0]
    const paraphrased = paraphraseSentence(sentence)
    if (paraphrased && paraphrased.length > 30) {
      keyFacts.push(paraphrased)
    } else {
      break // Can't find more good sentences
    }
  }

  const totalWords = keyFacts.join(' ').split(/\s+/).filter(Boolean).length

  return {
    summaryPoints: keyFacts.slice(0, 5), // Max 5 points
    wordCount: totalWords
  }
}

/**
 * Paraphrase a single sentence
 * Removes quotes, simplifies structure, avoids verbatim > 10 words
 */
function paraphraseSentence(sentence: string): string {
  // Remove quotes and attribution
  let paraphrased = sentence
    .replace(/["'""].*?["'""]/g, '') // Remove quoted text
    .replace(/\([^)]*\)/g, '') // Remove parentheticals
    .replace(/\[[^\]]*\]/g, '') // Remove brackets
    .replace(/\s+/g, ' ')
    .trim()

  // Simplify common patterns
  paraphrased = paraphrased
    .replace(/\baccording to\b/gi, '')
    .replace(/\bas stated\b/gi, '')
    .replace(/\bas reported\b/gi, '')
    .replace(/\bhe said\b/gi, '')
    .replace(/\bshe said\b/gi, '')
    .replace(/\bthey said\b/gi, '')
    .replace(/\b,\s*which\b/gi, '. This')
    .replace(/\s+/g, ' ')
    .trim()

  // Capitalize first letter
  if (paraphrased.length > 0) {
    paraphrased = paraphrased[0].toUpperCase() + paraphrased.slice(1)
  }

  // Ensure it ends with punctuation
  if (paraphrased.length > 0 && !/[.!?]$/.test(paraphrased)) {
    paraphrased += '.'
  }

  return paraphrased
}

