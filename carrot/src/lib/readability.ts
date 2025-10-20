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
  // Simple regex-based extraction (works in Node.js)
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
  const title = titleMatch ? titleMatch[1].trim() : 'Untitled'
  
  // Remove script and style tags
  let cleanHtml = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, '')
  
  // Try to find main content area
  const contentSelectors = [
    /<article[^>]*>([\s\S]*?)<\/article>/i,
    /<main[^>]*>([\s\S]*?)<\/main>/i,
    /<div[^>]*class="[^"]*post-content[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
    /<div[^>]*class="[^"]*entry-content[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
    /<div[^>]*class="[^"]*content[^"]*"[^>]*>([\s\S]*?)<\/div>/i
  ]
  
  let content = ''
  for (const selector of contentSelectors) {
    const match = cleanHtml.match(selector)
    if (match && match[1]) {
      content = match[1]
      break
    }
  }
  
  // Fallback to body content
  if (!content) {
    const bodyMatch = cleanHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i)
    content = bodyMatch ? bodyMatch[1] : cleanHtml
  }
  
  // Extract text content (remove HTML tags)
  const textContent = content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
  
  // Generate excerpt (first 200 words)
  const words = textContent.split(/\s+/).slice(0, 200)
  const excerpt = words.join(' ') + (words.length === 200 ? '...' : '')
  
  // Extract metadata
  const bylineMatch = html.match(/<meta[^>]*name="author"[^>]*content="([^"]*)"[^>]*>/i) ||
                     html.match(/<span[^>]*class="[^"]*author[^"]*"[^>]*>([^<]+)<\/span>/i)
  const byline = bylineMatch ? bylineMatch[1].trim() : undefined
  
  const siteNameMatch = html.match(/<meta[^>]*property="og:site_name"[^>]*content="([^"]*)"[^>]*>/i)
  const siteName = siteNameMatch ? siteNameMatch[1].trim() : undefined
  
  const publishedMatch = html.match(/<time[^>]*datetime="([^"]*)"[^>]*>/i) ||
                        html.match(/<meta[^>]*property="article:published_time"[^>]*content="([^"]*)"[^>]*>/i)
  const publishedTime = publishedMatch ? publishedMatch[1].trim() : undefined
  
  return {
    title,
    content: content.trim(),
    textContent,
    length: textContent.length,
    excerpt,
    byline,
    siteName,
    publishedTime
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
