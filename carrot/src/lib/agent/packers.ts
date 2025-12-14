/**
 * Content Packers for Agent Memory
 * 
 * Transforms DiscoveredContent into structured AgentMemory format
 * with summary, facts, entities, timeline extraction
 */

import { extractKeyPoints, extractTimeline, extractEntities } from '@/lib/readability'

export interface PackedContent {
  title: string
  summary: string // 4-6 sentences max
  facts: Array<{ text: string; date?: string }>
  entities: Array<{ name: string; type: string }>
  timeline: Array<{ date: string; what: string; refs: string[] }>
  rawTextPtr: string // Pointer to full text (not duplication)
}

export interface ContentPackOptions {
  maxSummarySentences?: number
  maxFacts?: number
  maxEntities?: number
  maxTimelineItems?: number
  maxQuotedChars?: number
}

const DEFAULT_OPTIONS: Required<ContentPackOptions> = {
  maxSummarySentences: 6,
  maxFacts: 12,
  maxEntities: 20,
  maxTimelineItems: 10,
  maxQuotedChars: 1200
}

/**
 * Pack discovered content into structured format for agent memory
 */
export async function packDiscoveredContent(
  content: {
    id: string
    title: string
    summary?: string | null
    whyItMatters?: string | null
    facts?: any
    keyFacts?: any
    textContent?: string | null
    sourceUrl: string
    publishDate?: Date | null
    domain?: string | null
    metadata?: any
  },
  options: ContentPackOptions = {}
): Promise<PackedContent> {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  
  // Get full text (prefer textContent, fallback to summary)
  const fullText = content.textContent || content.summary || content.whyItMatters || ''
  
  // Extract summary (4-6 sentences)
  const summary = extractSummary(content, opts.maxSummarySentences)
  
  // Extract facts
  const facts = extractFacts(content, fullText, opts.maxFacts)
  
  // Extract entities
  const entities = extractEntitiesFromContent(content, fullText, opts.maxEntities)
  
  // Extract timeline
  const timeline = extractTimelineFromContent(content, fullText, opts.maxTimelineItems)
  
  // Raw text pointer (reference to content ID, not duplication)
  const rawTextPtr = `discovered_content:${content.id}`
  
  return {
    title: content.title,
    summary,
    facts,
    entities,
    timeline,
    rawTextPtr
  }
}

/**
 * Extract or generate summary (4-6 sentences max)
 */
function extractSummary(
  content: { summary?: string | null; whyItMatters?: string | null },
  maxSentences: number
): string {
  // Prefer existing summary, then whyItMatters
  const source = content.summary || content.whyItMatters || ''
  
  if (!source) return ''
  
  // Split into sentences
  const sentences = source
    .split(/[.!?]+/)
    .map(s => s.trim())
    .filter(s => s.length > 10)
  
  // Take first N sentences
  const selected = sentences.slice(0, maxSentences)
  
  // Ensure proper ending punctuation
  return selected
    .map((s, i) => {
      if (i === selected.length - 1) {
        // Last sentence - ensure it ends with punctuation
        return s.match(/[.!?]$/) ? s : s + '.'
      }
      return s + '.'
    })
    .join(' ')
}

/**
 * Extract facts from content
 */
function extractFacts(
  content: { facts?: any; keyFacts?: any },
  fullText: string,
  maxFacts: number
): Array<{ text: string; date?: string }> {
  const facts: Array<{ text: string; date?: string }> = []
  
  // Try to extract from existing facts/keyFacts
  if (content.facts) {
    const factArray = Array.isArray(content.facts) ? content.facts : []
    for (const fact of factArray.slice(0, maxFacts)) {
      if (typeof fact === 'string') {
        facts.push({ text: fact })
      } else if (fact && typeof fact === 'object') {
        const text = fact.text || fact.value || fact.label
        const date = fact.date
        if (text && typeof text === 'string' && text.length >= 20) {
          facts.push({ text: String(text), date: date ? String(date) : undefined })
        }
      }
    }
  }
  
  // If we don't have enough, extract from keyFacts
  if (facts.length < maxFacts && content.keyFacts) {
    const keyFactsArray = Array.isArray(content.keyFacts) ? content.keyFacts : []
    for (const fact of keyFactsArray) {
      if (facts.length >= maxFacts) break
      if (typeof fact === 'string' && fact.length >= 20) {
        facts.push({ text: fact })
      }
    }
  }
  
  // If still not enough, extract from full text
  if (facts.length < maxFacts && fullText.length > 100) {
    try {
      const extracted = extractKeyPoints(fullText, maxFacts - facts.length)
      for (const point of extracted) {
        if (facts.length >= maxFacts) break
        if (point.length >= 20 && point.length <= 200) {
          facts.push({ text: point })
        }
      }
    } catch (error) {
      console.warn('[Packers] Failed to extract key points:', error)
    }
  }
  
  return facts.slice(0, maxFacts)
}

/**
 * Extract entities from content
 */
function extractEntitiesFromContent(
  content: { metadata?: any },
  fullText: string,
  maxEntities: number
): Array<{ name: string; type: string }> {
  const entities: Array<{ name: string; type: string }> = []
  
  // Try metadata entities first
  if (content.metadata?.entities && Array.isArray(content.metadata.entities)) {
    for (const entity of content.metadata.entities.slice(0, maxEntities)) {
      if (typeof entity === 'string') {
        entities.push({ name: entity, type: 'unknown' })
      } else if (entity && typeof entity === 'object') {
        const name = entity.name || entity.text
        const type = entity.type || 'unknown'
        if (name && typeof name === 'string') {
          entities.push({ name: String(name), type: String(type) })
        }
      }
    }
  }
  
  // If not enough, extract from text
  if (entities.length < maxEntities && fullText.length > 100) {
    try {
      const extracted = extractEntities(fullText)
      for (const entity of extracted) {
        if (entities.length >= maxEntities) break
        // Check for duplicates
        const exists = entities.some(e => e.name.toLowerCase() === entity.name.toLowerCase())
        if (!exists) {
          entities.push({
            name: entity.name,
            type: entity.type || 'unknown'
          })
        }
      }
    } catch (error) {
      console.warn('[Packers] Failed to extract entities:', error)
    }
  }
  
  return entities.slice(0, maxEntities)
}

/**
 * Extract timeline from content
 */
function extractTimelineFromContent(
  content: { metadata?: any },
  fullText: string,
  maxItems: number
): Array<{ date: string; what: string; refs: string[] }> {
  const timeline: Array<{ date: string; what: string; refs: string[] }> = []
  
  // Try metadata timeline first
  if (content.metadata?.timeline && Array.isArray(content.metadata.timeline)) {
    for (const item of content.metadata.timeline.slice(0, maxItems)) {
      if (item && typeof item === 'object') {
        const date = item.date || item.fact?.date
        const what = item.fact || item.content || item.text || item.what
        const refs = item.refs || item.references || []
        if (date && what) {
          timeline.push({
            date: String(date),
            what: String(what),
            refs: Array.isArray(refs) ? refs.map(String) : []
          })
        }
      }
    }
  }
  
  // If not enough, extract from text
  if (timeline.length < maxItems && fullText.length > 200) {
    try {
      const extracted = extractTimeline(fullText)
      for (const item of extracted.slice(0, maxItems - timeline.length)) {
        timeline.push({
          date: item.date || 'Date unknown',
          what: item.content || item.fact || '',
          refs: []
        })
      }
    } catch (error) {
      console.warn('[Packers] Failed to extract timeline:', error)
    }
  }
  
  return timeline.slice(0, maxItems)
}

/**
 * Sanitize content for agent consumption
 * - Strip boilerplate
 * - Clamp quoted text
 * - Store attribution
 */
export function sanitizeForAgent(content: string, maxQuotedChars: number = 1200): string {
  // Remove common boilerplate
  let sanitized = content
    .replace(/\s+/g, ' ') // Normalize whitespace
    .replace(/\[.*?\]/g, '') // Remove brackets
    .trim()
  
  // Clamp quoted text if too long
  if (sanitized.length > maxQuotedChars) {
    // Try to truncate at sentence boundary
    const truncated = sanitized.substring(0, maxQuotedChars)
    const lastPeriod = truncated.lastIndexOf('.')
    const lastExclamation = truncated.lastIndexOf('!')
    const lastQuestion = truncated.lastIndexOf('?')
    const lastSentenceEnd = Math.max(lastPeriod, lastExclamation, lastQuestion)
    
    if (lastSentenceEnd > maxQuotedChars * 0.8) {
      sanitized = sanitized.substring(0, lastSentenceEnd + 1)
    } else {
      // Truncate at word boundary
      const lastSpace = truncated.lastIndexOf(' ')
      if (lastSpace > maxQuotedChars * 0.8) {
        sanitized = sanitized.substring(0, lastSpace) + '...'
      } else {
        sanitized = truncated + '...'
      }
    }
  }
  
  return sanitized
}

