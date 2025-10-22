const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function clearNonBullsContent() {
  try {
    console.log('🗑️  Clearing non-Bulls content...')
    
    // Find Chicago Bulls patch
    const patch = await prisma.patch.findFirst({
      where: { handle: 'chicago-bulls' }
    })
    
    if (!patch) {
      console.log('❌ Chicago Bulls patch not found')
      return
    }
    
    // Delete all discovered content for Chicago Bulls
    const deleted = await prisma.discoveredContent.deleteMany({
      where: { patchId: patch.id }
    })
    
    console.log(`✅ Deleted ${deleted.count} items from Chicago Bulls patch`)
    console.log('🎯 Ready for new Bulls-specific discovery')
    
  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

clearNonBullsContent()
