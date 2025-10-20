async function regenerateAIImageViaAPI() {
  const contentId = 'cmgxsstg6000lpj2b9ilsfe3g'; // The Legacy of Phil Jackson content
  const title = 'The Legacy of Phil Jackson and the Triangle Offense';
  
  console.log(`🎯 Regenerating AI image for: ${title}`);
  console.log(`📋 Content ID: ${contentId}`);
  
  try {
    // First, get the current content via API
    console.log('📡 Fetching current content...');
    const contentResponse = await fetch(`https://carrot-app.onrender.com/api/patches/chicago-bulls/discovered-content`);
    
    if (!contentResponse.ok) {
      console.log('❌ Failed to fetch content:', contentResponse.status);
      return;
    }
    
    const contentData = await contentResponse.json();
    const content = contentData.items.find(item => item.id === contentId);
    
    if (!content) {
      console.log('❌ Content not found in API response');
      return;
    }
    
    console.log('📄 Current content found:', {
      id: content.id,
      title: content.title,
      content: content.content,
      description: content.description,
      currentHero: content.mediaAssets?.hero
    });
    
    // Generate new AI image with enhanced quality settings
    console.log('🎨 Generating new AI image with enhanced quality...');
    const aiImageResponse = await fetch('https://carrot-app.onrender.com/api/ai/generate-hero-image', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: content.title,
        summary: content.content || content.description || 'Analysis of Phil Jackson\'s coaching philosophy and the triangle offense that powered the Bulls\' success',
        sourceDomain: content.sourceUrl ? new URL(content.sourceUrl).hostname : 'espn.com',
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
    console.log('🎨 AI Image generated successfully!');
    console.log('📊 Generation details:', {
      success: aiImageData.success,
      imageUrl: aiImageData.imageUrl,
      model: aiImageData.model,
      generationTime: aiImageData.generationTime,
      features: aiImageData.features
    });
    
    if (aiImageData.success && aiImageData.imageUrl) {
      console.log('✅ New AI image generated with enhanced quality settings');
      console.log('🖼️ Image URL:', aiImageData.imageUrl);
      console.log('🔧 Quality features applied:', {
        faceRestoration: aiImageData.features?.faceRestoration,
        upscaling: aiImageData.features?.upscaling,
        refiner: aiImageData.features?.refiner,
        hiresFix: aiImageData.features?.hiresFix
      });
      
      console.log('\n🎯 Next steps:');
      console.log('1. Check the new image quality at the content URL');
      console.log('2. Verify facial clarity and detail improvements');
      console.log('3. If satisfied, we can update the database with the new image');
      
    } else {
      console.log('❌ AI Image generation failed:', aiImageData);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Run the script
regenerateAIImageViaAPI();
