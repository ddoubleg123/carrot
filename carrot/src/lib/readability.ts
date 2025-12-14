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
  // Extract title - prefer page title over site name
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
  let title = titleMatch ? titleMatch[1].trim() : 'Untitled'
  
  // Clean up title - remove site name if it's just a generic site name
  // e.g., "Zionist movement | Internet Encyclopedia of Ukraine" -> "Zionist movement"
  const titleParts = title.split(/\s*[|\-–—]\s*/)
  if (titleParts.length > 1) {
    // Check if first part is more specific (longer or contains keywords)
    const firstPart = titleParts[0].trim()
    const lastPart = titleParts[titleParts.length - 1].trim()
    
    // If first part is short and generic, use last part
    // If first part is longer/more specific, use first part
    if (firstPart.length > 10 && !firstPart.match(/^(Internet|Encyclopedia|The|A|An)\s/i)) {
      title = firstPart
    } else if (lastPart.length > 10) {
      title = lastPart
    }
  }
  
  // Also try to find h1 heading as a better title source
  const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i)
  if (h1Match) {
    const h1Title = h1Match[1].trim()
    // Use h1 if it's more specific than the page title
    if (h1Title.length > 5 && h1Title.length < 100) {
      title = h1Title
    }
  }
  
  // Remove script and style tags
  let cleanHtml = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, '')
  
  // Try to find main content area - expanded selectors for better extraction
  const contentSelectors = [
    /<article[^>]*>([\s\S]*?)<\/article>/i,
    /<main[^>]*>([\s\S]*?)<\/main>/i,
    /<div[^>]*class="[^"]*post-content[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
    /<div[^>]*class="[^"]*entry-content[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
    /<div[^>]*class="[^"]*article-content[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
    /<div[^>]*class="[^"]*article-body[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
    /<div[^>]*class="[^"]*post-body[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
    /<div[^>]*id="[^"]*content[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
    /<div[^>]*id="[^"]*main[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
    /<div[^>]*id="[^"]*article[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
    /<div[^>]*class="[^"]*content[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
    /<section[^>]*class="[^"]*content[^"]*"[^>]*>([\s\S]*?)<\/section>/i,
    /<section[^>]*class="[^"]*article[^"]*"[^>]*>([\s\S]*?)<\/section>/i
  ]
  
  let content = ''
  let bestContent = ''
  let bestLength = 0
  
  // Try all selectors and pick the one with most content
  for (const selector of contentSelectors) {
    const matches = cleanHtml.matchAll(new RegExp(selector.source, 'gi'))
    for (const match of matches) {
      if (match[1]) {
        const matchContent = match[1]
        const textLength = matchContent.replace(/<[^>]*>/g, '').trim().length
        if (textLength > bestLength) {
          bestContent = matchContent
          bestLength = textLength
        }
      }
    }
  }
  
  if (bestContent) {
    content = bestContent
  } else {
    // Fallback: try to find the largest div/section with substantial text
    const bodyMatch = cleanHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i)
    if (bodyMatch) {
      const bodyContent = bodyMatch[1]
      
      // Find all divs and sections, pick the one with most text
      const blockMatches = bodyContent.matchAll(/<(div|section)[^>]*>([\s\S]*?)<\/(div|section)>/gi)
      for (const match of blockMatches) {
        if (match[2]) {
          const blockText = match[2].replace(/<[^>]*>/g, '').trim()
          if (blockText.length > bestLength && blockText.length > 500) {
            bestContent = match[2]
            bestLength = blockText.length
          }
        }
      }
      
      content = bestContent || bodyContent
    } else {
      content = cleanHtml
    }
  }
  
  // Extract text content (remove HTML tags, but preserve structure)
  // First, convert block elements to newlines
  let textContent = content
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<\/tr>/gi, '\n')
    .replace(/<\/td>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, '') // Remove remaining HTML tags
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/\s+/g, ' ') // Normalize whitespace
    .replace(/\n\s*\n\s*\n+/g, '\n\n') // Normalize multiple newlines
    .trim()
  
  // Filter out common menu/navigation patterns
  const menuPatterns = [
    /^Menu\s+Menu\s+Home\s+About[^.]*?/i, // "Menu Menu Home About..."
    /^IEU\s+User\s+Info\s+Home\s+About/i, // "IEU User Info Home About..."
    /Home\s+About\s+IEU\s+User\s+Info\s+Contact/i, // "Home About IEU User Info Contact"
    /Search:\s*[^.]*?/i, // "Search: ..."
    /Donate\s+to\s+IEU/i, // "Donate to IEU"
    /Contact\s+Address\s+Donors/i, // "Contact Address Donors"
    /Address\s+Donate\s+to\s+IEU/i, // "Address Donate to IEU"
    /&lt;&lt;&lt;\s*&gt;&gt;&gt;\s*print/i, // "<<< >>> print"
  ]
  
  // Remove menu text from the beginning (try multiple times to catch all patterns)
  for (let attempt = 0; attempt < 3; attempt++) {
    let changed = false
    for (const pattern of menuPatterns) {
      const before = textContent
      textContent = textContent.replace(pattern, '').trim()
      if (textContent !== before) {
        changed = true
      }
    }
    if (!changed) break
  }
  
  // Also remove common navigation words if they appear at the start
  const navigationWords = ['menu', 'home', 'about', 'search', 'contact', 'donate', 'index', 'user', 'info', 'ieU']
  const words = textContent.split(/\s+/)
  let startIndex = 0
  let foundRealContent = false
  
  // Skip navigation words at the beginning until we find real content
  for (let i = 0; i < Math.min(30, words.length); i++) {
    const word = words[i].toLowerCase().replace(/[^a-z]/g, '')
    const cleanWord = word.replace(/[&<>;]/g, '') // Remove HTML entities
    
    if (navigationWords.includes(cleanWord) && !foundRealContent) {
      startIndex = i + 1
    } else if (cleanWord.length > 4 && !navigationWords.includes(cleanWord)) {
      // Found a real content word (longer than 4 chars and not a nav word)
      foundRealContent = true
      // But if we're still in the first 10 words, might be a heading, so continue
      if (i > 10) {
        break
      }
    }
  }
  
  textContent = words.slice(startIndex).join(' ').trim()
  
  // Remove any remaining HTML entities at the start
  textContent = textContent.replace(/^[&<>;0-9\s]+/i, '').trim()
  
  // Remove duplicate title at the start (e.g., "Zionist movement Zionist movement" -> "Zionist movement")
  const titleWords = title.split(/\s+/).filter(w => w.length > 2)
  if (titleWords.length > 0) {
    const titlePattern = new RegExp(`^(${titleWords.join('\\s+')}\\s+){2,}`, 'i')
    textContent = textContent.replace(titlePattern, titleWords.join(' ') + '. ').trim()
  }
  
  // Generate excerpt (first 200 words)
  const excerptWords = textContent.split(/\s+/).slice(0, 200)
  const excerpt = excerptWords.join(' ') + (excerptWords.length === 200 ? '...' : '')
  
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
