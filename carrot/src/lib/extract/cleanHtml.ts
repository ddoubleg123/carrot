/**
 * HTML extraction and sanitization utilities
 * Removes site chrome, navigation, legal text, and other non-content elements
 */

interface CleanHtmlResult {
  html: string
  text: string
  wordCount: number
  characterCount: number
}

// Elements and classes to strip (site chrome, navigation, ads, legal)
const STRIP_SELECTORS = [
  'nav',
  'header',
  'footer',
  'aside',
  'form',
  'iframe',
  'script',
  'style',
  'noscript',
  '.menu',
  '.nav',
  '.navigation',
  '.breadcrumbs',
  '.breadcrumb',
  '.cookie',
  '.cookies',
  '.legal',
  '.newsletter',
  '.share',
  '.social',
  '.modal',
  '.overlay',
  '.ad',
  '.ads',
  '.advertisement',
  '.promo',
  '.promotion',
  '[role="navigation"]',
  '[role="banner"]',
  '[role="contentinfo"]',
  '[role="complementary"]'
]

/**
 * Clean HTML content by removing site chrome and tiny blocks
 */
export function cleanHtml(html: string): CleanHtmlResult {
  // Remove elements by regex patterns
  let cleaned = html
  
  // Remove script, style, noscript tags with content
  cleaned = cleaned.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
  cleaned = cleaned.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
  cleaned = cleaned.replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, '')
  
  // Remove common site chrome elements
  const chromePatterns = [
    /<nav[^>]*>[\s\S]*?<\/nav>/gi,
    /<header[^>]*>[\s\S]*?<\/header>/gi,
    /<footer[^>]*>[\s\S]*?<\/footer>/gi,
    /<aside[^>]*>[\s\S]*?<\/aside>/gi,
    /<form[^>]*>[\s\S]*?<\/form>/gi,
    /<iframe[^>]*>[\s\S]*?<\/iframe>/gi
  ]
  
  chromePatterns.forEach(pattern => {
    cleaned = cleaned.replace(pattern, '')
  })
  
  // Remove elements with common class names (menu, nav, ads, etc.)
  const classPatterns = [
    /<[^>]+class="[^"]*\b(menu|nav|navigation|breadcrumb|cookie|legal|newsletter|share|social|modal|overlay|ad|advertisement|promo|promotion)\b[^"]*"[^>]*>[\s\S]*?<\/[^>]+>/gi
  ]
  
  classPatterns.forEach(pattern => {
    cleaned = cleaned.replace(pattern, '')
  })
  
  // Extract text content
  const textContent = cleaned.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
  
  // Split into blocks and filter out tiny ones
  const blocks = textContent.split(/\n\n+/)
    .map(block => block.trim())
    .filter(block => block.length > 200) // Keep blocks with 200+ chars
  
  // Merge consecutive short blocks
  const mergedBlocks: string[] = []
  let currentBlock = ''
  
  for (const block of blocks) {
    if (block.length < 500 && currentBlock.length < 500) {
      currentBlock = currentBlock ? `${currentBlock} ${block}` : block
    } else {
      if (currentBlock) {
        mergedBlocks.push(currentBlock)
      }
      currentBlock = block
    }
  }
  
  if (currentBlock) {
    mergedBlocks.push(currentBlock)
  }
  
  // Reconstruct HTML with cleaned blocks
  const cleanedHtml = mergedBlocks.map(block => `<p>${block}</p>`).join('\n')
  
  // Calculate word count
  const wordCount = textContent.split(/\s+/).filter(word => word.length > 0).length
  
  return {
    html: cleanedHtml,
    text: textContent,
    wordCount,
    characterCount: textContent.length
  }
}

/**
 * Extract dominant color from an image URL
 * Returns a hex color string
 */
export async function extractDominantColor(imageUrl: string): Promise<string> {
  // In a real implementation, this would use a library like 'node-vibrant' or 'fast-average-color'
  // For now, return a default color
  return '#3b82f6' // blue-500
}

/**
 * Sanitize HTML for safe display
 */
export function sanitizeForDisplay(html: string): string {
  // Remove potentially dangerous elements
  let safe = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<iframe[^>]*>[\s\S]*?<\/iframe>/gi, '')
    .replace(/<object[^>]*>[\s\S]*?<\/object>/gi, '')
    .replace(/<embed[^>]*>[\s\S]*?<\/embed>/gi, '')
    .replace(/<form[^>]*>[\s\S]*?<\/form>/gi, '')
    .replace(/<input[^>]*>/gi, '')
    .replace(/<button[^>]*>[\s\S]*?<\/button>/gi, '')
  
  // Remove event handlers and dangerous attributes
  safe = safe
    .replace(/\s+on\w+\s*=\s*["'][^"']*["']/gi, '')
    .replace(/\s+style\s*=\s*["'][^"']*["']/gi, '')
  
  return safe
}

/**
 * Truncate HTML to a maximum number of paragraphs
 */
export function truncateHtml(html: string, maxParagraphs: number = 4): string {
  const paragraphs = html.match(/<p[^>]*>[\s\S]*?<\/p>/gi) || []
  const truncated = paragraphs.slice(0, maxParagraphs).join('\n')
  
  return truncated
}
