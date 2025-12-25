/**
 * Test DRM handling - verify script continues to slow downloads when DRM detected
 */

import 'dotenv/config'
import { extractBookContent } from './extract-annas-archive-book'

// Test with one of the DRM books - find it on Anna's Archive
const testBooks = [
  {
    title: 'Israel: A Clash of Civilizations',
    searchQuery: 'Israel Clash of Civilizations',
    identifier: 'israelclashofciv0000cook'
  }
]

async function testDRMHandling() {
  console.log('='.repeat(80))
  console.log('TESTING DRM HANDLING')
  console.log('='.repeat(80))
  console.log()
  console.log('Testing that script continues to slow downloads when DRM is detected')
  console.log()
  
  for (const book of testBooks) {
    console.log(`${'─'.repeat(80)}`)
    console.log(`📖 Testing: ${book.title}`)
    console.log()
    
    // Search Anna's Archive for this book
    try {
      const searchUrl = `https://annas-archive.org/search?q=${encodeURIComponent(book.searchQuery)}`
      console.log(`  Searching: ${searchUrl}`)
      
      const response = await fetch(searchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      })
      
      if (response.ok) {
        const html = await response.text()
        
        // Find result that matches our identifier
        const identifierRegex = new RegExp(`href="/md5/([a-f0-9]{32})"[^>]*>[^<]*${book.identifier}`, 'i')
        const match = html.match(identifierRegex)
        
        if (!match) {
          // Try broader search
          const md5Matches = html.matchAll(/href="\/md5\/([a-f0-9]{32})"/g)
          for (const md5Match of md5Matches) {
            const md5 = md5Match[1]
            const testUrl = `https://annas-archive.org/md5/${md5}`
            
            // Quick check if this might be our book
            const pageResponse = await fetch(testUrl, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
              }
            })
            
            if (pageResponse.ok) {
              const pageHtml = await pageResponse.text()
              if (pageHtml.includes(book.identifier) || pageHtml.includes('Clash of Civilizations')) {
                console.log(`  ✅ Found potential match: ${testUrl}`)
                console.log(`  Attempting extraction...`)
                console.log()
                
                const startTime = Date.now()
                const content = await extractBookContent(testUrl)
                const duration = ((Date.now() - startTime) / 1000).toFixed(1)
                
                console.log()
                console.log(`  ⏱️  Extraction took ${duration}s`)
                console.log(`  📊 Content length: ${content?.length || 0} characters`)
                
                if (content && content.length > 500) {
                  console.log(`  ✅ SUCCESS: Extracted ${content.length} characters`)
                  console.log(`  🎉 Non-DRM version found and extracted!`)
                  console.log(`  Preview: ${content.substring(0, 200)}...`)
                } else if (content && content.includes('DRM-protected')) {
                  console.log(`  ⚠️  DRM detected but script should have tried slow downloads`)
                  console.log(`  Content: ${content.substring(0, 300)}`)
                } else {
                  console.log(`  ⚠️  Only extracted ${content?.length || 0} characters`)
                  if (content) {
                    console.log(`  Content: ${content.substring(0, 300)}`)
                  }
                }
                
                break
              }
            }
          }
        } else {
          const md5 = match[1]
          const annasUrl = `https://annas-archive.org/md5/${md5}`
          console.log(`  ✅ Found exact match: ${annasUrl}`)
          console.log(`  Attempting extraction...`)
          console.log()
          
          const startTime = Date.now()
          const content = await extractBookContent(annasUrl)
          const duration = ((Date.now() - startTime) / 1000).toFixed(1)
          
          console.log()
          console.log(`  ⏱️  Extraction took ${duration}s`)
          console.log(`  📊 Content length: ${content?.length || 0} characters`)
          
          if (content && content.length > 500) {
            console.log(`  ✅ SUCCESS: Extracted ${content.length} characters`)
            console.log(`  🎉 Non-DRM version found and extracted!`)
            console.log(`  Preview: ${content.substring(0, 200)}...`)
          } else if (content && content.includes('DRM-protected')) {
            console.log(`  ⚠️  DRM detected but script should have tried slow downloads`)
            console.log(`  Content: ${content.substring(0, 300)}`)
          } else {
            console.log(`  ⚠️  Only extracted ${content?.length || 0} characters`)
            if (content) {
              console.log(`  Content: ${content.substring(0, 300)}`)
            }
          }
        }
      }
    } catch (error: any) {
      console.log(`  ❌ Error: ${error.message}`)
    }
    
    console.log()
  }
  
  console.log('='.repeat(80))
  console.log('✅ Test Complete')
  console.log('='.repeat(80))
}

testDRMHandling().catch(console.error)

