/**
 * Backfill Broken Hero Images
 * 
 * This script:
 * 1. Tests all existing hero images to see which ones are broken
 * 2. Generates new AI hero images for broken ones
 * 3. Updates the database with the new images
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const PATCH_HANDLE = 'chicago-bulls';
const API_BASE_URL = process.env.NEXTAUTH_URL || 'https://carrot-app.onrender.com';

async function testHeroImage(heroUrl) {
  try {
    const fullUrl = heroUrl.startsWith('http') ? heroUrl : `${API_BASE_URL}${heroUrl}`;
    const response = await fetch(fullUrl, {
      method: 'HEAD',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; CarrotBot/1.0; +https://carrot.app/bot)'
      }
    });
    
    return response.ok;
  } catch (error) {
    return false;
  }
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
          hero: heroImage.url,
          source: heroImage.source,
          license: heroImage.license
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

async function backfillBrokenImages() {
  console.log('🚀 Starting Broken Hero Image Backfill\n');
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

  console.log('✅ Found patch:', patch.name);
  console.log('   ID:', patch.id);

  // Get all discovered content with hero images
  const allContent = await prisma.discoveredContent.findMany({
    where: { 
      patchId: patch.id,
      status: 'ready'
    },
    select: {
      id: true,
      title: true,
      type: true,
      content: true,
      mediaAssets: true
    },
    orderBy: { createdAt: 'desc' }
  });

  console.log(`\n📊 Testing ${allContent.length} items for broken hero images...\n`);

  const brokenItems = [];
  const workingItems = [];

  // Test each item's hero image
  for (let i = 0; i < allContent.length; i++) {
    const item = allContent[i];
    const mediaAssets = item.mediaAssets;
    const heroUrl = mediaAssets?.hero;
    
    console.log(`[${i + 1}/${allContent.length}] Testing: ${item.title}`);
    
    if (!heroUrl) {
      console.log('   ❌ No hero image found');
      brokenItems.push(item);
      continue;
    }
    
    const isWorking = await testHeroImage(heroUrl);
    
    if (isWorking) {
      console.log('   ✅ Hero image is working');
      workingItems.push(item);
    } else {
      console.log('   ❌ Hero image is broken');
      brokenItems.push(item);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('\n📊 Test Results:\n');
  console.log(`   ✅ Working images: ${workingItems.length}`);
  console.log(`   ❌ Broken images: ${brokenItems.length}`);
  console.log(`   📈 Total items: ${allContent.length}`);

  if (brokenItems.length === 0) {
    console.log('\n✨ All hero images are working! Nothing to backfill.');
    return;
  }

  console.log('\n' + '='.repeat(60));
  console.log(`\n🔄 Starting backfill for ${brokenItems.length} broken items...\n`);

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < brokenItems.length; i++) {
    const item = brokenItems[i];
    console.log(`\n[${ i + 1 }/${brokenItems.length}] Processing: ${item.title}`);
    console.log('-'.repeat(60));

    // Generate new hero image
    const heroImage = await generateHeroImage(item);
    
    if (heroImage) {
      // Update database
      const updated = await updateItemWithHero(item.id, heroImage);
      
      if (updated) {
        successCount++;
        console.log(`   ✨ Success! (${successCount}/${brokenItems.length})`);
      } else {
        failCount++;
        console.log(`   ⚠️  Failed to update database (${failCount} failures)`);
      }
    } else {
      failCount++;
      console.log(`   ⚠️  Failed to generate image (${failCount} failures)`);
    }

    // Rate limiting: wait 2 seconds between requests
    if (i < brokenItems.length - 1) {
      console.log('   ⏳ Waiting 2 seconds...');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('\n📊 Backfill Complete!\n');
  console.log(`   ✅ Success: ${successCount}`);
  console.log(`   ❌ Failed: ${failCount}`);
  console.log(`   📈 Total: ${brokenItems.length}`);
  console.log(`   🎯 Success Rate: ${Math.round((successCount / brokenItems.length) * 100)}%`);
  console.log('\n' + '='.repeat(60) + '\n');
}

async function main() {
  try {
    const args = process.argv.slice(2);
    const command = args[0];

    if (command === 'test' || !command) {
      // Just test, don't backfill
      console.log('🧪 Testing mode - will not generate new images');
      await backfillBrokenImages();
    } else if (command === 'backfill') {
      // Test and backfill
      console.log('🔄 Backfill mode - will generate new images for broken ones');
      await backfillBrokenImages();
    } else {
      console.log('Usage:');
      console.log('  node backfill-broken-hero-images.js test     # Just test, don\'t backfill');
      console.log('  node backfill-broken-hero-images.js backfill # Test and backfill images');
    }
  } catch (error) {
    console.error('\n💥 Fatal error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
