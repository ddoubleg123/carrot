/**
 * Backfill Hero Images for Patch
 * 
 * Generates AI hero images for all discovered content in a specific patch
 * that doesn't already have images.
 * 
 * Usage:
 *   npm run backfill-images chicago-bulls
 *   npm run backfill-images israeli-news --limit 20
 *   npm run backfill-images all-patches --dry-run
 */

import prisma from '../src/lib/prisma';
import { generateAIImage } from '../src/lib/media/aiImageGenerator';
import { uploadHeroImage } from '../src/lib/media/uploadHeroImage';
import { tryFallbackImage } from '../src/lib/media/fallbackImages';
import { DISCOVERY_CONFIG } from '../src/config/discovery';

interface BackfillOptions {
  patchHandle: string;
  limit?: number;
  dryRun?: boolean;
  skipExisting?: boolean;
}

interface BackfillStats {
  total: number;
  success: number;
  failed: number;
  skipped: number;
  fallback: number;
}

async function backfillPatchImages(options: BackfillOptions) {
  const { patchHandle, limit, dryRun = false, skipExisting = true } = options;
  
  console.log(`\n🎨 Carrot Hero Image Backfill`);
  console.log(`========================================`);
  console.log(`Patch: ${patchHandle}`);
  console.log(`Limit: ${limit || 'unlimited'}`);
  console.log(`Dry Run: ${dryRun}`);
  console.log(`Skip Existing: ${skipExisting}`);
  console.log(`========================================\n`);
  
  // 1. Find the patch
  const patch = await prisma.patch.findUnique({
    where: { handle: patchHandle },
    select: { id: true, name: true, handle: true }
  });
  
  if (!patch) {
    throw new Error(`❌ Patch "${patchHandle}" not found`);
  }
  
  console.log(`✅ Found patch: ${patch.name} (${patch.handle})`);
  
  // 2. Get all discovered content (we'll filter in JS due to Prisma JSON limitations)
  const allItems = await prisma.discoveredContent.findMany({
    where: {
      patchId: patch.id,
      status: { in: ['ready', 'approved'] }
    },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      title: true,
      content: true,
      sourceUrl: true,
      mediaAssets: true,
      type: true
    }
  });
  
  // Filter items based on whether they have hero images (JS-side filtering)
  let items = allItems;
  
  if (skipExisting) {
    items = allItems.filter(item => {
      const mediaAssets = item.mediaAssets as any;
      return !mediaAssets || !mediaAssets.hero;  // ← Correct field name!
    });
  }
  
  // Apply limit if specified
  if (limit) {
    items = items.slice(0, limit);
  }
  
  console.log(`\n📊 Found ${items.length} items needing images`);
  
  if (items.length === 0) {
    console.log(`\n🎉 All items already have hero images!`);
    return;
  }
  
  if (dryRun) {
    console.log(`\n🔍 DRY RUN - Would process ${items.length} items:`);
    items.forEach((item, i) => {
      console.log(`  ${i + 1}. ${item.title.substring(0, 60)}...`);
    });
    console.log(`\n✅ Dry run complete. Run without --dry-run to execute.`);
    return;
  }
  
  // 3. Process each item with rate limiting
  const stats: BackfillStats = {
    total: items.length,
    success: 0,
    failed: 0,
    skipped: 0,
    fallback: 0
  };
  
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const progress = `[${i + 1}/${items.length}]`;
    
    console.log(`\n${progress} Processing: ${item.title.substring(0, 80)}`);
    console.log(`  Type: ${item.type}`);
    
    try {
      // Check if already has image (just in case)
      const mediaAssets = item.mediaAssets as any;
      if (mediaAssets?.hero && skipExisting) {
        console.log(`  ⏭️  Skipped (already has image)`);
        stats.skipped++;
        continue;
      }
      
      // Generate AI image with HD pipeline
      console.log(`  🎨 Generating AI image...`);
      const result = await generateAIImage({
        title: item.title,
        summary: item.content || '',
        artisticStyle: DISCOVERY_CONFIG.DEFAULT_IMAGE_STYLE,
        enableHiresFix: DISCOVERY_CONFIG.HD_MODE
      });
      
      if (result.success && result.imageUrl) {
        // Upload to Firebase
        console.log(`  ☁️  Uploading to Firebase...`);
        const firebaseUrl = await uploadHeroImage({
          base64Image: result.imageUrl,
          itemId: item.id,
          patchHandle: patch.handle,
          storageType: 'backfill'
        });
        
          // Update database with correct field names per schema
          const currentMediaAssets = mediaAssets || {};
          await prisma.discoveredContent.update({
            where: { id: item.id },
            data: {
              mediaAssets: {
                ...currentMediaAssets,
                hero: firebaseUrl,  // ← Correct field name!
                source: 'ai-generated-backfill',
                license: 'generated',
                generatedAt: new Date().toISOString(),
                prompt: result.prompt
              }
            }
          });
        
        console.log(`  ✅ Success! Image generated and uploaded`);
        stats.success++;
        
      } else {
        // Try fallback sources
        console.log(`  ⚠️  AI generation failed, trying fallbacks...`);
        const fallbackResult = await tryFallbackImage({
          title: item.title,
          content: item.content || undefined,
          sourceUrl: item.sourceUrl || undefined
        });
        
        if (fallbackResult.success && fallbackResult.imageUrl) {
          // Update with fallback image using correct field names
          const currentMediaAssets = mediaAssets || {};
          await prisma.discoveredContent.update({
            where: { id: item.id },
            data: {
              mediaAssets: {
                ...currentMediaAssets,
                hero: fallbackResult.imageUrl,  // ← Correct field name!
                source: `fallback-${fallbackResult.source}`,
                license: 'source'
              }
            }
          });
          
          console.log(`  ✅ Fallback image (${fallbackResult.source})`);
          stats.fallback++;
        } else {
          console.log(`  ❌ No image available (AI and fallbacks failed)`);
          stats.failed++;
        }
      }
      
      // Rate limit: Wait between generations (only if not last item)
      if (i < items.length - 1) {
        const waitSeconds = DISCOVERY_CONFIG.RATE_LIMIT_MS / 1000;
        console.log(`  ⏳ Waiting ${waitSeconds}s...`);
        await new Promise(resolve => setTimeout(resolve, DISCOVERY_CONFIG.RATE_LIMIT_MS));
      }
      
    } catch (error) {
      console.error(`  ❌ Error:`, error instanceof Error ? error.message : String(error));
      stats.failed++;
      // Continue to next item
    }
  }
  
  // 4. Print summary
  console.log(`\n========================================`);
  console.log(`🎉 Backfill Complete for ${patch.name}`);
  console.log(`========================================`);
  console.log(`Total Items: ${stats.total}`);
  console.log(`✅ Success (AI): ${stats.success}`);
  console.log(`⚠️  Fallback: ${stats.fallback}`);
  console.log(`❌ Failed: ${stats.failed}`);
  console.log(`⏭️  Skipped: ${stats.skipped}`);
  console.log(`========================================\n`);
}

// CLI execution
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log(`
Carrot Hero Image Backfill

Usage:
  npm run backfill-images <patch-handle> [options]

Examples:
  npm run backfill-images chicago-bulls
  npm run backfill-images israeli-news --limit 20
  npm run backfill-images all-patches --dry-run

Options:
  --limit N        Process only N items
  --dry-run        Show what would be processed without executing
  --no-skip        Don't skip items that already have images
  --help, -h       Show this help message
    `);
    process.exit(0);
  }
  
  const patchHandle = args[0];
  const limit = args.includes('--limit') 
    ? parseInt(args[args.indexOf('--limit') + 1]) 
    : undefined;
  const dryRun = args.includes('--dry-run');
  const skipExisting = !args.includes('--no-skip');
  
  try {
    await backfillPatchImages({
      patchHandle,
      limit,
      dryRun,
      skipExisting
    });
    
    console.log(`✅ Backfill completed successfully`);
    process.exit(0);
    
  } catch (error) {
    console.error(`\n❌ Fatal error:`, error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

export { backfillPatchImages };
