const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixChicagoBullsContent() {
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
    
    // Find some relevant NBA content that was marked as denied
    const relevantContent = await prisma.discoveredContent.findMany({
      where: {
        patchId: patch.id,
        status: 'denied',
        OR: [
          { title: { contains: 'NBA' } },
          { title: { contains: 'Bulls' } },
          { title: { contains: 'basketball' } },
          { title: { contains: 'Chicago' } },
          { sourceUrl: { contains: 'nba.com' } },
          { sourceUrl: { contains: 'espn.com' } },
          { sourceUrl: { contains: 'sports' } }
        ]
      },
      select: {
        id: true,
        title: true,
        sourceUrl: true,
        relevanceScore: true
      },
      orderBy: { createdAt: 'desc' },
      take: 10
    });
    
    console.log(`🔍 Found ${relevantContent.length} relevant items that were denied:`);
    relevantContent.forEach((item, i) => {
      console.log(`  ${i+1}. ${item.title} (score: ${item.relevanceScore})`);
      console.log(`     URL: ${item.sourceUrl}`);
    });
    
    if (relevantContent.length === 0) {
      console.log('❌ No relevant content found to restore');
      return;
    }
    
    // Update them back to 'ready'
    const updateResult = await prisma.discoveredContent.updateMany({
      where: {
        id: { in: relevantContent.map(item => item.id) }
      },
      data: {
        status: 'ready',
        updatedAt: new Date()
      }
    });
    
    console.log(`✅ Restored ${updateResult.count} items to 'ready' status`);
    
    // Also mark the irrelevant items as denied
    const irrelevantContent = await prisma.discoveredContent.findMany({
      where: {
        patchId: patch.id,
        status: 'ready',
        OR: [
          { sourceUrl: { contains: 'id.loc.gov' } },
          { sourceUrl: { contains: 'viaf.org' } },
          { sourceUrl: { contains: 'worldcat' } },
          { sourceUrl: { contains: 'ghostarchive' } },
          { title: { contains: 'United States' } },
          { title: { contains: 'WorldCat' } },
          { title: { contains: 'VIAF' } }
        ]
      },
      select: {
        id: true,
        title: true,
        sourceUrl: true
      }
    });
    
    if (irrelevantContent.length > 0) {
      console.log(`🔍 Found ${irrelevantContent.length} irrelevant items to mark as denied:`);
      irrelevantContent.forEach((item, i) => {
        console.log(`  ${i+1}. ${item.title}`);
      });
      
      const denyResult = await prisma.discoveredContent.updateMany({
        where: {
          id: { in: irrelevantContent.map(item => item.id) }
        },
        data: {
          status: 'denied',
          updatedAt: new Date()
        }
      });
      
      console.log(`✅ Marked ${denyResult.count} irrelevant items as 'denied'`);
    }
    
    // Check final status
    const finalCounts = await prisma.discoveredContent.groupBy({
      by: ['status'],
      where: { patchId: patch.id },
      _count: { status: true }
    });
    
    console.log('📊 Final status breakdown:');
    finalCounts.forEach(group => {
      console.log(`  ${group.status}: ${group._count.status}`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

fixChicagoBullsContent();
