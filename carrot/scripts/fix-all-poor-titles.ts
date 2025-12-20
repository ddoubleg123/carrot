/**
 * Fix all poor titles in DiscoveredContent
 */

import { prisma } from '@/lib/prisma'

async function fixAllPoorTitles() {
  const poorTitles = ['10.1017/chol9780521772488.005', 'book part', 'Untitled']
  
  for (const poorTitle of poorTitles) {
    const items = await prisma.discoveredContent.findMany({
      where: { title: poorTitle },
      include: {
        heroRecord: true
      }
    })
    
    console.log(`\nFixing "${poorTitle}": ${items.length} items`)
    
    for (const item of items) {
      let newTitle = item.title
      
      // Try Hero record title first
      if (item.heroRecord?.title && item.heroRecord.title !== poorTitle) {
        newTitle = item.heroRecord.title
        console.log(`  ${item.id}: Using Hero title: "${newTitle}"`)
      } else if (item.sourceUrl) {
        // Try to extract from URL
        try {
          const url = new URL(item.sourceUrl)
          const pathParts = url.pathname.split('/').filter(p => p)
          const lastPart = pathParts[pathParts.length - 1]
          
          if (lastPart && lastPart.length > 5 && lastPart.length < 100) {
            // Decode URL-encoded parts
            const decoded = decodeURIComponent(lastPart)
              .replace(/[-_]/g, ' ')
              .replace(/\.[a-z]{2,4}$/i, '') // Remove file extensions
              .split(' ')
              .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
              .join(' ')
            
            if (decoded.length > 10 && decoded.length < 100) {
              newTitle = decoded
              console.log(`  ${item.id}: Extracted from URL: "${newTitle}"`)
            }
          }
          
          // Fallback: use domain + path
          if (newTitle === poorTitle) {
            const domain = url.hostname.replace(/^www\./, '')
            const pathHint = pathParts.slice(-2).join(' - ')
            if (pathHint.length > 5) {
              newTitle = `${domain} - ${pathHint}`
              console.log(`  ${item.id}: Using domain + path: "${newTitle}"`)
            }
          }
        } catch (e) {
          // URL parsing failed
        }
      }
      
      // Try summary or whyItMatters
      if (newTitle === poorTitle && item.summary) {
        const firstSentence = item.summary.split(/[.!?]/)[0].trim()
        if (firstSentence.length > 15 && firstSentence.length < 100) {
          newTitle = firstSentence.charAt(0).toUpperCase() + firstSentence.slice(1)
          console.log(`  ${item.id}: Using summary: "${newTitle}"`)
        }
      }
      
      // Update if we found a better title
      if (newTitle !== poorTitle && newTitle.length > 5) {
        await prisma.discoveredContent.update({
          where: { id: item.id },
          data: { title: newTitle }
        })
        console.log(`  ✅ Updated: "${poorTitle}" → "${newTitle}"`)
      } else {
        console.log(`  ⚠️  Could not improve title for ${item.id}`)
      }
    }
  }
  
  console.log('\n✅ Title fix complete')
}

fixAllPoorTitles().catch(console.error)
