const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkReadyItems() {
  try {
    // Find the Chicago Bulls patch
    const patch = await prisma.patch.findFirst({
      where: { handle: 'chicago-bulls' },
      select: { id: true, name: true, handle: true }
    });
    
    if (!patch) {
      console.log('❌ Chicago Bulls patch not found');
      return;
    }
    
    // Get some ready items
    const readyItems = await prisma.discoveredContent.findMany({
      where: { 
        patchId: patch.id,
        status: 'ready'
      },
      select: {
        id: true,
        title: true,
        status: true,
        createdAt: true,
        sourceUrl: true,
        relevanceScore: true
      },
      orderBy: { createdAt: 'desc' },
      take: 5
    });
    
    console.log('✅ Ready items (first 5):');
    readyItems.forEach((item, i) => {
      console.log(`  ${i+1}. ${item.title}`);
      console.log(`     URL: ${item.sourceUrl}`);
      console.log(`     Score: ${item.relevanceScore}`);
      console.log(`     Created: ${item.createdAt}`);
      console.log('');
    });
    
    // Check some denied items to see why they were denied
    const deniedItems = await prisma.discoveredContent.findMany({
      where: { 
        patchId: patch.id,
        status: 'denied'
      },
      select: {
        id: true,
        title: true,
        status: true,
        createdAt: true,
        sourceUrl: true,
        relevanceScore: true
      },
      orderBy: { createdAt: 'desc' },
      take: 3
    });
    
    console.log('❌ Denied items (first 3):');
    deniedItems.forEach((item, i) => {
      console.log(`  ${i+1}. ${item.title}`);
      console.log(`     URL: ${item.sourceUrl}`);
      console.log(`     Score: ${item.relevanceScore}`);
      console.log(`     Created: ${item.createdAt}`);
      console.log('');
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkReadyItems();
