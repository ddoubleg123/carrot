/**
 * Inspect hero images for a patch
 * Shows what images exist and their sources
 */

import prisma from '../src/lib/prisma';

async function inspectPatchImages(patchHandle: string) {
  console.log(`\n🔍 Inspecting images for patch: ${patchHandle}\n`);
  
  // Find the patch
  const patch = await prisma.patch.findUnique({
    where: { handle: patchHandle },
    select: { id: true, name: true }
  });
  
  if (!patch) {
    throw new Error(`Patch "${patchHandle}" not found`);
  }
  
  console.log(`✅ Found patch: ${patch.name}`);
  
  // Get all items
  const items = await prisma.discoveredContent.findMany({
    where: { patchId: patch.id },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      title: true,
      status: true,
      mediaAssets: true,
      createdAt: true
    }
  });
  
  console.log(`\n📊 Total items in patch: ${items.length}\n`);
  
  // Categorize items
  const withImages = items.filter(item => {
    const mediaAssets = item.mediaAssets as any;
    return mediaAssets?.hero;  // ← Correct field name!
  });
  
  const withoutImages = items.filter(item => {
    const mediaAssets = item.mediaAssets as any;
    return !mediaAssets?.hero;  // ← Correct field name!
  });
  
  const byStatus = items.reduce((acc, item) => {
    acc[item.status] = (acc[item.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  console.log('📈 Status Breakdown:');
  Object.entries(byStatus).forEach(([status, count]) => {
    console.log(`   ${status}: ${count}`);
  });
  
  console.log(`\n🖼️  Image Status:`);
  console.log(`   ✅ With Images: ${withImages.length}`);
  console.log(`   ❌ Without Images: ${withoutImages.length}`);
  
  if (withImages.length > 0) {
    console.log(`\n✅ Items WITH hero images:\n`);
    withImages.slice(0, 10).forEach((item, i) => {
      const mediaAssets = item.mediaAssets as any;
      console.log(`${i + 1}. ${item.title.substring(0, 60)}`);
      console.log(`   ID: ${item.id}`);
      console.log(`   Status: ${item.status}`);
      console.log(`   Source: ${mediaAssets?.source || 'unknown'}`);
      console.log(`   URL: ${mediaAssets?.hero?.substring(0, 80)}...`);
      console.log('');
    });
    if (withImages.length > 10) {
      console.log(`   ... and ${withImages.length - 10} more\n`);
    }
  }
  
  if (withoutImages.length > 0) {
    console.log(`\n❌ Items WITHOUT hero images:\n`);
    withoutImages.forEach((item, i) => {
      console.log(`${i + 1}. ${item.title.substring(0, 60)}`);
      console.log(`   ID: ${item.id}`);
      console.log(`   Status: ${item.status}`);
      console.log(`   Created: ${item.createdAt.toLocaleString()}`);
      console.log('');
    });
  }
  
  console.log('========================================\n');
  
  if (withoutImages.length > 0) {
    console.log(`💡 To backfill these ${withoutImages.length} items, run:`);
    console.log(`   npm run backfill-images ${patchHandle}\n`);
  } else if (withImages.length > 0) {
    console.log(`💡 All items have images! To regenerate them, run:`);
    console.log(`   npm run backfill-images ${patchHandle} --no-skip\n`);
  } else {
    console.log(`⚠️  No items found in this patch.\n`);
  }
}

// CLI
const patchHandle = process.argv[2];
if (!patchHandle) {
  console.error('Usage: npm run inspect-images <patch-handle>');
  process.exit(1);
}

inspectPatchImages(patchHandle)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error.message);
    process.exit(1);
  });

