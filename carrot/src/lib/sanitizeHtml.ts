/**
 * HTML sanitization utilities
 */

// Simple HTML sanitizer - regex-based for Node.js compatibility
export function sanitizeHtml(html: string): string {
  // Remove potentially dangerous elements
  let cleanHtml = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<iframe[^>]*>[\s\S]*?<\/iframe>/gi, '')
    .replace(/<object[^>]*>[\s\S]*?<\/object>/gi, '')
    .replace(/<embed[^>]*>[\s\S]*?<\/embed>/gi, '')
    .replace(/<form[^>]*>[\s\S]*?<\/form>/gi, '')
    .replace(/<input[^>]*>/gi, '')
    .replace(/<button[^>]*>[\s\S]*?<\/button>/gi, '')
  
  // Remove dangerous attributes
  cleanHtml = cleanHtml
    .replace(/\s+on\w+\s*=\s*["'][^"']*["']/gi, '') // Remove event handlers
    .replace(/\s+style\s*=\s*["'][^"']*["']/gi, '') // Remove style attributes
    .replace(/\s+class\s*=\s*["'][^"']*["']/gi, '') // Remove class attributes
    .replace(/\s+id\s*=\s*["'][^"']*["']/gi, '') // Remove id attributes
  
  // Remove empty paragraphs and divs
  cleanHtml = cleanHtml.replace(/<p>\s*<\/p>/g, '')
  cleanHtml = cleanHtml.replace(/<div>\s*<\/div>/g, '')
  
  // Normalize whitespace
  cleanHtml = cleanHtml.replace(/\s+/g, ' ')
  
  return cleanHtml.trim()
}

// Extract plain text from HTML
export function extractTextFromHtml(html: string): string {
  // Remove HTML tags and get plain text
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// Truncate HTML content to a specific word count
export function truncateHtml(html: string, maxWords: number = 200): string {
  const text = extractTextFromHtml(html)
  const words = text.split(/\s+/)
  
  if (words.length <= maxWords) {
    return html
  }
  
  // Find the position in HTML that corresponds to the word limit
  const truncatedText = words.slice(0, maxWords).join(' ')
  const truncatedHtml = html.substring(0, html.indexOf(truncatedText) + truncatedText.length)
  
  return truncatedHtml + '...'
}

// Clean and format HTML for display
export function formatHtmlForDisplay(html: string): string {
  let cleanHtml = sanitizeHtml(html)
  
  // Add proper spacing around block elements
  cleanHtml = cleanHtml.replace(/<(h[1-6]|p|div|section|article)>/g, '\n<$1>')
  cleanHtml = cleanHtml.replace(/<\/(h[1-6]|p|div|section|article)>/g, '</$1>\n')
  
  // Clean up multiple newlines
  cleanHtml = cleanHtml.replace(/\n\s*\n/g, '\n')
  
  return cleanHtml.trim()
}
