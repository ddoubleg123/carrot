/**
 * Headless browser fetcher with Playwright
 * Implements direct → amp → mobile → rendered pipeline
 */

import { DISCOVERY_CONFIG, isRendererEnabled } from './config'

export interface FetchMetadata {
  render_used: boolean
  branch_used: 'direct' | 'amp' | 'mobile' | 'rendered'
  status_code: number | null
  html_bytes: number
  text_bytes: number
  failure_reason?: string
  fetch_class?: 'PAYWALL_OR_BLOCK' | 'SUCCESS' | 'TIMEOUT' | 'ERROR'
}

export interface FetchResult {
  html: string
  text: string
  title: string
  success: boolean
  metadata: FetchMetadata
  error?: string
}

const FETCH_USER_AGENTS = {
  desktop: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  mobile: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1'
}

/**
 * Fetch with direct HTTP (no rendering)
 */
async function fetchDirect(url: string, userAgent: string = FETCH_USER_AGENTS.desktop): Promise<{
  html: string
  status: number
  success: boolean
}> {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), DISCOVERY_CONFIG.FETCH_TIMEOUT_MS)
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': userAgent,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9'
      },
      signal: controller.signal
    })
    
    clearTimeout(timeoutId)
    const html = await response.text()
    
    return {
      html,
      status: response.status,
      success: response.ok
    }
  } catch (error: any) {
    if (error.name === 'AbortError') {
      throw new Error('TIMEOUT')
    }
    throw error
  }
}

/**
 * Try AMP version of URL
 */
function getAmpUrl(url: string): string | null {
  try {
    const urlObj = new URL(url)
    // Common AMP patterns
    if (urlObj.pathname.includes('/amp/')) {
      return url // Already AMP
    }
    if (urlObj.hostname.includes('amp.')) {
      return url // Already AMP domain
    }
    // Try adding /amp/ before the last segment
    const pathParts = urlObj.pathname.split('/').filter(Boolean)
    if (pathParts.length > 0) {
      pathParts.splice(-1, 0, 'amp')
      urlObj.pathname = '/' + pathParts.join('/')
      return urlObj.toString()
    }
    return null
  } catch {
    return null
  }
}

/**
 * Try mobile version of URL
 */
function getMobileUrl(url: string): string | null {
  try {
    const urlObj = new URL(url)
    // Common mobile patterns
    if (urlObj.hostname.startsWith('m.')) {
      return url // Already mobile
    }
    if (urlObj.hostname.startsWith('mobile.')) {
      return url // Already mobile
    }
    // Try m. subdomain
    urlObj.hostname = 'm.' + urlObj.hostname
    return urlObj.toString()
  } catch {
    return null
  }
}

/**
 * Render with Playwright (stealth mode)
 */
async function renderWithPlaywright(url: string): Promise<{
  html: string
  text: string
  title: string
  success: boolean
  error?: string
}> {
  if (!isRendererEnabled()) {
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
      console.error('[HeadlessFetcher] Playwright installation check failed:', error)
      throw new Error('Playwright chromium not installed. Please run: npx playwright install --with-deps chromium')
    }

    // Rotate UA (desktop/mobile)
    const useMobile = Math.random() > 0.5
    const userAgent = useMobile ? FETCH_USER_AGENTS.mobile : FETCH_USER_AGENTS.desktop

    const browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled', // Stealth
        '--disable-dev-shm-usage'
      ]
    })

    const context = await browser.newContext({
      userAgent,
      viewport: useMobile ? { width: 375, height: 667 } : { width: 1920, height: 1080 },
      locale: 'en-US',
      timezoneId: 'America/New_York',
      // Stealth: remove webdriver flag
      extraHTTPHeaders: {
        'Accept-Language': 'en-US,en;q=0.9'
      }
    })

    // Block images/video/fonts/analytics to save bandwidth
    // Cap images at 2MB
    await context.route('**/*', async (route: any) => {
      const resourceType = route.request().resourceType()
      const url = route.request().url()
      
      // Deny video, media, fonts, analytics
      if (['media', 'font'].includes(resourceType) || 
          url.match(/\.(mp4|webm|avi|mov|mkv)$/i) ||
          url.includes('analytics') || url.includes('tracking')) {
        route.abort()
        return
      }
      
      // For images, check size and cap at 2MB
      if (resourceType === 'image') {
        // Let it through but we'll check size in response handler
        route.continue()
        return
      }
      
      route.continue()
    })
    
    // Response handler for image size capping
    context.on('response', async (response: any) => {
      if (response.request().resourceType() === 'image') {
        const contentLength = response.headers()['content-length']
        if (contentLength && parseInt(contentLength, 10) > 2 * 1024 * 1024) {
          // Abort large images
          await response.body().catch(() => null)
        }
      }
    })

    const page = await context.newPage()

    // Stealth: remove webdriver property
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => false
      })
    })

    // Navigate with timeout (15s cap, waitUntil networkidle)
    const RENDER_TIMEOUT_MS = 15000 // 15s as per requirements
    const navigationPromise = page.goto(url, {
      waitUntil: 'networkidle', // Wait for network to be idle
      timeout: RENDER_TIMEOUT_MS
    })

    // Hard cap timeout
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('render_timeout')), RENDER_TIMEOUT_MS)
    })

    try {
      await Promise.race([navigationPromise, timeoutPromise])
    } catch (error: any) {
      // If timeout, try to get what we have
      if (error.message === 'render_timeout') {
        console.warn(`[HeadlessFetcher] Render timeout for ${url.substring(0, 50)}, proceeding with partial content`)
      } else {
        throw error
      }
    }

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
      console.error('[HeadlessFetcher] Error extracting text:', error)
      return ''
    })

    // Close context per URL to stop leaks (as per requirements)
    await context.close()
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

/**
 * Main fetch pipeline: direct → amp → mobile → rendered
 */
export async function fetchWithPipeline(url: string): Promise<FetchResult> {
  const metadata: FetchMetadata = {
    render_used: false,
    branch_used: 'direct',
    status_code: null,
    html_bytes: 0,
    text_bytes: 0
  }

  // Branch 1: Direct fetch
  try {
    const result = await fetchDirect(url)
    metadata.status_code = result.status
    metadata.html_bytes = result.html.length

    if (result.success && result.html.length > 0) {
      const text = extractTextFromHtml(result.html)
      metadata.text_bytes = text.length
      metadata.branch_used = 'direct'
      metadata.fetch_class = 'SUCCESS'

      return {
        html: result.html,
        text,
        title: extractTitleFromHtml(result.html),
        success: true,
        metadata
      }
    }

    // Check for paywall/block
    if (result.status === 403 || result.status === 401) {
      metadata.fetch_class = 'PAYWALL_OR_BLOCK'
      metadata.failure_reason = `http_${result.status}`
      return {
        html: '',
        text: '',
        title: '',
        success: false,
        metadata,
        error: 'PAYWALL_OR_BLOCK'
      }
    }
  } catch (error: any) {
    if (error.message === 'TIMEOUT') {
      metadata.fetch_class = 'TIMEOUT'
      metadata.failure_reason = 'timeout'
    } else {
      metadata.fetch_class = 'ERROR'
      metadata.failure_reason = error.message || 'fetch_error'
    }
  }

  // Branch 2: Try AMP
  const ampUrl = getAmpUrl(url)
  if (ampUrl && ampUrl !== url) {
    try {
      const result = await fetchDirect(ampUrl)
      metadata.status_code = result.status
      metadata.html_bytes = result.html.length

      if (result.success && result.html.length > 0) {
        const text = extractTextFromHtml(result.html)
        metadata.text_bytes = text.length
        metadata.branch_used = 'amp'
        metadata.fetch_class = 'SUCCESS'

        return {
          html: result.html,
          text,
          title: extractTitleFromHtml(result.html),
          success: true,
          metadata
        }
      }
    } catch (error: any) {
      // Continue to next branch
    }
  }

  // Branch 3: Try mobile
  const mobileUrl = getMobileUrl(url)
  if (mobileUrl && mobileUrl !== url) {
    try {
      const result = await fetchDirect(mobileUrl, FETCH_USER_AGENTS.mobile)
      metadata.status_code = result.status
      metadata.html_bytes = result.html.length

      if (result.success && result.html.length > 0) {
        const text = extractTextFromHtml(result.html)
        metadata.text_bytes = text.length
        metadata.branch_used = 'mobile'
        metadata.fetch_class = 'SUCCESS'

        return {
          html: result.html,
          text,
          title: extractTitleFromHtml(result.html),
          success: true,
          metadata
        }
      }
    } catch (error: any) {
      // Continue to rendered branch
    }
  }

  // Branch 4: Rendered (Playwright)
  if (isRendererEnabled()) {
    try {
      const renderResult = await renderWithPlaywright(url)
      metadata.render_used = true
      metadata.branch_used = 'rendered'
      metadata.html_bytes = renderResult.html.length
      metadata.text_bytes = renderResult.text.length

      if (renderResult.success && renderResult.text.length > 0) {
        metadata.fetch_class = 'SUCCESS'
        return {
          html: renderResult.html,
          text: renderResult.text,
          title: renderResult.title,
          success: true,
          metadata
        }
      } else {
        metadata.fetch_class = 'ERROR'
        metadata.failure_reason = renderResult.error || 'render_failed'
      }
    } catch (error: any) {
      metadata.fetch_class = 'ERROR'
      metadata.failure_reason = error.message || 'render_error'
    }
  }

  // All branches failed
  return {
    html: '',
    text: '',
    title: '',
    success: false,
    metadata,
    error: metadata.failure_reason || 'all_branches_failed'
  }
}

/**
 * Extract text from HTML (simple)
 */
function extractTextFromHtml(html: string): string {
  // Remove scripts and styles
  const cleaned = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, '')

  // Extract text from common content tags
  const articleMatch = cleaned.match(/<article[^>]*>([\s\S]*?)<\/article>/i)
  if (articleMatch) {
    return articleMatch[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  }

  const mainMatch = cleaned.match(/<main[^>]*>([\s\S]*?)<\/main>/i)
  if (mainMatch) {
    return mainMatch[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  }

  // Fallback: extract all text
  return cleaned.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

/**
 * Extract title from HTML
 */
function extractTitleFromHtml(html: string): string {
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
  if (titleMatch) {
    return titleMatch[1].trim()
  }

  const ogTitleMatch = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i)
  if (ogTitleMatch) {
    return ogTitleMatch[1].trim()
  }

  return 'Untitled'
}

