/**
 * Fix all poor titles and ensure SVG placeholders are generated
 */

import { prisma } from '@/lib/prisma'
import { generateSVGPlaceholder } from '@/lib/media/fallbackImages'

async function fixAllTitlesAndImages() {
  console.log('=== FIXING ALL TITLES AND IMAGES ===\n')
  
  // Get all items with poor titles
  const poorItems = await prisma.discoveredContent.findMany({
    where: {
      OR: [
        { title: { contains: 'doi.org' } },
        { title: { contains: 'cambridge.org' } },
        { title: 'Untitled' },
        { title: { contains: 'book part' } }
      ]
    },
    include: {
      heroRecord: true
    }
  })
  
  console.log(`Found ${poorItems.length} items to fix\n`)
  
  let titlesFixed = 0
  let imagesFixed = 0
  
  for (const item of poorItems) {
    let newTitle = item.title
    let titleChanged = false
    
    // Try to improve title from summary
    const summary = item.summary || item.whyItMatters || ''
    if (summary && summary.length > 20) {
      const sentences = summary.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 10)
      for (const sentence of sentences) {
        if (sentence.length > 15 && sentence.length < 100) {
          const meaningfulWords = sentence.split(' ').filter(w => 
            w.length > 2 && 
            !['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'a', 'an', 'sign', 'check', 'out', 'new', 'look', 'enjoy', 'easier', 'access', 'your', 'favorite', 'features', 'hidden', 'fields', 'book', 'contents'].includes(w.toLowerCase())
          )
          if (meaningfulWords.length >= 3) {
            newTitle = sentence.charAt(0).toUpperCase() + sentence.slice(1)
            titleChanged = true
            break
          }
        }
      }
      
      // Fallback: extract meaningful words
      if (!titleChanged) {
        const words = summary.split(' ').slice(0, 15)
        const meaningfulWords = words.filter((word: string) => 
          word.length > 3 && 
          !['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'a', 'an', 'sign', 'check', 'out', 'new', 'look', 'enjoy', 'easier', 'access', 'your', 'favorite', 'features', 'hidden', 'fields', 'book', 'contents', 'frontmatter', 'introduction'].includes(word.toLowerCase())
        ).slice(0, 8)
        
        if (meaningfulWords.length >= 3) {
          newTitle = meaningfulWords.map((word: string) => 
            word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
          ).join(' ')
          titleChanged = true
        }
      }
    }
    
    // Update title if changed
    if (titleChanged && newTitle !== item.title) {
      await prisma.discoveredContent.update({
        where: { id: item.id },
        data: { title: newTitle }
      })
      console.log(`✅ Fixed title: "${item.title}" → "${newTitle}"`)
      titlesFixed++
    } else {
      console.log(`⚠️  Could not improve title for ${item.id}: "${item.title}"`)
    }
    
    // Fix hero image if it's a favicon or missing
    const heroUrl = item.heroRecord?.imageUrl
    const needsImageFix = !heroUrl || 
                         heroUrl.includes('favicon') || 
                         heroUrl.includes('google.com/s2/favicons')
    
    if (needsImageFix) {
      const svgPlaceholder = generateSVGPlaceholder(newTitle || item.title || 'Content', 800, 400)
      
      if (item.heroRecord) {
        // Update existing hero record
        await prisma.hero.update({
          where: { id: item.heroRecord.id },
          data: {
            imageUrl: svgPlaceholder,
            status: 'READY',
            errorMessage: null
          }
        })
      } else {
        // Create new hero record
        await prisma.hero.create({
          data: {
            contentId: item.id,
            imageUrl: svgPlaceholder,
            status: 'READY',
            title: newTitle || item.title || 'Content',
            sourceUrl: item.sourceUrl || ''
          }
        })
      }
      console.log(`✅ Fixed hero image for ${item.id}`)
      imagesFixed++
    }
  }
  
  console.log(`\n=== SUMMARY ===`)
  console.log(`Titles fixed: ${titlesFixed}`)
  console.log(`Images fixed: ${imagesFixed}`)
  console.log(`Total items processed: ${poorItems.length}`)
}

fixAllTitlesAndImages().catch(console.error)

