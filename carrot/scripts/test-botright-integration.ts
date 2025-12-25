/**
 * Test Botright integration for CAPTCHA solving
 * This is a proof-of-concept to test if Botright can solve DDoS-GUARD CAPTCHAs
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

/**
 * NOTE: To use Botright, you need to:
 * 1. Install: npm install botright
 * 2. Botright uses AI models that need to be downloaded on first run
 * 3. It may take a few minutes to set up initially
 */

async function testBotright() {
  console.log(`\n=== TESTING BOTRIGHT FOR CAPTCHA SOLVING ===\n`)
  
  // Check if Botright is installed
  let Botright
  try {
    Botright = require('botright')
    console.log(`✅ Botright is installed`)
  } catch (e) {
    console.log(`❌ Botright is NOT installed`)
    console.log(`\nTo install:`)
    console.log(`  npm install botright`)
    console.log(`\nBotright will download AI models on first run (may take a few minutes)`)
    return
  }
  
  const testUrl = 'https://annas-archive.org/slow_download/dbe898e329267de1a5530f26de6c784a/0/2'
  
  try {
    console.log(`[1/4] Launching Botright browser...`)
    const bot = await Botright.launch({
      headless: false, // Set to true for production
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    })
    
    console.log(`[2/4] Creating page...`)
    const page = await bot.newPage()
    
    console.log(`[3/4] Navigating to slow download page...`)
    console.log(`URL: ${testUrl}`)
    console.log(`\n⚠️  Botright will automatically solve CAPTCHAs if detected`)
    console.log(`    This may take 30-60 seconds for first-time setup\n`)
    
    await page.goto(testUrl, { waitUntil: 'domcontentloaded', timeout: 60000 })
    
    // Wait a bit for page to load and CAPTCHA to appear (if any)
    await page.waitForTimeout(5000)
    
    // Check if we're past the CAPTCHA
    const pageContent = await page.content()
    const hasCaptcha = pageContent.includes('captcha') || 
                      pageContent.includes('CAPTCHA') ||
                      pageContent.includes('recaptcha') ||
                      pageContent.includes('hcaptcha')
    
    if (hasCaptcha) {
      console.log(`[4/4] CAPTCHA detected - Botright should solve it automatically...`)
      // Botright will handle CAPTCHA automatically
      await page.waitForTimeout(30000) // Wait for CAPTCHA solving
    } else {
      console.log(`[4/4] No CAPTCHA detected on page`)
    }
    
    // Check for download link
    const downloadLink = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a'))
      for (const link of links) {
        const text = link.textContent?.toLowerCase() || ''
        const href = link.getAttribute('href') || ''
        if ((text.includes('download') || text.includes('continue')) && href && !href.includes('slow_download')) {
          return { text, href }
        }
      }
      return null
    })
    
    if (downloadLink) {
      console.log(`\n✅ SUCCESS: Found download link after CAPTCHA solving!`)
      console.log(`   Link: "${downloadLink.text}" -> ${downloadLink.href}`)
      console.log(`\n✅ Botright integration is working!`)
    } else {
      console.log(`\n⚠️  No download link found - page may still be loading or CAPTCHA not solved yet`)
      console.log(`   Page HTML length: ${pageContent.length} chars`)
    }
    
    // Keep browser open for inspection (comment out for automated runs)
    // await page.waitForTimeout(10000)
    
    await bot.close()
    console.log(`\n✅ Test complete`)
    
  } catch (error: any) {
    console.error(`\n❌ Error: ${error.message}`)
    console.error(error.stack)
  }
}

testBotright().catch(console.error)

