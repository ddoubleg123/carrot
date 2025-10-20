const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function regenerateSpecificAIImage() {
  const contentId = 'cmgxsstg6000lpj2b9ilsfe3g'; // The Legacy of Phil Jackson content
  const title = 'The Legacy of Phil Jackson and the Triangle Offense';
  
  console.log(`🎯 Regenerating AI image for: ${title}`);
  console.log(`📋 Content ID: ${contentId}`);
  
  try {
    // Get the content item
    const content = await prisma.discoveredContent.findUnique({
      where: { id: contentId }
    });
    
    if (!content) {
      console.log('❌ Content not found');
      return;
    }
    
    console.log('📄 Current content:', {
      id: content.id,
      title: content.title,
      currentHero: content.mediaAssets?.hero
    });
    
    // Generate new AI image with enhanced quality settings
    const aiImageResponse = await fetch('https://carrot-app.onrender.com/api/ai/generate-hero-image', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: content.title,
        description: content.content || '',
        tags: ['basketball', 'coaching', 'phil jackson', 'triangle offense', 'chicago bulls', 'nba'],
        // Enhanced quality settings for facial clarity and detail
        qualitySettings: {
          faceRestoration: true,    // Enable face restoration
          upscaling: true,         // Enable upscaling
          refiner: true,           // Enable refiner
          hiresFix: true,          // Enable hires fix
          steps: 50,               // More steps for better quality
          cfgScale: 7.5,           // Higher CFG for better detail
          seed: -1                 // Random seed for variety
        }
      })
    });
    
    if (!aiImageResponse.ok) {
      const errorText = await aiImageResponse.text();
      console.log('❌ AI Image generation failed:', errorText);
      return;
    }
    
    const aiImageData = await aiImageResponse.json();
    console.log('🎨 AI Image generated:', {
      success: aiImageData.success,
      imageUrl: aiImageData.imageUrl,
      model: aiImageData.model,
      features: aiImageData.features
    });
    
    if (aiImageData.success && aiImageData.imageUrl) {
      // Update the content with the new AI image
      const updatedContent = await prisma.discoveredContent.update({
        where: { id: contentId },
        data: {
          mediaAssets: {
            ...content.mediaAssets,
            hero: aiImageData.imageUrl,
            heroImage: {
              url: aiImageData.imageUrl,
              source: 'ai-generated',
              license: 'generated',
              model: aiImageData.model,
              features: aiImageData.features
            }
          }
        }
      });
      
      console.log('✅ Content updated with new AI image');
      console.log('🖼️ New hero image URL:', aiImageData.imageUrl);
      console.log('🔧 Features used:', aiImageData.features);
      
    } else {
      console.log('❌ AI Image generation failed:', aiImageData);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
regenerateSpecificAIImage();
