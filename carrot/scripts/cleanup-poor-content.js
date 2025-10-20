#!/usr/bin/env node

/**
 * Cleanup Poor Quality Content Script
 * 
 * This script:
 * 1. Identifies content with poor quality sources (ESPN collection pages, etc.)
 * 2. Marks them as 'denied' to remove from display
 * 3. Triggers new discovery with improved quality filters
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function cleanupPoorContent() {
  console.log('🧹 Starting cleanup of poor quality content...');
  
  try {
    // Find Chicago Bulls patch
    const patch = await prisma.patch.findUnique({
      where: { handle: 'chicago-bulls' },
      select: { id: true, name: true }
    });

    if (!patch) {
      console.log('❌ Chicago Bulls patch not found');
      return;
    }

    console.log(`📋 Found patch: ${patch.name} (ID: ${patch.id})`);

    // Find content with poor quality sources
    const poorQualityContent = await prisma.discoveredContent.findMany({
      where: {
        patchId: patch.id,
        status: 'ready',
        OR: [
          { sourceUrl: { contains: 'espn.com/nba/story/_/id' } }, // ESPN collection pages
          { sourceUrl: { contains: 'collection' } },
          { sourceUrl: { contains: 'category' } },
          { sourceUrl: { contains: 'browse' } },
          { title: { contains: 'Collection' } }
        ]
      },
      select: {
        id: true,
        title: true,
        sourceUrl: true,
        status: true
      }
    });

    console.log(`🔍 Found ${poorQualityContent.length} poor quality items:`);
    poorQualityContent.forEach(item => {
      console.log(`  - ${item.title} (${item.sourceUrl})`);
    });

    if (poorQualityContent.length === 0) {
      console.log('✅ No poor quality content found');
      return;
    }

    // Mark as denied
    const updateResult = await prisma.discoveredContent.updateMany({
      where: {
        id: { in: poorQualityContent.map(item => item.id) }
      },
      data: {
        status: 'denied',
        updatedAt: new Date()
      }
    });

    console.log(`✅ Marked ${updateResult.count} items as denied`);

    // Show remaining content
    const remainingContent = await prisma.discoveredContent.findMany({
      where: {
        patchId: patch.id,
        status: 'ready'
      },
      select: {
        id: true,
        title: true,
        sourceUrl: true
      }
    });

    console.log(`📊 Remaining content (${remainingContent.length} items):`);
    remainingContent.forEach(item => {
      console.log(`  - ${item.title}`);
    });

    console.log('🎯 Next steps:');
    console.log('1. Go to the Chicago Bulls page');
    console.log('2. Click "Discovering content" to trigger new discovery');
    console.log('3. The new system will find higher quality sources');

  } catch (error) {
    console.error('❌ Error during cleanup:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the cleanup
cleanupPoorContent();
