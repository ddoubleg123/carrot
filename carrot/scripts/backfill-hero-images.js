/**
 * Backfill Hero Images for Chicago Bulls Patch
 * 
 * This script:
 * 1. Queries all discovered content for Chicago Bulls
 * 2. Identifies items missing hero images
 * 3. Generates AI hero images one-by-one
 * 4. Updates the database with the new images
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const PATCH_HANDLE = 'chicago-bulls';
const API_BASE_URL = process.env.NEXTAUTH_URL || 'https://carrot-app.onrender.com';

async function analyzeContent() {
  console.log('\n🔍 Analyzing Chicago Bulls content...\n');

  // Find the patch
  const patch = await prisma.patch.findUnique({
    where: { handle: PATCH_HANDLE },
    select: { id: true, name: true }
  });

  if (!patch) {
    console.error('❌ Patch not found:', PATCH_HANDLE);
    process.exit(1);
  }

  console.log('✅ Found patch:', patch.name);
  console.log('   ID:', patch.id);

  // Get all discovered content
  const allContent = await prisma.discoveredContent.findMany({
    where: { 
      patchId: patch.id,
      status: 'ready' // Only process approved content
    },
    select: {
      id: true,
      title: true,
      sourceUrl: true,
      type: true,
      status: true,
      mediaAssets: true,
      content: true
    },
    orderBy: { createdAt: 'desc' }
  });

  console.log(`\n📊 Total items: ${allContent.length}`);

  // Analyze which items have hero images
  const itemsWithHero = [];
  const itemsWithoutHero = [];

  allContent.forEach(item => {
    const mediaAssets = item.mediaAssets;
    const hasHero = mediaAssets?.heroImage?.url || mediaAssets?.hero;
    
    if (hasHero) {
      itemsWithHero.push(item);
    } else {
      itemsWithoutHero.push(item);
    }
  });

  console.log(`   ✅ With hero images: ${itemsWithHero.length}`);
  console.log(`   ❌ Missing hero images: ${itemsWithoutHero.length}`);

  if (itemsWithoutHero.length > 0) {
    console.log('\n📋 Items missing hero images:');
    itemsWithoutHero.forEach((item, idx) => {
      console.log(`   ${idx + 1}. ${item.title}`);
      console.log(`      ID: ${item.id}`);
      console.log(`      Type: ${item.type}`);
      console.log(`      URL: ${item.sourceUrl || 'N/A'}`);
    });
  }

  return { patch, allContent, itemsWithHero, itemsWithoutHero };
}

async function generateHeroImage(item) {
  console.log(`\n🎨 Generating hero image for: ${item.title}`);
  
  try {
    const response = await fetch(`${API_BASE_URL}/api/ai/generate-hero-image`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: item.title,
        summary: item.content || '',
        contentType: item.type,
        artisticStyle: 'photorealistic',
        enableHiresFix: false
      })
    });

    if (!response.ok) {
      console.error(`   ❌ API error: ${response.status} ${response.statusText}`);
      return null;
    }

    const data = await response.json();
    
    if (data.success && data.imageUrl) {
      console.log(`   ✅ Generated: ${data.imageUrl}`);
      return {
        url: data.imageUrl,
        source: 'ai-generated',
        license: 'generated'
      };
    } else {
      console.error('   ❌ No image URL returned');
      return null;
    }
  } catch (error) {
    console.error('   ❌ Error:', error.message);
    return null;
  }
}

async function updateItemWithHero(itemId, heroImage) {
  console.log(`   💾 Updating database...`);
  
  try {
    await prisma.discoveredContent.update({
      where: { id: itemId },
      data: {
        mediaAssets: {
          heroImage: heroImage
        }
      }
    });
    console.log('   ✅ Database updated');
    return true;
  } catch (error) {
    console.error('   ❌ Database error:', error.message);
    return false;
  }
}

async function backfillImages() {
  console.log('🚀 Starting Hero Image Backfill Process\n');
  console.log('=' .repeat(60));

  const { patch, itemsWithoutHero } = await analyzeContent();

  if (itemsWithoutHero.length === 0) {
    console.log('\n✨ All items already have hero images! Nothing to do.');
    return;
  }

  console.log('\n' + '='.repeat(60));
  console.log(`\n🔄 Starting backfill for ${itemsWithoutHero.length} items...\n`);

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < itemsWithoutHero.length; i++) {
    const item = itemsWithoutHero[i];
    console.log(`\n[${ i + 1 }/${itemsWithoutHero.length}] Processing: ${item.title}`);
    console.log('-'.repeat(60));

    // Generate hero image
    const heroImage = await generateHeroImage(item);
    
    if (heroImage) {
      // Update database
      const updated = await updateItemWithHero(item.id, heroImage);
      
      if (updated) {
        successCount++;
        console.log(`   ✨ Success! (${successCount}/${itemsWithoutHero.length})`);
      } else {
        failCount++;
        console.log(`   ⚠️  Failed to update database (${failCount} failures)`);
      }
    } else {
      failCount++;
      console.log(`   ⚠️  Failed to generate image (${failCount} failures)`);
    }

    // Rate limiting: wait 2 seconds between requests
    if (i < itemsWithoutHero.length - 1) {
      console.log('   ⏳ Waiting 2 seconds...');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('\n📊 Backfill Complete!\n');
  console.log(`   ✅ Success: ${successCount}`);
  console.log(`   ❌ Failed: ${failCount}`);
  console.log(`   📈 Total: ${itemsWithoutHero.length}`);
  console.log(`   🎯 Success Rate: ${Math.round((successCount / itemsWithoutHero.length) * 100)}%`);
  console.log('\n' + '='.repeat(60) + '\n');
}

async function main() {
  try {
    const args = process.argv.slice(2);
    const command = args[0];

    if (command === 'analyze' || !command) {
      // Just analyze, don't backfill
      await analyzeContent();
    } else if (command === 'backfill') {
      // Analyze and backfill
      await backfillImages();
    } else {
      console.log('Usage:');
      console.log('  node backfill-hero-images.js analyze   # Just analyze, don\'t backfill');
      console.log('  node backfill-hero-images.js backfill  # Analyze and backfill images');
    }
  } catch (error) {
    console.error('\n💥 Fatal error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();

