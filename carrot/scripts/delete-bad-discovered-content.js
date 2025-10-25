/**
 * Delete irrelevant discovered content (hockey, non-Bulls articles)
 * Run this to clean up the Chicago Bulls page
 */

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function deleteBadContent() {
  try {
    console.log('🗑️  Finding bad content to delete...')
    
    // Find the Chicago Bulls patch
    const bullsPatch = await prisma.patch.findFirst({
      where: { handle: 'chicago-bulls' },
      select: { id: true, name: true }
    })
    
    if (!bullsPatch) {
      console.log('❌ Chicago Bulls patch not found')
      return
    }
    
    console.log(`✅ Found patch: ${bullsPatch.name} (${bullsPatch.id})`)
    
    // Hockey/NHL blacklist terms
    const blacklistTerms = [
      'blackhawks', 'hockey', 'nhl', 'stanley cup', 'flyers',
      'puck', 'ice hockey', 'goalie', 'defenseman'
    ]
    
    // Find all discovered content for Bulls
    const allContent = await prisma.discoveredContent.findMany({
      where: { patchId: bullsPatch.id },
      select: {
        id: true,
        title: true,
        sourceUrl: true,
        content: true
      }
    })
    
    console.log(`📊 Total discovered content: ${allContent.length}`)
    
    // Filter for bad content
    const badItems = allContent.filter(item => {
      const text = `${item.title} ${item.content}`.toLowerCase()
      return blacklistTerms.some(term => text.includes(term))
    })
    
    console.log(`❌ Found ${badItems.length} hockey/irrelevant items to delete:`)
    badItems.forEach(item => {
      console.log(`   - ${item.title.substring(0, 60)}...`)
    })
    
    if (badItems.length === 0) {
      console.log('✅ No bad content found!')
      return
    }
    
    // Delete bad items
    const deleteResult = await prisma.discoveredContent.deleteMany({
      where: {
        id: { in: badItems.map(item => item.id) }
      }
    })
    
    console.log(`\n✅ Deleted ${deleteResult.count} irrelevant items`)
    console.log(`📊 Remaining content: ${allContent.length - badItems.length}`)
    
  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

deleteBadContent()

