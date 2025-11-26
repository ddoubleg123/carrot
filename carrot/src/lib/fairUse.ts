/**
 * Fair-use text extraction clamp
 * Centralized logic for ≤2 paragraphs / ≤1200 chars limit
 * Call this ONLY server-side before save/hero render
 */

export const MAX_FAIR_USE_CHARS = 1200
export const MAX_FAIR_USE_PARAGRAPHS = 2

export interface FairUseResult {
  text: string
  charCount: number
  paragraphCount: number
  wasTruncated: boolean
}

/**
 * Clamp text to fair-use limits: ≤2 paragraphs, ≤1200 chars
 * Returns the clamped text and metadata
 */
export function clampFairUse(text: string, paragraphs: string[] = []): FairUseResult {
  // If paragraphs provided, use them; otherwise split text
  let workingParagraphs = paragraphs.length > 0 
    ? paragraphs 
    : text.split(/\n\s*\n/).map(p => p.trim()).filter(p => p.length > 0)

  // Select up to MAX_FAIR_USE_PARAGRAPHS paragraphs
  const selected = workingParagraphs.slice(0, MAX_FAIR_USE_PARAGRAPHS)
  
  // Join and truncate to MAX_FAIR_USE_CHARS
  let result = selected.join('\n\n')
  const wasTruncated = result.length > MAX_FAIR_USE_CHARS || selected.length < workingParagraphs.length
  
  if (result.length > MAX_FAIR_USE_CHARS) {
    result = result.substring(0, MAX_FAIR_USE_CHARS - 3) + '...'
  }

  return {
    text: result,
    charCount: result.length,
    paragraphCount: selected.length,
    wasTruncated
  }
}

/**
 * Convert clamped text to HTML paragraphs
 */
export function clampFairUseToHtml(text: string, paragraphs: string[] = []): string {
  const clamped = clampFairUse(text, paragraphs)
  return clamped.text.split('\n\n').map(p => `<p>${p}</p>`).join('')
}

