const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkMetadata() {
  try {
    console.log('🔍 Checking metadata for Chicago Bulls content...\n');
    
    // Get the Chicago Bulls patch
    const patch = await prisma.patch.findUnique({
      where: { handle: 'chicago-bulls' },
      select: { id: true, handle: true }
    });
    
    if (!patch) {
      console.log('❌ Chicago Bulls patch not found');
      return;
    }
    
    console.log(`📋 Patch: ${patch.handle} (ID: ${patch.id})\n`);
    
    // Get discovered content with metadata
    const content = await prisma.discoveredContent.findMany({
      where: { patchId: patch.id },
      select: {
        id: true,
        title: true,
        metadata: true,
        sourceUrl: true
      },
      take: 5
    });
    
    console.log(`📊 Found ${content.length} items (showing first 5):\n`);
    
    content.forEach((item, index) => {
      console.log(`${index + 1}. ${item.title}`);
      console.log(`   ID: ${item.id}`);
      console.log(`   Source URL: ${item.sourceUrl}`);
      console.log(`   Metadata: ${JSON.stringify(item.metadata, null, 2)}`);
      console.log('');
    });
    
    // Check if any items have metadata with contentUrl and urlSlug
    const itemsWithMetadata = content.filter(item => 
      item.metadata && 
      typeof item.metadata === 'object' && 
      item.metadata.contentUrl && 
      item.metadata.urlSlug
    );
    
    console.log(`✅ Items with URL metadata: ${itemsWithMetadata.length}/${content.length}`);
    
    if (itemsWithMetadata.length > 0) {
      console.log('\n🎯 Items with URL metadata:');
      itemsWithMetadata.forEach((item, index) => {
        console.log(`${index + 1}. ${item.title}`);
        console.log(`   Content URL: ${item.metadata.contentUrl}`);
        console.log(`   URL Slug: ${item.metadata.urlSlug}`);
        console.log('');
      });
    } else {
      console.log('\n❌ No items have URL metadata - need to run generate-content-urls.js');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkMetadata();
