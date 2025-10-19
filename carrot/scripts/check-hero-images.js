/**
 * Check Hero Images in Database
 * 
 * This script queries the database to see what's actually stored
 * for hero images in the Chicago Bulls content.
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkHeroImages() {
  console.log('\n🔍 Checking hero images in database...\n');

  // Find the patch
  const patch = await prisma.patch.findUnique({
    where: { handle: 'chicago-bulls' },
    select: { id: true, name: true }
  });

  if (!patch) {
    console.error('❌ Patch not found: chicago-bulls');
    process.exit(1);
  }

  console.log('✅ Found patch:', patch.name);
  console.log('   ID:', patch.id);

  // Get all discovered content with mediaAssets
  const allContent = await prisma.discoveredContent.findMany({
    where: { 
      patchId: patch.id,
      status: 'ready'
    },
    select: {
      id: true,
      title: true,
      sourceUrl: true,
      type: true,
      status: true,
      mediaAssets: true,
      createdAt: true
    },
    orderBy: { createdAt: 'desc' },
    take: 10 // Just check the first 10
  });

  console.log(`\n📊 Checking first ${allContent.length} items:\n`);

  allContent.forEach((item, idx) => {
    console.log(`${idx + 1}. ${item.title}`);
    console.log(`   ID: ${item.id}`);
    console.log(`   Type: ${item.type}`);
    console.log(`   Status: ${item.status}`);
    console.log(`   URL: ${item.sourceUrl || 'N/A'}`);
    console.log(`   Created: ${item.createdAt.toISOString()}`);
    
    const mediaAssets = item.mediaAssets;
    console.log(`   MediaAssets:`, JSON.stringify(mediaAssets, null, 2));
    
    if (mediaAssets?.heroImage?.url) {
      console.log(`   ✅ Has heroImage: ${mediaAssets.heroImage.url}`);
    } else if (mediaAssets?.hero) {
      console.log(`   ✅ Has hero: ${mediaAssets.hero}`);
    } else {
      console.log(`   ❌ No hero image found`);
    }
    console.log('');
  });

  // Count items with and without hero images
  const itemsWithHero = allContent.filter(item => {
    const mediaAssets = item.mediaAssets;
    return mediaAssets?.heroImage?.url || mediaAssets?.hero;
  });

  const itemsWithoutHero = allContent.filter(item => {
    const mediaAssets = item.mediaAssets;
    return !mediaAssets?.heroImage?.url && !mediaAssets?.hero;
  });

  console.log('📊 Summary:');
  console.log(`   ✅ With hero images: ${itemsWithHero.length}`);
  console.log(`   ❌ Missing hero images: ${itemsWithoutHero.length}`);
  console.log(`   📈 Total checked: ${allContent.length}`);

  if (itemsWithoutHero.length > 0) {
    console.log('\n❌ Items missing hero images:');
    itemsWithoutHero.forEach((item, idx) => {
      console.log(`   ${idx + 1}. ${item.title} (${item.id})`);
    });
  }
}

async function main() {
  try {
    await checkHeroImages();
  } catch (error) {
    console.error('\n💥 Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
