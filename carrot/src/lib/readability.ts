/**
 * Readability utilities for content extraction
 */

interface ReadabilityResult {
  title: string
  content: string
  textContent: string
  length: number
  excerpt: string
  byline?: string
  dir?: string
  siteName?: string
  publishedTime?: string
}

// Simple readability implementation
export function extractReadableContent(html: string, url?: string): ReadabilityResult {
  // Create a temporary DOM parser
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')
  
  // Remove script and style elements
  const scripts = doc.querySelectorAll('script, style, noscript')
  scripts.forEach(el => el.remove())
  
  // Try to find the main content area
  const contentSelectors = [
    'article',
    '[role="main"]',
    '.post-content',
    '.entry-content',
    '.content',
    '.article-content',
    'main',
    '.main-content'
  ]
  
  let contentElement = null
  for (const selector of contentSelectors) {
    contentElement = doc.querySelector(selector)
    if (contentElement) break
  }
  
  // Fallback to body if no content area found
  if (!contentElement) {
    contentElement = doc.body
  }
  
  // Extract title
  const title = doc.querySelector('title')?.textContent || 
                doc.querySelector('h1')?.textContent || 
                'Untitled'
  
  // Extract content text
  const textContent = contentElement?.textContent || ''
  const content = contentElement?.innerHTML || ''
  
  // Generate excerpt (first 200 words)
  const words = textContent.split(/\s+/).slice(0, 200)
  const excerpt = words.join(' ') + (words.length === 200 ? '...' : '')
  
  // Extract metadata
  const byline = doc.querySelector('[rel="author"]')?.textContent ||
                 doc.querySelector('.author')?.textContent ||
                 doc.querySelector('[data-author]')?.getAttribute('data-author')
  
  const siteName = doc.querySelector('meta[property="og:site_name"]')?.getAttribute('content') ||
                   doc.querySelector('meta[name="application-name"]')?.getAttribute('content')
  
  const publishedTime = doc.querySelector('time[datetime]')?.getAttribute('datetime') ||
                       doc.querySelector('[data-published]')?.getAttribute('data-published')
  
  return {
    title: title.trim(),
    content: content.trim(),
    textContent: textContent.trim(),
    length: textContent.length,
    excerpt: excerpt.trim(),
    byline: byline?.trim(),
    siteName: siteName?.trim(),
    publishedTime: publishedTime?.trim()
  }
}

// Extract key points from content
export function extractKeyPoints(text: string, maxPoints: number = 5): string[] {
  const sentences = text
    .split(/[.!?]+/)
    .map(s => s.trim())
    .filter(s => s.length > 20 && s.length < 120)
    .slice(0, maxPoints * 2) // Get more candidates
  
  // Simple scoring based on length and position
  const scored = sentences.map((sentence, index) => ({
    text: sentence,
    score: sentence.length + (maxPoints - index) * 10 // Earlier sentences get higher score
  }))
  
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, maxPoints)
    .map(item => item.text)
}

// Extract timeline/chronological data
export function extractTimeline(text: string): Array<{date: string, content: string}> {
  const timeline: Array<{date: string, content: string}> = []
  
  // Look for date patterns
  const datePatterns = [
    /(\d{4})/g, // Years
    /(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}/gi,
    /\d{1,2}\/\d{1,2}\/\d{4}/g,
    /\d{4}-\d{2}-\d{2}/g
  ]
  
  const sentences = text.split(/[.!?]+/).map(s => s.trim())
  
  sentences.forEach(sentence => {
    for (const pattern of datePatterns) {
      const matches = sentence.match(pattern)
      if (matches && matches.length > 0) {
        timeline.push({
          date: matches[0],
          content: sentence
        })
        break
      }
    }
  })
  
  return timeline.slice(0, 10) // Limit to 10 timeline items
}

// Extract entities (people, teams, organizations)
export function extractEntities(text: string): Array<{type: string, name: string, context?: string}> {
  const entities: Array<{type: string, name: string, context?: string}> = []
  
  // Simple entity extraction patterns
  const patterns = {
    person: [
      /\b([A-Z][a-z]+ [A-Z][a-z]+)\b/g, // First Last
      /\b(Coach [A-Z][a-z]+)\b/g, // Coach Name
      /\b([A-Z][a-z]+ [A-Z][a-z]+ [A-Z][a-z]+)\b/g // First Middle Last
    ],
    team: [
      /\b([A-Z][a-z]+ [A-Z][a-z]+)\b/g, // Team names like "Chicago Bulls"
      /\b([A-Z][a-z]+ [A-Z][a-z]+ [A-Z][a-z]+)\b/g // Full team names
    ],
    organization: [
      /\b([A-Z][a-z]+ [A-Z][a-z]+)\b/g, // Organization names
      /\b([A-Z][a-z]+ [A-Z][a-z]+ [A-Z][a-z]+)\b/g // Full org names
    ]
  }
  
  Object.entries(patterns).forEach(([type, typePatterns]) => {
    typePatterns.forEach(pattern => {
      const matches = text.match(pattern)
      if (matches) {
        matches.forEach(match => {
          if (match.length > 3 && match.length < 50) { // Reasonable length
            entities.push({
              type,
              name: match.trim(),
              context: text.substring(Math.max(0, text.indexOf(match) - 50), text.indexOf(match) + match.length + 50)
            })
          }
        })
      }
    })
  })
  
  // Remove duplicates
  const unique = entities.filter((entity, index, self) => 
    index === self.findIndex(e => e.name === entity.name)
  )
  
  return unique.slice(0, 20) // Limit to 20 entities
}
