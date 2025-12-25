/**
 * Inspect the wait page to understand its structure
 */

import { chromium } from 'playwright'
import * as fs from 'fs/promises'
import * as path from 'path'

async function inspectWaitPage() {
  const slowDownloadUrl = 'https://annas-archive.org/slow_download/dbe898e329267de1a5530f26de6c784a/0/2'
  
  console.log(`Inspecting wait page: ${slowDownloadUrl}\n`)
  
  // Create data directory if it doesn't exist
  const dataDir = path.join(process.cwd(), 'data')
  try {
    await fs.mkdir(dataDir, { recursive: true })
  } catch (e) {
    // Directory might already exist
  }
  
  const browser = await chromium.launch({ headless: false }) // Run visible to see what's happening
  const page = await browser.newPage()
  
  try {
    console.log('Navigating to wait page...')
    await page.goto(slowDownloadUrl, { waitUntil: 'networkidle', timeout: 30000 })
    
    // Get initial HTML
    const initialHtml = await page.content()
    console.log(`Initial HTML length: ${initialHtml.length}`)
    await fs.writeFile(path.join(dataDir, 'wait-page-initial.html'), initialHtml)
    console.log('Saved initial HTML')
    
    // Wait 2 seconds
    console.log('Waiting 2 seconds...')
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    const html2s = await page.content()
    console.log(`HTML after 2s: ${html2s.length}`)
    
    // Wait 3 more seconds (total 5)
    console.log('Waiting 3 more seconds (total 5)...')
    await new Promise(resolve => setTimeout(resolve, 3000))
    
    const html5s = await page.content()
    console.log(`HTML after 5s: ${html5s.length}`)
    await fs.writeFile(path.join(dataDir, 'wait-page-5s.html'), html5s)
    console.log('Saved HTML after 5 seconds')
    
    // Wait 2 more seconds (total 7)
    console.log('Waiting 2 more seconds (total 7)...')
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    const html7s = await page.content()
    console.log(`HTML after 7s: ${html7s.length}`)
    await fs.writeFile(path.join(dataDir, 'wait-page-7s.html'), html7s)
    console.log('Saved HTML after 7 seconds')
    
    // Take screenshot
    await page.screenshot({ path: path.join(dataDir, 'wait-page-screenshot.png'), fullPage: true })
    console.log('Saved screenshot')
    
    // Look for all links
    console.log('\n=== All links on page ===')
    const allLinks = await page.$$eval('a', (links) => 
      links.map(link => ({
        text: link.textContent?.trim(),
        href: link.getAttribute('href'),
        visible: link.offsetParent !== null
      }))
    )
    
    allLinks.forEach((link, idx) => {
      console.log(`${idx + 1}. Text: "${link.text}" | Href: "${link.href}" | Visible: ${link.visible}`)
    })
    
    // Look for download-related text
    console.log('\n=== Download-related elements ===')
    const downloadText = await page.textContent('body')
    if (downloadText) {
      const downloadMatches = downloadText.match(/download|Download|wait|Wait|seconds|Seconds/gi)
      if (downloadMatches) {
        console.log('Found download/wait text:', downloadMatches.slice(0, 10))
      }
    }
    
    // Check for JavaScript that might create the link
    console.log('\n=== Checking for JavaScript ===')
    const scripts = await page.$$eval('script', (scripts) =>
      scripts.map(script => script.textContent?.substring(0, 500))
    )
    
    scripts.forEach((script, idx) => {
      if (script && (script.includes('download') || script.includes('href') || script.includes('location'))) {
        console.log(`\nScript ${idx + 1} (first 500 chars):`)
        console.log(script)
      }
    })
    
    // Wait a bit more and check again
    console.log('\n=== Waiting 10 more seconds and checking again ===')
    await new Promise(resolve => setTimeout(resolve, 10000))
    
    const html17s = await page.content()
    console.log(`HTML after 17s: ${html17s.length}`)
    await fs.writeFile(path.join(dataDir, 'wait-page-17s.html'), html17s)
    
    const allLinks17s = await page.$$eval('a', (links) => 
      links.map(link => ({
        text: link.textContent?.trim(),
        href: link.getAttribute('href'),
        visible: link.offsetParent !== null
      }))
    )
    
    console.log('\n=== Links after 17 seconds ===')
    allLinks17s.forEach((link, idx) => {
      console.log(`${idx + 1}. Text: "${link.text}" | Href: "${link.href}" | Visible: ${link.visible}`)
    })
    
    // Final screenshot
    await page.screenshot({ path: path.join(dataDir, 'wait-page-final.png'), fullPage: true })
    console.log('\nSaved final screenshot')
    
  } catch (error: any) {
    console.error('Error:', error.message)
    await page.screenshot({ path: path.join(dataDir, 'wait-page-error.png'), fullPage: true })
  } finally {
    // Keep browser open for a bit so we can see what happened
    console.log('\nKeeping browser open for 5 seconds for inspection...')
    await new Promise(resolve => setTimeout(resolve, 5000))
    await browser.close()
  }
}

inspectWaitPage().catch(console.error)

