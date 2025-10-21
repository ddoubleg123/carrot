const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkChicagoBulls() {
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
    
    console.log('✅ Found patch:', patch);
    
    // Check discovered content
    const discoveredContent = await prisma.discoveredContent.findMany({
      where: { patchId: patch.id },
      select: {
        id: true,
        title: true,
        status: true,
        createdAt: true,
        sourceUrl: true
      },
      orderBy: { createdAt: 'desc' },
      take: 10
    });
    
    console.log('📊 Discovered Content Count:', discoveredContent.length);
    console.log('📋 Recent Items:');
    discoveredContent.forEach((item, i) => {
      console.log(`  ${i+1}. ${item.title} (status: ${item.status})`);
    });
    
    // Check if there are any with status 'ready'
    const readyItems = await prisma.discoveredContent.count({
      where: { 
        patchId: patch.id,
        status: 'ready'
      }
    });
    
    console.log('✅ Ready items:', readyItems);
    
    // Check all statuses
    const statusCounts = await prisma.discoveredContent.groupBy({
      by: ['status'],
      where: { patchId: patch.id },
      _count: { status: true }
    });
    
    console.log('📈 Status breakdown:');
    statusCounts.forEach(group => {
      console.log(`  ${group.status}: ${group._count.status}`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkChicagoBulls();
