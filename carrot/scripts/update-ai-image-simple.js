const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function updateAIImage() {
  const contentId = 'cmgxsstg6000lpj2b9ilsfe3g';
  
  console.log('🎯 Updating AI image for content:', contentId);
  
  try {
    // Get current content
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
      currentHero: content.mediaAssets?.hero ? 'Has hero image' : 'No hero image'
    });
    
    // Generate new AI image
    console.log('🎨 Generating new AI image...');
    
    const aiImageResponse = await fetch('https://carrot-app.onrender.com/api/ai/generate-hero-image', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: content.title,
        summary: content.content || 'Analysis of Phil Jackson\'s coaching philosophy and the triangle offense that powered the Bulls\' success',
        sourceDomain: 'espn.com',
        contentType: 'article',
        patchTheme: 'basketball',
        artisticStyle: 'photorealistic',
        enableHiresFix: true
      })
    });
    
    if (!aiImageResponse.ok) {
      const errorText = await aiImageResponse.text();
      console.log('❌ AI Image generation failed:', errorText);
      return;
    }
    
    const aiImageData = await aiImageResponse.json();
    
    if (aiImageData.success && aiImageData.imageUrl) {
      console.log('✅ AI Image generated successfully');
      console.log('🖼️ Image URL length:', aiImageData.imageUrl.length);
      
      // Update the database
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
              model: aiImageData.model || 'sdxl',
              features: aiImageData.features || {}
            }
          }
        }
      });
      
      console.log('✅ Database updated with new AI image');
      console.log('🎯 Content should now display the new high-quality AI image');
      
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
updateAIImage();
