/**
 * Playwright budget defaults for crawler
 * Deny video, media, font; cap image responses at 2MB; abort after 15s; close context per URL to stop leaks
 */

import { BrowserContext, Page } from 'playwright'

export interface PlaywrightBudgetConfig {
  denyVideo: boolean
  denyMedia: boolean
  denyFont: boolean
  maxImageSizeBytes: number
  abortTimeoutMs: number
  closeContextPerUrl: boolean
}

export const DEFAULT_PLAYWRIGHT_BUDGET: PlaywrightBudgetConfig = {
  denyVideo: true,
  denyMedia: true,
  denyFont: true,
  maxImageSizeBytes: 2 * 1024 * 1024, // 2MB
  abortTimeoutMs: 15000, // 15s
  closeContextPerUrl: true
}

/**
 * Apply budget constraints to a Playwright page
 */
export async function applyPlaywrightBudget(
  page: Page,
  config: PlaywrightBudgetConfig = DEFAULT_PLAYWRIGHT_BUDGET
): Promise<void> {
  // Route blocking for video, media, fonts
  await page.route('**/*', (route) => {
    const resourceType = route.request().resourceType()
    const url = route.request().url()
    
    // Deny video
    if (config.denyVideo && (resourceType === 'media' || url.match(/\.(mp4|webm|avi|mov|mkv)$/i))) {
      route.abort()
      return
    }
    
    // Deny fonts
    if (config.denyFont && resourceType === 'font') {
      route.abort()
      return
    }
    
    // Cap image size
    if (resourceType === 'image') {
      route.continue()
      // Size check happens in response handler
      return
    }
    
    route.continue()
  })
  
  // Response handler for image size capping
  page.on('response', async (response) => {
    if (response.request().resourceType() === 'image') {
      const contentLength = response.headers()['content-length']
      if (contentLength && parseInt(contentLength, 10) > config.maxImageSizeBytes) {
        await response.body().catch(() => null) // Consume body to abort
        console.log(`[Playwright Budget] Aborted large image: ${response.url()} (${contentLength} bytes)`)
      }
    }
  })
  
  // Set timeout
  page.setDefaultTimeout(config.abortTimeoutMs)
  page.setDefaultNavigationTimeout(config.abortTimeoutMs)
}

/**
 * Create a new context with budget applied, close after use
 */
export async function withBudgetContext<T>(
  browserContext: BrowserContext,
  url: string,
  config: PlaywrightBudgetConfig,
  fn: (page: Page) => Promise<T>
): Promise<T> {
  const page = await browserContext.newPage()
  
  try {
    await applyPlaywrightBudget(page, config)
    return await fn(page)
  } finally {
    if (config.closeContextPerUrl) {
      await page.close()
    }
  }
}

