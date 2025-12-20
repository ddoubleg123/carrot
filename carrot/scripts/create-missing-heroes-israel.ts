/**
 * Create missing hero records for Israel patch items
 */

import { prisma } from '@/lib/prisma'
import { generateSVGPlaceholder } from '@/lib/media/fallbackImages'

async function createMissingHeroes() {
  console.log('=== CREATING MISSING HEROES FOR ISRAEL ===\n')
  
  const patch = await prisma.patch.findUnique({
    where: { handle: 'israel' },
    select: { id: true }
  })
  
  if (!patch) {
    console.log('Patch "israel" not found')
    return
  }
  
  // Get items without hero records
  const itemsWithoutHeroes = await prisma.discoveredContent.findMany({
    where: {
      patchId: patch.id,
      heroRecord: null
    },
    select: {
      id: true,
      title: true
    },
    take: 50
  })
  
  console.log(`Found ${itemsWithoutHeroes.length} items without heroes\n`)
  
  let created = 0
  
  for (const item of itemsWithoutHeroes) {
    const svgPlaceholder = generateSVGPlaceholder(item.title || 'Content', 800, 400)
    
    try {
      await prisma.hero.create({
        data: {
          contentId: item.id,
          imageUrl: svgPlaceholder,
          status: 'READY',
          title: item.title || 'Content',
          sourceUrl: ''
        }
      })
      console.log(`✅ Created hero for "${item.title?.substring(0, 50)}"`)
      created++
    } catch (error: any) {
      if (error.code === 'P2002') {
        console.log(`⚠️  Hero already exists for ${item.id}`)
      } else {
        console.error(`❌ Error creating hero for ${item.id}:`, error.message)
      }
    }
  }
  
  console.log(`\n=== SUMMARY ===`)
  console.log(`Created: ${created} heroes`)
  console.log(`Total: ${itemsWithoutHeroes.length}`)
}

createMissingHeroes().catch(console.error)

