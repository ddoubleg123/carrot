/**
 * Test improved DDoS-GUARD handling with a known slow download link
 */

// Polyfill DOMMatrix for pdf-parse BEFORE importing it
if (typeof global.DOMMatrix === 'undefined') {
  try {
    const dommatrix = require('dommatrix')
    global.DOMMatrix = dommatrix.DOMMatrix || dommatrix
  } catch (e) {
    global.DOMMatrix = class DOMMatrix {
      constructor(init?: any) {}
      static fromMatrix(other?: any) { return new DOMMatrix() }
    } as any
  }
}

import { chromium } from 'playwright'
import * as fs from 'fs/promises'
import * as path from 'path'

async function testImprovedDDoSGuard() {
  console.log(`\n${'='.repeat(80)}`)
  console.log(`TESTING IMPROVED DDoS-GUARD HANDLING`)
  console.log(`${'='.repeat(80)}\n`)
  
  // Test with a known slow download link
  const testUrl = 'https://annas-archive.org/slow_download/fbc01df94230f9542a379b8b1bc40970/0/2'
  
  console.log(`Testing URL: ${testUrl}\n`)
  
  try {
    // Launch browser with improved fingerprinting
    console.log(`[1/6] Launching browser with improved fingerprinting...`)
    const browser = await chromium.launch({ 
      headless: true,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--disable-dev-shm-usage',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process'
      ]
    })
    
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1920, height: 1080 },
      locale: 'en-US',
      timezoneId: 'America/New_York',
      extraHTTPHeaders: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Cache-Control': 'max-age=0'
      }
    })
    
    const page = await context.newPage()
    
    // Remove webdriver property
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false })
      Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] })
      Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] })
    })
    
    page.setDefaultTimeout(90000)
    page.setDefaultNavigationTimeout(90000)
    
    console.log(`[2/6] Navigating to slow download page...`)
    await page.goto(testUrl, { 
      waitUntil: 'networkidle',
      timeout: 60000 
    })
    
    console.log(`[3/6] Waiting for page to initialize...`)
    await page.waitForTimeout(3000)
    
    // Check for CAPTCHA
    console.log(`[4/6] Checking for CAPTCHA...`)
    const captchaIframe = await page.$('iframe[src*="ddos-guard"], iframe[src*="captcha"], iframe[src*="challenge"]')
    if (captchaIframe) {
      console.log(`⚠️  CAPTCHA iframe detected - waiting 15 seconds...`)
      await page.waitForTimeout(15000)
    }
    
    // Check for wait page
    const pageContent = await page.content()
    const hasWaitText = pageContent.includes('wait') || 
                       pageContent.includes('5 seconds') || 
                       pageContent.includes('Please wait') ||
                       pageContent.includes('waiting') ||
                       pageContent.includes('DDoS-GUARD') ||
                       pageContent.includes('ddos-guard')
    
    if (hasWaitText) {
      console.log(`[5/6] Wait page detected - waiting for JavaScript to execute...`)
      await page.waitForTimeout(10000)
      
      try {
        await page.waitForLoadState('networkidle', { timeout: 20000 })
        console.log(`✅ Page reached networkidle state`)
      } catch (e) {
        console.log(`⚠️  Networkidle timeout, continuing...`)
      }
      
      try {
        await page.waitForSelector('a[href*="download"], a[href*="file"], button, a[href*="get"], a[href*="continue"]', { timeout: 15000 })
        console.log(`✅ Link/button appeared after wait`)
      } catch (e) {
        console.log(`⚠️  No link appeared yet, waiting more...`)
        await page.waitForTimeout(5000)
      }
    }
    
    console.log(`[6/6] Searching for download link...`)
    
    // Save page HTML for inspection
    const debugHtml = await page.content()
    const debugPath = path.join(process.cwd(), 'data', 'debug-ddos-page.html')
    await fs.mkdir(path.dirname(debugPath), { recursive: true })
    await fs.writeFile(debugPath, debugHtml)
    console.log(`   Saved page HTML to: ${debugPath}`)
    
    const downloadLink = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a'))
      
      // Strategy 1: Look for "download now" specifically
      for (const link of links) {
        const text = link.textContent?.toLowerCase().trim() || ''
        const href = link.getAttribute('href') || ''
        
        if (text.includes('download now') && 
            href && 
            !href.includes('slow_download') &&
            !href.includes('/account/') &&
            !href.startsWith('#') &&
            !href.startsWith('javascript:')) {
          return { type: 'link', href, text: text.substring(0, 50), priority: 1 }
        }
      }
      
      // Strategy 2: Look for download links (excluding nav)
      for (const link of links) {
        const text = link.textContent?.toLowerCase().trim() || ''
        const href = link.getAttribute('href') || ''
        
        const isNavLink = href.includes('/account/') || 
                         href.includes('/user/') || 
                         text.includes('downloaded files') ||
                         text.includes('my account')
        
        if ((text.includes('download') || text.includes('get file') || text.includes('continue')) && 
            href && 
            !href.includes('slow_download') &&
            !href.startsWith('#') &&
            !href.startsWith('javascript:') &&
            !isNavLink &&
            (href.includes('download') || href.includes('file') || href.endsWith('.pdf'))) {
          return { type: 'link', href, text: text.substring(0, 50), priority: 2 }
        }
      }
      
      // Strategy 3: Look for any non-nav link that might be a download
      for (const link of links) {
        const href = link.getAttribute('href') || ''
        if (href && 
            !href.includes('slow_download') &&
            !href.includes('/account/') &&
            !href.includes('/user/') &&
            !href.startsWith('#') &&
            (href.endsWith('.pdf') || href.includes('/download/') || href.includes('/file/'))) {
          return { type: 'link', href, text: link.textContent?.substring(0, 50) || '', priority: 3 }
        }
      }
      
      return null
    })
    
    if (downloadLink) {
      console.log(`\n✅ SUCCESS: Found download link!`)
      console.log(`   Type: ${downloadLink.type}`)
      console.log(`   URL: ${downloadLink.href}`)
      console.log(`   Text: "${downloadLink.text}"`)
      
      // Check current URL
      const currentUrl = page.url()
      console.log(`\n   Current page URL: ${currentUrl}`)
      
      if (currentUrl !== testUrl) {
        console.log(`   ✅ Page was redirected!`)
      }
      
    } else {
      console.log(`\n❌ FAILED: Could not find download link`)
      
      // Check for CAPTCHA
      const hasCaptcha = await page.evaluate(() => {
        return !!(
          document.querySelector('iframe[src*="ddos-guard"]') ||
          document.querySelector('iframe[src*="captcha"]') ||
          document.querySelector('iframe[src*="challenge"]') ||
          document.body.textContent?.includes('I\'m not a robot') ||
          document.body.textContent?.includes('Verify you are human')
        )
      })
      
      if (hasCaptcha) {
        console.log(`   ⚠️  CAPTCHA is still present - manual intervention may be required`)
      }
      
      // Save debug HTML
      const debugHtml = await page.content()
      const debugPath = path.join(process.cwd(), 'data', 'debug-improved-ddos.html')
      await fs.mkdir(path.dirname(debugPath), { recursive: true })
      await fs.writeFile(debugPath, debugHtml)
      console.log(`   Saved debug HTML to: ${debugPath}`)
    }
    
    await browser.close()
    console.log(`\n✅ Test complete`)
    
  } catch (error: any) {
    console.error(`\n❌ Error: ${error.message}`)
    console.error(error.stack)
  }
}

testImprovedDDoSGuard().catch(console.error)

