/**
 * Test Hero Image URLs
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testHeroImages() {
  console.log('🔍 Testing hero image URLs...\n');

  const items = await prisma.discoveredContent.findMany({
    where: { 
      patchId: 'cmgnz2p5l0001qe29l4ziitf7',
      status: 'ready'
    },
    select: {
      id: true,
      title: true,
      mediaAssets: true
    },
    take: 3
  });

  for (const item of items) {
    console.log(`\n📄 ${item.title}`);
    console.log(`   ID: ${item.id}`);
    
    const mediaAssets = item.mediaAssets;
    if (mediaAssets?.hero) {
      console.log(`   ✅ Hero URL: ${mediaAssets.hero}`);
      
      // Test if the URL is accessible
      try {
        const response = await fetch(mediaAssets.hero);
        console.log(`   📊 Status: ${response.status} ${response.statusText}`);
        if (response.ok) {
          console.log(`   ✅ Image is accessible`);
        } else {
          console.log(`   ❌ Image failed to load`);
        }
      } catch (error) {
        console.log(`   ❌ Error fetching image: ${error.message}`);
      }
    } else {
      console.log(`   ❌ No hero image found`);
    }
  }

  await prisma.$disconnect();
}

testHeroImages().catch(console.error);
