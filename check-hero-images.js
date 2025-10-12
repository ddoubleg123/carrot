const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkHeroImages() {
  try {
    console.log('🔍 Checking Houston Rockets discovered content for hero images...\n');
    
    // Find the Houston Rockets patch
    const patch = await prisma.patch.findFirst({
      where: { 
        OR: [
          { handle: 'houston-rockets-6' },
          { name: { contains: 'Houston Rockets', mode: 'insensitive' } }
        ]
      }
    });
    
    if (!patch) {
      console.log('❌ Houston Rockets patch not found');
      return;
    }
    
    console.log('✅ Found patch:', patch.name, '(ID:', patch.id, ')');
    
    // Get discovered content for this patch
    const content = await prisma.discoveredContent.findMany({
      where: { patchId: patch.id },
      select: {
        id: true,
        title: true,
        type: true,
        sourceUrl: true,
        mediaAssets: true,
        status: true
      },
      orderBy: { createdAt: 'desc' },
      take: 10
    });
    
    console.log('\n📊 Found', content.length, 'discovered content items:');
    
    content.forEach((item, i) => {
      console.log(`\n${i+1}. ${item.title}`);
      console.log(`   Type: ${item.type}`);
      console.log(`   Status: ${item.status}`);
      console.log(`   Source: ${item.sourceUrl?.substring(0, 50)}...`);
      console.log(`   MediaAssets: ${item.mediaAssets ? 'EXISTS' : 'NULL'}`);
      
      if (item.mediaAssets) {
        const media = item.mediaAssets;
        console.log(`   Hero: ${media.hero ? 'EXISTS' : 'NULL'}`);
        console.log(`   Source: ${media.source || 'unknown'}`);
        if (media.hero) {
          console.log(`   Hero URL: ${media.hero.substring(0, 80)}...`);
        }
      }
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkHeroImages();
