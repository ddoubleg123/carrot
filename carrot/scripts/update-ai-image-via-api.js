async function updateAIImageViaAPI() {
  const contentId = 'cmgxsstg6000lpj2b9ilsfe3g';
  
  console.log('🎯 Updating AI image for content:', contentId);
  
  try {
    // Generate new AI image
    console.log('🎨 Generating new high-quality AI image...');
    
    const aiImageResponse = await fetch('https://carrot-app.onrender.com/api/ai/generate-hero-image', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: 'The Legacy of Phil Jackson and the Triangle Offense',
        summary: 'Analysis of Phil Jackson\'s coaching philosophy and the triangle offense that powered the Bulls\' success',
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
      console.log('🔧 Model used:', aiImageData.model);
      console.log('⚡ Generation time:', aiImageData.generationTime, 'seconds');
      
      // Now we need to update the content via API
      console.log('📡 Attempting to update content via API...');
      
      // Since we can't directly update the database, let's check if there's an update endpoint
      const updateResponse = await fetch(`https://carrot-app.onrender.com/api/patches/chicago-bulls/discovered-content`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: contentId,
          mediaAssets: {
            hero: aiImageData.imageUrl,
            heroImage: {
              url: aiImageData.imageUrl,
              source: 'ai-generated',
              license: 'generated',
              model: aiImageData.model || 'sdxl',
              features: aiImageData.features || {}
            }
          }
        })
      });
      
      if (updateResponse.ok) {
        console.log('✅ Content updated successfully via API');
      } else {
        console.log('⚠️ API update not available, but new image was generated');
        console.log('📋 Manual update needed:');
        console.log('   - Content ID:', contentId);
        console.log('   - New AI Image URL:', aiImageData.imageUrl.substring(0, 100) + '...');
        console.log('   - Image length:', aiImageData.imageUrl.length, 'characters');
      }
      
      console.log('\n🎯 Next steps:');
      console.log('1. Check the content URL to see if the new image is displaying');
      console.log('2. If not, the database may need to be updated manually');
      console.log('3. The new AI image has enhanced quality with hiresFix enabled');
      
    } else {
      console.log('❌ AI Image generation failed:', aiImageData);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Run the script
updateAIImageViaAPI();
