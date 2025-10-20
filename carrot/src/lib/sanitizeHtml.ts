/**
 * HTML sanitization utilities
 */

// Simple HTML sanitizer - in production, use a library like DOMPurify
export function sanitizeHtml(html: string): string {
  // Create a temporary DOM parser
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')
  
  // Remove potentially dangerous elements
  const dangerousElements = doc.querySelectorAll('script, style, iframe, object, embed, form, input, button')
  dangerousElements.forEach(el => el.remove())
  
  // Remove attributes that could be dangerous
  const allElements = doc.querySelectorAll('*')
  allElements.forEach(el => {
    // Remove event handlers and dangerous attributes
    const dangerousAttrs = [
      'onclick', 'onload', 'onerror', 'onmouseover', 'onfocus', 'onblur',
      'onchange', 'onsubmit', 'onreset', 'onselect', 'onkeydown', 'onkeyup',
      'onkeypress', 'onmousedown', 'onmouseup', 'onmousemove', 'onmouseout',
      'style', 'class', 'id'
    ]
    
    dangerousAttrs.forEach(attr => {
      el.removeAttribute(attr)
    })
    
    // Keep only safe attributes
    const safeAttrs = ['href', 'src', 'alt', 'title', 'target', 'rel']
    const attrs = Array.from(el.attributes)
    attrs.forEach(attr => {
      if (!safeAttrs.includes(attr.name)) {
        el.removeAttribute(attr.name)
      }
    })
  })
  
  // Clean up the HTML
  let cleanHtml = doc.body.innerHTML
  
  // Remove empty paragraphs and divs
  cleanHtml = cleanHtml.replace(/<p>\s*<\/p>/g, '')
  cleanHtml = cleanHtml.replace(/<div>\s*<\/div>/g, '')
  
  // Normalize whitespace
  cleanHtml = cleanHtml.replace(/\s+/g, ' ')
  
  return cleanHtml.trim()
}

// Extract plain text from HTML
export function extractTextFromHtml(html: string): string {
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')
  
  // Remove script and style elements
  const scripts = doc.querySelectorAll('script, style, noscript')
  scripts.forEach(el => el.remove())
  
  return doc.body.textContent || ''
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
