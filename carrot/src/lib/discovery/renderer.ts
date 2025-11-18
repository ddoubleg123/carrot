/**
 * Playwright-based renderer for JS-rendered pages
 * Handles sites like nba.com, theathletic.com that require JavaScript execution
 */

const JS_DOMAIN_PATTERNS = [
  /nba\.com$/i,
  /theathletic\.com$/i,
  /espn\.com$/i,
  /bleacherreport\.com$/i,
  /sbnation\.com$/i,
]

const RENDER_TIMEOUT_MS = Number(process.env.CRAWL_RENDER_TIMEOUT_MS || 16000)
const RENDER_ENABLED = process.env.CRAWL_RENDER_ENABLED === 'true'

/**
 * Check if a domain is known to be JS-driven
 */
export function isJsDomain(domain: string | null): boolean {
  if (!domain) return false
  return JS_DOMAIN_PATTERNS.some(pattern => pattern.test(domain))
}

/**
 * Check if HTML suggests JS rendering is needed
 */
export function needsJsRendering(html: string, textLength: number): boolean {
  // If HTML is < 5k bytes or extracted text is very short, likely needs JS
  if (html.length < 5000 || textLength < 100) {
    return true
  }
  
  // Check for common JS framework indicators
  const jsIndicators = [
    /<script[^>]*type=["']module["']/i,
    /<script[^>]*src=["'][^"']*react/i,
    /<script[^>]*src=["'][^"']*vue/i,
    /<script[^>]*src=["'][^"']*angular/i,
    /<div[^>]*id=["']root["']/i,
    /<div[^>]*id=["']app["']/i,
    /<article[^>]*>[\s\S]{0,500}<\/article>/i, // Empty or very short article tag
  ]
  
  return jsIndicators.some(pattern => pattern.test(html))
}

/**
 * Render page with Playwright and extract content
 */
export async function renderWithPlaywright(url: string): Promise<{
  html: string
  text: string
  title: string
  success: boolean
  error?: string
}> {
  if (!RENDER_ENABLED) {
    return {
      html: '',
      text: '',
      title: '',
      success: false,
      error: 'renderer_disabled'
    }
  }

  try {
    // Dynamic import to avoid breaking if Playwright isn't installed
    let playwright: any
    try {
      playwright = await import('playwright')
    } catch (importError) {
      return {
        html: '',
        text: '',
        title: '',
        success: false,
        error: 'playwright_not_installed'
      }
    }
    
    const { chromium } = playwright
    
    const browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    })
    
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1920, height: 1080 }
    })
    
    // Block images/video/fonts to save bandwidth
    await context.route('**/*', (route) => {
      const resourceType = route.request().resourceType()
      if (['image', 'media', 'font'].includes(resourceType)) {
        route.abort()
      } else {
        route.continue()
      }
    })
    
    const page = await context.newPage()
    
    // Navigate with timeout
    const navigationPromise = page.goto(url, {
      waitUntil: 'networkidle',
      timeout: RENDER_TIMEOUT_MS
    })
    
    // Hard cap at 16s
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('render_timeout')), RENDER_TIMEOUT_MS)
    })
    
    await Promise.race([navigationPromise, timeoutPromise])
    
    // Wait for network idle (2 inflight requests max)
    await page.waitForLoadState('networkidle', { timeout: 2000 }).catch(() => {
      // Ignore timeout - proceed with what we have
    })
    
    // Extract content
    const title = await page.title()
    const html = await page.content()
    
    // Extract main content using Readability-like algorithm
    const text = await page.evaluate(() => {
      // Try to find article tag first
      const article = document.querySelector('article')
      if (article) {
        return article.innerText.trim()
      }
      
      // Try main tag
      const main = document.querySelector('main')
      if (main) {
        return main.innerText.trim()
      }
      
      // Fallback: largest text block heuristic
      const allElements = Array.from(document.querySelectorAll('p, div, section'))
      let largestBlock = ''
      let largestSize = 0
      
      for (const el of allElements) {
        const text = el.innerText.trim()
        if (text.length > largestSize && text.length > 200) {
          largestSize = text.length
          largestBlock = text
        }
      }
      
      return largestBlock || document.body.innerText.trim()
    })
    
    await browser.close()
    
    return {
      html,
      text,
      title,
      success: true
    }
  } catch (error: any) {
    const errorMsg = error.message || 'render_error'
    return {
      html: '',
      text: '',
      title: '',
      success: false,
      error: errorMsg
    }
  }
}

