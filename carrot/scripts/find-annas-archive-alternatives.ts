/**
 * Find alternative download sources for DRM PDFs through Anna's Archive
 */

import 'dotenv/config'
import * as fs from 'fs/promises'
import * as path from 'path'
import { chromium } from 'playwright'

const drmPdfs = [
  { file: 'armsakimboafrica0000unse.pdf', identifier: 'armsakimboafrica0000unse' },
  { file: 'carolingiancivil0000unse.pdf', identifier: 'carolingiancivil0000unse' },
  { file: 'israelclashofciv0000cook.pdf', identifier: 'israelclashofciv0000cook' },
  { file: 'mythamericahisto0000kevi.pdf', identifier: 'mythamericahisto0000kevi' }
]

async function findAlternatives() {
  console.log('='.repeat(80))
  console.log('FINDING ALTERNATIVE DOWNLOAD SOURCES FOR DRM PDFs')
  console.log('='.repeat(80))
  console.log()
  
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1920, height: 1080 }
  })
  
  for (const pdfInfo of drmPdfs) {
    console.log(`${'─'.repeat(80)}`)
    console.log(`📖 Searching for: ${pdfInfo.file}`)
    console.log(`   Identifier: ${pdfInfo.identifier}`)
    console.log()
    
    // Search Anna's Archive for this book
    try {
      const searchUrl = `https://annas-archive.org/search?q=${encodeURIComponent(pdfInfo.identifier)}`
      console.log(`  Searching Anna's Archive: ${searchUrl}`)
      
      const page = await context.newPage()
      await page.goto(searchUrl, { waitUntil: 'networkidle', timeout: 30000 })
      await page.waitForTimeout(2000)
      
      // Look for search results
      const results = await page.evaluate(() => {
        const links: Array<{ title: string; url: string }> = []
        document.querySelectorAll('a[href*="/md5/"]').forEach((link: any) => {
          const title = link.textContent?.trim() || ''
          const url = link.href || ''
          if (title && url) {
            links.push({ title, url })
          }
        })
        return links.slice(0, 5) // First 5 results
      })
      
      console.log(`  Found ${results.length} potential matches`)
      
      for (const result of results) {
        console.log(`  Checking: ${result.title.substring(0, 60)}...`)
        console.log(`    URL: ${result.url}`)
        
        // Check this book page for download links
        try {
          const bookPage = await context.newPage()
          await bookPage.goto(result.url, { waitUntil: 'networkidle', timeout: 30000 })
          await bookPage.waitForTimeout(2000)
          
          // Look for download links
          const downloadLinks = await bookPage.evaluate(() => {
            const links: Array<{ text: string; url: string; type: string }> = []
            
            // Check for archive.org links
            document.querySelectorAll('a[href*="archive.org"]').forEach((link: any) => {
              const url = link.href || ''
              const text = link.textContent?.trim() || ''
              if (url.includes('archive.org/details/')) {
                links.push({ text, url, type: 'archive.org' })
              }
            })
            
            // Check for slow download links
            document.querySelectorAll('a[href*="slow_download"]').forEach((link: any) => {
              const url = link.href || ''
              const text = link.textContent?.trim() || ''
              links.push({ text, url, type: 'slow_download' })
            })
            
            // Check for external links
            document.querySelectorAll('a[href*="libgen"]').forEach((link: any) => {
              const url = link.href || ''
              const text = link.textContent?.trim() || ''
              links.push({ text, url, type: 'libgen' })
            })
            
            return links
          })
          
          if (downloadLinks.length > 0) {
            console.log(`    ✅ Found ${downloadLinks.length} download link(s):`)
            downloadLinks.forEach(link => {
              console.log(`      - ${link.type}: ${link.text || link.url}`)
            })
          } else {
            console.log(`    ⚠️  No download links found`)
          }
          
          await bookPage.close()
        } catch (error: any) {
          console.log(`    ⚠️  Error checking page: ${error.message}`)
        }
      }
      
      await page.close()
    } catch (error: any) {
      console.log(`  ⚠️  Error searching: ${error.message}`)
    }
    
    console.log()
  }
  
  await browser.close()
  
  console.log('='.repeat(80))
  console.log('✅ Search Complete')
  console.log('='.repeat(80))
}

findAlternatives().catch(console.error)

