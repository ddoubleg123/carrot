/**
 * Test DDoS-GUARD handling with Playwright
 * Tests a single slow download link to see if it works
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
const pdfParse = require('pdf-parse')

async function testDDoSGuard() {
  console.log(`\n=== TESTING DDoS-GUARD HANDLING ===\n`)
  
  // Test with a known slow download link
  const testUrl = 'https://annas-archive.org/slow_download/dbe898e329267de1a5530f26de6c784a/0/2'
  
  console.log(`Testing URL: ${testUrl}\n`)
  
  try {
    console.log(`[1/5] Launching browser...`)
    const browser = await chromium.launch({ 
      headless: true,
      timeout: 30000
    })
    
    console.log(`[2/5] Creating context...`)
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1920, height: 1080 }
    })
    
    console.log(`[3/5] Creating page...`)
    const page = await context.newPage()
    
    // Set a reasonable timeout
    page.setDefaultTimeout(60000)
    page.setDefaultNavigationTimeout(60000)
    
    console.log(`[4/5] Navigating to slow download page...`)
    try {
      await page.goto(testUrl, { 
        waitUntil: 'domcontentloaded', // Use domcontentloaded instead of networkidle
        timeout: 30000 
      })
      console.log(`✅ Page loaded`)
    } catch (navError: any) {
      console.error(`❌ Navigation failed: ${navError.message}`)
      await browser.close()
      return
    }
    
    // Wait a bit for the page to initialize
    await page.waitForTimeout(2000)
    
    // Check what's on the page
    console.log(`[5/5] Checking page content...`)
    const pageContent = await page.content()
    console.log(`Page HTML length: ${pageContent.length} chars`)
    
    // Check for DDoS-GUARD indicators
    if (pageContent.includes('DDoS-GUARD') || pageContent.includes('ddos-guard')) {
      console.log(`⚠️  DDoS-GUARD detected on page`)
    }
    
    // Check for wait page indicators
    const hasWaitText = pageContent.includes('wait') || 
                       pageContent.includes('5 seconds') || 
                       pageContent.includes('Please wait') ||
                       pageContent.includes('waiting')
    
    if (hasWaitText) {
      console.log(`✅ Wait page detected - waiting 6 seconds...`)
      await page.waitForTimeout(6000)
      
      // Re-check the page after waiting
      const updatedContent = await page.content()
      console.log(`Updated page HTML length: ${updatedContent.length} chars`)
      
      // Look for download link - print ALL links for debugging
      console.log(`\n=== ALL LINKS ON PAGE ===`)
      const allLinks = await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a'))
        return links.map(link => ({
          text: link.textContent?.trim() || '',
          href: link.getAttribute('href') || '',
          className: link.className || ''
        }))
      })
      
      allLinks.forEach((link, idx) => {
        console.log(`${idx + 1}. "${link.text.substring(0, 60)}" -> ${link.href.substring(0, 100)}`)
      })
      
      console.log(`\n=== ALL BUTTONS ON PAGE ===`)
      const allButtons = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'))
        return buttons.map(btn => ({
          text: btn.textContent?.trim() || '',
          onclick: btn.getAttribute('onclick') || '',
          className: btn.className || ''
        }))
      })
      
      allButtons.forEach((btn, idx) => {
        console.log(`${idx + 1}. "${btn.text.substring(0, 60)}" -> onclick: ${btn.onclick.substring(0, 100)}`)
      })
      
      // Now look for download link with improved logic
      const downloadLink = await page.evaluate(() => {
        // Strategy 1: Look for links with "download now" or similar text
        const links = Array.from(document.querySelectorAll('a'))
        for (const link of links) {
          const text = link.textContent?.toLowerCase() || ''
          const href = link.getAttribute('href') || ''
          
          if ((text.includes('download now') || 
               text.includes('download') || 
               text.includes('get file') ||
               text.includes('continue') ||
               text.includes('proceed')) && 
              href && 
              !href.includes('slow_download') &&
              !href.startsWith('#')) {
            return { type: 'link', href, text: link.textContent?.trim() || '' }
          }
        }
        
        // Strategy 2: Look for buttons
        const buttons = Array.from(document.querySelectorAll('button'))
        for (const button of buttons) {
          const text = button.textContent?.toLowerCase() || ''
          const onclick = button.getAttribute('onclick') || ''
          
          if (text.includes('download') || onclick.includes('download')) {
            const urlMatch = onclick.match(/['"]([^'"]+)['"]/)
            if (urlMatch) {
              return { type: 'button', href: urlMatch[1], text: button.textContent?.trim() || '' }
            }
          }
        }
        
        // Strategy 3: Look for any link that might be a download
        for (const link of links) {
          const href = link.getAttribute('href') || ''
          if (href && 
              !href.includes('slow_download') &&
              !href.startsWith('#') &&
              (href.includes('download') || href.includes('file') || href.endsWith('.pdf'))) {
            return { type: 'fallback', href, text: link.textContent?.trim() || '' }
          }
        }
        
        return null
      })
      
      if (downloadLink) {
        console.log(`✅ Found download link: "${downloadLink.text}" -> ${downloadLink.href}`)
        
        // Try to click it or navigate to it
        let finalUrl = downloadLink.href
        if (finalUrl.startsWith('/')) {
          finalUrl = `https://annas-archive.org${finalUrl}`
        } else if (!finalUrl.startsWith('http')) {
          finalUrl = `https://annas-archive.org/${finalUrl}`
        }
        
        console.log(`Navigating to: ${finalUrl}`)
        
        // Set up download listener
        const downloadPromise = page.waitForEvent('download', { timeout: 30000 }).catch(() => null)
        
        // Try clicking the link
        try {
          await page.click(`a[href="${downloadLink.href}"]`, { timeout: 5000 })
          console.log(`✅ Clicked download link`)
        } catch (clickError) {
          // If click fails, try navigating directly
          console.log(`Click failed, trying direct navigation...`)
          await page.goto(finalUrl, { waitUntil: 'domcontentloaded', timeout: 30000 })
        }
        
        // Wait for download
        const download = await downloadPromise
        if (download) {
          const downloadPath = await download.path()
          console.log(`✅ Download started: ${downloadPath}`)
          
          const fileBuffer = await fs.readFile(downloadPath)
          const fileName = download.suggestedFilename() || 'download.pdf'
          console.log(`✅ File downloaded: ${fileName} (${fileBuffer.length} bytes)`)
          
          // Check if it's a PDF
          if (fileName.endsWith('.pdf') || (fileBuffer[0] === 0x25 && fileBuffer[1] === 0x50 && fileBuffer[2] === 0x44 && fileBuffer[3] === 0x46)) {
            try {
              const pdfData = await pdfParse(fileBuffer)
              const extractedText = pdfData.text.trim()
              console.log(`✅ Extracted ${extractedText.length} characters from PDF`)
              
              // Save PDF
              const dataDir = path.join(process.cwd(), 'data', 'pdfs')
              await fs.mkdir(dataDir, { recursive: true })
              const pdfPath = path.join(dataDir, fileName)
              await fs.writeFile(pdfPath, fileBuffer)
              console.log(`✅ Saved PDF to: ${pdfPath}`)
              
              // Clean up temp
              await fs.unlink(downloadPath).catch(() => {})
              
              console.log(`\n✅ SUCCESS: DDoS-GUARD bypass working!`)
              console.log(`   PDF: ${fileName}`)
              console.log(`   Size: ${fileBuffer.length} bytes`)
              console.log(`   Text: ${extractedText.length} characters`)
            } catch (pdfError: any) {
              console.error(`❌ PDF parsing failed: ${pdfError.message}`)
            }
          } else {
            console.log(`⚠️  Downloaded file is not a PDF`)
          }
        } else {
          console.log(`⚠️  Download event not triggered`)
        }
      } else {
        console.log(`❌ No download link found after wait`)
        // Save page HTML for debugging
        const debugPath = path.join(process.cwd(), 'data', 'debug-page.html')
        await fs.mkdir(path.dirname(debugPath), { recursive: true })
        await fs.writeFile(debugPath, pageContent)
        console.log(`Saved page HTML to: ${debugPath}`)
      }
    } else {
      console.log(`⚠️  No wait page detected - might be direct download or error page`)
      // Save page HTML for debugging
      const debugPath = path.join(process.cwd(), 'data', 'debug-page.html')
      await fs.mkdir(path.dirname(debugPath), { recursive: true })
      await fs.writeFile(debugPath, pageContent)
      console.log(`Saved page HTML to: ${debugPath}`)
    }
    
    await browser.close()
    console.log(`\n✅ Test complete`)
    
  } catch (error: any) {
    console.error(`\n❌ Error: ${error.message}`)
    console.error(error.stack)
  }
}

testDDoSGuard().catch(console.error)

