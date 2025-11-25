import { NextRequest, NextResponse } from 'next/server'
import { chromium } from 'playwright'

/**
 * GET /api/_diag/playwright
 * Health check endpoint to verify Playwright Chromium is installed and working
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  let browser = null
  try {
    // Launch headless Chromium
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    })
    
    const page = await browser.newPage()
    
    // Navigate to a simple test page
    const response = await page.goto('https://example.com', {
      waitUntil: 'domcontentloaded',
      timeout: 10000
    })
    
    if (!response || response.status() !== 200) {
      await browser.close()
      return NextResponse.json({
        ok: false,
        error: `Failed to fetch example.com: status ${response?.status() || 'unknown'}`
      }, { status: 200 })
    }
    
    // Get page title to verify it loaded
    const title = await page.title()
    
    await browser.close()
    
    return NextResponse.json({
      ok: true,
      title,
      status: response.status(),
      message: 'Playwright Chromium is working correctly'
    }, { status: 200 })
  } catch (error) {
    if (browser) {
      try {
        await browser.close()
      } catch {
        // Ignore close errors
      }
    }
    
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      details: 'Playwright Chromium may not be installed or configured correctly'
    }, { status: 200 })
  }
}

