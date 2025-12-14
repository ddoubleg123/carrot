/**
 * Check hero status for a patch to see what images they currently have
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkHeroStatus(patchHandle: string) {
  try {
    const patch = await prisma.patch.findUnique({
      where: { handle: patchHandle },
      select: { id: true, title: true }
    })

    if (!patch) {
      console.error(`❌ Patch "${patchHandle}" not found`)
      return
    }

    console.log(`📊 Hero Status for: ${patch.title}\n`)

    const allContent = await prisma.discoveredContent.findMany({
      where: { patchId: patch.id },
      select: {
        id: true,
        title: true
      }
    })

    const heroes = await prisma.hero.findMany({
      where: {
        contentId: { in: allContent.map(c => c.id) }
      },
      select: {
        id: true,
        contentId: true,
        imageUrl: true,
        title: true,
        status: true
      }
    })

    console.log(`Found ${heroes.length} heroes\n`)

    // Categorize heroes
    const categories = {
      wikimedia: [] as typeof heroes,
      placeholder: [] as typeof heroes,
      favicon: [] as typeof heroes,
      ai: [] as typeof heroes,
      other: [] as typeof heroes,
      noImage: [] as typeof heroes
    }

    heroes.forEach(hero => {
      const imageUrl = hero.imageUrl || ''
      
      if (!imageUrl) {
        categories.noImage.push(hero)
      } else if (imageUrl.includes('wikimedia.org') || imageUrl.includes('upload.wikimedia.org')) {
        categories.wikimedia.push(hero)
      } else if (imageUrl.includes('via.placeholder.com') || imageUrl.includes('placeholder')) {
        categories.placeholder.push(hero)
      } else if (imageUrl.includes('google.com/s2/favicons')) {
        categories.favicon.push(hero)
      } else if (imageUrl.includes('ai') || imageUrl.includes('generated') || imageUrl.includes('deepseek')) {
        categories.ai.push(hero)
      } else {
        categories.other.push(hero)
      }
    })

    console.log('📊 Hero Categories:')
    console.log(`   🖼️  Wikimedia: ${categories.wikimedia.length}`)
    console.log(`   🎨 AI/Generated: ${categories.ai.length}`)
    console.log(`   📄 Other (OG, etc.): ${categories.other.length}`)
    console.log(`   ⚪ Placeholder: ${categories.placeholder.length}`)
    console.log(`   🔖 Favicon: ${categories.favicon.length}`)
    console.log(`   ❌ No Image: ${categories.noImage.length}`)

    // Show status breakdown
    const statusBreakdown = heroes.reduce((acc, hero) => {
      acc[hero.status] = (acc[hero.status] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    console.log(`\n📊 Status Breakdown:`)
    Object.entries(statusBreakdown).forEach(([status, count]) => {
      console.log(`   ${status}: ${count}`)
    })

    // Show examples
    if (categories.placeholder.length > 0) {
      console.log(`\n📝 Example Placeholder Heroes (can be backfilled):`)
      categories.placeholder.slice(0, 3).forEach(hero => {
        const content = allContent.find(c => c.id === hero.contentId)
        console.log(`   - ${content?.title || hero.title || 'Untitled'}`)
        console.log(`     Image: ${hero.imageUrl?.substring(0, 80)}...`)
      })
    }

    if (categories.favicon.length > 0) {
      console.log(`\n📝 Example Favicon Heroes (can be backfilled):`)
      categories.favicon.slice(0, 3).forEach(hero => {
        const content = allContent.find(c => c.id === hero.contentId)
        console.log(`   - ${content?.title || hero.title || 'Untitled'}`)
        console.log(`     Image: ${hero.imageUrl?.substring(0, 80)}...`)
      })
    }

    // Show what can be backfilled
    const canBackfill = heroes.filter(hero => {
      const imageUrl = hero.imageUrl || ''
      const hasWikimedia = imageUrl.includes('wikimedia.org')
      const isPlaceholder = imageUrl.includes('via.placeholder.com') || imageUrl.includes('placeholder')
      const isFavicon = imageUrl.includes('google.com/s2/favicons')
      
      return !hasWikimedia && (isPlaceholder || isFavicon || !imageUrl) && hero.status === 'READY'
    })

    console.log(`\n🔄 Can be backfilled: ${canBackfill.length} heroes`)

  } catch (error: any) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

const patchHandle = process.argv[2] || 'israel'
checkHeroStatus(patchHandle)
  .then(() => process.exit(0))
  .catch(() => process.exit(1))

