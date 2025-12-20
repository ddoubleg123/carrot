/**
 * Fix specific poor titles that are still showing on frontend
 */

import { prisma } from '@/lib/prisma'

async function fixSpecificPoorTitles() {
  console.log('🔧 Fixing specific poor titles...\n')

  const poorTitles = ['10.1017/chol9780521772488.005', 'book part']
  
  for (const poorTitle of poorTitles) {
    const items = await prisma.discoveredContent.findMany({
      where: { title: poorTitle },
      select: {
        id: true,
        title: true,
        sourceUrl: true,
        heroRecord: {
          select: { title: true }
        }
      }
    })

    console.log(`Found ${items.length} items with title "${poorTitle}"`)

    for (const item of items) {
      let newTitle = item.title

      // Try Hero table title first
      if (item.heroRecord?.title && item.heroRecord.title.length > 5) {
        newTitle = item.heroRecord.title
        console.log(`  Using Hero title: "${newTitle}"`)
      } 
      // Try extracting from URL
      else if (item.sourceUrl) {
        try {
          const url = new URL(item.sourceUrl)
          const pathParts = url.pathname.split('/').filter(p => p && p.length > 2)
          
          if (pathParts.length > 0) {
            const lastPart = pathParts[pathParts.length - 1]
            const decoded = decodeURIComponent(lastPart.replace(/[-_]/g, ' '))
            
            // Validate it's a good title
            if (decoded.length >= 5 && 
                decoded.length < 200 && 
                !decoded.match(/^10\.\d{4,}\//) &&
                decoded !== 'book part') {
              newTitle = decoded
              console.log(`  Extracted from URL: "${newTitle}"`)
            }
          }
        } catch (e) {
          // URL parsing failed
        }
      }

      // Update if we found a better title
      if (newTitle !== item.title) {
        await prisma.discoveredContent.update({
          where: { id: item.id },
          data: { title: newTitle }
        })
        console.log(`  ✅ Fixed: "${item.title}" -> "${newTitle}"`)
      } else {
        console.log(`  ⚠️  Could not find better title for: "${item.title}"`)
      }
    }
  }

  console.log('\n✅ Title fix complete!')
}

if (require.main === module) {
  fixSpecificPoorTitles()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('❌ Script failed:', error)
      process.exit(1)
    })
}

export { fixSpecificPoorTitles }

