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

const RENDER_TIMEOUT_MS = Number(process.env.CRAWL_RENDER_TIMEOUT_MS || 12000)
// Enable renderer by default for production (can be disabled via env)
const RENDER_ENABLED = process.env.CRAWL_RENDER_ENABLED !== 'false' && (process.env.RENDERER_ENABLED === 'true' || process.env.CRAWL_RENDER_ENABLED === 'true' || process.env.NODE_ENV === 'production')

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
    // Use eval to prevent webpack from statically analyzing the require
    let playwright: any
    try {
      // Use eval to prevent webpack from analyzing at build time
      // eslint-disable-next-line no-eval
      playwright = eval('require')('playwright')
    } catch (importError) {
      return {
        html: '',
        text: '',
        title: '',
        success: false,
        error: 'playwright_not_installed'
      }
    }
    
    if (!playwright || !playwright.chromium) {
      return {
        html: '',
        text: '',
        title: '',
        success: false,
        error: 'playwright_not_available'
      }
    }
    
    const { chromium } = playwright
    
    // Verify Playwright browser is installed
    try {
      const executablePath = chromium.executablePath()
      if (!executablePath) {
        throw new Error('Playwright chromium executable not found. Run: npx playwright install chromium')
      }
    } catch (error) {
      console.error('[Renderer] Playwright installation check failed:', error)
      throw new Error('Playwright chromium not installed. Please run: npx playwright install --with-deps chromium')
    }
    
    const browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    })
    
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1920, height: 1080 }
    })
    
    // Block images/video/fonts to save bandwidth
    await context.route('**/*', (route: any) => {
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

    // Additional wait for content to render (JS-heavy sites need time)
    // Wait for either article/main to appear, or at least some substantial text
    try {
      await page.waitForFunction(
        () => {
          const article = document.querySelector('article')
          const main = document.querySelector('main')
          const bodyText = document.body.innerText || document.body.textContent || ''
          return (article && article.innerText.length > 100) || 
                 (main && main.innerText.length > 100) || 
                 bodyText.length > 500
        },
        { timeout: 3000 }
      ).catch(() => {
        // Timeout is OK - proceed with what we have
      })
    } catch {
      // Continue anyway
    }

    // Extract content
    const title = await page.title().catch(() => '')
    const html = await page.content().catch(() => '')

    // Extract main content using improved algorithm
    const text = await page.evaluate(() => {
      // Helper to get text content
      const getText = (el: Element | null): string => {
        if (!el) return ''
        return (el as HTMLElement).innerText?.trim() || el.textContent?.trim() || ''
      }

      // Try to find article tag first
      const article = document.querySelector('article')
      if (article) {
        const articleText = getText(article)
        if (articleText.length > 100) {
          return articleText
        }
      }
      
      // Try main tag
      const main = document.querySelector('main')
      if (main) {
        const mainText = getText(main)
        if (mainText.length > 100) {
          return mainText
        }
      }

      // Try common content containers
      const contentSelectors = [
        '[role="main"]',
        '[class*="content"]',
        '[class*="article"]',
        '[class*="post"]',
        '[id*="content"]',
        '[id*="main"]',
        '[id*="article"]'
      ]

      for (const selector of contentSelectors) {
        const el = document.querySelector(selector)
        if (el) {
          const text = getText(el)
          if (text.length > 200) {
            return text
          }
        }
      }
      
      // Fallback: largest text block heuristic (improved)
      const allElements = Array.from(document.querySelectorAll('p, div, section, article, main'))
      let largestBlock = ''
      let largestSize = 0
      
      for (const el of allElements) {
        const text = getText(el)
        // Look for substantial text blocks (lowered threshold for JS sites)
        if (text.length > largestSize && text.length > 100) {
          // Prefer elements with more structure (multiple paragraphs)
          const paragraphCount = el.querySelectorAll('p').length
          const score = text.length + (paragraphCount * 50)
          if (score > largestSize) {
            largestSize = score
            largestBlock = text
          }
        }
      }
      
      // If we found a good block, use it
      if (largestBlock.length > 200) {
        return largestBlock
      }

      // Final fallback: body text, but filter out very short content
      const bodyText = getText(document.body)
      if (bodyText.length > 500) {
        return bodyText
      }

      return ''
    }).catch((error) => {
      console.error('[Renderer] Error extracting text:', error)
      return ''
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

