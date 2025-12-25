/**
 * Re-download DRM-protected books through Anna's Archive slow downloads
 * to get non-DRM versions
 */

import 'dotenv/config'
import { extractBookContent } from './extract-annas-archive-book'

const drmBooks = [
  {
    title: 'Arms akimbo: Africana women in contemporary literature',
    identifier: 'armsakimboafrica0000unse',
    // We need to find the Anna's Archive URL for this
  },
  {
    title: 'Carolingian Civilization: A Reader',
    identifier: 'carolingiancivil0000unse',
  },
  {
    title: 'Israel: A Clash of Civilizations',
    identifier: 'israelclashofciv0000cook',
  },
  {
    title: 'Myth America: Historians Take On the Biggest Legends and Lies About Our Past',
    identifier: 'mythamericahisto0000kevi',
  }
]

async function reDownloadDRMBooks() {
  console.log('='.repeat(80))
  console.log('RE-DOWNLOADING DRM-PROTECTED BOOKS')
  console.log('='.repeat(80))
  console.log()
  console.log('Strategy: Use Anna\'s Archive slow downloads to get non-DRM versions')
  console.log()
  
  // Search for each book on Anna's Archive
  for (const book of drmBooks) {
    console.log(`${'─'.repeat(80)}`)
    console.log(`📖 Processing: ${book.title}`)
    console.log(`   Identifier: ${book.identifier}`)
    console.log()
    
    // Search Anna's Archive
    try {
      const searchUrl = `https://annas-archive.org/search?q=${encodeURIComponent(book.title)}`
      console.log(`  Searching: ${searchUrl}`)
      
      const response = await fetch(searchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      })
      
      if (response.ok) {
        const html = await response.text()
        
        // Find the first result that matches our identifier
        const md5Match = html.match(new RegExp(`href="/md5/([a-f0-9]{32})"[^>]*>.*?${book.identifier}`, 'i'))
        if (md5Match) {
          const md5 = md5Match[1]
          const annasUrl = `https://annas-archive.org/md5/${md5}`
          console.log(`  ✅ Found match: ${annasUrl}`)
          console.log(`  Attempting extraction...`)
          
          try {
            const content = await extractBookContent(annasUrl)
            if (content && content.length > 500) {
              console.log(`  ✅ SUCCESS: Extracted ${content.length} characters`)
              console.log(`  🎉 Non-DRM version found and extracted!`)
            } else {
              console.log(`  ⚠️  Extracted only ${content?.length || 0} characters`)
            }
          } catch (extractError: any) {
            console.log(`  ⚠️  Extraction failed: ${extractError.message}`)
          }
        } else {
          console.log(`  ⚠️  No matching result found`)
        }
      }
    } catch (error: any) {
      console.log(`  ⚠️  Error: ${error.message}`)
    }
    
    console.log()
  }
  
  console.log('='.repeat(80))
  console.log('✅ Re-download Complete')
  console.log('='.repeat(80))
}

reDownloadDRMBooks().catch(console.error)

