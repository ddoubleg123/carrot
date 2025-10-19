const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');

const prisma = new PrismaClient();

async function generateContentUrls() {
  console.log('🔗 Generating Unique URLs for All Content Tiles');
  console.log('=' .repeat(60));

  try {
    // Get all discovered content across all patches
    const allContent = await prisma.discoveredContent.findMany({
      where: {
        status: 'ready' // Only approved content
      },
      select: {
        id: true,
        title: true,
        patchId: true,
        patch: {
          select: {
            handle: true,
            name: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    console.log(`📊 Found ${allContent.length} content items across all patches\n`);

    let updatedCount = 0;
    let skippedCount = 0;

    for (const item of allContent) {
      // Generate a unique URL slug from title
      const slug = generateSlug(item.title);
      const contentUrl = `/${item.patch.handle}/content/${slug}`;
      
      console.log(`🔗 ${item.title}`);
      console.log(`   📍 Patch: ${item.patch.name} (${item.patch.handle})`);
      console.log(`   🌐 URL: ${contentUrl}`);

      try {
        // Update the content with the URL in metadata
        await prisma.discoveredContent.update({
          where: { id: item.id },
          data: {
            metadata: {
              contentUrl: contentUrl,
              urlSlug: slug
            }
          }
        });
        
        updatedCount++;
        console.log(`   ✅ Updated\n`);
      } catch (error) {
        console.log(`   ⚠️ Already has URL or error: ${error.message}\n`);
        skippedCount++;
      }
    }

    console.log('=' .repeat(60));
    console.log('📊 URL Generation Complete!');
    console.log('=' .repeat(60));
    console.log(`   ✅ Updated: ${updatedCount}`);
    console.log(`   ⚠️ Skipped: ${skippedCount}`);
    console.log(`   📈 Total: ${allContent.length}`);
    console.log('=' .repeat(60));

  } catch (error) {
    console.error('❌ Error generating URLs:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

function generateSlug(title) {
  // Create a URL-friendly slug from the title
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single
    .trim()
    .substring(0, 50) // Limit length
    + '-' + crypto.randomBytes(4).toString('hex'); // Add unique suffix
}

generateContentUrls();
