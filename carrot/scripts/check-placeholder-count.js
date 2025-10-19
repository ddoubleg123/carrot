const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const PATCH_HANDLE = 'chicago-bulls';

async function checkPlaceholderCount() {
  console.log('🔍 Checking Chicago Bulls Page Placeholder Images');
  console.log('=' .repeat(60));

  // Find the patch
  const patch = await prisma.patch.findUnique({
    where: { handle: PATCH_HANDLE },
    select: { id: true, name: true }
  });

  if (!patch) {
    console.error('❌ Patch not found:', PATCH_HANDLE);
    process.exit(1);
  }

  console.log(`✅ Found patch: ${patch.name}`);
  console.log(`   ID: ${patch.id}\n`);

  // Get all content items for this patch
  const allContent = await prisma.discoveredContent.findMany({
    where: { 
      patchId: patch.id,
      status: 'ready' // Only approved items
    },
    select: {
      id: true,
      title: true,
      mediaAssets: true,
      createdAt: true
    },
    orderBy: { createdAt: 'desc' }
  });

  console.log(`📊 Total items on Chicago Bulls page: ${allContent.length}\n`);

  // Categorize items by image type
  const categories = {
    placeholder: [],
    aiGenerated: [],
    external: [],
    noImage: []
  };

  allContent.forEach(item => {
    const heroUrl = item.mediaAssets?.hero;
    
    if (!heroUrl) {
      categories.noImage.push(item);
    } else if (heroUrl.includes('Question_mark') || 
               heroUrl.includes('ui-avatars.com') ||
               heroUrl.includes('placeholder') ||
               heroUrl.includes('fallback')) {
      categories.placeholder.push(item);
    } else if (heroUrl.startsWith('data:image/')) {
      categories.aiGenerated.push(item);
    } else {
      categories.external.push(item);
    }
  });

  // Display results
  console.log('📈 Image Status Breakdown:');
  console.log('=' .repeat(40));
  console.log(`🔴 Placeholders: ${categories.placeholder.length}`);
  console.log(`🟢 AI Generated: ${categories.aiGenerated.length}`);
  console.log(`🔵 External URLs: ${categories.external.length}`);
  console.log(`⚪ No Image: ${categories.noImage.length}`);
  console.log('=' .repeat(40));

  if (categories.placeholder.length > 0) {
    console.log('\n🔴 Items with Placeholder Images:');
    categories.placeholder.forEach((item, index) => {
      console.log(`   ${index + 1}. ${item.title}`);
      console.log(`      Hero URL: ${item.mediaAssets?.hero?.substring(0, 80)}...`);
    });
  }

  if (categories.aiGenerated.length > 0) {
    console.log('\n🟢 Items with AI Generated Images:');
    categories.aiGenerated.slice(0, 5).forEach((item, index) => {
      console.log(`   ${index + 1}. ${item.title}`);
    });
    if (categories.aiGenerated.length > 5) {
      console.log(`   ... and ${categories.aiGenerated.length - 5} more`);
    }
  }

  console.log('\n' + '=' .repeat(60));
  console.log(`🎯 ANSWER: ${categories.placeholder.length} items need placeholder replacement`);
  console.log('=' .repeat(60));

  await prisma.$disconnect();
}

checkPlaceholderCount().catch(console.error);
