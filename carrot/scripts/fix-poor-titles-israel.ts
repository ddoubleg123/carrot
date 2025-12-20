/**
 * Fix poor titles specifically for Israel patch
 */

import { prisma } from '@/lib/prisma'

async function fixPoorTitles() {
  console.log('=== FIXING POOR TITLES FOR ISRAEL ===\n')
  
  const patch = await prisma.patch.findUnique({
    where: { handle: 'israel' },
    select: { id: true }
  })
  
  if (!patch) {
    console.log('Patch "israel" not found')
    return
  }
  
  // Get items with poor titles
  const poorItems = await prisma.discoveredContent.findMany({
    where: {
      patchId: patch.id,
      OR: [
        { title: { contains: '235 2' } },
        { title: { contains: 'Diaspora' } },
        { title: { contains: 'archive.org' } },
        { title: { contains: 'library.oapen.org' } },
        { title: { contains: '10.1017' } },
        { title: { contains: 'It was just' } }
      ]
    },
    select: {
      id: true,
      title: true,
      summary: true,
      whyItMatters: true,
      sourceUrl: true
    }
  })
  
  console.log(`Found ${poorItems.length} items with poor titles\n`)
  
  let fixed = 0
  
  for (const item of poorItems) {
    let newTitle = item.title
    const summary = item.summary || item.whyItMatters || ''
    
    // Try to extract better title from summary
    if (summary && summary.length > 20) {
      const sentences = summary.split(/[.!?]+/).map((s: string) => s.trim()).filter((s: string) => s.length > 10)
      
      for (const sentence of sentences) {
        if (sentence.length > 15 && sentence.length < 120) {
          // Check if it's meaningful
          const meaningfulWords = sentence.split(' ').filter((w: string) => 
            w.length > 2 && 
            !['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'a', 'an', 'was', 'were', 'is', 'are', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'can'].includes(w.toLowerCase())
          )
          
          if (meaningfulWords.length >= 4) {
            newTitle = sentence.charAt(0).toUpperCase() + sentence.slice(1)
            // Truncate if too long
            if (newTitle.length > 100) {
              const words = newTitle.split(' ')
              newTitle = words.slice(0, 12).join(' ')
            }
            break
          }
        }
      }
      
      // Fallback: extract meaningful words
      if (newTitle === item.title) {
        const words = summary.split(' ').slice(0, 20)
        const meaningfulWords = words.filter((word: string) => 
          word.length > 3 && 
          !['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'a', 'an', 'was', 'were', 'is', 'are', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'can', 'this', 'that', 'these', 'those', 'from', 'into', 'onto', 'upon', 'within', 'without', 'during', 'before', 'after', 'above', 'below', 'between', 'among', 'through', 'across', 'around', 'behind', 'beside', 'beyond', 'inside', 'outside', 'under', 'over', 'near', 'far'].includes(word.toLowerCase())
        ).slice(0, 10)
        
        if (meaningfulWords.length >= 4) {
          newTitle = meaningfulWords.map((word: string) => 
            word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
          ).join(' ')
        }
      }
    }
    
    // Try URL extraction as last resort
    if (newTitle === item.title && item.sourceUrl) {
      try {
        const url = new URL(item.sourceUrl)
        const pathParts = url.pathname.split('/').filter(p => p && p.length > 3)
        if (pathParts.length > 0) {
          const lastPart = decodeURIComponent(pathParts[pathParts.length - 1])
            .replace(/[-_]/g, ' ')
            .replace(/\.[a-z]{2,4}$/i, '')
          
          if (lastPart.length > 10 && lastPart.length < 80) {
            newTitle = lastPart.split(' ').map((w: string) => 
              w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
            ).join(' ')
          }
        }
      } catch (e) {
        // URL parsing failed
      }
    }
    
    // Update if changed
    if (newTitle !== item.title && newTitle.length > 5) {
      await prisma.discoveredContent.update({
        where: { id: item.id },
        data: { title: newTitle }
      })
      console.log(`✅ Fixed: "${item.title}" → "${newTitle}"`)
      fixed++
    } else {
      console.log(`⚠️  Could not improve: "${item.title}"`)
    }
  }
  
  console.log(`\n=== SUMMARY ===`)
  console.log(`Fixed: ${fixed} titles`)
  console.log(`Total: ${poorItems.length}`)
}

fixPoorTitles().catch(console.error)

