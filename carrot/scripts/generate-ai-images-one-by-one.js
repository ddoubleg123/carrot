const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const API_BASE_URL = 'https://carrot-app.onrender.com';
const PATCH_HANDLE = 'chicago-bulls';

// Track progress
let processedCount = 0;
let successCount = 0;
let failedCount = 0;

async function generateRealAIImage(item) {
  console.log(`\n🎨 Generating REAL AI image for: ${item.title}`);
  console.log(`   📝 Content: ${(item.content || '').substring(0, 100)}...`);
  
  try {
    const response = await fetch(`${API_BASE_URL}/api/ai/generate-hero-image`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: item.title,
        summary: item.content || '',
        contentType: item.type || 'article',
        artisticStyle: 'photorealistic',
        enableHiresFix: true, // Enable HD for better quality
        patchTheme: 'sports' // Chicago Bulls theme
      })
    });

    if (!response.ok) {
      console.error(`   ❌ API error: ${response.status} ${response.statusText}`);
      const errorText = await response.text();
      console.error(`   📄 Error details: ${errorText}`);
      return null;
    }

    const data = await response.json();
    
    if (data.success && data.imageUrl) {
      console.log(`   ✅ Generated AI image: ${data.imageUrl.substring(0, 80)}...`);
      return {
        url: data.imageUrl,
        source: 'ai-generated',
        license: 'generated',
        model: data.model || 'SDXL',
        features: data.featuresApplied || {}
      };
    } else {
      console.error('   ❌ No image URL returned');
      console.error('   📄 Response:', JSON.stringify(data, null, 2));
      return null;
    }
  } catch (error) {
    console.error('   ❌ Error:', error.message);
    return null;
  }
}

async function updateItemWithAIImage(itemId, aiImage) {
  console.log(`   💾 Updating database with AI image...`);
  
  try {
    await prisma.discoveredContent.update({
      where: { id: itemId },
      data: {
        mediaAssets: {
          hero: aiImage.url,
          source: aiImage.source,
          license: aiImage.license,
          model: aiImage.model,
          features: aiImage.features,
          generatedAt: new Date().toISOString()
        }
      }
    });
    console.log('   ✅ Database updated with AI image');
    return true;
  } catch (error) {
    console.error('   ❌ Database error:', error.message);
    return false;
  }
}

async function generateAIImagesOneByOne() {
  console.log('🚀 Starting One-by-One AI Image Generation');
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
      status: 'ready' // Only process approved items
    },
    select: {
      id: true,
      title: true,
      content: true,
      type: true,
      mediaAssets: true,
      createdAt: true
    },
    orderBy: { createdAt: 'desc' } // Start with newest items first
  });

  console.log(`📊 Found ${allContent.length} items to process\n`);

  // Process each item one by one
  for (let i = 0; i < allContent.length; i++) {
    const item = allContent[i];
    processedCount++;
    
    console.log(`\n[${processedCount}/${allContent.length}] Processing: ${item.title}`);
    console.log('=' .repeat(60));

    // Generate AI image
    const aiImage = await generateRealAIImage(item);
    
    if (aiImage) {
      // Update database with AI image
      const updated = await updateItemWithAIImage(item.id, aiImage);
      
      if (updated) {
        successCount++;
        console.log(`✨ Success! (${successCount}/${processedCount})`);
      } else {
        failedCount++;
        console.log(`❌ Failed to update database (${failedCount}/${processedCount})`);
      }
    } else {
      failedCount++;
      console.log(`❌ Failed to generate AI image (${failedCount}/${processedCount})`);
    }

    // Wait between requests to avoid rate limiting
    if (i < allContent.length - 1) {
      console.log('⏳ Waiting 3 seconds before next item...');
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }

  console.log('\n' + '=' .repeat(60));
  console.log('📊 AI Image Generation Complete!');
  console.log('=' .repeat(60));
  console.log(`   ✅ Success: ${successCount}`);
  console.log(`   ❌ Failed: ${failedCount}`);
  console.log(`   📈 Total: ${processedCount}`);
  console.log(`   🎯 Success Rate: ${Math.round((successCount / processedCount) * 100)}%`);
  console.log('=' .repeat(60));

  await prisma.$disconnect();
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n\n🛑 Received interrupt signal. Shutting down gracefully...');
  console.log(`📊 Progress: ${processedCount} processed, ${successCount} successful, ${failedCount} failed`);
  await prisma.$disconnect();
  process.exit(0);
});

// Run the script
generateAIImagesOneByOne().catch(console.error);
