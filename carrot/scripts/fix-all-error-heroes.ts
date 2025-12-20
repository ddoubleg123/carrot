/**
 * Fix all ERROR status heroes - replace favicon URLs with SVG placeholders
 */

import { prisma } from '@/lib/prisma'
import { generateSVGPlaceholder } from '@/lib/media/fallbackImages'

async function fixErrorHeroes() {
  console.log('=== FIXING ERROR HEROES ===\n')
  
  // Get all ERROR heroes with favicon URLs
  const errorHeroes = await prisma.hero.findMany({
    where: {
      OR: [
        { status: 'ERROR' },
        { 
          imageUrl: { 
            contains: 'favicon' 
          } 
        },
        {
          imageUrl: {
            contains: 'google.com/s2/favicons'
          }
        }
      ]
    },
    include: {
      content: {
        select: {
          id: true,
          title: true
        }
      }
    },
    take: 100
  })
  
  console.log(`Found ${errorHeroes.length} error heroes to fix\n`)
  
  let fixed = 0
  
  for (const hero of errorHeroes) {
    if (!hero.content) {
      console.log(`⚠️  Hero ${hero.id} has no content, skipping`)
      continue
    }
    
    const title = hero.content.title || 'Content'
    const svgPlaceholder = generateSVGPlaceholder(title, 800, 400)
    
    await prisma.hero.update({
      where: { id: hero.id },
      data: {
        imageUrl: svgPlaceholder,
        status: 'READY',
        errorMessage: null
      }
    })
    
    console.log(`✅ Fixed hero ${hero.id} for content "${title.substring(0, 50)}"`)
    fixed++
  }
  
  console.log(`\n=== SUMMARY ===`)
  console.log(`Fixed: ${fixed} heroes`)
  console.log(`Total found: ${errorHeroes.length}`)
}

fixErrorHeroes().catch(console.error)

